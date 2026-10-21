import type { DateRange, GeoPoint, MatchJob, MatchWorker } from './types';
import {
  MAX_USEFUL_DISTANCE_KM,
  PAY_SCORE_CEILING_ABOVE_MIN_CENTS,
  UNRATED_RELIABILITY_SCORE,
} from './weights';

// Each factor returns a 0–1 score plus a short note explaining it.
export interface Factor {
  score: number;
  note: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const toDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;

/** Inclusive day count of the overlap between two ranges (0 if none). */
export function overlapDays(a: DateRange, b: DateRange): number {
  const start = Math.max(toDay(a.startDate), toDay(b.startDate));
  const end = Math.min(toDay(a.endDate), toDay(b.endDate));
  return Math.max(0, end - start + 1);
}

export function availability(job: MatchJob, worker: MatchWorker): Factor {
  const jobDays = overlapDays(job, job);
  const covered = Math.min(
    jobDays,
    worker.availability.reduce((sum, w) => sum + overlapDays(job, w), 0),
  );
  const score = jobDays > 0 ? covered / jobDays : 0;
  const pct = Math.round(score * 100);
  return {
    score,
    note: pct === 100 ? 'Available for the whole job' : `Available for ${pct}% of the job dates`,
  };
}

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function distance(job: MatchJob, worker: MatchWorker): Factor {
  if (!job.location || !worker.location) return { score: 0.5, note: 'Distance unknown' };
  const km = distanceKm(job.location, worker.location);
  return {
    score: Math.max(0, 1 - km / MAX_USEFUL_DISTANCE_KM),
    note: km < 1 ? 'Nearby' : `${Math.round(km)} km away`,
  };
}

export function transport(job: MatchJob, worker: MatchWorker): Factor {
  if (job.carRequired) {
    return worker.hasCar
      ? { score: 1, note: 'Has a car (required)' }
      : { score: 0, note: 'No car, but one is required' };
  }
  if (worker.hasCar) return { score: 1, note: 'Has a car' };
  if (job.transportProvided) return { score: 1, note: 'Transport provided' };
  return { score: 0.6, note: 'No car; needs another way to get there' };
}

export function experience(job: MatchJob, worker: MatchWorker, relevantSkills: readonly string[]): Factor {
  const matched = relevantSkills.filter((s) => worker.skills.includes(s));
  const skillPart = relevantSkills.length === 0 ? 0.5 : matched.length > 0 ? 0.6 : 0;
  const yearsPart = 0.4 * Math.min(worker.yearsExperience / 3, 1);
  const score = Math.min(1, skillPart + yearsPart);
  const seasons = `${worker.yearsExperience} season${worker.yearsExperience === 1 ? '' : 's'}`;
  return {
    score,
    note: matched.length ? `${seasons}; relevant skills: ${matched.join(', ')}` : `${seasons} of farm work`,
  };
}

export function reliability(worker: MatchWorker): Factor {
  if (worker.reliability == null) return { score: UNRATED_RELIABILITY_SCORE, note: 'No ratings yet' };
  return {
    score: (worker.reliability - 1) / 4,
    note: `Rated ${worker.reliability.toFixed(1)}/5 for reliability`,
  };
}

export function pay(job: MatchJob, awardMinHourlyCents: number): Factor {
  const above = job.effectiveHourlyCents - awardMinHourlyCents;
  const score = Math.max(0, Math.min(1, 0.5 + (0.5 * above) / PAY_SCORE_CEILING_ABOVE_MIN_CENTS));
  return { score, note: above >= 0 ? 'At or above award minimum' : 'Below award minimum' };
}

export function accommodation(job: MatchJob, worker: MatchWorker): Factor {
  if (!worker.needsAccommodation) return { score: 1, note: 'Accommodation not needed' };
  return job.accommodationProvided
    ? { score: 1, note: 'Accommodation provided' }
    : { score: 0.2, note: 'No accommodation provided' };
}
