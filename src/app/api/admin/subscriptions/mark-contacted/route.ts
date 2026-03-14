import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    await requireAdminUser();
    const formData = await request.formData();
    const subscriptionId = String(formData.get("subscriptionId") || "");

    if (!subscriptionId) {
      return NextResponse.redirect(new URL("/admin?err=missing_subscription", request.url));
    }

    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscriptionId },
        data: { contactedAt: new Date() },
      }),
      prisma.subscriptionEvent.create({
        data: {
          subscriptionId,
          source: "admin",
          eventType: "marked_contacted",
          payload: { via: "admin_panel" },
        },
      }),
    ]);

    return NextResponse.redirect(new URL("/admin?ok=contacted", request.url));
  } catch {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }
}
