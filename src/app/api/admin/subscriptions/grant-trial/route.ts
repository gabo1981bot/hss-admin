import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin-auth";

const VALID_PLANS = ["inicial", "profesional", "full"] as const;

function parseDays(raw: FormDataEntryValue | null) {
  const days = Number(raw || 0);
  if (!Number.isInteger(days) || days < 1 || days > 90) return null;
  return days;
}

function normalizeEmail(raw: FormDataEntryValue | null) {
  return String(raw || "").trim().toLowerCase();
}

function normalizePlan(raw: FormDataEntryValue | null) {
  const plan = String(raw || "").trim().toLowerCase();
  if (!VALID_PLANS.includes(plan as (typeof VALID_PLANS)[number])) return null;
  return plan as (typeof VALID_PLANS)[number];
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function POST(request: Request) {
  try {
    const { email: adminEmail } = await requireAdminUser();
    const formData = await request.formData();

    const email = normalizeEmail(formData.get("email"));
    const plan = normalizePlan(formData.get("plan"));
    const days = parseDays(formData.get("days"));
    const reason = String(formData.get("reason") || "").trim() || "manual_trial";

    if (!email || !plan || !days) {
      return NextResponse.redirect(new URL("/admin?err=invalid_trial_input", request.url));
    }

    const now = new Date();
    const trialEndsAt = addDays(now, days);

    const existing = await prisma.subscription.findFirst({
      where: { email, appId: "hss_taller" },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: existing.id },
          data: {
            planId: plan,
            status: "trial",
            startedAt: now,
            trialEndsAt,
            currentPeriodEnd: trialEndsAt,
          },
        }),
        prisma.subscriptionEvent.create({
          data: {
            subscriptionId: existing.id,
            source: "admin",
            eventType: "manual_trial_granted",
            payload: { days, reason, actor: adminEmail },
          },
        }),
      ]);

      return NextResponse.redirect(new URL("/admin?ok=trial_updated", request.url));
    }

    const subscriptionId = randomUUID();

    await prisma.$transaction([
      prisma.subscription.create({
        data: {
          id: subscriptionId,
          appId: "hss_taller",
          email,
          planId: plan,
          status: "trial",
          startedAt: now,
          trialEndsAt,
          currentPeriodEnd: trialEndsAt,
        },
      }),
      prisma.subscriptionEvent.create({
        data: {
          id: randomUUID(),
          subscriptionId,
          source: "admin",
          eventType: "manual_trial_granted",
          payload: { days, reason, actor: adminEmail },
        },
      }),
    ]);

    return NextResponse.redirect(new URL("/admin?ok=trial_created", request.url));
  } catch {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }
}
