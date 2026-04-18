import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    GMAIL_CLIENT_ID_len: (process.env.GMAIL_CLIENT_ID ?? "").length,
    GMAIL_CLIENT_ID_first5: (process.env.GMAIL_CLIENT_ID ?? "").slice(0, 5),
    GMAIL_CLIENT_SECRET_len: (process.env.GMAIL_CLIENT_SECRET ?? "").length,
    GMAIL_REFRESH_TOKEN_len: (process.env.GMAIL_REFRESH_TOKEN ?? "").length,
    GMAIL_USER: process.env.GMAIL_USER ?? "MISSING",
    GOOGLE_SHEETS_ID_len: (process.env.GOOGLE_SHEETS_ID ?? "").length,
    NODE_ENV: process.env.NODE_ENV,
  });
}
