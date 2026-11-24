"""Bilingual search copy, with camp locations and dates from central camp data."""
import json
from camps import period

def catalog(root,data):
    result=json.loads((root/'data/search-metadata.json').read_text())
    for camp in data['camps']:
        if not camp['page']:continue
        result[camp['page']]={}
        for lang in ('en','uk'):
            location=camp['copy'][lang]['title']
            city=location.split(',')[0]
            dates=period(camp,lang)
            if lang=='en':
                title=f'{city} Hockey Camp | {dates} | GD1'
                description=f'Power skating hockey camp in {location}, {dates}. 2 on-ice + 2 off-ice sessions daily. See camp fees and registration details.'
            else:
                title=f'Хокейний кемп: {city} | {dates} | GD1'
                description=f'Хокейний кемп GD1: {location}, {dates}. Power skating, 2 тренування на льоду та 2 поза льодом щодня. Вартість та умови реєстрації.'
            result[camp['page']][lang]={'title':title,'description':description}
    return result

def translations(root,data):
    pairs={}
    for page in catalog(root,data).values():
        for key in ('title','description'):pairs[page['en'][key]]=page['uk'][key]
    return pairs
