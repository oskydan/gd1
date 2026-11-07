"""Optional local asset preparation. Requires Pillow and imageio-ffmpeg; CI uses committed outputs."""
from pathlib import Path
import hashlib,json,subprocess,sys,os
from PIL import Image,ImageOps
try:
    import imageio_ffmpeg
except ImportError:
    imageio_ffmpeg=None
ROOT=Path(__file__).resolve().parents[1]
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe() if imageio_ffmpeg else None
if not ffmpeg and '--images-only' not in sys.argv:
    raise SystemExit('Install imageio-ffmpeg for video preparation, or pass --images-only.')
manifest={'images':{},'videos':{}}
if '--images-only' in sys.argv and (ROOT/'data/media.json').exists():
    manifest['videos']=json.loads((ROOT/'data/media.json').read_text()).get('videos',{})
if '--videos-only' in sys.argv and (ROOT/'data/media.json').exists():
    manifest['images']=json.loads((ROOT/'data/media.json').read_text()).get('images',{})
before=after=0
for source in sorted((ROOT/'assets').rglob('*')):
    if not source.is_file() or 'optimized' in source.parts:continue
    relative=source.relative_to(ROOT).as_posix()
    if source.suffix.lower() in ('.jpg','.jpeg','.png') and 'logo' not in source.name.lower() and 'druzhba' not in source.name.lower() and '--videos-only' not in sys.argv:
        with Image.open(source) as opened:
            image=ImageOps.exif_transpose(opened).convert('RGB')
            width,height=image.size
            # Never enlarge an image. Keep one full-size option plus mobile variants.
            widths=sorted(set(min(width,w) for w in (480,960,1600)))
            versions=[]
            for size in widths:
                dest=ROOT/'assets/optimized'/source.relative_to(ROOT/'assets').with_suffix('')
                dest=dest.parent/(dest.name+f'-{size}.webp');dest.parent.mkdir(parents=True,exist_ok=True)
                scaled=image.resize((size,round(height*size/width)),Image.Resampling.LANCZOS)
                scaled.save(dest,'WEBP',quality=83,method=6)
                versions.append({'src':dest.relative_to(ROOT).as_posix(),'width':size})
            manifest['images'][relative]={'src':versions[-1]['src'],'width':width,'height':height,'srcset':', '.join(f'{v["src"]} {v["width"]}w' for v in versions)}
            before+=source.stat().st_size;after+=(ROOT/versions[-1]['src']).stat().st_size
    elif source.suffix.lower()=='.mp4' and ffmpeg and '--images-only' not in sys.argv:
        dest=ROOT/'assets/optimized/videos'/source.name;dest.parent.mkdir(parents=True,exist_ok=True)
        command=[ffmpeg,'-nostdin','-y','-loglevel','error','-i',str(source),'-map','0:v:0','-map','0:a?','-vf','scale=w=min(1280\\,iw):h=min(1280\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2','-c:v','libx264','-preset','medium','-crf','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-map_metadata','-1','-movflags','+faststart',str(dest)]
        subprocess.run(command,check=True)
        if dest.stat().st_size>=source.stat().st_size:
            # Preserve the original streams if re-encoding would make them bigger.
            # Moving the MP4 index to the front still improves streaming startup.
            subprocess.run([ffmpeg,'-nostdin','-y','-loglevel','error','-i',str(source),'-map','0:v:0','-map','0:a?','-c','copy','-map_metadata','-1','-movflags','+faststart',str(dest)],check=True)
            chosen=dest
        else:chosen=dest
        poster=ROOT/'assets/optimized/videos'/(source.stem+'-cover.webp')
        subprocess.run([ffmpeg,'-nostdin','-y','-loglevel','error','-ss','1','-i',str(source),'-frames:v','1','-vf','scale=w=min(960\\,iw):h=min(960\\,ih):force_original_aspect_ratio=decrease','-quality','80',str(poster)],check=True)
        manifest['videos'][relative]={'src':chosen.relative_to(ROOT).as_posix(),'poster':poster.relative_to(ROOT).as_posix()}
        before+=source.stat().st_size;after+=chosen.stat().st_size
        print(f'{source.name}: {source.stat().st_size:,} → {chosen.stat().st_size:,} bytes',flush=True)
(ROOT/'data/media.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f'Main images and videos: {before:,} → {after:,} bytes ({100*(1-after/before):.1f}% smaller).')
