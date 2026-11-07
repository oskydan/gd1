"""Regression checks for the validator itself, using disposable data only."""
from pathlib import Path
import copy,json,tempfile,unittest
from camps import read
ROOT=Path(__file__).resolve().parents[1]
class InvalidDataTests(unittest.TestCase):
    def setUp(self):self.data=json.loads((ROOT/'data/camps.json').read_text())
    def rejects(self,change):
        change(self.data)
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'data').mkdir();(root/'data/camps.json').write_text(json.dumps(self.data))
            with self.assertRaises((AssertionError,ValueError,KeyError)):read(root)
    def test_duplicate_id(self):self.rejects(lambda d:d['camps'].append(copy.deepcopy(d['camps'][0])))
    def test_reversed_dates(self):self.rejects(lambda d:d['camps'][0].update(endsOn='2020-01-01'))
    def test_missing_translation(self):self.rejects(lambda d:d['camps'][0]['copy']['uk'].update(title=''))
    def test_missing_registration(self):self.rejects(lambda d:d['camps'][0].update(registrationUrl=''))
    def test_unsafe_registration(self):self.rejects(lambda d:d['camps'][0].update(registrationUrl='javascript:alert(1)'))
    def test_invalid_price(self):self.rejects(lambda d:d['camps'][0]['detail']['prices'][0].update(amount=-1))
    def test_bad_footer_reference(self):self.rejects(lambda d:d['footerCampIds'].append('missing-camp'))
if __name__=='__main__':unittest.main()
