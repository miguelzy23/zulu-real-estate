# Guardar los contactos del formulario en Google Sheets

El formulario de "Empecemos con una conversación" (`index.html`, sección
`#contacto`) envía cada envío a una hoja de Google Sheets. Falta un paso que
solo puedes hacer tú (requiere tu cuenta de Google): crear la hoja y publicar
el script que recibe los datos.

## Pasos (una sola vez, ~5 minutos)

1. Ve a [sheets.google.com](https://sheets.google.com) y crea una hoja nueva.
   Ponle de nombre, por ejemplo, **"Zulu — Contactos web"**.
2. En el menú, ve a **Extensiones → Apps Script**.
3. Borra el código de ejemplo que aparece (`function myFunction() {...}`) y
   pega el contenido de [`apps-script-contactos.gs`](apps-script-contactos.gs)
   (además de guardar la fila, deja la hoja formateada: encabezado fijo y
   resaltado, columnas con ancho legible, fecha con hora y texto largo con
   salto de línea en vez de cortado).

4. Guarda el proyecto (ícono de disquete o Ctrl/Cmd+S). Ponle un nombre si te
   lo pide, por ejemplo "Zulu contactos".
5. Arriba a la derecha, botón azul **Implementar → Nueva implementación**.
6. En "Seleccionar tipo", el ícono de engranaje → **Aplicación web**.
7. Configura:
   - **Ejecutar como:** Yo (tu cuenta)
   - **Quién tiene acceso:** Cualquier usuario
   (esto es necesario para que el sitio público pueda enviar datos sin que
   el visitante tenga que iniciar sesión en Google — nadie puede leer la
   hoja, solo escribir una fila nueva a través de esta URL).
8. Dale a **Implementar**. Te va a pedir autorizar permisos (es tu propio
   script, es seguro) — acepta.
9. Copia la **URL de la aplicación web** que te da al final (algo como
   `https://script.google.com/macros/s/AKfycb.../exec`).
10. Pásame esa URL — la pongo en `index.html` (reemplazando
    `CONTACT_ENDPOINT = 'PON_AQUI_LA_URL_DE_APPS_SCRIPT'`) y hago el commit
    y push.

## Después de conectarla

- Cada envío del formulario cae como fila nueva en la pestaña "Contactos"
  de tu hoja: fecha, nombre, contacto, presupuesto, tipo de propiedad, zona
  de interés, notas y desde qué página escribieron.
- Puedes filtrar, ordenar o hacer una tabla dinámica directamente en Sheets.
- Si alguna vez cambias el nombre de la hoja o borras el script, el
  formulario deja de guardar datos silenciosamente — revisa la consola del
  navegador (F12) si sospechas que algo falló, ahí queda un aviso.

## Si prefieres no usar tu cuenta de Google para esto

Se puede cambiar a un servicio externo tipo Formspree (con cuenta y panel
propio) o simplemente recibir cada envío por correo — dile a Claude cuál
prefieres y se reconecta el formulario a esa opción en vez de esta.

## Actualización 2026-10-29: formulario que confirma que guardó (pendiente de activar)

Qué cambia: el formulario ya no muestra "Enviado" a ciegas. Lee la respuesta del script (`{"ok":true,"codigo":"…"}`); si no
llega, o llega con error, muestra un aviso y deja reintentar sin perder lo escrito. Cada consulta guarda además de qué
propiedad viene (ID, título y enlace) en columnas nuevas, sin tocar el mensaje de la persona, y los reintentos no duplican filas.

Pasos manuales **antes** de publicar la rama en producción (en este orden):
1. Abre el Apps Script del formulario, reemplaza el código por el de `apps-script-contactos.gs` y guarda.
2. **Implementar → Administrar implementaciones → editar (lápiz) → Versión: "Nueva versión" → Implementar.** Sin la nueva
   versión, el enlace `/exec` sigue ejecutando el código viejo. Mantén "Ejecutar como: Yo" y "Quién tiene acceso: Cualquier
   persona". La URL `/exec` no cambia.
3. Abre la URL `/exec` en el navegador (GET): debe mostrar `{"ok":true,"servicio":"contactos","version":"2026-10-29.2","huella":true}`.
4. Con la vista previa de Vercel de la rama, envía UNA consulta de prueba (nombre "PRUEBA", un correo tuyo) y comprueba: sale
   "Código de tu consulta", aparece la fila con las columnas nuevas (ID propiedad, Propiedad, Enlace, ID de envío, Idioma, Huella, Reemplaza a) y
   el teléfono que empieza con + se ve sin apóstrofe. Borra esa fila después.
5. Si en el paso 4 el formulario muestra error aunque la fila sí se guardó, el navegador no puede leer la respuesta de Google
   (CORS): no publicar y avisar. Mientras tanto producción sigue funcionando como hoy.

Compatibilidad con el script viejo (IMPORTANTE): el formulario nuevo **exige** que el script responda `ok:true` **y** la misma
`huella` que envió. Con el script viejo (sin huella) el formulario mostrará error aunque la fila sí se guarde, y cada reintento
guardará otra fila duplicada (el script viejo no evita duplicados). Por eso el orden es obligatorio: primero pegar el script
nuevo y crear la nueva versión de la implementación; comprobar con GET que la respuesta trae `"huella":true` y
`"version":"2026-10-29.2"`; y solo entonces publicar la página. No publicar la página con el script viejo.

Reintentos con datos corregidos: un reintento idéntico (misma huella, que incluye nombre, contacto, mensaje y la propiedad) no crea
otra fila. Si la persona cambia algo (incluso solo la propiedad), el navegador manda un `envio_id` nuevo y `reemplaza` con los ids
anteriores de ese envío (separados por coma); `reemplaza` se conserva en todos los reintentos de la corrección hasta que haya
confirmación. En la hoja quedan varias filas (la original y las correcciones, marcadas en "Reemplaza a"): nada se descarta en
silencio. Quien atiende debe quedarse con la fila más reciente de cada cadena.

Pruebas reproducibles (sin enviar nada real): `tests/formulario/README.md`.
