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

