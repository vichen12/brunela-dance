"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Suspense } from "react";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const [debug, setDebug] = useState<string>("Procesando...");

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const next = searchParams.get("next") ?? "/dashboard";
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

    const code = searchParams.get("code");
    const hash = window.location.hash;
    const allParams = Object.fromEntries(searchParams);

    setDebug(
      `PARAMS: ${JSON.stringify(allParams)}\n` +
      `CODE: ${code ? code.slice(0, 20) + "..." : "ninguno"}\n` +
      `HASH: ${hash ? hash.slice(0, 60) + "..." : "ninguno"}`
    );

    async function handleCallback() {
      const supabase = createBrowserClient(supabaseUrl, supabaseKey);

      if (code) {
        setDebug((d) => d + "\n\nIntentando exchangeCodeForSession...");
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setDebug((d) => d + "\nERROR: " + error.message);
          setTimeout(() => {
            window.location.replace("/sign-in?error=" + encodeURIComponent("Error: " + error.message));
          }, 5000);
          return;
        }
        window.location.replace(safeNext);
        return;
      }

      if (hash && hash.includes("access_token")) {
        setDebug((d) => d + "\n\nHash con access_token detectado, llamando getSession...");
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          setDebug((d) => d + "\nERROR: " + (error?.message ?? "sin sesion"));
          setTimeout(() => {
            window.location.replace("/sign-in?error=" + encodeURIComponent("Error de autenticacion con Google"));
          }, 5000);
          return;
        }
        window.location.replace(safeNext);
        return;
      }

      setDebug((d) => d + "\n\nNi code ni hash encontrado. Redirigiendo en 5s...");
      setTimeout(() => {
        window.location.replace("/sign-in?error=" + encodeURIComponent("No se recibio respuesta de Google"));
      }, 5000);
    }

    handleCallback();
  }, [searchParams]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "1.5rem",
        background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
        padding: "2rem",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "3px solid #fce7f3",
          borderTopColor: "#be185d",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <pre
        style={{
          background: "#1c1917",
          color: "#f0e4ee",
          padding: "1rem 1.5rem",
          borderRadius: 12,
          fontSize: "0.75rem",
          lineHeight: 1.7,
          maxWidth: 600,
          width: "100%",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {debug}
      </pre>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
