// Dahl and OpenRouter are first-class OpenAI-compatible providers.
//   - fixed, non-user-editable base URLs
//   - current default models
//   - Dahl's text-only guard (its API rejects image_url parts)
//   - inline <think> reasoning is never shown or persisted
const test = require('node:test');
const assert = require('node:assert/strict');

const { createLLM, inlineThinkFilter } = require('../src/llm');
const { OWN_KEY_CHECK_PROVIDERS } = require('../src/own-key-check');

test('Dahl uses its fixed base URL and live default model', () => {
  const llm = createLLM({ provider: 'dahl', apiKeys: { dahl: 'dahl_test' } });
  assert.equal(llm.ready, true);
  assert.equal(llm.baseURL, 'https://inference.dahl.global/v1');
  assert.equal(llm.model, 'zai-org/GLM-5.3-Flash');
  assert.equal(llm.providerName, 'Dahl');
});

test('Dahl keeps the configured fast and smart tiers', () => {
  const settings = {
    provider: 'dahl',
    apiKeys: { dahl: 'dahl_test' },
    models: { dahl: { fast: 'MiniMaxAI/MiniMax-M2.7', smart: 'deepseek-ai/DeepSeek-V4-Flash-0731' } }
  };
  assert.equal(createLLM({ ...settings, smart: false }).model, 'MiniMaxAI/MiniMax-M2.7');
  assert.equal(createLLM({ ...settings, smart: true }).model, 'deepseek-ai/DeepSeek-V4-Flash-0731');
});

test('Dahl refuses a screenshot before sending a request', async () => {
  const llm = createLLM({ provider: 'dahl', apiKeys: { dahl: 'dahl_test' } });
  await assert.rejects(
    () => llm.stream({ turns: [{ role: 'user', text: 'what is this?' }], imageDataUrl: 'data:image/png;base64,AAAA' }),
    /text-only and cannot read screenshots/
  );
});

test('Dahl reports a missing key like every other own provider', () => {
  const llm = createLLM({ provider: 'dahl', apiKeys: {} });
  assert.equal(llm.ready, false);
  assert.equal(llm.missingKey, true);
  assert.match(llm.configurationError, /Dahl key/);
});

test('OpenRouter uses its fixed base URL and current default models', () => {
  const settings = {
    provider: 'openrouter',
    apiKeys: { openrouter: 'sk-or-v1-test' },
    models: { openrouter: { fast: 'google/gemini-3.8-flash', smart: 'anthropic/claude-sonnet-5.5' } }
  };
  const fast = createLLM({ ...settings, smart: false });
  const smart = createLLM({ ...settings, smart: true });
  assert.equal(fast.ready, true);
  assert.equal(fast.baseURL, 'https://openrouter.ai/api/v1');
  assert.equal(fast.model, 'google/gemini-3.8-flash');
  assert.equal(smart.model, 'anthropic/claude-sonnet-5.5');
  assert.equal(smart.providerName, 'OpenRouter');
});

test('inlineThinkFilter drops <think> blocks even when tags split across chunks', () => {
  const filter = inlineThinkFilter();
  const chunks = ['<thi', 'nk>hidden reasoning</thi', 'nk>Hel', 'lo', ' world'];
  const out = chunks.map((chunk) => filter.push(chunk)).join('') + filter.end();
  assert.equal(out, 'Hello world');
});

test('inlineThinkFilter leaves ordinary text and code untouched', () => {
  const filter = inlineThinkFilter();
  const text = 'Use <div class="x"> here, not <think later.';
  assert.equal(filter.push(text) + filter.end(), text);
});

test('both providers have free key-validation checks', () => {
  assert.ok(OWN_KEY_CHECK_PROVIDERS.includes('dahl'));
  assert.ok(OWN_KEY_CHECK_PROVIDERS.includes('openrouter'));
});
