"""Create a clean GitHub Pages artifact without sources, checks or Git files."""
from pathlib import Path
import shutil,json,re
root=Path(__file__).resolve().parents[1]
out=root/'dist'
if out.exists():shutil.rmtree(out)
out.mkdir()
for p in root.iterdir():
    if p.suffix == '.html':
        html = p.read_text()
        if '<meta name="robots" content="noindex, nofollow">' in html:
            continue
        # Use the canonical home path on the hosted site and keep direct file previews working.
        html = re.sub(r'(<a\b[^>]*?\shref=")index\.html(?=[#?"])', r'\1./', html)
        (out/p.name).write_text(html)
    elif p.is_file() and (p.suffix in ('.css','.js') or p.name in ('CNAME','.nojekyll','sitemap.xml','robots.txt')):
        shutil.copy2(p,out/p.name)
# Include the legacy Camps entry point in the GitHub Pages artifact.
(out/'camps').mkdir()
shutil.copy2(root/'camps/index.html',out/'camps/index.html')
manifest=json.loads((root/'data/media.json').read_text()) if (root/'data/media.json').exists() else {'images':{},'videos':{}}
served='\n'.join(p.read_text() for p in out.iterdir() if p.suffix in ('.html','.css','.js'))
replaced={source for group in manifest.values() for source,info in group.items() if source!=info['src'] and source not in served}
for p in (root/'assets').rglob('*'):
    if not p.is_file() or p.relative_to(root).as_posix() in replaced:continue
    target=out/p.relative_to(root);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)

print('Packaged website in dist/.')
