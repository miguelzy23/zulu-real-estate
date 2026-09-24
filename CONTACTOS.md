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
   pega este:

   ```js
   function doPost(e) {
     const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Contactos')
       || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Contactos');

     if (hoja.getLastRow() === 0) {
       hoja.appendRow(['Fecha', 'Nombre', 'Contacto', 'Presupuesto', 'Tipo de propiedad', 'Zona de interés', 'Notas', 'Página']);
     }

     const datos = JSON.parse(e.postData.contents);
     hoja.appendRow([
       new Date(),
       datos.nombre || '',
       datos.contacto || '',
       datos.presupuesto || '',
       datos.tipo || '',
       datos.zona || '',
       datos.notas || '',
       datos.pagina || ''
     ]);

     return ContentService.createTextOutput(JSON.stringify({ ok: true }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```

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
