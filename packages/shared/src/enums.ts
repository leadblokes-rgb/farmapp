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
