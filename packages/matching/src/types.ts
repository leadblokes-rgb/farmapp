// Plain data the ranker needs. Callers (the app, Edge Functions) map DB rows into these shapes,
// so the ranking logic never depends on the database schema directly.

export interface DateRange {
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface MatchJob {
  id: string;
  roleType: string;
  startDate: string;
  endDate: string;
  location: GeoPoint | null;
  carRequired: boolean;
  transportProvided: boolean;
  accommodationProvided: boolean;
  /** Hourly rate, or the guaranteed hourly minimum for piece work. */
  effectiveHourlyCents: number;
  /** Casual pay includes a 25% loading, so pay is compared with the matching award minimum. */
  employmentType?: 'casual' | 'part_time' | 'full_time';
}

export interface MatchWorker {
  id: string;
  availability: DateRange[];
  location: GeoPoint | null;
  hasCar: boolean;
  needsAccommodation: boolean;
  skills: string[];
  yearsExperience: number;
  /** Average reliability rating 1–5 (each no-show counts as a 1), or null if unrated. */
  reliability: number | null;
}

export interface FactorScore {
  /** 0–1 */
  score: number;
  /** Weight out of 100 */
  weight: number;
  /** Short, human-readable explanation shown in the app. */
  note: string;
}

export type ScoreBreakdown = Record<string, FactorScore>;

export interface Ranked<T> {
  item: T;
  /** 0–100 */
  score: number;
  breakdown: ScoreBreakdown;
}

/**
 * The contract every ranking implementation follows. Swap `ruleBasedRanker` for an AI model by
 * implementing this interface; callers don't change.
 */
export interface Ranker {
  version: string;
  /** Farm side: order applicants for one job. */
  rankApplicants(job: MatchJob, applicants: MatchWorker[]): Ranked<MatchWorker>[];
  /** Worker side: order candidate jobs in the swipe feed. */
  rankJobsForWorker(worker: MatchWorker, jobs: MatchJob[]): Ranked<MatchJob>[];
}
