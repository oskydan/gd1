"""Regenerate Ukrainian HTML after editing English pages or translations-uk.json."""
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import json
import re
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parent
PAGES = ['index.html', 'camps.html', 'coach.html', 'school.html', 'gallery.html',
         'contact.html', 'prague-czech-republic-dec-2026.html']
CATALOG = json.loads((ROOT / 'translations-uk.json').read_text())
CATALOG.update({'English': 'Англійська', 'Ukrainian': 'Українська'})


def uk_name(name):
    return name.replace('.html', '-uk.html')


def switcher(name, language):
    en = f'<a class="language-option" href="{name}" lang="en" hreflang="en" aria-label="English">EN</a>'
    uk = f'<a class="language-option" href="{uk_name(name)}" lang="uk" hreflang="uk" aria-label="Українська">УК</a>'
    if language == 'en':
        en = '<span class="language-option is-current" lang="en" aria-current="true" aria-label="English (current language)">EN</span>'
    else:
        uk = '<span class="language-option is-current" lang="uk" aria-current="true" aria-label="Українська (поточна мова)">УК</span>'
    label = 'Language' if language == 'en' else 'Мова'
    return f'<div class="language-switcher" role="group" aria-label="{label}">{en}<span class="language-divider" aria-hidden="true">/</span>{uk}</div>'


class Translator(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.skip = 0

    def translate(self, value):
        stripped = value.strip()
        if stripped and any(c.isalpha() for c in stripped) and stripped not in CATALOG and stripped not in CATALOG.values():
            raise ValueError('Missing Ukrainian translation: ' + stripped)
        return value.replace(stripped, CATALOG.get(stripped, stripped), 1) if stripped else value

    def handle_starttag(self, tag, attrs):
        raw = self.get_starttag_text()
        values = dict(attrs)
        for key, value in attrs:
            translated = value
            if key in ('alt', 'aria-label', 'title') or (tag == 'meta' and key == 'content' and values.get('name') == 'description'):
                translated = self.translate(value)
            elif tag == 'html' and key == 'lang':
                translated = 'uk'
            elif tag == 'a' and key == 'href':
                url = urlsplit(value)
                if not url.scheme and not url.netloc and url.path in PAGES:
                    translated = urlunsplit(('', '', uk_name(url.path), url.query, url.fragment))
            if translated != value:
                raw = re.sub(r'\b' + re.escape(key) + r'=("[^"]*"|\x27[^\x27]*\x27)',
                             lambda _: key + '="' + escape(translated, quote=True) + '"', raw, count=1)
        self.parts.append(raw)
        if tag in ('script', 'style'):
            self.skip += 1

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        self.parts.append('</' + tag + '>')
        if tag in ('script', 'style'):
            self.skip -= 1

    def handle_data(self, data):
        if self.skip:
            self.parts.append(data)
        else:
            self.parts.append(escape(self.translate(data).replace('€400', '400 €').replace('€75', '75 €'), quote=False))

    def handle_decl(self, decl):
        self.parts.append('<!' + decl + '>')

    def handle_comment(self, comment):
        self.parts.append('<!--' + comment + '-->')


for name in PAGES:
    page = ROOT / name
    source = page.read_text()
    source = re.sub(r'<div class="language-switcher".*?</div>', switcher(name, 'en'), source, flags=re.S)
    source = re.sub(r'styles\.css\?v=\d+', 'styles.css?v=131', source)
    source = re.sub(r'(?<![\w-])script\.js\?v=\d+', 'script.js?v=33', source)
    source = re.sub(r'analytics\.js\?v=\d+', 'analytics.js?v=5', source)
    source = re.sub(r'\s*<link rel="alternate"[^>]*>', '', source)
    alternates = f'  <link rel="alternate" hreflang="en" href="{name}">\n  <link rel="alternate" hreflang="uk" href="{uk_name(name)}">\n'
    source = source.replace('</head>', alternates + '</head>')
    page.write_text(source)
    translator = Translator()
    translator.feed(source)
    translated = ''.join(translator.parts)
    translated = re.sub(r'<div class="language-switcher".*?</div>', switcher(name, 'uk'), translated, flags=re.S)
    translated = translated.replace('</head>', '  <link rel="stylesheet" href="fonts-cyrillic.css?v=1">\n  <link rel="preload" href="assets/fonts/inter-cyrillic.woff2" as="font" type="font/woff2" crossorigin>\n  <link rel="preload" href="assets/fonts/oswald-cyrillic.woff2" as="font" type="font/woff2" crossorigin>\n</head>')
    translated = translated.replace('  <script src="script.js?v=33">', '  <script src="camps-data-uk.js?v=1"></script>\n  <script src="script.js?v=33">')
    (ROOT / uk_name(name)).write_text(translated)

print('Generated seven Ukrainian pages and enabled matching language links.')
