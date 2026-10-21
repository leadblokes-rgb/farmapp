// Matching module: the ONLY place ranking logic lives.
// Milestone 4 adds `ruleBasedRanker`; an AI ranker can later implement the same interface.

export interface ScoreBreakdown {
  [factor: string]: { score: number; weight: number; note?: string };
}

export interface Ranked<T> {
  item: T;
  score: number; // 0–100
  breakdown: ScoreBreakdown;
}

export interface Ranker<Job, Applicant> {
  version: string;
  rankApplicants(job: Job, applicants: Applicant[]): Ranked<Applicant>[];
  rankJobsForWorker(worker: Applicant, jobs: Job[]): Ranked<Job>[];
}
