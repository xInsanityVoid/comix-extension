// Run with: node --experimental-vm-modules tests/site-api.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(`${__dirname}/../src/en/comix/assets/site_api.js`, 'utf8');
const main = 'https://comix.to/assets/build/test/dist/main-test.js';
const mirror = 'https://comix.to/assets/t3/api-test.js';
const getter = 'const raw={renamed:async(a,b)=>(await http.get(a,b)).data};';
const defaultSelector = '(members, isGet) => members.find(member => isGet(member.value))';

function harness({ resources = [main], modules, setup = '', texts = {}, failedImports = [], failedFetches = [], selector = defaultSelector } = {}) {
    let now = 0;
    const imports = [], fetches = [];
    const context = vm.createContext({
        performance: { getEntriesByType: () => resources.map(name => ({ name })) },
        Date: { now: () => now },
        setTimeout: (callback, ms) => { now += ms; queueMicrotask(callback); },
        fetch: async url => {
            fetches.push(url);
            if (failedFetches.includes(url)) throw Error('fetch failed');
            return { text: async () => texts[url] || '' };
        },
    });
    // The proxy exists before discovery starts, as it can on a late-injected host.
    vm.runInContext(`
        globalThis.window = globalThis;
        globalThis.nativeProxy = Proxy;
        globalThis.mask = target => new Proxy(target, {
            get(target, key) { const value = target[key]; return typeof value === 'function' ? value.bind(target) : value; },
            has() { return false; }, ownKeys() { return []; }, getOwnPropertyDescriptor() {},
        });
        globalThis.http = { get: async (url, config) => ({ data: { url, config } }) };
        ${getter}
        globalThis.api = mask(raw);
        ${setup}
    `, context);
    const script = new vm.Script(`globalThis.findApi = (${source})(${selector});`, {
        importModuleDynamically: async url => {
            imports.push(url);
            if (failedImports.includes(url)) throw Error('chunk unavailable');
            const values = modules ? modules(context, url) : { api: context.api };
            const module = new vm.SyntheticModule(Object.keys(values), function () {
                for (const [key, value] of Object.entries(values)) this.setExport(key, value);
            }, { context });
            await module.link(() => {});
            await module.evaluate();
            return module;
        },
    });
    script.runInContext(context);
    return { ctx: context, imports, fetches };
}

test('recovers an existing hidden API and preserves interception and restores Proxy', async () => {
    const {ctx} = harness({ texts: { [main]: getter } });
    assert.equal(vm.runInContext('Object.keys(api).length', ctx), 0);
    assert.match(String(ctx.api.renamed), /\[native code\]/);
    const member = await ctx.findApi();
    assert.equal(member.owner, ctx.api);
    assert.equal(member.key, 'renamed');
    assert.equal((await member.value('/chapters/123')).url, '/chapters/123');
    member.owner[member.key] = async () => 'intercepted';
    assert.equal(await ctx.api.renamed(), 'intercepted');
    assert.equal(vm.runInContext('Proxy', ctx), ctx.nativeProxy);
});

test('plain exported objects need no source fetch', async () => {
    const {ctx, fetches} = harness({ setup: 'globalThis.api = raw;' });
    assert.equal((await ctx.findApi()).owner, ctx.api);
    assert.deepEqual(fetches, []);
});

test('exposes direct function exports used by pagination', async () => {
    const {ctx, fetches} = harness({
        setup: 'var activityAt=0; globalThis.callback=function renamed(){activityAt=Date.now()};',
        modules: ctx => ({ callback: ctx.callback }),
        selector: "members => members.find(member => member.key === 'callback')",
    });
    assert.equal((await ctx.findApi()).value, ctx.callback);
    assert.deepEqual(fetches, []);
});

test('finds enumerable methods nested in an exported object', async () => {
    const {ctx} = harness({ setup: 'globalThis.api = { client: raw };' });
    assert.equal((await ctx.findApi()).owner, ctx.api.client);
});

