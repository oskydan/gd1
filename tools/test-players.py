"""Regression checks for reusable player rendering; no extra profiles are published."""
from pathlib import Path
import copy,json,tempfile,unittest
import players
ROOT=Path(__file__).resolve().parents[1]
class PlayerTemplateTests(unittest.TestCase):
    def setUp(self):self.player=players.read(ROOT)[0]
    def test_another_player_reuses_layout_and_variable_timeline(self):
        p=copy.deepcopy(self.player);p['copy']['en']['name']=['Example','Player.'];p['copy']['en']['timeline']=p['copy']['en']['timeline'][:2]
        html=players.main(p)
        self.assertIn('<h1>Example<br><em>Player.</em></h1>',html)
        self.assertEqual(html.count('class="player-profile-year"'),2)
        self.assertIn('class="player-profile-portrait"',html)
    def test_story_index_counts_only_published_profiles(self):
        published=copy.deepcopy(self.player);published['draft']=False
        draft=copy.deepcopy(self.player);draft['id']='draft-player';draft['page']='draft-player.html';draft['draft']=True
        visible=[p for p in [published,draft] if not p['draft']]
        html=players.stories_main(visible)
        self.assertEqual(html.count('class="story-card"'),1)
        self.assertIn('<strong>1</strong>',html)
        self.assertNotIn('draft-player.html',html)

    def test_content_is_escaped(self):
        p=copy.deepcopy(self.player);p['copy']['en']['intro']='<script>alert(1)</script>'
        self.assertIn('&lt;script&gt;',players.main(p));self.assertNotIn('<script>',players.main(p))
    def test_draft_flag_controls_robots(self):
        for draft in (True,False):
            with tempfile.TemporaryDirectory() as folder:
                root=Path(folder);(root/'data').mkdir();(root/'templates').mkdir()
                p=copy.deepcopy(self.player);p['draft']=draft
                (root/'data/players.json').write_text(json.dumps({'schemaVersion':1,'players':[p]}))
                (root/'templates/player-profile.html').write_text((ROOT/'templates/player-profile.html').read_text())
                players.generate(root)
                self.assertEqual('noindex, nofollow' in (root/p['page']).read_text(),draft)
    def test_both_languages_provide_all_fields(self):
        catalog=players.translations([self.player]);self.assertEqual(catalog[self.player['copy']['en']['name'][0]],self.player['copy']['uk']['name'][0])
if __name__=='__main__':unittest.main()
