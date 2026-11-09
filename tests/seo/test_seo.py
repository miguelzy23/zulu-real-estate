#!/usr/bin/env python3
"""Pruebas de SEO de las páginas generadas. Solo biblioteca estándar. Correr desde la raíz:  python3 tests/seo/test_seo.py
Comprueba: descripciones completas (sin cortar), un H1 propio por ficha, títulos únicos, sitemap con fechas reales y URLs coherentes
con cada página, datos estructurados válidos y la página 404."""
import json, re, subprocess, sys, unittest
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent.parent
PROPS = [p for p in json.loads((RAIZ / 'data' / 'properties.json').read_text(encoding='utf-8')) if p.get('estado') == 'publicado']


def leer(ruta):
    return (RAIZ / ruta).read_text(encoding='utf-8')


def meta(html, nombre, attr='name'):
    m = re.search(r'<meta %s="%s" content="([^"]*)"' % (attr, re.escape(nombre)), html)
    return m.group(1) if m else None


def paginas_propiedad():
    for p in PROPS:
        yield p, p['slug'] + '.html', False
        yield p, 'en/' + p['slug'] + '.html', True


class PaginasDePropiedad(unittest.TestCase):
    def test_descripciones_completas_y_del_largo_correcto(self):
        for p, ruta, en in paginas_propiedad():
            h = leer(ruta); d = meta(h, 'description')
            with self.subTest(ruta):
                self.assertIsNotNone(d)
                self.assertLessEqual(len(d), 160, 'la descripción pasa de 160 caracteres')
                self.assertGreaterEqual(len(d), 70, 'la descripción es demasiado corta')
                self.assertNotIn('…', d, 'la descripción termina cortada con puntos suspensivos')
                self.assertTrue(d.endswith('.'), 'la descripción debe terminar en frase completa: ' + d[-30:])
                self.assertEqual(meta(h, 'og:description', 'property'), d, 'og:description debe igualar la descripción')
                self.assertEqual(meta(h, 'twitter:description'), d)

    def test_datos_estructurados_validos_y_coherentes(self):
        for p, ruta, en in paginas_propiedad():
            h = leer(ruta); d = meta(h, 'description')
            bloques = re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)
            with self.subTest(ruta):
                self.assertGreaterEqual(len(bloques), 1)
                datos = [json.loads(b) for b in bloques]
                textos = json.dumps(datos, ensure_ascii=False)
                self.assertNotIn('…', textos)
                self.assertIn(d.replace('"', '\\"') if '"' in d else d, textos, 'el JSON-LD debe llevar la misma descripción')

    def test_cada_ficha_tiene_su_propio_h1(self):
        vistos = {}   # único dentro de cada idioma (los nombres propios coinciden entre español e inglés y están enlazados como alternos)
        for p, ruta, en in paginas_propiedad():
            h1 = re.sub(r'<[^>]+>', '', re.search(r'<h1[^>]*>(.*?)</h1>', leer(ruta), re.S).group(1)).strip()
            titulo = (json.loads((RAIZ / 'scripts' / 'traducciones-en.json').read_text(encoding='utf-8'))['props'][p['slug']]['titulo'] if en else p['titulo'])
            with self.subTest(ruta):
                self.assertIn(titulo, h1, 'el H1 debe llevar el título de la propiedad')
                self.assertNotIn('lotes, fincas y propiedades en Antioquia', h1, 'no debe repetir el H1 genérico de la portada')
                self.assertNotIn((en, h1), vistos, 'H1 repetido con ' + str(vistos.get((en, h1), '')))
                vistos[(en, h1)] = ruta

    def test_portada_conserva_su_h1(self):
        h1 = re.sub(r'<[^>]+>', '', re.search(r'<h1[^>]*>(.*?)</h1>', leer('index.html'), re.S).group(1))
        self.assertIn('lotes, fincas y propiedades en Antioquia', h1)

    def test_titulos_unicos_dentro_de_cada_idioma(self):
        for idioma, rutas in (('es', ['index.html', 'privacidad.html'] + [p['slug'] + '.html' for p in PROPS]),
                              ('en', ['en/index.html'] + ['en/' + p['slug'] + '.html' for p in PROPS])):
            titulos = {}
            for ruta in rutas:
                t = re.search(r'<title>(.*?)</title>', leer(ruta), re.S).group(1)
                with self.subTest(ruta):
                    self.assertNotIn(t, titulos, '%s repite el título de %s' % (ruta, titulos.get(t)))
                titulos[t] = ruta

    def test_oficinas_arrendadas_siguen_sin_indexar(self):
        for p, ruta, en in paginas_propiedad():
            if p.get('operacion') == 'gestionada':
                self.assertIn('noindex', meta(leer(ruta), 'robots') or '', ruta)


