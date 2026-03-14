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

    const where: {
      status?: "pending_payment" | "trial" | "active" | "past_due" | "canceled";
      email?: { contains: string; mode: "insensitive" };
    } = {};

    if (["pending_payment", "trial", "active", "past_due", "canceled"].includes(status)) {
      where.status = status as "pending_payment" | "trial" | "active" | "past_due" | "canceled";
    }

    if (q) {
      where.email = { contains: q, mode: "insensitive" };
    }

    const rows = await prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: {
        id: true,
        email: true,
        planId: true,
        status: true,
        mercadopagoPaymentId: true,
        currentPeriodEnd: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const header = [
      "subscription_id",
      "email",
      "plan",
      "status",
      "mercadopago_payment_id",
      "current_period_end",
      "created_at",
      "updated_at",
    ].join(",");

    const lines = rows.map((r) =>
      [
        csvEscape(r.id),
        csvEscape(r.email),
        csvEscape(r.planId),
        csvEscape(r.status),
        csvEscape(r.mercadopagoPaymentId),
        csvEscape(r.currentPeriodEnd?.toISOString()),
        csvEscape(r.createdAt.toISOString()),
        csvEscape(r.updatedAt.toISOString()),
      ].join(","),
    );

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
