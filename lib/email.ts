import { env } from "@/lib/env";

type SendEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

// Send via Resend if RESEND_API_KEY is configured; otherwise dump to the
// server log so dev still works without an account. Retries once on 5xx
// since Resend occasionally returns 503 under load.
export async function sendEmail(opts: SendEmail) {
  if (!env.RESEND_API_KEY) {
    console.log("\n────────── EMAIL (dev) ──────────");
    console.log("To:     ", opts.to);
    console.log("Subject:", opts.subject);
    console.log(opts.text);
    console.log("─────────────────────────────────\n");
    return { delivered: false, channel: "console" as const };
  }

  const payload: Record<string, unknown> = {
    from: env.EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  };
  if (opts.html) payload.html = opts.html;
  const replyTo = opts.replyTo || env.EMAIL_REPLY_TO;
  if (replyTo) payload.reply_to = replyTo;

  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { delivered: true, channel: "resend" as const };
    lastErr = await res.text();
    // Only retry transient server errors. 4xx is our fault, no point retrying.
    if (res.status < 500) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Resend failed: ${lastErr}`);
}

// ─────────────────────────────────────────────────────────────────────────
// HTML shell
// ─────────────────────────────────────────────────────────────────────────
// Inline styles only — most email clients strip <style> blocks or scope
// them in ways that make external CSS unreliable. Keeping the palette
// minimal and high-contrast so it renders well on light + dark clients.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(opts: { preheader: string; title: string; bodyHtml: string }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#f5f5f4;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #f5f5f4;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#78716c;font-weight:600;">CIRIS Review</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">${opts.bodyHtml}</td>
          </tr>
          <tr>
            <td style="padding:20px 28px;border-top:1px solid #f5f5f4;background:#fafaf9;font-size:12px;color:#78716c;">
              Sent by CIRIS Review · <a href="${escapeHtml(env.APP_URL)}" style="color:#78716c;text-decoration:underline;">${escapeHtml(env.APP_URL.replace(/^https?:\/\//, ""))}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
    <tr>
      <td style="background:#1c1917;border-radius:8px;">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

// ─────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────

export function magicLinkEmail(url: string) {
  const subject = "Sign in to CIRIS Review";
  const text = `Sign in by opening this link:\n\n${url}\n\nThis link expires in 30 minutes. If you didn't request it, you can safely ignore this email.`;
  const html = shell({
    preheader: "Your sign-in link — expires in 30 minutes.",
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#1c1917;">Sign in to CIRIS Review</h1>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#44403c;">Click the button below to sign in. The link expires in 30 minutes.</p>
      ${button(url, "Sign in")}
      <p style="margin:0;font-size:12px;line-height:1.6;color:#78716c;">Or paste this URL into your browser:<br><span style="word-break:break-all;color:#44403c;">${escapeHtml(url)}</span></p>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#78716c;">If you didn't request this, you can ignore this email.</p>
    `,
  });
  return { subject, text, html };
}

// Password reset / "set password" link. Same one-click sign-in pattern as
// magic links, but the landing page asks for a new password. Sent from the
// /api/auth/forgot endpoint and from the admin "Send password reset"
// action in the members panel.
export function passwordResetEmail(opts: { url: string; expiresHours: number }) {
  const subject = "Reset your CIRIS Review password";
  const text = [
    "Click the link below to set a new password. You'll be signed in automatically.",
    "",
    opts.url,
    "",
    `Link expires in ${opts.expiresHours} hours. If you didn't request this, ignore this email.`,
  ].join("\n");
  const html = shell({
    preheader: `Set a new password — link expires in ${opts.expiresHours} hours.`,
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#1c1917;">Reset your password</h1>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#44403c;">Click the button below to sign in and pick a new password.</p>
      ${button(opts.url, "Set a new password")}
      <p style="margin:0;font-size:12px;line-height:1.6;color:#78716c;">Or paste this URL into your browser:<br><span style="word-break:break-all;color:#44403c;">${escapeHtml(opts.url)}</span></p>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#78716c;">Link expires in ${opts.expiresHours} hours. If you didn't request this, you can safely ignore this email.</p>
    `,
  });
  return { subject, text, html };
}

// One-click project invite. The link both signs the recipient in AND adds
// them to the project — no separate magic-link round-trip. The token is the
// secret: anyone with this URL gets access, same trust model as magic links.
export function inviteEmail(opts: {
  projectName: string;
  orgName: string;
  inviterName: string | null;
  role: string;
  url: string;
  expiresDays: number;
}) {
  const roleLabel = opts.role.replace(/_/g, " ");
  const subject = `${opts.inviterName ?? opts.orgName} invited you to review ${opts.projectName}`;
  const text = [
    `${opts.inviterName ?? opts.orgName} invited you to ${opts.projectName} as ${roleLabel}.`,
    "",
    "Open this link to start reviewing. You'll be signed in automatically:",
    "",
    opts.url,
    "",
    `Link expires in ${opts.expiresDays} days. One-time use.`,
  ].join("\n");
  const html = shell({
    preheader: `One-click access to ${opts.projectName} — no password needed.`,
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#78716c;letter-spacing:0.05em;text-transform:uppercase;">${escapeHtml(opts.orgName)}</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#1c1917;">You're invited to ${escapeHtml(opts.projectName)}</h1>
      <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#44403c;">${escapeHtml(opts.inviterName ?? opts.orgName)} added you as <strong>${escapeHtml(roleLabel)}</strong>.</p>
      <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#44403c;">One click on the button below signs you in and opens the project. No password needed.</p>
      ${button(opts.url, "Open the project")}
      <p style="margin:0;font-size:12px;line-height:1.6;color:#78716c;">Or paste this URL into your browser:<br><span style="word-break:break-all;color:#44403c;">${escapeHtml(opts.url)}</span></p>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#78716c;">Link expires in ${opts.expiresDays} days. One-time use — share it only with yourself.</p>
    `,
  });
  return { subject, text, html };
}

export type DigestImageItem = {
  slot: string;
  displayName: string | null;
  galleryName: string;
  comments: { body: string; authorName: string }[];
};

// Round digest sent to post-prod + admin after the client submits a round.
// One email per round — never per-image, never per-comment. Includes the
// client's per-image comments so post-prod can scan the whole batch without
// opening the app.
export function roundDigestEmail(opts: {
  projectName: string;
  clientName: string | null;
  roundNumber: number;
  counts: { approved: number; approvedWithNotes: number; revisionRequested: number };
  projectUrl: string;
  revisionItems: DigestImageItem[];
  notesItems: DigestImageItem[];
}) {
  const {
    projectName,
    clientName,
    roundNumber,
    counts,
    projectUrl,
    revisionItems,
    notesItems,
  } = opts;
  const total = counts.approved + counts.approvedWithNotes + counts.revisionRequested;
  const subject = `Round ${roundNumber} feedback — ${projectName} (${counts.revisionRequested} revisions)`;

  // ── Plain text ─────────────────────────────────────────────
  const lines: string[] = [
    `${clientName ?? "The client"} has just submitted Round ${roundNumber} for ${projectName}.`,
    "",
    `Summary (${total} decided):`,
    `  • ${counts.approved} approved`,
    `  • ${counts.approvedWithNotes} approved with notes`,
    `  • ${counts.revisionRequested} need revision`,
    "",
  ];
  if (revisionItems.length) {
    lines.push(`REVISION REQUESTED (${revisionItems.length})`, "─────────────────────────────────────────");
    for (const item of revisionItems) {
      lines.push(...formatItemText(item));
      lines.push("");
    }
  }
  if (notesItems.length) {
    lines.push(`APPROVED WITH COMMENTS (${notesItems.length})`, "─────────────────────────────────────────");
    for (const item of notesItems) {
      lines.push(...formatItemText(item));
      lines.push("");
    }
  }
  lines.push(`Open the project to see all comments and annotations:`, projectUrl, "", "— CIRIS Review");

  // ── HTML ───────────────────────────────────────────────────
  const summaryRow = (label: string, count: number, color: string) =>
    `<tr><td style="padding:6px 0;font-size:14px;color:#44403c;">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle;"></span>
      <strong style="color:#1c1917;">${count}</strong> ${escapeHtml(label)}
    </td></tr>`;

  const section = (title: string, items: DigestImageItem[], badgeColor: string) => {
    if (items.length === 0) return "";
    return `
      <h2 style="margin:24px 0 12px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#1c1917;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${badgeColor};margin-right:8px;vertical-align:middle;"></span>${escapeHtml(title)} (${items.length})
      </h2>
      <div style="border:1px solid #e7e5e4;border-radius:8px;overflow:hidden;">
        ${items.map((item, i) => formatItemHtml(item, i === items.length - 1)).join("")}
      </div>
    `;
  };

  const html = shell({
    preheader: `${counts.revisionRequested} need revision, ${counts.approved + counts.approvedWithNotes} approved.`,
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#1c1917;">Round ${roundNumber} feedback received</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#44403c;">${escapeHtml(clientName ?? "The client")} submitted feedback for <strong>${escapeHtml(projectName)}</strong>.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
        ${summaryRow("approved", counts.approved, "#22c55e")}
        ${summaryRow("approved with notes", counts.approvedWithNotes, "#eab308")}
        ${summaryRow("need revision", counts.revisionRequested, "#ef4444")}
      </table>
      ${section("Revision requested", revisionItems, "#ef4444")}
      ${section("Approved with comments", notesItems, "#eab308")}
      ${button(projectUrl, "Open project")}
    `,
  });

  return { subject, text: lines.join("\n"), html };
}

function formatItemText(item: DigestImageItem): string[] {
  const title = item.displayName
    ? `${item.displayName} (${item.slot}) · ${item.galleryName}`
    : `${item.slot} · ${item.galleryName}`;
  if (item.comments.length === 0) return [title, `  (no comments)`];
  const out = [title];
  for (const c of item.comments.slice(0, 4)) {
    const truncated = c.body.length > 140 ? c.body.slice(0, 137) + "…" : c.body;
    out.push(`  "${truncated}" — ${c.authorName}`);
  }
  if (item.comments.length > 4) out.push(`  (+${item.comments.length - 4} more in the app)`);
  return out;
}

function formatItemHtml(item: DigestImageItem, isLast: boolean): string {
  const title = item.displayName
    ? `${escapeHtml(item.displayName)} <span style="color:#a8a29e;font-weight:400;">(${escapeHtml(item.slot)})</span>`
    : escapeHtml(item.slot);
  const border = isLast ? "" : "border-bottom:1px solid #e7e5e4;";
  const commentBlocks = item.comments.length
    ? item.comments
        .slice(0, 4)
        .map((c) => {
          const truncated = c.body.length > 200 ? c.body.slice(0, 197) + "…" : c.body;
          return `<div style="margin:8px 0;padding:8px 12px;background:#fafaf9;border-left:2px solid #d6d3d1;border-radius:0 4px 4px 0;">
              <div style="font-size:13px;line-height:1.5;color:#1c1917;">${escapeHtml(truncated)}</div>
              <div style="margin-top:4px;font-size:12px;color:#78716c;">— ${escapeHtml(c.authorName)}</div>
            </div>`;
        })
        .join("") +
      (item.comments.length > 4
        ? `<div style="margin-top:4px;font-size:12px;color:#78716c;">+${item.comments.length - 4} more in the app</div>`
        : "")
    : `<div style="margin-top:4px;font-size:13px;color:#a8a29e;">No comments</div>`;
  return `<div style="padding:14px 16px;${border}">
    <div style="font-size:14px;font-weight:600;color:#1c1917;">${title}</div>
    <div style="margin-top:2px;font-size:12px;color:#78716c;">${escapeHtml(item.galleryName)}</div>
    ${commentBlocks}
  </div>`;
}

export function roundSubmittedClientEmail(opts: {
  projectName: string;
  roundNumber: number;
  counts: { approved: number; approvedWithNotes: number; revisionRequested: number };
}) {
  const { projectName, roundNumber, counts } = opts;
  const subject = `Round ${roundNumber} submitted — ${projectName}`;
  const approved = counts.approved + counts.approvedWithNotes;
  const text = [
    `Thanks — your Round ${roundNumber} feedback has been recorded.`,
    "",
    `  • ${approved} approved`,
    `  • ${counts.revisionRequested} need revision`,
    "",
    "We'll email you again when the next round is ready for review.",
    "",
    "— CIRIS Review",
  ].join("\n");
  const html = shell({
    preheader: "Your feedback has been recorded.",
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#1c1917;">Thanks — feedback received</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#44403c;">Your Round ${roundNumber} feedback for <strong>${escapeHtml(projectName)}</strong> has been recorded.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:4px 0;font-size:14px;color:#44403c;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;margin-right:8px;vertical-align:middle;"></span><strong style="color:#1c1917;">${approved}</strong> approved</td></tr>
        <tr><td style="padding:4px 0;font-size:14px;color:#44403c;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444;margin-right:8px;vertical-align:middle;"></span><strong style="color:#1c1917;">${counts.revisionRequested}</strong> need revision</td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#44403c;">We'll email you again when the next round is ready.</p>
    `,
  });
  return { subject, text, html };
}

export function roundReadyClientEmail(opts: {
  projectName: string;
  roundNumber: number;
  imageCount: number;
  projectUrl: string;
}) {
  const { projectName, roundNumber, imageCount, projectUrl } = opts;
  // Round 1 is the initial release; later rounds are revision rounds. Different
  // copy sets expectations correctly.
  const isFirst = roundNumber === 1;
  const subject = isFirst
    ? `Review ready — ${projectName}`
    : `Round ${roundNumber} is ready — ${projectName}`;
  const plural = imageCount === 1 ? "" : "s";
  const isAre = imageCount === 1 ? "is" : "are";
  const intro = isFirst
    ? `${imageCount} image${plural} ${isAre} ready for your review.`
    : `${imageCount} revised image${plural} ${isAre} ready for your Round ${roundNumber} review.`;
  const text = [intro, "", projectUrl, "", "— CIRIS Review"].join("\n");
  const html = shell({
    preheader: intro,
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#1c1917;">${escapeHtml(isFirst ? "Review ready" : `Round ${roundNumber} is ready`)}</h1>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#44403c;"><strong>${escapeHtml(projectName)}</strong></p>
      <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#44403c;">${escapeHtml(intro)}</p>
      ${button(projectUrl, isFirst ? "Start review" : `Review Round ${roundNumber}`)}
      <p style="margin:0;font-size:12px;line-height:1.6;color:#78716c;">Or paste this URL into your browser:<br><span style="word-break:break-all;color:#44403c;">${escapeHtml(projectUrl)}</span></p>
    `,
  });
  return { subject, text, html };
}
