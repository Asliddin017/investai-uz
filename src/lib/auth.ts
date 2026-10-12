import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { Role, Theme } from "@prisma/client";
import { db } from "./db";
import { resolvePermissions } from "./permissions";

export const SESSION_COOKIE = "investai_session";
/** Readable by the root layout so the page renders in the right theme without a flash. */
export const THEME_COOKIE = "investai_theme";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const token = await createSessionToken(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function setThemeCookie(theme: Theme) {
  (await cookies()).set(THEME_COOKIE, theme.toLowerCase(), {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export type CurrentUser = {
  id: string;
  fullName: string;
  username: string;
  role: Role;
  position: string | null;
  departmentId: string | null;
  departmentName: string | null;
  theme: Theme;
  permissions: Set<string>;
};

export async function loadUserWithPermissions(userId: string): Promise<CurrentUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { department: { include: { permissions: true } }, permissions: true },
  });
  if (!user || !user.isActive) return null;
  const roleDefaults = await db.rolePermission.findMany({ where: { role: user.role } });
  const permissions = resolvePermissions(
    roleDefaults.map((r) => r.permission),
    user.department?.permissions ?? [],
    user.permissions,
  );
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    position: user.position,
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
    theme: user.theme,
    permissions,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = await readSessionToken(token);
  if (!userId) return null;
  return loadUserWithPermissions(userId);
}
