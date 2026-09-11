# Zulu Real Estate — Rediseño (sesión Claude Code, 2026-08-13)

## Punto de partida

Página original exportada desde Lovable (`zulu-real-estate (1).html`, 294 KB, 521 líneas —
la mayoría del peso era una sola foto en base64). Marca ya definida: negro `#0A0A0A` +
crema `#FAEEDA`, tipografías Fraunces (display) / Baloo 2 (logo) / Inter (texto).

## Skills instaladas y usadas

Se instalaron 18 skills de diseño desde tres repos de GitHub
(`nextlevelbuilder/ui-ux-pro-max-skill`, `emilkowalski/skill`, `pbakaus/impeccable`)
en `~/.claude/skills/`. De esas, las que realmente guiaron el trabajo:

- **impeccable** — su "craft floor" prohíbe explícitamente varios patrones que tenía
  la página original: eyebrows sobre encabezados, tarjetas idénticas como estructura
  de página, glifos Unicode como iconos, números de sección (01/02/03) sin que aporten
  información. Se aplicaron esas prohibiciones.
- **emil-design-eng** — filosofía de Emil Kowalski sobre pulido de UI: nunca `ease-in`
  en animaciones de interfaz, `scale(0.97)` en `:active` para feedback táctil,
  transiciones interrumpibles (`grid-template-rows: 0fr→1fr` en el acordeón de FAQ
  en vez de `max-height` con número mágico).
- **animate** — framework de decisión para el movimiento: un solo momento coreografiado
  (el hero) en vez de animaciones repetidas en cada sección.
- **ui-ux-pro-max** — se consultó pero su recomendación (paleta teal fintech,
  glassmorphism, patrón "operations landing") no encajaba con real estate boutique
  y se descartó explícitamente. La base de datos no tiene patrón para este rubro.

## Bugs reales corregidos (no eran de gusto, estaban rotos)

1. **Las animaciones de scroll nunca corrían** — el script original marcaba todo
   `.reveal` como visible al cargar la página; el `IntersectionObserver` estaba
   declarado pero nunca se usaba.
2. **El filtro de propiedades no ocultaba nada** — `.card{display:flex}` anulaba el
   atributo `[hidden]` del navegador. Corregido con `.card[hidden]{display:none}`.
3. **~150 líneas de CSS muerto** — bloque de tokens Tailwind/oklch que no hacía nada
   sin build step.
4. **El nav fijo tapaba los títulos** al saltar por anclas — faltaba `scroll-margin-top`.

## Resultado

`zulu-real-estate-v2.html` — archivo único, sin dependencias externas salvo Google
Fonts. Verificado en navegador a 1440px y 375px, sin errores de consola, filtro de
propiedades confirmado funcional vía JS.

## Pendiente / próximos pasos posibles

- Fotos reales de las propiedades (hoy son placeholders con el motivo de curvas de nivel)
- Conectar el formulario a un backend real (hoy solo simula el envío en el navegador)
- Decidir si se sincroniza este HTML de vuelta a Lovable/GitHub o se despliega aparte
