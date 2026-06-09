"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { AdminGuide } from "./guides/admin";
import { ClientGuide } from "./guides/client";
import { PostProdGuide } from "./guides/post-prod";

// Three guides, one per audience. The active tab is determined by the
// current user's role on the server — we hint the default here, the user
// can switch freely. Pure presentational client component.
export function HelpTabs({
  defaultTab,
}: {
  defaultTab: "admin" | "client" | "post-prod";
}) {
  return (
    <Tabs.Root defaultValue={defaultTab} className="animate-rise">
      <Tabs.List
        className="sticky top-16 z-20 -mx-6 px-6 py-3 mb-10 bg-bg/85 backdrop-blur border-b hairline flex items-center gap-2 overflow-x-auto"
        aria-label="Pick a guide"
      >
        <TabTrigger value="admin">For studios</TabTrigger>
        <TabTrigger value="client">For client reviewers</TabTrigger>
        <TabTrigger value="post-prod">For post-production</TabTrigger>
      </Tabs.List>

      <Tabs.Content value="admin">
        <AdminGuide />
      </Tabs.Content>
      <Tabs.Content value="client">
        <ClientGuide />
      </Tabs.Content>
      <Tabs.Content value="post-prod">
        <PostProdGuide />
      </Tabs.Content>
    </Tabs.Root>
  );
}

function TabTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Trigger
      value={value}
      className="press inline-flex items-center h-9 px-4 text-sm font-medium border border-line bg-surface text-muted transition-colors hover:text-ink hover:border-ink/30 data-[state=active]:bg-ink data-[state=active]:text-bg data-[state=active]:border-ink"
    >
      {children}
    </Tabs.Trigger>
  );
}
