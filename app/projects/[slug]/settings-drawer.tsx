"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string };
};

type Project = {
  id: string;
  slug: string;
  name: string;
  briefUrl: string | null;
  watermarkPreview: boolean;
  status: string;
};

const INVITE_ROLES = [
  { value: "client_reviewer", label: "Client reviewer" },
  { value: "internal_reviewer", label: "Internal reviewer" },
  { value: "post_production", label: "Post-production" },
  { value: "admin", label: "Admin" },
];

export function SettingsDrawer({
  project,
  members,
  canArchive,
  canDelete,
}: {
  project: Project;
  members: Member[];
  // canArchive: org admin/owner — toggle status
  // canDelete: org owner only — destructive
  canArchive: boolean;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline">Settings</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-50 h-full w-full max-w-[420px] bg-bg border-l hairline",
            "shadow-[-12px_0_40px_rgba(0,0,0,0.18)] flex flex-col",
            "data-[state=open]:animate-fade-in"
          )}
          aria-describedby={undefined}
        >
          <header className="flex items-center justify-between px-5 h-14 border-b hairline flex-shrink-0">
            <Dialog.Title className="text-sm font-medium tracking-tight">
              Settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-line/40"
                aria-label="Close settings"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                </svg>
              </button>
            </Dialog.Close>
          </header>

          <div className="flex-1 overflow-y-auto p-5 space-y-8">
            <GeneralSection project={project} onSaved={() => undefined} />
            <MembersSection projectId={project.id} members={members} />
            <ShareSection projectId={project.id} />
            {canArchive || canDelete ? (
              <DangerZone
                project={project}
                canArchive={canArchive}
                canDelete={canDelete}
              />
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── General ──────────────────────────────────────────────────────────────

function GeneralSection({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [briefUrl, setBriefUrl] = useState(project.briefUrl ?? "");
  const [watermark, setWatermark] = useState(project.watermarkPreview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty =
    name.trim() !== project.name ||
    (briefUrl || null) !== (project.briefUrl ?? null) ||
    watermark !== project.watermarkPreview;

  async function save() {
    if (!dirty || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          briefUrl: briefUrl.trim(),
          watermarkPreview: watermark,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed");
      }
      setSavedAt(Date.now());
      router.refresh();
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="text-xs uppercase tracking-wide text-muted mb-3">General</h3>
      <div className="surface p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="proj-name">Project name</Label>
          <Input
            id="proj-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="AW26 Lookbook"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proj-brief">Brief URL</Label>
          <Input
            id="proj-brief"
            type="url"
            value={briefUrl}
            onChange={(e) => setBriefUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
          />
          <p className="text-[11px] text-muted">
            Optional. Linked from the project header so reviewers can reach the brief in one click.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={watermark}
            onChange={(e) => setWatermark(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Watermark preview tier
            <span className="block text-[11px] text-muted mt-0.5">
              Adds a faint "PREVIEW" overlay on review-tier images. Originals stay untouched.
            </span>
          </span>
        </label>
        {error ? <p className="text-xs text-status-revision">{error}</p> : null}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted">
            {savedAt
              ? `Saved`
              : dirty
                ? "Unsaved changes"
                : "Up to date"}
          </span>
          <Button size="sm" onClick={save} disabled={busy || !dirty || !name.trim()}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Members ──────────────────────────────────────────────────────────────

function MembersSection({
  projectId,
  members,
}: {
  projectId: string;
  members: Member[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("client_reviewer");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    setDevLink(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed");
      }
      const body = await res.json();
      if (body.devLink) setDevLink(body.devLink);
      setState("sent");
      setEmail("");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
      setState("idle");
    }
  }

  return (
    <section>
      <h3 className="text-xs uppercase tracking-wide text-muted mb-3">Members</h3>

      <div className="surface divide-y divide-line mb-3">
        {members.map((m) => (
          <MemberRow key={m.id} projectId={projectId} member={m} />
        ))}
      </div>

      <form onSubmit={invite} className="surface p-4 space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted">Invite</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="flex h-9 rounded-md border border-line bg-surface px-3 text-sm"
          >
            {INVITE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="text-xs text-status-revision">{error}</p> : null}
        {state === "sent" ? (
          <p className="text-xs text-status-approved">Invite sent.</p>
        ) : null}
        {devLink ? (
          <div className="border-t hairline pt-3">
            <p className="text-[11px] text-muted mb-1">Dev mode invite link:</p>
            <a href={devLink} className="text-[11px] underline break-all">
              {devLink}
            </a>
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Invite"}
          </Button>
        </div>
      </form>
    </section>
  );
}

// ─── Share links ──────────────────────────────────────────────────────────

// Individual member row with inline admin actions. "Send reset" mails a
// fresh password-reset magic link; "Revoke" removes them from the project.
// Both no-op self-actions (can't revoke yourself) per the API contract.
function MemberRow({ projectId, member }: { projectId: string; member: Member }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"reset" | "revoke" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function sendReset() {
    setBusy("reset");
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members/${member.id}/send-reset`,
        { method: "POST" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed");
      }
      setFeedback("Reset link sent");
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    if (!confirm(`Revoke access for ${member.user.email}?`)) return;
    setBusy("revoke");
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${member.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed");
      }
      router.refresh();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed");
      setBusy(null);
    }
  }

  return (
    <div className="p-3 flex items-center justify-between gap-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{member.user.name ?? member.user.email}</p>
        <p className="text-[11px] text-muted truncate">{member.user.email}</p>
        {feedback ? (
          <p className="text-[11px] text-status-approved mt-1">{feedback}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[11px] text-muted">{member.role.replace(/_/g, " ")}</span>
        <button
          type="button"
          onClick={sendReset}
          disabled={busy !== null}
          className="text-[11px] text-muted hover:text-ink underline underline-offset-4 disabled:opacity-50"
          title="Email a password-reset link"
        >
          {busy === "reset" ? "Sending…" : "Reset"}
        </button>
        <button
          type="button"
          onClick={revoke}
          disabled={busy !== null}
          className="text-[11px] text-status-revision hover:opacity-80 underline underline-offset-4 disabled:opacity-50"
          title="Remove this member's project access"
        >
          {busy === "revoke" ? "…" : "Revoke"}
        </button>
      </div>
    </div>
  );
}

type ShareLinkInfo = {
  id: string;
  scope: string;
  hasPassword: boolean;
  expiresAt: string | null;
  createdAt: string;
  expired: boolean;
};

function ShareSection({ projectId }: { projectId: string }) {
  const [links, setLinks] = useState<ShareLinkInfo[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/share`);
    if (!res.ok) return;
    const body = (await res.json()) as { links: ShareLinkInfo[] };
    setLinks(body.links);
    setLoaded(true);
  }

  // Lazy-load on first open so we don't fetch for users who never expand.
  function maybeLoad() {
    if (!loaded) void load();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreatedUrl(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "project",
          password: password || undefined,
          expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed");
      }
      const body = (await res.json()) as { url: string };
      setCreatedUrl(body.url);
      setPassword("");
      setExpiresInDays("");
      void load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/share-links/${id}`, { method: "DELETE" });
      void load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <details
        className="surface p-4"
        onToggle={(e) => {
          if ((e.target as HTMLDetailsElement).open) maybeLoad();
        }}
      >
        <summary className="cursor-pointer text-sm font-medium select-none flex items-center justify-between">
          <span>Public share links</span>
          <span className="text-[11px] text-muted font-normal">
            {loaded ? `${links?.length ?? 0} active` : "expand"}
          </span>
        </summary>
        <p className="text-[11px] text-muted mt-2 mb-3">
          Read-only preview links for people without an account. Optional
          password and expiry. Token only shown once on creation — copy it now.
        </p>

        {/* Existing links */}
        {loaded && links && links.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {links.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 text-xs border border-line rounded-md px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {l.hasPassword ? "🔒 Password" : "Public"}
                    {l.expired ? " · expired" : ""}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">
                    Created {new Date(l.createdAt).toLocaleDateString()}
                    {l.expiresAt
                      ? ` · expires ${new Date(l.expiresAt).toLocaleDateString()}`
                      : " · no expiry"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revoke(l.id)}
                  disabled={busy}
                  className="text-status-revision hover:bg-status-revision/10 flex-shrink-0"
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {/* Just-created link surface */}
        {createdUrl ? (
          <div className="border border-status-approved/40 bg-status-approved/5 rounded-md p-3 mb-3">
            <p className="text-[11px] font-medium text-status-approved mb-1">
              Link created — copy now, it won't be shown again
            </p>
            <input
              type="text"
              readOnly
              value={createdUrl}
              className="w-full bg-bg text-xs px-2 py-1.5 rounded border border-line font-mono"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        ) : null}

        {/* Create form */}
        {open ? (
          <form onSubmit={create} className="space-y-3 border-t hairline pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="share-pw">Password (optional)</Label>
              <Input
                id="share-pw"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="leave blank for open access"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="share-days">Expires in days (optional)</Label>
              <Input
                id="share-days"
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="never"
              />
            </div>
            {error ? <p className="text-xs text-status-revision">{error}</p> : null}
            <div className="flex items-center justify-end gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Creating…" : "Create link"}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="w-full"
          >
            + Create share link
          </Button>
        )}
      </details>
    </section>
  );
}

// ─── Danger zone ──────────────────────────────────────────────────────────

function DangerZone({
  project,
  canArchive,
  canDelete,
}: {
  project: Project;
  canArchive: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isArchived = project.status === "archived";

  async function setStatus(status: "active" | "archived") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed");
      }
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed");
      }
      // Project no longer exists — navigate back to the dashboard.
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="text-xs uppercase tracking-wide text-status-revision mb-3">
        Danger zone
      </h3>
      <div className="surface p-4 space-y-3 border-status-revision/30">
        {canArchive ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {isArchived ? "Unarchive project" : "Archive project"}
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                {isArchived
                  ? "Bring the project back to the active list."
                  : "Hides the project from the dashboard. All data is preserved and can be restored."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatus(isArchived ? "active" : "archived")}
              disabled={busy}
            >
              {busy ? "…" : isArchived ? "Unarchive" : "Archive"}
            </Button>
          </div>
        ) : null}

        {canDelete ? (
          <div className="flex items-center justify-between gap-3 pt-3 border-t hairline">
            <div>
              <p className="text-sm font-medium">Delete project</p>
              <p className="text-[11px] text-muted mt-0.5">
                Permanently removes the project and every image, version, comment,
                annotation, and stored preview file. This cannot be undone.
              </p>
            </div>
            {confirmDelete ? (
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className="text-[11px] text-status-revision">Are you sure?</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={doDelete}
                    disabled={busy}
                    className="bg-status-revision hover:bg-status-revision/90"
                  >
                    {busy ? "Deleting…" : "Delete forever"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="text-status-revision hover:bg-status-revision/10 border-status-revision/40"
              >
                Delete
              </Button>
            )}
          </div>
        ) : null}

        {error ? <p className="text-xs text-status-revision">{error}</p> : null}
      </div>
    </section>
  );
}
