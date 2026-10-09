# Plantillas de autenticación de Supabase

Se pegan a mano en el panel: **Authentication → Emails → Templates**. Cada casilla
tiene un campo *Subject* (asunto) y un campo *Body* (se pega el HTML entero del
archivo, desde `<!DOCTYPE html>` hasta `</html>`).

| Archivo | Casilla en Supabase | Asunto |
|---|---|---|
| `confirmar-cuenta.html` | **Confirm signup** | Confirmá tu correo para entrar al estudio 💗 |
| `invitacion.html` | **Invite user** | Brunela te invitó al estudio |
| `enlace-magico.html` | **Magic Link** | Tu enlace para entrar |
| `cambio-de-correo.html` | **Change Email Address** | Confirmá tu correo nuevo |
| `recuperar-contrasena.html` | **Reset Password** | Elegí una contraseña nueva |
| `reautenticacion.html` | **Reauthentication** | Tu código de verificación |

## Variables que usan

| Variable | Dónde |
|---|---|
| `{{ .ConfirmationURL }}` | el botón y el enlace de respaldo de todas, menos reautenticación |
| `{{ .Email }}` | el texto de confirmar, recuperar, enlace mágico e invitación; "correo actual" en cambio de correo |
| `{{ .NewEmail }}` | "correo nuevo" en cambio de correo |
| `{{ .Token }}` | el código grande de reautenticación (y su preheader) |

`{{ .SiteURL }}` no se usa: el pie enlaza fijo a `https://bruneladance.com`, para
que un Site URL de desarrollo (localhost) nunca termine en un correo real.

## Cómo cambiarlas

**No editar estos HTML a mano.** Salen de `src/lib/email/plantilla-base.ts`, la
misma plantilla que usan los correos propios del estudio, y los textos están en
`scripts/vista-previa-mails.mjs` (objeto `SUPABASE`). Se cambia ahí y se regenera:

```bash
node scripts/vista-previa-mails.mjs --regenerar-supabase --salida <carpeta>
```

Eso reescribe esta carpeta y deja en `<carpeta>` la vista previa de los 11
correos con datos de ejemplo. Después hay que volver a pegar en Supabase las
que hayan cambiado: el panel no lee el repo.

## Antes de pegarlas

- Los textos no prometen un vencimiento exacto ("sirve una sola vez", "vence en
  poco tiempo"), porque la duración real la define *Auth → Email OTP Expiration*.
- Las imágenes (logo e isologo) se sirven desde `https://bruneladance.com/brand/`.
  Si esa ruta cambia, los correos ya enviados se quedan sin logo.
- ⚠️ Mientras "Confirm email" siga apagado (ver `CLAUDE.md`), `confirmar-cuenta`
  no se envía nunca. Se pega igual, para que esté lista el día que se encienda.
- Supabase arma estas plantillas con plantillas de Go, que pueden **borrar los
  comentarios HTML**, incluidos los condicionales de Outlook (`<!--[if mso]>`).
  El diseño no depende de ellos: el botón es una tabla con `mso-padding-alt`,
  sin VML. Si se borran, en Outlook de escritorio la tarjeta deja de estar
  limitada a 600 px y la fuente puede caer a una de sistema; el correo se lee
  igual y el botón sigue siendo un botón. Conviene mandarse una de prueba a una
  cuenta de Outlook después de pegarlas.
