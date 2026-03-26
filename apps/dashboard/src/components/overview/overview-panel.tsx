"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  CheckSquare,
  FileText,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface Assignment {
  id: number;
  title: string;
  course: string;
  dueDate: string | null;
  link: string;
}

interface Task {
  id: string;
  title: string;
  due: string | null;
  notes: string | null;
}

interface FinanceSummary {
  spendingToday: number;
  budgetStatus: 'On Track' | 'Over Budget' | 'Under Budget';
}

interface UpcomingItem {
  icon: React.ReactNode;
  title: string;
  source: string;
  dueDate: string;
  type: 'assignment' | 'task';
  rawDate: number;
}

function formatDueDate(dateString: string | null): string {
    if (!dateString) return "No due date";
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 1) return `in ${diffDays} days`;
    if (diffDays === 1) return `tomorrow`;
    if (diffDays === 0) return `today`;
    return `overdue`;
}

export function OverviewPanel() {
  const [upcomingItems, setUpcomingItems] = useState<UpcomingItem[]>([]);
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [lmsRes, tasksRes, financeRes] = await Promise.all([
          fetch("/api/lms"),
          fetch("/api/tasks"),
          fetch("/api/finance/summary"),
        ]);

        if (!lmsRes.ok || !tasksRes.ok || !financeRes.ok) {
          throw new Error("Failed to fetch all data");
        }

        const lmsData = await lmsRes.json();
        const tasksData = await tasksRes.json();
        const financeData = await financeRes.json();

        const assignments = (lmsData.assignments || [])
          .filter((a: Assignment) => a.dueDate)
          .map((a: Assignment) => ({
            icon: <FileText className="size-4 text-muted-foreground" />,
            title: a.title,
            source: "Assignment",
            dueDate: formatDueDate(a.dueDate),
            type: 'assignment' as const,
            rawDate: new Date(a.dueDate!).getTime(),
          }));

        const tasks = (tasksData.tasks || [])
          .filter((t: Task) => t.due)
          .map((t: Task) => ({
            icon: <CheckSquare className="size-4 text-muted-foreground" />,
            title: t.title,
            source: "Task",
            dueDate: formatDueDate(t.due),
            type: 'task' as const,
            rawDate: new Date(t.due!).getTime(),
          }));

        const allItems = [...assignments, ...tasks]
          .sort((a, b) => a.rawDate - b.rawDate)
          .slice(0, 3);

        setUpcomingItems(allItems);

        setSummaryStats({
          tasksRemaining: tasksData.summary?.totalTasks ?? 0,
          assignmentsDue: lmsData.summary?.upcoming ?? 0,
          budgetStatus: financeData.summary?.budgetStatus ?? "On Track",
          spendingToday: financeData.summary?.spendingToday ?? 0,
        });

      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Your Week at a Glance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Up Next
            </h3>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="size-4 rounded-full" />
                  <div className="flex-grow space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-2/3 mx-auto" />
                      <Skeleton className="h-8 w-1/2 mx-auto" />
                  </div>
              ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
      return (
          <Card>
              <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
              <CardContent><p className="text-destructive">{error}</p></CardContent>
          </Card>
      )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Your Week at a Glance</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Up Next
          </h3>
          <div className="space-y-4">
            {upcomingItems.map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                {item.icon}
                <div className="flex-grow">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.source} &middot; {item.dueDate}
                  </p>
                </div>
                <Button size="sm" variant="ghost">
                  View
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Tasks Remaining</p>
            <p className="text-2xl font-bold">
              {summaryStats.tasksRemaining}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Assignments Due</p>
            <p className="text-2xl font-bold">{summaryStats.assignmentsDue}</p>
          </div>
          <div>
            <p className={`text-lg font-semibold flex items-center justify-center gap-1 ${summaryStats.budgetStatus === 'On Track' ? 'text-green-600' : 'text-red-600'}`}>
              {summaryStats.budgetStatus === 'On Track' ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />} {summaryStats.budgetStatus}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Spent Today</p>
            <p className="text-2xl font-bold">${summaryStats.spendingToday.toFixed(2)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
