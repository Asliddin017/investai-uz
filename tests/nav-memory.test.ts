import { beforeEach, describe, expect, it } from "vitest";
import { clearNavMemory, recall, remember, sectionLink, sectionOf } from "@/lib/nav-memory";

const SECTIONS = ["/dashboard", "/plans", "/agreements", "/admin/users"];

beforeEach(clearNavMemory);

describe("sectionOf", () => {
  it("finds the section of a nested page", () => {
    expect(sectionOf("/plans/abc", SECTIONS)).toBe("/plans");
    expect(sectionOf("/plans", SECTIONS)).toBe("/plans");
  });

  it("does not confuse similar prefixes", () => {
    expect(sectionOf("/plansx", SECTIONS)).toBeUndefined();
  });

  it("is undefined outside the menu", () => {
    expect(sectionOf("/profile", SECTIONS)).toBeUndefined();
  });
});

describe("sectionLink", () => {
  it("opens the section's start when nothing is remembered", () => {
    expect(sectionLink("/plans", "/agreements")).toBe("/plans");
  });

  it("returns to where the user left the section", () => {
    remember("nav:/plans", "/plans/abc");
    expect(sectionLink("/plans", "/agreements/xyz")).toBe("/plans/abc");
  });

  it("goes back to the start when already inside the section", () => {
    remember("nav:/plans", "/plans/abc");
    expect(sectionLink("/plans", "/plans/abc")).toBe("/plans");
  });
});

describe("recall", () => {
  it("falls back until something is remembered", () => {
    expect(recall("tab", "roadmap")).toBe("roadmap");
    remember("tab", "absorption");
    expect(recall("tab", "roadmap")).toBe("absorption");
  });

  it("keeps falsy values", () => {
    remember("mine", false);
    expect(recall("mine", true)).toBe(false);
  });

  it("forgets everything on logout", () => {
    remember("tab", "absorption");
    clearNavMemory();
    expect(recall("tab", "roadmap")).toBe("roadmap");
  });
});
