import { NextResponse } from "next/server";
import { z } from "zod";
import { checkLoginLimits, clearLoginFailures, registerLoginFailure } from "@/lib/security/rate-limit";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstileToken: z.string().min(1),
});

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

const ipHits = new Map<string, number[]>();
const emailHits = new Map<string, number[]>();

function getIp(request: Request) {
  const xff = request.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0]?.trim() || "unknown";
}

function consumeSimpleLimit(store: Map<string, number[]>, key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const arr = (store.get(key) ?? []).filter((t) => now - t <= windowMs);
  if (arr.length >= limit) {
    store.set(key, arr);
    return { ok: false, retryAfterMs: windowMs - (now - arr[0]) };
  }
  arr.push(now);
  store.set(key, arr);
  return { ok: true, retryAfterMs: 0 };
}

function retry429(message: string, retryAfterMs: number) {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
      },
    },
  );
}

async function verifyTurnstile(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, message: "Captcha no configurado" };

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (ip && ip !== "unknown") form.set("remoteip", ip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });

  const data = (await response.json().catch(() => null)) as { success?: boolean } | null;
  if (!response.ok || !data?.success) return { ok: false, message: "Captcha inválido" };
  return { ok: true, message: "ok" };
}

export async function POST(request: Request) {
  try {
    const ip = getIp(request);
    const body = bodySchema.parse(await request.json());
    const email = body.email.trim().toLowerCase();

    const ipRate = consumeSimpleLimit(ipHits, `ip:${ip}`, MAX_ATTEMPTS, WINDOW_MS);
    if (!ipRate.ok) return retry429("Demasiados intentos. Probá más tarde.", ipRate.retryAfterMs);

    const emailRate = consumeSimpleLimit(emailHits, `email:${email}`, MAX_ATTEMPTS, WINDOW_MS);
    if (!emailRate.ok) return retry429("Demasiados intentos para este usuario.", emailRate.retryAfterMs);

    const keyPair = `pair:${email}:${ip}`;
    const guard = checkLoginLimits(keyPair);
    if (!guard.ok) {
      return retry429(
        guard.reason === "locked" ? "Cuenta temporalmente bloqueada." : "Esperá unos segundos antes de reintentar.",
        guard.retryAfterMs,
      );
    }

    const turnstile = await verifyTurnstile(body.turnstileToken, ip);
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.message }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: "Auth no configurado" }, { status: 500 });
    }

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseAnon,
        Authorization: `Bearer ${supabaseAnon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password: body.password }),
    });

    const authData = (await authResponse.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
    };

    if (!authResponse.ok || !authData.access_token || !authData.refresh_token) {
      const fail = registerLoginFailure(keyPair);
      if (fail.retryAfterMs > 0) {
        return retry429("Credenciales inválidas o acceso restringido.", fail.retryAfterMs);
      }
      return NextResponse.json({ error: "Credenciales inválidas." }, { status: 401 });
    }

    clearLoginFailures(keyPair);

    return NextResponse.json({
      ok: true,
      session: {
        access_token: authData.access_token,
        refresh_token: authData.refresh_token,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
