import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {configuredKobo} from '../src/lib/server/kobo';
import {configuredNightshift} from '../src/lib/server/runtime-config';
import {ReportInferenceConsent,REPORT_INFERENCE_CONSENT_PATH} from '../src/lib/server/report-inference-policy';

const source=configuredKobo(),provider=configuredNightshift();
const projectUid=source.sourceId.slice('kobo:'.length);
if(!process.argv.includes('--apply')) {
  console.log(JSON.stringify({plan:'Enable only after the local operator has authorized private report_text processing.',projectUid,
    proxyBaseUrl:provider.baseUrl,provider:'NVIDIA Nemotron',scope:'report_text only',quotes:'Local journal/operator inspection only; excluded from shared reports and GitHub.'}));
  process.exit(0);
}
const value=ReportInferenceConsent.parse({version:1,enabled:true,scope:'report_text',provider:'nvidia-nemotron',projectUid,
  proxyBaseUrl:provider.baseUrl,quoteExport:'local_only',authorizedAt:new Date().toISOString(),authorization:'explicit-local-operator'});
mkdirSync(dirname(REPORT_INFERENCE_CONSENT_PATH),{recursive:true});writeFileSync(REPORT_INFERENCE_CONSENT_PATH,JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({enabled:true,scope:'report_text',boundToConfiguredProjectAndProvider:true,privateQuotesExported:false}));
