"use client";

import { useRef, useState } from "react";

type Props = {
  subscriptionId: string;
  email: string;
  planId: string;
  status: string;
  contactedAt: Date | null;
  payLink: string;
};

type ConfirmState = {
  title: string;
  description: string;
  confirmLabel: string;
  intent: "info" | "warning" | "success";
  action: () => void;
} | null;

function ActionButton({
  label,
  tooltip,
  className,
  onClick,
  disabled,
}: {
  label: string;
  tooltip: string;
  className: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`rounded border px-2 py-1 text-xs transition ${className} ${disabled ? "cursor-not-allowed opacity-65" : "cursor-pointer"}`}
      >
        {label}
      </button>
      <div className="pointer-events-none absolute -top-2 left-1/2 z-30 w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-white/15 bg-[#1b1b27] px-2.5 py-2 text-[11px] text-slate-200 opacity-0 shadow-xl transition group-hover:opacity-100">
        {tooltip}
      </div>
    </div>
  );
}

export function SubscriptionActions({ subscriptionId, email, planId, status, contactedAt, payLink }: Props) {
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const markContactFormRef = useRef<HTMLFormElement>(null);
  const recontactFormRef = useRef<HTMLFormElement>(null);
  const trialFormRef = useRef<HTMLFormElement>(null);
  const reactivateFormRef = useRef<HTMLFormElement>(null);

  const openConfirm = (state: ConfirmState) => setConfirmState(state);

  const confirm = () => {
    if (!confirmState) return;
    confirmState.action();
    setConfirmState(null);
  };

  return (
    <>
      <div className="flex flex-wrap gap-1">
        <ActionButton
          label="Link pago"
          tooltip="Abre checkout de Mercado Pago con plan y email del cliente precargados."
          className="border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
          onClick={() =>
            openConfirm({
              title: "Abrir link de pago",
              description: `Se abrirá el checkout para ${email} con plan ${planId.toUpperCase()}.`,
              confirmLabel: "Abrir checkout",
              intent: "info",
              action: () => window.open(payLink, "_blank", "noopener,noreferrer"),
            })
          }
        />

        {!contactedAt ? (
          <form action="/api/admin/subscriptions/mark-contacted" method="post" ref={markContactFormRef}>
            <input type="hidden" name="subscriptionId" value={subscriptionId} />
            <ActionButton
              label="Marcar contacto"
              tooltip="Marca que ya hiciste seguimiento al cliente."
              className="border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              onClick={() =>
                openConfirm({
                  title: "Marcar contacto",
                  description: `Se guardará que ${email} ya fue contactado por el equipo.`,
                  confirmLabel: "Confirmar",
                  intent: "warning",
                  action: () => markContactFormRef.current?.requestSubmit(),
                })
              }
            />
          </form>
        ) : (
          <>
            <ActionButton
              label="Contactado"
              tooltip="Este cliente ya figura como contactado."
              className="border-amber-500/25 bg-amber-500/10 text-amber-200"
              disabled
            />
            <form action="/api/admin/subscriptions/mark-contacted" method="post" ref={recontactFormRef}>
              <input type="hidden" name="subscriptionId" value={subscriptionId} />
              <ActionButton
                label="Recontactar"
                tooltip="Actualiza la marca de contacto para indicar nuevo seguimiento."
                className="border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                onClick={() =>
                  openConfirm({
                    title: "Recontactar cliente",
                    description: `Se actualizará la fecha de contacto para ${email}.`,
                    confirmLabel: "Actualizar",
                    intent: "warning",
                    action: () => recontactFormRef.current?.requestSubmit(),
                  })
                }
              />
            </form>
          </>
        )}

        <form action="/api/admin/subscriptions/grant-trial" method="post" ref={trialFormRef}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="plan" value={planId} />
          <input type="hidden" name="days" value="7" />
          <input type="hidden" name="reason" value="support_trial" />
          <ActionButton
            label="Trial 7d"
            tooltip="Otorga acceso de prueba por 7 días para soporte/comercial."
            className="border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20"
            onClick={() =>
              openConfirm({
                title: "Otorgar trial 7 días",
                description: `Se dará acceso temporal por 7 días a ${email} en plan ${planId.toUpperCase()}.`,
                confirmLabel: "Otorgar trial",
                intent: "warning",
                action: () => trialFormRef.current?.requestSubmit(),
              })
            }
          />
        </form>

        {(status === "past_due" || status === "canceled") && (
          <form action="/api/admin/subscriptions/reactivate" method="post" ref={reactivateFormRef}>
            <input type="hidden" name="subscriptionId" value={subscriptionId} />
            <ActionButton
              label="Reactivar"
              tooltip="Rehabilita una suscripción vencida o cancelada."
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              onClick={() =>
                openConfirm({
                  title: "Reactivar suscripción",
                  description: `Se reactivará la suscripción de ${email}. Usar solo con validación previa.`,
                  confirmLabel: "Reactivar",
                  intent: "success",
                  action: () => reactivateFormRef.current?.requestSubmit(),
                })
              }
            />
          </form>
        )}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#232331] p-5 shadow-2xl">
            <p
              className={`text-xs font-semibold uppercase tracking-widest ${
                confirmState.intent === "success"
                  ? "text-emerald-300"
                  : confirmState.intent === "warning"
                    ? "text-amber-300"
                    : "text-sky-300"
              }`}
            >
              Confirmación de acción
            </p>
            <h4 className="mt-2 text-lg font-black text-white">{confirmState.title}</h4>
            <p className="mt-2 text-sm text-slate-300">{confirmState.description}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirm}
                className="rounded-lg border border-primary/50 bg-primary/20 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/30"
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
