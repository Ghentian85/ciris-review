import { Section, Step } from "@/components/help/step";

// Post-production guide. Audience: retouchers. Tone: practical, terse,
// assume they know their craft — focus on how the platform tracks the work.
export function PostProdGuide() {
  return (
    <>
      <Section eyebrow="Finding your work" title="Where revisions live">
        <Step
          number={1}
          title="Open the Work inbox"
          screenshot={{
            src: "postprod-01-work-inbox.png",
            alt: "Work inbox with projects waiting for revisions",
            caption: "Top nav → Work. Every project with open revisions, ordered by urgency.",
          }}
        >
          <p>
            Click <strong>Work</strong> in the top nav. You&apos;ll see every project where you&apos;re a member
            and there&apos;s feedback waiting. The badge on each row shows how many revisions
            and how many approval-with-notes items are open.
          </p>
        </Step>

        <Step number={2} title="Jump straight into the right tab">
          <p>
            Clicking a row in the inbox lands you on the project&apos;s <strong>Needs revision</strong> tab
            — only the images you actually have to touch. No scrolling past green approvals.
          </p>
        </Step>
      </Section>

      <Section eyebrow="Working through" title="Per‑image workflow">
        <Step
          number={1}
          title="Open an image and read the comments"
          screenshot={{
            src: "postprod-02-reviewer-rail.png",
            alt: "Reviewer with client comments stacked in the right rail",
            caption: "Right rail = the client's full feedback for this image.",
          }}
        >
          <p>
            Each comment shows the marker on the image plus the client&apos;s text. Hovering a
            comment in the rail highlights its marker — useful when the client left several
            notes on the same area.
          </p>
        </Step>

        <Step
          number={2}
          title="Mark a comment done as you address it"
          screenshot={{
            src: "postprod-03-done-checkbox.png",
            alt: "Resolved comment greyed out with strikethrough",
            caption: "Square checkbox on the right of each comment. Click to mark done.",
          }}
        >
          <p>Each comment has a small <strong>square checkbox</strong> on the right.</p>
          <ul>
            <li>Click it → the comment greys out, gets a strikethrough, and a green ✓ shows up</li>
            <li>The section header counts your progress: <strong>Comments (5) ● 3 done</strong></li>
            <li>Click again to unmark — useful if you realise you missed a detail</li>
          </ul>
          <p>
            The done state is shared with admins, so anyone checking the project can see how far along you are without asking.
          </p>
        </Step>

        <Step number={3} title="Internal comments are visible only to you and the studio">
          <p>
            Right rail comments that look slightly different (with an <code>internal</code> tag) are
            internal notes — between you, admins, and the studio. Clients never see them.
          </p>
          <p>
            Use them for back-and-forth that doesn&apos;t belong in the client digest
            (technical questions, asset gaps, etc.).
          </p>
        </Step>
      </Section>

      <Section eyebrow="Delivery" title="Uploading v2">
        <Step
          number={1}
          title="Re‑export the corrected image"
          screenshot={{
            src: "postprod-04-filename.png",
            alt: "File on disk with the same filename as v1",
            caption: "Same slot name in the filename → automatic match to the original image.",
          }}
        >
          <p>
            Keep the <strong>same filename</strong> as the original (or at least the same slot prefix —
            e.g. <code>LOOK_03_A</code>). The platform parses the slot from the filename and
            matches it to the existing image.
          </p>
        </Step>

        <Step
          number={2}
          title="Drop the file on the project's Upload screen"
          screenshot={{
            src: "postprod-05-upload.png",
            alt: "Upload screen with v2 file being uploaded",
            caption: "Drop the file. The platform sees the matching slot and creates a new version.",
          }}
        >
          <p>
            From the project hero, click <strong>Upload images</strong>. Drag the v2 file in. The platform:
          </p>
          <ul>
            <li>Sees the matching slot</li>
            <li>Creates a new version (<strong>V2</strong>) under the existing image</li>
            <li>Flips the image status back to <strong>Pending</strong> so the client re‑reviews</li>
            <li>Keeps your &quot;done&quot; markers on the V1 comments — they don&apos;t reset</li>
          </ul>
        </Step>

        <Step number={3} title="When the client comes back">
          <p>
            You&apos;ll get a fresh digest email summarising round 2. Repeat: open the
            project, read the comments, retouch, upload V3. The pattern stays the
            same regardless of how many rounds it takes.
          </p>
        </Step>
      </Section>

      <Section eyebrow="Comparing" title="Version comparison">
        <Step
          number={1}
          title="See V1 and V2 side by side"
          screenshot={{
            src: "postprod-06-compare.png",
            alt: "Compare mode showing V1 left, V2 right",
            caption: "Compare V1 ↔ V2 side by side. Synced zoom + pan across both panes.",
          }}
        >
          <p>
            On any image with more than one version, click the <strong>Compare</strong> link in the
            version switcher (right rail). You get two panes side by side with synced
            zoom and pan — useful for showing the studio what changed.
          </p>
        </Step>
      </Section>
    </>
  );
}
