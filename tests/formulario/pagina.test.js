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

  async function prueba(nombre, fn) { try { await fn(); registrar(nombre); } catch (e) { registrar(nombre, e); } }
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

    document.getElementById('resumen').innerHTML = '<b>' + pasadas + ' pasaron, ' + falladas + ' fallaron</b>';
    document.title = (falladas ? 'FALLAN ' + falladas : 'TODAS PASAN ' + pasadas) + ' · pruebas del formulario';
  })();
})();
