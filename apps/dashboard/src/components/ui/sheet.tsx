"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

const Sheet = ({ open, onOpenChange, children }: SheetProps) => {
  return <>{children}</>
}

const SheetTrigger = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const SheetContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { side?: "left" | "right" }
>(({ className, children, side = "left", ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-y-0 flex flex-col z-50 bg-background p-6 transition-transform duration-300 ease-in-out",
        side === "left" ? "left-0" : "right-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
SheetContent.displayName = "SheetContent"

export { Sheet, SheetTrigger, SheetContent }
