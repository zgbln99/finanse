"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  MessageSquare,
  CalendarCheck,
  Boxes,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Rechnungen", icon: FileText },
  { href: "/kw", label: "KW-Kontrolle", icon: CalendarCheck },
  { href: "/review", label: "Prüfung", icon: ShieldCheck },
  { href: "/chat", label: "AI-Analyse", icon: MessageSquare },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sticky left sidebar — cream, flat, rounded outline icons (DESIGN.md doc-sidebar). */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-hairline bg-canvas px-3 py-5 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-fg">
            <Boxes className="size-5" />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-ink">Rechnungs-Cockpit</div>
            <div className="text-[12px] text-mute">LTS Logistik GmbH</div>
          </div>
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors",
                  active ? "bg-surface-card text-ink" : "text-body hover:bg-surface-soft",
                )}
              >
                <Icon className="size-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-2">
          <Link
            href="/invoices?import=1"
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-primary-fg transition-colors hover:bg-primary-pressed"
          >
            <Upload className="size-4" />
            Dokumente importieren
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top nav strip */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-hairline bg-canvas/90 px-6 backdrop-blur">
          <MobileTitle pathname={pathname} />
          <div className="flex items-center gap-3 text-[13px] text-mute">
            <span className="hidden sm:inline">gpt-4.1-mini</span>
            <span className="size-2 rounded-full bg-accent-green" title="Worker aktiv" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-content flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

function MobileTitle({ pathname }: { pathname: string }) {
  const current = NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));
  return <div className="text-[16px] font-semibold text-ink">{current?.label ?? "Cockpit"}</div>;
}
