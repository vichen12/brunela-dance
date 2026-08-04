# Fase 0 — empezar a acumular datos

Tres cosas que no se ven en pantalla y existen para que dentro de dos meses haya
historia que mirar. **Es lo único de todo el plan de analíticas que es urgente
por el calendario**: las demás métricas se pueden construir igual de bien en
marzo, pero el dato que no se captura hoy no se recupera nunca.

Dos de las tres son manuales y van en paneles externos.

---

## 1. Tabla de eventos de actividad — hecho en el código, falta la migración

Ya está implementado: el reproductor emite `video_start`, un latido por minuto y
`video_complete`, y `/api/activity` los guarda.

**Falta correr `supabase/migrations/20260803_activity_events.sql`.**

Mientras no se corra, el endpoint responde 204 igual y deja el error en los
registros del servidor. Nadie ve nada roto — pero no se guarda un solo evento.

---

## 2. Stripe: suscribir el endpoint a `invoice.paid` ⚠️ MANUAL

**Esto no requiere ninguna línea de código.** El webhook ya guarda el payload
completo de todos los eventos que recibe, procese o no
([webhooks/route.ts](../app/api/stripe/webhooks/route.ts) → `persistWebhookAudit`).
Hoy sólo llegan tres tipos de evento porque son los únicos suscritos.

### Por qué importa

Hoy **no existe ni una fila de "esta alumna pagó tanto tal día"**. Se sabe quién
tiene plan activo, no cuánto entró. Ingresos reales — con prorrateos, descuentos,
reintentos fallidos, reembolsos e IVA — no están en la base.

### Los pasos

1. Entrar a **dashboard.stripe.com** → **Developers** → **Webhooks**.
2. ⚠️ **Confirmar arriba a la izquierda en qué modo estás.** Los endpoints de
   *test* y de *live* son listas separadas: suscribir el de test no cambia nada
   en producción. Hoy el sistema corre en **test** (`STRIPE_SECRET_KEY` empieza
   con `sk_test_`). Cuando se pase a producción **hay que repetir esto en live**.
3. Abrir el endpoint que apunta a `…/api/stripe/webhooks`.
4. **Update details** → **Select events** y agregar, además de los tres que ya
   están:

   | Evento | Para qué |
   |---|---|
   | `invoice.paid` | El ingreso real, con su importe y su fecha |
   | `invoice.payment_failed` | Cobros que fallan — avisa de bajas antes de que ocurran |
   | `charge.refunded` | Devoluciones, que restan del ingreso |

5. Guardar. No hay que tocar `STRIPE_WEBHOOK_SECRET`: el secreto es del
   endpoint, no de la lista de eventos.

### Cómo verificar que quedó

Después del primer cobro (o mandando uno de prueba desde **Send test webhook**):

```sql
select event_type, count(*), max(created_at)
  from public.subscription_webhook_events
 group by event_type
 order by event_type;
```

Tiene que aparecer `invoice.paid`. Si sólo salen los tres de
`customer.subscription.*`, la suscripción no se guardó o se guardó en el otro
modo.

> Los eventos nuevos **no se procesan**, sólo se archivan. Es a propósito:
> `syncSubscription` los ignora y devuelve "no afecta suscripciones", así que no
> hay ningún riesgo de que un `invoice.paid` toque el plan de nadie. Se
> almacenan para poder leerlos cuando se construya el panel.

---

## 3. Vercel Web Analytics: activarlo ⚠️ MANUAL

El componente ya está puesto en [app/layout.tsx](../app/layout.tsx), pero
**solo con eso no se registra nada**: hay que habilitarlo en el proyecto.

1. **vercel.com** → proyecto `brunela-dance` → pestaña **Analytics**.
2. **Enable Web Analytics**.
3. Esperar al siguiente deploy (o hacer uno) y visitar la página.

Da **visitas y país**, que son las dos piezas que faltaban para el embudo
*visitas → registros → pagos* y para la segmentación geográfica.

### Por qué esto y no preguntarle el país a la alumna

- Cada pregunta de más en el alta es gente que la abandona.
- `profiles.country_code` existe en la base desde el primer día y **nunca lo
  escribió nadie**: cero referencias en todo el código.
- Sin cookies ni identificadores por persona, así que no hace falta banner de
  consentimiento.

---

## Resumen de lo manual

| Paso | Dónde | Sin esto |
|---|---|---|
| Correr `20260803_activity_events.sql` | Supabase → SQL Editor | No se guarda ningún evento |
| Suscribir `invoice.paid` | Stripe → Webhooks (**y repetir en live**) | No hay registro de pagos |
| Enable Web Analytics | Vercel → Analytics | No hay visitas ni país |
