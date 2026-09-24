# Modelo de propiedad — Zulu (v2)

Define un registro de `data/properties.json`. Un objeto = un listado.

Reemplaza el modelo v1 (31 ago 2026), que era plano y pensado solo para
apartamentos urbanos. La v2 asume que la base del negocio es la finca rural
con casa — de ahí que `casa_de_mayordomo`, `area_construida`, `habitaciones`
y `banos` sean obligatorios por defecto — y se relaja campo por campo para
cubrir lotes dentro de parcelaciones cerradas, que no tienen construcción.

---

## Campos de nivel superior

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | Único, ej. `ZUL-2026-001` |
| `slug` | string | Único, para URLs. Ej. `lote-222-montesereno-el-retiro` |
| `tipo` | `"finca" \| "casa" \| "lote"` | `lote` no tiene construcción — ver sección de campos opcionales |
| `operacion` | `"venta" \| "arriendo"` | |
| `estado` | `"borrador" \| "publicado" \| "proximamente" \| "reservado" \| "vendido" \| "arrendado"` | Solo `publicado`, `proximamente`, `reservado` aparecen en el catálogo. `borrador` es para propiedades que no cumplen las reglas de validación (ver abajo). `proximamente` es una excepción deliberada: se muestra en el sitio (con sello "Próximamente" y sin botón de contacto activo) aunque todavía falte algo de la regla 1, solo si el equipo decidió mostrarla igual mientras se completa |
| `verificado` | boolean | Visita física confirmada por Zulu |
| `titulo` | string | Corto, sin mayúsculas sostenidas ni signos de exclamación |
| `descripcion_corta` | string | Texto honesto, voz de Zulu |
| `casa_de_mayordomo` | boolean | **Obligatorio si `tipo` es `finca` o `casa`. Omitir (no `null`) si `tipo` es `lote`** |
| `area_construida` | number (m²) | **Obligatorio si `tipo` es `finca` o `casa`. Omitir si `tipo` es `lote`** |
| `habitaciones` | number | **Obligatorio si `tipo` es `finca` o `casa`. Omitir si `tipo` es `lote`** |
| `banos` | number | **Obligatorio si `tipo` es `finca` o `casa`. Omitir si `tipo` es `lote`** |
| `ubicacion` | object | Ver abajo |
| `area` | object | Ver abajo — reemplaza el antiguo campo único `area` |
| `terreno` | object | Ver abajo |
| `servicios` | object | `{ energia, acueducto, alcantarillado, gas, internet }`, cada uno boolean \| null |
| `acceso` | object | `{ tipo_via, via_interna_parcelacion, acceso_vehicular_directo }` |
| `legal` | object | Ver abajo |
| `precio` | object | Ver abajo — reemplaza el antiguo valor plano |
| `media` | object | Ver abajo |
| `alertas` | string[] | **Vive en `properties.private.json`, no aquí.** Ver sección de privacidad |
| `fecha_visita` | string (ISO `YYYY-MM-DD`) | |
| `fecha_creacion` | string (ISO `YYYY-MM-DD`) | |

El código nunca debe asumir que un campo existe. Renderizar solo lo que
tiene valor — un campo no aplicable se omite, no se pone en `null`
(los campos marcados como *nullable* abajo sí usan `null` explícitamente
cuando aplican pero no se conocen).

---

## `ubicacion`

| Campo | Tipo | Notas |
|---|---|---|
| `departamento` | string | |
| `municipio` | string | Ej. `El Retiro` |
| `vereda` | string \| null | |
| `subregion` | string | Ej. `Oriente Antioqueño` |
| `parcelacion` | object \| null | **Nuevo.** Presente solo si la propiedad está dentro de una unidad cerrada. Ver abajo |
| `coordenadas` | object | `{ lat: number \| null, lng: number \| null }` |
| `msnm` | number \| null | |
| `clima` | string \| null | |

### `ubicacion.parcelacion` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `nombre` | string | |
| `lote_numero` | string | |
| `regimen` | string | Ej. `"propiedad horizontal"` |
| `porteria_24h` | boolean | |
| `cuota_administracion_cop` | number \| null | |
| `zonas_comunes` | string[] | |
| `indice_ocupacion_pct` | number \| null | % máximo construible |
| `altura_maxima_pisos` | number \| null | |
| `retiros_m` | object \| null | |
| `restriccion_bosque_nativo` | boolean \| null | |

---

## `area` (reemplaza el antiguo campo único)

| Campo | Tipo | Notas |
|---|---|---|
| `escritura_m2` | number | El número en la escritura |
| `real_m2` | number \| null | Medido en terreno |
| `aprovechable_m2` | number \| null | Útil/construible |
| `cuadras` | number | **Derivado.** `escritura_m2 / 6400`, redondeado a 3 decimales |
| `hectareas` | number | **Derivado.** `escritura_m2 / 10000`, redondeado a 3 decimales |

`cuadras` y `hectareas` son campos de despliegue: se calculan siempre a
partir de `escritura_m2`, nunca se editan a mano ni se derivan de
`real_m2` o `aprovechable_m2`.

---

## `terreno`

