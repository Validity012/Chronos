"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, DollarSign, BookOpen, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/finance", label: "Finance", icon: DollarSign },
  { href: "/academics", label: "Academics", icon: BookOpen },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-background/95 backdrop-blur md:hidden">
      <div className="grid h-full grid-cols-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 text-sm font-medium text-muted-foreground"
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-full p-2 transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : ""
                )}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <span
                className={cn(
                  "text-xs",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
