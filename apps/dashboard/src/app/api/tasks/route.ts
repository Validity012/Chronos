import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getGoogleSession } from '@/lib/dashboard-db';
import { getTaskCache, setTaskCache } from '@/lib/dashboard-db';
import type { Task, TaskList } from '@/lib/google-tasks';

async function createTasksClient() {
  const session = await getGoogleSession();
  if (!session) return null;

  const creds = JSON.parse(session.cookies);
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
  );
  oauth2Client.setCredentials(creds);
  return google.tasks({ version: 'v1', auth: oauth2Client });
}

export async function GET() {
  const cached = await getTaskCache('tasks');
  if (cached) {
    return NextResponse.json(JSON.parse(cached.data));
  }

  const tasksApi = await createTasksClient();
  if (!tasksApi) {
    return NextResponse.json({ error: 'Not authenticated with Google', tasks: [], summary: {} }, { status: 401 });
  }

  try {
    const listsResponse = await tasksApi.tasklists.list({ maxResults: 100 });
    const taskLists: TaskList[] = listsResponse.data.items?.map(l => ({
      id: l.id!,
      title: l.title!,
      updated: l.updated || undefined,
    })) || [];

    const allTasks: Array<Task & { listTitle: string; daysUntilDue: number }> = [];
    const now = new Date();

    for (const list of taskLists.slice(0, 10)) {
      try {
        const tasksResponse = await tasksApi.tasks.list({
          tasklist: list.id,
          showCompleted: false,
          maxResults: 100,
        });

        const items = tasksResponse.data.items || [];
        for (const t of items) {
          const due = t.due ? new Date(t.due) : null;
          const daysUntilDue = due
            ? Math.ceil((due.getTime() - now.getTime()) / (1000 * 3600 * 24))
            : 999;

          allTasks.push({
            id: t.id!,
            title: t.title!,
            notes: t.notes || null,
            status: (t.status as 'needsAction' | 'completed') || 'needsAction',
            due: t.due || null,
            completed: t.completed || null,
            parent: t.parent || null,
            position: t.position || null,
            links: t.links || null,
            updated: t.updated || null,
            listTitle: list.title,
            daysUntilDue,
          });
        }
      } catch (_) {}
    }

    const overdue = allTasks.filter(t => t.daysUntilDue < 0 && t.status === 'needsAction');
    const dueToday = allTasks.filter(t => t.daysUntilDue === 0 && t.status === 'needsAction');
    const upcoming = allTasks.filter(t => t.daysUntilDue > 0 && t.daysUntilDue <= 7 && t.status === 'needsAction');
    const completed = allTasks.filter(t => t.status === 'completed');

    const sorted = [
      ...overdue.sort((a, b) => a.daysUntilDue - b.daysUntilDue),
      ...dueToday.sort((a, b) => a.daysUntilDue - b.daysUntilDue),
      ...upcoming.sort((a, b) => a.daysUntilDue - b.daysUntilDue),
    ];

    const result = {
      tasks: sorted,
      summary: {
        totalTasks: allTasks.filter(t => t.status === 'needsAction').length,
        completedTasks: completed.length,
        overdueTasks: overdue.length,
        dueTodayTasks: dueToday.length,
        upcomingTasks: upcoming.length,
      },
      taskLists,
    };

    await setTaskCache('tasks', JSON.stringify(result), 5);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Tasks API error:', err);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const tasksApi = await createTasksClient();
  if (!tasksApi) {
    return NextResponse.json({ error: 'Not authenticated with Google' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, notes, due, listId, taskId, status } = body;

    const listsResponse = await tasksApi.tasklists.list({ maxResults: 100 });
    const lists = listsResponse.data.items || [];
    const targetListId = listId || (lists[0]?.id ?? '@default');

    if (taskId && status) {
      await tasksApi.tasks.patch({
        tasklist: targetListId,
        task: taskId,
        requestBody: { status },
      });
      return NextResponse.json({ success: true });
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    await tasksApi.tasks.insert({
      tasklist: targetListId,
      requestBody: {
        title: title.trim(),
        notes: notes || undefined,
        due: due ? new Date(due).toISOString() : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Tasks POST error:', err);
    return NextResponse.json({ error: 'Failed to process task' }, { status: 500 });
  }
}