test('finds hidden API assets outside the main build directory', async () => {
    const {ctx, imports, fetches} = harness({
        resources: [main, mirror],
        modules: (ctx, url) => url === mirror ? { api: ctx.api } : {},
        texts: { [mirror]: getter },
    });
    assert.equal((await ctx.findApi()).owner, ctx.api);
    assert.deepEqual(imports, [main, mirror]);
    assert.ok(fetches.includes(mirror));
});

test('combines the activity export with an API exported from another chunk', async () => {
    const {ctx} = harness({
        resources: [main, mirror],
        setup: 'var activityAt=0; globalThis.callback=function renamed(){activityAt=Date.now()};',
        modules: (ctx, url) => url === main ? { callback: ctx.callback } : { api: ctx.api },
        texts: { [mirror]: getter },
        selector: `(members,isGet) => {
            const activity=members.find(m=>m.key==='callback');
            const get=members.find(m=>isGet(m.value));
            return activity && get ? {activity:activity.value,get:get.value} : null;
        }`,
    });
    const result = await ctx.findApi();
    assert.equal(result.activity, ctx.callback);
    assert.equal((await result.get('/chapters/123')).url, '/chapters/123');
});

test('an unimportable script does not block discovery in another asset', async () => {
    const {ctx} = harness({ resources: [main, mirror], failedImports: [main], texts: { [mirror]: getter } });
    assert.ok(await ctx.findApi());
    assert.equal(vm.runInContext('Proxy', ctx), ctx.nativeProxy);
});

test('retries the selector without repeatedly importing or fetching the same assets', async () => {
    const {ctx, imports, fetches} = harness({
        texts: { [main]: getter }, setup: 'globalThis.attempts=0;',
        selector: '(members,isGet) => ++attempts > 4 ? members.find(m=>isGet(m.value)) : null',
    });
    assert.ok(await ctx.findApi());
    assert.deepEqual(imports, [main]);
    assert.deepEqual(fetches, [main]);
});

test('source extraction handles nested template expressions and delimiters in strings', async () => {
    const definition = 'const routes={route:id=>`/chapters/${id+String("}").length-1}`};';
    const {ctx} = harness({
        setup: `${definition} globalThis.api=mask(routes);`, texts: { [main]: definition },
        selector: 'members=>members.find(m=>String(m.value).includes("`/chapters/"))',
    });
    assert.equal((await ctx.findApi()).value(123), '/chapters/123');
});

test('times out cleanly when hidden source cannot be fetched', async () => {
    const {ctx, fetches} = harness({ failedFetches: [main] });
    assert.equal(await ctx.findApi(), null);
    assert.deepEqual(fetches, [main]);
    assert.equal(vm.runInContext('Proxy', ctx), ctx.nativeProxy);
});

test('waits for subsequently loaded chunks', async () => {
    const resources = [main];
    const {ctx, imports} = harness({
        resources, modules: (ctx, url) => {
            if (url === main) { resources.push(mirror); return {}; }
            return { api: ctx.api };
        }, texts: { [mirror]: getter },
    });
    assert.ok(await ctx.findApi());
    assert.deepEqual(imports, [main, mirror]);
});

test('times out without touching browser globals if no entry script appears', async () => {
    const {ctx, imports, fetches} = harness({ resources: [] });
    assert.equal(await ctx.findApi(), null);
    assert.deepEqual(imports, []);
    assert.deepEqual(fetches, []);
    assert.equal(vm.runInContext('Proxy', ctx), ctx.nativeProxy);
});


