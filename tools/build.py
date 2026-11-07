#!/usr/bin/env python3
"""Build static camp content and Ukrainian pages; --check detects stale output."""
from pathlib import Path
from html import escape
import hashlib, json, re, shutil, subprocess, sys, tempfile
from camps import read, runtime, main_html, period
import media
import seo

ROOT=Path(__file__).resolve().parents[1]

def generate(root):
    data=read(root)
    manifest=media.load(root)
    media.styles(root,manifest)
    en=[runtime(c,'en') for c in data['camps']]
    uk=[runtime(c,'uk') for c in data['camps']]
    media.cards(en,manifest)
    media.cards(uk,manifest)
    def write(name,text): (root/name).write_text(text)
    write('camps-data.js','// Generated from data/camps.json. Run python3 tools/build.py.\nwindow.GD1_CAMPS = '+json.dumps(en,ensure_ascii=False,indent=2)+';\n')
    write('camps-data-uk.js',"// Generated from data/camps.json.\nif (document.documentElement.lang === 'uk') {\n  window.GD1_CAMPS = "+json.dumps(uk,ensure_ascii=False,indent=2)+';\n}\n')
    template=(root/'templates/camp.html').read_text()
    camps={c['id']:c for c in data['camps']}
    footer=[]
    for id in sorted(data['footerCampIds'],key=lambda id:camps[id]['startsOn']):
        c=camps[id]
        footer.append(f'<a href="camps.html#{id}">{escape(c["copy"]["en"]["title"].split(",")[0])} <span>{period(c)}</span></a>')
    for c in data['camps']:
        if not c['page']:continue
        replacements={'id':escape(c['id']),'title':escape(c['copy']['en']['title']+' | GD1 Camp'),'meta':escape(c['copy']['en']['meta'],quote=True),'bodyClass':escape(c['detail']['bodyClass']),'main':main_html(c,data),'page':c['page'],'ukPage':c['page'].replace('.html','-uk.html'),'footerCamps':''.join(footer)}
        html=re.sub(r'\{\{(\w+)\}\}',lambda m:replacements[m[1]],template)
        write(c['page'],html)
    for p in root.glob('*.html'):
        if p.name.endswith('-uk.html'):continue
        s=media.html(p.read_text(),manifest)
        s,n=re.subn(r'(<nav class="footer-links" aria-label="Upcoming camps">).*?(</nav>)',lambda m:m[1]+''.join(footer)+m[2],s,flags=re.S)
        assert n==1,f'{p.name}: footer camp navigation missing'
        for asset in ('camps-data.js','script.js','analytics.js','styles.css','gallery.js'):
            version=hashlib.sha256((root/asset).read_bytes()).hexdigest()[:10]
            s=re.sub(re.escape(asset)+r'\?v=[^"\s]+',asset+'?v='+version,s)
        p.write_text(s)
    subprocess.run([sys.executable,str(root/'build-uk.py')],check=True)
    seo.generate(root,data)

if __name__=='__main__':
    if '--check' in sys.argv:
        with tempfile.TemporaryDirectory(prefix='gd1-check-') as folder:
            temp=Path(folder)
            for p in ROOT.iterdir():
                if p.name in ('.git','assets','dist','__pycache__'):continue
                if p.is_dir():shutil.copytree(p,temp/p.name,ignore=shutil.ignore_patterns('__pycache__'))
                else:shutil.copy2(p,temp/p.name)
            generate(temp)
            changed=[p.name for p in temp.iterdir() if p.is_file() and (p.suffix in ('.html','.js','.css','.xml') or p.name=='robots.txt') and (not (ROOT/p.name).exists() or p.read_bytes()!=(ROOT/p.name).read_bytes())]
            if changed:raise SystemExit('Generated files are stale. Run python3 tools/build.py:\n'+ '\n'.join(changed))
            print('Generated camp content and Ukrainian translations are up to date.')
    else:generate(ROOT)
