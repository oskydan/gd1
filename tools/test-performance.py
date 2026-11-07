from pathlib import Path
import copy,hashlib,json,tempfile,unittest
from performance import audit,read_policy,category

class PerformanceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        (self.root/'index.html').write_text('<html></html>')
        self.policy=read_policy(Path(__file__).resolve().parents[1]/'data/performance-budgets.json')
        self.policy['exceptions']={}
        self.policy['fileLimitsBytes']={key:100 for key in self.policy['fileLimitsBytes']}
        self.policy['totalLimitsBytes']={'image':1000,'video':1000,'package':10000}
    def put(self,name,size):
        p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'x'*size);return p
    def test_small_file_passes(self):self.put('assets/photo.webp',50);self.assertFalse(audit(self.root,self.policy)['errors'])
    def test_oversized_image_fails(self):self.put('assets/photo.webp',101);self.assertTrue(audit(self.root,self.policy)['errors'])
    def test_oversized_video_fails(self):self.put('assets/movie.mp4',101);self.assertTrue(audit(self.root,self.policy)['errors'])
    def test_boundary_passes(self):self.put('assets/photo.webp',100);self.assertFalse(audit(self.root,self.policy)['errors'])
    def test_cumulative_images_fail(self):
        self.policy['totalLimitsBytes']['image']=150
        self.put('assets/a.webp',80);self.put('assets/b.webp',80)
        self.assertTrue(audit(self.root,self.policy)['errors'])
    def test_pinned_exception_does_not_allow_replacements(self):
        p=self.put('assets/movie.mp4',150)
        self.policy['exceptions']['assets/movie.mp4']={'maxBytes':150,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'reason':'Existing film'}
        self.assertFalse(audit(self.root,self.policy)['errors'])
        p.write_bytes(b'y'*150)
        self.assertTrue(audit(self.root,self.policy)['errors'])
    def test_existing_exceptions_still_count_toward_totals(self):
        p=self.put('assets/movie.mp4',150)
        self.policy['exceptions']['assets/movie.mp4']={'maxBytes':150,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'reason':'Existing film'}
        self.policy['totalLimitsBytes']['video']=120
        self.assertTrue(audit(self.root,self.policy)['errors'])
    def test_missing_package_fails(self):
        (self.root/'index.html').unlink()
        with self.assertRaises(ValueError):audit(self.root,self.policy)
    def test_unpublished_editing_originals_are_not_counted(self):
        self.put('editing-originals/photo.jpg',2000)
        public=self.root/'dist';public.mkdir();(public/'index.html').write_text('<html></html>')
        self.assertFalse(audit(public,self.policy)['errors'])
    def test_responsive_and_cover_limits(self):
        self.assertEqual(category(Path('photo-480.webp'))[1],'imageSmall')
        self.assertEqual(category(Path('photo-960.webp'))[1],'imageMedium')
        self.assertEqual(category(Path('movie-cover.webp'))[1],'videoPoster')
    def test_total_package_catches_incremental_growth(self):
        self.policy['totalLimitsBytes']['package']=100
        self.put('a.js',50);self.put('b.css',50)
        self.assertTrue(audit(self.root,self.policy)['errors'])
if __name__=='__main__':unittest.main()
