import { describe, expect, it } from 'vitest';
import { distanceKm, overlapDays } from './factors';
import { ruleBasedRanker } from './ruleBasedRanker';
import type { MatchJob, MatchWorker } from './types';

const GATTON = { lat: -27.558, lng: 152.276 };
const BUNDABERG = { lat: -24.8661, lng: 152.3489 };

const job: MatchJob = {
  id: 'job',
  roleType: 'picking',
  startDate: '2027-01-01',
  endDate: '2027-01-30',
  location: GATTON,
  carRequired: false,
  transportProvided: false,
  accommodationProvided: false,
  effectiveHourlyCents: 3300,
};

const worker = (over: Partial<MatchWorker>): MatchWorker => ({
  id: 'w',
  availability: [{ startDate: '2027-01-01', endDate: '2027-01-30' }],
  location: GATTON,
  hasCar: true,
  needsAccommodation: false,
  skills: ['picking'],
  yearsExperience: 3,
  reliability: null,
  ...over,
});

describe('factors', () => {
  it('counts overlapping days inclusively', () => {
    expect(
      overlapDays(
        { startDate: '2027-01-01', endDate: '2027-01-10' },
        { startDate: '2027-01-10', endDate: '2027-02-01' },
      ),
    ).toBe(1);
    expect(
      overlapDays(
        { startDate: '2027-01-01', endDate: '2027-01-10' },
        { startDate: '2027-01-11', endDate: '2027-02-01' },
      ),
    ).toBe(0);
  });

  it('computes distance between Gatton and Bundaberg (~300 km)', () => {
    const km = distanceKm(GATTON, BUNDABERG);
    expect(km).toBeGreaterThan(280);
    expect(km).toBeLessThan(320);
  });
});

describe('rankApplicants', () => {
  it('scores a perfect local, available, experienced worker highly', () => {
    const [r] = ruleBasedRanker.rankApplicants(job, [worker({})]);
    expect(r.score).toBeGreaterThan(90); // only reliability is at the unrated prior
    expect(r.breakdown.availability.note).toBe('Available for the whole job');
  });

  it('orders by availability overlap, distance and car', () => {
    const ranked = ruleBasedRanker.rankApplicants({ ...job, carRequired: true }, [
      worker({ id: 'half', availability: [{ startDate: '2027-01-16', endDate: '2027-03-01' }] }),
      worker({ id: 'far', location: BUNDABERG }),
      worker({ id: 'nocar', hasCar: false }),
      worker({ id: 'best' }),
    ]);
    expect(ranked[0].item.id).toBe('best');
    expect(ranked.map((r) => r.item.id).indexOf('nocar')).toBeGreaterThan(0);
    expect(ranked.find((r) => r.item.id === 'nocar')!.breakdown.transport.score).toBe(0);
  });

  it('rewards reliability once ratings exist', () => {
    const [a, b] = ruleBasedRanker.rankApplicants(job, [
      worker({ id: 'low', reliability: 2 }),
      worker({ id: 'high', reliability: 5 }),
    ]);
    expect(a.item.id).toBe('high');
    expect(a.score).toBeGreaterThan(b.score);
  });

  it('is deterministic for ties', () => {
    const ids = ruleBasedRanker
      .rankApplicants(job, [worker({ id: 'b' }), worker({ id: 'a' })])
      .map((r) => r.item.id);
    expect(ids).toEqual(['a', 'b']);
  });
});

describe('rankJobsForWorker', () => {
  it('prefers jobs with accommodation when the worker needs it', () => {
    const w = worker({ needsAccommodation: true });
    const ranked = ruleBasedRanker.rankJobsForWorker(w, [
      { ...job, id: 'no-accom' },
      { ...job, id: 'accom', accommodationProvided: true },
    ]);
    expect(ranked[0].item.id).toBe('accom');
  });

  it('prefers better pay, all else equal', () => {
    const ranked = ruleBasedRanker.rankJobsForWorker(worker({}), [
      { ...job, id: 'low', effectiveHourlyCents: 3218 },
      { ...job, id: 'high', effectiveHourlyCents: 3800 },
    ]);
    expect(ranked[0].item.id).toBe('high');
  });
});
