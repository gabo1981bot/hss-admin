"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  useEffect(() => {
    if (!turnstileSiteKey || typeof window === "undefined") return;

    const scriptId = "cf-turnstile-script";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    const render = () => {
      const w = window as typeof window & {
        turnstile?: {
          render: (selector: string, options: { sitekey: string; callback: (token: string) => void }) => void;
        };
      };
      if (!w.turnstile) return;
      w.turnstile.render("#turnstile-widget", {
        sitekey: turnstileSiteKey,
        callback: (token: string) => setTurnstileToken(token),
      });
    };

    if (existing) {
      existing.addEventListener("load", render, { once: true });
      render();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [turnstileSiteKey]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!turnstileToken) {
      setLoading(false);
      return setMsg("Completá la verificación de seguridad.");
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password, turnstileToken }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.session?.access_token || !data?.session?.refresh_token) {
        setLoading(false);
        return setMsg(data?.error || "No se pudo iniciar sesión.");
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      setLoading(false);
      if (error) return setMsg(error.message);

      router.push("/admin");
      router.refresh();
    } catch {
      setLoading(false);
      setMsg("No se pudo iniciar sesión.");
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md rounded-xl border p-6">
        <h1 className="text-2xl font-bold">Ingreso Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Acceso restringido para administradores autorizados.</p>

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded-md border px-3 py-2"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-md border px-3 py-2"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div id="turnstile-widget" className="min-h-16" />
          {turnstileSiteKey ? null : <p className="text-xs text-amber-600">Captcha no configurado: definí NEXT_PUBLIC_TURNSTILE_SITE_KEY.</p>}
          <button className="w-full rounded-md border px-3 py-2 font-semibold" type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        {msg ? <p className="mt-3 text-sm text-rose-600">{msg}</p> : null}
      </div>
    </main>
  );
}
