import { currentUserId, findUserById, isAdmin, mfaFresh } from "./auth-core.server";
import { mutateDoc, newId } from "./store.server";
import type { AuditDoc, UserRecord } from "./data-types";

export type AccountGate = {
  userId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  user: UserRecord;
};

export async function requireUser(): Promise<UserRecord> {
  const id = await currentUserId();
  if (!id) throw new Error("Please sign in to continue.");
  const user = await findUserById(id);
  if (!user) throw new Error("Please sign in to continue.");
  return user;
}

/** Requires a signed-in, email-verified account with a fresh login confirmation. */
export async function requireVerifiedAccount(): Promise<AccountGate> {
  const user = await requireUser();
  if (!user.emailVerified) throw new Error("Verify your email address to use this feature.");
  if (!mfaFresh(user)) throw new Error("Confirm this sign-in with the code we emailed you.");
  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    isAdmin: isAdmin(user),
    user,
  };
}

export async function requireAdmin(): Promise<AccountGate> {
  const account = await requireVerifiedAccount();
  if (!account.isAdmin) throw new Error("Forbidden");
  return account;
}

export async function writeAudit(entry: {
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  priorValue?: unknown;
  newValue?: unknown;
  reason: string;
}): Promise<void> {
  await mutateDoc<AuditDoc, void>("audit.json", (doc) => {
    doc.entries.unshift({
      id: newId(),
      actorId: entry.actorId,
      actorEmail: entry.actorEmail,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      priorValue: entry.priorValue ?? null,
      newValue: entry.newValue ?? null,
      reason: entry.reason,
      createdAt: new Date().toISOString(),
    });
    doc.entries = doc.entries.slice(0, 500);
  });
}
