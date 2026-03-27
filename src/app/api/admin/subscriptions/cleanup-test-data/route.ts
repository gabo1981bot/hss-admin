import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request) {
  const secret = process.env.HSS_ADMIN_SYNC_TOKEN || process.env.BILLING_OPS_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const prefixes = ["tenant-cross-", "tenant-gabo-"];

  const subs = await prisma.subscription.findMany({
    where: {
      OR: prefixes.map((p) => ({ mercadopagoPaymentId: { startsWith: p } })),
    },
    select: { id: true, mercadopagoPaymentId: true, appId: true, email: true },
  });

  if (subs.length === 0) {
    return NextResponse.json({ ok: true, matched: 0, deletedEvents: 0, deletedSubscriptions: 0 });
  }

  const ids = subs.map((s) => s.id);

  const [deletedEvents, deletedSubscriptions] = await prisma.$transaction([
    prisma.subscriptionEvent.deleteMany({ where: { subscriptionId: { in: ids } } }),
    prisma.subscription.deleteMany({ where: { id: { in: ids } } }),
  ]);

  return NextResponse.json({
    ok: true,
    matched: subs.length,
    deletedEvents: deletedEvents.count,
    deletedSubscriptions: deletedSubscriptions.count,
    sample: subs.slice(0, 10),
  });
}
