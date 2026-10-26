#!/usr/bin/env python3
"""Genera una página por propiedad (/<slug>) a partir de index.html y data/properties.json.

Qué hace
  1. Por cada propiedad publicada crea <slug>.html: una copia de index.html donde solo cambian el <title>, la
     descripción, el enlace canónico, las etiquetas Open Graph / Twitter (lo que se ve al compartir el enlace), los datos
     estructurados de la propiedad y un atributo data-abrir="<id>" en <body> (la ficha se abre sola al cargar).
  2. Crea la imagen para compartir (1200x630) en assets/og/<slug>.jpg si no existe (usa sips, solo macOS).
  3. Reescribe sitemap.xml con la portada, /privacidad y las propiedades en venta o alquiler.

Cuándo correrlo
  Cada vez que cambie index.html o data/properties.json:   python3 scripts/paginas-lote.py
  Para solo comprobar que están al día (sin escribir):      python3 scripts/paginas-lote.py --check

No necesita instalar nada (solo Python 3 y, para las imágenes, el comando sips de macOS).
"""
import html
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DOMINIO = 'https://www.zulurealstate.com'
SOLO_COMPROBAR = '--check' in sys.argv

# Qué parte vertical de la foto principal se ve en la imagen para compartir (0 = arriba, 0.5 = centro, 1 = abajo).
ENFOQUE_OG = {}


def cop(n):
    return '$' + f'{int(n):,}'.replace(',', '.')


def ultimo_precio(p):
    h = (p.get('precio') or {}).get('precio_historico') or []
    return h[-1]['valor'] if h else None


def es_gestionada(p):
    return p.get('operacion') == 'gestionada'


def frase_precio(p):
    pr = p.get('precio') or {}
    if es_gestionada(p):
        return 'Arrendada por Zulu Real Estate.'
    if pr.get('consultar') or not ultimo_precio(p):
        return 'Alquiler: precio a consultar.' if p.get('operacion') == 'alquiler' else 'Precio a consultar.'
    v = cop(ultimo_precio(p))
    if p.get('operacion') == 'alquiler':
        return f"Alquiler: {v} por {pr.get('periodo') or 'periodo'}."
    return f'Precio: {v} COP.'


def descripcion(p):
    base = (p.get('descripcion_corta') or '').strip().rstrip('.')
    texto = f'{base}. {frase_precio(p)} Zulu Real Estate.'
    if len(texto) > 158:
        # recorta en el límite de una palabra, dejando espacio para la frase de precio
        corto = f'{base}. {frase_precio(p)}'
        if len(corto) > 158:
            corto = corto[:155].rsplit(' ', 1)[0] + '…'
        texto = corto
    return texto


def attr(s):
    return html.escape(s, quote=True)


def datos_estructurados(p, url, imagen, desc):
    u = p.get('ubicacion') or {}
    direccion = {'@type': 'PostalAddress', 'addressCountry': 'CO', 'addressRegion': 'Antioquia'}
    if u.get('municipio'):
        direccion['addressLocality'] = u['municipio']
    if u.get('departamento'):
        direccion['addressRegion'] = u['departamento']
    fotos = [f'{DOMINIO}/{f}' for f in (p.get('media') or {}).get('fotos', [])[:6]] or [imagen]
    d = {
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        'name': p['titulo'],
        'url': url,
        'description': desc,
        'image': fotos,
        'inLanguage': 'es-CO',
        'datePosted': p.get('fecha_creacion') or str(date.today()),
        'about': {'@type': 'Place', 'name': p['titulo'], 'address': direccion},
        'provider': {'@type': 'RealEstateAgent', 'name': 'Zulu Real Estate', 'url': DOMINIO + '/'},
    }
    coords = u.get('coordenadas') or {}
    if coords.get('lat') is not None and coords.get('lng') is not None:
        d['about']['geo'] = {'@type': 'GeoCoordinates', 'latitude': coords['lat'], 'longitude': coords['lng']}
    valor = ultimo_precio(p)
    pr = p.get('precio') or {}
    if valor and not es_gestionada(p) and not pr.get('consultar'):
        oferta = {'@type': 'Offer', 'price': valor, 'priceCurrency': pr.get('moneda') or 'COP',
                  'availability': 'https://schema.org/InStock', 'url': url}
        if p.get('operacion') == 'alquiler' and pr.get('periodo'):
            oferta['priceSpecification'] = {'@type': 'UnitPriceSpecification', 'price': valor,
                                            'priceCurrency': pr.get('moneda') or 'COP',
                                            'unitText': pr['periodo']}
        d['offers'] = oferta
    return json.dumps(d, ensure_ascii=False, indent=2)


def reemplazar(texto, patron, nuevo, nombre):
    resultado, n = re.subn(patron, lambda m: nuevo, texto, count=1, flags=re.S)
    if n != 1:
        sys.exit(f'No encontré "{nombre}" en index.html: el script necesita ajustarse.')
    return resultado


