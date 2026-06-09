import { Section, Step } from "@/components/help/step";

// Admin / studio guide. Audience: you and your team. Covers the
// administrative lifecycle: setup, member management, round flow.
export function AdminGuide() {
  return (
    <>
      <Section eyebrow="Day one" title="Setting up a project">
        <Step
          number={1}
          title="Create the project"
          screenshot={{
            src: "admin-01-new-project.png",
            alt: "New project form",
            caption: "Dashboard → New project. Name + client + you're done.",
          }}
        >
          <p>
            From the dashboard, click <strong>+ New project</strong>. Two fields: name (e.g.{" "}
            <em>Moods FW26</em>) and client (the brand you&apos;re shooting for — used for
            branding in emails and the overview).
          </p>
        </Step>

        <Step
          number={2}
          title="Upload your batch"
          screenshot={{
            src: "admin-02-upload.png",
            alt: "Upload page with multiple files in progress",
            caption: "Drag a folder or pick files. Filenames are parsed into slot names.",
          }}
        >
          <p>
            Click <strong>Upload images</strong> from the project hero. Drag a folder of files or pick
            them manually. The platform:
          </p>
          <ul>
            <li>Generates a 2000px preview + 480px thumbnail per image</li>
            <li>Parses the filename into a slot name (e.g. <code>LOOK_03_A.jpg</code> → <code>LOOK_03_A</code>)</li>
            <li>Stores nothing of the original — high‑res masters stay in your DAM</li>
          </ul>
          <p>
            Subject grouping: if you upload <code>LOOK_03_A</code> and <code>LOOK_03_B</code>, the platform
            automatically groups them as two views of the same subject.
          </p>
        </Step>

        <Step
          number={3}
          title="Invite the team"
          screenshot={{
            src: "admin-03-invite.png",
            alt: "Settings drawer Members panel with the invite form open",
            caption: "Settings → Members tab. Email + role. They get one click access.",
          }}
        >
          <p>
            Click the gear icon on the project hero to open the <strong>Settings drawer</strong>. Go
            to the <strong>Members</strong> tab. Add emails with roles:
          </p>
          <ul>
            <li><strong>Client reviewer</strong> — sees images, comments, makes decisions. The actual customer.</li>
            <li><strong>Post‑production</strong> — gets the digest, marks items done, uploads v2. The retoucher.</li>
            <li><strong>Internal reviewer</strong> — sees everything, can also invite more people.</li>
            <li><strong>Admin</strong> — full control including org-level settings (archive / delete projects).</li>
          </ul>
          <p>
            Each invitee gets one email that signs them in and adds them to the project in one click.
          </p>
        </Step>
      </Section>

      <Section eyebrow="Round flow" title="From upload to approval">
        <Step
          number={1}
          title="Internally decide before sending to the client"
          screenshot={{
            src: "admin-04-internal-pass.png",
            alt: "Project overview during internal review",
            caption: "Three tabs: Still to review / Approved / Needs revision.",
          }}
        >
          <p>
            Pass through the images yourself first — same UI as the client uses. Mark
            anything not ready for client eyes as <strong>Needs revision</strong> (you can add
            internal-visibility comments to brief post-prod silently).
          </p>
        </Step>

        <Step
          number={2}
          title="Notify the client"
          screenshot={{
            src: "admin-05-notify.png",
            alt: "Notify client CTA in the project hero",
            caption: "Once internally clear, hit Notify client. They receive one email.",
          }}
        >
          <p>
            On the project hero, the <strong>Notify client</strong> button appears once there are images
            ready. Clicking it:
          </p>
          <ul>
            <li>Opens the current round (status: <code>open</code>)</li>
            <li>Sends a <strong>Review ready</strong> email to every client reviewer</li>
            <li>Each email contains a one-click sign-in URL valid for 14 days</li>
          </ul>
        </Step>

        <Step
          number={3}
          title="Wait for their submission"
          screenshot={{
            src: "admin-06-digest.png",
            alt: "Round digest email with per-image client comments",
            caption: "When they submit, you (+ post-prod) get the full digest.",
          }}
        >
          <p>
            When the client clicks <strong>Submit round</strong>, you and the post-prod team get a
            single digest email summarising the round: counts plus every per-image
            comment they made. No need to log into the platform to know what&apos;s waiting.
          </p>
        </Step>

        <Step number={4} title="Round 2, round 3…">
          <p>
            Post-prod uploads V2 (matching filenames re-use the slot, status flips to{" "}
            <strong>Pending</strong>). When ready, click <strong>Notify client</strong> again. The number on
            the round bumps automatically.
          </p>
          <p>
            Resolved (done) comments from previous rounds stay done — they don&apos;t
            reset between versions.
          </p>
        </Step>
      </Section>

      <Section eyebrow="Member management" title="When things change">
        <Step
          number={1}
          title="Send a password reset"
          screenshot={{
            src: "admin-07-member-actions.png",
            alt: "Member row with Reset and Revoke buttons",
            caption: "Per-member actions sit on the right of each row.",
          }}
        >
          <p>
            When someone emails you saying &quot;I can&apos;t log in&quot;, open the Settings drawer →
            Members. Find their row, click <strong>Reset</strong>. They get a fresh sign-in
            link in their inbox — one click + new password and they&apos;re back.
          </p>
        </Step>

        <Step number={2} title="Revoke someone's access">
          <p>
            Same row, click <strong>Revoke</strong>. This:
          </p>
          <ul>
            <li>Removes them from this project (other projects stay intact)</li>
            <li>Their existing comments and decisions stay — only the access is gone</li>
            <li>If they had an active session, the next request will bounce them</li>
          </ul>
          <p>You can&apos;t revoke yourself — hand off the org first if you need to leave.</p>
        </Step>
      </Section>

      <Section eyebrow="Public previews" title="Share links">
        <Step
          number={1}
          title="Create a read-only share link"
          screenshot={{
            src: "admin-08-share-link.png",
            alt: "Share link creation form in the settings drawer",
            caption: "Settings → Share. Optional password and expiry date.",
          }}
        >
          <p>
            Sometimes a stakeholder needs a peek without an account. Settings drawer →
            <strong> Share</strong> tab → <strong>Create link</strong>. Options:
          </p>
          <ul>
            <li><strong>Password</strong> — recipient enters it before the gallery loads</li>
            <li><strong>Expiry date</strong> — link auto-expires</li>
          </ul>
          <p>
            They see a read-only gallery — no comments, no decisions, no annotations,
            and definitely no high-res originals.
          </p>
        </Step>

        <Step number={2} title="Revoke a share link">
          <p>
            Same panel. Click <strong>Revoke</strong> on the link row. Existing sessions on that
            link cookie are killed.
          </p>
        </Step>
      </Section>

      <Section eyebrow="Lifecycle" title="Archiving and deleting">
        <Step
          number={1}
          title="Archive when delivered"
          screenshot={{
            src: "admin-09-archive.png",
            alt: "Danger zone with archive and delete buttons",
            caption: "Settings → Danger zone. Archive is reversible; delete isn't.",
          }}
        >
          <p>
            Once a project is delivered, archive it (Settings drawer → <strong>Danger zone</strong> →
            <strong> Archive</strong>). Archived projects:
          </p>
          <ul>
            <li>Don&apos;t show in the default dashboard view</li>
            <li>Are still accessible from <strong>View archived</strong></li>
            <li>Stay read-only — no new uploads, comments, or decisions</li>
          </ul>
        </Step>

        <Step number={2} title="Delete for good">
          <p>
            Owner-only. Permanently removes the project, all images, comments,
            annotations, and audit log entries. Storage objects (R2/local) are deleted
            too. No undo.
          </p>
        </Step>
      </Section>
    </>
  );
}
