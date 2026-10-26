import {readFileSync} from 'node:fs';
import {z} from 'zod';
import {meterlessBaseUrl} from './meterless';

export const REPORT_INFERENCE_CONSENT_PATH='.runtime/mission/report-inference-consent.json';
export const ReportInferenceConsent=z.object({
  version:z.literal(1),enabled:z.boolean(),scope:z.literal('report_text'),provider:z.literal('nvidia-nemotron'),
  projectUid:z.string().regex(/^[a-zA-Z0-9]{8,64}$/),proxyBaseUrl:z.string().url(),
  quoteExport:z.literal('local_only'),authorizedAt:z.iso.datetime(),authorization:z.literal('explicit-local-operator'),
}).strict();
export type ReportInferenceConsent=z.infer<typeof ReportInferenceConsent>;
export function loadReportInferenceConsent(path=REPORT_INFERENCE_CONSENT_PATH):ReportInferenceConsent|null {
  try {return ReportInferenceConsent.parse(JSON.parse(readFileSync(path,'utf8')));}catch{return null;}
}
export function privateInferenceAllowed(consent:ReportInferenceConsent|null|undefined,projectUid:string,baseUrl:string|undefined) {
  if(!consent?.enabled || !baseUrl || consent.projectUid!==projectUid)return false;
  const checked=ReportInferenceConsent.safeParse(consent);if(!checked.success)return false;
  try{return meterlessBaseUrl(baseUrl)===checked.data.proxyBaseUrl;}catch{return false;}
}
