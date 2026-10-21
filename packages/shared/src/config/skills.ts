// Skills a worker can tag on their profile. The matching module (milestone 4) maps these to
// job role types, so keep the keys stable; labels can change freely.
export const SKILLS = [
  { key: 'picking', label: 'Fruit & veg picking' },
  { key: 'packing', label: 'Packing shed' },
  { key: 'pruning', label: 'Pruning' },
  { key: 'planting', label: 'Planting' },
  { key: 'tractor', label: 'Tractor driving' },
  { key: 'forklift', label: 'Forklift licence' },
  { key: 'livestock', label: 'Livestock' },
  { key: 'irrigation', label: 'Irrigation' },
  { key: 'chainsaw', label: 'Chainsaw' },
  { key: 'hr_licence', label: 'Heavy rigid licence' },
  { key: 'first_aid', label: 'First aid certificate' },
  { key: 'quality_control', label: 'Quality control' },
] as const;

export type SkillKey = (typeof SKILLS)[number]['key'];
export const SKILL_KEYS = SKILLS.map((s) => s.key) as [SkillKey, ...SkillKey[]];
