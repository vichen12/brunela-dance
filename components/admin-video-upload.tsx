"use client";
import { Desplegable } from "@/components/desplegable";
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
import { SelectorMultiple } from "@/components/selector-multiple";
import { campoSuave, etiquetaSuave } from "@/components/admin-drawer";
import { Film, Languages, UploadCloud } from "lucide-react";
import { SelectorDePlanes } from "@/components/selector-de-planes";
import { BloqueSoloParaVos } from "@/components/bloque-solo-para-vos";
import {
  CATEGORIAS,
  ESTADOS,
  MATERIALES,
  NIVELES,
  PLANES,
  SIN_MATERIAL,
  TIPOS_DE_CONTENIDO
} from "@/src/features/studio/catalogo-clases";

import type { PlanParaElegir } from "@/src/features/admin/planes-de-trabajo";

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

const inp = campoSuave;
const lbl = etiquetaSuave;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column" }}>
      <span style={lbl}>{label}</span>
      {children}
    </label>
  );
}

export function AdminVideoUpload({ programas = [] }: { programas?: PlanParaElegir[] }) {
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

  /**
   * El plan de trabajo al que se engancha la clase, si va a alguno.
   *
   * Es estado y no un campo suelto porque elegir el plan tiene que COMPLETAR el
   * dia: el numero correcto es casi siempre "el siguiente libre", y hacerselo
   * buscar a mano en /admin/programs para despues escribirlo aca es la clase de
   * paso donde se pisa un dia ya ocupado.
   */
  const [programId, setProgramId] = useState("");
  const [programDay, setProgramDay] = useState("");

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
            // getAll y no get: son listas de a una entrada por elegido. Con
            // get() llegaria solo el PRIMER material y el primer plan, y la
            // clase quedaria mas cerrada de lo que se pidio sin avisar.
            planesPermitidos: fd.getAll("planesPermitidos"),
            status: fd.get("status"),
            // La interfaz habla en minutos; la base guarda segundos.
            durationSeconds: Number(fd.get("durationMinutes") ?? 0) * 60,
            contentType: fd.get("contentType"),
            categorySlug: fd.get("categorySlug"),
            nivel: fd.get("nivel"),
            equipment: fd.getAll("equipment"),
            // "" cuando no se eligio ningun plan de trabajo: la clase se sube
            // igual y no se engancha a nada.
            programId: fd.get("programId") || null,
            programDayNumber: fd.get("programDayNumber") || null,
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
        // form.reset() devuelve a su valor inicial los campos del DOM, pero no
        // toca el estado de React: sin estas dos lineas la clase siguiente
        // aparece ya enganchada al plan de la anterior.
        setProgramId("");
        setProgramDay("");
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
    <form onSubmit={onSubmit} className="avu">
      <style>{CSS_SUBIDA}</style>
      {/* 1 y 2 — los dos titulos */}
      <div className="avu-g2">
        <Field label="Título en español">
          <input style={inp} name="titleEs" required placeholder="Ballet centro basico" disabled={busy} />
        </Field>
        <Field label="Título en inglés">
          <input style={inp} name="titleEn" placeholder="Basic ballet center" disabled={busy} />
        </Field>
      </div>

      {/* 3 y 4 — las dos descripciones */}
      <div className="avu-g2" style={{ marginTop: 14 }}>
        <Field label="Descripción en español">
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} name="descriptionEs" required disabled={busy} placeholder="Descripción de la clase…" />
        </Field>
        <Field label="Descripción en inglés">
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} name="descriptionEn" disabled={busy} placeholder="Class description..." />
        </Field>
      </div>

      {/* 5 a 8 — como se clasifica la clase */}
      <div className="avu-g2" style={{ marginTop: 14 }}>
        <Field label="Tipo de contenido">
          <Desplegable
            style={inp}
            defaultValue="clase"
            name="contentType"
            disabled={busy}
            opciones={TIPOS_DE_CONTENIDO.map((t) => ({ value: t.slug, label: t.label }))}
          />
        </Field>
        <Field label="Categoría / Colección">
          <Desplegable
            style={inp}
            defaultValue={CATEGORIAS[0].slug}
            name="categorySlug"
            required
            disabled={busy}
            opciones={CATEGORIAS.map((c) => ({ value: c.slug, label: c.label }))}
          />
        </Field>
        <Field label="Nivel">
          <Desplegable
            style={inp}
            defaultValue="todos"
            name="nivel"
            disabled={busy}
            opciones={NIVELES.map((n) => ({ value: n.slug, label: n.label }))}
          />
        </Field>
        <Field label="Duración (minutos)">
          <input style={inp} defaultValue={15} min={1} name="durationMinutes" required type="number" disabled={busy} />
        </Field>
      </div>

      {/* 9 — materiales */}
      <div style={{ marginTop: 14 }}>
        <span style={lbl}>Materiales</span>
        <SelectorMultiple
          name="equipment"
          opciones={MATERIALES}
          excluyente={SIN_MATERIAL}
          disabled={busy}
          requerido
          mensajeRequerido="Elegí los materiales, o marcá «Sin material»."
        />
      </div>

      {/* La direccion no la escribe nadie: sale sola del titulo en espanol.
          Sigue siendo un campo y no un calculo del servidor porque una clase ya
          publicada no puede cambiar de direccion sin romper los enlaces que
          alguien haya guardado, y eso se ve mejor pudiendo leerla. */}
      <div style={{ marginTop: 14 }}>
        <Field label="Dirección de la clase (se completa sola)">
          <input style={inp} name="slug" required placeholder="ballet-centro-basico" disabled={busy} />
          <AutoDireccion desde="titleEs" />
        </Field>
      </div>

      {/* 10, 11 y 12 — lo que no ve la alumna */}
      <BloqueSoloParaVos>
        <span style={lbl}>Plan que la puede ver</span>
        <SelectorDePlanes
          name="planesPermitidos"
          inicial={PLANES.map((p) => p.slug)}
          disabled={busy}
        />

        <div className="avu-g2" style={{ marginTop: 14 }}>
          <Field label="Estado">
            <Desplegable
              style={inp}
              defaultValue="draft"
              name="status"
              disabled={busy}
              opciones={ESTADOS.map((e) => ({ value: e.slug, label: e.label }))}
            />
          </Field>
        </div>

        {/*
          Agregar la clase a un plan de trabajo (`programs` + `program_days`).

          POR QUE ESTA ACA Y NO SOLO EN /admin/programs
            El plan se arma pensando en el orden de las clases, y ese orden se
            tiene en la cabeza justo cuando se sube el video. Obligar a subir
            aca, ir a la otra pantalla, buscar la clase por su direccion y
            escribir el dia es donde se pierde el hilo -- y donde se escribe un
            dia que ya estaba ocupado.

            Es opcional a proposito: una clase suelta (lo que ve Corps de
            Ballet) no pertenece a ningun plan, y ese es el caso normal.
        */}
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px dashed #E9CFC5" }}>
          <span style={lbl}>Agregar a un plan de trabajo <small className="avu-opc">opcional</small></span>

          {programas.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8A6F68", lineHeight: 1.6, marginTop: 2 }}>
              Todavía no hay ningún plan de trabajo armado. Se crean en{" "}
              <a href="/admin/programs" style={{ color: "var(--pink-deep)", fontWeight: 800 }}>
                Planes de trabajo
              </a>
              , y una vez creados aparecen acá para enganchar la clase directo al subirla.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#8A6F68", lineHeight: 1.6, margin: "2px 0 12px" }}>
                Un plan de trabajo es una serie de días en orden — «Trabajo de pies, 14 días».
                Si esta clase es uno de esos días, elegí cuál.
              </p>
              <div className="avu-g2">
                <Field label="Plan de trabajo">
                  <Desplegable
                    style={inp}
                    name="programId"
                    value={programId}
                    disabled={busy}
                    onChange={(id) => {
                      setProgramId(id);
                      const elegido = programas.find((p) => p.id === id);
                      setProgramDay(elegido ? String(elegido.proximoDia) : "");
                    }}
                    opciones={[
                      { value: "", label: "No agregar a ningún plan" },
                      ...programas.map((p) => ({ value: p.id, label: p.titulo })),
                    ]}
                  />
                </Field>
                <Field label="Día del plan">
                  <input
                    style={{ ...inp, ...(programId ? null : { background: "#FFF2EE", color: "#B39189", borderColor: "#F3E3DC" }) }}
                    type="number"
                    min={1}
                    name="programDayNumber"
                    value={programDay}
                    placeholder="—"
                    required={Boolean(programId)}
                    disabled={busy || !programId}
                    onChange={(e) => setProgramDay(e.target.value)}
                  />
                </Field>
              </div>
              {programId && (
                <p style={{ fontSize: 12.5, color: "#8A6F68", marginTop: 10, lineHeight: 1.55 }}>
                  Si ese día ya tenía otra clase, esta la reemplaza.
                </p>
              )}
            </>
          )}
        </div>
      </BloqueSoloParaVos>

      {/* Video file */}
      <div className="avu-archivo avu-archivo--video">
        <div className="avu-archivo-cab">
          <span className="avu-burbuja" aria-hidden="true"><Film size={19} strokeWidth={2} /></span>
          <span>
            <span className="avu-archivo-tit">Archivo de video <small className="avu-req">obligatorio</small></span>
            <span className="avu-archivo-sub">
              Va del navegador directo a Bunny, sin pasar por el servidor. El audio de este archivo es el
              idioma original (Espanol).
            </span>
          </span>
        </div>
        <label className="avu-file">
          <UploadCloud size={18} strokeWidth={2} aria-hidden="true" className="avu-file-ico" />
          <input type="file" name="videoFile" accept="video/*" required disabled={busy} aria-label="Archivo de video" />
        </label>
      </div>

      {/* Per-language audio */}
      <div className="avu-archivo">
        <div className="avu-archivo-cab">
          <span className="avu-burbuja avu-burbuja--melocoton" aria-hidden="true"><Languages size={19} strokeWidth={2} /></span>
          <span>
            <span className="avu-archivo-tit">Idiomas adicionales <small className="avu-opc">opcional</small></span>
            <span className="avu-archivo-sub">
              Un mp3 por idioma, a {AUDIO_BITRATE_KBPS} kbps (hasta {maxAudioMinutes()} minutos, maximo{" "}
              {Math.round(MAX_AUDIO_BYTES / 1024 / 1024)} MB). Se unen al video automaticamente; puede tardar
              una o dos horas. Mientras tanto la clase se ve normal en Espanol.
            </span>
          </span>
        </div>
        <div className="avu-g3">
          {AUDIO_LOCALES.map((entry) => (
            <label key={entry.locale} className="avu-idioma">
              <span className="avu-idioma-tit">
                <span className="avu-idioma-cod">{entry.locale.toUpperCase()}</span> {entry.label}
              </span>
              <input
                type="file"
                name={`audio_${entry.locale}`}
                accept="audio/*"
                disabled={busy}
                className="avu-file-chico"
                onChange={(e) => checkSize(entry.locale, entry.label, e.target.files?.[0])}
              />
              {sizeErrors[entry.locale] && (
                <span style={{ fontSize: 12, color: "var(--pink-deep)", fontWeight: 700, lineHeight: 1.5 }}>
                  {sizeErrors[entry.locale]}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, cursor: "pointer" }}>
        <input name="isFeatured" type="checkbox" disabled={busy} style={{ width: 18, height: 18, accentColor: "var(--pink)" }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#3B2A2C" }}>Destacar este video</span>
      </label>

      {(busy || phase === "done" || phase === "error") && (
        <div
          style={{
            marginTop: 18,
            borderRadius: 20,
            padding: "16px 20px",
            background: phase === "error" ? "var(--pink-wash)" : phase === "done" ? "var(--salvia, #E7F1E4)" : "#FFF4E8",
            border: `1px solid ${phase === "error" ? "var(--pink-line)" : phase === "done" ? "#CFE3C9" : "#FFE2D3"}`
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.5, color: phase === "error" ? "var(--pink-deep)" : phase === "done" ? "var(--salvia-deep, #3F7A45)" : "#8A4A2E" }}>
              {message ?? phaseLabel[phase]}
            </span>
            {(phase === "video" || phase === "audio") && (
              <button type="button" onClick={cancel} style={{ fontSize: 13, fontWeight: 800, fontFamily: "inherit", color: "var(--pink-deep)", background: "#fff", border: "1.5px solid var(--pink-line)", borderRadius: 99, padding: "6px 14px", cursor: "pointer", flexShrink: 0 }}>
                Cancelar
              </button>
            )}
          </div>

          {(phase === "video" || phase === "audio" || phase === "saving" || phase === "done") && (
            <>
              <div style={{ height: 10, background: "#fff", borderRadius: 99, marginTop: 12, overflow: "hidden", boxShadow: "inset 0 0 0 1px rgba(194,94,58,.12)" }}>
                <div style={{ height: "100%", width: `${progress}%`, borderRadius: 99, background: phase === "done" ? "#6FAF72" : "linear-gradient(90deg, #FFB59A, var(--pink))", transition: "width 0.3s" }} />
              </div>
              <p style={{ fontSize: 12.5, fontWeight: 800, color: "#8A6F68", marginTop: 6 }}>{progress}%</p>
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <button
          type="submit"
          disabled={busy || hasSizeError}
          className="avu-enviar"
        >
          <UploadCloud size={17} strokeWidth={2.2} aria-hidden="true" />
          {busy ? "Subiendo…" : "Subir y crear la clase"}
        </button>
      </div>
    </form>
  );
}

const CSS_SUBIDA = `
.avu { padding-top: 16px; }
.avu input:not([type=checkbox]):not([type=file]):focus, .avu textarea:focus { border-color: var(--pink) !important; box-shadow: 0 0 0 4px rgba(230,79,85,.12); }
.avu-g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
.avu-g3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.avu-opc, .avu-req { margin-left: 6px; font-size: 11.5px; font-weight: 800; padding: 2px 9px; border-radius: 99px; vertical-align: 1px; }
.avu-opc { color: #8A6F68; background: #FFF2EE; }
.avu-req { color: #B03A3E; background: #FDECEC; }
.avu-archivo { margin-top: 16px; border-radius: 24px; border: 1px solid #F3E3DC; background: #fff; padding: 18px 20px 20px; box-shadow: var(--sombra); }
.avu-archivo--video { background: linear-gradient(150deg, #FFF1EC 0%, #fff 70%); }
.avu-archivo-cab { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 14px; }
.avu-archivo-cab > span:last-child { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.avu-burbuja { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; background: #FFF2EE; color: #B03A3E; }
.avu-burbuja--melocoton { background: #FFE2D3; color: #C25E3A; }
.avu-archivo-tit { font-size: 15px; font-weight: 900; color: #3B2A2C; letter-spacing: -0.01em; }
.avu-archivo-sub { font-size: 13px; line-height: 1.55; color: #8A6F68; }
.avu-file {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 18px; cursor: pointer;
  border: 1.5px dashed #E9CFC5; background: #fff; transition: border-color .2s, background .2s;
}
.avu-file:hover { border-color: var(--pink); background: #FFFAF8; }
.avu-file:focus-within { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.12); }
.avu-file-ico { color: var(--pink); flex-shrink: 0; }
.avu .avu-file input[type=file], .avu input.avu-file-chico { min-width: 0; width: 100%; font: inherit; font-size: 13px; color: #8A6F68; border: 0 !important; padding: 0 !important; background: transparent !important; box-shadow: none !important; border-radius: 0 !important; height: auto !important; }
.avu-file input::file-selector-button, .avu-file-chico::file-selector-button {
  margin-right: 12px; padding: 8px 16px; border-radius: 99px; cursor: pointer;
  border: 1.5px solid #E9CFC5; background: #FFF2EE; color: #3B2A2C;
  font: inherit; font-size: 13px; font-weight: 800; transition: background .2s, border-color .2s;
}
.avu-file input::file-selector-button:hover, .avu-file-chico::file-selector-button:hover { background: #FFE2D3; border-color: #FFC9B0; }
.avu-idioma { display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 14px; border-radius: 18px; border: 1px solid #F3E3DC; background: #FFFAF6; cursor: pointer; transition: border-color .2s; }
.avu-idioma:hover { border-color: #E9CFC5; }
.avu-idioma-tit { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 800; color: #3B2A2C; }
.avu-idioma-cod { font-size: 11.5px; font-weight: 900; color: #C25E3A; background: #FFE2D3; padding: 3px 8px; border-radius: 99px; }
.avu-file-chico::file-selector-button { display: block; margin: 0 0 6px; }
.avu-enviar {
  display: inline-flex; align-items: center; gap: 9px; height: 50px; padding: 0 26px; border-radius: 99px; border: none; cursor: pointer;
  background: var(--pink); color: #fff; font: inherit; font-size: 15px; font-weight: 800;
  box-shadow: 0 14px 26px -14px rgba(230,79,85,.85);
  transition: transform .3s cubic-bezier(.22,1,.36,1), background .2s, box-shadow .3s;
}
.avu-enviar:hover:not(:disabled) { background: var(--pink-mid); transform: translateY(-2px); }
.avu-enviar:disabled { background: #F3E3DC; color: #B39189; box-shadow: none; cursor: default; }
@media (max-width: 760px) {
  .avu-g2, .avu-g3 { grid-template-columns: minmax(0, 1fr); }
  .avu-archivo { padding: 16px; }
}
`;
