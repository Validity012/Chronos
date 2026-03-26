"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function QuickActions() {
  const handleLogExpense = async () => {
    const res = await fetch("/api/finance/expense", { method: "POST" });
    if (res.ok) {
      toast.success("Expense logging coming soon!");
    } else {
      toast.error("Failed to log expense.");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleLogExpense}>Log Expense</Button>
      <Button variant="outline" onClick={() => toast.info("Add task functionality coming soon!")}>Add Task</Button>
      <Button variant="outline" onClick={() => toast.info("Grade checking functionality coming soon!")}>Check Grades</Button>
    </div>
  );
}
