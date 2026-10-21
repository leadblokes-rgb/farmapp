import { payRules, relevantSkills } from '@croppr/shared';
import * as f from './factors';
import type { MatchJob, MatchWorker, Ranked, Ranker, ScoreBreakdown } from './types';
import { APPLICANT_WEIGHTS, FEED_WEIGHTS } from './weights';

function total(breakdown: ScoreBreakdown): number {
  const sum = Object.values(breakdown).reduce((acc, b) => acc + b.score * b.weight, 0);
  return Math.round(sum * 10) / 10;
}

function byScoreThenId<T extends { id: string }>(a: Ranked<T>, b: Ranked<T>): number {
  return b.score - a.score || a.item.id.localeCompare(b.item.id);
}

export function scoreApplicant(job: MatchJob, worker: MatchWorker): Ranked<MatchWorker> {
  const w = APPLICANT_WEIGHTS;
  const breakdown: ScoreBreakdown = {
    availability: { ...f.availability(job, worker), weight: w.availability },
    distance: { ...f.distance(job, worker), weight: w.distance },
    transport: { ...f.transport(job, worker), weight: w.transport },
    experience: { ...f.experience(job, worker, relevantSkills(job.roleType)), weight: w.experience },
    reliability: { ...f.reliability(worker), weight: w.reliability },
  };
  return { item: worker, score: total(breakdown), breakdown };
}

export function scoreJobForWorker(worker: MatchWorker, job: MatchJob): Ranked<MatchJob> {
  const w = FEED_WEIGHTS;
  const breakdown: ScoreBreakdown = {
    availability: { ...f.availability(job, worker), weight: w.availability },
    distance: { ...f.distance(job, worker), weight: w.distance },
    pay: { ...f.pay(job, payRules.awardMinHourlyCents), weight: w.pay },
    accommodation: { ...f.accommodation(job, worker), weight: w.accommodation },
    transport: { ...f.transport(job, worker), weight: w.transport },
  };
  return { item: job, score: total(breakdown), breakdown };
}

/** Transparent, explainable baseline ranker. */
export const ruleBasedRanker: Ranker = {
  version: 'rules-1',
  rankApplicants: (job, applicants) => applicants.map((a) => scoreApplicant(job, a)).sort(byScoreThenId),
  rankJobsForWorker: (worker, jobs) => jobs.map((j) => scoreJobForWorker(worker, j)).sort(byScoreThenId),
};
