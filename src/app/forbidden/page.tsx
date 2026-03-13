export default function ForbiddenPage() {
  return (
    <main className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-lg rounded-xl border p-6">
        <h1 className="text-2xl font-bold">Acceso denegado</h1>
        <p className="mt-2 text-sm text-gray-600">
          Tu cuenta está autenticada, pero no está habilitada para el panel admin.
          Pedí que agreguen tu email en la variable <code>ADMIN_EMAILS</code>.
        </p>
      </div>
    </main>
  );
}
