"use client"

import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

const DonutChart = dynamic(() => import('./donut-chart-client'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] w-full flex items-center justify-center">
      <div className="h-32 w-32 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
    </div>
  )
})

const config: ChartConfig = {
  food: { label: "Food", color: "hsl(var(--chart-1))" },
  transport: { label: "Transport", color: "hsl(var(--chart-2))" },
  utilities: { label: "Utilities", color: "hsl(var(--chart-3))" },
  entertainment: { label: "Entertainment", color: "hsl(var(--chart-4))" },
  shopping: { label: "Shopping", color: "hsl(var(--chart-5))" },
}

export function SpendingChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[300px] w-full">
          <DonutChart />
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
