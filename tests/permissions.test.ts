import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, LOCKED_SUPER_ADMIN_PERMISSIONS, PERMISSION_KEYS, resolvePermissions } from "@/lib/permissions";

describe("resolvePermissions", () => {
  it("starts from the role defaults", () => {
    expect(resolvePermissions(["a", "b"], [], [])).toEqual(new Set(["a", "b"]));
  });

  it("applies department overrides on top of the role", () => {
    const result = resolvePermissions(["a", "b"], [
      { permission: "b", state: "DENY" },
      { permission: "c", state: "GRANT" },
    ], []);
    expect(result).toEqual(new Set(["a", "c"]));
  });

  it("lets the user override win over the department", () => {
    const result = resolvePermissions(["a"], [{ permission: "b", state: "DENY" }], [
      { permission: "b", state: "GRANT" },
      { permission: "a", state: "DENY" },
    ]);
    expect(result).toEqual(new Set(["b"]));
  });
});

describe("default role matrix", () => {
  it("uses only catalog keys", () => {
    for (const perms of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      for (const p of perms) expect(PERMISSION_KEYS.has(p)).toBe(true);
    }
  });

  it("gives Super Admin the locked permissions", () => {
    for (const p of LOCKED_SUPER_ADMIN_PERMISSIONS) expect(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN).toContain(p);
  });

  it("lets only the approver role approve plans by default", () => {
    const approvers = Object.entries(DEFAULT_ROLE_PERMISSIONS)
      .filter(([, perms]) => perms.includes("plan:approve"))
      .map(([role]) => role);
    expect(approvers.sort()).toEqual(["SUPER_ADMIN", "TASDIQLOVCHI"]);
  });

  it("lets the three creator roles create plans", () => {
    for (const role of ["ORINBOSAR", "BOSHQARMA_BOSHLIGI", "TUMAN_HOKIMI"] as const) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain("plan:create");
    }
  });
});
