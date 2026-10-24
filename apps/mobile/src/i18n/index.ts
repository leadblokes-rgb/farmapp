// Translations. Every piece of text the app shows lives in en.json, plus the text produced by
// shared rules (validation, day counting, labels) in packages/shared/src/i18n/en.json, loaded
// here as the "shared" section. Translators add a file per language for each (e.g. zh.json) and
// list them in `resources` below. Components call `t('area.key')`. Keys are type-checked against
// the English files (see i18next.d.ts), so a typo fails `npm run typecheck`.
import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { sharedMessagesEn } from '@croppr/shared';
import en from './en.json';

export const resources = {
  en: { translation: { ...en, shared: sharedMessagesEn } },
} as const;

export type Language = keyof typeof resources;
export const LANGUAGES = Object.keys(resources) as Language[];

/** The phone's language if we have it, otherwise English. */
function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return (LANGUAGES as string[]).includes(code) ? (code as Language) : 'en';
}

const i18n = createInstance();
i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: 'en',
  // React Native renders plain text, so there's nothing to HTML-escape.
  interpolation: { escapeValue: false },
  initAsync: false,
});

/** Translate a key from en.json. Usable outside components too (errors, notifications). */
export const t = i18n.t.bind(i18n) as typeof i18n.t;
export { Trans } from 'react-i18next';
export default i18n;
