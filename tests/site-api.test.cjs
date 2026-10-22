// Run with: node --experimental-vm-modules tests/site-api.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(`${__dirname}/../src/en/comix/assets/site_api.js`, 'utf8');
const url = 'https://comix.to/assets/build/test/dist/main-test.js';

function harness({ resources = [url], importError = false } = {}) {
    let now = 0;
    const context = vm.createContext({
        performance: { getEntriesByType: () => resources.map(name => ({ name })) },
        Date: { now: () => now },
        setTimeout: (callback, ms) => { now += ms; callback(); },
    });
    vm.runInContext('globalThis.window = globalThis; globalThis.nativeProxy = Proxy;', context);
    const script = new vm.Script(`globalThis.findApi = (${source})((members, isGet) => members.find(member => isGet(member.value)));`, {
        importModuleDynamically: async () => {
            if (importError) throw new Error('chunk unavailable');
            const module = new vm.SyntheticModule(['api', 'nested'], function () {
                this.setExport('api', context.api);
                this.setExport('nested', context.nested);
            }, { context });
            await module.link(() => {});
            await module.evaluate();
            return module;
        },
    });
    script.runInContext(context);
    vm.runInContext(`
        globalThis.mask = target => new Proxy(target, {
            get(target, key) { const value = target[key]; return typeof value === 'function' ? value.bind(target) : value; },
            has() { return false; },
            ownKeys() { return []; },
            getOwnPropertyDescriptor() {},
        });
        globalThis.http = { get: async (url, config) => ({ data: { url, config } }) };
        globalThis.raw = { get: async (url, config) => (await http.get(url, config)).data };
    `, context);
    return context;
}

test('finds hidden API methods without changing what the site sees', async () => {
    const ctx = harness();
    vm.runInContext('globalThis.api = mask(raw);', ctx);
    assert.equal(vm.runInContext('Object.keys(api).length', ctx), 0);
    assert.equal(vm.runInContext('"get" in api', ctx), false);
    assert.match(vm.runInContext('String(api.get)', ctx), /\[native code\]/);
    const member = await ctx.findApi();
    assert.equal(member.owner, ctx.raw);
    assert.equal(member.key, 'get');
    assert.equal((await member.value('/chapters/123')).url, '/chapters/123');
    // Chapter-list interception must write to the target read by the site's proxy.
    member.owner[member.key] = async () => 'intercepted';
    assert.equal(await ctx.api.get(), 'intercepted');
    assert.equal(ctx.Proxy, ctx.nativeProxy);
});

test('supports the previous plain-object exports', async () => {
    const ctx = harness();
    vm.runInContext('globalThis.api = raw;', ctx);
    assert.equal((await ctx.findApi()).owner, ctx.raw);
    assert.equal(ctx.Proxy, ctx.nativeProxy);
});

test('unwraps API objects nested in an exported object', async () => {
    const ctx = harness();
    vm.runInContext('globalThis.nested = mask({ client: mask(raw) });', ctx);
    assert.equal((await ctx.findApi()).owner, ctx.raw);
});

test('leaves ordinary and revocable proxy behavior intact', async () => {
    const ctx = harness();
    vm.runInContext(`
        globalThis.api = mask(raw);
        globalThis.ordinary = new Proxy({ value: 3 }, { get: (target, key) => target[key] * 2 });
        globalThis.revocable = Proxy.revocable({ value: 7 }, {});
    `, ctx);
    assert.equal(ctx.ordinary.value, 6);
    assert.equal(ctx.revocable.proxy.value, 7);
    ctx.revocable.revoke();
    assert.throws(() => ctx.revocable.proxy.value, /revoked/);
    await ctx.findApi();
});

test('restores Proxy after the lookup times out', async () => {
    const ctx = harness({ resources: [] });
    assert.equal(await ctx.findApi(), null);
    assert.equal(ctx.Proxy, ctx.nativeProxy);
});

test('restores Proxy when a module import fails', async () => {
    const ctx = harness({ importError: true });
    await assert.rejects(ctx.findApi(), /chunk unavailable/);
    assert.equal(ctx.Proxy, ctx.nativeProxy);
});

test('does not overwrite a later replacement of Proxy', async () => {
    const ctx = harness();
    vm.runInContext('globalThis.api = mask(raw); globalThis.replacement = function Replacement() {}; window.Proxy = replacement;', ctx);
    assert.ok(await ctx.findApi());
    assert.equal(ctx.Proxy, ctx.replacement);
});
