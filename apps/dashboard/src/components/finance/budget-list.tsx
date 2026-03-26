"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"

interface Budget {
  category: string;
  limit: number;
  spent: number;
  percentage: number;
}

export function BudgetList() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/finance/summary')
      .then(res => res.json())
      .then(data => {
        setBudgets(data.budgetUsage ?? [])
        setLoading(false)
      })
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const getProgressColor = (percentage: number) => {
    if (percentage > 80) return "bg-red-500"
    if (percentage > 60) return "bg-yellow-500"
    return "bg-green-500"
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budgets</CardTitle>
        </CardHeader>
        <CardContent>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="mb-4">
              <div className="flex justify-between mb-1">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-4 bg-muted rounded w-1/4"></div>
              </div>
              <div className="h-4 bg-muted rounded w-full"></div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budgets</CardTitle>
      </CardHeader>
      <CardContent>
        {budgets.map((budget, i) => {
          const percentage = Math.min(budget.percentage, 100)
          return (
            <div key={i} className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">{budget.category}</span>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(budget.spent)} / {formatCurrency(budget.limit)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${getProgressColor(percentage)}`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          )
        })}
        {budgets.length === 0 && (
          <div className="text-center text-muted-foreground">No budgets set.</div>
        )}
      </CardContent>
    </Card>
  )
}
