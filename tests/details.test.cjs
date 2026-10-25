// Run with: node --test tests/details.test.cjs
// Set COMIX_SOURCE_PATH to test an alternate checkout's actual Comix.kt.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const sourcePath = process.env.COMIX_SOURCE_PATH || path.join(
    __dirname, '../src/en/comix/src/eu/kanade/tachiyomi/extension/en/comix/Comix.kt',
);
const source = fs.readFileSync(sourcePath, 'utf8');
const start = source.indexOf('private suspend fun navigateForQueries(');
assert.ok(start >= 0, 'production detail navigation must exist');
const method = source.slice(start, source.indexOf('private class CachedQueries', start));
const match = /buildScript = \{ passPayloadName ->\s*"""([\s\S]*?)"""\.trimIndent\(\)/.exec(method);
assert.ok(match, 'production detail capture script must be extractable');
const captureScript = match[1].replaceAll('$passPayloadName', 'capturePayload');

function harness(readyState, text) {
    const payloads = [];
    const document = {
        readyState,
        text,
        reads: 0,
        querySelector(selector) {
            assert.equal(selector, 'script#initial-data');
            this.reads++;
            return this.text === null ? null : { textContent: this.text };
        },
    };
    const context = vm.createContext({ document, window: { capturePayload: raw => payloads.push(raw) } });
    return { document, payloads, capture: () => vm.runInContext(captureScript, context) };
}

const fullData = JSON.stringify({ queries: { detail: { title: 'Test title', hid: '0080d' } } });

test('loading document never emits partial or apparently complete initial data', () => {
    for (const text of ['{"queries":{"detail":', fullData]) {
        const run = harness('loading', text);
        run.capture();
        run.capture();
        assert.deepEqual(run.payloads, []);
        assert.equal(run.document.reads, 0, 'do not inspect a still-parsing script element');
    }
});

test('the next poll captures complete data once the document becomes interactive', () => {
    const run = harness('loading', '{"queries":{"detail":');
    run.capture();
    run.document.text = fullData;
    run.document.readyState = 'interactive';
    run.capture();
    assert.deepEqual(run.payloads, [fullData]);
    assert.equal(JSON.parse(run.payloads[0]).queries.detail.hid, '0080d');
    assert.equal(run.document.reads, 1, 'metadata need not wait for images or the load event');
});

test('an already complete document returns its initial data immediately', () => {
    const run = harness('complete', fullData);
    run.capture();
    assert.deepEqual(run.payloads, [fullData]);
});

test('missing or empty initial data waits for a later poll without emitting a payload', () => {
    for (const readyState of ['interactive', 'complete']) {
        for (const text of [null, '']) {
            const run = harness(readyState, text);
            run.capture();
            assert.deepEqual(run.payloads, []);
            run.document.text = fullData;
            run.capture();
            assert.deepEqual(run.payloads, [fullData]);
        }
    }
});
