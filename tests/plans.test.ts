import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/lib/auth";
import { canApprovePlan, canEditPlan, canReportPlan, canViewPlan, planVisibilityWhere } from "@/lib/plans";

function user(perms: string[], over: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "u1",
    fullName: "Test",
    username: "test",
    role: "BOSHQARMA_BOSHLIGI",
    position: null,
    departmentId: "d1",
    departmentName: "Boshqarma",
    theme: "LIGHT",
    permissions: new Set(perms),
    ...over,
  };
}

const plan = (over: Partial<{ creatorId: string; departmentId: string | null; status: string }> = {}) =>
  ({ creatorId: "u1", departmentId: "d1", status: "DRAFT", ...over }) as Parameters<typeof canViewPlan>[1];

describe("plan editing", () => {
  const author = user(["plan:create"]);
  it("allows the author to edit a draft and a rejected plan", () => {
    expect(canEditPlan(author, plan())).toBe(true);
    expect(canEditPlan(author, plan({ status: "REJECTED" }))).toBe(true);
  });
  it("freezes pending, approved and later plans", () => {
    for (const status of ["PENDING", "APPROVED", "REPORTED", "COMPLETED"]) {
      expect(canEditPlan(author, plan({ status }))).toBe(false);
    }
  });
  it("does not let a colleague edit someone else's plan", () => {
    expect(canEditPlan(user(["plan:create"], { id: "u2" }), plan())).toBe(false);
  });
});

describe("approval", () => {
  it("needs plan:approve, a pending plan and a different author", () => {
    const approver = user(["plan:approve"], { id: "a1" });
    expect(canApprovePlan(approver, plan({ status: "PENDING" }))).toBe(true);
    expect(canApprovePlan(approver, plan({ status: "DRAFT" }))).toBe(false);
    expect(canApprovePlan(user(["plan:approve"]), plan({ status: "PENDING" }))).toBe(false);
  });
});

describe("visibility", () => {
  it("hides other organizations' plans from department-level users", () => {
    const u = user(["plan:view_own", "plan:view_department"], { id: "u9" });
    expect(canViewPlan(u, plan({ creatorId: "x", departmentId: "d1" }))).toBe(true);
    expect(canViewPlan(u, plan({ creatorId: "x", departmentId: "d2" }))).toBe(false);
  });
  it("shows the approver everything except drafts", () => {
    const u = user(["plan:approve"], { id: "a1", departmentId: "d9" });
    expect(canViewPlan(u, plan({ status: "PENDING", departmentId: "d2" }))).toBe(true);
    expect(canViewPlan(u, plan({ status: "DRAFT", departmentId: "d2" }))).toBe(false);
  });
  it("matches nothing without any view permission", () => {
    expect(planVisibilityWhere(user([]))).toEqual({ id: "__none__" });
  });
});

describe("reporting", () => {
  it("is open to the author's organization only while approved", () => {
    const colleague = user(["plan:report"], { id: "u2" });
    expect(canReportPlan(colleague, plan({ status: "APPROVED" }))).toBe(true);
    expect(canReportPlan(colleague, plan({ status: "REPORTED" }))).toBe(false);
    expect(canReportPlan(user(["plan:report"], { id: "u3", departmentId: "d5" }), plan({ status: "APPROVED" }))).toBe(false);
  });
});
