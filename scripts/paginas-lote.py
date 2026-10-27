#!/usr/bin/env python3
"""Genera las páginas por propiedad y la versión en inglés a partir de index.html y data/properties.json.

Qué hace
  1. Español: <slug>.html por cada propiedad publicada (copia de index.html con título, descripción, enlace canónico,
     vista previa para compartir, datos estructurados y data-abrir="<id>" en <body>).
  2. Inglés: en/index.html (la portada en inglés) y en/<slug>.html. Son la misma página con lang="en" y un diccionario
     (scripts/traducciones-en.json) que reemplaza los textos fijos y le entrega al código los textos dinámicos.
  3. Imágenes para compartir (1200x630) en assets/og/<slug>.jpg si no existen (usa sips, solo macOS).
  4. sitemap.xml con español e inglés.

Cuándo correrlo
  Cada vez que cambie index.html, data/properties.json o scripts/traducciones-en.json:  python3 scripts/paginas-lote.py
  Para comprobar que todo está al día y que no falta ninguna traducción (sin escribir):    python3 scripts/paginas-lote.py --check

Si cambias un texto en español en index.html, hay que actualizar su traducción en scripts/traducciones-en.json
(el script avisa qué textos fijos no tienen traducción). Solo necesita Python 3.
"""
import html
import json
import re
import subprocess
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DOMINIO = 'https://www.zulurealstate.com'
SOLO_COMPROBAR = '--check' in sys.argv
ENFOQUE_OG = {}   # parte vertical de la foto para la imagen de compartir (0 arriba, 0.5 centro, 1 abajo)
# Textos que no se traducen (nombres propios, marcas)
NO_TRADUCIR = {'ZULU', 'Instagram', 'Miguel', 'Pacho', 'Martín', 'Pacho Zuluaga', 'Llanogrande', 'Antioquia', 'ES', 'EN', 'English', 'Español',
               'Caribe', '×', '(opcional)', 'Prefer to view the site in English?', '¿Prefieres ver la página en español?'}
TRAD = json.loads((RAIZ / 'scripts' / 'traducciones-en.json').read_text(encoding='utf-8'))


# ------------------------------------------------------------------ utilidades
def cop(n, en=False):
    s = f'{int(n):,}'
    return ('COP $' + s) if en else ('$' + s.replace(',', '.'))


def ultimo_precio(p):
    h = (p.get('precio') or {}).get('precio_historico') or []
    return h[-1]['valor'] if h else None


def es_gestionada(p):
    return p.get('operacion') == 'gestionada'


def frase_precio(p, en=False):
    pr = p.get('precio') or {}
    if es_gestionada(p):
        return 'Rented out by Zulu Real Estate.' if en else 'Arrendada por Zulu Real Estate.'
    if pr.get('consultar') or not ultimo_precio(p):
        if en:
            return 'For rent: price on request.' if p.get('operacion') == 'alquiler' else 'Price on request.'
        return 'Alquiler: precio a consultar.' if p.get('operacion') == 'alquiler' else 'Precio a consultar.'
    v = cop(ultimo_precio(p), en)
    per = pr.get('periodo')
    if p.get('operacion') == 'alquiler':
        if en:
            return f"For rent: {v} per {TRAD['js'].get(per, per) if per else 'period'}."
        return f"Alquiler: {v} por {per or 'periodo'}."
    return f'Price: {v}.' if en else f'Precio: {v} COP.'


def tit(p, en):
    return TRAD['props'][p['slug']]['titulo'] if en else p['titulo']


def desc_corta(p, en):
    return TRAD['props'][p['slug']]['descripcion_corta'] if en else p['descripcion_corta']


def descripcion(p, en=False):
    base = desc_corta(p, en).strip().rstrip('.')
    cierre = ' Zulu Real Estate.'
    texto = f'{base}. {frase_precio(p, en)}{cierre}'
    if len(texto) > 158:
        corto = f'{base}. {frase_precio(p, en)}'
        if len(corto) > 158:
            corto = corto[:155].rsplit(' ', 1)[0] + '…'
        texto = corto
    return texto


def attr(s):
    return html.escape(s, quote=True)


