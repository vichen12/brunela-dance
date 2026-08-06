"use client";
import { AutoDireccion } from "@/components/auto-direccion";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AUDIO_BITRATE_KBPS,
  AUDIO_LOCALES,
  MAX_AUDIO_BYTES,
  maxAudioMinutes,
  oversizeMessage
} from "@/src/lib/audio/config";

/** 16 MiB: big enough to keep throughput high, small enough to retry cheaply. */
const CHUNK_SIZE = 16 * 1024 * 1024;
const MAX_CHUNK_RETRIES = 3;

type Ticket = {
  endpoint: string;
  videoId: string;
  libraryId: string;
  expiration: number;
  signature: string;
};

type SignedAudioUpload = { locale: string; path: string; signedUrl: string; token: string };

type Phase = "idle" | "preparing" | "video" | "audio" | "saving" | "done" | "error";

function authHeaders(ticket: Ticket): Record<string, string> {
  // Required on EVERY tus request, not just the create call.
  return {
    AuthorizationSignature: ticket.signature,
    AuthorizationExpire: String(ticket.expiration),
    VideoId: ticket.videoId,
    LibraryId: ticket.libraryId
  };
}

const b64 = (value: string) => btoa(unescape(encodeURIComponent(value)));

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Opens the tus upload and returns the absolute URL to PATCH chunks into. */
async function createUpload(ticket: Ticket, file: File, title: string): Promise<string> {
  const res = await fetch(ticket.endpoint, {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(file.size),
      "Upload-Metadata": `filetype ${b64(file.type || "video/mp4")},title ${b64(title)}`,
      ...authHeaders(ticket)
    }
  });

  if (res.status !== 201) throw new Error(`Bunny rechazo el inicio de la subida (HTTP ${res.status}).`);

  const location = res.headers.get("location");
  if (!location) throw new Error("El servicio de video no devolvió la ubicación de subida.");

  // Bunny answers with a RELATIVE location; resolve it against the endpoint.
  return new URL(location, ticket.endpoint).toString();
}

/** Asks Bunny how many bytes it already holds, so a retry can resume. */
async function currentOffset(uploadUrl: string, ticket: Ticket): Promise<number> {
  const res = await fetch(uploadUrl, {
    method: "HEAD",
    headers: { "Tus-Resumable": "1.0.0", ...authHeaders(ticket) }
  });
  if (res.status !== 200) return 0;
  return Number(res.headers.get("upload-offset") ?? 0);
}

