"""Create a clean GitHub Pages artifact without sources, checks or Git files."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
out=root/'dist'
if out.exists():shutil.rmtree(out)
out.mkdir()
for p in root.iterdir():
    if p.is_file() and (p.suffix in ('.html','.css','.js') or p.name in ('CNAME','.nojekyll')):shutil.copy2(p,out/p.name)
shutil.copytree(root/'assets',out/'assets')
print('Packaged website in dist/.')
