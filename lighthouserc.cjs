const detail=require('./data/camps.json').camps.filter(c=>c.page).sort((a,b)=>a.startsOn.localeCompare(b.startsOn))[0]?.page.replace(/\.html$/,'');
const pages=['index','camps','school','coach','gallery','contact',...(detail?[detail]:[])];
module.exports={ci:{
 collect:{
  ...(process.env.GD1_TEST_CHROME_PATH?{chromePath:process.env.GD1_TEST_CHROME_PATH}:{}),
  startServerCommand:`"${process.execPath}" tools/browser-server.mjs`,
  startServerReadyPattern:'GD1 test server',
  url:pages.flatMap(p=>['','-uk'].map(s=>`http://127.0.0.1:4173/${p}${s}.html`)),
  numberOfRuns:3,
  settings:{formFactor:'mobile',chromeFlags:'--headless --no-sandbox',onlyCategories:['performance','accessibility'],throttlingMethod:'simulate'}
 },
 assert:{assertions:{
  'categories:performance':['error',{minScore:0.9,aggregationMethod:'median-run'}],
  'categories:accessibility':['error',{minScore:1,aggregationMethod:'median-run'}],
  'largest-contentful-paint':['error',{maxNumericValue:3500,aggregationMethod:'median-run'}],
  'cumulative-layout-shift':['error',{maxNumericValue:0.1,aggregationMethod:'median-run'}],
  'total-blocking-time':['error',{maxNumericValue:200,aggregationMethod:'median-run'}]
 }},
 upload:{target:'filesystem',outputDir:'lighthouse-report'}
}};
