// Emit only the same sanitized result metadata already allowed in artifacts.
// Never print environment variables, URLs with queries, bodies or provider errors.
import {readFileSync} from 'node:fs';
process.on('exit',()=>{
  const mode=process.argv.includes('--public-flight')?'public-flight':process.argv.includes('--live')?'live':'deterministic';
  try {
    const report=JSON.parse(readFileSync(`.ci-results/architecture-${mode}.json`,'utf8'));
    const requests=(report.requests||[]).map(r=>({provider:['gemini','typesafe'].includes(r.provider)?r.provider:'unknown',number:r.number,httpStatus:r.httpStatus,headersMs:r.headersMs,error:r.error}));
    const tests=(report.tests||[]).map(t=>({id:t.id,status:t.status,error:t.error,durationMs:t.durationMs,stepCount:t.stepCount,metrics:t.metrics}));
    console.log('SANITIZED_RESULTS '+JSON.stringify({mode,commit:report.commit,requests,tests}));
  }catch{console.log('SANITIZED_RESULTS unavailable');}
});
