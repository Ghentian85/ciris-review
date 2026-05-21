import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().default("file:./prisma/dev.db"),
  STORAGE_DIR: z.string().default("./data"),
  APP_URL: z.string().default("http://localhost:3001"),
  AUTH_SECRET: z.string().min(16).default("dev-secret-please-change-32chars-min-aaa"),
  EMAIL_FROM: z.string().default("CIRIS Review <noreply@ciris.local>"),
  EMAIL_REPLY_TO: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
});

export const env = (() => {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    return {
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
      STORAGE_DIR: process.env.STORAGE_DIR ?? "./data",
      APP_URL: process.env.APP_URL ?? "http://localhost:3001",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-secret-please-change-32chars-min-aaa",
      EMAIL_FROM: process.env.EMAIL_FROM ?? "CIRIS Review <noreply@ciris.local>",
      EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO ?? "",
      RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
    };
  }
  return parsed.data;
})();
