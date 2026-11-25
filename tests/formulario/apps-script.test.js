/* Pruebas de apps-script-contactos.gs con un simulador de Google (sin red, sin hoja real).
   Correr desde la raíz del repositorio:  tests/formulario/correr.sh   (usa jsc, que ya viene con macOS) */
load('tests/formulario/hoja-simulada.js');
var CODIGO = read('apps-script-contactos.gs');
var pasadas = 0, falladas = 0;
function prueba(nombre, fn) { try { fn(); pasadas++; print('  ok    ' + nombre); } catch (e) { falladas++; print('  FALLA ' + nombre + ' -> ' + e.message); } }
function igual(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'distinto') + ': esperado ' + JSON.stringify(b) + ' y fue ' + JSON.stringify(a)); }
function cierto(c, m) { if (!c) throw new Error(m || 'se esperaba verdadero'); }

var COL = { contacto: 2, notas: 6, propId: 8, envio: 11, huella: 13, reemplaza: 14 };   // índices base 0 en la fila
var base = { nombre: 'Ana', contacto: 'ana@example.com', notas: 'hola', envio_id: 'aaaa1111-0000-0000-0000-000000000001', huella: 'h0000000a1', propiedad_id: 'ZUL-2026-001', propiedad_titulo: 'Lote 222', propiedad_url: 'https://www.zulurealstate.com/lote-222', idioma: 'es', pagina: 'u' };
function con(o) { var r = {}; for (var k in base) r[k] = base[k]; for (var k2 in o) r[k2] = o[k2]; return r; }

