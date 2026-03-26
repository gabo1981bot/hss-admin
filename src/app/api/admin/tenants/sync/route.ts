import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

type SyncPayload = {
  module?: string;
  tenantId?: string;
  tenantCode?: string;
  tenantName?: string;
  ownerEmail?: string;
  planCode?: string;
  status?: string;
  eventType?: string;
  syncedAt?: string;
};

function mapPlan(planCode: string): SubscriptionPlan {
  const p = planCode.toLowerCase();
  if (p === "full") return "full";
  if (p === "profesional" || p === "professional" || p === "pro") return "profesional";
  return "inicial";
}

function mapStatus(status: string): SubscriptionStatus {
  const s = status.toLowerCase();
  if (s === "active" || s === "approved") return "active";
  if (s === "trial") return "trial";
  if (s === "past_due") return "past_due";
  if (s === "canceled" || s === "cancelled") return "canceled";
  return "pending_payment";
}

function canonicalEventType(payload: SyncPayload): string {
  if (payload.eventType && payload.eventType.includes(".")) return payload.eventType;

  const s = (payload.status || "").toLowerCase();
  if (s === "active" || s === "approved") return "subscription.activated";
  if (s === "trial") return "subscription.trial.started";
  if (s === "past_due") return "subscription.past_due";
  if (s === "canceled" || s === "cancelled") return "subscription.canceled";
  return "subscription.updated";
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const expectedToken = process.env.HSS_ADMIN_SYNC_TOKEN || process.env.BILLING_OPS_SECRET;
  if (!expectedToken) return unauthorized();

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token !== expectedToken) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as SyncPayload;
  const moduleName = (body.module || "").toLowerCase();
  const tenantId = (body.tenantId || "").trim();
  const ownerEmail = (body.ownerEmail || "").toLowerCase().trim();

  if (!tenantId || !ownerEmail) {
    return NextResponse.json({ ok: false, error: "tenantId y ownerEmail son obligatorios" }, { status: 400 });
  }

  const appId = moduleName === "market" ? "hss_market" : `hss_${moduleName || "unknown"}`;
  const planId = mapPlan(body.planCode || "starter");
  const subStatus = mapStatus(body.status || "active");

  const existing = await prisma.subscription.findFirst({
    where: {
      appId,
      mercadopagoPaymentId: tenantId,
    },
  });

  const startsAt = body.syncedAt ? new Date(body.syncedAt) : new Date();
  const eventType = canonicalEventType(body);

  const subscription = existing
    ? await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          email: ownerEmail,
          planId,
          status: subStatus,
          startedAt: existing.startedAt || startsAt,
          currentPeriodEnd: existing.currentPeriodEnd,
        },
      })
    : await prisma.subscription.create({
        data: {
          appId,
          email: ownerEmail,
          planId,
          status: subStatus,
          mercadopagoPaymentId: tenantId,
          startedAt: startsAt,
        },
      });

  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId: subscription.id,
      source: "hss_market_sync",
      eventType,
      externalId: tenantId,
      payload: body,
    },
  });

  return NextResponse.json({
    ok: true,
    appId,
    subscriptionId: subscription.id,
    tenantId,
    ownerEmail,
  });
}