def datos_estructurados(p, url, imagen, desc, en=False):
    u = p.get('ubicacion') or {}
    direccion = {'@type': 'PostalAddress', 'addressCountry': 'CO', 'addressRegion': 'Antioquia'}
    if u.get('municipio'):
        direccion['addressLocality'] = u['municipio']
    if u.get('departamento'):
        direccion['addressRegion'] = u['departamento']
    fotos = [f'{DOMINIO}/{f}' for f in (p.get('media') or {}).get('fotos', [])[:6]] or [imagen]
    d = {
        '@context': 'https://schema.org', '@type': 'RealEstateListing', 'name': tit(p, en), 'url': url, 'description': desc,
        'image': fotos, 'inLanguage': 'en' if en else 'es-CO', 'datePosted': p.get('fecha_creacion') or str(date.today()),
        'about': {'@type': 'Place', 'name': tit(p, en), 'address': direccion},
        'provider': {'@type': 'RealEstateAgent', 'name': 'Zulu Real Estate', 'url': DOMINIO + ('/en' if en else '/')},
    }
    coords = u.get('coordenadas') or {}
    if coords.get('lat') is not None and coords.get('lng') is not None:
        d['about']['geo'] = {'@type': 'GeoCoordinates', 'latitude': coords['lat'], 'longitude': coords['lng']}
    valor = ultimo_precio(p)
    pr = p.get('precio') or {}
    if valor and not es_gestionada(p) and not pr.get('consultar'):
        oferta = {'@type': 'Offer', 'price': valor, 'priceCurrency': pr.get('moneda') or 'COP', 'availability': 'https://schema.org/InStock', 'url': url}
        if p.get('operacion') == 'alquiler' and pr.get('periodo'):
            oferta['priceSpecification'] = {'@type': 'UnitPriceSpecification', 'price': valor, 'priceCurrency': pr.get('moneda') or 'COP',
                                            'unitText': TRAD['js'].get(pr['periodo'], pr['periodo']) if en else pr['periodo']}
        d['offers'] = oferta
    return json.dumps(d, ensure_ascii=False, indent=2)


def reemplazar(texto, patron, nuevo, nombre):
    resultado, n = re.subn(patron, lambda m: nuevo, texto, count=1, flags=re.S)
    if n != 1:
        sys.exit(f'No encontré "{nombre}" en index.html: el script necesita ajustarse.')
    return resultado


# ------------------------------------------------------------------ traducción de index.html al inglés
class Textos(HTMLParser):
    def __init__(s):
        super().__init__(); s.skip = 0; s.txt = []
    def handle_starttag(s, t, a):
        if t in ('script', 'style'): s.skip += 1
    def handle_endtag(s, t):
        if t in ('script', 'style'): s.skip -= 1
    def handle_data(s, d):
        d = re.sub(r'\s+', ' ', d).strip()
        if not s.skip and d and re.search(r'[A-Za-záéíóúñ]{2}', d): s.txt.append(d)


def sin_traducir(base):
    p = Textos(); p.feed(base)
    return sorted({t for t in p.txt if t not in TRAD['html'] and t not in NO_TRADUCIR})


def traducir_html(src):
    """Reemplaza los textos fijos de index.html por su versión en inglés (solo nodos de texto y atributos conocidos)."""
    usados = set()
    partes = re.split(r'(<script\b.*?</script>|<style\b.*?</style>|<[^>]+>)', src, flags=re.S)
    salida = []
    for i, parte in enumerate(partes):
        if i % 2 == 0:   # texto
            clave = html.unescape(re.sub(r'\s+', ' ', parte).strip())
            if clave in TRAD['html']:
                usados.add(clave)
                parte = parte.replace(parte.strip(), html.escape(TRAD['html'][clave], quote=False)) if parte.strip() else parte
        elif parte.startswith('<') and not parte.startswith(('<script', '<style', '<!')):
            def cambiar(m):
                v = html.unescape(m.group(2))
                en = TRAD['attrs'].get(v)
                return f'{m.group(1)}="{attr(en)}"' if en is not None else m.group(0)
            parte = re.sub(r'\b(aria-label|placeholder|alt|title|data-label)="([^"]*)"', cambiar, parte)
        salida.append(parte)
    return ''.join(salida), usados


