import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { MissionJournal } from './mission-journal';
export const planDigest = (markdown: string) => createHash('sha256').update(markdown).digest('hex');
const hash = z.string().regex(/^[a-f0-9]{64}$/), id = z.string().min(1).max(150);
export const ReviewSubmissionSchema = z.object({
  requestId: z.uuid(), runId: id, planId: id, version: z.number().int().positive(), planSha256: hash,
  evidenceRevision: hash, requirementsRevision: hash.nullable(), calculationId: id.nullable(),
  decision: z.enum(['approve', 'reject', 'request_changes']), comment: z.string().trim().max(600), acknowledgedHolds: z.boolean(),
}).strict();
export type ReviewSubmission = z.infer<typeof ReviewSubmissionSchema>;
export type OperatorReview = ReviewSubmission & { id: string; actor: 'local_operator'; scope: 'committee_proposal_only';
  status: 'active' | 'invalidated' | 'expired' | 'superseded'; reason: string | null; createdAt: string; validUntil: string | null;
  refreshedAt: string | null; dispatchAuthorized: false; replacementRunId?: string | null };
export type ReviewCandidate = { runId: string; planId: string; version: number; planSha256: string; evidenceRevision: string;
  requirementsRevision: string | null; calculationId: string | null; canReview: boolean; canApprove: boolean; reasons: string[] };
export class ReviewError extends Error { readonly status = 409; }

export function reviewCandidate(journal: MissionJournal, runId: string, now = Date.now()): ReviewCandidate | null {
  const run = journal.run(runId), plan = journal.documents(runId).filter(d => d.runId === runId && d.kind === 'plan' && d.status === 'published').at(-1);
  if (!run || !plan) return null;
  const assessment = journal.assessments(runId).at(-1), inputs = journal.boundRequirements(runId), currentInputs = journal.requirements(run.sessionId), calculation = journal.feasibility(runId);
  const critique = journal.documents(runId).filter(d => d.runId === runId && d.kind === 'critique' && d.status === 'published' && d.version === plan.version).at(-1);
  const reviews = journal.reviews(runId, now), latest = reviews.filter(r => r.planId === plan.id).at(-1);
  const canReview = run.status === 'complete' && journal.currency(runId).status !== 'superseded' && Boolean(assessment?.evidence.revision && plan.metadata['evidenceRevision']);
  const reasons: string[] = [];
  if (!canReview) reasons.push('The workflow must finish on a current proposal before recording this decision.');
  if (!assessment || assessment.status !== 'checked' || plan.metadata['evidenceRevision'] !== assessment.evidence.revision) reasons.push('The exact plan has no matching independent evidence check.');
  if (!critique || !/Verdict:\s*ACCEPT_WITH_GAPS/.test(critique.markdown)) reasons.push('The evaluator has not accepted this exact plan version for committee review.');
  if (!inputs || inputs.revision !== currentInputs?.revision) reasons.push('Mission inputs are missing or changed after this proposal.');
  if (!calculation || calculation.status !== 'conditional' || calculation.requirementsRevision !== inputs?.revision) reasons.push('Complete the mission inputs and resolve deterministic feasibility failures before approving a proposal.');
  if (!calculation?.validUntil || Date.parse(calculation.validUntil) <= now) reasons.push('The proposal timing or resource statements have expired.');
  if(inputs?.values.departAt && Date.parse(inputs.values.departAt)<=now)reasons.push('The recorded departure is in the past; obtain an updated mission time.');
  if (assessment?.evidence.publicEvidence?.status !== 'available') reasons.push('The public evidence source must be available for a refreshed proposal review.');
  const bundle = journal.bundle(runId);
  if (bundle?.status !== 'ready' || bundle.revision !== assessment?.evidence.revision) reasons.push('The report/geodata pack is incomplete or does not match this evidence version.');
  if (latest?.status === 'active' && latest.decision !== 'approve') reasons.push('The operator declined this proposal or requested changes; review a fresh proposal.');
  return { runId, planId: plan.id, version: plan.version, planSha256: planDigest(plan.markdown), evidenceRevision: assessment?.evidence.revision ?? '',
    requirementsRevision: inputs?.revision ?? null, calculationId: calculation?.id ?? null, canReview, canApprove: reasons.length === 0, reasons };
}
export function assertReviewMatches(input: ReviewSubmission, candidate: ReviewCandidate | null) {
  if (!candidate || !candidate.canReview || input.runId !== candidate.runId || input.planId !== candidate.planId || input.version !== candidate.version ||
    input.planSha256 !== candidate.planSha256 || input.evidenceRevision !== candidate.evidenceRevision ||
    input.requirementsRevision !== candidate.requirementsRevision || input.calculationId !== candidate.calculationId) throw new ReviewError('The proposal, evidence or mission inputs changed. Open the current version before reviewing.');
  if (input.decision === 'approve' && (!candidate.canApprove || !input.acknowledgedHolds)) throw new ReviewError(input.acknowledgedHolds
    ? candidate.reasons.join(' ') : 'Acknowledge the unresolved field/endpoint constraints and committee-proposal scope before approving.');
  if (input.decision !== 'approve' && !input.comment.trim()) throw new ReviewError('State the reason for rejection or the changes required.');
}
export function exportedReview(review:OperatorReview) {
  const {comment,...metadata}=review;
  return {...metadata,commentSha256:planDigest(comment),commentVisibility:'local_only',
    limitation:'This receipt records committee-proposal review against exact versions. It grants no dispatch authorization and may subsequently expire or be invalidated.'};
}
