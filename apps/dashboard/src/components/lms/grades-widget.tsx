"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Star, GraduationCap } from "lucide-react";
import type { Grade } from "@/lib/moodle";

function GradeItem({ grade }: { grade: Grade }) {
  const percentage = grade.percentage;
  let colorClass = "text-muted-foreground";
  if (percentage !== null) {
    if (percentage >= 90) colorClass = "text-green-500";
    else if (percentage >= 80) colorClass = "text-blue-500";
    else if (percentage >= 70) colorClass = "text-yellow-500";
    else colorClass = "text-destructive";
  }

  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex items-center gap-4">
        <GraduationCap className="h-6 w-6 text-muted-foreground" />
        <div>
          <p className="font-semibold">{grade.assignment}</p>
          <p className="text-sm text-muted-foreground">{grade.course}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-lg font-bold ${colorClass}`}>{grade.grade}</p>
        {percentage !== null && (
          <p className={`text-sm font-medium ${colorClass}`}>{percentage.toFixed(1)}%</p>
        )}
      </div>
    </div>
  );
}

export function GradesWidget() {
  const [grades, setGrades] = useState<Grade[]>([]);
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
        const sortedGrades = (data.grades || []).sort((a: Grade, b: Grade) => {
            if (!a.gradedDate) return 1;
            if (!b.gradedDate) return -1;
            return new Date(b.gradedDate).getTime() - new Date(a.gradedDate).getTime();
        });
        setGrades(sortedGrades);
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
        <CardTitle>Recent Grades</CardTitle>
        <CardDescription>Your latest scores from Moodle.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse bg-muted rounded-md" />
            ))}
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-2" />
            <p className="font-semibold">Error loading grades</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}
        {!loading && !error && grades.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Star className="h-10 w-10 text-yellow-500 mb-2" />
            <p className="font-semibold">No Grades Yet</p>
            <p className="text-sm text-muted-foreground">Your recent grades will appear here.</p>
          </div>
        )}
        {!loading && !error && grades.length > 0 && (
          <div className="divide-y divide-border -mt-4">
            {grades.map((grade) => (
              <GradeItem key={grade.id} grade={grade} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
