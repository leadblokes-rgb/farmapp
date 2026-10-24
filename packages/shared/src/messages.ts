// Text produced by shared rules (validation, day counting, pay warnings) and the labels for
// shared lists, as translatable messages. English lives in ./i18n/en.json; the app loads that file
// as the "shared" section of its translations and shows each Message in the user's language.
// messageText() gives the English, for tests and anything without the app's translations.
import en from './i18n/en.json';

export type MessageParams = Record<string, string | number>;

/** A translatable message: a key into ./i18n/en.json plus values for its {{placeholders}}. */
export interface Message {
  code: string;
  params?: MessageParams;
}

export const sharedMessagesEn = en;

export function message(code: string, params?: MessageParams): Message {
  return params ? { code, params } : { code };
}

function lookup(code: string): string | undefined {
  let node: unknown = en;
  for (const part of code.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === 'string' ? node : undefined;
}

/** English text for a message, following the same rules as i18next (`_one` / `_other` plurals). */
export function messageText(m: Message): string {
  const count = m.params?.count;
  const template =
    (typeof count === 'number' ? lookup(`${m.code}_${count === 1 ? 'one' : 'other'}`) : undefined) ??
    lookup(m.code) ??
    m.code;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(m.params?.[k] ?? ''));
}