def diccionario_js():
    d = dict(TRAD['js'])
    d['__props'] = TRAD['props']
    return d


def a_ingles(base):
    h, usados = traducir_html(base)
    h = h.replace('<html lang="es">', '<html lang="en">', 1)
    m = TRAD['meta']
    h = reemplazar(h, r'<title>.*?</title>', f'<title>{attr(m["title"])}</title>', 'title')
    h = reemplazar(h, r'<meta name="description" content="[^"]*" />', f'<meta name="description" content="{attr(m["description"])}" />', 'description')
    h = reemplazar(h, r'<link rel="canonical" href="[^"]*" />', f'<link rel="canonical" href="{DOMINIO}/en" />', 'canonical')
    h = reemplazar(h, r'<meta property="og:locale" content="es_CO" />', '<meta property="og:locale" content="en_US" />', 'og:locale')
    h = reemplazar(h, r'<meta property="og:locale:alternate" content="en_US" />', '<meta property="og:locale:alternate" content="es_CO" />', 'og:locale:alternate')
    h = reemplazar(h, r'<meta property="og:url" content="[^"]*" />', f'<meta property="og:url" content="{DOMINIO}/en" />', 'og:url')
    h = reemplazar(h, r'<meta property="og:title" content="[^"]*" />', f'<meta property="og:title" content="{attr(m["title"])}" />', 'og:title')
    h = reemplazar(h, r'<meta property="og:description" content="[^"]*" />', f'<meta property="og:description" content="{attr(m["og_description"])}" />', 'og:description')
    h = reemplazar(h, r'<meta property="og:image:alt" content="[^"]*" />', f'<meta property="og:image:alt" content="{attr(m["og_image_alt"])}" />', 'og:image:alt')
    h = reemplazar(h, r'<meta name="twitter:title" content="[^"]*" />', f'<meta name="twitter:title" content="{attr(m["title"])}" />', 'twitter:title')
    h = reemplazar(h, r'<meta name="twitter:description" content="[^"]*" />', f'<meta name="twitter:description" content="{attr(m["twitter_description"])}" />', 'twitter:description')
    h = re.sub(r'("@type": "RealEstateAgent".*?"description": ")[^"]*(")', lambda mm: mm.group(1) + m['ld_description'] + mm.group(2), h, count=1, flags=re.S)
    dic = '<script>window.ZULU_EN = ' + json.dumps(diccionario_js(), ensure_ascii=False) + ';</script>\n'
    h = reemplazar(h, r'(<link rel="preconnect" href="https://fonts\.googleapis\.com" />)', dic + '<link rel="preconnect" href="https://fonts.googleapis.com" />', 'preconnect fonts')
    return h, usados


# ------------------------------------------------------------------ páginas por propiedad
def alternos(slug_es):
    es = f'{DOMINIO}/{slug_es}' if slug_es else f'{DOMINIO}/'
    en = f'{DOMINIO}/en/{slug_es}' if slug_es else f'{DOMINIO}/en'
    return (f'<link rel="alternate" hreflang="es" href="{es}" />\n<link rel="alternate" hreflang="en" href="{en}" />\n'
            f'<link rel="alternate" hreflang="x-default" href="{es}" />')


