# Pruebas del formulario de contacto

No envían ninguna consulta real: usan `fetch` simulado y un simulador del script de Google (`hoja-simulada.js`).

**Script de Google (terminal, ~1 s):**
```bash
tests/formulario/correr.sh
```
Usa `jsc`, que ya viene con macOS. Sale con error si alguna prueba falla.

**Página (navegador):**
```bash
python3 -m http.server 8000
```
y abre `http://localhost:8000/tests/formulario/pagina.test.html`. Al terminar, el título de la pestaña dice `TODAS PASAN n`
o `FALLAN n`, y cada prueba se lista en la página. Cubren: entrada directa a `/<slug>` (español e inglés), validación,
errores del servidor/red/tiempo, reintento idéntico, cambio de propiedad, `reemplaza` conservado en reintentos de una
corrección, y que `{ok:true}` sin huella o con otra huella no se muestre como guardado.

No cubren (siguen pendientes): la prueba real contra Google y que el navegador pueda leer su respuesta (CORS).
