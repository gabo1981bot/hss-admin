# Billing Event Runbook (Taller + Market)

## Objetivo
Operar un catálogo unificado de eventos de suscripción/pago para `hss_taller` y `hss_market`.

## Catálogo canónico
- `subscription.activated`
- `subscription.trial.started`
- `subscription.trial.expired`
- `subscription.past_due`
- `subscription.canceled`
- `payment.approved`
- `payment.pending`
- `payment.rejected`
- `subscription.updated`

## Endpoint de sync en admin
`POST /api/admin/tenants/sync`

Headers:
- `Authorization: Bearer <HSS_ADMIN_SYNC_TOKEN>`
- `Content-Type: application/json`

Payload mínimo:
```json
{
  "module": "market",
  "tenantId": "tenant_x",
  "ownerEmail": "owner@acme.com",
  "planCode": "starter",
  "status": "active",
  "eventType": "subscription.activated"
}
```

## Compatibilidad legacy (ventana temporal)
Configurar fecha de corte en admin:

```env
LEGACY_EVENT_CUTOFF_AT=2026-04-10T00:00:00Z
```

Comportamiento:
- Antes de la fecha: admin mapea legacy -> canónico.
- Después de la fecha: admin rechaza legacy con `422 legacy_event_type_not_allowed`.

Admin mapea automáticamente eventos legacy a canónicos:
- `payment_approved` -> `payment.approved`
- `payment_pending`/`payment_in_process` -> `payment.pending`
- `payment_rejected`/`payment_cancelled` -> `payment.rejected`
- `trial_started` -> `subscription.trial.started`
- `trial_expired_pending_deletion` -> `subscription.trial.expired`
- `status_past_due` -> `subscription.past_due`
- `status_canceled_after_grace` -> `subscription.canceled`

Además registra `legacy_event_detected` para observabilidad.

## Operación diaria
1. Ir a `/admin`.
2. Revisar sección **Suscripción · eventos recientes**.
3. Filtrar por `eventType` canónico.
4. Si aparece alerta `legacy_event_detected`, revisar emisor pendiente de migración.

## Smoke test rápido
### Market
```bash
curl -X POST "https://api.market.hss.ar/api/billing/mercadopago/webhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $MP_WEBHOOK_SECRET" \
  -d '{"id":"evt_smoke","type":"payment","status":"approved","external_reference":"tenant-smoke","email":"test@acme.com","plan_code":"starter"}'
```

### Admin directo
```bash
curl -X POST "https://admin.hss.ar/api/admin/tenants/sync" \
  -H "Authorization: Bearer $HSS_ADMIN_SYNC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"module":"taller","tenantId":"tenant-smoke","ownerEmail":"test@acme.com","planCode":"starter","status":"trial","eventType":"subscription.trial.started"}'
```
