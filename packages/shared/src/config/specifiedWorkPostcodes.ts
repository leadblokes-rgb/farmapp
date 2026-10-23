// Eligible postcodes for "specified work" on Working Holiday visas. REVIEW BEFORE LAUNCH and whenever
// Home Affairs updates the instrument (see sourceUrl). Mirrored in SQL by the migration
// supabase/migrations/20261030000000_saved_alerts_postcodes.sql; a unit test keeps them in sync.
//
// Croppr only auto-detects ONE category: plant and animal cultivation in regional Australia.
// Other specified work (fishing and pearling, tree farming, mining, construction, bushfire/flood
// recovery, tourism and hospitality in northern or remote Australia, ...) is NOT detected; the
// worker or farm decides those themselves.

import type { Database } from '../database.types';

type JobRoleType = Database['public']['Enums']['job_role_type'];
export type WhmSubclass = '417' | '462';
export type PostcodeRange = readonly [from: number, to: number];

/** Each state/territory's regional postcodes. Whole states are given as their full postcode range. */
const REGIONAL_AUSTRALIA: Record<string, readonly PostcodeRange[]> = {
  NSW: [
    [2311, 2312], [2328, 2411], [2420, 2490], [2536, 2551], [2575, 2594], [2618, 2739], [2787, 2898],
  ],
  NorfolkIsland: [[2899, 2899]],
  NT: [[800, 899]],
  QLD: [
    [4124, 4125], [4133, 4133], [4211, 4211], [4270, 4272], [4275, 4275], [4280, 4280], [4285, 4285],
    [4287, 4287], [4307, 4499], [4510, 4510], [4512, 4512], [4515, 4519], [4522, 4899],
  ],
  SA: [[5000, 5999]],
  TAS: [[7000, 7999]],
  VIC: [
    [3139, 3139], [3211, 3334], [3340, 3424], [3430, 3649], [3658, 3749], [3753, 3753], [3756, 3756],
    [3758, 3758], [3762, 3762], [3764, 3764], [3778, 3781], [3783, 3783], [3797, 3797], [3799, 3799],
    [3810, 3909], [3921, 3925], [3945, 3974], [3979, 3979], [3981, 3996],
  ],
  WA: [
    [6041, 6044], [6055, 6056], [6069, 6069], [6076, 6076], [6083, 6084], [6111, 6111], [6121, 6126],
    [6200, 6799],
  ],
};

const allRegional = Object.values(REGIONAL_AUSTRALIA).flat();

export const specifiedWorkPostcodes = {
  version: '2026-10',
  lastReviewed: '2026-10-23',
  /** Legislative instrument LIN 22/037 (F2022L00271) and the Home Affairs specified-work pages. */
  sourceUrl: 'https://www.legislation.gov.au/F2022L00271/latest/text',
  needsExpertReview: true,
  categories: {
    plant_animal_cultivation: {
      label: 'plant & animal cultivation',
      /** Croppr job types that are plant and animal cultivation (harvesting, packing, pruning, planting, machinery, livestock, general crop work). */
      roleTypes: ['picking', 'packing', 'pruning', 'planting', 'machinery', 'livestock', 'general'] as readonly JobRoleType[],
      // Both subclasses use regional Australia for plant and animal cultivation.
      ranges: { '417': allRegional, '462': allRegional } as Record<WhmSubclass, readonly PostcodeRange[]>,
    },
  },
} as const;

export type SpecifiedWorkCategory = keyof typeof specifiedWorkPostcodes.categories;

export function isWhmSubclass(visaType: string | null | undefined): visaType is WhmSubclass {
  return visaType === '417' || visaType === '462';
}

/** Is this postcode eligible for plant and animal cultivation for this visa subclass? */
export function isSpecifiedWorkPostcode(
  postcode: string | null | undefined,
  subclass: WhmSubclass,
  category: SpecifiedWorkCategory = 'plant_animal_cultivation',
): boolean {
  if (!postcode || !/^\d{4}$/.test(postcode)) return false;
  const n = Number(postcode);
  return specifiedWorkPostcodes.categories[category].ranges[subclass].some(([a, b]) => n >= a && n <= b);
}

/** Eligible for EITHER subclass (what a farm sees when posting, since it doesn't know the worker's visa). */
export function isSpecifiedWorkPostcodeForAnyWhm(postcode: string | null | undefined): boolean {
  return isSpecifiedWorkPostcode(postcode, '417') || isSpecifiedWorkPostcode(postcode, '462');
}

export interface SpecifiedWorkCheck {
  /** null when the check doesn't apply (not on a 417/462 visa, or not a cultivation job). */
  eligible: boolean | null;
  label: string;
}

/** The job card line for a worker: role type in the category AND postcode eligible for their subclass. */
export function specifiedWorkForJob(job: { postcode: string; roleType: JobRoleType }, visaType: string | null | undefined): SpecifiedWorkCheck {
  const cat = specifiedWorkPostcodes.categories.plant_animal_cultivation;
  if (!isWhmSubclass(visaType) || !cat.roleTypes.includes(job.roleType)) return { eligible: null, label: '' };
  return isSpecifiedWorkPostcode(job.postcode, visaType)
    ? { eligible: true, label: `Eligible postcode for ${visaType} ${cat.label}` }
    : { eligible: false, label: `Not an eligible postcode for ${visaType} ${cat.label}` };
}
