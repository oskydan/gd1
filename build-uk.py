"""Regenerate Ukrainian HTML after editing English pages or translations-uk.json."""
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import sys
import hashlib
sys.path.insert(0, str(Path(__file__).resolve().parent / "tools"))
from camps import read, translations
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parent
PAGES = ['index.html', 'camps.html', 'coach.html', 'school.html', 'gallery.html', 'contact.html']
CATALOG = json.loads((ROOT / 'translations-uk.json').read_text())
CATALOG.update(translations(read(ROOT)))
CATALOG.update({'English': 'Англійська', 'Ukrainian': 'Українська', 'Choose language': 'Обрати мову'})
SWITCHER_PATTERN = r'<div class="language-switcher".*?</div>|<details class="language-switcher".*?</details>'


def uk_name(name):
    return name.replace('.html', '-uk.html')


def switcher(name, language):
    en = f'<a class="language-option" href="{name}" lang="en" hreflang="en" aria-label="English">English</a>'
    uk = f'<a class="language-option" href="{uk_name(name)}" lang="uk" hreflang="uk" aria-label="Українська">Українська</a>'
    if language == 'en':
        en = '<span class="language-option is-current" lang="en" aria-current="true" aria-label="English (current language)">English</span>'
    else:
        uk = '<span class="language-option is-current" lang="uk" aria-current="true" aria-label="Українська (поточна мова)">Українська</span>'
    label = 'Choose language' if language == 'en' else 'Обрати мову'
    current = 'ENG' if language == 'en' else 'УКР'
    globe = '<svg class="language-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>'
    return f'<details class="language-switcher"><summary class="language-toggle" aria-label="{label}">{globe}<span lang="{language}">{current}</span></summary><div class="language-menu">{en}{uk}</div></details>'


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


PAGES = PAGES + [c["page"] for c in read(ROOT)["camps"] if c["page"]]

for name in PAGES:
    page = ROOT / name
    source = page.read_text()
    source = re.sub(SWITCHER_PATTERN, switcher(name, 'en'), source, flags=re.S)
    source = re.sub(r'\s*<link rel="alternate"[^>]*>', '', source)
    alternates = f'  <link rel="alternate" hreflang="en" href="{name}">\n  <link rel="alternate" hreflang="uk" href="{uk_name(name)}">\n'
    source = source.replace('</head>', alternates + '</head>')
    page.write_text(source)
    translator = Translator()
    translator.feed(source)
    translated = ''.join(translator.parts)
    translated = re.sub(SWITCHER_PATTERN, switcher(name, 'uk'), translated, flags=re.S)
    translated = translated.replace('</head>', '  <link rel="stylesheet" href="fonts-cyrillic.css?v=1">\n  <link rel="preload" href="assets/fonts/inter-cyrillic.woff2" as="font" type="font/woff2" crossorigin>\n  <link rel="preload" href="assets/fonts/oswald-cyrillic.woff2" as="font" type="font/woff2" crossorigin>\n</head>')
    version = hashlib.sha256((ROOT / 'camps-data-uk.js').read_bytes()).hexdigest()[:10]
    translated = re.sub(r'(  <script src="script\.js\?v=[^"]+">)', lambda m: f'  <script src="camps-data-uk.js?v={version}"></script>\n' + m[1], translated)
    (ROOT / uk_name(name)).write_text(translated)

print('Generated Ukrainian pages and enabled matching language links.')
