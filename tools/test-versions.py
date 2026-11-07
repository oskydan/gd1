import unittest,tempfile
from pathlib import Path
from versions import apply,digest
class Versions(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
  (self.root/'assets').mkdir();(self.root/'assets/picture.webp').write_bytes(b'image');(self.root/'assets/font.woff2').write_bytes(b'font')
  (self.root/'styles.css').write_text("body{background:url('assets/picture.webp')}@font-face{src:url(assets/font.woff2)}")
  (self.root/'script.js').write_text('const image="assets/picture.webp";')
  (self.root/'index.html').write_text('<link href="styles.css?v=old"><img src="assets/picture.webp"><script src="script.js?v=old"></script>')
 def test_idempotent(self):
  apply(self.root);before={p.name:p.read_bytes() for p in self.root.iterdir() if p.is_file()};apply(self.root)
  self.assertEqual(before,{p.name:p.read_bytes() for p in self.root.iterdir() if p.is_file()})
 def test_dependency_change_updates_css_script_and_html(self):
  apply(self.root);old=(self.root/'index.html').read_text();old_font=digest(self.root/'assets/font.woff2')
  (self.root/'assets/picture.webp').write_bytes(b'new image');apply(self.root)
  self.assertNotEqual(old,(self.root/'index.html').read_text());self.assertIn(digest(self.root/'styles.css'),(self.root/'index.html').read_text());self.assertIn(digest(self.root/'script.js'),(self.root/'index.html').read_text());self.assertIn(old_font,(self.root/'styles.css').read_text())
 def test_no_timestamp_churn(self):
  apply(self.root);old=(self.root/'index.html').read_bytes();(self.root/'assets/picture.webp').touch();apply(self.root);self.assertEqual(old,(self.root/'index.html').read_bytes())
 def test_separate_asset_root_for_readonly_build_check(self):
  assets=self.root/'assets';other=self.root/'temp';other.mkdir();(other/'index.html').write_text('<img src="assets/picture.webp">');apply(other,assets);self.assertIn(digest(assets/'picture.webp'),(other/'index.html').read_text())
 def test_srcset_and_existing_versions(self):
  p=self.root/'index.html';p.write_text('<img srcset="assets/picture.webp?v=old 480w, assets/picture.webp 960w">');apply(self.root);self.assertEqual(p.read_text().count('?v='),2);self.assertNotIn('old',p.read_text())
if __name__=='__main__':unittest.main()
