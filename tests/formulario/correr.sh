#!/bin/bash
# Corre las pruebas del script de Google en la terminal (jsc viene con macOS). Desde cualquier carpeta:
cd "$(dirname "$0")/../.." || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
[ -x "$JSC" ] || JSC=$(command -v jsc)
[ -n "$JSC" ] || { echo "No encontré jsc (JavaScriptCore). Las pruebas de la página se corren en el navegador: ver tests/formulario/README.md"; exit 1; }
"$JSC" tests/formulario/apps-script.test.js
