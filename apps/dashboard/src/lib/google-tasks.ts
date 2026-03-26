import { google, tasks_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface Task {
  id: string;
  title: string;
  notes?: string | null;
  status: 'needsAction' | 'completed';
  due?: string | null;
  completed?: string | null;
  parent?: string | null;
  position?: string | null;
  links?: Array<{
    type?: string;
    description?: string;
    link?: string;
  }> | null;
  updated?: string | null;
}

export interface TaskList {
  id: string;
  title: string;
  updated?: string | null;
}

export interface CreateTaskData {
  title: string;
  notes?: string | null;
  due?: string | null;
  parent?: string | null;
}

export interface UpdateTaskData {
  title?: string;
  notes?: string | null;
  status?: 'needsAction' | 'completed';
  due?: string | null;
}

export class GoogleTasksClient {
  private oauth2Client: OAuth2Client;
  private tasksApi: tasks_v1.Tasks;
  private isAuthenticated: boolean = false;

  constructor() {
    // Initialize OAuth2 client
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
    );

    // Initialize Tasks API
    this.tasksApi = google.tasks({ 
      version: 'v1', 
      auth: this.oauth2Client 
    });
  }

  /**
   * Generate OAuth URL for authentication
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/tasks',
      'https://www.googleapis.com/auth/tasks.readonly'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async authenticate(code: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      this.isAuthenticated = true;
    } catch (error) {
      throw new Error(`Authentication failed: ${error}`);
    }
  }

  /**
   * Set credentials directly (for stored tokens)
   */
  setCredentials(tokens: any): void {
    this.oauth2Client.setCredentials(tokens);
    this.isAuthenticated = true;
  }

  /**
   * Get fresh access token using refresh token
   */
  async refreshTokens(): Promise<any> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      return credentials;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error}`);
    }
  }

  /**
   * Get all task lists
   */
  async getTaskLists(): Promise<TaskList[]> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await this.tasksApi.tasklists.list({
        maxResults: 100
      });

      return response.data.items?.map(list => ({
        id: list.id!,
        title: list.title!,
        updated: list.updated
      })) || [];
    } catch (error) {
      throw new Error(`Failed to get task lists: ${error}`);
    }
  }

  /**
   * Get tasks from a specific list
   */
  async getTasks(taskListId: string, options?: {
    showCompleted?: boolean;
    showDeleted?: boolean;
    showHidden?: boolean;
    maxResults?: number;
    dueMin?: string;
    dueMax?: string;
  }): Promise<Task[]> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      // If no taskListId provided, use the default list
      if (!taskListId) {
        const lists = await this.getTaskLists();
        if (lists.length === 0) {
          throw new Error('No task lists found');
        }
        taskListId = lists[0].id;
      }

      const response = await this.tasksApi.tasks.list({
        tasklist: taskListId,
        showCompleted: options?.showCompleted ?? false,
        showDeleted: options?.showDeleted ?? false,
        showHidden: options?.showHidden ?? false,
        maxResults: options?.maxResults ?? 100,
        dueMin: options?.dueMin,
        dueMax: options?.dueMax
      });

      return response.data.items?.map(task => ({
        id: task.id!,
        title: task.title!,
        notes: task.notes,
        status: task.status as 'needsAction' | 'completed',
        due: task.due,
        completed: task.completed,
        parent: task.parent,
        position: task.position,
        links: task.links,
        updated: task.updated
      })) || [];
    } catch (error) {
      throw new Error(`Failed to get tasks: ${error}`);
    }
  }

  /**
   * Get all tasks from all lists
   */
  async getAllTasks(options?: {
    showCompleted?: boolean;
    maxResults?: number;
  }): Promise<Array<Task & { listTitle: string }>> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const taskLists = await this.getTaskLists();
      const allTasks: Array<Task & { listTitle: string }> = [];

      for (const list of taskLists) {
        try {
          const tasks = await this.getTasks(list.id, {
            showCompleted: options?.showCompleted ?? false,
            maxResults: options?.maxResults ?? 50
          });

          const tasksWithList = tasks.map(task => ({
            ...task,
            listTitle: list.title
          }));

          allTasks.push(...tasksWithList);
        } catch (error) {
          console.warn(`Failed to get tasks from list ${list.title}:`, error);
        }
      }

      return allTasks;
    } catch (error) {
      throw new Error(`Failed to get all tasks: ${error}`);
    }
  }

  /**
   * Create a new task
   */
  async createTask(
    taskData: CreateTaskData,
    taskListId: string
  ): Promise<Task> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      // If no taskListId provided, use the default list
      if (!taskListId) {
        const lists = await this.getTaskLists();
        if (lists.length === 0) {
          throw new Error('No task lists found');
        }
        taskListId = lists[0].id;
      }

      const response = await this.tasksApi.tasks.insert({
        tasklist: taskListId,
        parent: taskData.parent || undefined,
        requestBody: {
          title: taskData.title,
          notes: taskData.notes,
          due: taskData.due ? new Date(taskData.due).toISOString() : undefined
        }
      });

      const task = response.data;
      return {
        id: task.id!,
        title: task.title!,
        notes: task.notes,
        status: task.status as 'needsAction' | 'completed',
        due: task.due,
        completed: task.completed,
        parent: task.parent,
        position: task.position,
        links: task.links,
        updated: task.updated
      };
    } catch (error) {
      throw new Error(`Failed to create task: ${error}`);
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(
    taskId: string,
    taskData: UpdateTaskData,
    taskListId: string
  ): Promise<Task> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      // If no taskListId provided, use the default list
      if (!taskListId) {
        const lists = await this.getTaskLists();
        if (lists.length === 0) {
          throw new Error('No task lists found');
        }
        taskListId = lists[0].id;
      }

      const response = await this.tasksApi.tasks.patch({
        tasklist: taskListId,
        task: taskId,
        requestBody: {
          title: taskData.title,
          notes: taskData.notes,
          status: taskData.status,
          due: taskData.due ? new Date(taskData.due).toISOString() : undefined
        }
      });

      const task = response.data;
      return {
        id: task.id!,
        title: task.title!,
        notes: task.notes,
        status: task.status as 'needsAction' | 'completed',
        due: task.due,
        completed: task.completed,
        parent: task.parent,
        position: task.position,
        links: task.links,
        updated: task.updated
      };
    } catch (error) {
      throw new Error(`Failed to update task: ${error}`);
    }
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string, taskListId: string): Promise<Task> {
    return this.updateTask(taskId, { status: 'completed' }, taskListId);
  }

  /**
   * Mark task as incomplete
   */
  async incompleteTask(taskId: string, taskListId: string): Promise<Task> {
    return this.updateTask(taskId, { status: 'needsAction' }, taskListId);
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string, taskListId: string): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      // If no taskListId provided, use the default list
      if (!taskListId) {
        const lists = await this.getTaskLists();
        if (lists.length === 0) {
          throw new Error('No task lists found');
        }
        taskListId = lists[0].id;
      }

      await this.tasksApi.tasks.delete({
        tasklist: taskListId,
        task: taskId
      });
    } catch (error) {
      throw new Error(`Failed to delete task: ${error}`);
    }
  }

  /**
   * Get upcoming tasks (due in next N days)
   */
  async getUpcomingTasks(days: number = 7): Promise<Array<Task & { listTitle: string; daysUntilDue: number }>> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + days);

      const tasks = await this.getAllTasks({ showCompleted: false });
      
      // Filter tasks with due dates within the specified range
      const upcomingTasks = tasks
        .filter(task => task.due)
        .map(task => {
          const dueDate = new Date(task.due!);
          const timeDiff = dueDate.getTime() - now.getTime();
          const daysUntilDue = Math.ceil(timeDiff / (1000 * 3600 * 24));
          
          return {
            ...task,
            daysUntilDue
          };
        })
        .filter(task => task.daysUntilDue >= 0 && task.daysUntilDue <= days)
        .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

      return upcomingTasks;
    } catch (error) {
      throw new Error(`Failed to get upcoming tasks: ${error}`);
    }
  }

  /**
   * Search tasks by title or notes
   */
  async searchTasks(query: string): Promise<Array<Task & { listTitle: string }>> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const allTasks = await this.getAllTasks({ showCompleted: false });
      
      const queryLower = query.toLowerCase();
      const filteredTasks = allTasks.filter(task => 
        task.title.toLowerCase().includes(queryLower) ||
        (task.notes && task.notes.toLowerCase().includes(queryLower))
      );

      return filteredTasks;
    } catch (error) {
      throw new Error(`Failed to search tasks: ${error}`);
    }
  }

  /**
   * Get tasks summary
   */
  async getTasksSummary(): Promise<{
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    dueTodayTasks: number;
    upcomingTasks: number;
  }> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const allTasks = await this.getAllTasks({ showCompleted: true });
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const summary = {
        totalTasks: allTasks.filter(task => task.status === 'needsAction').length,
        completedTasks: allTasks.filter(task => task.status === 'completed').length,
        overdueTasks: 0,
        dueTodayTasks: 0,
        upcomingTasks: 0
      };

      allTasks.forEach(task => {
        if (task.due && task.status === 'needsAction') {
          const dueDate = new Date(task.due);
          const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          
          if (dueDateOnly < today) {
            summary.overdueTasks++;
          } else if (dueDateOnly.getTime() === today.getTime()) {
            summary.dueTodayTasks++;
          } else {
            summary.upcomingTasks++;
          }
        }
      });

      return summary;
    } catch (error) {
      throw new Error(`Failed to get tasks summary: ${error}`);
    }
  }

  /**
   * Check if client is authenticated
   */
  isAuth(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Get current credentials
   */
  getCredentials(): any {
    return this.oauth2Client.credentials;
  }
}

/**
 * Utility function to create a task with validation
 */
export function validateTaskData(data: CreateTaskData): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Task title is required');
  }

  if (data.title && data.title.length > 1024) {
    errors.push('Task title must be less than 1024 characters');
  }

  if (data.notes && data.notes.length > 8192) {
    errors.push('Task notes must be less than 8192 characters');
  }

  if (data.due) {
    const dueDate = new Date(data.due);
    if (isNaN(dueDate.getTime())) {
      errors.push('Due date is invalid');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Format task due date for display
 */
export function formatTaskDueDate(due?: string): string {
  if (!due) return '';
  
  const dueDate = new Date(due);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  
  const timeDiff = dueDateOnly.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  if (daysDiff < 0) {
    return `Overdue by ${Math.abs(daysDiff)} day${Math.abs(daysDiff) > 1 ? 's' : ''}`;
  } else if (daysDiff === 0) {
    return 'Due today';
  } else if (daysDiff === 1) {
    return 'Due tomorrow';
  } else if (daysDiff <= 7) {
    return `Due in ${daysDiff} days`;
  } else {
    return dueDate.toLocaleDateString();
  }
}