/** XHR (not fetch) because only XHR exposes upload progress events. */
function xhrSend(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Blob,
  expectStatus: (status: number) => boolean,
  onProgress: (bytesSent: number) => void,
  signal: AbortSignal
): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);

    const onAbort = () => xhr.abort();
    signal.addEventListener("abort", onAbort);
    const cleanup = () => signal.removeEventListener("abort", onAbort);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    xhr.onload = () => {
      cleanup();
      if (expectStatus(xhr.status)) resolve(xhr);
      else reject(new Error(`El servidor rechazo la transferencia (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error("Se corto la conexion durante la subida."));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new Error("Subida cancelada."));
    };

    xhr.send(body);
  });
}

const inp: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid #e7e5e4",
  background: "#fff",
  color: "#1c1917",
  padding: "9px 13px",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit"
};
const sel: React.CSSProperties = { ...inp, appearance: "auto" };
const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.09em",
  color: "#78716c",
  textTransform: "uppercase",
  marginBottom: 5
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column" }}>
      <span style={lbl}>{label}</span>
      {children}
    </label>
  );
}

export function AdminVideoUpload() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const videoIdRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [sentBytes, setSentBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [detail, setDetail] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [sizeErrors, setSizeErrors] = useState<Record<string, string>>({});

  const busy = phase === "preparing" || phase === "video" || phase === "audio" || phase === "saving";

  /** Drops the Bunny asset when we fail after creating it but before saving. */
  const abandonRemote = useCallback(async () => {
    const videoId = videoIdRef.current;
    videoIdRef.current = null;
    if (!videoId) return;
    await fetch("/api/admin/videos/abort", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bunnyVideoId: videoId }),
      keepalive: true
    }).catch(() => {});
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  /** Immediate feedback so nobody waits through an upload that will be rejected. */
  const checkSize = useCallback((locale: string, label: string, file: File | undefined) => {
    setSizeErrors((prev) => {
      const next = { ...prev };
      if (file && file.size > MAX_AUDIO_BYTES) next[locale] = oversizeMessage(label, file.size);
      else delete next[locale];
      return next;
    });
  }, []);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy) return;

      const form = event.currentTarget;
      const fd = new FormData(form);
      const videoFile = fd.get("videoFile");

      if (!(videoFile instanceof File) || videoFile.size === 0) {
        setPhase("error");
        setMessage("Tenes que adjuntar el archivo de video.");
        return;
      }

      // Collect the language tracks the admin actually attached.
      const audioFiles: { locale: string; label: string; file: File }[] = [];
      for (const entry of AUDIO_LOCALES) {
        const file = fd.get(`audio_${entry.locale}`);
        if (file instanceof File && file.size > 0) {
          if (file.size > MAX_AUDIO_BYTES) {
            setPhase("error");
            setMessage(oversizeMessage(entry.label, file.size));
            return;
          }
          audioFiles.push({ locale: entry.locale, label: entry.label, file });
        }
      }

      const controller = new AbortController();
      abortRef.current = controller;

      // One progress bar across video + audio, weighted by real bytes.
      const total = videoFile.size + audioFiles.reduce((sum, a) => sum + a.file.size, 0);
      let completed = 0;
      const report = (current: number) => {
        const sent = completed + current;
        setSentBytes(sent);
        setProgress(Math.min(99, Math.round((sent / total) * 100)));
      };

      setPhase("preparing");
      setMessage(null);
      setProgress(0);
      setSentBytes(0);
      setTotalBytes(total);
      setDetail("");

      try {
        const title = String(fd.get("titleEs") ?? "").trim();

        // 1. Server creates the Bunny video and mints a scoped upload ticket.
        const initRes = await fetch("/api/admin/videos/upload-init", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title })
        });
        const initJson = await initRes.json();
        if (!initRes.ok) throw new Error(initJson.error ?? "No se pudo preparar la subida.");

        const ticket: Ticket = initJson.ticket;
        videoIdRef.current = ticket.videoId;

        // 2. Video bytes go browser -> Bunny.
        setPhase("video");
        setDetail("archivo de video");
        const uploadUrl = await createUpload(ticket, videoFile, title || videoFile.name);

        let offset = 0;
        while (offset < videoFile.size) {
          const end = Math.min(offset + CHUNK_SIZE, videoFile.size);
          const chunk = videoFile.slice(offset, end);
          const base = offset;

          let attempt = 0;
          for (;;) {
            try {
              const xhr = await xhrSend(
                "PATCH",
                uploadUrl,
                {
                  "Tus-Resumable": "1.0.0",
                  "Upload-Offset": String(offset),
                  "Content-Type": "application/offset+octet-stream",
                  ...authHeaders(ticket)
                },
                chunk,
                (status) => status === 204,
                (bytesSent) => report(base + bytesSent),
                controller.signal
              );
              offset = Number(xhr.getResponseHeader("upload-offset") ?? offset + chunk.size);
              break;
            } catch (err) {
              if (controller.signal.aborted) throw err;
              attempt += 1;
              if (attempt > MAX_CHUNK_RETRIES) throw err;
              await new Promise((r) => setTimeout(r, 1000 * attempt));
              offset = await currentOffset(uploadUrl, ticket);
              if (offset >= videoFile.size) break;
            }
          }
          report(offset);
        }
        completed = videoFile.size;

        // 3. Audio bytes go browser -> Supabase Storage, one signed URL each.
        if (audioFiles.length > 0) {
          setPhase("audio");
          const audioInit = await fetch("/api/admin/videos/audio-upload-init", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              bunnyVideoId: ticket.videoId,
              locales: audioFiles.map((a) => a.locale),
              sizes: Object.fromEntries(audioFiles.map((a) => [a.locale, a.file.size]))
            })
          });
          const audioJson = await audioInit.json();
          if (!audioInit.ok) throw new Error(audioJson.error ?? "No se pudo preparar la subida de audio.");

          const uploads: SignedAudioUpload[] = audioJson.uploads;

          for (const item of audioFiles) {
            const signed = uploads.find((u) => u.locale === item.locale);
            if (!signed) throw new Error(`Falta la URL de subida para ${item.label}.`);

            setDetail(`audio ${item.label}`);
            await xhrSend(
              "PUT",
              signed.signedUrl,
              { "content-type": item.file.type || "audio/mpeg" },
              item.file,
              (status) => status >= 200 && status < 300,
              (bytesSent) => report(bytesSent),
              controller.signal
            );
            completed += item.file.size;
            report(0);
          }
        }

        // 4. Only metadata goes to our server.
        setPhase("saving");
        setDetail("");
        const finalizeRes = await fetch("/api/admin/videos/finalize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            bunnyVideoId: ticket.videoId,
            audioLocales: audioFiles.map((a) => a.locale),
            slug: fd.get("slug"),
            titleEs: fd.get("titleEs"),
            titleEn: fd.get("titleEn"),
            descriptionEs: fd.get("descriptionEs"),
            descriptionEn: fd.get("descriptionEn"),
            membershipTierRequired: fd.get("membershipTierRequired"),
            status: fd.get("status"),
            // La interfaz habla en minutos; la base guarda segundos.
            durationSeconds: Number(fd.get("durationMinutes") ?? 0) * 60,
            categories: fd.get("categories"),
            equipment: fd.get("equipment"),
            isFeatured: fd.get("isFeatured") === "on"
          })
        });
        const finalizeJson = await finalizeRes.json();
        if (!finalizeRes.ok) {
          videoIdRef.current = null; // finalize already cleaned up Bunny.
          throw new Error(finalizeJson.error ?? "No se pudo guardar la clase.");
        }

        videoIdRef.current = null;
        setProgress(100);
        setPhase("done");
        setMessage(
          finalizeJson.warning ??
            (audioFiles.length > 0
              ? `Clase subida. Los ${audioFiles.length} idiomas extra quedaron en cola de procesamiento.`
              : "Clase subida y guardada. Se está procesando.")
        );
        form.reset();
        setSizeErrors({});
        router.refresh();
      } catch (err) {
        await abandonRemote();
        setPhase("error");
        setMessage(err instanceof Error ? err.message : "Falló la subida y el sistema no devolvió el motivo. Avisale a Vincenzo.");
      } finally {
        abortRef.current = null;
      }
    },
    [busy, abandonRemote, router]
  );

  const phaseLabel: Record<Phase, string> = {
    idle: "",
    preparing: "Preparando la subida...",
    video: `Subiendo ${detail} — ${formatBytes(sentBytes)} / ${formatBytes(totalBytes)}`,
    audio: `Subiendo ${detail} — ${formatBytes(sentBytes)} / ${formatBytes(totalBytes)}`,
    saving: "Guardando la clase...",
    done: "Listo",
    error: "Error"
  };

  const hasSizeError = Object.keys(sizeErrors).length > 0;

  return (
    <form onSubmit={onSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Dirección">
          <input style={inp} name="slug" required placeholder="ballet-centro-basico" disabled={busy} />
          <AutoDireccion desde="titleEs" />
        </Field>
        <Field label="Estado">
          <select style={sel} defaultValue="draft" name="status" disabled={busy}>
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="archived">Archivado</option>
          </select>
        </Field>

        <Field label="Título en español">
          <input style={inp} name="titleEs" required placeholder="Ballet centro basico" disabled={busy} />
        </Field>
        <Field label="Título en inglés">
          <input style={inp} name="titleEn" placeholder="Basic ballet center" disabled={busy} />
        </Field>

        <Field label="Duración (minutos)">
          <input style={inp} defaultValue={15} min={1} name="durationMinutes" required type="number" disabled={busy} />
        </Field>
        <Field label="Plan que la puede ver">
          <select style={sel} defaultValue="corps_de_ballet" name="membershipTierRequired" disabled={busy}>
            <option value="corps_de_ballet">Corps de Ballet</option>
            <option value="solista">Solista</option>
            <option value="principal">Principal</option>
          </select>
        </Field>

        <Field label="Categorías">
          <input style={inp} name="categories" placeholder="ballet, reformer" disabled={busy} />
        </Field>
        <Field label="Materiales">
          <input style={inp} name="equipment" placeholder="colchoneta, banda elastica" disabled={busy} />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <Field label="Descripción en español">
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} name="descriptionEs" required disabled={busy} placeholder="Descripción de la clase…" />
        </Field>
        <Field label="Descripción en inglés">
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} name="descriptionEn" disabled={busy} placeholder="Class description..." />
        </Field>
      </div>

      {/* Video file */}
      <div style={{ marginTop: 14, borderRadius: 12, padding: "16px 18px", background: "#fafaf9", border: "1px solid #f0eeec" }}>
        <span style={lbl}>Archivo de video (obligatorio)</span>
        <input type="file" name="videoFile" accept="video/*" required disabled={busy} style={{ fontSize: 13, marginTop: 6 }} />
        <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 6, lineHeight: 1.6 }}>
          Va del navegador directo a Bunny, sin pasar por el servidor. El audio de este archivo es el
          idioma original (Espanol).
        </p>
      </div>

      {/* Per-language audio */}
      <div style={{ marginTop: 14, borderRadius: 12, padding: "16px 18px", background: "#fafaf9", border: "1px solid #f0eeec" }}>
        <span style={lbl}>Idiomas adicionales (opcional)</span>
        <p style={{ fontSize: 11, color: "#a8a29e", margin: "4px 0 10px", lineHeight: 1.6 }}>
          Un mp3 por idioma, a {AUDIO_BITRATE_KBPS} kbps (hasta {maxAudioMinutes()} minutos, maximo{" "}
          {Math.round(MAX_AUDIO_BYTES / 1024 / 1024)} MB). Se unen al video automaticamente; puede tardar
          una o dos horas. Mientras tanto la clase se ve normal en Espanol.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {AUDIO_LOCALES.map((entry) => (
            <label key={entry.locale} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#78716c", marginBottom: 5 }}>
                {entry.locale.toUpperCase()} {entry.label}
              </span>
              <input
                type="file"
                name={`audio_${entry.locale}`}
                accept="audio/*"
                disabled={busy}
                style={{ fontSize: 12 }}
                onChange={(e) => checkSize(entry.locale, entry.label, e.target.files?.[0])}
              />
              {sizeErrors[entry.locale] && (
                <span style={{ fontSize: 10, color: "#991b1b", marginTop: 5, lineHeight: 1.5 }}>
                  {sizeErrors[entry.locale]}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, cursor: "pointer" }}>
        <input name="isFeatured" type="checkbox" disabled={busy} style={{ width: 16, height: 16, accentColor: "var(--pink-mid)" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#44403c" }}>Destacar este video</span>
      </label>

      {(busy || phase === "done" || phase === "error") && (
        <div
          style={{
            marginTop: 18,
            borderRadius: 14,
            padding: "14px 18px",
            background: phase === "error" ? "#fef2f2" : phase === "done" ? "#f0fdf4" : "var(--pink-wash)",
            border: `1px solid ${phase === "error" ? "#fecaca" : phase === "done" ? "#bbf7d0" : "var(--pink-line)"}`
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.5, color: phase === "error" ? "#991b1b" : phase === "done" ? "#166534" : "var(--pink-mid)" }}>
              {message ?? phaseLabel[phase]}
            </span>
            {(phase === "video" || phase === "audio") && (
              <button type="button" onClick={cancel} style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
                Cancelar
              </button>
            )}
          </div>

          {(phase === "video" || phase === "audio" || phase === "saving" || phase === "done") && (
            <>
              <div style={{ height: 6, background: "var(--pink-soft)", borderRadius: 99, marginTop: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, borderRadius: 99, background: phase === "done" ? "#22c55e" : "linear-gradient(90deg, var(--pink), var(--pink-mid))", transition: "width 0.2s" }} />
              </div>
              <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 6 }}>{progress}%</p>
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <button
          type="submit"
          disabled={busy || hasSizeError}
          style={{
            background: busy || hasSizeError ? "#d6d3d1" : "linear-gradient(135deg, var(--pink), var(--pink-mid))",
            color: "#fff",
            border: "none",
            borderRadius: 99,
            padding: "10px 24px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            cursor: busy || hasSizeError ? "default" : "pointer"
          }}
        >
          {busy ? "SUBIENDO..." : "SUBIR Y CREAR VIDEO"}
        </button>
      </div>
    </form>
  );
}
