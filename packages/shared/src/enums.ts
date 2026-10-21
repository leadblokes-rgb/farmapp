// Mirrors Postgres enums in supabase/migrations. Keep in sync (or regenerate types with `npm run db:types`).
export const USER_ROLES = ['worker', 'farm', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Roles a person may pick for themselves at signup. Admin is granted manually (see docs).
export const SELF_SERVE_ROLES = ['worker', 'farm'] as const satisfies readonly UserRole[];
export type SelfServeRole = (typeof SELF_SERVE_ROLES)[number];

export const ACCOUNT_STATUSES = ['active', 'suspended'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export function isSelfServeRole(value: unknown): value is SelfServeRole {
  return typeof value === 'string' && (SELF_SERVE_ROLES as readonly string[]).includes(value);
}

export const VISA_TYPES = ['417', '462', 'other', 'citizen_pr'] as const;
export type VisaType = (typeof VISA_TYPES)[number];
export const VISA_TYPE_LABELS: Record<VisaType, string> = {
  '417': 'Working Holiday (417)',
  '462': 'Work and Holiday (462)',
  other: 'Other visa with work rights',
  citizen_pr: 'Australian / NZ citizen or permanent resident',
};
/** Visa types where an expiry date is required. */
export const VISA_TYPES_WITH_EXPIRY: readonly VisaType[] = ['417', '462', 'other'];

export const TRAVEL_MODES = ['solo', 'group'] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
