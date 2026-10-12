"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, cn } from "@/lib/client";
import { useSession, useToast } from "@/components/providers";
import { Button, EmptyState, ErrorBox, Input, MSIcon, PageHeader, Select, Spinner, Tabs, Textarea } from "@/components/ui";

type Perm = { key: string; label_uz: string; category: string };
type Catalog = {
  permissions: Perm[];
  categories: { key: string; label: string }[];
  roles: { value: string; label: string; short: string }[];
};
type OverrideState = "default" | "GRANT" | "DENY";
type OverrideRow = { state: OverrideState; reason: string; showReason: boolean };
type ServerOverride = { permission: string; state: "GRANT" | "DENY"; reason: string | null };

const LOCKED_SUPER_ADMIN = new Set(["admin:permissions", "admin:users"]);
const EMPTY_ROW: OverrideRow = { state: "default", reason: "", showReason: false };

/* ---------- shared pieces ---------- */

function usePermissionGroups(catalog: Catalog | undefined, query: string) {
  return useMemo(() => {
    if (!catalog) return { groups: [] as [string, Perm[]][], count: 0 };
    const q = query.trim().toLowerCase();
    const filtered = q
      ? catalog.permissions.filter((p) => p.label_uz.toLowerCase().includes(q) || p.key.toLowerCase().includes(q))
      : catalog.permissions;
    const groups = catalog.categories
      .map((c) => [c.key, filtered.filter((p) => p.category === c.key)] as [string, Perm[]])
      .filter(([, perms]) => perms.length > 0);
    return { groups, count: filtered.length };
  }, [catalog, query]);
}

