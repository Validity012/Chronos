"use client"

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SummaryCards } from "@/components/finance/summary-cards";
import { SpendingChart } from "@/components/finance/spending-chart";
import { BudgetList } from "@/components/finance/budget-list";
import { InsightsPanel } from "@/components/finance/insights-panel";
import { TransactionList } from "@/components/finance/transaction-list";
import { AssignmentsWidget } from "@/components/lms/assignments-widget";
import { GradesWidget } from "@/components/lms/grades-widget";
import { CoursesWidget } from "@/components/lms/courses-widget";

export default function DashboardPage() {
  return (
    <DashboardShell>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AssignmentsWidget />
        </div>
        <div className="space-y-6">
          <GradesWidget />
          <CoursesWidget />
        </div>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-6">
          <SpendingChart />
          <TransactionList />
        </div>
        <div className="space-y-6">
          <SummaryCards />
          <BudgetList />
          <InsightsPanel />
        </div>
      </div>
    </DashboardShell>
  );
}