class Sitemap(unittest.TestCase):
    def setUp(self):
        self.xml = leer('sitemap.xml')
        self.urls = re.findall(r'<url>\s*<loc>(.*?)</loc>\s*<lastmod>(.*?)</lastmod>', self.xml)

    def test_fechas_reales(self):
        self.assertGreaterEqual(len(self.urls), 10)
        for loc, lm in self.urls:
            with self.subTest(loc):
                self.assertRegex(lm, r'^\d{4}-\d{2}-\d{2}$')
                self.assertLessEqual(lm, str(date.today()), 'lastmod en el futuro')

    def test_cada_url_tiene_su_pagina_y_su_canonica(self):
        for loc, _ in self.urls:
            ruta = loc.replace('https://www.zulurealstate.com', '').strip('/')
            ruta = 'index.html' if ruta == '' else ('en/index.html' if ruta == 'en' else ruta + '.html')
            with self.subTest(loc):
                self.assertTrue((RAIZ / ruta).exists(), 'no existe ' + ruta)
                self.assertIn('<link rel="canonical" href="%s"' % loc, leer(ruta))

    def test_no_incluye_paginas_noindex(self):
        for p, ruta, en in paginas_propiedad():
            if p.get('operacion') == 'gestionada':
                self.assertNotIn(p['slug'], self.xml)


def es_superficial():
    return subprocess.run(['git', 'rev-parse', '--is-shallow-repository'], cwd=RAIZ, capture_output=True, text=True).stdout.strip() == 'true'


class ComprobacionDelGenerador(unittest.TestCase):
    """`paginas-lote.py --check` debe detectar páginas desactualizadas y fechas atrasadas del sitemap."""

    def correr_check(self):
        return subprocess.run([sys.executable, str(RAIZ / 'scripts' / 'paginas-lote.py'), '--check'], cwd=RAIZ, capture_output=True, text=True)

    def test_el_estado_actual_pasa(self):
        r = self.correr_check()
        self.assertEqual(r.returncode, 0, r.stdout[-600:] + r.stderr[-300:])

    @unittest.skipIf(es_superficial(), 'repositorio superficial: git no da fechas fiables')
    def test_una_fecha_atrasada_del_sitemap_hace_fallar_el_check(self):
        ruta = RAIZ / 'sitemap.xml'; original = ruta.read_text(encoding='utf-8')
        try:
            ruta.write_text(re.sub(r'<lastmod>[^<]*</lastmod>', '<lastmod>2020-01-01</lastmod>', original, count=1), encoding='utf-8')   # una sola fecha vieja
            r = self.correr_check()
            self.assertNotEqual(r.returncode, 0, 'el check debe fallar con una fecha atrasada')
            self.assertIn('fecha atrasada', r.stdout)
        finally:
            ruta.write_text(original, encoding='utf-8')
        self.assertEqual(self.correr_check().returncode, 0, 'tras restaurar vuelve a pasar')


class Pagina404(unittest.TestCase):
    def test_existe_y_esta_bien_formada(self):
        h = leer('404.html')
        self.assertIn('<title>Página no encontrada', h)
        self.assertIn('noindex', meta(h, 'robots'))
        self.assertIn('href="/"', h, 'debe enlazar a la portada')
        self.assertIn('lang="es"', h)


if __name__ == '__main__':
    unittest.main(verbosity=1)