function useCollapse(initial: string[] = ["nav"]) {
  const [open, setOpen] = useState(new Set(initial));
  return {
    open,
    toggle: (key: string) =>
      setOpen((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
    openAll: (keys: string[]) => setOpen(new Set(keys)),
    collapseAll: () => setOpen(new Set()),
  };
}

function Toolbar({
  query,
  onQuery,
  resultCount,
  onExpandAll,
  onCollapseAll,
  children,
}: {
  query: string;
  onQuery: (v: string) => void;
  resultCount: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 border-b bg-background py-2 lg:top-0">
      <div className="relative min-w-[200px] flex-1">
        <MSIcon
          name="search"
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[18px] text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Ruxsat nomi yoki kaliti bo'yicha qidirish..."
          className="pr-16 pl-9"
          aria-label="Ruxsatlarni qidirish"
        />
        {query && (
          <span className="absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">
            {resultCount}
          </span>
        )}
      </div>
      <Button variant="ghost" size="sm" icon="unfold_more" onClick={onExpandAll}>
        Hammasini ochish
      </Button>
      <Button variant="ghost" size="sm" icon="unfold_less" onClick={onCollapseAll}>
        Yopish
      </Button>
      <div className="ml-auto flex items-center gap-3">{children}</div>
    </div>
  );
}

function CategoryRow({
  label,
  count,
  isOpen,
  onToggle,
  columns,
  bulkCells,
}: {
  label: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  columns: number;
  bulkCells?: ReactNode[];
}) {
  const hasBulk = !!bulkCells?.length;
  return (
    <tr className="border-t bg-muted/50">
      <td colSpan={hasBulk ? 1 : columns} className="p-0">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted"
        >
          <MSIcon name={isOpen ? "expand_more" : "chevron_right"} className="text-[18px] text-muted-foreground" />
          <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>
          <span className="rounded-full bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
            {count}
          </span>
        </button>
      </td>
      {bulkCells}
    </tr>
  );
}

function PermCell({ perm }: { perm: Perm }) {
  return (
    <td className="px-3 py-2 align-top">
      <div className="leading-tight font-medium">{perm.label_uz}</div>
      <div className="mt-0.5 font-mono text-[11px] break-all text-muted-foreground">{perm.key}</div>
    </td>
  );
}

const STATE_STYLE: Record<OverrideState, string> = {
  default: "bg-primary text-primary-foreground",
  GRANT: "bg-emerald-600 text-white",
  DENY: "bg-destructive text-destructive-foreground",
};

function TriState({
  value,
  onChange,
  defaultLabel,
}: {
  value: OverrideState;
  onChange: (v: OverrideState) => void;
  defaultLabel: string;
}) {
  const options: [OverrideState, string][] = [
    ["default", defaultLabel],
    ["GRANT", "Ruxsat"],
    ["DENY", "Inkor"],
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-input">
      {options.map(([state, label], i) => (
        <button
          key={state}
          type="button"
          aria-pressed={value === state}
          onClick={() => onChange(state)}
          className={cn(
            "px-2.5 py-1 text-xs font-medium transition-colors",
            i > 0 && "border-l border-input",
            value === state ? STATE_STYLE[state] : "bg-card text-muted-foreground hover:bg-muted",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function OverrideEditor({
  row,
  onChange,
  defaultLabel,
}: {
  row: OverrideRow;
  onChange: (patch: Partial<OverrideRow>) => void;
  defaultLabel: string;
}) {
  return (
    <td className="px-3 py-2">
      <div className="flex items-center justify-center gap-1.5">
        <TriState value={row.state} onChange={(state) => onChange({ state })} defaultLabel={defaultLabel} />
        {row.state !== "default" && (
          <button
            type="button"
            onClick={() => onChange({ showReason: !row.showReason })}
            className="text-muted-foreground transition-colors hover:text-foreground"
            title="Sabab"
            aria-label="Sabab kiritish"
          >
            <MSIcon name={row.reason ? "comment" : "add_comment"} className="text-[16px]" />
          </button>
        )}
      </div>
      {row.showReason && row.state !== "default" && (
        <Textarea
          rows={2}
          placeholder="Sabab (ixtiyoriy)"
          value={row.reason}
          onChange={(e) => onChange({ reason: e.target.value })}
          className="mt-1.5 min-h-0 text-xs"
        />
      )}
    </td>
  );
}

function UnsavedBadge({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {text}
    </span>
  );
}

function rowsFromServer(overrides: ServerOverride[]) {
  return new Map(
    overrides.map((o) => [o.permission, { state: o.state, reason: o.reason ?? "", showReason: !!o.reason }]),
  );
}

function overridesPayload(rows: Map<string, OverrideRow>) {
  return [...rows.entries()]
    .filter(([, r]) => r.state !== "default")
    .map(([permission, r]) => ({ permission, state: r.state, reason: r.reason || null }));
}

function sameOverrides(a: Map<string, OverrideRow>, b: Map<string, OverrideRow>) {
  const norm = (m: Map<string, OverrideRow>) =>
    JSON.stringify(
      [...m.entries()]
        .filter(([, r]) => r.state !== "default")
        .map(([k, r]) => [k, r.state, r.reason])
        .sort(),
    );
  return norm(a) === norm(b);
}

/* ---------- Rollar ---------- */

function RolesTab({ catalog }: { catalog: Catalog }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "permissions", "roles"],
    queryFn: () => api<{ roles: Record<string, string[]> }>("/admin/permissions/roles"),
  });
  const [query, setQuery] = useState("");
  const { groups, count } = usePermissionGroups(catalog, query);
  const collapse = useCollapse();
  const [draft, setDraft] = useState<Map<string, Set<string>> | null>(null);

  const server = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of catalog.roles) m.set(r.value, new Set(data?.roles[r.value] ?? []));
    return m;
  }, [catalog.roles, data]);
  const matrix = draft ?? server;

  const changedRoles = catalog.roles.filter((r) => {
    const a = matrix.get(r.value)!;
    const b = server.get(r.value)!;
    return a.size !== b.size || [...a].some((p) => !b.has(p));
  });

  const save = useMutation({
    mutationFn: () =>
      api("/admin/permissions/roles", {
        method: "PUT",
        json: { roles: Object.fromEntries(changedRoles.map((r) => [r.value, [...matrix.get(r.value)!]])) },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "permissions"] });
      setDraft(null);
      toast("Rol ruxsatlari saqlandi.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  function setPerms(role: string, keys: string[], checked: boolean) {
    setDraft((prev) => {
      const next = new Map([...(prev ?? server)].map(([k, v]) => [k, new Set(v)]));
      const set = next.get(role)!;
      for (const key of keys) {
        if (role === "SUPER_ADMIN" && LOCKED_SUPER_ADMIN.has(key) && !checked) continue;
        if (checked) set.add(key);
        else set.delete(key);
      }
      return next;
    });
  }

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  return (
    <div className="space-y-3">
      <Toolbar
        query={query}
        onQuery={setQuery}
        resultCount={count}
        onExpandAll={() => collapse.openAll(groups.map(([k]) => k))}
        onCollapseAll={collapse.collapseAll}
      >
        {changedRoles.length > 0 && <UnsavedBadge text={`${changedRoles.length} rol o'zgardi`} />}
        {changedRoles.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
            Bekor qilish
          </Button>
        )}
        <Button size="sm" icon="save" loading={save.isPending} disabled={changedRoles.length === 0} onClick={() => save.mutate()}>
          {save.isPending ? "Saqlanmoqda..." : "Saqlash"}
        </Button>
      </Toolbar>

      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[760px] table-fixed text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="w-[34%] px-3 py-2.5 text-left font-medium">Ruxsat</th>
              {catalog.roles.map((r) => (
                <th key={r.value} className="px-2 py-2.5 text-center font-medium" title={r.label}>
                  {r.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([category, perms]) => {
              const isOpen = !!query || collapse.open.has(category);
              const keys = perms.map((p) => p.key);
              const label = catalog.categories.find((c) => c.key === category)?.label ?? category;
              return (
                <GroupRows key={category}>
                  <CategoryRow
                    label={label}
                    count={perms.length}
                    isOpen={isOpen}
                    onToggle={() => collapse.toggle(category)}
                    columns={catalog.roles.length + 1}
                    bulkCells={catalog.roles.map((r) => {
                      const all = keys.every((k) => matrix.get(r.value)?.has(k));
                      return (
                        <td key={r.value} className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setPerms(r.value, keys, !all)}
                            className="text-muted-foreground/70 transition-colors hover:text-foreground"
                            title={`${label} — ${all ? "hammasini olib tashlash" : "hammasini belgilash"} (${r.label})`}
                            aria-label={`${label} — ${r.label}`}
                          >
                            <MSIcon name={all ? "remove_done" : "done_all"} className="text-[16px]" />
                          </button>
                        </td>
                      );
                    })}
                  />
                  {isOpen &&
                    perms.map((perm) => (
                      <tr key={perm.key} className="border-t border-border/40 transition-colors hover:bg-muted/20">
                        <PermCell perm={perm} />
                        {catalog.roles.map((r) => {
                          const locked = r.value === "SUPER_ADMIN" && LOCKED_SUPER_ADMIN.has(perm.key);
                          const checked = matrix.get(r.value)?.has(perm.key) ?? false;
                          const changed = checked !== (server.get(r.value)?.has(perm.key) ?? false);
                          return (
                            <td key={r.value} className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={locked}
                                onChange={(e) => setPerms(r.value, [perm.key], e.target.checked)}
                                className={cn(
                                  "h-4 w-4 cursor-pointer rounded accent-[var(--primary)]",
                                  locked && "cursor-not-allowed opacity-50",
                                  changed && "ring-2 ring-amber-400 ring-offset-1",
                                )}
                                title={locked ? "Bu ruxsatni o'chirib bo'lmaydi" : `${perm.label_uz} — ${r.label}`}
                                aria-label={`${perm.label_uz} — ${r.label}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </GroupRows>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Rol ruxsatlari — boshlang&apos;ich daraja. Tashkilot va foydalanuvchi darajasidagi sozlamalar ulardan ustun
        turadi: avval rol, keyin tashkilot, oxirida foydalanuvchi sozlamasi qo&apos;llanadi.
      </p>
    </div>
  );
}

function GroupRows({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* ---------- Tashkilotlar ---------- */

function DepartmentsTab({ catalog }: { catalog: Catalog }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [deptId, setDeptId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { groups, count } = usePermissionGroups(catalog, query);
  const collapse = useCollapse();
  const [rows, setRows] = useState<Map<string, OverrideRow>>(new Map());

  const departments = useQuery({
    queryKey: ["admin", "departments"],
    queryFn: () => api<{ id: string; name: string }[]>("/admin/departments"),
  });
  const overrides = useQuery({
    queryKey: ["admin", "permissions", "department", deptId],
    queryFn: () => api<{ overrides: ServerOverride[] }>(`/admin/permissions/departments/${deptId}`),
    enabled: !!deptId,
  });
  const server = useMemo(() => rowsFromServer(overrides.data?.overrides ?? []), [overrides.data]);
  useEffect(() => setRows(new Map(server)), [server]);
  const dirty = !sameOverrides(rows, server);

  const save = useMutation({
    mutationFn: () =>
      api(`/admin/permissions/departments/${deptId}`, { method: "PUT", json: { overrides: overridesPayload(rows) } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "permissions"] });
      toast("Tashkilot ruxsatlari yangilandi.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const update = (key: string, patch: Partial<OverrideRow>) =>
    setRows((prev) => new Map(prev).set(key, { ...(prev.get(key) ?? EMPTY_ROW), ...patch }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="shrink-0 text-sm font-medium text-muted-foreground">Tashkilot</span>
        <Select
          className="max-w-md"
          value={deptId ?? ""}
          onChange={(e) => setDeptId(e.target.value || null)}
          disabled={dirty && save.isPending}
        >
          <option value="">— Tashkilotni tanlang —</option>
          {departments.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
      {!deptId ? (
        <EmptyState icon="apartment" title="Tashkilotni tanlang">
          Tanlangan tashkilotning barcha xodimlari uchun ruxsatni qo&apos;shish yoki taqiqlash mumkin.
        </EmptyState>
      ) : overrides.isLoading ? (
        <Spinner />
      ) : (
        <>
          <Toolbar
            query={query}
            onQuery={setQuery}
            resultCount={count}
            onExpandAll={() => collapse.openAll(groups.map(([k]) => k))}
            onCollapseAll={collapse.collapseAll}
          >
            {dirty && <UnsavedBadge text="Saqlanmagan o'zgarishlar" />}
            <Button size="sm" icon="save" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
              {save.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </Toolbar>
          <div className="overflow-x-auto rounded-md border bg-card">
            <table className="w-full min-w-[640px] table-fixed text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="w-[45%] px-3 py-2.5 text-left font-medium">Ruxsat</th>
                  <th className="w-[55%] px-3 py-2.5 text-center font-medium">Tashkilot sozlamasi</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([category, perms]) => {
                  const isOpen = !!query || collapse.open.has(category);
                  return (
                    <GroupRows key={category}>
                      <CategoryRow
                        label={catalog.categories.find((c) => c.key === category)?.label ?? category}
                        count={perms.length}
                        isOpen={isOpen}
                        onToggle={() => collapse.toggle(category)}
                        columns={2}
                      />
                      {isOpen &&
                        perms.map((perm) => (
                          <tr key={perm.key} className="border-t border-border/40 hover:bg-muted/20">
                            <PermCell perm={perm} />
                            <OverrideEditor
                              row={rows.get(perm.key) ?? EMPTY_ROW}
                              onChange={(patch) => update(perm.key, patch)}
                              defaultLabel="Rolga ko'ra"
                            />
                          </tr>
                        ))}
                    </GroupRows>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Foydalanuvchilar ---------- */

type UserPerms = {
  role: string;
  departmentName: string | null;
  role_defaults: string[];
  department_overrides: { permission: string; state: "GRANT" | "DENY" }[];
  overrides: ServerOverride[];
};

function UsersTab({ catalog }: { catalog: Catalog }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { user: me } = useSession();
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const { groups, count } = usePermissionGroups(catalog, query);
  const collapse = useCollapse();
  const [rows, setRows] = useState<Map<string, OverrideRow>>(new Map());

  const users = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () =>
      api<{ id: string; fullName: string; username: string; role: string; department: { name: string } | null }[]>(
        "/admin/users",
      ),
  });
  const detail = useQuery({
    queryKey: ["admin", "permissions", "user", userId],
    queryFn: () => api<UserPerms>(`/admin/permissions/users/${userId}`),
    enabled: !!userId,
  });
  const server = useMemo(() => rowsFromServer(detail.data?.overrides ?? []), [detail.data]);
  useEffect(() => setRows(new Map(server)), [server]);
  const dirty = !sameOverrides(rows, server);

  const effective = useMemo(() => {
    const d = detail.data;
    if (!d) return new Set<string>();
    const set = new Set(d.role_defaults);
    for (const o of d.department_overrides) {
      if (o.state === "GRANT") set.add(o.permission);
      else set.delete(o.permission);
    }
    for (const [perm, r] of rows) {
      if (r.state === "GRANT") set.add(perm);
      else if (r.state === "DENY") set.delete(perm);
    }
    return set;
  }, [detail.data, rows]);

  const save = useMutation({
    mutationFn: () =>
      api(`/admin/permissions/users/${userId}`, { method: "PUT", json: { overrides: overridesPayload(rows) } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "permissions"] });
      toast("Foydalanuvchi ruxsatlari yangilandi.");
      if (userId === me.id) window.location.reload();
    },
    onError: (e) => toast(e.message, "error"),
  });

  const roleLabel = (role: string) => catalog.roles.find((r) => r.value === role)?.label ?? role;
  const filteredUsers = (users.data ?? []).filter((u) =>
    `${u.fullName} ${u.username}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const update = (key: string, patch: Partial<OverrideRow>) =>
    setRows((prev) => new Map(prev).set(key, { ...(prev.get(key) ?? EMPTY_ROW), ...patch }));
  const deptState = (perm: string) => detail.data?.department_overrides.find((o) => o.permission === perm)?.state;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="shrink-0 text-sm font-medium text-muted-foreground">Foydalanuvchi</span>
        <Input
          className="max-w-[200px]"
          placeholder="Ism bo'yicha filtr"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Select className="max-w-md" value={userId ?? ""} onChange={(e) => setUserId(e.target.value || null)}>
          <option value="">— Foydalanuvchini tanlang —</option>
          {filteredUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName} ({u.username}) — {roleLabel(u.role)}
            </option>
          ))}
        </Select>
      </div>

      {!userId ? (
        <EmptyState icon="person" title="Foydalanuvchini tanlang">
          Shaxsiy sozlama eng ustun daraja: rol va tashkilot sozlamasidan keyin qo&apos;llanadi.
        </EmptyState>
      ) : detail.isLoading || !detail.data ? (
        <Spinner />
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-md border bg-card px-4 py-3 text-sm">
            <span>
              <span className="text-muted-foreground">Rol:</span> <b>{roleLabel(detail.data.role)}</b>
            </span>
            <span>
              <span className="text-muted-foreground">Tashkilot:</span> <b>{detail.data.departmentName ?? "—"}</b>
            </span>
            <span>
              <span className="text-muted-foreground">Amaldagi ruxsatlar:</span>{" "}
              <b className="tabular-nums">{effective.size}</b>
            </span>
          </div>
          <Toolbar
            query={query}
            onQuery={setQuery}
            resultCount={count}
            onExpandAll={() => collapse.openAll(groups.map(([k]) => k))}
            onCollapseAll={collapse.collapseAll}
          >
            {dirty && <UnsavedBadge text="Saqlanmagan o'zgarishlar" />}
            <Button size="sm" icon="save" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
              {save.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </Toolbar>
          <div className="overflow-x-auto rounded-md border bg-card">
            <table className="w-full min-w-[760px] table-fixed text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="w-[36%] px-3 py-2.5 text-left font-medium">Ruxsat</th>
                  <th className="w-[12%] px-3 py-2.5 text-center font-medium">Rol</th>
                  <th className="w-[12%] px-3 py-2.5 text-center font-medium">Tashkilot</th>
                  <th className="w-[30%] px-3 py-2.5 text-center font-medium">Shaxsiy sozlama</th>
                  <th className="w-[10%] px-3 py-2.5 text-center font-medium">Natija</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([category, perms]) => {
                  const isOpen = !!query || collapse.open.has(category);
                  return (
                    <GroupRows key={category}>
                      <CategoryRow
                        label={catalog.categories.find((c) => c.key === category)?.label ?? category}
                        count={perms.length}
                        isOpen={isOpen}
                        onToggle={() => collapse.toggle(category)}
                        columns={5}
                      />
                      {isOpen &&
                        perms.map((perm) => {
                          const inRole = detail.data!.role_defaults.includes(perm.key);
                          const dept = deptState(perm.key);
                          const has = effective.has(perm.key);
                          return (
                            <tr key={perm.key} className="border-t border-border/40 hover:bg-muted/20">
                              <PermCell perm={perm} />
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex" title={inRole ? "Rolda bor" : "Rolda yo'q"}>
                                  <MSIcon
                                    name={inRole ? "check_circle" : "remove"}
                                    className={cn("text-[16px]", inRole ? "text-emerald-600" : "text-muted-foreground/40")}
                                  />
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center text-xs">
                                {dept === "GRANT" ? (
                                  <span className="font-medium text-emerald-700">Ruxsat</span>
                                ) : dept === "DENY" ? (
                                  <span className="font-medium text-destructive">Inkor</span>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </td>
                              <OverrideEditor
                                row={rows.get(perm.key) ?? EMPTY_ROW}
                                onChange={(patch) => update(perm.key, patch)}
                                defaultLabel="Standart"
                              />
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={cn(
                                    "inline-block h-2.5 w-2.5 rounded-full",
                                    has ? "bg-emerald-500" : "bg-muted-foreground/30",
                                  )}
                                  title={has ? "Ruxsat bor" : "Ruxsat yo'q"}
                                />
                              </td>
                            </tr>
                          );
                        })}
                    </GroupRows>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- page ---------- */

export default function PermissionsPage() {
  const { can } = useSession();
  const [tab, setTab] = useState<"roles" | "departments" | "users">("roles");
  const catalog = useQuery({
    queryKey: ["admin", "permissions", "catalog"],
    queryFn: () => api<Catalog>("/admin/permissions/catalog"),
    staleTime: 60_000,
    enabled: can("admin:permissions"),
  });

  if (!can("admin:permissions")) return <ErrorBox error={new Error("Bu sahifa uchun ruxsat yo'q")} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ruxsatlar"
        description="Rollar, tashkilotlar va alohida foydalanuvchilar uchun kirish huquqlarini boshqarish"
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "roles", label: "Rollar", icon: "badge" },
          { value: "departments", label: "Tashkilotlar", icon: "apartment" },
          { value: "users", label: "Foydalanuvchilar", icon: "person" },
        ]}
      />
      {catalog.isLoading || !catalog.data ? (
        catalog.error ? <ErrorBox error={catalog.error} /> : <Spinner />
      ) : tab === "roles" ? (
        <RolesTab catalog={catalog.data} />
      ) : tab === "departments" ? (
        <DepartmentsTab catalog={catalog.data} />
      ) : (
        <UsersTab catalog={catalog.data} />
      )}
    </div>
  );
}
