const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const script = fs.readFileSync(`${__dirname}/../src/en/comix/assets/chapter_list.js`, 'utf8');

async function read({ pager = 'hidden', drawAfter = 0, rowsAfter = 0, total = 3, known = [] } = {}) {
    let ticks = 0;
    const requests = [];
    const taps = [];
    const listeners = new Map();
    const heading = {
        getBoundingClientRect: () => ({ top: 160, bottom: 190, left: 12, right: 220, width: ticks >= drawAfter ? 208 : 0, height: 30 }),
        contains: element => element === heading,
    };
    const hiddenPager = {
        getBoundingClientRect: () => ({ left: 0, right: 0 }),
        querySelectorAll: () => [{ getBoundingClientRect: () => ({ width: 0, left: 0, right: 0 }) }],
    };
    const section = {
        querySelector: selector => {
            if (selector === '.mpage__sec-title') return heading;
            if (selector === '.npager') return pager === 'absent' ? null : hiddenPager;
            if (selector === '.useg__btn.is-on') return null;
            if (selector.includes('.mchap-row__primary')) return ticks >= rowsAfter ? {} : null;
            return null;
        },
        addEventListener() {},
        removeEventListener() {},
    };
    const api = {
        records: [],
        async method(id, params) {
            assert.ok(ticks >= drawAfter && ticks >= rowsAfter, 'must wait for a rendered section');
            requests.push(params.page);
            const first = (params.page - 1) * 2;
            const items = Array.from({ length: Math.min(2, Math.max(0, total - first)) }, (_, i) => ({
                id: first + i + 1, number: first + i + 1, url: `/title/abc-name/${first + i + 1}-chapter-1`,
            }));
            this.records.push({ params, result: { items, meta: { lastPage: Math.max(1, Math.ceil(total / 2)), total } } });
        },
    };
    const result = await new Promise((resolve, reject) => {
        const context = vm.createContext({
            document: {
                readyState: 'complete',
                querySelector: selector => selector === '.mpage__chapters' ? section : null,
                elementFromPoint: () => heading,
                addEventListener: (type, callback) => listeners.set(type, callback),
                removeEventListener: type => listeners.delete(type),
            },
            innerWidth: 240, innerHeight: 800,
            setTimeout: (callback, ms) => {
                if (ms === 200) ticks++;
                return setTimeout(callback, ms >= 2000 ? ms : 0);
            },
            clearTimeout,
            siteApi: () => async () => api,
            known,
            pass: payload => resolve(JSON.parse(payload)),
            touch: points => {
                taps.push(points);
                assert.equal(points.length, 2);
                listeners.get('click')?.({ isTrusted: true, target: heading });
            },
        });
        try { vm.runInContext(`(${script})(siteApi, known, 'abc', '/title/abc-', 1000, touch, pass)`, context); }
        catch (error) { reject(error); }
    });
    return { result, requests, taps };
}

test('fetches every page when pager buttons have no visible area', { timeout: 1000 }, async () => {
    const { result, requests, taps } = await read();
    assert.equal(result.complete, true);
    assert.deepEqual(result.chapters.map(chapter => chapter.id), [1, 2, 3]);
    assert.deepEqual(requests, [1, 2]);
    assert.equal(taps.length, 2);
});

test('fetches a single page with neither pagination nor an active sort button', { timeout: 1000 }, async () => {
    const { result, requests } = await read({ pager: 'absent', total: 1 });
    assert.equal(result.complete, true);
    assert.equal(result.chapters.length, 1);
    assert.deepEqual(requests, [1]);
});

test('waits for chapter content instead of treating the pager shell as ready', { timeout: 1000 }, async () => {
    assert.equal((await read({ rowsAfter: 3 })).result.complete, true);
});

test('waits for the heading to have a usable layout', { timeout: 1000 }, async () => {
    assert.equal((await read({ drawAfter: 3 })).result.complete, true);
});

test('still stops when a stored chapter is reached', { timeout: 1000 }, async () => {
    const { result, requests } = await read({ known: [1] });
    assert.equal(result.complete, true);
    assert.deepEqual(requests, [1]);
});

test('returns an empty chapter list without needing controls', { timeout: 1000 }, async () => {
    const { result } = await read({ pager: 'absent', total: 0 });
    assert.equal(result.complete, true);
    assert.deepEqual(result.chapters, []);
});