| Campo | Tipo | Notas |
|---|---|---|
| `topografia` | string | Descripción libre |
| `explanacion_existente` | boolean | **Nuevo.** Si ya existe una placa/terraza nivelada para construir |
| `requiere_movimiento_tierra` | boolean | **Nuevo.** |
| `cobertura` | string[] | Ej. `["bosque nativo", "pasto"]` |
| `frentes_via` | number (entero) | **Nuevo.** Cuántos frentes dan a vía |
| `esquinero` | boolean | **Nuevo.** |

---

## `legal`

| Campo | Tipo | Notas |
|---|---|---|
| `levantamiento_topografico` | boolean \| null | Si existe |
| `estrato` | number (entero 1–6) \| null | **Nuevo.** Fincas rurales suelen ser 1–2; parcelaciones pueden llegar a 6, y define el costo de servicios |
| `uso_suelo` | string | |

`matricula_inmobiliaria` ya no vive aquí — está en
`properties.private.json` como `legal_privado.matricula_inmobiliaria`. Ver
sección de privacidad.

---

## `precio` (reemplaza el valor plano)

| Campo | Tipo | Notas |
|---|---|---|
| `moneda` | string | Ej. `"COP"` |
| `precio_historico` | array de `{ fecha, valor, motivo }` | **Nuevo.** Ordenado cronológicamente, el más reciente al final |
| `valor_m2` | number | Derivado del último `precio_historico.valor` / `area.escritura_m2` |
| `publicable` | boolean \| null | Si el propietario autoriza mostrar el precio |
| `negociable` | boolean \| null | |

No existe un campo `valor` plano — el precio de venta actual siempre se lee
como `precio_historico[precio_historico.length - 1].valor`. Cada entrada de
`precio_historico` es:

```json
{ "fecha": "2026-09-05", "valor": 1950000000, "motivo": "Precio inicial informado por el propietario" }
```

---

## `media`

| Campo | Tipo | Notas |
|---|---|---|
| `video_principal` | string (url) \| null | Ver regla de validación |
| `fotos_dron` | number (entero) | |
| `fotos_terrestres` | number (entero) | |
| `plano_loteo` | boolean | |
| `foto_principal` | string (ruta) | **Nuevo.** Ruta relativa a la raíz del sitio, ej. `assets/lote-222/01.jpg`. Es la que se ve en la tarjeta del catálogo. Se omite (no se pone `null`) mientras no haya foto real — la tarjeta cae al placeholder "Foto próximamente" |
| `fotos` | string[] (rutas) | **Nuevo.** Todas las fotos de la propiedad, en el orden en que se muestran en la galería. Rutas relativas igual que `foto_principal`. Se omite mientras no haya fotos |

Las fotos originales (sin procesar, tal como salen de la cámara o el dron)
van en `media/originales/<slug>/` — esa carpeta está en `.gitignore`, nunca
se sube. Las versiones optimizadas para web, que sí se suben y son las que
referencian `foto_principal` y `fotos`, van en `assets/<slug>/`.

---

## `alertas` (en `properties.private.json`, no en el archivo público)

`string[]`. Preguntas abiertas o riesgos que bloquean o deberían bloquear
la publicación (duplicados en otros portales, dudas sobre linderos,
precio sin confirmar, etc.). Se revisan antes de pasar `estado` a
`publicado`; no se borran solas, se quitan cuando se resuelven.

---

## Campos opcionales por tipo

| Campo | Finca | Casa | Lote |
|---|---|---|---|
| `casa_de_mayordomo` | **obligatorio** | **obligatorio** | omitir |
| `area_construida` | **obligatorio** | **obligatorio** | omitir |
| `habitaciones` | **obligatorio** | **obligatorio** | omitir |
| `banos` | **obligatorio** | **obligatorio** | omitir |
| `ubicacion.parcelacion` | opcional | opcional | opcional (presente si aplica) |

---

## Reglas de validación

1. **Sin video no se publica.** Ninguna propiedad llega a `estado: "publicado"`
   sin `media.video_principal`. Si se quiere mostrar igual mientras llega el
   video, se usa `estado: "proximamente"` (visible, sin CTA de contacto activo)
   en vez de forzar `"publicado"`.
2. **Un lote además necesita área y precio confirmado.** Si `tipo` es
   `"lote"`, tampoco puede llegar a `estado: "publicado"` sin
   `area.escritura_m2` (número, no `null`) y `precio.publicable === true`.
3. Los precios se guardan como enteros en COP, sin puntos ni símbolos.
   El formateo es responsabilidad de la vista.
4. Las áreas van en metros cuadrados, como número, sin unidad.
5. Una propiedad vendida o arrendada no se borra: cambia de `estado`.

---

## Privacidad — separación público/privado

`data/properties.json` es **público**: se sube al repositorio y lo lee el
sitio. No debe contener nada sensible.

Lo sensible vive en `data/properties.private.json` (en `.gitignore`, nunca
se sube), un array de objetos ligados por `id` al registro público
correspondiente:

| Campo | Notas |
|---|---|
| `id` | Debe coincidir con el `id` del registro en `properties.json` |
| `legal_privado.matricula_inmobiliaria` | Reemplaza a `legal.matricula_inmobiliaria` — ese campo ya no existe en el archivo público |
| `alertas` | Notas internas sin confirmar (dudas de linderos, duplicados en otros portales, precio pendiente de verificar, etc.) |

Antes de cargar una propiedad nueva: cualquier dato de propietario, número
de matrícula, o nota interna sin confirmar va en `properties.private.json`,
nunca en el archivo público.
