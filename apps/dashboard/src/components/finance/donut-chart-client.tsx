"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';

interface Spending {
  category: string;
  amount: number;
}

const DonutChartClient = () => {
  const [spending, setSpending] = useState<Spending[]>([])

  useEffect(() => {
    fetch('/api/finance/summary')
      .then(res => res.json())
      .then(data => {
        setSpending(data.spendingByCategory)
      })
  }, [])

  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Tooltip
          cursor={false}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            borderColor: "hsl(var(--border))",
          }}
        />
        <Pie
          data={spending}
          dataKey="amount"
          nameKey="category"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          fill="#8884d8"
        >
          {spending.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};

export default DonutChartClient;
