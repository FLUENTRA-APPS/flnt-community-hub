import { sendMail } from "./smtp.server";

const BRAND = "flnt";

function shell(heading: string, inner: string, footerNote?: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f6f6;font-family:Helvetica,Arial,sans-serif;color:#0f1b1b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f6;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8e8;">
        <tr><td style="background:#0f3d3e;padding:24px 32px;">
          <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">${BRAND}</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f1b1b;">${heading}</h1>
          ${inner}
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f8fafa;border-top:1px solid #e2e8e8;color:#5b6b6b;font-size:12px;line-height:1.6;">
          ${footerNote ?? `You received this email because of activity on your ${BRAND} account.`}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function codeBlock(code: string): string {
  return `<div style="margin:24px 0;padding:18px;text-align:center;background:#f1f7f6;border:1px dashed #0f3d3e;border-radius:12px;font-size:32px;letter-spacing:10px;font-weight:700;color:#0f3d3e;">${code}</div>`;
}

export async function sendVerificationCode(
  to: string,
  code: string,
  purpose: "signup" | "login",
): Promise<boolean> {
  const isSignup = purpose === "signup";
  const heading = isSignup ? "Confirm your flnt account" : "Confirm this sign-in";
  const lead = isSignup
    ? "Welcome to flnt. Use the verification code below to finish creating your account."
    : "Someone just signed in to your flnt account. Enter the confirmation code below to continue.";
  const html = shell(
    heading,
    `<p style="margin:0;font-size:15px;line-height:1.6;color:#334747;">${lead}</p>
     ${codeBlock(code)}
     <p style="margin:0;font-size:14px;line-height:1.6;color:#5b6b6b;">This code expires in 10 minutes and can be used once. If you didn't request it, you can safely ignore this email${isSignup ? "" : " and should change your password"}.</p>`,
  );
  const text = `${heading}\n\n${lead}\n\nYour code: ${code}\n\nThis code expires in 10 minutes.`;
  return sendMail({ to, subject: `${code} is your flnt ${isSignup ? "verification" : "sign-in"} code`, html, text });
}

export async function sendMilestoneEmail(
  to: string,
  pollTitle: string,
  pollUrl: string,
  yes: number,
  no: number,
): Promise<boolean> {
  const total = yes + no;
  const pct = total ? Math.round((yes / total) * 100) : 0;
  const html = shell(
    "Your update just passed 1,000 Yes votes",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Your update <strong>${escapeHtml(pollTitle)}</strong> has crossed 1,000 Yes votes on flnt.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;border-collapse:collapse;font-size:14px;">
       <tr><td style="padding:8px 0;border-bottom:1px solid #eef2f2;">Yes votes</td><td align="right" style="padding:8px 0;border-bottom:1px solid #eef2f2;"><strong>${yes.toLocaleString()}</strong></td></tr>
       <tr><td style="padding:8px 0;border-bottom:1px solid #eef2f2;">No votes</td><td align="right" style="padding:8px 0;border-bottom:1px solid #eef2f2;"><strong>${no.toLocaleString()}</strong></td></tr>
       <tr><td style="padding:8px 0;">Approval</td><td align="right" style="padding:8px 0;"><strong>${pct}%</strong></td></tr>
     </table>
     <a href="${pollUrl}" style="display:inline-block;background:#0f3d3e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px;">View your update</a>
     <p style="margin:20px 0 0;font-size:13px;color:#5b6b6b;">${pollUrl}</p>`,
    "You are receiving this one-time notification as the owner of this update.",
  );
  const text = `Your flnt update "${pollTitle}" passed 1,000 Yes votes.\nYes: ${yes}\nNo: ${no}\nApproval: ${pct}%\n${pollUrl}`;
  return sendMail({ to, subject: `"${pollTitle}" passed 1,000 Yes votes on flnt`, html, text });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
