export type Tool = "cursor" | "pin" | "rect" | "draw";

export type Geom =
  | { x: number; y: number }
  | { x: number; y: number; w: number; h: number }
  | { x1: number; y1: number; x2: number; y2: number }
  | { points: { x: number; y: number }[] };

export type Annotation = {
  id: string;
  commentId: string | null;
  shape: "pin" | "rect" | "arrow" | "freehand";
  geom: string; // JSON-encoded Geom
  color: string;
};

export type Comment = {
  id: string;
  body: string;
  visibility: "client" | "internal";
  createdAt: string;
  parentId: string | null;
  author: { id: string; email: string; name: string | null };
  annotations: Annotation[];
  replies: Reply[];
};

export type Reply = {
  id: string;
  body: string;
  visibility: "client" | "internal";
  createdAt: string;
  parentId: string;
  author: { id: string; email: string; name: string | null };
};

export type ImageInfo = {
  id: string;
  slotName: string;
  subjectKey: string | null;
  viewLabel: string | null;
  filenameOriginal: string;
  displayName: string | null;
  status: string;
  width: number;
  height: number;
  previewPath: string;
  versionId: string;
  versionNumber: number;
};

export type SiblingView = {
  id: string;
  viewLabel: string | null;
  href: string;
};

export type VersionEntry = {
  versionNumber: number;
  isCurrent: boolean;
  isActive: boolean;
  href: string;
  // null if comparison would be against self or only one version exists
  compareHref: string | null;
};

export type CompareData = {
  versionNumber: number;
  previewPath: string;
  width: number;
  height: number;
  annotations: { id: string; shape: string; geom: string; color: string }[];
  exitHref: string;
};

export type Role = "admin" | "internal_reviewer" | "client_reviewer" | "post_production";

export type PendingDraft =
  | { kind: "pin"; geom: { x: number; y: number } }
  | { kind: "rect"; geom: { x: number; y: number; w: number; h: number } }
  | { kind: "freehand"; geom: { points: { x: number; y: number }[] } };
