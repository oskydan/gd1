"""Create a clean GitHub Pages artifact without sources, checks or Git files."""
from pathlib import Path
import shutil,json
root=Path(__file__).resolve().parents[1]
out=root/'dist'
if out.exists():shutil.rmtree(out)
out.mkdir()
for p in root.iterdir():
    if p.is_file() and (p.suffix in ('.html','.css','.js') or p.name in ('CNAME','.nojekyll')):shutil.copy2(p,out/p.name)
manifest=json.loads((root/'data/media.json').read_text()) if (root/'data/media.json').exists() else {'images':{},'videos':{}}
served='\n'.join(p.read_text() for p in out.iterdir() if p.suffix in ('.html','.css','.js'))
replaced={source for group in manifest.values() for source,info in group.items() if source!=info['src'] and source not in served}
for p in (root/'assets').rglob('*'):
    if not p.is_file() or p.relative_to(root).as_posix() in replaced:continue
    target=out/p.relative_to(root);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)

print('Packaged website in dist/.')
