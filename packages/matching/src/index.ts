// Matching module: the ONLY place ranking logic lives.
// To replace it (e.g. with an AI model), implement `Ranker` and change `ranker` below.
import { ruleBasedRanker } from './ruleBasedRanker';
import type { Ranker } from './types';

export const ranker: Ranker = ruleBasedRanker;

export * from './types';
export { distanceKm, overlapDays } from './factors';
export { ruleBasedRanker, scoreApplicant, scoreJobForWorker } from './ruleBasedRanker';
export * as weights from './weights';
