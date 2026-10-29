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

print('\n' + pasadas + ' pasaron, ' + falladas + ' fallaron');
if (falladas) quit(1);
