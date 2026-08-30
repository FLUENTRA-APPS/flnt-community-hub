import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendMilestoneEmail } from "./emails.server";
import { siteOrigin } from "./server-shared.server";

const YES_MILESTONE = 1000;

type PollSnapshot = {
  id: string;
  code: string;
  title: string;
  yes_count: number;
  no_count: number;
  milestone_notified: boolean;
};

/** Emails the poll owner once, the first time Yes votes exceed 1,000. */
export async function notifyMilestoneIfNeeded(poll: PollSnapshot): Promise<void> {
  if (poll.milestone_notified || poll.yes_count <= YES_MILESTONE) return;

  // Claim the one-time flag before sending so it can never fire twice.
  const { data: claimed } = await supabaseAdmin
    .from("polls")
    .update({ milestone_notified: true })
    .eq("id", poll.id)
    .eq("milestone_notified", false)
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const { data: privateRow } = await supabaseAdmin
    .from("poll_private")
    .select("author_email")
    .eq("poll_id", poll.id)
    .maybeSingle();
  if (!privateRow?.author_email) return;

  const sent = await sendMilestoneEmail(
    privateRow.author_email,
    poll.title,
    `${siteOrigin()}/${poll.code}`,
    poll.yes_count,
    poll.no_count,
  );

  if (!sent) {
    // Release the flag so a later vote can retry delivery.
    await supabaseAdmin.from("polls").update({ milestone_notified: false }).eq("id", poll.id);
  }
}
