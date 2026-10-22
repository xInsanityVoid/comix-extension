const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {test} = require('node:test');
const source = fs.readFileSync(`${__dirname}/../src/en/comix/assets/chapter_list.js`, 'utf8');
async function read({readyState='complete',obfuscated=false,total=43,known=[],failPage,wrongTitle=false,missingActivity=false,ambiguousActivity=false,maxPages=1000}={}) {
  let now=1000;
  const requests=[],delays=[],progress=[],events=[];
  const context=vm.createContext({
    Date:{now:()=>now},
    document:{readyState,querySelector(selector){
      assert.equal(selector,'script#initial-data','pagination must not depend on layout');
      return {textContent:JSON.stringify({queries:{detail:{title:'Test'}}})};
    },addEventListener(event,callback,options){
      assert.equal(event,'DOMContentLoaded');assert.equal(options.once,true);
      events.push(event);queueMicrotask(callback);
    }},
    window:{addEventListener(){throw Error('Do not wait for the full page load');}},
    setTimeout(callback,delay){delays.push(delay);now+=delay;queueMicrotask(callback);},
    http:{async get(url,{params}){
      assert.equal(context.activityAt,now);
      requests.push(params.page);
      if(params.page===failPage)throw {response:{status:502}};
      const first=(params.page-1)*20;
      const items=Array.from({length:Math.max(0,Math.min(20,total-first))},(_,i)=>({id:first+i+1,number:first+i+1,url:`/title/${wrongTitle?'wrong':'abc'}-name/${first+i+1}-chapter-1`}));
      return {data:{items,meta:{lastPage:Math.max(1,Math.ceil(total/20)),total}}};
    }},known,maxPages,missingActivity,ambiguousActivity,progress:()=>progress.push(now),obfuscated,
  });
  vm.runInContext(`
    var activityAt=0;
    function renamedCallback(){activityAt=Date.now()}
    function anotherCallback(){activityAt=Date.now()}
    const mapper=a=>a;
    const client={get:async(a,b)=>(await http.get(a,b)).data};
    const methods={async chapters(a,b={}){return function(a){return{items:a.items.map(mapper),meta:a.meta}}(await client.get('/manga/'+a+'/chapters',{params:b}))}};
    const decode=n=>({1:'now',2:'map',3:'params'})[n];
    const hiddenMethods={async"Qx"(N,R={}){const config={};config[decode(3)]=R;return function(N){const {"items":I,"meta":M}=N;return {"x":I[decode(2)](mapper),"y":M}}(await client.get('/manga/'+N+'/chapters',config))}};
    function hiddenCallback(){activityAt=Date[decode(1)]()}
    const siteApi=select=>async()=>select([
      {owner:client,key:'get',value:client.get},{owner:methods,key:'chapters',value:obfuscated?hiddenMethods.Qx:methods.chapters},
      ...(!missingActivity?[{value:obfuscated?hiddenCallback:renamedCallback}]:[]),...(ambiguousActivity?[{value:anotherCallback}]:[]),
    ],value=>typeof value==='function'&&String(value).endsWith('.data'));
  `,context);
  const result=await new Promise(resolve=>{context.pass=p=>resolve(JSON.parse(p));vm.runInContext(`(${source})(siteApi,known,'abc','/title/abc-',maxPages,pass,progress)`,context);});
  return {result,requests,delays,progress,events};
}
test('fetches all pages without layout or native input',async()=>{
  const {result,requests,delays,progress}=await read();
  assert.equal(result.complete,true);assert.equal(result.chapters.length,43);assert.deepEqual(requests,[1,2,3]);
  assert.equal(delays.length,3);assert.ok(delays.every(ms=>ms>=2500&&ms<=5000));assert.equal(progress.length,3);
  assert.equal(result.queries.detail.title,'Test');
});
test('single and empty lists need no controls',async()=>{for(const total of [0,1]){const {result,requests}=await read({total});assert.equal(result.complete,true);assert.equal(result.chapters.length,total);assert.deepEqual(requests,[1]);}});
test('stops at a stored chapter',async()=>{const {result,requests}=await read({known:[1]});assert.equal(result.complete,true);assert.deepEqual(requests,[1]);});
test('35 new entries need two pages even when known chapters arrive oldest first',async()=>{
  const known=Array.from({length:276},(_,i)=>311-i);
  const {result,requests}=await read({total:311,known});
  assert.equal(result.complete,true);assert.deepEqual(requests,[1,2]);assert.equal(result.chapters.length,40);
});
test('keeps fetched entries and reports an incomplete list on failure',async()=>{const {result,requests}=await read({failPage:2});assert.equal(result.complete,false);assert.equal(result.chapters.length,20);assert.deepEqual(requests,[1,2]);assert.match(result.error,/HTTP 502/);});
test('rejects another title response',async()=>{const {result}=await read({wrongTitle:true});assert.equal(result.complete,false);assert.equal(result.chapters.length,0);assert.match(result.error,/shape/);});
test('does not guess a missing or ambiguous activity callback',async()=>{for(const options of [{missingActivity:true},{ambiguousActivity:true}]){const {result,requests}=await read(options);assert.equal(result.complete,false);assert.deepEqual(requests,[]);assert.match(result.error,/chapters API/);}});
test('does not mark a capped list complete',async()=>{const {result}=await read({maxPages:1});assert.equal(result.complete,false);assert.match(result.error,/20 of 43/);});


test('obfuscated method names, item mapping and activity callback still paginate',async()=>{
  const {result,requests}=await read({obfuscated:true});
  assert.equal(result.complete,true);assert.equal(result.chapters.length,43);assert.deepEqual(requests,[1,2,3]);
});

test('starts on DOM readiness while images and other load resources remain pending',async()=>{
  for(const readyState of ['loading','interactive']){
    const {result,events,requests}=await read({readyState,known:[1]});
    assert.equal(result.complete,true);assert.deepEqual(requests,[1]);
    assert.deepEqual(events,readyState==='loading'?['DOMContentLoaded']:[]);
  }
});
