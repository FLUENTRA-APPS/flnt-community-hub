import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MFA_WINDOW_HOURS = 12;

export type SessionState = {
  userId: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  mfaOk: boolean;
  isAdmin: boolean;
};

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(200),
});

export const signUp = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => credentials.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { createUser, issueSession } = await import("./auth-core.server");
    const user = await createUser({ email: data.email, password: data.password });
    await issueSession(user.id);
    return { ok: true };
  });

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => credentials.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { findUserByEmail, verifyPassword, issueSession, isAllowlistedAdmin, updateUser } =
      await import("./auth-core.server");
    const user = await findUserByEmail(data.email);
    if (!user || !(await verifyPassword(data.password, user))) {
      throw new Error("That email and password combination is not correct.");
    }
    // The allowlisted owner address is promoted to admin on sign-in.
    if (!user.roles.includes("admin") && (await isAllowlistedAdmin(user.email))) {
      await updateUser(user.id, { roles: [...user.roles, "admin"] });
    }
    await issueSession(user.id);
    return { ok: true };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { clearSessionCookie } = await import("./auth-core.server");
  clearSessionCookie();
  return { ok: true };
});

/** Returns the current account state, or null when signed out. */
export const getSessionState = createServerFn({ method: "POST" }).handler(
  async (): Promise<SessionState | null> => {
    const { currentUserId, findUserById, isAdmin, mfaFresh } = await import("./auth-core.server");
    const id = await currentUserId();
    if (!id) return null;
    const user = await findUserById(id);
    if (!user) return null;
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      mfaOk: mfaFresh(user),
      isAdmin: isAdmin(user),
    };
  },
);

export const updateDisplayName = createServerFn({ method: "POST" })
  .inputValidator((input: { displayName: string }) =>
    z.object({ displayName: z.string().trim().min(2).max(40) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireUser } = await import("./guards.server");
    const { updateUser } = await import("./auth-core.server");
    const user = await requireUser();
    await updateUser(user.id, { displayName: data.displayName });
    return { ok: true };
  });

/** Emails a fresh 6-digit code for signup verification or login confirmation. */
export const requestEmailCode = createServerFn({ method: "POST" })
  .inputValidator((input: { purpose: "signup" | "login" }) =>
    z.object({ purpose: z.enum(["signup", "login"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireUser } = await import("./guards.server");
    const { mutateDoc, newId } = await import("./store.server");
    const { sha256, randomCode } = await import("./server-shared.server");
    const { sendVerificationCode } = await import("./emails.server");
    const { type CodesDoc } = { type: null } as never;
    void CodesDoc;

    const user = await requireUser();
    const codeHash = await sha256("");
    void codeHash;

    const code = randomCode(6);
    const rateLimited = await mutateDoc<import("./data-types").CodesDoc, boolean>(
      "codes.json",
      async (doc) => {
        const since = Date.now() - 60 * 60 * 1000;
        const recent = doc.codes.filter(
          (c) => c.email === user.email && new Date(c.createdAt).getTime() > since,
        );
        // Abuse protection: max 5 codes per address per hour.
        if (recent.length >= 5) return true;
        doc.codes.push({
          id: newId(),
          userId: user.id,
          email: user.email,
          purpose: data.purpose,
          codeHash: await sha256(code),
          attempts: 0,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          consumedAt: null,
          createdAt: new Date().toISOString(),
        });
        doc.codes = doc.codes.slice(-500);
        return false;
      },
    );
    if (rateLimited) return { sent: false, reason: "rate_limited" as const };

    const sent = await sendVerificationCode(user.email, code, data.purpose);
    return { sent, reason: sent ? ("ok" as const) : ("smtp_unavailable" as const) };
  });

/** Checks a 6-digit code and unlocks the account / confirms the sign-in. */
export const verifyEmailCode = createServerFn({ method: "POST" })
  .inputValidator((input: { purpose: "signup" | "login"; code: string }) =>
    z
      .object({ purpose: z.enum(["signup", "login"]), code: z.string().trim().regex(/^\d{6}$/) })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const { requireUser } = await import("./guards.server");
    const { updateUser } = await import("./auth-core.server");
    const { mutateDoc } = await import("./store.server");
    const { sha256 } = await import("./server-shared.server");

    const user = await requireUser();
    const hash = await sha256(data.code);

    const result = await mutateDoc<import("./data-types").CodesDoc, { ok: boolean; error?: string }>(
      "codes.json",
      (doc) => {
        const row = [...doc.codes]
          .reverse()
          .find(
            (c) => c.email === user.email && c.purpose === data.purpose && c.consumedAt === null,
          );
        if (!row) return { ok: false, error: "No pending code. Request a new one." };
        if (new Date(row.expiresAt).getTime() < Date.now()) {
          return { ok: false, error: "That code expired. Request a new one." };
        }
        if (row.attempts >= 5) return { ok: false, error: "Too many attempts. Request a new code." };
        if (row.codeHash !== hash) {
          row.attempts += 1;
          return { ok: false, error: "That code is not correct." };
        }
        row.consumedAt = new Date().toISOString();
        return { ok: true };
      },
    );

    if (!result.ok) return result;

    await updateUser(user.id, {
      mfaOkUntil: new Date(Date.now() + MFA_WINDOW_HOURS * 60 * 60 * 1000).toISOString(),
      lastLoginAt: new Date().toISOString(),
      ...(data.purpose === "signup" ? { emailVerified: true } : {}),
    });
    return { ok: true };
  });
