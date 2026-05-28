"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { ThreadRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FileText, MessageSquare, BookOpen } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data } = useSWR<{ threads: ThreadRow[] }>(
    "/api/chat/threads",
    fetcher,
    { refreshInterval: 8000 },
  );
  const threads = data?.threads ?? [];

  const nav = [
    { href: "/sources", label: "Sources", icon: FileText },
    { href: "/new-chat", label: "New chat", icon: MessageSquare },
    { href: "/how-it-works", label: "How it works", icon: BookOpen },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-border bg-background flex flex-col">
        <div className="p-6 border-b border-border">
          <Link href="/sources" className="block">
            <div className="font-serif text-xl tracking-tight">
              42<span className="text-primary">nights</span>
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
              Data Room
            </div>
          </Link>
        </div>

        <nav className="p-3 flex flex-col gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {threads.length > 0 && (
          <div className="px-3 pb-3 flex-1 overflow-y-auto">
            <div className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Recent threads
            </div>
            <div className="flex flex-col gap-0.5">
              {threads.slice(0, 14).map((t) => {
                const active = pathname === `/chat/${t.id}`;
                return (
                  <Link
                    key={t.id}
                    href={`/chat/${t.id}`}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md truncate transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    )}
                  >
                    {t.title || "Untitled"}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-auto p-4 border-t border-border text-[11px] text-muted-foreground">
          Local-only · v0.2
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
