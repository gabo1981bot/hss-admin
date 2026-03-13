import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    await requireAdminUser();

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.subscription.deleteMany({
      where: {
        status: "pending_payment",
        createdAt: { lt: cutoff },
      },
    });

    const back = new URL(request.url);
    const redirectUrl = new URL(`/admin?cleaned=${result.count}`, back.origin);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }
}
