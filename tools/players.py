"""Render every player from data/players.json using one shared profile template."""
from html import escape
from pathlib import Path
import json,re

def read(root):
    data=json.loads((root/'data/players.json').read_text())
    assert data['schemaVersion']==1
    ids=set();pages=set()
    for p in data['players']:
        assert re.fullmatch(r'[a-z0-9-]+',p['id']) and p['id'] not in ids
        assert p['page']==p['id']+'.html' and p['page'] not in pages
        assert isinstance(p['draft'],bool)
        assert p['image']['src'].startswith('assets/players/') and '..' not in Path(p['image']['src']).parts
        if (root/'assets').is_dir():assert (root/p['image']['src']).is_file()
        assert p['instagram'].startswith('https://www.instagram.com/')
        for lang in ('en','uk'):
            assert p['copy'][lang]['timeline'] and len(p['copy'][lang]['name'])==2
        ids.add(p['id']);pages.add(p['page'])
    return data['players']

def translations(players):
    result=dict(STORY_TRANSLATIONS)
    def pair(en,uk):
        if isinstance(en,str):result[en]=uk
        elif isinstance(en,list):
            assert len(en)==len(uk)
            for a,b in zip(en,uk):pair(a,b)
        elif isinstance(en,dict):
            assert en.keys()==uk.keys()
            for key in en:pair(en[key],uk[key])
    for p in players:
        pair(p['copy']['en'],p['copy']['uk'])
        result[' '.join(p['copy']['en']['name']).rstrip('.')]=' '.join(p['copy']['uk']['name']).rstrip('.')
        result[p['instagramHandle']]=p['instagramHandle']
        result[p['title']['en']]=p['title']['uk'];result[p['meta']['en']]=p['meta']['uk']
    return result

def main(p):
    c=p['copy']['en'];e=escape
    def heading(parts):return e(parts[0])+'<br><em>'+e(parts[1])+'</em>'
    def paragraph(text):return '<p>'+e(text)+'</p>'
    badges=''.join('<span'+(' title="'+e(b['title'],quote=True)+'"' if b['title'] else '')+(' aria-label="'+e(b['label'],quote=True)+'"' if b['label'] else '')+'>'+e(b['text'])+'</span>' for b in c['badges'])
    instagram=f'<a class="player-profile-instagram" href="{e(p["instagram"],quote=True)}" target="_blank" rel="noopener noreferrer" aria-label="{e(c["instagramLabel"],quote=True)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg><span>{e(p["instagramHandle"])}</span></a>'
    image=p['image']
    hero=f'<section class="player-profile-hero"><div class="player-profile-copy"><p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>{e(c["eyebrow"])}</p><h1>{heading(c["name"])}</h1><p class="player-profile-tagline">{e(c["tagline"])}</p><p class="player-profile-intro">{e(c["intro"])}</p><div class="player-profile-badges">{badges}</div>{instagram}</div><figure class="player-profile-portrait"><img src="{e(image["src"],quote=True)}" srcset="{e(image["srcset"],quote=True)}" sizes="(max-width:800px) 100vw, 50vw" width="{image["width"]}" height="{image["height"]}" alt="{e(c["imageAlt"],quote=True)}" fetchpriority="high" decoding="async"><figcaption>{e(c["photoCaption"])}</figcaption></figure></section>'
    stats='<section class="player-profile-strip">'+''.join('<div><strong>'+e(x['value'])+'</strong><span>'+e(x['label'])+'</span></div>' for x in c['stats'])+'</section>'
    j=c['journey']
    timeline=''.join('<li><span class="player-profile-year">'+e(x['year'])+'</span><div><p class="player-profile-place">'+e(x['team'])+'</p><h3>'+e(x['heading'])+'</h3>'+paragraph(x['body'])+'</div></li>' for x in c['timeline'])
    journey='<section class="wrap player-profile-journey"><div class="player-profile-section-heading"><p class="eyebrow dark"><span class="live-dot" aria-hidden="true"></span>'+e(j['eyebrow'])+'</p><h2>'+heading(j['heading'])+'</h2>'+paragraph(j['intro'])+'</div><ol class="player-profile-timeline">'+timeline+'</ol></section>'
    f=c['foundation'];ending=c['closing']
    foundation='<section class="player-profile-foundation"><div class="wrap"><p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>'+e(f['eyebrow'])+'</p><h2>'+heading(f['heading'])+'</h2><div class="player-profile-narrative">'+''.join('<p'+(' class="player-profile-lead"' if i==0 else '')+'>'+e(text)+'</p>' for i,text in enumerate(f['paragraphs']))+'</div></div></section>'
    closing='<section class="wrap player-profile-closing"><p class="eyebrow dark"><span class="live-dot" aria-hidden="true"></span>'+e(ending['eyebrow'])+'</p><h2>'+heading(ending['heading'])+'</h2>'+paragraph(ending['body'])+'</section>'
    return '<main class="player-profile">'+hero+stats+journey+foundation+closing+'</main>'

