import { z } from 'zod';
import { isValidAbn, normaliseAbn } from './abn';
import { COUNTRIES } from './config/countries';
import { JOB_ROLE_KEYS } from './config/jobRoles';
import { SKILL_KEYS } from './config/skills';
import { TRAVEL_MODES, VISA_TYPES, VISA_TYPES_WITH_EXPIRY } from './enums';

// Form-level validation shared by the app (and later Edge Functions). The database enforces
// the same rules with CHECK constraints, so these exist to give friendly messages early.
// Messages are keys into ./i18n/en.json ("validation.*"); the app shows them translated.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date');
export const postcodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, 'validation.postcode');

export const availabilityWindowSchema = z
  .object({ startDate: isoDate, endDate: isoDate })
  .refine((w) => w.endDate >= w.startDate, {
    message: 'validation.endAfterStart',
    path: ['endDate'],
  });

export const workerProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'validation.name').max(80),
    currentPostcode: postcodeSchema,
    nationality: z.enum(COUNTRIES.map((c) => c.code) as [string, ...string[]], {
      message: 'validation.nationality',
    }),
    visaType: z.enum(VISA_TYPES, { message: 'validation.visaType' }),
    visaExpiry: isoDate.nullable(),
    travelMode: z.enum(TRAVEL_MODES),
    groupSize: z.number().int().min(1).max(20),
    hasCar: z.boolean(),
    needsAccommodation: z.boolean(),
    skills: z.array(z.enum(SKILL_KEYS)),
    yearsExperience: z.number().int().min(0, 'validation.notNegative').max(50),
    experienceSummary: z.string().trim().max(1000, 'validation.max1000'),
    regionIds: z.array(z.string()).min(1, 'validation.regions'),
    availability: z.array(availabilityWindowSchema).min(1, 'validation.availability'),
  })
  .superRefine((v, ctx) => {
    if (VISA_TYPES_WITH_EXPIRY.includes(v.visaType) && !v.visaExpiry) {
      ctx.addIssue({ code: 'custom', path: ['visaExpiry'], message: 'validation.visaExpiry' });
    }
    if (v.travelMode === 'group' && v.groupSize < 2) {
      ctx.addIssue({ code: 'custom', path: ['groupSize'], message: 'validation.groupSize' });
    }
  });

export type WorkerProfileInput = z.infer<typeof workerProfileSchema>;

const auPhone = /^(?:\+?61|0)[2-478]\d{8}$/;

export const farmSchema = z
  .object({
    businessName: z.string().trim().min(2, 'validation.businessName').max(120),
    abn: z.string().transform(normaliseAbn).refine(isValidAbn, 'validation.abn'),
    contactPhone: z
      .string()
      .transform((s) => s.replace(/[\s()-]/g, ''))
      .refine((s) => auPhone.test(s), 'validation.phone'),
    postcode: postcodeSchema,
    description: z.string().trim().max(2000, 'validation.max2000'),
    isLabourHire: z.boolean(),
    labourHireLicenceNumber: z.string().trim().max(40),
  })
  .superRefine((v, ctx) => {
    if (v.isLabourHire && v.labourHireLicenceNumber.length < 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['labourHireLicenceNumber'],
        message: 'validation.licence',
      });
    }
  });

export type FarmInput = z.input<typeof farmSchema>;
export type FarmOutput = z.output<typeof farmSchema>;

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export const jobSchema = z
  .object({
    title: z.string().trim().min(3, 'validation.jobTitle').max(80),
    roleType: z.enum(JOB_ROLE_KEYS, { message: 'validation.roleType' }),
    description: z.string().trim().max(2000, 'validation.max2000'),
    postcode: postcodeSchema,
    startDate: isoDate,
    endDate: isoDate,
    workersNeeded: z.number().int().min(1).max(500),
    employmentType: z.enum(['casual', 'part_time', 'full_time'], {
      message: 'validation.employmentType',
    }),
    payType: z.enum(['hourly', 'piece_rate']),
    payRateCents: z.number({ message: 'validation.payRate' }).int().positive('validation.payRate'),
    pieceRateUnit: z.string().trim().max(40),
    minHourlyGuaranteeCents: z.number().int().positive().nullable(),
    hoursPerWeek: z.number().int().min(1).max(80),
    accommodationProvided: z.boolean(),
    accommodationCostWeekCents: z.number().int().min(0).nullable(),
    transportProvided: z.boolean(),
    carRequired: z.boolean(),
    likelySpecifiedWork: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'validation.endAfterStart',
      });
    }
    if (v.payType === 'piece_rate') {
      if (!v.minHourlyGuaranteeCents) {
        ctx.addIssue({
          code: 'custom',
          path: ['minHourlyGuaranteeCents'],
          message: 'validation.guarantee',
        });
      }
      if (v.pieceRateUnit.length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['pieceRateUnit'],
          message: 'validation.pieceUnit',
        });
      }
    }
  });

export type JobInput = z.infer<typeof jobSchema>;
