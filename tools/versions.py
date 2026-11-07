"""Content versions for all reusable assets, independent of deployment timestamps."""
from pathlib import Path
import hashlib,re
ASSET=re.compile(r'(assets/[A-Za-z0-9_./-]+\.(?:woff2?|ttf|otf|png|jpe?g|webp|avif|svg|gif|ico))(?:\?v=[A-Za-z0-9]+)?')
ROOT_ASSETS=('styles.css','fonts-cyrillic.css','script.js','gallery.js','analytics.js','camps-data.js','camps-data-uk.js','cache.js')
def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()[:16]
def apply(root,assets_root=None):
    root=Path(root);assets_root=Path(assets_root or root/'assets');memo={}
    def asset(match):
        name=match[1]
        if name not in memo:memo[name]=digest(assets_root/name.removeprefix('assets/'))
        return name+'?v='+memo[name]
    for name in ROOT_ASSETS:
        p=root/name
        if p.exists():p.write_text(ASSET.sub(asset,p.read_text()))
    hashes={name:digest(root/name) for name in ROOT_ASSETS if (root/name).exists()}
    for p in root.glob('*.html'):
        text=ASSET.sub(asset,p.read_text())
        for name,version in hashes.items():
            text=re.sub(r'(?<![A-Za-z0-9_/-])'+re.escape(name)+r'(?:\?v=[A-Za-z0-9]+)?(?=["\s<>])',name+'?v='+version,text)
        p.write_text(text)
