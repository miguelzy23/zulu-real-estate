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
corrección, y que `{ok:true}` sin huella o con otra huella no se muestre como guardado. Incluye las pruebas de los eventos de
Analytics (`docs/analitica.md`) con `window.va` simulado: un clic = un evento, éxito solo tras confirmación, sin datos personales y sin Analytics.

No cubren (siguen pendientes): la prueba real contra Google y que el navegador pueda leer su respuesta (CORS).

## Prueba real contra Google (manual, escribe filas en la hoja)

Solo después de pegar el script nuevo y crear la nueva versión de la implementación. Cada comando guarda una fila marcada PRUEBA
(las filas 2 y 4 no guardan nada porque son reintentos idénticos). **Borra las filas de prueba al terminar.**
Importante: no uses `curl -X POST` con `-L`: curl repite el POST en el redireccionamiento y Google responde una página de error (aunque
la fila sí se haya guardado). Usa `--data`, que convierte el redireccionamiento en GET, igual que el navegador.

```bash
U="https://script.google.com/macros/s/<ID>/exec"   # la misma URL de CONTACT_ENDPOINT en index.html
curl -sL -H 'Content-Type: text/plain;charset=utf-8' --data '{"nombre":"PRUEBA","contacto":"prueba@example.com","envio_id":"prueba-1","huella":"hPRUEBA1"}' "$U"   # {"ok":true,...}
curl -sL -H 'Content-Type: text/plain;charset=utf-8' --data '{"nombre":"PRUEBA","contacto":"prueba@example.com","envio_id":"prueba-1","huella":"hPRUEBA1"}' "$U"   # {"ok":true,"repetido":true,...}  (sin fila nueva)
curl -sL -H 'Content-Type: text/plain;charset=utf-8' --data '{"contacto":"x@example.com"}' "$U"                                                                      # {"ok":false,"error":"faltan-datos"}
```
