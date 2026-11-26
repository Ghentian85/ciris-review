"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Fields = {
  brandBlurb: string;
  audience: string;
  stylingNotes: string;
  fitNotes: string;
  cameraNotes: string;
  lightingNotes: string;
  shadowNotes: string;
  colourNotes: string;
  formatNotes: string;
  whitespaceNotes: string;
  deliverySpecs: string;
};

const SECTIONS: Array<{
  group: string;
  items: Array<{ key: keyof Fields; label: string; hint: string; rows: number }>;
}> = [
  {
    group: "Who they are",
    items: [
      { key: "brandBlurb", label: "About the brand", hint: "Where they stand, what they do, the world they're in.", rows: 4 },
      { key: "audience", label: "Target audience", hint: "Who the pictures are for.", rows: 2 },
    ],
  },
  {
    group: "Styling",
    items: [
      { key: "stylingNotes", label: "Styling notes", hint: "Bows tied, laces laced, how many buttons open, sleeve layout…", rows: 5 },
      { key: "fitNotes", label: "Fit", hint: "How tight or loose each piece is styled.", rows: 3 },
    ],
  },
  {
    group: "Technical",
    items: [
      { key: "cameraNotes", label: "Camera", hint: "Angles, focal length, standpoints.", rows: 3 },
      { key: "lightingNotes", label: "Lighting", hint: "Light setup.", rows: 3 },
      { key: "shadowNotes", label: "Shadow", hint: "How shadows are handled.", rows: 2 },
      { key: "colourNotes", label: "Warmth &amp; colour", hint: "Colour targets (e.g. diamond tone — grey vs blue, gold hue).", rows: 3 },
    ],
  },
  {
    group: "Finishing",
    items: [
      { key: "formatNotes", label: "Formats", hint: "Deliverable formats.", rows: 2 },
      { key: "whitespaceNotes", label: "Whitespace", hint: "Canvas whitespace rules.", rows: 2 },
      { key: "deliverySpecs", label: "Delivery specs", hint: "File type, size, naming…", rows: 3 },
    ],
  },
];

export function PackshotIdForm({
  clientId,
  initial,
}: {
  clientId: string;
  initial: Fields;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Fields>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Fields>(key: K, value: string) {
    setValues((cur) => ({ ...cur, [key]: value }));
    setState("idle");
  }

  async function save() {
    setState("saving");
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/packshot-id`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setState("saved");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
      setState("idle");
    }
  }

  return (
    <div className="space-y-10">
      {SECTIONS.map((section) => (
        <section key={section.group}>
          <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted mb-4 border-b hairline pb-3">
            {section.group}
          </h2>
          <div className="space-y-5">
            {section.items.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{f.label}</Label>
                <textarea
                  id={f.key}
                  rows={f.rows}
                  value={values[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="w-full border border-line bg-surface px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:border-ink/40"
                />
                <p className="text-[11px] text-muted-soft">{f.hint}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-0 bg-bg/95 backdrop-blur border-t hairline py-4 flex items-center justify-between -mx-6 px-6">
        <span className="text-xs text-muted">
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : error ? error : ""}
        </span>
        <Button onClick={save} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
