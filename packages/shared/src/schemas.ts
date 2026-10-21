import { z } from 'zod';
import { isValidAbn, normaliseAbn } from './abn';
import { COUNTRIES } from './config/countries';
import { SKILL_KEYS } from './config/skills';
import { TRAVEL_MODES, VISA_TYPES, VISA_TYPES_WITH_EXPIRY } from './enums';

// Form-level validation shared by the app (and later Edge Functions). The database enforces
// the same rules with CHECK constraints, so these exist to give friendly messages early.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date as DD/MM/YYYY');
export const postcodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, 'Enter a 4-digit postcode');

export const availabilityWindowSchema = z
  .object({ startDate: isoDate, endDate: isoDate })
  .refine((w) => w.endDate >= w.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });

export const workerProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your name').max(80),
    currentPostcode: postcodeSchema,
    nationality: z.enum(COUNTRIES.map((c) => c.code) as [string, ...string[]], {
      message: 'Choose your nationality',
    }),
    visaType: z.enum(VISA_TYPES, { message: 'Choose your visa type' }),
    visaExpiry: isoDate.nullable(),
    travelMode: z.enum(TRAVEL_MODES),
    groupSize: z.number().int().min(1).max(20),
    hasCar: z.boolean(),
    needsAccommodation: z.boolean(),
    skills: z.array(z.enum(SKILL_KEYS)),
    yearsExperience: z.number().int().min(0, 'Can’t be negative').max(50),
    experienceSummary: z.string().trim().max(1000, 'Keep it under 1000 characters'),
    regionIds: z.array(z.string()).min(1, 'Pick at least one region'),
    availability: z.array(availabilityWindowSchema).min(1, 'Add at least one date range you’re available'),
  })
  .superRefine((v, ctx) => {
    if (VISA_TYPES_WITH_EXPIRY.includes(v.visaType) && !v.visaExpiry) {
      ctx.addIssue({ code: 'custom', path: ['visaExpiry'], message: 'Enter your visa expiry date' });
    }
    if (v.travelMode === 'group' && v.groupSize < 2) {
      ctx.addIssue({ code: 'custom', path: ['groupSize'], message: 'A group has at least 2 people' });
    }
  });

export type WorkerProfileInput = z.infer<typeof workerProfileSchema>;

const auPhone = /^(?:\+?61|0)[2-478]\d{8}$/;

export const farmSchema = z
  .object({
    businessName: z.string().trim().min(2, 'Enter the business name').max(120),
    abn: z
      .string()
      .transform(normaliseAbn)
      .refine(isValidAbn, 'That ABN doesn’t look right. Check the 11 digits.'),
    contactPhone: z
      .string()
      .transform((s) => s.replace(/[\s()-]/g, ''))
      .refine((s) => auPhone.test(s), 'Enter an Australian phone number'),
    postcode: postcodeSchema,
    description: z.string().trim().max(2000, 'Keep it under 2000 characters'),
    isLabourHire: z.boolean(),
    labourHireLicenceNumber: z.string().trim().max(40),
  })
  .superRefine((v, ctx) => {
    if (v.isLabourHire && v.labourHireLicenceNumber.length < 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['labourHireLicenceNumber'],
        message: 'Labour hire providers must enter their licence number',
      });
    }
  });

export type FarmInput = z.input<typeof farmSchema>;
export type FarmOutput = z.output<typeof farmSchema>;
