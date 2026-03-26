"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
}

export function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/finance/summary')
      .then(res => res.json())
      .then(data => {
        setTransactions(data.transactions)
        setLoading(false)
      })
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="ml-auto h-4 bg-muted rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
          {transactions.length === 0 ? (
            <div className="text-center text-muted-foreground">No transactions yet.</div>
          ) : (
            transactions.map(transaction => (
              <div key={transaction.id} className="flex items-center justify-between py-2 border-b">
                <div>
                  <div className="font-medium">{transaction.description.substring(0, 30)}{transaction.description.length > 30 && '...'}</div>
                  <div className="text-sm text-muted-foreground">{new Date(transaction.date).toLocaleDateString()}</div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${transaction.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatCurrency(transaction.amount)}
                  </div>
                  <Badge variant="outline">{transaction.category}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
