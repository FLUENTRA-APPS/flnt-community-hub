import { mutateDoc, readDoc } from "./store.server";
import { sendMilestoneEmail } from "./emails.server";
import { siteOrigin } from "./server-shared.server";
import type { PollsDoc } from "./data-types";

const YES_MILESTONE = 1000;

/** Emails the poll owner once, the first time Yes votes exceed 1,000. */
export async function notifyMilestoneIfNeeded(
  pollId: string,
  yes: number,
  no: number,
): Promise<void> {
  if (yes <= YES_MILESTONE) return;

  const doc = await readDoc<PollsDoc>("polls.json");
  const poll = doc.polls.find((p) => p.id === pollId);
  if (!poll || poll.milestoneNotified || !poll.authorEmail) return;

  // Claim the one-time flag before sending so it can never fire twice.
  const claimed = await mutateDoc<PollsDoc, boolean>("polls.json", (fresh) => {
    const target = fresh.polls.find((p) => p.id === pollId);
    if (!target || target.milestoneNotified) return false;
    target.milestoneNotified = true;
    return true;
  });
  if (!claimed) return;

  const sent = await sendMilestoneEmail(
    poll.authorEmail,
    poll.title,
    `${siteOrigin()}/${poll.code}`,
    yes,
    no,
  );

  if (!sent) {
    // Release the flag so a later vote can retry delivery.
    await mutateDoc<PollsDoc, void>("polls.json", (fresh) => {
      const target = fresh.polls.find((p) => p.id === pollId);
      if (target) target.milestoneNotified = false;
    });
  }
}
