import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/features/auth/guards";
import { deleteBunnyVideo } from "@/src/lib/video/bunny";

/**
 * Cleanup for an upload that died between "video created in Bunny" and
 * "catalog row written": cancelled by the admin, network drop, closed tab.
 *
 * Without this, every failed attempt leaves a half-uploaded asset in the Bunny
 * library that nothing references and that still costs storage.
 *
 * deleteBunnyVideo is best-effort by design, so this endpoint always reports
 * success -- a failed cleanup must not block the admin from retrying.
 */
export async function POST(request: Request) {
  await requireAdmin();

  const body = await request.json().catch(() => null);
  const bunnyVideoId = typeof body?.bunnyVideoId === "string" ? body.bunnyVideoId : "";

  if (!bunnyVideoId) {
    return NextResponse.json({ error: "Falta bunnyVideoId." }, { status: 400 });
  }

  await deleteBunnyVideo(bunnyVideoId);
  return NextResponse.json({ ok: true });
}
