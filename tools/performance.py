"""Dependency-free budgets for files actually shipped to visitors."""
from pathlib import Path
from collections import defaultdict
import hashlib,json,re

IMAGES={'.jpg','.jpeg','.png','.webp','.avif','.gif','.svg','.bmp','.tif','.tiff','.heic'}
VIDEOS={'.mp4','.webm','.mov','.m4v','.avi'}

def read_policy(path):
    policy=json.loads(Path(path).read_text())
    if policy.get('schemaVersion')!=1:raise ValueError('Unsupported performance budget schema')
    for section in ('fileLimitsBytes','totalLimitsBytes'):
        if not all(isinstance(v,int) and not isinstance(v,bool) and v>0 for v in policy[section].values()):
            raise ValueError('Performance limits must be positive byte counts')
    for key in ('image','imageSmall','imageMedium','videoPoster','video','font','stylesheet','script','html','other'):
        if key not in policy['fileLimitsBytes']:raise ValueError('Missing file budget: '+key)
    for key in ('image','video','package'):
        if key not in policy['totalLimitsBytes']:raise ValueError('Missing total budget: '+key)
    for name,exception in policy['exceptions'].items():
        if Path(name).is_absolute() or '..' in Path(name).parts:raise ValueError('Exception paths must be package-relative')
        if not re.fullmatch('[a-f0-9]{64}',exception.get('sha256','')):raise ValueError('An exception must pin a SHA-256 hash: '+name)
        if not isinstance(exception.get('maxBytes'),int) or exception['maxBytes']<=0 or not exception.get('reason','').strip():raise ValueError('An exception needs a size and reason: '+name)
    return policy

def category(path):
    suffix=path.suffix.lower()
    if suffix in IMAGES:
        if path.stem.endswith('-cover'):return 'image','videoPoster'
        match=re.search(r'-(\d+)$',path.stem)
        if match and int(match[1])<=480:return 'image','imageSmall'
        if match and int(match[1])<=960:return 'image','imageMedium'
        return 'image','image'
    if suffix in VIDEOS:return 'video','video'
    if suffix in ('.woff','.woff2','.ttf','.otf'):return 'font','font'
    if suffix=='.css':return 'stylesheet','stylesheet'
    if suffix in ('.js','.mjs'):return 'script','script'
    if suffix=='.html':return 'html','html'
    return 'other','other'

def size_label(size):return f'{size/1024:.0f} KiB' if size<1024*1024 else f'{size/(1024*1024):.2f} MiB'

def audit(directory,policy):
    directory=Path(directory)
    if not (directory/'index.html').is_file():raise ValueError('Public package missing. Run python3 tools/package-site.py first.')
    errors=[];totals=defaultdict(int);files=[];used_exceptions=[]
    published={p.relative_to(directory).as_posix():p for p in directory.rglob('*') if p.is_file()}
    for name,p in sorted(published.items()):
        size=p.stat().st_size;kind,budget=category(p);limit=policy['fileLimitsBytes'][budget]
        totals[kind]+=size;totals['package']+=size
        if size>limit:
            exception=policy['exceptions'].get(name)
            allowed=bool(exception and size<=exception['maxBytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==exception['sha256'])
            if allowed:used_exceptions.append(name)
            else:
                message=f'{name}: {size_label(size)} exceeds the {budget} limit of {size_label(limit)}.'
                if exception:message+=' The pinned existing-file exception does not cover this changed file.'
                errors.append({'file':name,'message':message+' Optimize the asset or explicitly review data/performance-budgets.json.'})
        files.append({'file':name,'bytes':size,'kind':kind,'budget':budget,'limitBytes':limit})
    for name in policy['exceptions']:
        if name not in published:errors.append({'file':'data/performance-budgets.json','message':f'Remove the obsolete performance exception for {name}; this file is no longer published.'})
    for kind,limit in policy['totalLimitsBytes'].items():
        if totals[kind]>limit:errors.append({'file':'data/performance-budgets.json','message':f'Total {kind}: {size_label(totals[kind])} exceeds {size_label(limit)}. Optimize/remove unused media or explicitly review the total budget.'})
    return {'files':files,'totals':dict(totals),'exceptionsUsed':used_exceptions,'errors':errors}
