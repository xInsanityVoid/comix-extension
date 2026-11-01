const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const script = fs.readFileSync(path.join(__dirname, '../src/en/comix/assets/tags_search.js'), 'utf8');

function run(result, error, discover = true) {
    const requests = [];
    return new Promise(resolve => {
        const context = vm.createContext({ document: { readyState: 'complete' }, window: {} });
        const get = async (url, config) => { requests.push(JSON.parse(JSON.stringify({ url, config }))); if (error) throw error; return result; };
        const siteApi = select => async () => select(discover ? [{ value: get }] : [], value => value === get);
        vm.runInContext(`(${script})`, context)(siteApi, 'author', 'Cheon', payload => resolve({ payload: JSON.parse(payload), requests }), error => resolve({ error, requests }));
    });
}

test('bare tag arrays are wrapped for the Kotlin response DTO without losing IDs or labels', async () => {
    const result = [{ id: 13470, label: 'Cheongdam', slug: 'cheongdam' }];
    const captured = await run(result);
    assert.deepEqual(captured.payload, { result });
    assert.deepEqual(captured.requests, [{ url: '/tags/search', config: { params: { type: 'author', q: 'Cheon' } } }]);
});
test('already wrapped responses retain their existing envelope', async () => {
    const result = { result: [{ id: 1, label: 'Cheon' }] };
    assert.deepEqual((await run(result)).payload, result);
});
test('empty arrays remain explicit empty results for the native no-match error', async () => {
    assert.deepEqual((await run([])).payload, { result: [] });
});
test('HTTP failures are rejected instead of becoming empty search results', async () => {
    assert.equal((await run(null, { response: { status: 503 } })).error, 'Tag search failed: HTTP 503');
});
test('missing API discovery remains an explicit error', async () => {
    assert.equal((await run(null, null, false)).error, "Could not find the site's tag API");
});
