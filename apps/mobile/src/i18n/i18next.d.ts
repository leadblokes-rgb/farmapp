import 'i18next';
import type { sharedMessagesEn } from '@croppr/shared';
import type en from './en.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en & { shared: typeof sharedMessagesEn } };
  }
}
