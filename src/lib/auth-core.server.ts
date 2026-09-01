import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { mutateDoc, newId, readDoc } from "./store.server";
import type { AdminDoc, UserRecord, UsersDoc } from "./data-types";

const COOKIE = "flnt_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

function secret(): string {
  return process.env["SESSION_SECRET"] ?? "flnt-development-session-secret-change-me";
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToHex(new Uint8Array(sig));
}

export async function hashPassword(password: string, salt?: string) {
  const passwordSalt = salt ?? bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(passwordSalt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return { passwordSalt, passwordHash: bytesToHex(new Uint8Array(bits)) };
}

export async function verifyPassword(password: string, user: UserRecord): Promise<boolean> {
  const { passwordHash } = await hashPassword(password, user.passwordSalt);
  return passwordHash === user.passwordHash;
}

export async function issueSession(userId: string): Promise<void> {
  const payload = base64url(
    JSON.stringify({ sub: userId, exp: Date.now() + SESSION_DAYS * 86_400_000 }),
  );
  const token = `${payload}.${await hmac(payload)}`;
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env["NODE_ENV"] === "production",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export function clearSessionCookie(): void {
  deleteCookie(COOKIE, { path: "/" });
}

export async function currentUserId(): Promise<string | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if ((await hmac(payload)) !== signature) return null;
  try {
    const data = JSON.parse(fromBase64url(payload)) as { sub?: string; exp?: number };
    if (!data.sub || !data.exp || data.exp < Date.now()) return null;
    return data.sub;
  } catch {
    return null;
  }
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const doc = await readDoc<UsersDoc>("users.json");
  return doc.users.find((u) => u.id === id) ?? null;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const doc = await readDoc<UsersDoc>("users.json");
  const needle = email.trim().toLowerCase();
  return doc.users.find((u) => u.email === needle) ?? null;
}

export async function updateUser(
  id: string,
  patch: Partial<UserRecord>,
): Promise<UserRecord | null> {
  return mutateDoc<UsersDoc, UserRecord | null>("users.json", (doc) => {
    const user = doc.users.find((u) => u.id === id);
    if (!user) return null;
    Object.assign(user, patch);
    return user;
  });
}

export async function isAllowlistedAdmin(email: string): Promise<boolean> {
  const doc = await readDoc<AdminDoc>("admin.json");
  return doc.allowlist.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

export async function createUser(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<UserRecord> {
  const email = input.email.trim().toLowerCase();
  const { passwordHash, passwordSalt } = await hashPassword(input.password);
  const allowlisted = await isAllowlistedAdmin(email);

  return mutateDoc<UsersDoc, UserRecord>("users.json", (doc) => {
    if (doc.users.some((u) => u.email === email)) {
      throw new Error("An account with that email already exists. Sign in instead.");
    }
    const user: UserRecord = {
      id: newId(),
      email,
      displayName: input.displayName?.trim() || (email.split("@")[0] ?? "member"),
      passwordHash,
      passwordSalt,
      emailVerified: false,
      mfaOkUntil: null,
      roles: allowlisted ? ["user", "admin"] : ["user"],
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };
    doc.users.push(user);
    return user;
  });
}

export function mfaFresh(user: UserRecord): boolean {
  return user.mfaOkUntil ? new Date(user.mfaOkUntil).getTime() > Date.now() : false;
}

export function isAdmin(user: UserRecord): boolean {
  return user.roles.includes("admin");
}
