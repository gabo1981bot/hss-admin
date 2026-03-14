import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmt(date: Date | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function statusBadge(status: string) {
  if (status === "active") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (status === "pending_payment") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  if (status === "past_due") return "bg-rose-500/20 text-rose-300 border-rose-500/30";
  if (status === "trial") return "bg-sky-500/20 text-sky-300 border-sky-500/30";
  return "bg-slate-500/20 text-slate-300 border-slate-500/30";
}

const validStatuses = ["all", "active", "pending_payment", "past_due", "trial", "canceled"] as const;

type StatusFilter = (typeof validStatuses)[number];

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ cleaned?: string; status?: string; q?: string }>;
}) {
  const params = (await searchParams) || {};
  const status = validStatuses.includes((params.status || "all") as StatusFilter)
    ? ((params.status || "all") as StatusFilter)
    : "all";
  const q = (params.q || "").trim();

  const where: {
    status?: "pending_payment" | "trial" | "active" | "past_due" | "canceled";
    email?: { contains: string; mode: "insensitive" };
  } = {};

  if (status !== "all") {
    where.status = status;
  }

  if (q) {
    where.email = { contains: q, mode: "insensitive" };
  }

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalProfiles,
    totalSubs,
    activeSubs,
    pendingSubs,
    pastDueSubs,
    dueIn7Days,
    subscriptions,
    profiles,
  ] = await Promise.all([
    prisma.profile.count(),
    prisma.subscription.count(),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.subscription.count({ where: { status: "pending_payment" } }),
    prisma.subscription.count({ where: { status: "past_due" } }),
    prisma.subscription.count({
      where: {
        status: "active",
        currentPeriodEnd: { gte: now, lte: in7Days },
      },
    }),
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        email: true,
        planId: true,
        status: true,
        mercadopagoPaymentId: true,
        currentPeriodEnd: true,
        createdAt: true,
      },
    }),
    prisma.profile.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, fullName: true, email: true, role: true, createdAt: true },
    }),
  ]);

  const exportUrl = `/api/admin/subscriptions/export?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`;

  return (
    <main className="min-h-screen bg-[#191923] text-[#fbfef9]">
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-[#232331] p-5">
          <div>
            <h1 className="text-3xl font-black tracking-tight">HSS Admin</h1>
            <p className="mt-1 text-sm text-slate-300">Panel operativo: usuarios, suscripciones y pagos.</p>
          </div>
          <div className="flex gap-2">
            <form action="/api/admin/subscriptions/cleanup-pending" method="post">
              <button
                className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/25"
                type="submit"
              >
                Limpiar pendientes (&gt;24h)
              </button>
            </form>
            <form action="/api/auth/logout" method="post">
              <button
                className="rounded-lg border border-[#0e79b2]/50 bg-[#0e79b2]/15 px-3 py-2 text-sm font-semibold text-[#7dc8ef] hover:bg-[#0e79b2]/25"
                type="submit"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </header>

        {params.cleaned ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            Se limpiaron <strong>{params.cleaned}</strong> suscripciones pendientes antiguas.
          </div>
        ) : null}

        <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card label="Perfiles" value={totalProfiles} />
          <Card label="Suscripciones" value={totalSubs} />
          <Card label="Activas" value={activeSubs} accent="text-emerald-300" />
          <Card label="Pendientes" value={pendingSubs} accent="text-amber-300" />
          <Card label="Past due" value={pastDueSubs} accent="text-rose-300" />
          <Card label="Vencen 7 días" value={dueIn7Days} accent="text-sky-300" />
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#232331] p-4">
          <form className="grid gap-3 md:grid-cols-[220px_1fr_auto_auto]" method="get" action="/admin">
            <select
              name="status"
              defaultValue={status}
              className="rounded-lg border border-white/20 bg-[#191923] px-3 py-2 text-sm outline-none"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="pending_payment">Pendientes</option>
              <option value="past_due">Past due</option>
              <option value="trial">Trial</option>
              <option value="canceled">Canceladas</option>
            </select>
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por email..."
              className="rounded-lg border border-white/20 bg-[#191923] px-3 py-2 text-sm outline-none"
            />
            <button className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/5" type="submit">
              Aplicar filtros
            </button>
            <Link
              href={exportUrl}
              className="rounded-lg border border-[#0e79b2]/50 bg-[#0e79b2]/15 px-4 py-2 text-sm font-semibold text-[#7dc8ef] hover:bg-[#0e79b2]/25"
            >
              Export CSV
            </Link>
          </form>
        </section>

        <section className="border border-white/10 rounded-2xl overflow-hidden bg-[#232331]">
          <h2 className="px-4 py-3 border-b border-white/10 font-semibold">Suscripciones recientes</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-white/5 text-left text-slate-300">
                <tr>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Plan</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2">Payment ID</th>
                  <th className="px-4 py-2">Próx. vencimiento</th>
                  <th className="px-4 py-2">Alta</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id} className="border-t border-white/10">
                    <td className="px-4 py-2">{s.email}</td>
                    <td className="px-4 py-2 uppercase">{s.planId}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadge(s.status)}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">{s.mercadopagoPaymentId ?? "-"}</td>
                    <td className="px-4 py-2">{fmt(s.currentPeriodEnd)}</td>
                    <td className="px-4 py-2">{fmt(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-white/10 rounded-2xl overflow-hidden bg-[#232331]">
          <h2 className="px-4 py-3 border-b border-white/10 font-semibold">Usuarios / perfiles recientes</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-white/5 text-left text-slate-300">
                <tr>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Rol</th>
                  <th className="px-4 py-2">Creado</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="px-4 py-2">{p.fullName}</td>
                    <td className="px-4 py-2">{p.email ?? "-"}</td>
                    <td className="px-4 py-2">{p.role}</td>
                    <td className="px-4 py-2">{fmt(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ label, value, accent = "" }: { label: string; value: number; accent?: string }) {
  return (
    <article className="rounded-xl border border-white/10 bg-[#232331] p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-2xl font-black ${accent}`}>{value}</p>
    </article>
  );
}
