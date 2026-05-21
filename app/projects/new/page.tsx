"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, clientName: clientName || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed");
      }
      const body = await res.json();
      router.push(`/projects/${body.slug}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-medium tracking-tight mb-1">New project</h1>
        <p className="text-sm text-muted mb-8">
          Projects hold galleries, images, rounds and reviewers.
        </p>
        <form onSubmit={onSubmit} className="surface p-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="AW26 Lookbook"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client">Client (optional)</Label>
            <Input
              id="client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="House of Example"
            />
          </div>
          {error ? <p className="text-xs text-status-revision">{error}</p> : null}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
    </main>
  );
}
