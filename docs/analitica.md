# Eventos de Vercel Web Analytics

Integración: la de HTML que ya tenía el proyecto (`window.va` + `/_vercel/insights/script.js`). No se agregó ninguna librería.
Código: función `evento()` en `index.html` (se copia a las páginas por propiedad y `/en` con `scripts/paginas-lote.py`).

**Requisito de plan:** según la documentación de Vercel, los eventos personalizados solo están disponibles en los planes **Pro y
Enterprise**. En Hobby las visitas se miden, pero los eventos no aparecen. Confirma el plan del proyecto antes de esperar datos.

## Eventos

| Evento | Cuándo | Datos (`data`) |
|---|---|---|
| `whatsapp_click` | Clic en un enlace `https://wa.me/…` | `lang`, `location` (`flotante`, `pie`, `favoritos`, `otro`), `property_id` (solo si hay una ficha abierta) |
| `property_contact_click` | Clic en "Quiero saber más", "Consultar disponibilidad" o "Quiero algo así" (tarjeta o ficha) | `lang`, `property_id` (ZUL-…), `location` (`tarjeta`, `ficha`), `operation` (`venta`, `alquiler`, `gestionada`) |
| `contact_form_success` | **Solo** cuando el script de Google confirma el guardado y la huella coincide | `lang`, `role` (`busco`, `tengo`), `has_property`, `property_id` (si hay) |
| `contact_form_error` | Validación fallida o respuesta no confirmada | `lang`, `category`, `field` (solo en validación: `name`, `contact`, `consent`) |

Categorías de error: `validation`, `timeout`, `network`, `http_error`, `invalid_response`, `server_rejected`, `no_confirmation`
(respuesta sin huella, p. ej. script viejo), `mismatch` (huella distinta), `not_configured`, `unknown`.

Todos los eventos llevan `lang` (`es` o `en`). Con `?prueba=1` en la dirección (se recuerda en esa pestaña) llevan además `test: true`.

## Lo que NUNCA se envía
Nombres, correos, teléfonos, mensajes, código de consulta, `envio_id`, huella, ni URLs. Solo valores públicos y de contexto.
Si Analytics falla o está bloqueado, el formulario, los botones de propiedad y los enlaces de WhatsApp funcionan igual (`evento()` no lanza errores).
La política de privacidad (`/privacidad`) menciona la analítica anónima; si se quiere nombrar estos eventos ahí, hacerlo con revisión de papá o abogado.

## Cómo comprobar tras publicar
1. **Pruebas (no son visitas reales):** abre el sitio con `?prueba=1` (ej. `https://www.zulurealstate.com/?prueba=1`), pulsa un WhatsApp, un "Quiero saber más" y, si quieres, envía el formulario con datos marcados PRUEBA. En Vercel → proyecto → **Analytics** → panel **Events**: abre el evento y filtra/mira la propiedad `test = true`. Esos son tus clics.
2. **Visitas reales:** los mismos eventos **sin** `test` en sus datos. Para el conteo de contactos reales, ignora los que traigan `test: true`.
3. El conteo de `contact_form_success` debe coincidir con las filas nuevas de la hoja "Contactos" (descontando las de prueba).
4. Los eventos pueden tardar unos minutos en aparecer.

Pruebas reproducibles: `tests/formulario/README.md` (página `pagina.test.html`, 23 pruebas, con Analytics simulado).
