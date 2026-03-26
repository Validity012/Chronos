"use client"

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, FileText, XCircle } from "lucide-react";
import type { Assignment } from "@/lib/moodle";
import { cn } from "@/lib/utils";
import { type VariantProps } from "class-variance-authority";

function formatDueDate(dueDate: Date | null): string {
  if (!dueDate) return "No due date";
  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 1) return `Due in ${diffDays} days`;
  if (diffDays === 1) return `Due tomorrow`;
  if (diffDays === 0) return `Due today`;
  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} days`;
  return "Due soon";
}

function getStatusInfo(status: Assignment['submissionStatus']): { variant: VariantProps<typeof badgeVariants>["variant"]; icon: React.ReactElement; label: string } {
  switch (status) {
    case 'overdue':
      return { variant: "destructive", icon: <XCircle className="h-4 w-4" />, label: "Overdue" };
    case 'pending':
      return { variant: "warning", icon: <Clock className="h-4 w-4" />, label: "Pending" };
    case 'submitted':
      return { variant: "info", icon: <CheckCircle className="h-4 w-4" />, label: "Submitted" };
    case 'graded':
      return { variant: "success", icon: <CheckCircle className="h-4 w-4" />, label: "Graded" };
    default:
      return { variant: "secondary", icon: <AlertCircle className="h-4 w-4" />, label: "Unknown" };
  }
}

function AssignmentItem({ assignment }: { assignment: Assignment }) {
  const statusInfo = getStatusInfo(assignment.submissionStatus);
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex items-center gap-4">
        <FileText className="h-6 w-6 text-muted-foreground" />
        <div>
          <a href={assignment.link} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
            {assignment.title}
          </a>
          <p className="text-sm text-muted-foreground">{assignment.course}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{formatDueDate(assignment.dueDate)}</p>
        <Badge variant={statusInfo.variant} className="mt-1">
          {statusInfo.icon}
          <span className="ml-1.5">{statusInfo.label}</span>
        </Badge>
      </div>
    </div>
  );
}

export function AssignmentsWidget() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/lms');
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }
        const data = await response.json();
        const sortedAssignments = (data.assignments || []).sort((a: Assignment, b: Assignment) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
        setAssignments(sortedAssignments);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Assignments</CardTitle>
        <CardDescription>Your deadlines from Moodle.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse bg-muted rounded-md" />
            ))}
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-2" />
            <p className="font-semibold">Error loading assignments</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}
        {!loading && !error && assignments.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
            <p className="font-semibold">All Caught Up!</p>
            <p className="text-sm text-muted-foreground">You have no upcoming assignments.</p>
          </div>
        )}
        {!loading && !error && assignments.length > 0 && (
          <div className="divide-y divide-border -mt-4">
            {assignments.map((assignment) => (
              <AssignmentItem key={assignment.id} assignment={assignment} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
