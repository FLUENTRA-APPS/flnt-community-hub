/** Shapes of the JSON documents used as flnt's database. */

export type UserRecord = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  emailVerified: boolean;
  mfaOkUntil: string | null;
  roles: string[];
  createdAt: string;
  lastLoginAt: string | null;
};

export type UsersDoc = { users: UserRecord[] };

export type AdminDoc = { allowlist: string[] };

export type EmailCode = {
  id: string;
  userId: string;
  email: string;
  purpose: "signup" | "login";
  codeHash: string;
  attempts: number;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
};

export type CodesDoc = { codes: EmailCode[] };

export type PollRecord = {
  id: string;
  code: string;
  ownerId: string;
  title: string;
  authorDisplayName: string;
  /** Private: only the owner and admins may see this. */
  authorEmail: string;
  description: string;
  explanation: string;
  milestoneNotified: boolean;
  createdAt: string;
};

export type VoteRecord = {
  pollId: string;
  userId: string;
  choice: boolean;
  updatedAt: string;
};

export type CommentRecord = {
  id: string;
  pollId: string;
  userId: string;
  parentId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
};

export type PollsDoc = {
  polls: PollRecord[];
  votes: VoteRecord[];
  comments: CommentRecord[];
};

export type BusinessRecord = {
  id: string;
  slug: string;
  sellerName: string;
  businessType: string;
  ownerId: string;
  badgeOverride: boolean | null;
  adjustCount: number;
  adjustSum: number;
  createdAt: string;
};

export type RatingRecord = {
  id: string;
  businessId: string;
  userId: string;
  authorName: string;
  stars: number;
  review: string;
  createdAt: string;
};

export type TrustDoc = { businesses: BusinessRecord[]; ratings: RatingRecord[] };

export type TicketRecord = {
  id: string;
  userId: string;
  subject: string;
  status: "open" | "resolved";
  createdAt: string;
  updatedAt: string;
};

export type TicketMessageRecord = {
  id: string;
  ticketId: string;
  senderId: string;
  fromAdmin: boolean;
  body: string;
  createdAt: string;
};

export type SupportDoc = { tickets: TicketRecord[]; messages: TicketMessageRecord[] };

export type AuditRecord = {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  priorValue: unknown;
  newValue: unknown;
  reason: string;
  createdAt: string;
};

export type AuditDoc = { entries: AuditRecord[] };
