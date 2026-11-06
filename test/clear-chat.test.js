// "Clear chat" is the conversation-only counterpart to the transcript
// history's Clear History: it sits beside the Transcription history button,
// empties #messages, and does not let a still-streaming answer paint itself
// back into the emptied panel.
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('vm');
const { readSource, fnFrom } = require('./source-text');

const html = readSource('renderer/index.html');
const renderer = readSource('renderer/renderer.js');
const css = readSource('renderer/styles.css');

test('Clear chat sits beside Transcription history in the composer row', () => {
  const history = html.indexOf('id="history-btn"');
  const clear = html.indexOf('id="clear-chat-btn"');
  assert.ok(history > -1, 'Transcription history button exists');
  assert.ok(clear > history, 'Clear chat comes after Transcription history');
  assert.match(html, /class="history-btn clear-chat-btn"/);
  assert.match(html, /id="clear-chat-btn"[^>]*title="Clear the conversation"/);
  // Still in the same composer row, before the settings and send buttons.
  const row = html.slice(history, html.indexOf('id="send-btn"'));
  assert.match(row, /id="clear-chat-btn"/);
  assert.match(css, /\.clear-chat-btn:hover\s*\{/);
});

test('clearChat empties the conversation and ignores a stream already in flight', () => {
  const ctx = vm.createContext({
    messages: { innerHTML: 'old question and answer' },
    responseCount: 7,
    followAnswer: true
  });
  vm.runInContext(`
    function clearMessages() { messages.innerHTML = ''; }
    function showToast() {}
    ${fnFrom(renderer, '  function clearChat() {')}
    this.run = clearChat;
  `, ctx);

  ctx.run();

  assert.equal(ctx.messages.innerHTML, '');
  assert.equal(ctx.responseCount, 0, 'the response cap starts fresh');
  assert.equal(ctx.followAnswer, false);
  assert.equal(ctx.suppressAnswers, true, 'late tokens are ignored until the next ask');
});

test('the button is wired and the next question takes the panel back', () => {
  assert.match(renderer, /clearChatBtn\.addEventListener\('click', clearChat\)/);
  assert.match(renderer, /suppressAnswers = false; \/\/ a new question owns the panel again/);
});
