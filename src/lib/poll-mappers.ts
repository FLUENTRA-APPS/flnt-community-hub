import { z } from "zod";

export type PublicPoll = {
  id: string;
  code: string;
  title: string;
  authorDisplayName: string;
  description: string;
  explanation: string;
  yesCount: number;
  noCount: number;
  createdAt: string;
};

export type PollComment = {
  id: string;
  parentId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
};

export const createPollSchema = z.object({
  title: z.string().trim().min(3).max(160),
  authorDisplayName: z.string().trim().min(1).max(80),
  authorEmail: z.string().trim().email().max(255),
  description: z.string().trim().min(10).max(5000),
  explanation: z.string().trim().min(10).max(5000),
});

export type PollRow = {
  id: string;
  code: string;
  title: string;
  author_display_name: string;
  description: string;
  explanation: string;
  yes_count: number;
  no_count: number;
  created_at: string;
};

export function mapPoll(row: PollRow): PublicPoll {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    authorDisplayName: row.author_display_name,
    description: row.description,
    explanation: row.explanation,
    yesCount: row.yes_count,
    noCount: row.no_count,
    createdAt: row.created_at,
  };
}

export const POLL_SELECT =
  "id, code, title, author_display_name, description, explanation, yes_count, no_count, created_at";
