import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-3xl font-bold">HSS Admin</h1>
        <p className="text-sm text-gray-600">Base del panel de administración. Entrá al dashboard operativo.</p>
        <Link href="/admin" className="inline-flex rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
          Ir al panel
        </Link>
      </div>
    </main>
  );
}
