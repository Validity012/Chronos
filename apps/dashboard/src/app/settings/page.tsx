"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle } from "lucide-react"
import { DashboardShell } from "@/components/layout/dashboard-shell"

const services = [
  { name: "Groq API", configured: true },
  { name: "Google Calendar", configured: true },
  { name: "LMS Integration", configured: false },
]

export default function SettingsPage() {
  return (
    <DashboardShell>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {services.map(service => (
                <div key={service.name} className="flex items-center justify-between">
                  <span className="font-medium">{service.name}</span>
                  <div className="flex items-center gap-2">
                    {service.configured ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className={`text-sm ${service.configured ? 'text-green-500' : 'text-red-500'}`}>
                      {service.configured ? "Configured" : "Not Configured"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
