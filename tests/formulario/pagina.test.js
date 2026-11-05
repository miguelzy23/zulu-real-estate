/* Pruebas de regresión del formulario de la página (index.html) en un iframe, con fetch simulado y el script de Google simulado. */
(function () {
  var lista = document.getElementById('resultados'), pasadas = 0, falladas = 0;
  var dormir = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function igual(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'distinto') + ': esperado ' + JSON.stringify(b) + ' y fue ' + JSON.stringify(a)); }
  function cierto(c, m) { if (!c) throw new Error(m || 'se esperaba verdadero'); }
  function registrar(nombre, error) {
    var li = document.createElement('li'); li.className = error ? 'mal' : 'ok';
    li.textContent = (error ? 'FALLA  ' : 'ok     ') + nombre + (error ? ' -> ' + error.message : ''); lista.appendChild(li);
    if (error) falladas++; else pasadas++;
  }

  /* Carga la página en un iframe nuevo y espera a que haya propiedades y ficha. */
  async function cargar(ruta) {
    try { localStorage.setItem('zulu-idioma', /^\/en/.test(ruta) ? 'en' : 'es'); sessionStorage.setItem('zulu-idioma-visto', '1'); } catch (e) {}
    var f = document.createElement('iframe'); document.body.appendChild(f);
    await new Promise(function (r) { f.onload = r; f.src = ruta; });
    var w = f.contentWindow, d = w.document;
    for (var i = 0; i < 80 && !(d.querySelector('.card[data-id]') && d.getElementById('form')); i++) await dormir(100);
    cierto(d.querySelector('.card[data-id]'), 'la página no cargó propiedades');
    return { f: f, w: w, d: d, $: function (id) { return d.getElementById(id); }, cerrar: function () { f.remove(); } };
  }
  /* Instala el servidor simulado en la ventana del iframe. modos: ok | 500 | rechazo | sinhuella | otrahuella | html | red | cuelga | pierde (guarda y la respuesta no llega) */
  async function servidor(p) {
    var codigo = await (await fetch('/apps-script-contactos.gs')).text();
    var sim = ZuluSim.montar(codigo), real = p.w.fetch.bind(p.w), est = { modo: 'ok', llamadas: [] };
    p.w.fetch = function (url, opt) {
      if (String(url).indexOf('script.google.com') < 0) return real(url, opt);
      var cuerpo = JSON.parse(opt.body); est.llamadas.push(cuerpo);
      var m = est.modo;
      if (m === '500') return Promise.resolve(new p.w.Response('x', { status: 500 }));
      if (m === 'html') return Promise.resolve(new p.w.Response('<html>login</html>', { status: 200 }));
      if (m === 'red') return Promise.reject(new TypeError('Failed to fetch'));
      if (m === 'rechazo') return Promise.resolve(new p.w.Response(JSON.stringify({ ok: false, error: 'guardado' }), { status: 200 }));
      if (m === 'sinhuella') return Promise.resolve(new p.w.Response(JSON.stringify({ ok: true }), { status: 200 }));          // script viejo
      if (m === 'otrahuella') return Promise.resolve(new p.w.Response(JSON.stringify({ ok: true, repetido: true, huella: 'hOTRA' }), { status: 200 }));
      if (m === 'cuelga') return new Promise(function (_, rej) { opt.signal.addEventListener('abort', function () { rej(new p.w.DOMException('Aborted', 'AbortError')); }); });
      var r = ZuluSim.post(sim.api, cuerpo);                                  // el script real, con hoja simulada
      if (m === 'demora') return new Promise(function (res) { est.liberar = function () { res(new p.w.Response(JSON.stringify(r), { status: 200 })); }; });   // se guarda, la respuesta llega cuando el test la libera
      if (m === 'pierde') return Promise.reject(new TypeError('Failed to fetch'));   // se guardó, pero el navegador no vio la respuesta
      return Promise.resolve(new p.w.Response(JSON.stringify(r), { status: 200 }));
    };
    est.filas = function () { return sim.filas.slice(1); };
    return est;
  }
  function llenar(p, contacto, notas) {
    var f = p.$('form'); f.nombre.value = 'Ana Prueba'; f.contacto.value = contacto; f.notas.value = notas;
    if (!p.$('acepto').checked) p.$('acepto').click();
  }
  var enviar = async function (p) { p.$('form').requestSubmit(); await dormir(250); };
  var estado = function (p) { return { exito: !p.$('ok').hidden, error: !p.$('formError').hidden, boton: p.$('submit').textContent, activo: !p.$('submit').disabled }; };

  /* Cada prueba termina limpia aunque falle: se quitan los iframes que quedaron y la marca de modo de prueba. */
  async function prueba(nombre, fn) {
    try { await fn(); registrar(nombre); } catch (e) { registrar(nombre, e); }
    document.querySelectorAll('iframe').forEach(function (f) { f.remove(); });
    try { sessionStorage.removeItem('zulu-prueba'); } catch (e2) {}
  }
  var COL = { propId: 8, envio: 11, huella: 13, reemplaza: 14 };

  (async function () {
    await prueba('entrada directa a /<slug>: "Quiero saber más" cierra la ficha, deja el formulario y conserva la propiedad (es)', async function () {
      var p = await cargar('/lote-222-montesereno-el-retiro.html');
      for (var i = 0; i < 40 && !p.$('ficha-contacto'); i++) await dormir(100);
      cierto(!p.d.getElementById('ficha-backdrop').hidden, 'la ficha debía estar abierta al entrar directo');
      p.$('ficha-contacto').click(); await dormir(900);
      igual([p.w.location.pathname, p.w.location.hash, p.d.getElementById('ficha-backdrop').hidden], ['/', '#contacto', true], 'ruta/hash/ficha');
      igual(p.$('consultaNombre').textContent, 'Lote 222 — Montesereno, El Retiro'); igual(p.d.body.style.overflow, '');
      p.w.history.back(); await dormir(400); cierto(p.d.getElementById('ficha-backdrop').hidden, 'atrás no debe reabrir la ficha');
      p.cerrar();
    });
    await prueba('entrada directa a /en/<slug>: lo mismo en inglés', async function () {
      var p = await cargar('/en/lote-222-montesereno-el-retiro.html');
      for (var i = 0; i < 40 && !p.$('ficha-contacto'); i++) await dormir(100);
      p.$('ficha-contacto').click(); await dormir(900);
      igual([p.w.location.pathname, p.w.location.hash, p.d.getElementById('ficha-backdrop').hidden], ['/en', '#contacto', true]);
      cierto(/Lot 222/.test(p.$('consultaNombre').textContent), 'la propiedad debe conservarse'); igual(p.d.querySelector('#consulta .consulta-txt span').textContent, 'About:');
      p.cerrar();
    });
    await prueba('validación: sin nombre/contacto o sin consentimiento no se envía nada', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p);
      await enviar(p); igual(s.llamadas.length, 0);
      var f = p.$('form'); f.nombre.value = 'Ana'; f.contacto.value = 'a@example.com'; await enviar(p);
      igual([s.llamadas.length, p.$('aceptoError').hidden], [0, false]); p.cerrar();
    });
    await prueba('fallo del servidor (500), respuesta no JSON, rechazo y red caída: error accesible, datos conservados, se puede reintentar', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); llenar(p, 'a@example.com', 'mensaje');
      for (var m of ['500', 'html', 'rechazo', 'red']) {
        s.modo = m; await enviar(p); var e = estado(p);
        igual([e.exito, e.error, e.boton, e.activo, p.$('formError').getAttribute('role')], [false, true, 'Reintentar', true, 'alert'], m);
        igual([p.$('form').contacto.value, p.$('form').notas.value], ['a@example.com', 'mensaje'], 'datos conservados (' + m + ')');
      }
      p.cerrar();
    });
    await prueba('tiempo agotado: error, no éxito, se puede reintentar', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); llenar(p, 'a@example.com', 'm');
      var st = p.w.setTimeout; p.w.setTimeout = function (fn, ms) { return st.call(p.w, fn, ms === 20000 ? 60 : ms, arguments[2]); };
      s.modo = 'cuelga'; await enviar(p); await dormir(300); p.w.setTimeout = st;
      var e = estado(p); igual([e.exito, e.error, e.activo], [false, true, true]); p.cerrar();
    });
    await prueba('CASO 3: {ok:true} sin huella (script viejo) NO se presenta como guardado', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); llenar(p, 'a@example.com', 'm');
      s.modo = 'sinhuella'; await enviar(p); var e = estado(p);
      igual([e.exito, e.error, e.boton], [false, true, 'Reintentar']); p.cerrar();
    });
    await prueba('CASO 3b: respuesta con huella distinta a la enviada NO se presenta como guardado', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); llenar(p, 'a@example.com', 'm');
      s.modo = 'otrahuella'; await enviar(p); var e = estado(p); igual([e.exito, e.error], [false, true]); p.cerrar();
    });
    await prueba('éxito: la huella coincide, se muestra el código y el payload trae id, huella, idioma', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); llenar(p, 'a@example.com', 'm'); await enviar(p);
      var e = estado(p), c = s.llamadas[0];
      igual([e.exito, e.boton], [true, 'Enviado']); cierto(/Código de tu consulta: [A-Z0-9]{8}/.test(p.$('okRef').textContent), 'código visible');
      cierto(c.envio_id && /^h/.test(c.huella) && c.idioma === 'es', 'envio_id, huella e idioma'); igual(s.filas().length, 1); p.cerrar();
    });
    await prueba('reintento IDÉNTICO tras respuesta perdida: mismo id, 1 sola fila', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); llenar(p, 'a@example.com', 'm');
      s.modo = 'pierde'; await enviar(p); igual(s.filas().length, 1, 'se guardó pero no se vio la respuesta');
      s.modo = 'ok'; await enviar(p);
      igual([estado(p).exito, s.filas().length, s.llamadas[0].envio_id === s.llamadas[1].envio_id, s.llamadas[0].huella === s.llamadas[1].huella, 'reemplaza' in s.llamadas[1]], [true, 1, true, true, false]); p.cerrar();
    });
    await prueba('CASO 1: cambiar SOLO de propiedad cambia la huella y el ID (y apunta a lo anterior)', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); llenar(p, 'a@example.com', 'mismo mensaje');
      p.d.querySelector('.card[data-id="ZUL-2026-001"] a.more[href="#contacto"]').click(); await dormir(100);
      s.modo = '500'; await enviar(p);
      p.d.querySelector('.card[data-id="ZUL-2026-002"] a.more[href="#contacto"]').click(); await dormir(100);
      s.modo = 'ok'; await enviar(p);
      var a = s.llamadas[0], b = s.llamadas[1];
      igual([a.propiedad_id, b.propiedad_id], ['ZUL-2026-001', 'ZUL-2026-002']);
      cierto(a.huella !== b.huella, 'la huella debía cambiar'); cierto(a.envio_id !== b.envio_id, 'el envio_id debía cambiar'); igual(b.reemplaza, a.envio_id);
      igual(s.filas().length, 1); igual(s.filas()[0][COL.propId], 'ZUL-2026-002'); p.cerrar();
    });
    await prueba('CASO 2: original guardado -> corrección que falla antes de guardar -> reintento de la corrección conserva "reemplaza"', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); llenar(p, 'ana@example.com', 'original');
      s.modo = 'pierde'; await enviar(p); var id1 = s.llamadas[0].envio_id; igual(s.filas().length, 1, 'el original quedó guardado');
      llenar(p, 'ana.correcta@example.com', 'mensaje corregido');
      s.modo = '500'; await enviar(p); var c1 = s.llamadas[1]; igual(c1.reemplaza, id1, 'la corrección apunta al original'); igual(s.filas().length, 1, 'la corrección aún no se guardó');
      s.modo = 'ok'; await enviar(p); var c2 = s.llamadas[2];
      igual([c2.envio_id, c2.huella, c2.reemplaza], [c1.envio_id, c1.huella, id1], 'el reintento de la corrección conserva id, huella y reemplaza');
      igual([estado(p).exito, s.filas().length], [true, 2]); var f = s.filas();
      igual([f[0][2], f[1][2], f[1][COL.reemplaza]], ['ana@example.com', 'ana.correcta@example.com', id1], 'ambas filas, la segunda marcada'); p.cerrar();
    });
    await prueba('varias correcciones acumulan los ids anteriores en "reemplaza"', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); llenar(p, 'uno@example.com', 'a');
      s.modo = '500'; await enviar(p); llenar(p, 'dos@example.com', 'b'); await enviar(p); llenar(p, 'tres@example.com', 'c'); await enviar(p);
      var ids = s.llamadas.map(function (c) { return c.envio_id; });
      igual(s.llamadas[2].reemplaza, ids[0] + ',' + ids[1]); p.cerrar();
    });

    /* ---- Analítica (Vercel Web Analytics): eventos simulados, sin datos personales ---- */
    function espiar(p) { var ev = []; p.w.va = function () { ev.push(Array.prototype.slice.call(arguments)); }; return ev; }
    var nombres = function (ev) { return ev.map(function (e) { return e[1].name; }); };
    function sinNavegar(p) { p.d.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) e.preventDefault(); }); }
    var PERMITIDAS = ['lang', 'property_id', 'location', 'operation', 'role', 'has_property', 'category', 'field', 'test'];

    await prueba('ANALÍTICA: un clic en "Quiero saber más" de una tarjeta genera UN solo evento property_contact_click (es)', async function () {
      var p = await cargar('/index.html'); var ev = espiar(p); sinNavegar(p);
      p.d.querySelector('.card[data-id="ZUL-2026-001"] a.more[href="#contacto"]').click(); await dormir(150);
      igual(ev.length, 1, 'un clic = un evento'); igual(ev[0], ['event', { name: 'property_contact_click', data: { lang: 'es', property_id: 'ZUL-2026-001', location: 'tarjeta', operation: 'venta' } }]); p.cerrar();
    });
    await prueba('ANALÍTICA: lo mismo en inglés (lang = en) y con una propiedad en alquiler', async function () {
      var p = await cargar('/en/index.html'); var ev = espiar(p); sinNavegar(p);
      p.d.querySelector('.card[data-id="ZUL-2026-006"] a.more[href="#contacto"]').click(); await dormir(150);
      igual(ev.length, 1); igual(ev[0][1].data, { lang: 'en', property_id: 'ZUL-2026-006', location: 'tarjeta', operation: 'alquiler' }); p.cerrar();
    });
    await prueba('ANALÍTICA: el botón de la ficha (dinámico, entrada directa) genera un solo evento con location ficha', async function () {
      var p = await cargar('/lote-222-montesereno-el-retiro.html'); var ev = espiar(p);
      for (var i = 0; i < 40 && !p.$('ficha-contacto'); i++) await dormir(100);
      p.$('ficha-contacto').click(); await dormir(500);
      igual(ev.length, 1); igual(ev[0][1].data, { lang: 'es', property_id: 'ZUL-2026-001', location: 'ficha', operation: 'venta' }); p.cerrar();
    });
    await prueba('ANALÍTICA: WhatsApp: un clic = un evento whatsapp_click con la ubicación (flotante, pie, favoritos)', async function () {
      var p = await cargar('/index.html'); var ev = espiar(p); sinNavegar(p);
      p.d.querySelector('.wa-group a.wa').click(); await dormir(80);
      p.d.querySelector('.foot-channels a.chan[href^="https://wa.me/"]').click(); await dormir(80);
      var fav = p.$('favBarWa'); fav.setAttribute('href', 'https://wa.me/573107311282?text=lista'); fav.click(); await dormir(80);
      igual(nombres(ev), ['whatsapp_click', 'whatsapp_click', 'whatsapp_click']);
      igual(ev.map(function (e) { return e[1].data.location; }), ['flotante', 'pie', 'favoritos']); igual(ev[0][1].data.lang, 'es'); p.cerrar();
    });
    await prueba('ANALÍTICA: enlaces que no son de WhatsApp ("Hablemos", "#") no generan evento de WhatsApp', async function () {
      var p = await cargar('/index.html'); var ev = espiar(p); sinNavegar(p);
      p.d.querySelector('.nav-cta').click(); p.d.querySelector('.foot-channels a.chan[href="#"]').click(); await dormir(100);
      igual(ev.length, 0); p.cerrar();
    });
    await prueba('ANALÍTICA: validación fallida genera solo contact_form_error (validation), nunca éxito', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); var ev = espiar(p);
      await enviar(p); var f = p.$('form'); f.nombre.value = 'Ana'; await enviar(p); f.contacto.value = 'a@example.com'; await enviar(p);
      igual(nombres(ev), ['contact_form_error', 'contact_form_error', 'contact_form_error']);
      igual(ev.map(function (e) { return e[1].data.field; }), ['name', 'contact', 'consent']); cierto(ev.every(function (e) { return e[1].data.category === 'validation'; }));
      igual(s.llamadas.length, 0); p.cerrar();
    });
    await prueba('ANALÍTICA: respuestas NO confirmadas dan un error con su categoría y jamás éxito; el éxito llega una sola vez', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); var ev = espiar(p); llenar(p, 'a@example.com', 'mensaje');
      var casos = [['500', 'http_error'], ['html', 'invalid_response'], ['rechazo', 'server_rejected'], ['red', 'network'], ['sinhuella', 'no_confirmation'], ['otrahuella', 'mismatch']];
      for (var i = 0; i < casos.length; i++) { s.modo = casos[i][0]; await enviar(p); }
      var st = p.w.setTimeout; p.w.setTimeout = function (fn, ms) { return st.call(p.w, fn, ms === 20000 ? 60 : ms, arguments[2]); };
      s.modo = 'cuelga'; await enviar(p); await dormir(300); p.w.setTimeout = st;
      igual(ev.map(function (e) { return e[1].data.category; }), casos.map(function (c) { return c[1]; }).concat(['timeout']));
      cierto(nombres(ev).every(function (n) { return n === 'contact_form_error'; }), 'ningún éxito antes de confirmar');
      s.modo = 'ok'; await enviar(p);
      igual(nombres(ev).filter(function (n) { return n === 'contact_form_success'; }).length, 1, 'un solo éxito'); igual(nombres(ev).length, 8); p.cerrar();
    });
    await prueba('ANALÍTICA: el éxito lleva solo contexto no sensible (rol, propiedad pública)', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); var ev = espiar(p); sinNavegar(p);
      p.d.querySelector('.card[data-id="ZUL-2026-001"] a.more[href="#contacto"]').click(); await dormir(100);
      llenar(p, 'a@example.com', 'm'); await enviar(p);
      igual(ev[1], ['event', { name: 'contact_form_success', data: { lang: 'es', role: 'busco', property_id: 'ZUL-2026-001', has_property: true } }]); p.cerrar();
    });
    await prueba('ANALÍTICA: ningún dato personal, código, id de envío, huella ni URL en ningún evento', async function () {
      var p = await cargar('/lote-222-montesereno-el-retiro.html'); var s = await servidor(p); var ev = espiar(p); sinNavegar(p);
      for (var i = 0; i < 40 && !p.$('ficha-contacto'); i++) await dormir(100);
      p.$('ficha-contacto').click(); await dormir(300);
      var f = p.$('form'); f.nombre.value = 'Ana Secreta Pérez'; f.contacto.value = 'ana.secreta@example.com'; f.notas.value = 'mensaje privado 998877'; p.$('acepto').click();
      s.modo = '500'; await enviar(p); s.modo = 'ok'; await enviar(p); p.d.querySelector('.wa-group a.wa').click(); await dormir(100);
      var texto = JSON.stringify(ev), codigo = (p.$('okRef').textContent.match(/[A-Z0-9]{8}$/) || [''])[0];
      ['Ana', 'Secreta', 'example.com', '@', 'mensaje privado', '998877', '://', 'wa.me', 'zulurealstate', s.llamadas[0].envio_id, s.llamadas[0].huella].forEach(function (x) { cierto(texto.indexOf(x) < 0, 'el evento contiene "' + x + '"'); });
      cierto(codigo.length === 8 && texto.indexOf(codigo) < 0, 'el código de consulta no debe viajar');
      ev.forEach(function (e) { Object.keys(e[1].data).forEach(function (k) { cierto(PERMITIDAS.indexOf(k) >= 0, 'clave no permitida: ' + k); var t = typeof e[1].data[k]; cierto(t === 'string' || t === 'boolean' || t === 'number', 'tipo ' + t); }); });
      cierto(ev.length >= 4, 'se esperaban varios eventos'); p.cerrar();
    });
    await prueba('ANALÍTICA: con ?prueba=1 los eventos llevan test:true (y sin ese parámetro no), para separar pruebas de visitas reales', async function () {
      var p = await cargar('/index.html?prueba=1'); var ev = espiar(p); sinNavegar(p);
      p.d.querySelector('.wa-group a.wa').click(); await dormir(80); igual(ev[0][1].data.test, true); igual(p.w.location.href.indexOf('prueba=1') > 0, true); p.cerrar();
      try { sessionStorage.removeItem('zulu-prueba'); } catch (e) {}
      var q = await cargar('/index.html'); var ev2 = espiar(q); sinNavegar(q);
      q.d.querySelector('.wa-group a.wa').click(); await dormir(80); igual('test' in ev2[0][1].data, false); q.cerrar();
    });
    var salirPrueba = function () { try { sessionStorage.removeItem('zulu-prueba'); } catch (e) {} };
    await prueba('ANALÍTICA: la marca ?prueba=1 se guarda AL CARGAR: abrir una ficha (que quita el parámetro) antes del primer evento no la pierde', async function () {
      salirPrueba(); var p = await cargar('/index.html?prueba=1'); var ev = espiar(p); sinNavegar(p);
      p.d.querySelector('.card[data-id="ZUL-2026-001"] .card-open').click(); await dormir(900);
      igual(p.w.location.search, '', 'abrir la ficha cambió la dirección y quitó el parámetro');
      p.d.querySelector('.wa-group a.wa').click(); await dormir(80);
      igual([ev.length, ev[0][1].data.test], [1, true]); p.cerrar(); salirPrueba();
    });
    await prueba('ANALÍTICA: ?prueba=0 sale del modo de prueba; sin marca no hay test; la marca no pasa a otra pestaña de visitas reales', async function () {
      salirPrueba(); var p = await cargar('/index.html?prueba=1'); p.cerrar();
      var q = await cargar('/index.html?prueba=0'); var ev = espiar(q); sinNavegar(q);
      q.d.querySelector('.wa-group a.wa').click(); await dormir(80); igual('test' in ev[0][1].data, false, '?prueba=0 desactiva'); q.cerrar(); salirPrueba();
    });
    await prueba('ANALÍTICA: el éxito usa la copia del envío confirmado aunque durante la espera cambien el rol o la propiedad', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); var ev = espiar(p); sinNavegar(p);
      p.d.querySelector('.card[data-id="ZUL-2026-001"] a.more[href="#contacto"]').click(); await dormir(100);
      llenar(p, 'a@example.com', 'm'); s.modo = 'demora'; p.$('form').requestSubmit(); await dormir(200);
      igual(estado(p).exito, false, 'aún sin respuesta');
      p.d.querySelector('input[name="rol"][value="tengo"]').click(); p.$('consultaQuitar').click(); await dormir(100);
      s.liberar(); await dormir(300);
      igual(estado(p).exito, true); var exitos = ev.filter(function (e) { return e[1].name === 'contact_form_success'; });
      igual(exitos.length, 1); igual(exitos[0][1].data, { lang: 'es', role: 'busco', property_id: 'ZUL-2026-001', has_property: true }, 'atribuido al envío confirmado, no al formulario actual'); p.cerrar();
    });
    await prueba('ANALÍTICA: respuesta demorada y el visitante cambia de propiedad: se atribuye la propiedad del envío', async function () {
      var p = await cargar('/index.html'); var s = await servidor(p); var ev = espiar(p); sinNavegar(p);
      p.d.querySelector('.card[data-id="ZUL-2026-001"] a.more[href="#contacto"]').click(); await dormir(100);
      llenar(p, 'a@example.com', 'm'); s.modo = 'demora'; p.$('form').requestSubmit(); await dormir(200);
      p.d.querySelector('.card[data-id="ZUL-2026-002"] a.more[href="#contacto"]').click(); await dormir(100);
      s.liberar(); await dormir(300);
      igual(ev.filter(function (e) { return e[1].name === 'contact_form_success'; })[0][1].data.property_id, 'ZUL-2026-001'); igual(s.llamadas[0].propiedad_id, 'ZUL-2026-001'); p.cerrar();
    });
    /* ---- Etiqueta visible del modo de prueba ---- */
    await prueba('ETIQUETA: con ?prueba=1 aparece "Modo de prueba" + "Salir" (es) y "Test mode" + "Exit" (en); sin la marca no aparece', async function () {
      var p = await cargar('/index.html?prueba=1'); var e = p.$('modoPrueba'); cierto(e, 'debía aparecer');
      igual([e.querySelector('span').textContent, e.querySelector('button').textContent], ['Modo de prueba', 'Salir']); p.cerrar();
      var q = await cargar('/en/index.html'); igual(q.$('modoPrueba') && q.$('modoPrueba').querySelector('span').textContent, 'Test mode', 'la marca sigue activa en la pestaña');
      igual(q.$('modoPrueba').querySelector('button').textContent, 'Exit'); q.cerrar();
      salirPrueba(); var r = await cargar('/index.html'); igual(r.$('modoPrueba'), null, 'un visitante normal no la ve'); r.cerrar();
    });
    await prueba('ETIQUETA: es accesible (role status, botón con nombre, objetivo táctil >= 44 px) y sigue al abrir una ficha', async function () {
      salirPrueba(); var p = await cargar('/index.html?prueba=1'); var e = p.$('modoPrueba'), b = e.querySelector('button');
      igual([e.getAttribute('role'), b.getAttribute('aria-label')], ['status', 'Salir del modo de prueba']);
      cierto(b.getBoundingClientRect().height >= 44, 'el botón debe medir al menos 44 px');
      p.d.querySelector('.card[data-id="ZUL-2026-001"] .card-open').click(); await dormir(800); cierto(p.d.getElementById('modoPrueba'), 'sigue visible con la ficha abierta'); p.cerrar();
    });
    await prueba('ETIQUETA: "Salir" la quita y apaga la marca (sin recargar); el siguiente evento ya no lleva test; salir no genera eventos', async function () {
      salirPrueba(); var p = await cargar('/index.html?prueba=1'); var ev = espiar(p); sinNavegar(p);
      p.d.querySelector('.wa-group a.wa').click(); await dormir(80); igual(ev[0][1].data.test, true);
      p.$('modoPrueba').querySelector('button').click(); await dormir(80);
      igual([p.$('modoPrueba'), ev.length], [null, 1], 'se quitó y no hubo evento nuevo');
      p.d.querySelector('.wa-group a.wa').click(); await dormir(80); igual('test' in ev[1][1].data, false, 'ya no es prueba'); p.cerrar();
    });
    await prueba('ETIQUETA: ?prueba=0 la quita; el formulario funciona con la etiqueta visible', async function () {
      salirPrueba(); var p = await cargar('/index.html?prueba=1'); p.cerrar();
      var q = await cargar('/index.html?prueba=0'); igual(q.$('modoPrueba'), null); q.cerrar();
      var r = await cargar('/index.html?prueba=1'); var s = await servidor(r); llenar(r, 'a@example.com', 'm'); await enviar(r);
      igual([estado(r).exito, s.filas().length, !!r.$('modoPrueba')], [true, 1, true]); r.cerrar();
    });
    await prueba('SIN ANALÍTICA (ausente o bloqueada): formulario, WhatsApp y botones de propiedad siguen funcionando', async function () {
      var variantes = [['ausente', function (w) { w.va = undefined; }], ['lanza error', function (w) { w.va = function () { throw new Error('bloqueado'); }; }], ['no es función', function (w) { w.va = 'x'; }]];
      for (var i = 0; i < variantes.length; i++) {
        var p = await cargar('/index.html'); variantes[i][1](p.w); var s = await servidor(p); sinNavegar(p);
        var errores = []; p.w.addEventListener('error', function (e) { errores.push(e.message); });
        p.d.querySelector('.wa-group a.wa').click(); await dormir(50);
        p.d.querySelector('.card[data-id="ZUL-2026-001"] a.more[href="#contacto"]').click(); await dormir(100);
        igual(p.$('consultaNombre').textContent, 'Lote 222 — Montesereno, El Retiro', 'la propiedad sigue seleccionándose (' + variantes[i][0] + ')');
        await enviar(p); llenar(p, 'a@example.com', 'm'); await enviar(p);
        igual([estado(p).exito, s.filas().length, errores.length], [true, 1, 0], variantes[i][0]); p.cerrar();
      }
    });

    /* ---- Barra superior en celular: se desvanece, ya no cae deslizándose sobre el texto ---- */
    function irA(p, y) { p.d.documentElement.style.scrollBehavior = 'auto'; p.w.scrollTo(0, y); }   // instantáneo (la página usa desplazamiento suave)
    /* Estas pruebas dependen de que la página se esté pintando (requestAnimationFrame): si la pestaña está oculta, fallan con un aviso claro. */
    async function pintando(p) { var vivo = await new Promise(function (r) { var t = setTimeout(function () { r(false); }, 800); p.w.requestAnimationFrame(function () { clearTimeout(t); r(true); }); }); if (!vivo) throw new Error('la pestaña no se está pintando (déjala visible y repite)'); }
    async function bajarSubir(p, ancho, alto) {
      var st = p.d.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; p.d.head.appendChild(st);   // estados finales, sin depender del tiempo
      p.f.style.width = ancho; p.f.style.height = alto; await dormir(400); await pintando(p);
      irA(p, 300); await dormir(250); irA(p, 1000); await dormir(500);
      var nav = p.$('nav'), cs = p.w.getComputedStyle(nav), oculta = { clase: nav.classList.contains('is-hidden'), opacidad: cs.opacity, visibilidad: cs.visibility, transform: cs.transform };
      irA(p, 900); await dormir(500);
      var cs2 = p.w.getComputedStyle(nav), vuelve = { clase: nav.classList.contains('is-hidden'), opacidad: cs2.opacity, visibilidad: cs2.visibility, transform: cs2.transform, fondo: cs2.backgroundColor };
      return { oculta: oculta, vuelve: vuelve };
    }
    await prueba('BARRA (celular, 420 px): al bajar se desvanece sin deslizarse; al subir reaparece sin deslizarse y con fondo opaco', async function () {
      var p = await cargar('/index.html'); var r = await bajarSubir(p, '420px', '700px');
      igual([r.oculta.clase, r.oculta.opacidad, r.oculta.visibilidad, r.oculta.transform], [true, '0', 'hidden', 'none'], 'oculta: sin desplazamiento');
      igual([r.vuelve.clase, r.vuelve.opacidad, r.vuelve.visibilidad, r.vuelve.transform], [false, '1', 'visible', 'none'], 'visible otra vez, sin desplazamiento');
      var alfa = parseFloat((r.vuelve.fondo.match(/rgba?\([^)]*?,\s*([\d.]+)\)$/) || [0, 1])[1]); cierto(alfa >= 0.9, 'fondo opaco (alfa ' + alfa + ')'); p.cerrar();
    });
    await prueba('BARRA (computador, 1200 px): sin cambios, sigue deslizándose hacia arriba al esconderse', async function () {
      var p = await cargar('/index.html'); var r = await bajarSubir(p, '1200px', '700px');
      igual([r.oculta.clase, r.oculta.opacidad, r.oculta.visibilidad], [true, '1', 'visible']); cierto(r.oculta.transform !== 'none', 'en computador se desliza');
      igual(r.vuelve.clase, false, 'al subir vuelve a mostrarse'); p.cerrar();
    });
    await prueba('BARRA: no se esconde mientras el foco (teclado) está dentro de ella', async function () {
      var p = await cargar('/index.html'); p.f.style.width = '420px'; p.f.style.height = '700px'; await dormir(300); await pintando(p);
      p.$('navToggle').focus(); irA(p, 300); await dormir(200); irA(p, 2400); await dormir(600);
      igual(p.$('nav').classList.contains('is-hidden'), false, 'con el foco en la barra no debe esconderse'); p.cerrar();
    });

    document.getElementById('resumen').innerHTML = '<b>' + pasadas + ' pasaron, ' + falladas + ' fallaron</b>';
    document.title = (falladas ? 'FALLAN ' + falladas : 'TODAS PASAN ' + pasadas) + ' · pruebas del formulario';
  })();
})();
