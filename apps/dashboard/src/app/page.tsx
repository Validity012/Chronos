"use client"

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SummaryCards } from "@/components/finance/summary-cards";
import { SpendingChart } from "@/components/finance/spending-chart";
import { BudgetList } from "@/components/finance/budget-list";
import { InsightsPanel } from "@/components/finance/insights-panel";
import { TransactionList } from "@/components/finance/transaction-list";

export default function DashboardPage() {
  return (
    <DashboardShell>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-2">📚 Academics</h3>
          <p className="text-sm text-muted-foreground">Coming in Phase 3</p>
        </div>
        <div className="space-y-4">
          <SummaryCards />
          <SpendingChart />
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-2">📅 Tasks</h3>
          <p className="text-sm text-muted-foreground">Coming in Phase 4</p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <BudgetList />
        <InsightsPanel />
      </div>
      <TransactionList />
    </DashboardShell>
  )
}
