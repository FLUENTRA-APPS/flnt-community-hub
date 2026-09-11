/** Shared HTML for flnt social share cards (black / white / green). */

const GREEN = "#12A150";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(inner: string): string {
  return `<div style="display:flex;flex-direction:column;width:1200px;height:630px;background:#0A0A0A;color:#FFFFFF;padding:64px;font-family:sans-serif;">
    <div style="display:flex;align-items:center;font-size:34px;font-weight:700;letter-spacing:-1px;">
      flnt<span style="color:${GREEN};">.</span>
      <span style="color:#9CA3AF;font-size:26px;font-weight:500;margin-left:16px;">flnt.dpdns.org</span>
    </div>
    <div style="display:flex;width:100%;height:4px;background:${GREEN};margin-top:24px;"></div>
    ${inner}
  </div>`;
}

export function pollCardHtml(input: {
  title: string;
  author: string;
  yes: number;
  no: number;
}): string {
  const total = input.yes + input.no;
  const pct = total ? Math.round((input.yes / total) * 100) : 0;
  return shell(`
    <div style="display:flex;flex-direction:column;flex:1;justify-content:center;">
      <div style="display:flex;color:${GREEN};font-size:24px;font-weight:700;letter-spacing:4px;">COMMUNITY UPDATE VOTE</div>
      <div style="display:flex;font-size:60px;font-weight:700;line-height:1.1;margin-top:20px;">${esc(
        input.title.slice(0, 90),
      )}</div>
      <div style="display:flex;font-size:28px;color:#9CA3AF;margin-top:20px;">Proposed by ${esc(
        input.author.slice(0, 50),
      )}</div>
    </div>
    <div style="display:flex;align-items:center;font-size:32px;font-weight:700;">
      <div style="display:flex;background:${GREEN};color:#0A0A0A;padding:14px 26px;border-radius:10px;">Yes ${input.yes}</div>
      <div style="display:flex;background:#1F2937;padding:14px 26px;border-radius:10px;margin-left:16px;">No ${input.no}</div>
      <div style="display:flex;color:#9CA3AF;margin-left:24px;font-weight:500;">${pct}% in favour · ${total} votes</div>
    </div>`);
}

export function businessCardHtml(input: {
  name: string;
  type: string;
  stars: number;
  count: number;
  verified: boolean;
  review: string;
}): string {
  const full = Math.round(input.stars);
  const starRow = Array.from({ length: 5 })
    .map(
      (_, i) =>
        `<div style="display:flex;color:${i < full ? GREEN : "#374151"};font-size:56px;margin-right:8px;">★</div>`,
    )
    .join("");
  return shell(`
    <div style="display:flex;flex-direction:column;flex:1;justify-content:center;">
      <div style="display:flex;align-items:center;font-size:56px;font-weight:700;">
        ${esc(input.name.slice(0, 40))}
        ${input.verified ? `<div style="display:flex;color:#2F80ED;margin-left:16px;">✔</div>` : ""}
      </div>
      <div style="display:flex;font-size:26px;color:#9CA3AF;margin-top:10px;">${esc(input.type.slice(0, 50))}</div>
      <div style="display:flex;align-items:center;margin-top:28px;">
        ${starRow}
        <div style="display:flex;font-size:32px;font-weight:700;margin-left:16px;">${input.stars.toFixed(1)}</div>
        <div style="display:flex;font-size:26px;color:#9CA3AF;margin-left:14px;">${input.count} ratings</div>
      </div>
      <div style="display:flex;font-size:28px;color:#E5E7EB;margin-top:28px;line-height:1.4;">${esc(
        (input.review || "No written reviews yet — be the first to share your experience.").slice(
          0,
          150,
        ),
      )}</div>
    </div>
    <div style="display:flex;font-size:24px;color:#9CA3AF;">Independent business reviews on flnt</div>`);
}
