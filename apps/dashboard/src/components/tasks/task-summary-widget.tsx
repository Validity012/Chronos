"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, Square, Clock, AlertCircle, Calendar, Plus } from "lucide-react";

interface TaskSummary {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  dueTodayTasks: number;
  upcomingTasks: number;
}

export function TaskSummaryWidget() {
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => {
        if (r.status === 401) {
          setIsConnected(false);
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setSummary(data.summary || data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Connect Google Tasks to see your tasks here.
          </p>
          <a href="/api/auth/google?action=init">
            <Button size="sm">Connect Google</Button>
          </a>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg animate-pulse bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load tasks</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <span className="text-2xl font-bold">{summary.totalTasks}</span>
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-red-500/10">
            <span className="text-2xl font-bold text-destructive">{summary.overdueTasks}</span>
            <span className="text-xs text-muted-foreground">Overdue</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-yellow-500/10">
            <span className="text-2xl font-bold text-yellow-600">{summary.dueTodayTasks}</span>
            <span className="text-xs text-muted-foreground">Due Today</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-green-500/10">
            <span className="text-2xl font-bold text-green-600">{summary.upcomingTasks}</span>
            <span className="text-xs text-muted-foreground">This Week</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
