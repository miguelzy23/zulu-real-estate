# SEO: lo que hace el generador y cómo comprobarlo

`scripts/paginas-lote.py` genera las páginas por propiedad (`/<slug>` y `/en/<slug>`) y el `sitemap.xml`.

- **Descripción** (meta, Open Graph, Twitter y datos estructurados): máximo 155 caracteres, siempre una frase completa (se recorta en una coma, nunca a media idea, sin "…") y con el precio.
- **H1 propio por ficha:** el texto oculto del título principal lleva el nombre de la propiedad ("ZULU Lote 222 — Montesereno, El Retiro"); la portada conserva el suyo. No cambia nada visible.
- **Sitemap:** `lastmod` es la fecha del último commit de los archivos que alimentan cada página (`index.html`, traducciones, `data/properties.json` y el propio generador), o hoy si tienen cambios sin guardar. `paginas-lote.py --check` también falla si alguna fecha está atrasada respecto del último cambio real (no lo comprueba en clones superficiales de git, donde las fechas no son fiables). Las oficinas arrendadas (noindex) no entran.
- **404 propia:** `404.html` (Vercel la sirve con estado 404 para direcciones que no existen).

Comprobación (solo biblioteca estándar, desde la raíz): `python3 tests/seo/test_seo.py`