def generate(root):
    players=read(root);template=(root/'templates/player-profile.html').read_text()
    for p in players:
        values={'main':main(p),'title':escape(p['title']['en']),'meta':escape(p['meta']['en'],quote=True),'robots':'\n  <meta name="robots" content="noindex, nofollow">' if p['draft'] else ''}
        (root/p['page']).write_text(re.sub(r'\{\{(\w+)\}\}',lambda m:values[m[1]],template))
    generate_stories(root,players)
    return players

STORY_TRANSLATIONS={
    'PLAYER STORIES':'ІСТОРІЇ ГРАВЦІВ',
    'Different beginnings.':'Різний початок.',
    'Shared commitment.':'Спільна відданість.',
    'Meet the players building their game through club hockey, focused training, and time on the ice with GD1.':'Знайомтеся з гравцями, які розвивають свою гру завдяки клубному хокею, цілеспрямованим тренуванням і роботі на льоду з GD1.',
    'player story':'історія гравця', 'player stories':'історії гравців',
    'THE PLAYERS':'НАШІ ГРАВЦІ', 'Every journey is personal.':'Кожен шлях особливий.',
    'Read the story':'Читати історію',
    'More stories begin on the ice.':'Нові історії починаються на льоду.',
    'Discover the training behind the journeys.':'Дізнайтеся про тренування, що стоять за цими історіями.',
    'Explore GD1 camps':'Переглянути кемпи GD1',
    'The first stories are on their way.':'Перші історії вже готуються.',
    'Meet GD1 players and explore their hockey journeys, teams, and development through training camps.':'Познайомтеся з гравцями GD1, їхнім хокейним шляхом, командами та розвитком завдяки тренувальним кемпам.'
}

def stories_main(profiles):
    e=escape;count=len(profiles)
    label='player story' if count==1 else 'player stories'
    hero=f'<section class="stories-hero"><div class="wrap stories-hero-inner"><div><p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>PLAYER STORIES</p><h1>Different beginnings.<br><em>Shared commitment.</em></h1><p class="stories-lead">Meet the players building their game through club hockey, focused training, and time on the ice with GD1.</p></div><div class="stories-count"><strong>{count}</strong><span>{label}</span></div></div></section>'
    cards=[]
    for index,p in enumerate(profiles):
        c=p['copy']['en'];img=p['image'];name=' '.join(c['name']).rstrip('.')
        badges=''.join('<span>'+e(b['text'])+'</span>' for b in c['badges'])
        cards.append(f'<article class="story-card"><a href="{e(p["page"],quote=True)}" class="story-card-link"><div class="story-card-photo"><img src="{e(img["src"],quote=True)}" srcset="{e(img["srcset"],quote=True)}" sizes="(max-width:800px) calc(100vw - 40px), 660px" width="{img["width"]}" height="{img["height"]}" alt="{e(c["imageAlt"],quote=True)}" loading="{"eager" if index==0 else "lazy"}" decoding="async"></div><div class="story-card-copy"><span class="story-card-index" aria-hidden="true">{index+1:02}</span><div class="story-card-badges">{badges}</div><h3>{e(name)}</h3><p class="story-card-tagline">{e(c["tagline"])}</p><p class="story-card-intro">{e(c["intro"])}</p><span class="story-card-action">Read the story</span></div></a></article>')
    listing='<section class="wrap stories-list"><div class="stories-list-heading"><p class="eyebrow dark"><span class="live-dot" aria-hidden="true"></span>THE PLAYERS</p><h2>Every journey is personal.</h2></div>'+(''.join(cards) if cards else '<p>The first stories are on their way.</p>')+'</section>'
    closing='<section class="stories-closing"><div class="wrap"><div><h2>More stories begin on the ice.</h2><p>Discover the training behind the journeys.</p></div><a class="button" href="camps.html">Explore GD1 camps</a></div></section>'
    return '<main class="player-stories-index">'+hero+listing+closing+'</main>'

def generate_stories(root,profiles):
    path=root/'player-stories.html'
    if not path.exists():return
    source=path.read_text()
    source=re.sub(r'<main\b[^>]*>.*?</main>',lambda _:stories_main([p for p in profiles if not p['draft']]),source,flags=re.S)
    source=re.sub(r'<meta name="description" content="[^"]*">','<meta name="description" content="Meet GD1 players and explore their hockey journeys, teams, and development through training camps.">',source)
    if 'href="player-stories.css' not in source:source=source.replace('</head>','  <link rel="stylesheet" href="player-stories.css">\n</head>')
    path.write_text(source)