test('captures a private obfuscated request helper that is not exported', async () => {
    const {ctx, fetches} = harness({modules:()=>({})});
    vm.runInContext(`
        const decode=n=>({7:'request',8:'get',9:'data'})[n];
        const client={request:async({method,url,...config})=>{
            if(method!=='get')throw Error('wrong HTTP method');
            return http.get(url,config);
        }};
        globalThis.privateApi=mask({"Qx":async(N,R)=>(await client[decode(7)]({...R,"method":decode(8),"url":N}))[decode(9)]});
    `,ctx);
    const member=await ctx.findApi();
    assert.equal(member.key,'Qx');
    assert.equal((await member.value('/chapters/16')).url,'/chapters/16');
    member.owner[member.key]=async()=> 'intercepted';
    assert.equal(await ctx.privateApi.Qx(),'intercepted');
    assert.deepEqual(fetches,[]);
    assert.equal(vm.runInContext('Proxy',ctx),ctx.nativeProxy);
});

test('reads quoted asynchronous method names from already-loaded API source', async () => {
    const definition='const methods={async"Qx"(N,R={}){return {"items":N,"meta":R}}};';
    const {ctx}=harness({setup:definition+'globalThis.api=mask(methods);',texts:{[main]:definition},selector:"members=>members.find(m=>m.key==='Qx')"});
    const member=await ctx.findApi();
    assert.equal((await member.value(16)).items,16);
    assert.match(String(member.value),/^async"Qx"/);
});

test('does not overwrite another script replacement of Proxy', async () => {
    const {ctx}=harness({setup:'globalThis.api=raw;'});
    vm.runInContext('globalThis.replacement=function Replacement(){};window.Proxy=replacement;',ctx);
    assert.ok(await ctx.findApi());
    assert.equal(vm.runInContext('Proxy',ctx),ctx.replacement);
});

const characterCodeGetter = 'const currentClient={"O3":async(p,F)=>(await oj[Y1(1104)]({...F,[lj]:mj,"url":p}))[nj]};';
const characterCodeSetup = `
    const Y1=n=>({1104:'request'})[n];
    const lj=String.fromCharCode(109,101,116,104,111,100);
    const mj=String.fromCharCode(103,101,116);
    const nj=String.fromCharCode(100,97,116,97);
    globalThis.calls=[];
    const oj={request:async config=>{calls.push(config);return {data:{url:config.url,params:config.params}};}};
    ${characterCodeGetter}
`;

test('captures the current private GET helper with character-code method and data constants', async () => {
    const {ctx,fetches}=harness({modules:()=>({})});
    vm.runInContext(`${characterCodeSetup} globalThis.currentApi=mask(currentClient);`,ctx);
    const member=await ctx.findApi();
    assert.equal(member.key,'O3');
    assert.equal(ctx.calls.length,0,'discovery must not invoke the request helper');
    const params={page:1,limit:20,order:{created_at:'desc'}};
    const response=await member.value('/manga/abc/chapters',{params});
    assert.equal(response.url,'/manga/abc/chapters');
    assert.equal(response.params,params);
    assert.equal(ctx.calls[0].method,'get');
    assert.deepEqual(fetches,[]);
    assert.equal(vm.runInContext('Proxy',ctx),ctx.nativeProxy);
});

test('recovers the same character-code GET shape from an already-loaded hidden client', async () => {
    const {ctx}=harness({
        setup:`${characterCodeSetup} globalThis.api=mask(currentClient);`,
        texts:{[main]:characterCodeGetter},
    });
    const member=await ctx.findApi();
    assert.equal(member.key,'O3');
    assert.equal(ctx.calls.length,0);
    assert.equal((await member.value('/manga/abc/chapters',{params:{page:1}})).url,'/manga/abc/chapters');
    member.owner[member.key]=async()=> 'intercepted';
    assert.equal(await ctx.api.O3(),'intercepted');
});

test('rejects a character-code request shape that swaps the URL and configuration arguments', async () => {
    const swapped=characterCodeGetter.replace('...F,[lj]:mj,"url":p','...p,[lj]:mj,"url":F');
    const {ctx}=harness({
        setup:`${characterCodeSetup.replace(characterCodeGetter,swapped)} globalThis.api=mask(currentClient);`,
        texts:{[main]:swapped},
    });
    assert.equal(await ctx.findApi(),null);
    assert.equal(ctx.calls.length,0);
});
