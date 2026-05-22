import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_ENDPOINT: process.env.S3_ENDPOINT ? "set" : "missing",
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ? "set" : "missing",
    S3_SECRET_KEY: process.env.S3_SECRET_KEY ? "set" : "missing",
    NODE_ENV: process.env.NODE_ENV,
  });
}
