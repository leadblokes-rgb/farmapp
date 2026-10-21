import { describe, expect, it } from 'vitest';
import { farmSchema, workerProfileSchema } from './schemas';

const worker = {
  fullName: 'Sam Lee',
  currentPostcode: '4343',
  nationality: 'GB',
  visaType: '417' as const,
  visaExpiry: '2027-06-30',
  travelMode: 'solo' as const,
  groupSize: 1,
  hasCar: true,
  needsAccommodation: false,
  skills: ['picking' as const],
  yearsExperience: 1,
  experienceSummary: '',
  regionIds: ['lockyer-valley'],
  availability: [{ startDate: '2027-01-01', endDate: '2027-03-01' }],
};

const farm = {
  businessName: 'Gatton Greens',
  abn: '51 824 753 556',
  contactPhone: '0412 345 678',
  postcode: '4343',
  description: '',
  isLabourHire: false,
  labourHireLicenceNumber: '',
};

describe('workerProfileSchema', () => {
  it('accepts a complete profile', () => {
    expect(workerProfileSchema.safeParse(worker).success).toBe(true);
  });

  it('requires an expiry for working holiday visas but not citizens', () => {
    expect(workerProfileSchema.safeParse({ ...worker, visaExpiry: null }).success).toBe(false);
    expect(
      workerProfileSchema.safeParse({ ...worker, visaType: 'citizen_pr', visaExpiry: null }).success,
    ).toBe(true);
  });

  it('rejects availability that ends before it starts', () => {
    const r = workerProfileSchema.safeParse({
      ...worker,
      availability: [{ startDate: '2027-03-01', endDate: '2027-01-01' }],
    });
    expect(r.success).toBe(false);
  });

  it('requires group size of at least 2 for groups', () => {
    expect(workerProfileSchema.safeParse({ ...worker, travelMode: 'group', groupSize: 1 }).success).toBe(
      false,
    );
    expect(workerProfileSchema.safeParse({ ...worker, travelMode: 'group', groupSize: 3 }).success).toBe(
      true,
    );
  });
});

describe('farmSchema', () => {
  it('normalises ABN and phone', () => {
    const r = farmSchema.parse(farm);
    expect(r.abn).toBe('51824753556');
    expect(r.contactPhone).toBe('0412345678');
  });

  it('rejects a bad ABN', () => {
    expect(farmSchema.safeParse({ ...farm, abn: '51 824 753 557' }).success).toBe(false);
  });

  it('requires a licence number for labour hire providers', () => {
    expect(farmSchema.safeParse({ ...farm, isLabourHire: true }).success).toBe(false);
    expect(
      farmSchema.safeParse({ ...farm, isLabourHire: true, labourHireLicenceNumber: 'LHL12345' }).success,
    ).toBe(true);
  });
});
