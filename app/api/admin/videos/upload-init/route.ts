import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/features/auth/guards";
import { hasBunnyStreamEnv } from "@/src/lib/env";
import { createBunnyVideo, createBunnyUploadTicket } from "@/src/lib/video/bunny";

/**
 * Step 1 of the browser-direct upload.
 *
 * Creates the empty video object in Bunny (needs the API key, so it must happen
 * server-side) and hands the browser a short-lived, video-scoped upload ticket.
 * The file bytes never touch this server.
 */
export async function POST(request: Request) {
  await requireAdmin();

  if (!hasBunnyStreamEnv()) {
    return NextResponse.json({ error: "Bunny Stream no esta configurado." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  if (!title) {
    return NextResponse.json({ error: "Falta el titulo del video." }, { status: 400 });
  }

  try {
    const { guid } = await createBunnyVideo(title);
    return NextResponse.json({ ticket: createBunnyUploadTicket(guid) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el video en Bunny.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