def generar_pagina(base, p):
    slug = p['slug']
    url = f'{DOMINIO}/{slug}'
    imagen = f'{DOMINIO}/assets/og/{slug}.jpg'
    titulo = f"{p['titulo']} | Zulu Real Estate"
    desc = descripcion(p)
    h = base
    h = reemplazar(h, r'<title>.*?</title>', f'<title>{attr(titulo)}</title>', 'title')
    h = reemplazar(h, r'<meta name="description" content="[^"]*" />', f'<meta name="description" content="{attr(desc)}" />', 'description')
    h = reemplazar(h, r'<link rel="canonical" href="[^"]*" />', f'<link rel="canonical" href="{url}" />', 'canonical')
    h = reemplazar(h, r'<meta property="og:url" content="[^"]*" />', f'<meta property="og:url" content="{url}" />', 'og:url')
    h = reemplazar(h, r'<meta property="og:title" content="[^"]*" />', f'<meta property="og:title" content="{attr(p["titulo"])}" />', 'og:title')
    h = reemplazar(h, r'<meta property="og:description" content="[^"]*" />', f'<meta property="og:description" content="{attr(desc)}" />', 'og:description')
    h = reemplazar(h, r'<meta property="og:image" content="[^"]*" />', f'<meta property="og:image" content="{imagen}" />', 'og:image')
    h = reemplazar(h, r'<meta property="og:image:alt" content="[^"]*" />', f'<meta property="og:image:alt" content="{attr(p["titulo"])}" />', 'og:image:alt')
    h = reemplazar(h, r'<meta name="twitter:title" content="[^"]*" />', f'<meta name="twitter:title" content="{attr(p["titulo"])}" />', 'twitter:title')
    h = reemplazar(h, r'<meta name="twitter:description" content="[^"]*" />', f'<meta name="twitter:description" content="{attr(desc)}" />', 'twitter:description')
    h = reemplazar(h, r'<meta name="twitter:image" content="[^"]*" />', f'<meta name="twitter:image" content="{imagen}" />', 'twitter:image')
    extra = ''
    if es_gestionada(p):
        # Propiedad ya arrendada: se puede compartir el enlace, pero no tiene sentido que Google la ofrezca.
        extra += '<meta name="robots" content="noindex, follow" />\n'
    extra += '<script type="application/ld+json">\n' + datos_estructurados(p, url, imagen, desc) + '\n</script>\n'
    h = reemplazar(h, r'(<link rel="preconnect" href="https://fonts\.googleapis\.com" />)', extra + '<link rel="preconnect" href="https://fonts.googleapis.com" />', 'preconnect fonts')
    titulo_portada = re.search(r'<title>(.*?)</title>', base, re.S).group(1)
    h = reemplazar(h, r'<body>', f'<body data-abrir="{attr(p["id"])}" data-titulo="{attr(html.unescape(titulo_portada))}">', 'body')
    marca = f'<!-- Generado por scripts/paginas-lote.py desde index.html y data/properties.json: no editar a mano. -->\n'
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
    filas = [(f'{DOMINIO}/', 'weekly', '1.0'), (f'{DOMINIO}/privacidad', 'yearly', '0.2')]
    for p in props:
        if not es_gestionada(p):
            filas.append((f"{DOMINIO}/{p['slug']}", 'weekly', '0.8'))
    cuerpo = ''.join(f'  <url>\n    <loc>{u}</loc>\n    <lastmod>{hoy}</lastmod>\n    <changefreq>{c}</changefreq>\n    <priority>{pr}</priority>\n  </url>\n' for u, c, pr in filas)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{cuerpo}</urlset>\n'


def main():
    base = (RAIZ / 'index.html').read_text(encoding='utf-8')
    props = [p for p in json.loads((RAIZ / 'data' / 'properties.json').read_text(encoding='utf-8')) if p.get('estado') == 'publicado']
    desactualizadas = []
    print(f'{"propiedad":52} {"página":10} {"imagen":10}')
    for p in props:
        pagina = generar_pagina(base, p)
        ruta = RAIZ / f"{p['slug']}.html"
        igual = ruta.exists() and ruta.read_text(encoding='utf-8') == pagina
        if SOLO_COMPROBAR:
            estado_pag = 'al día' if igual else 'DESACTUALIZADA'
            if not igual:
                desactualizadas.append(p['slug'])
            estado_img = 'ok' if (RAIZ / 'assets' / 'og' / f"{p['slug']}.jpg").exists() else 'FALTA'
        else:
            if not igual:
                ruta.write_text(pagina, encoding='utf-8')
            estado_pag = 'sin cambios' if igual else 'escrita'
            estado_img = 'creada' if imagen_og(p) else 'ya existía'
        print(f'{p["slug"][:52]:52} {estado_pag:10} {estado_img:10}')
    sm = sitemap(props)
    ruta_sm = RAIZ / 'sitemap.xml'
    # lastmod cambia cada día: solo se reescribe si cambió la lista de URLs
    urls = lambda s: re.findall(r'<loc>(.*?)</loc>', s)
    cambio_sm = urls(sm) != urls(ruta_sm.read_text(encoding='utf-8') if ruta_sm.exists() else '')
    if SOLO_COMPROBAR:
        print('sitemap.xml:', 'al día' if not cambio_sm else 'DESACTUALIZADO')
        if desactualizadas or cambio_sm:
            sys.exit(1)
    else:
        if cambio_sm:
            ruta_sm.write_text(sm, encoding='utf-8')
        print('sitemap.xml:', 'actualizado' if cambio_sm else 'sin cambios', f'({len(urls(sm))} URLs)')
        print('\nRecuerda: correr este script cada vez que cambie index.html o data/properties.json.')


if __name__ == '__main__':
    main()
