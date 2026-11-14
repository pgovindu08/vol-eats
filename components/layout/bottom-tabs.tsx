"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, NotebookPen, Store, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Budget moved into Profile (/profile), so it no longer has a tab.
const TABS: { href: string; label: string; icon: LucideIcon; also?: string[] }[] = [
  { href: "/today", label: "Today", icon: House },
  { href: "/food", label: "Food", icon: Store, also: ["/plates"] },
  { href: "/log", label: "Log", icon: NotebookPen },
  { href: "/menus", label: "Menus", icon: UtensilsCrossed },
  { href: "/events", label: "Events", icon: CalendarDays },
];

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex h-(--tab-bar-height) max-w-(--content-max)">
        {TABS.map(({ href, label, icon: Icon, also = [] }) => {
          const active = [href, ...also].some((h) => pathname === h || pathname.startsWith(`${h}/`));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-11 flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-200",
                  active ? "font-semibold text-text" : "text-muted hover:text-text",
                )}
              >
                {/* Orange text fails contrast on white, so only the icon is orange when active. */}
                <Icon aria-hidden className={cn("size-5", active && "text-primary")} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
