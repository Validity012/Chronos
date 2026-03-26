"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckSquare, Square, Clock, AlertCircle, ExternalLink } from "lucide-react";
import { AddTaskForm } from "./add-task-form";

interface Task {
  id: string;
  title: string;
  notes?: string | null;
  status: "needsAction" | "completed";
  due?: string | null;
  listTitle: string;
  daysUntilDue: number;
}

export function TaskListWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchTasks = useCallback(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => {
        if (data.tasks) setTasks(data.tasks);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTasks();

    const handler = () => fetchTasks();
    window.addEventListener("tasks-updated", handler);
    return () => window.removeEventListener("tasks-updated", handler);
  }, [fetchTasks]);

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
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg animate-pulse bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Tasks
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? "Hide" : "+ Add"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAddForm && (
          <AddTaskForm />
        )}

        {tasks.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No upcoming tasks
          </p>
        )}

        {tasks.slice(0, 10).map((task) => {
          const isOverdue = task.daysUntilDue < 0;
          const isDueToday = task.daysUntilDue === 0;

          return (
            <div
              key={task.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
            >
              <button
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                onClick={() => {
                  fetch("/api/tasks", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title: task.title,
                      status: task.status === "needsAction" ? "completed" : "needsAction",
                      taskId: task.id,
                    }),
                  }).then(() => fetchTasks());
                }}
              >
                {task.status === "completed" ? (
                  <CheckSquare className="h-4 w-4 text-green-600" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    task.status === "completed" ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {task.listTitle}
                  </Badge>
                  {task.due && (
                    <span
                      className={`flex items-center gap-1 text-xs ${
                        isOverdue
                          ? "text-destructive"
                          : isDueToday
                          ? "text-yellow-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {isOverdue ? (
                        <AlertCircle className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {task.daysUntilDue < 0
                        ? `${Math.abs(task.daysUntilDue)}d overdue`
                        : task.daysUntilDue === 0
                        ? "Due today"
                        : `In ${task.daysUntilDue}d`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {tasks.length > 10 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            +{tasks.length - 10} more tasks
          </p>
        )}
      </CardContent>
    </Card>
  );
}
