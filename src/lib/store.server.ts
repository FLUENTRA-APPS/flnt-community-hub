/**
 * JSON document storage for flnt.
 *
 * Every collection lives in a named JSON document (users.json, trust.json, ...).
 * Documents are persisted in a Redis-compatible REST key-value store
 * (Upstash / Vercel KV) so writes survive on serverless hosts like Vercel.
 * Without credentials the store falls back to an in-memory copy seeded from the
 * bundled defaults, which is fine for local development but resets on deploy.
 */

import usersSeed from "@/data/users.json";
import adminSeed from "@/data/admin.json";
import pollsSeed from "@/data/polls.json";
import trustSeed from "@/data/trust.json";
import supportSeed from "@/data/support.json";
import auditSeed from "@/data/audit.json";
import codesSeed from "@/data/codes.json";

const PREFIX = "flnt:";

const seeds: Record<string, unknown> = {
  "users.json": usersSeed,
  "admin.json": adminSeed,
  "polls.json": pollsSeed,
  "trust.json": trustSeed,
  "support.json": supportSeed,
  "audit.json": auditSeed,
  "codes.json": codesSeed,
};

const memory = new Map<string, string>();

function kv(): { url: string; token: string } | null {
  const url = process.env["KV_REST_API_URL"] ?? process.env["UPSTASH_REDIS_REST_URL"];
  const token = process.env["KV_REST_API_TOKEN"] ?? process.env["UPSTASH_REDIS_REST_TOKEN"];
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

/** True when writes are durable (a KV store is configured). */
export function storageIsDurable(): boolean {
  return kv() !== null;
}

async function command(args: (string | number)[]): Promise<unknown> {
  const config = kv();
  if (!config) return null;
  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Storage error (${res.status}). Check your KV credentials.`);
  const body = (await res.json()) as { result?: unknown; error?: string };
  if (body.error) throw new Error(`Storage error: ${body.error}`);
  return body.result ?? null;
}

async function rawGet(name: string): Promise<string | null> {
  if (!kv()) return memory.get(name) ?? null;
  const result = await command(["GET", PREFIX + name]);
  return typeof result === "string" ? result : null;
}

async function rawSet(name: string, value: string): Promise<void> {
  if (!kv()) {
    memory.set(name, value);
    return;
  }
  await command(["SET", PREFIX + name, value]);
}

function seedOf<T>(name: string): T {
  return structuredClone(seeds[name] as T);
}

export async function readDoc<T>(name: string): Promise<T> {
  const raw = await rawGet(name);
  if (!raw) return seedOf<T>(name);
  try {
    return { ...seedOf<Record<string, unknown>>(name), ...JSON.parse(raw) } as T;
  } catch {
    return seedOf<T>(name);
  }
}

export async function writeDoc<T>(name: string, value: T): Promise<void> {
  await rawSet(name, JSON.stringify(value));
}

// Serialises read-modify-write cycles inside one runtime instance.
let chain: Promise<unknown> = Promise.resolve();

export async function mutateDoc<T, R>(name: string, fn: (doc: T) => R | Promise<R>): Promise<R> {
  const run = chain.then(async () => {
    const doc = await readDoc<T>(name);
    const result = await fn(doc);
    await writeDoc(name, doc);
    return result;
  });
  chain = run.catch(() => undefined);
  return run as Promise<R>;
}

export function newId(): string {
  return crypto.randomUUID();
}
