import { prisma } from "@/lib/prisma";

export const metadata = {
  robots: { index: false, follow: false },
};

function fmt(date: Date | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [totalProfiles, totalSubs, activeSubs, pendingSubs, pastDueSubs, subscriptions, profiles] = await Promise.all([
    prisma.profile.count(),
    prisma.subscription.count(),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.subscription.count({ where: { status: "pending_payment" } }),
    prisma.subscription.count({ where: { status: "past_due" } }),
    prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
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

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">HSS Admin</h1>
          <p className="text-sm text-gray-500">Panel operativo (MVP free): usuarios, suscripciones y pagos.</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50" type="submit">
            Cerrar sesión
          </button>
        </form>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card label="Perfiles" value={totalProfiles} />
        <Card label="Suscripciones" value={totalSubs} />
        <Card label="Activas" value={activeSubs} accent="text-emerald-600" />
        <Card label="Pendientes" value={pendingSubs} accent="text-amber-600" />
        <Card label="Past due" value={pastDueSubs} accent="text-rose-600" />
      </section>

      <section className="border rounded-xl overflow-hidden">
        <h2 className="px-4 py-3 border-b font-semibold">Suscripciones recientes</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 text-left">
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
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2">{s.email}</td>
                  <td className="px-4 py-2">{s.planId}</td>
                  <td className="px-4 py-2">{s.status}</td>
                  <td className="px-4 py-2">{s.mercadopagoPaymentId ?? "-"}</td>
                  <td className="px-4 py-2">{fmt(s.currentPeriodEnd)}</td>
                  <td className="px-4 py-2">{fmt(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border rounded-xl overflow-hidden">
        <h2 className="px-4 py-3 border-b font-semibold">Usuarios / perfiles recientes</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Rol</th>
                <th className="px-4 py-2">Creado</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-t">
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
    </main>
  );
}

function Card({ label, value, accent = "" }: { label: string; value: number; accent?: string }) {
  return (
    <article className="rounded-xl border p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    </article>
  );
}
