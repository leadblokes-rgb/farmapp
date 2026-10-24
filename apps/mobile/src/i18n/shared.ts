// Text from the shared package (packages/shared/src/i18n/en.json) in the user's language.
import { messageText, type EmploymentType, type Message, type VisaType } from '@croppr/shared';
import { t } from './index';

type SharedKey = 'shared.disclaimer';

/** A shared Message (validation, day-counting note, pay warning), translated. */
export function sharedText(m: Message): string {
  return t(`shared.${m.code}` as SharedKey, { ...m.params, defaultValue: messageText(m) });
}

/** A zod message from the shared schemas ("validation.*" codes), translated. */
export function validationText(message: string): string {
  if (message.startsWith('validation.')) return sharedText({ code: message });
  return t('shared.validation.invalid');
}

export const roleLabel = (key: string) =>
  t(`shared.labels.roles.${key}` as 'shared.labels.roles.picking', { defaultValue: key });
export const skillLabel = (key: string) =>
  t(`shared.labels.skills.${key}` as 'shared.labels.skills.picking', { defaultValue: key });
export const visaLabel = (key: VisaType) => t(`shared.labels.visaTypes.${key}`);
export const employmentLabel = (key: EmploymentType) => t(`shared.labels.employmentTypes.${key}`);
export const employmentDescription = (key: EmploymentType) =>
  t(`shared.labels.employmentDescriptions.${key}`);