def generar_pagina(base, p, en=False):
    slug = p['slug']
    url = f'{DOMINIO}/en/{slug}' if en else f'{DOMINIO}/{slug}'
    imagen = f'{DOMINIO}/assets/og/{slug}.jpg'
    titulo = f"{tit(p, en)} | Zulu Real Estate"
    desc = descripcion(p, en)
    h = base
    h = reemplazar(h, r'<title>.*?</title>', f'<title>{attr(titulo)}</title>', 'title')
    h = reemplazar(h, r'<meta name="description" content="[^"]*" />', f'<meta name="description" content="{attr(desc)}" />', 'description')
    h = reemplazar(h, r'<link rel="canonical" href="[^"]*" />', f'<link rel="canonical" href="{url}" />', 'canonical')
    h = reemplazar(h, r'(<link rel="alternate" hreflang="es" href="[^"]*" />\s*<link rel="alternate" hreflang="en" href="[^"]*" />\s*<link rel="alternate" hreflang="x-default" href="[^"]*" />)', alternos(slug), 'alternos')
    h = reemplazar(h, r'<meta property="og:url" content="[^"]*" />', f'<meta property="og:url" content="{url}" />', 'og:url')
    h = reemplazar(h, r'<meta property="og:title" content="[^"]*" />', f'<meta property="og:title" content="{attr(tit(p, en))}" />', 'og:title')
    h = reemplazar(h, r'<meta property="og:description" content="[^"]*" />', f'<meta property="og:description" content="{attr(desc)}" />', 'og:description')
    h = reemplazar(h, r'<meta property="og:image" content="[^"]*" />', f'<meta property="og:image" content="{imagen}" />', 'og:image')
    h = reemplazar(h, r'<meta property="og:image:alt" content="[^"]*" />', f'<meta property="og:image:alt" content="{attr(tit(p, en))}" />', 'og:image:alt')
    h = reemplazar(h, r'<meta name="twitter:title" content="[^"]*" />', f'<meta name="twitter:title" content="{attr(tit(p, en))}" />', 'twitter:title')
    h = reemplazar(h, r'<meta name="twitter:description" content="[^"]*" />', f'<meta name="twitter:description" content="{attr(desc)}" />', 'twitter:description')
    h = reemplazar(h, r'<meta name="twitter:image" content="[^"]*" />', f'<meta name="twitter:image" content="{imagen}" />', 'twitter:image')
    extra = ''
    if es_gestionada(p):
        extra += '<meta name="robots" content="noindex, follow" />\n'   # ya arrendada: se comparte, pero Google no la ofrece
    extra += '<script type="application/ld+json">\n' + datos_estructurados(p, url, imagen, desc, en) + '\n</script>\n'
    h = reemplazar(h, r'(<link rel="preconnect" href="https://fonts\.googleapis\.com" />)', extra + '<link rel="preconnect" href="https://fonts.googleapis.com" />', 'preconnect fonts')
    titulo_portada = html.unescape(re.search(r'<title>(.*?)</title>', base, re.S).group(1))
    h = reemplazar(h, r'<body>', f'<body data-abrir="{attr(p["id"])}" data-titulo="{attr(titulo_portada)}">', 'body')
    marca = '<!-- Generado por scripts/paginas-lote.py desde index.html y data/properties.json: no editar a mano. -->\n'
    return h.replace('<head>', '<head>\n' + marca, 1) if '<head>' in h else marca + h


