"use client";

type Props = {
  subscriptionId: string;
  email: string;
  planId: string;
  status: string;
  contactedAt: Date | null;
  payLink: string;
};

function ask(message: string) {
  if (typeof window === "undefined") return false;
  return window.confirm(message);
}

export function SubscriptionActions({ subscriptionId, email, planId, status, contactedAt, payLink }: Props) {
  const confirmOpenPayLink = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!ask(`Vas a abrir el link de pago para ${email}.\n\nSe abrirá Mercado Pago con el plan ${planId.toUpperCase()}.\n\n¿Querés continuar?`)) {
      e.preventDefault();
    }
  };

  const confirmMarkContact = (e: React.FormEvent<HTMLFormElement>) => {
    const action = contactedAt ? "actualizar la marca de contactado" : "marcar este cliente como contactado";
    if (!ask(`Vas a ${action} para ${email}.\n\n¿Estás seguro?`)) {
      e.preventDefault();
    }
  };

  const confirmGrantTrial = (e: React.FormEvent<HTMLFormElement>) => {
    if (!ask(`Vas a otorgar 7 días de trial a ${email} (plan ${planId.toUpperCase()}).\n\n¿Querés continuar?`)) {
      e.preventDefault();
    }
  };

  const confirmReactivate = (e: React.FormEvent<HTMLFormElement>) => {
    if (!ask(`Vas a reactivar la suscripción de ${email}.\n\n¿Confirmás esta acción?`)) {
      e.preventDefault();
    }
  };

  return (
    <div className="flex flex-wrap gap-1">
      <a
        href={payLink}
        target="_blank"
        rel="noreferrer"
        onClick={confirmOpenPayLink}
        className="cursor-pointer rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-xs text-sky-300"
      >
        Link pago
      </a>

      <form action="/api/admin/subscriptions/mark-contacted" method="post" onSubmit={confirmMarkContact}>
        <input type="hidden" name="subscriptionId" value={subscriptionId} />
        <button className="cursor-pointer rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300" type="submit">
          {contactedAt ? "Contactado" : "Marcar contacto"}
        </button>
      </form>

      <form action="/api/admin/subscriptions/grant-trial" method="post" onSubmit={confirmGrantTrial}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="plan" value={planId} />
        <input type="hidden" name="days" value="7" />
        <input type="hidden" name="reason" value="support_trial" />
        <button className="cursor-pointer rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-2 py-1 text-xs text-fuchsia-300" type="submit">
          Trial 7d
        </button>
      </form>

      {(status === "past_due" || status === "canceled") && (
        <form action="/api/admin/subscriptions/reactivate" method="post" onSubmit={confirmReactivate}>
          <input type="hidden" name="subscriptionId" value={subscriptionId} />
          <button className="cursor-pointer rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300" type="submit">
            Reactivar
          </button>
        </form>
      )}
    </div>
  );
}
