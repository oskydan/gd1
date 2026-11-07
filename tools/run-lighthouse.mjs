// Use the same pinned Chromium as the browser checks, unless explicitly overridden.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {dirname,delimiter,join,basename} from 'node:path';
import {readFileSync,appendFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const command=fileURLToPath(new URL('../node_modules/@lhci/cli/src/cli.js',import.meta.url));
const child=spawn(process.execPath,[command,'autorun',...process.argv.slice(2)],{
 stdio:'inherit',
 env:{...process.env,CHROME_PATH:process.env.GD1_TEST_CHROME_PATH||process.env.CHROME_PATH||chromium.executablePath(),PATH:dirname(process.execPath)+delimiter+(process.env.PATH||'')}
});
child.on('error',error=>{console.error(error);process.exitCode=1;});
child.on('exit',code=>{
 process.exitCode=code??1;
 const manifest=join(process.cwd(),'lighthouse-report/manifest.json');
 if(process.env.GITHUB_STEP_SUMMARY && existsSync(manifest)){
  try{
   const entries=JSON.parse(readFileSync(manifest,'utf8')).filter(r=>r.isRepresentativeRun);
   let table='## Lighthouse mobile results\n\n| Page | Performance | Accessibility | LCP | CLS | TBT |\n| --- | --- | --- | --- | --- | --- |\n';
   for(const entry of entries){
    const result=JSON.parse(readFileSync(join(process.cwd(),'lighthouse-report',basename(entry.jsonPath)),'utf8'));
    const audits=result.audits;
    table+=`| ${new URL(entry.url).pathname} | ${Math.round(entry.summary.performance*100)} | ${Math.round(entry.summary.accessibility*100)} | ${(audits['largest-contentful-paint'].numericValue/1000).toFixed(2)} s | ${audits['cumulative-layout-shift'].numericValue.toFixed(3)} | ${Math.round(audits['total-blocking-time'].numericValue)} ms |\n`;
   }
   appendFileSync(process.env.GITHUB_STEP_SUMMARY,table+'\nRepresentative median-run values; CI uses three runs per page. Detailed reports are in the quality-report artifact.\n');
  }catch(error){console.warn('Could not summarize Lighthouse reports:',error.message);}
 }
});