def imagen_og(p):
    slug = p['slug']
    destino = RAIZ / 'assets' / 'og' / f'{slug}.jpg'
    if destino.exists():
        return False
    origen = RAIZ / (p.get('media') or {}).get('foto_principal', '')
    if not origen.is_file():
        print(f'  (sin imagen para compartir de {slug}: no existe su foto principal)')
        return False
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix('.tmp.jpg')
    subprocess.run(['sips', '--resampleWidth', '1200', str(origen), '--out', str(tmp)], check=True, capture_output=True)
    alto = int(re.search(r'pixelHeight: (\d+)', subprocess.run(['sips', '-g', 'pixelHeight', str(tmp)], capture_output=True, text=True).stdout).group(1))
    f = ENFOQUE_OG.get(slug, 0.5)
    desfase = max(1, round((alto - 630) * f)) if alto > 630 else 1
    subprocess.run(['sips', '-c', '630', '1200', '--cropOffset', str(desfase), '1', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', str(tmp), '--out', str(destino)], check=True, capture_output=True)
    tmp.unlink(missing_ok=True)
    return True


def sitemap(props):
    hoy = str(date.today())
    filas = [(f'{DOMINIO}/', 'weekly', '1.0'), (f'{DOMINIO}/en', 'weekly', '0.9'), (f'{DOMINIO}/privacidad', 'yearly', '0.2')]
    for p in props:
        if not es_gestionada(p):
            filas.append((f"{DOMINIO}/{p['slug']}", 'weekly', '0.8'))
            filas.append((f"{DOMINIO}/en/{p['slug']}", 'weekly', '0.7'))
    cuerpo = ''.join(f'  <url>\n    <loc>{u}</loc>\n    <lastmod>{hoy}</lastmod>\n    <changefreq>{c}</changefreq>\n    <priority>{pr}</priority>\n  </url>\n' for u, c, pr in filas)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{cuerpo}</urlset>\n'


def main():
    base = (RAIZ / 'index.html').read_text(encoding='utf-8')
    props = [p for p in json.loads((RAIZ / 'data' / 'properties.json').read_text(encoding='utf-8')) if p.get('estado') == 'publicado']
    falta_trad = [p['slug'] for p in props if p['slug'] not in TRAD['props']]
    if falta_trad:
        sys.exit('Falta la traducción al inglés de estas propiedades en scripts/traducciones-en.json: ' + ', '.join(falta_trad))
    base_en, usados = a_ingles(base)
    huerfanas = sorted(k for k in TRAD['html'] if k not in usados and TRAD['html'][k] != k)
    pendientes = sin_traducir(base)
    paginas = [(RAIZ / 'en' / 'index.html', base_en, 'en (portada)')]
    for p in props:
        paginas.append((RAIZ / f"{p['slug']}.html", generar_pagina(base, p, False), p['slug']))
        paginas.append((RAIZ / 'en' / f"{p['slug']}.html", generar_pagina(base_en, p, True), 'en/' + p['slug']))
    desactualizadas = []
    print(f'{"página":58} {"estado":13} {"imagen":10}')
    for ruta, contenido, nombre in paginas:
        igual = ruta.exists() and ruta.read_text(encoding='utf-8') == contenido
        if SOLO_COMPROBAR:
            estado = 'al día' if igual else 'DESACTUALIZADA'
            if not igual: desactualizadas.append(nombre)
            img = ''
        else:
            if not igual:
                ruta.parent.mkdir(parents=True, exist_ok=True)
                ruta.write_text(contenido, encoding='utf-8')
            estado = 'sin cambios' if igual else 'escrita'
            img = ''
        print(f'{nombre[:58]:58} {estado:13} {img:10}')
    for p in props:
        if SOLO_COMPROBAR:
            if not (RAIZ / 'assets' / 'og' / f"{p['slug']}.jpg").exists(): desactualizadas.append('imagen ' + p['slug'])
        else:
            imagen_og(p)
    sm = sitemap(props)
    ruta_sm = RAIZ / 'sitemap.xml'
    urls = lambda s: re.findall(r'<loc>(.*?)</loc>', s)
    cambio_sm = urls(sm) != urls(ruta_sm.read_text(encoding='utf-8') if ruta_sm.exists() else '')
    if cambio_sm and not SOLO_COMPROBAR:
        ruta_sm.write_text(sm, encoding='utf-8')
    print('sitemap.xml:', ('DESACTUALIZADO' if SOLO_COMPROBAR else 'actualizado') if cambio_sm else 'al día', f'({len(urls(sm))} URLs)')
    problemas = False
    if pendientes:
        problemas = True
        print('\nTEXTOS FIJOS SIN TRADUCIR (agrégalos en scripts/traducciones-en.json → "html"):')
        for t in pendientes: print('  -', t[:100])
    if huerfanas:
        print('\nTraducciones que ya no aparecen en index.html (se pueden borrar):')
        for t in huerfanas: print('  -', t[:100])
    usados_js = set(re.findall(r"T\('((?:[^'\\]|\\.)*)'\)", base))
    sin_js = sorted(k for k in usados_js if k not in TRAD['js'])
    if sin_js:
        problemas = True
        print('\nMENSAJES DEL CÓDIGO SIN TRADUCIR (agrégalos en "js"):')
        for t in sin_js: print('  -', t[:100])
    if SOLO_COMPROBAR and (desactualizadas or cambio_sm or problemas):
        sys.exit(1)
    if not SOLO_COMPROBAR:
        print('\nRecuerda: correr este script cada vez que cambie index.html, data/properties.json o scripts/traducciones-en.json.')


if __name__ == '__main__':
    main()
