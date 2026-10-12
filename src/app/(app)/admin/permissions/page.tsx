"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, cn } from "@/lib/client";
import { useSession, useToast } from "@/components/providers";
import { Button, Card, ErrorBox, PageHeader, Spinner } from "@/components/ui";

type Perm = { key: string; label_uz: string; category: string };
type Catalog = {
  permissions: Perm[];
  categories: { key: string; label: string }[];
  roles: { value: string; label: string; short: string }[];
};

/** Super Admin always keeps these, otherwise nobody could manage access anymore. */
const LOCKED_SUPER_ADMIN = new Set(["admin:permissions", "admin:users"]);

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

function RolePermissions({ catalog }: { catalog: Catalog }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "permissions", "roles"],
    queryFn: () => api<{ roles: Record<string, string[]> }>("/admin/permissions/roles"),
  });
  const [role, setRole] = useState(catalog.roles[0]?.value ?? "");
  // Unsaved edits per role; a role missing here shows what the server has.
  const [drafts, setDrafts] = useState<Record<string, Set<string>>>({});

  const server = useMemo(
    () => Object.fromEntries(catalog.roles.map((r) => [r.value, new Set(data?.roles[r.value] ?? [])])),
    [catalog.roles, data],
  );
  const current = (r: string) => drafts[r] ?? server[r] ?? new Set<string>();
  const changed = catalog.roles.filter((r) => drafts[r.value] && !sameSet(drafts[r.value], server[r.value]));

  const save = useMutation({
    mutationFn: () =>
      api("/admin/permissions/roles", {
        method: "PUT",
        json: { roles: Object.fromEntries(changed.map((r) => [r.value, [...drafts[r.value]]])) },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "permissions"] });
      setDrafts({});
      toast("Ruxsatlar saqlandi.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  function toggle(keys: string[], on: boolean) {
    const next = new Set(current(role));
    for (const key of keys) {
      if (role === "SUPER_ADMIN" && LOCKED_SUPER_ADMIN.has(key)) continue;
      if (on) next.add(key);
      else next.delete(key);
    }
    setDrafts((prev) => ({ ...prev, [role]: next }));
  }

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  const selected = current(role);
  const roleLabel = catalog.roles.find((r) => r.value === role)?.label ?? role;
  const groups = catalog.categories
    .map((c) => ({ ...c, perms: catalog.permissions.filter((p) => p.category === c.key) }))
    .filter((g) => g.perms.length > 0);

  return (
    <div className="space-y-4 pb-20">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit p-2">
          <div className="px-3 pt-2 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Rollar</div>
          <ul className="space-y-0.5">
            {catalog.roles.map((r) => {
              const active = r.value === role;
              const dirty = changed.some((c) => c.value === r.value);
              return (
                <li key={r.value}>
                  <button
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                      active ? "bg-primary text-white" : "hover:bg-muted",
                    )}
                  >
                    <span className="flex-1">
                      <span className="block font-medium">{r.label}</span>
                      <span className={cn("block text-xs", active ? "text-white/80" : "text-muted-foreground")}>
                        {current(r.value).size} ta ruxsat
                      </span>
                    </span>
                    {dirty && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" title="Saqlanmagan o'zgarish" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <b className="text-foreground">{roleLabel}</b> roli berilgan har bir foydalanuvchi quyidagi belgilangan
            ishlarni bajara oladi.
          </p>
          {groups.map((g) => {
            const keys = g.perms.map((p) => p.key);
            const all = keys.every((k) => selected.has(k));
            return (
              <Card key={g.key}>
                <div className="flex items-center justify-between border-b px-5 py-3">
                  <h2 className="font-semibold">{g.label}</h2>
                  <button
                    type="button"
                    onClick={() => toggle(keys, !all)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {all ? "Hammasini olib tashlash" : "Hammasini belgilash"}
                  </button>
                </div>
                <ul className="divide-y">
                  {g.perms.map((p) => {
                    const locked = role === "SUPER_ADMIN" && LOCKED_SUPER_ADMIN.has(p.key);
                    return (
                      <li key={p.key}>
                        <label
                          className={cn(
                            "flex items-center gap-3 px-5 py-3 text-sm",
                            locked ? "cursor-not-allowed" : "cursor-pointer hover:bg-muted/40",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(p.key)}
                            disabled={locked}
                            onChange={(e) => toggle([p.key], e.target.checked)}
                            className="h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--primary)] disabled:cursor-not-allowed"
                          />
                          <span className="flex-1">{p.label_uz}</span>
                          {locked && <span className="text-xs text-muted-foreground">Doim yoqilgan</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>

      {changed.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 py-3 shadow-lg backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-3">
            <span className="mr-auto text-sm text-muted-foreground">
              Saqlanmagan o&apos;zgarishlar: {changed.map((r) => r.label).join(", ")}
            </span>
            <Button variant="ghost" onClick={() => setDrafts({})} disabled={save.isPending}>
              Bekor qilish
            </Button>
            <Button icon="save" loading={save.isPending} onClick={() => save.mutate()}>
              Saqlash
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PermissionsPage() {
  const { can } = useSession();
  const catalog = useQuery({
    queryKey: ["admin", "permissions", "catalog"],
    queryFn: () => api<Catalog>("/admin/permissions/catalog"),
    staleTime: 60_000,
    enabled: can("admin:permissions"),
  });

  if (!can("admin:permissions")) return <ErrorBox error={new Error("Bu sahifa uchun ruxsat yo'q")} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Ruxsatlar" description="Rolni tanlang va shu rol egalari nima qila olishini belgilang" />
      {catalog.error ? <ErrorBox error={catalog.error} /> : catalog.data ? <RolePermissions catalog={catalog.data} /> : <Spinner />}
    </div>
  );
}
