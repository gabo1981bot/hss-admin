import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin-auth";

function csvEscape(value: string | null | undefined) {
  const safe = (value ?? "").replace(/"/g, '""');
  return `"${safe}"`;
}

export async function GET(request: Request) {
  try {
    await requireAdminUser();

    const url = new URL(request.url);
    const status = (url.searchParams.get("status") || "all").toLowerCase();
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const app = (url.searchParams.get("app") || "hss_taller").trim();
    const preset = (url.searchParams.get("preset") || "").trim();

    const where: {
      appId?: string;
      status?: "pending_payment" | "trial" | "active" | "past_due" | "canceled";
      email?: { contains: string; mode: "insensitive" };
      createdAt?: { lte?: Date };
      currentPeriodEnd?: { gte?: Date; lte?: Date };
    } = { appId: app || "hss_taller" };

    if (["pending_payment", "trial", "active", "past_due", "canceled"].includes(status)) {
      where.status = status as "pending_payment" | "trial" | "active" | "past_due" | "canceled";
    }

    if (q) {
      where.email = { contains: q, mode: "insensitive" };
    }

    if (preset === "pending_48h") {
      where.status = "pending_payment";
      where.createdAt = { lte: new Date(Date.now() - 48 * 60 * 60 * 1000) };
    }

    if (preset === "due_7d") {
      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      where.status = "active";
      where.currentPeriodEnd = { gte: now, lte: in7Days };
    }

    const rows = await prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: {
        id: true,
        appId: true,
        email: true,
        planId: true,
        status: true,
        mercadopagoPaymentId: true,
        currentPeriodEnd: true,
        contactedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const header = [
      "subscription_id",
      "app_id",
      "email",
      "plan",
      "status",
      "mercadopago_payment_id",
      "current_period_end",
      "days_past_due",
      "contacted_at",
      "created_at",
      "updated_at",
    ].join(",");

    const lines = rows.map((r) => {
      const daysPastDue =
        r.status === "past_due" && r.currentPeriodEnd
          ? Math.max(1, Math.floor((Date.now() - r.currentPeriodEnd.getTime()) / (24 * 60 * 60 * 1000)))
          : 0;

      return [
        csvEscape(r.id),
        csvEscape(r.appId),
        csvEscape(r.email),
        csvEscape(r.planId),
        csvEscape(r.status),
        csvEscape(r.mercadopagoPaymentId),
        csvEscape(r.currentPeriodEnd?.toISOString()),
        csvEscape(daysPastDue ? String(daysPastDue) : ""),
        csvEscape(r.contactedAt?.toISOString()),
        csvEscape(r.createdAt.toISOString()),
        csvEscape(r.updatedAt.toISOString()),
      ].join(",");
    });

    const csv = [header, ...lines].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=subscriptions-export.csv",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }
}
