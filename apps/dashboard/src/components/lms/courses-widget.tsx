"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, BookOpen, CheckCircle } from "lucide-react";
import type { Course } from "@/lib/moodle";

function CourseItem({ course }: { course: Course }) {
  return (
    <a
      href={course.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 py-3 px-4 -mx-4 rounded-lg hover:bg-muted transition-colors"
    >
      <BookOpen className="h-6 w-6 text-muted-foreground" />
      <div>
        <p className="font-semibold">{course.name}</p>
        <p className="text-sm text-muted-foreground">{course.shortName}</p>
      </div>
    </a>
  );
}

export function CoursesWidget() {
  const [courses, setCourses] = useState<Course[]>([]);
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
        setCourses(data.courses || []);
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
        <CardTitle>My Courses</CardTitle>
        <CardDescription>Your enrolled courses on Moodle.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse bg-muted rounded-md" />
            ))}
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-2" />
            <p className="font-semibold">Error loading courses</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}
        {!loading && !error && courses.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
            <p className="font-semibold">No Courses Found</p>
            <p className="text-sm text-muted-foreground">We couldn't find any enrolled courses.</p>
          </div>
        )}
        {!loading && !error && courses.length > 0 && (
          <div className="divide-y divide-border -mt-4">
            {courses.map((course) => (
              <CourseItem key={course.id} course={course} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
