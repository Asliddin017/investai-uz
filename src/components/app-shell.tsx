"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api, cn } from "@/lib/client";
import { useSession } from "./providers";
import { MSIcon } from "./ui";

type NavItem = { href: string; label: string; icon: string; perm: string | string[] };

const NAV: { section?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "space_dashboard", perm: "nav:dashboard" },
      { href: "/plans", label: "Rejalar", icon: "flight_takeoff", perm: "nav:plans" },
      { href: "/agreements", label: "Kelishuvlar", icon: "handshake", perm: "nav:agreements" },
    ],
  },
  {
    section: "Boshqaruv",
    items: [
      { href: "/admin/users", label: "Foydalanuvchilar", icon: "group", perm: "admin:users" },
      { href: "/admin/departments", label: "Tashkilotlar", icon: "apartment", perm: "admin:departments" },
      { href: "/admin/permissions", label: "Ruxsatlar", icon: "admin_panel_settings", perm: "admin:permissions" },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, can } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const allowed = (perm: NavItem["perm"]) => (Array.isArray(perm) ? perm.some(can) : can(perm));

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  const sidebar = (
    <nav aria-label="Yon menyu" className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-white">
          <MSIcon name="travel_explore" />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-white">
            Invest<span className="text-accent">AI</span>.uz
          </div>
          <div className="text-[11px] text-sidebar-foreground/70">Viloyat hokimligi</div>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {NAV.map((group, gi) => {
          const items = group.items.filter((i) => allowed(i.perm));
          if (items.length === 0) return null;
          return (
            <div key={gi}>
              {group.section && (
                <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-sidebar-foreground/50 uppercase">
                  {group.section}
                </div>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          active ? "bg-sidebar-active font-medium text-white" : "hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <MSIcon name={item.icon} className="text-[20px]" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="border-t border-white/10 px-4 py-4">
        <div className="text-sm font-medium text-white">{user.fullName}</div>
        <div className="text-xs text-sidebar-foreground/70">{user.roleLabel}</div>
        {user.departmentName && <div className="mt-0.5 text-xs text-sidebar-foreground/50">{user.departmentName}</div>}
        <button
          onClick={logout}
          className="mt-3 flex items-center gap-2 text-xs text-sidebar-foreground/80 hover:text-white"
        >
          <MSIcon name="logout" className="text-[18px]" />
          Chiqish
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Menyuni ochish">
          <MSIcon name="menu" />
        </button>
        <span className="font-semibold">
          Invest<span className="text-accent">AI</span>.uz
        </span>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
