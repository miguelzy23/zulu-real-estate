/* Simulador mínimo de Google Apps Script + una hoja de cálculo, para probar apps-script-contactos.gs sin tocar Google.
   Sirve igual en jsc (terminal) y en el navegador. Uso: const { api, filas } = ZuluSim.montar(codigoDelScript, { ocupado, fallaAlGuardar }); */
var ZuluSim = (function () {
  function montar(codigo, opc) {
    opc = opc || {};
    var filas = [];
    function rango(r, c, nr, nc) {
      return {
        getValues: function () { var f = []; for (var k = 0; k < (nc || 1); k++) { var v = (filas[r - 1] || [])[c - 1 + k]; f.push(v === undefined ? '' : v); } return [f]; },
        getValue: function () { var v = (filas[r - 1] || [])[c - 1]; return v === undefined ? '' : v; },
        setValue: function (v) { filas[r - 1] = filas[r - 1] || []; filas[r - 1][c - 1] = v; return this; },
        createTextFinder: function (t) {
          return { matchEntireCell: function () { return this; },
            findAll: function () { var o = []; for (var i = r - 1; i < r - 1 + (nr || 1); i++) { if ((filas[i] || [])[c - 1] === t) o.push((function (fila) { return { getRow: function () { return fila; } }; })(i + 1)); } return o; } };
        },
        setFontWeight: function () { return this; }, setBackground: function () { return this; }, setFontColor: function () { return this; },
        setNumberFormat: function () { return this; }, setWrap: function () { return this; }, setBorder: function () { return this; }
      };
    }
    var hoja = {
      getLastRow: function () { return filas.length; },
      appendRow: function (r) { if (opc.fallaAlGuardar && filas.length > 0) throw new Error('boom'); filas.push(r); },
      getRange: rango, setFrozenRows: function () {}, setColumnWidth: function () {}, setRowHeightsForced: function () {}
    };
    var libro = { getSheetByName: function () { return hoja; }, insertSheet: function () { return hoja; } };
    var SpreadsheetApp = { getActiveSpreadsheet: function () { return libro; }, flush: function () {}, BorderStyle: { SOLID_MEDIUM: 1, SOLID: 2 } };
    var LockService = { getScriptLock: function () { return { tryLock: function () { return !opc.ocupado; }, releaseLock: function () {} }; } };
    var ContentService = { createTextOutput: function (t) { return { t: t, setMimeType: function () { return this; } }; }, MimeType: { JSON: 'json' } };
    var api = new Function('SpreadsheetApp', 'LockService', 'ContentService', codigo + '\nreturn { doPost: doPost, doGet: doGet, limpiar: limpiar };')(SpreadsheetApp, LockService, ContentService);
    return { api: api, filas: filas, hoja: hoja };
  }
  /* Respuesta como la daría la web app (JSON ya convertido) */
  function post(api, cuerpo) {
    return JSON.parse(api.doPost({ postData: { contents: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) } }).t);
  }
  return { montar: montar, post: post };
})();
