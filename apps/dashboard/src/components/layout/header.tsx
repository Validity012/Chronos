"use client";

import Link from "next/link";
import { CircleUser, Menu, Moon, Sun, Clock, Home, BookOpen, CheckSquare, DollarSign } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { usePathname } from "next/navigation";

export function Header() {
  const { setTheme, theme } = useTheme();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const getTitle = () => {
    switch (pathname) {
      case "/":
        return "Dashboard";
      case "/finance":
        return "Finance";
      case "/academics":
        return "Academics";
      case "/tasks":
        return "Tasks";
      case "/settings":
        return "Settings";
      default:
        return "Dashboard";
    }
  };

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
        <SheetContent side="left" className="flex flex-col">
          <nav className="grid gap-2 text-lg font-medium">
            <Link
              href="#"
              className="flex items-center gap-2 text-lg font-semibold"
            >
              <Clock className="h-6 w-6" />
              <span className="sr-only">Chronos</span>
            </Link>
            <Link
              href="/"
              className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
            >
              <Home className="h-5 w-5" />
              Dashboard
            </Link>
            <Link
              href="/finance"
              className="mx-[-0.65rem] flex items-center gap-4 rounded-xl bg-muted px-3 py-2 text-foreground hover:text-foreground"
            >
              <DollarSign className="h-5 w-5" />
              Finance
            </Link>
            <Link
              href="/academics"
              className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
            >
              <BookOpen className="h-5 w-5" />
              Academics
            </Link>
            <Link
              href="/tasks"
              className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
            >
              <CheckSquare className="h-5 w-5" />
              Tasks
            </Link>
          </nav>
        </SheetContent>
      </Sheet>

      <div className="w-full flex-1">
        <h1 className="text-lg font-semibold md:text-2xl">{getTitle()}</h1>
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
      <div className="relative">
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <CircleUser className="h-5 w-5" />
          <span className="sr-only">Toggle user menu</span>
        </Button>
        {isMenuOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="px-2 py-1.5 text-sm font-semibold">My Account</div>
            <div className="-mx-1 my-1 h-px bg-muted"></div>
            <Link href="/settings" className="block px-4 py-2 text-sm text-muted-foreground hover:bg-accent">Settings</Link>
            <div className="block px-4 py-2 text-sm text-muted-foreground hover:bg-accent">Support</div>
            <div className="-mx-1 my-1 h-px bg-muted"></div>
            <div className="block px-4 py-2 text-sm text-muted-foreground hover:bg-accent">Logout</div>
          </div>
        )}
      </div>
    </header>
  );
}
