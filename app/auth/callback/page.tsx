"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Suspense } from "react";

function CallbackHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const next = searchParams.get("next") ?? "/dashboard";
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    const errorParam = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");
    const code = searchParams.get("code");
    const hash = window.location.hash;

    // Show debug info on screen for 8 seconds before redirecting
    const debugEl = document.getElementById("debug-info");
    const show = (msg: string) => { if (debugEl) debugEl.textContent = msg; };

    async function handleCallback() {
      const info = `error=${errorParam ?? "ninguno"}\nerror_desc=${errorDesc ?? "ninguno"}\ncode=${code ? code.slice(0,12)+"..." : "ninguno"}\nhash=${hash ? hash.slice(0,50)+"..." : "ninguno"}`;
      show(info);

      await new Promise((r) => setTimeout(r, 8000));

      if (errorParam) {
        window.location.replace(
          "/sign-in?error=" + encodeURIComponent(errorDesc ?? "Error de autenticacion con Google")
        );
        return;
      }

      const supabase = createBrowserClient(supabaseUrl, supabaseKey);

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        show(info + `\n\nexchangeCode error=${error?.message ?? "ninguno"}`);
        await new Promise((r) => setTimeout(r, 5000));
        if (error) {
          window.location.replace("/sign-in?error=" + encodeURIComponent("Error de autenticacion con Google"));
          return;
        }
        window.location.replace(safeNext);
        return;
      }

      if (hash && hash.includes("access_token")) {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          window.location.replace("/sign-in?error=" + encodeURIComponent("Error de autenticacion con Google"));
          return;
        }
        window.location.replace(safeNext);
        return;
      }

      window.location.replace("/sign-in?error=" + encodeURIComponent("Error de autenticacion con Google"));
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
        gap: "1rem",
        background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
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
      <p style={{ fontSize: "0.85rem", color: "#9d8a98" }}>Iniciando sesion...</p>
      <pre id="debug-info" style={{ background: "#1c1917", color: "#f0e4ee", padding: "1rem", borderRadius: 8, fontSize: "0.7rem", maxWidth: 560, width: "100%", whiteSpace: "pre-wrap", wordBreak: "break-all" }} />
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