print('apps-script-contactos.gs');
prueba('doGet confirma que está activo y que entiende la huella', function () {
  var s = ZuluSim.montar(CODIGO); var r = JSON.parse(s.api.doGet().t);
  igual([r.ok, r.servicio, r.huella], [true, 'contactos', true]);
});
prueba('JSON malo y datos faltantes se rechazan', function () {
  var s = ZuluSim.montar(CODIGO);
  igual(ZuluSim.post(s.api, 'no es json').error, 'json');
  igual(ZuluSim.post(s.api, { nombre: 'Ana' }).error, 'faltan-datos');
  igual(s.filas.length, 0, 'no debe guardar nada');
});
prueba('guarda la fila con propiedad, id de envío, huella y encabezado de 15 columnas', function () {
  var s = ZuluSim.montar(CODIGO); var r = ZuluSim.post(s.api, base);
  igual([r.ok, r.codigo, r.huella], [true, 'AAAA1111', 'h0000000a1']);
  igual(s.filas[0].length, 15); igual(s.filas[1][COL.propId], 'ZUL-2026-001'); igual(s.filas[1][COL.huella], 'h0000000a1');
});
prueba('reintento IDÉNTICO (mismo id y huella) no crea otra fila', function () {
  var s = ZuluSim.montar(CODIGO); ZuluSim.post(s.api, base); var r = ZuluSim.post(s.api, base);
  igual([r.ok, r.repetido, r.huella], [true, true, 'h0000000a1']); igual(s.filas.length, 2);
});
prueba('mismo id con OTRO contenido no se da por repetido: se guarda como fila marcada', function () {
  var s = ZuluSim.montar(CODIGO); ZuluSim.post(s.api, base);
  var r = ZuluSim.post(s.api, con({ contacto: 'otra@example.com', huella: 'h0000000b2' }));
  igual([r.ok, r.repetido === undefined, r.correccion, r.huella], [true, true, true, 'h0000000b2']);
  igual(s.filas.length, 3); igual(s.filas[2][COL.reemplaza], base.envio_id);
});
prueba('la lista "reemplaza" (varios ids) se guarda completa', function () {
  var s = ZuluSim.montar(CODIGO);
  ZuluSim.post(s.api, con({ envio_id: 'bbbb2222-0', huella: 'hAAAA', reemplaza: 'id-1,id-2' }));
  igual(s.filas[1][COL.reemplaza], 'id-1,id-2');
});
prueba('texto largo se recorta y las fórmulas se neutralizan, los teléfonos no', function () {
  var s = ZuluSim.montar(CODIGO);
  igual(s.api.limpiar('x'.repeat(5000)).length, 2000);
  igual(s.api.limpiar('=HYPERLINK("x")'), "'=HYPERLINK(\"x\")"); igual(s.api.limpiar('@SUM(1)'), "'@SUM(1)"); igual(s.api.limpiar('-2+3'), "'-2+3");
  igual(s.api.limpiar('+57 300 123 4567'), '+57 300 123 4567'); igual(s.api.limpiar('ana@example.com'), 'ana@example.com');
});
prueba('bloqueo ocupado y error al guardar responden ok:false', function () {
  igual(ZuluSim.post(ZuluSim.montar(CODIGO, { ocupado: true }).api, base).error, 'ocupado');
  var s = ZuluSim.montar(CODIGO, { fallaAlGuardar: true }); s.hoja.appendRow(['x']);
  igual(ZuluSim.post(s.api, base).error, 'guardado');
});
prueba('una hoja antigua con 8 columnas recibe los encabezados nuevos', function () {
  var s = ZuluSim.montar(CODIGO); s.hoja.appendRow(['Fecha', 'Nombre', 'Contacto', 'Presupuesto', 'Tipo de propiedad', 'Zona de interés', 'Notas', 'Página']);
  ZuluSim.post(s.api, base); igual(s.filas[0][8], 'ID propiedad'); igual(s.filas[0][14], 'Reemplaza a');
});
prueba('campo trampa lleno: va a "Spam", no a Contactos, y responde como un envío normal', function () {
  var s = ZuluSim.montar(CODIGO); var r = ZuluSim.post(s.api, con({ control: 'robot' }));
  igual([r.ok, r.huella], [true, 'h0000000a1']); igual(s.filas.length, 1, 'Contactos solo con el encabezado'); igual(s.spam.length, 2); igual(s.spam[1][15], 'campo trampa');
  igual([s.spam[1][COL.propId], s.spam[1][COL.envio]], ['ZUL-2026-001', base.envio_id], 'Spam guarda todos los datos');
});
prueba('un reintento idéntico apartado no se duplica en "Spam"', function () {
  var s = ZuluSim.montar(CODIGO); ZuluSim.post(s.api, con({ control: 'x' })); var r = ZuluSim.post(s.api, con({ control: 'x' }));
  igual([r.ok, r.repetido], [true, true]); igual(s.spam.length, 2);
});
prueba('"Spam" llena: responde error, nunca éxito sin guardar; Contactos sigue funcionando', function () {
  var s = ZuluSim.montar(CODIGO); ZuluSim.post(s.api, con({ control: 'x' }));
  while (s.spam.length <= 500) s.spam.push(['relleno']);
  var r = ZuluSim.post(s.api, con({ control: 'x', envio_id: 'cccc3333-0', huella: 'hCCCC' }));
  igual([r.ok, r.error], [false, 'guardado']); igual(s.spam.length, 501);
  igual(ZuluSim.post(s.api, base).ok, true); igual(s.filas.length, 2);
});
prueba('tres enlaces o más van a "Spam"; uno solo se guarda en Contactos', function () {
  var s = ZuluSim.montar(CODIGO);
  ZuluSim.post(s.api, con({ notas: 'http://a.com https://b.com www.c.com' })); igual(s.filas.length, 1); igual(s.spam[1][15], 'varios enlaces');
  ZuluSim.post(s.api, con({ notas: 'vi esto https://www.zulurealstate.com/lote-222' })); igual(s.filas.length, 2, 'encabezado + 1'); igual(s.spam.length, 2);
});
prueba('un contacto nuevo avisa UNA vez, con datos, WhatsApp y propiedad; el reintento no repite', function () {
  var s = ZuluSim.montar(CODIGO), d = con({ contacto: '+57 300 123 4567' }); ZuluSim.post(s.api, d); ZuluSim.post(s.api, d);
  igual(s.correos.length, 1); var c = s.correos[0];
  igual(c.to, 'zulurealstate@gmail.com'); igual(c.subject, 'Nuevo contacto: Ana · Lote 222'); igual(c.replyTo, undefined);
  cierto(c.body.indexOf('https://wa.me/573001234567') > 0 && c.body.indexOf('Mensaje: hola') > 0 && c.body.indexOf('docs.google.com') > 0, c.body);
});
prueba('celular colombiano sin indicativo y correo como respuesta directa', function () {
  var s = ZuluSim.montar(CODIGO);
  ZuluSim.post(s.api, con({ contacto: '3001234567' })); cierto(s.correos[0].body.indexOf('wa.me/573001234567') > 0);
  ZuluSim.post(s.api, con({ envio_id: 'dddd', huella: 'hD' })); igual(s.correos[1].replyTo, 'ana@example.com'); cierto(s.correos[1].body.indexOf('wa.me') < 0);
});
prueba('spam y datos rechazados no avisan; las pruebas se marcan; sin saltos de línea en el asunto', function () {
  var s = ZuluSim.montar(CODIGO);
  ZuluSim.post(s.api, con({ control: 'x' })); ZuluSim.post(s.api, { nombre: 'Ana' }); igual(s.correos.length, 0);
  ZuluSim.post(s.api, con({ nombre: 'Ana\nBcc: x@y.com', pagina: 'https://www.zulurealstate.com/?prueba=1' }));
  cierto(s.correos[0].subject.indexOf('[PRUEBA] ') === 0 && s.correos[0].subject.indexOf('\n') < 0, s.correos[0].subject);
});
prueba('si el correo falla, la fila se guarda y se responde ok', function () {
  var s = ZuluSim.montar(CODIGO, { fallaCorreo: true }); var r = ZuluSim.post(s.api, base);
  igual([r.ok, s.filas.length], [true, 2]);
});
prueba('probarAviso envía la muestra sin escribir en la hoja', function () {
  var s = ZuluSim.montar(CODIGO); s.api.probarAviso(); igual([s.correos.length, s.filas.length], [1, 0]);
});

print('\n' + pasadas + ' pasaron, ' + falladas + ' fallaron');
if (falladas) quit(1);
