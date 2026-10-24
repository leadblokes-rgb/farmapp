// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// UI text must come from src/i18n/en.json via t() so the app can be translated.
const TEXT = /[A-Za-z]{2}/.source;
const TEXT_PROPS =
  '/^(label|title|placeholder|hint|description|note|message|error|accessibilityLabel|accessibilityHint|submitLabel|legalNote|confirmLabel|emptyText|subtitle|text|headerTitle|tabBarLabel|noun)$/';
const MESSAGE = 'Put UI text in src/i18n/en.json and use t() (see src/i18n/index.ts).';
const noUiLiterals = [
  'error',
  { selector: `JSXText[value=/${TEXT}/]`, message: MESSAGE },
  { selector: `JSXAttribute[name.name=${TEXT_PROPS}] > Literal[value=/${TEXT}/]`, message: MESSAGE },
  // Text in {cond ? 'a' : 'b'} / {x && 'a'} / {'a'}, as children or text props (not t('key') arguments).
  {
    selector: `:matches(JSXElement, JSXFragment, JSXAttribute[name.name=${TEXT_PROPS}]) > JSXExpressionContainer > :matches(ConditionalExpression, LogicalExpression) > Literal[value=/${TEXT}/]`,
    message: MESSAGE,
  },
  {
    selector: `:matches(JSXElement, JSXFragment, JSXAttribute[name.name=${TEXT_PROPS}]) > JSXExpressionContainer > ConditionalExpression > ConditionalExpression > Literal[value=/${TEXT}/]`,
    message: MESSAGE,
  },
  {
    selector: `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > Literal[value=/${TEXT}/]`,
    message: MESSAGE,
  },
  {
    selector: `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=/${TEXT}/]`,
    message: MESSAGE,
  },
  {
    selector: `JSXAttribute[name.name=${TEXT_PROPS}] > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=/${TEXT}/]`,
    message: MESSAGE,
  },
  { selector: `Property[key.name=${TEXT_PROPS}] > Literal[value=/${TEXT}/]`, message: MESSAGE },
  {
    selector: `Property[key.name=${TEXT_PROPS}] > TemplateLiteral > TemplateElement[value.raw=/${TEXT}/]`,
    message: MESSAGE,
  },
  {
    selector: `CallExpression[callee.name=/^(set[A-Z]\\w*(Message|Error)|onMessage|onSaved|setMessage|setError|alert)$/] > Literal[value=/${TEXT}/]`,
    message: MESSAGE,
  },
  {
    selector: `CallExpression[callee.name=/^(set[A-Z]\\w*(Message|Error)|onMessage|onSaved|setMessage|setError|alert)$/] > TemplateLiteral > TemplateElement[value.raw=/${TEXT}/]`,
    message: MESSAGE,
  },
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    files: ['src/**/*.tsx', 'src/**/*.ts'],
    // DemoSignIn is development-only and never ships in a store build.
    ignores: ['src/features/auth/DemoSignIn.tsx', 'src/i18n/**'],
    rules: { 'no-restricted-syntax': noUiLiterals },
  },
]);
