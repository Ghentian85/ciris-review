import { Section, Step } from "@/components/help/step";

// Client reviewer guide — the audience is non-technical. Keep it warm,
// short sentences, no jargon. Anything they need to do is in the steps.
export function ClientGuide() {
  return (
    <>
      <Section eyebrow="Getting in" title="Signing in for the first time">
        <Step
          number={1}
          title="Click the link in the invite email"
          screenshot={{
            src: "client-01-invite-email.png",
            alt: "The invite email a client receives",
            caption: "The studio sends you one email. Click 'Open the project'.",
          }}
        >
          <p>
            The studio team will send you one email titled <strong>You&apos;re invited to [project name]</strong>.
            Clicking the button signs you in and opens the project automatically — no password required upfront.
          </p>
        </Step>
        <Step
          number={2}
          title="Optionally set a password"
          screenshot={{
            src: "client-02-set-password.png",
            alt: "Set password welcome screen",
            caption: "Pick a password — or click Skip to keep using one-click links.",
          }}
        >
          <p>
            We&apos;ll suggest setting a password so signing in next time is one step.
            You can also <strong>skip</strong> — every notification email we send you contains
            a one-click sign-in link, so coming back is always easy.
          </p>
        </Step>
        <Step number={3} title="Coming back later">
          <p>Two ways to return:</p>
          <ul>
            <li>Open the latest email we sent you and click the link inside — straight back in</li>
            <li>Bookmark <code>review.ciris.studio</code> and use your email + password</li>
          </ul>
          <p>
            Forgot your password? On the sign-in screen, click <strong>Forgot?</strong> and we&apos;ll
            email you a fresh link.
          </p>
        </Step>
      </Section>

      <Section eyebrow="Reviewing" title="Looking at images">
        <Step
          number={1}
          title="Pick an image from the grid"
          screenshot={{
            src: "client-04-overview.png",
            alt: "Project overview with image grid and status tabs",
            caption:
              "Three tabs: Still to review, Approved, Needs revision. Start in 'Still to review'.",
          }}
        >
          <p>
            The project overview shows every image with a status. Use the tabs at the top
            to filter — your job is to clear out <strong>Still to review</strong>.
          </p>
          <p>Click any image to open it full‑size.</p>
        </Step>

        <Step
          number={2}
          title="Drop comments where you need to"
          screenshot={{
            src: "client-05-reviewer-tools.png",
            alt: "Reviewer with the tool palette and comment popover open",
            caption: "Tools sit top-left. The right rail holds your comments and the decision.",
          }}
        >
          <p>The reviewer has three drawing tools (top-left):</p>
          <ul>
            <li><strong>Pin</strong> — drop a single dot to comment on a spot</li>
            <li><strong>Rectangle</strong> — frame an area</li>
            <li><strong>Draw</strong> — circle / scribble freehand</li>
          </ul>
          <p>
            Pick a tool, click on the image, type your note, hit <strong>Save</strong>. Repeat for
            every note you have on this image.
          </p>
        </Step>

        <Step
          number={3}
          title="Make the call"
          screenshot={{
            src: "client-06-decision.png",
            alt: "Decision pills in the right rail: Needs revision and Approve",
            caption: "Two buttons. Once clicked, the image moves out of 'Still to review'.",
          }}
        >
          <p>Bottom of the right rail, two big buttons:</p>
          <ul>
            <li><strong>Needs revision</strong> (red) — the studio will retouch and resubmit</li>
            <li><strong>Approve</strong> (green) — locked in, ready for delivery</li>
          </ul>
          <p>
            You can change your mind — clicking again switches the decision.
          </p>
        </Step>

        <Step number={4} title="Useful while you work">
          <ul>
            <li>Press <code>←</code> / <code>→</code> to flip to the previous/next image</li>
            <li>Press <code>F</code> for fullscreen — same controls, bigger image</li>
            <li>Press <code>+</code> / <code>−</code> / <code>0</code> to zoom in, out, reset</li>
            <li>Hover a comment in the right rail → its marker on the image lights up</li>
          </ul>
        </Step>
      </Section>

      <Section eyebrow="Wrapping up" title="Submitting your round">
        <Step
          number={1}
          title="Wait until 'Still to review' is empty"
          screenshot={{
            src: "client-07-submit-cta.png",
            alt: "Submit round call-to-action appears at the top of the overview",
            caption: "Once every image has a decision, the Submit round CTA appears.",
          }}
        >
          <p>
            You can&apos;t submit a round with images left undecided. Once they&apos;re all
            either approved or marked for revision, you&apos;ll see <strong>All caught up</strong> at
            the top of the project.
          </p>
        </Step>

        <Step number={2} title="Click 'Submit round'">
          <p>
            That sends a single digest email to the studio team with all your feedback —
            no scrolling through individual notifications on their side.
          </p>
          <p>
            You&apos;ll get a quick confirmation email so you know it landed.
          </p>
        </Step>

        <Step number={3} title="What happens next">
          <p>
            The studio addresses the revisions and uploads new versions.
            When they&apos;re ready for round 2, you&apos;ll get a fresh email.
            One click → back in the project → repeat.
          </p>
        </Step>
      </Section>
    </>
  );
}
