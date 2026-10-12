"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/client";
import { MSIcon } from "./ui";

type Toast = { id: number; title: string; tone: "success" | "error" | "info" };

const ToastContext = createContext<(title: string, tone?: Toast["tone"]) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((title: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, title, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-md border bg-card px-4 py-3 text-sm shadow-lg",
              t.tone === "error" && "border-destructive/40",
            )}
          >
            <MSIcon
              name={t.tone === "error" ? "error" : t.tone === "info" ? "info" : "check_circle"}
              className={cn(
                "text-[18px]",
                t.tone === "error" ? "text-destructive" : t.tone === "info" ? "text-primary" : "text-emerald-600",
              )}
            />
            <span>{t.title}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

export type SessionUser = {
  id: string;
  fullName: string;
  username: string;
  role: string;
  roleLabel: string;
  position: string | null;
  departmentId: string | null;
  departmentName: string | null;
  permissions: string[];
};

const SessionContext = createContext<{ user: SessionUser; can: (perm: string) => boolean } | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  const can = useCallback((perm: string) => user.permissions.includes(perm), [user.permissions]);
  return <SessionContext.Provider value={{ user, can }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
