import type { SkillKey } from './skills';

// Job role types. `relevantSkills` feeds the matching module's experience score.
export const JOB_ROLES = [
  { key: 'picking', label: 'Picking', relevantSkills: ['picking', 'quality_control'] },
  { key: 'packing', label: 'Packing', relevantSkills: ['packing', 'quality_control', 'forklift'] },
  { key: 'pruning', label: 'Pruning', relevantSkills: ['pruning', 'chainsaw'] },
  { key: 'planting', label: 'Planting', relevantSkills: ['planting', 'irrigation'] },
  { key: 'machinery', label: 'Machinery / driving', relevantSkills: ['tractor', 'forklift', 'hr_licence'] },
  { key: 'livestock', label: 'Livestock', relevantSkills: ['livestock'] },
  { key: 'general', label: 'General farm hand', relevantSkills: [] },
] as const satisfies readonly { key: string; label: string; relevantSkills: readonly SkillKey[] }[];

export type JobRoleType = (typeof JOB_ROLES)[number]['key'];
export const JOB_ROLE_KEYS = JOB_ROLES.map((r) => r.key) as [JobRoleType, ...JobRoleType[]];

export function jobRoleLabel(key: string): string {
  return JOB_ROLES.find((r) => r.key === key)?.label ?? key;
}

export function relevantSkills(key: string): readonly SkillKey[] {
  return JOB_ROLES.find((r) => r.key === key)?.relevantSkills ?? [];
}
