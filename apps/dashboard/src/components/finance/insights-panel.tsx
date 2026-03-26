"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { Loader2 } from "lucide-react"

export function InsightsPanel() {
  const [query, setQuery] = useState("")
  const [insight, setInsight] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const getInsight = async () => {
    setLoading(true)
    setError("")
    setInsight("")
    try {
      const response = await fetch('/api/finance/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!response.ok) {
        throw new Error('Failed to fetch insights')
      }
      const data = await response.json()
      setInsight(data.insight)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Financial Assistant</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid w-full gap-2">
          <Textarea
            placeholder="Ask about your spending habits, budgets, or transactions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button onClick={getInsight} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Get Insights
          </Button>
        </div>
        {error && <div className="mt-4 text-sm text-red-500">{error}</div>}
        {insight && (
          <div className="mt-4 rounded-lg border bg-muted p-4 text-sm">
            {insight}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
