import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * Minimal react-hook-form resolver for zod schemas (avoids @hookform/resolvers' heavy peer deps).
 * Maps each zod issue to the field at its path; the first message per field wins.
 */
export function zodResolver<TValues extends FieldValues, TOutput>(
  schema: z.ZodType<TOutput, TValues>,
): Resolver<TValues, unknown, TOutput> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      if (!errors[path]) errors[path] = { type: issue.code, message: issue.message };
    }
    // RHF accepts dotted paths at the top level when `criteriaMode` is default.
    return { values: {}, errors: toNested(errors) as FieldErrors<TValues> };
  };
}

function toNested(flat: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(flat)) {
    const keys = path === '' ? ['root'] : path.split('.');
    let node = out;
    keys.forEach((k, i) => {
      if (i === keys.length - 1) node[k] = value;
      else node = (node[k] ??= {}) as Record<string, unknown>;
    });
  }
  return out;
}
