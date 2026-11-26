import test from 'node:test';
import assert from 'node:assert/strict';
import { messages, preferredLanguage } from '../src/strings.js';
import { cities } from '../src/core.js';

const keyPaths = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' ? keyPaths(child, `${prefix}${key}.`) : [`${prefix}${key}`],
  );

test('every language translates exactly the same keys', () => {
  const english = keyPaths(messages.en).sort();
  for (const language of ['fi', 'sv']) {
    assert.deepEqual(keyPaths(messages[language]).sort(), english, language);
  }
});

test('no translation is empty', () => {
  for (const [language, copy] of Object.entries(messages)) {
    for (const path of keyPaths(copy)) {
      const value = path.split('.').reduce((node, key) => node[key], copy);
      assert.ok(typeof value === 'string' && value.trim(), `${language}.${path}`);
    }
  }
});

test('every searchable city has a display name in every language', () => {
  for (const copy of Object.values(messages)) {
    assert.deepEqual(Object.keys(copy.cities).sort(), Object.keys(cities).sort());
  }
  assert.equal(messages.sv.cities.Turku, 'Åbo');
  assert.equal(messages.fi.cities.Turku, 'Turku');
});

test('result counts have the plural forms each language selects', () => {
  for (const [language, copy] of Object.entries(messages)) {
    for (const count of [0, 1, 2, 5, 21]) {
      const form = new Intl.PluralRules(language).select(count);
      assert.ok(copy.resultCount[form], `${language} ${count} → ${form}`);
    }
  }
});

test('browser language preferences choose the first supported language', () => {
  assert.equal(preferredLanguage(['fi-FI', 'en-US']), 'fi');
  assert.equal(preferredLanguage(['de-DE', 'sv-FI', 'fi']), 'sv');
  assert.equal(preferredLanguage(['SV']), 'sv');
  assert.equal(preferredLanguage(['de-DE']), 'en');
  assert.equal(preferredLanguage([]), 'en');
  assert.equal(preferredLanguage(undefined), 'en');
});
