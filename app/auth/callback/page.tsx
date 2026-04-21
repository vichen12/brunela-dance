"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Suspense } from "react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createBrowserClient(url, key);
    const next = searchParams.get("next") ?? "/dashboard";
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

    // Handle both PKCE (?code=) and implicit (#access_token=) flows.
    // createBrowserClient with detectSessionInUrl:true (default) processes
    // whichever is present automatically via onAuthStateChange.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        subscription.unsubscribe();
        window.location.replace(safeNext);
      }
      if (event === "SIGNED_OUT") {
        subscription.unsubscribe();
        window.location.replace("/sign-in?error=" + encodeURIComponent("Error de autenticacion"));
      }
    });

    // Safety timeout — if nothing fires in 8 s, redirect to sign-in
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      window.location.replace("/sign-in?error=" + encodeURIComponent("Tiempo de espera agotado"));
    }, 8000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router, searchParams]);

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
