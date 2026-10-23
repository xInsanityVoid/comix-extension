const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {test} = require('node:test');
const source = fs.readFileSync(`${__dirname}/../src/en/comix/assets/chapter_list.js`, 'utf8');
async function read({readyState='complete',obfuscated=false,total=43,known=[],failPage,wrongTitle=false,missingActivity=false,ambiguousActivity=false,maxPages=1000,resume=null,clock=1000,idOffset=0}={}) {
  let now=clock;
  const requests=[],delays=[],progress=[],checkpoints=[],events=[];
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
      const items=Array.from({length:Math.max(0,Math.min(20,total-first))},(_,i)=>({id:idOffset+first+i+1,number:first+i+1,url:`/title/${wrongTitle?'wrong':'abc'}-name/${idOffset+first+i+1}-chapter-1`}));
      return {data:{items,meta:{lastPage:Math.max(1,Math.ceil(total/20)),total}}};
    }},known,maxPages,missingActivity,ambiguousActivity,progress:state=>{if(state)checkpoints.push(JSON.parse(state));else progress.push(now);},obfuscated,resume,
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
  const result=await new Promise(resolve=>{context.pass=p=>resolve(JSON.parse(p));vm.runInContext(`(${source})(siteApi,known,'abc','/title/abc-',maxPages,pass,progress,resume)`,context);});
  return {result,requests,delays,progress,checkpoints,events};
}
test('fetches all pages without layout or native input',async()=>{
  const {result,requests,delays,progress}=await read();
  assert.equal(result.complete,true);assert.equal(result.chapters.length,43);assert.deepEqual(requests,[1,2,3]);
  assert.equal(delays.length,2);assert.ok(delays.every(ms=>ms>=2500&&ms<=5000));assert.equal(progress.length,3);
  assert.equal(progress[0],1000,'the first request must have no artificial pause');
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

test('resumes a failed full fetch after checking the live first page',async()=>{
  const interrupted=await read({failPage:3});
  assert.equal(interrupted.result.complete,false);
  assert.deepEqual(interrupted.checkpoints.map(c=>c.nextPage),[2,3]);
  const resume=interrupted.checkpoints.at(-1);
  assert.equal(resume.chapters.length,40);
  const resumed=await read({resume,clock:20000});
  assert.equal(resumed.result.complete,true);
  assert.deepEqual(resumed.requests,[1,3]);
  assert.deepEqual(resumed.result.chapters.map(c=>c.id),Array.from({length:43},(_,i)=>i+1));
  assert.equal(resumed.checkpoints.at(-1).nextPage,4);
  assert.ok(resumed.checkpoints.at(-1).savedAt>resume.savedAt,'new progress renews the retry window');
});

test('recovers a completed response lost by the reader without extending its cache lifetime',async()=>{
  const initial=await read();
  const resume=initial.checkpoints.at(-1);
  const recovered=await read({resume,clock:20000});
  assert.equal(recovered.result.complete,true);
  assert.deepEqual(recovered.requests,[1]);
  assert.deepEqual(recovered.delays,[]);
  assert.deepEqual(recovered.result.chapters,initial.result.chapters);
  assert.equal(recovered.checkpoints.at(-1).savedAt,resume.savedAt);
});

test('rejects expired, future, mismatched and corrupt saved offsets',async()=>{
  const initial=await read({failPage:3});
  const original=initial.checkpoints.at(-1);
  const variants=[
    {...original,savedAt:-300000}, {...original,savedAt:30000},
    {...original,mangaId:'wrong'}, {...original,total:44}, {...original,lastPage:4},
    {...original,nextPage:3.5}, {...original,nextPage:99},
    {...original,chapters:original.chapters.slice(0,39)},
    {...original,chapters:[...original.chapters.slice(0,39),original.chapters[20]]},
    {...original,chapters:original.chapters.map((c,i)=>i===20?{...c,url:'/title/wrong/1'}:c)},
  ];
  for(const resume of variants){
    const fetched=await read({resume,clock:20000});
    assert.equal(fetched.result.complete,true);
    assert.deepEqual(fetched.requests,[1,2,3]);
    assert.equal(fetched.result.chapters.length,43);
  }
});

test('new uploads with unchanged total invalidate cached page offsets',async()=>{
  const initial=await read({failPage:3});
  const fetched=await read({resume:initial.checkpoints.at(-1),clock:20000,idOffset:100});
  assert.equal(fetched.result.complete,true);
  assert.deepEqual(fetched.requests,[1,2,3]);
  assert.deepEqual(fetched.result.chapters.map(c=>c.id),Array.from({length:43},(_,i)=>i+101));
});

test('a resumed fetch that fails again preserves progress without claiming completion',async()=>{
  const initial=await read({total:100,failPage:3});
  const fetched=await read({total:100,resume:initial.checkpoints.at(-1),clock:20000,failPage:5});
  assert.equal(fetched.result.complete,false);
  assert.deepEqual(fetched.requests,[1,3,4,5]);
  assert.equal(fetched.checkpoints.at(-1).chapters.length,80);
  assert.equal(fetched.checkpoints.at(-1).nextPage,5);
});

test('stored-chapter checks ignore full-fetch cache and do not replace it',async()=>{
  const initial=await read();
  const fetched=await read({resume:initial.checkpoints.at(-1),clock:20000,known:[22]});
  assert.equal(fetched.result.complete,true);
  assert.deepEqual(fetched.requests,[1,2]);
  assert.deepEqual(fetched.checkpoints,[]);
});

// These are the current site methods, with their shared pagination mapper and
// character-code params key. Keep both: their signatures alone are ambiguous.
const currentMangaMethod='async"r4"(F,Y={}){const JK=Y1,R=ll.gV.r4(F);Se(R,Y[JK(807)]);const u={};return u[hj]=Y,function(p){return nl(p,$m)}(await tj.O3(R,u))}';
const currentGroupMethod='async"r4"(F,Y={}){const XK=Y1,R=ll.DP.r4(F);Se(R,Y[XK(807)]);const u={};return u[XK(1664)]=Y,function(p){return nl(p,wm)}(await tj.O3(R,u))}';

async function readCurrent({kinds=['group','manga'],duplicates=false,endpoint='/manga/abc/chapters',paramsExpression,lockGet=false,missingHelper=false}={}) {
  const requests=[],registrations=[],mapped=[];
  const context=vm.createContext({
    Date:{now:()=>1000},
    document:{readyState:'complete',querySelector:()=>null},
    setTimeout:callback=>queueMicrotask(callback),
    kinds,duplicates,endpoint,lockGet,requests,registrations,mapped,
    network:async config=>{
      requests.push({url:config.url,method:config.method,page:config.params.page});
      assert.equal(context.activityAt,1000,'a probe must not reach the real request helper');
      return {data:{items:[{id:1,number:16,url:'/title/abc-name/1-chapter-16'}],meta:{lastPage:1,total:1}}};
    },
  });
  const mangaMethod=paramsExpression
    ? `async chapters(a,b={}){return function(a){return{items:a.items.map(mapper),meta:a.meta}}(await tj.O3('/manga/'+a+'/chapters',{params:${paramsExpression}}))}`
    : currentMangaMethod.replace('tj.O3',missingHelper?'tj.Q9':'tj.O3');
  vm.runInContext(`
    var activityAt=0;
    function renamedCallback(){activityAt=Date.now()}
    const Y1=n=>({807:'page',1664:'params',1104:'request'})[n];
    const hj=String.fromCharCode(112,97,114,97,109,115);
    const lj=String.fromCharCode(109,101,116,104,111,100);
    const mj=String.fromCharCode(103,101,116);
    const nj=String.fromCharCode(100,97,116,97);
    const oj={request:network};
    const tj={"O3":async(p,F)=>(await oj[Y1(1104)]({...F,[lj]:mj,"url":p}))[nj]};
    const originalGet=tj.O3;
    tj.Q9=originalGet;
    if(lockGet)Object.defineProperty(tj,'O3',{writable:false});
    const ll={gV:{r4:id=>endpoint},DP:{r4:id=>'/groups/'+id+'/chapters'}};
    function Se(url,page){registrations.push({url,page})}
    const $m=item=>item,wm=item=>item,mapper=item=>item;
    function nl(page,mapper){mapped.push(page.items.length);return {zP:page.items.map(mapper),bf:page.meta}}
    const group={${currentGroupMethod}};
    const manga={${mangaMethod}};
    const anotherManga={${mangaMethod}};
    const methodKey=${JSON.stringify(paramsExpression?'chapters':'r4')};
    const owners={group,manga,anotherManga};
    const members=[{owner:tj,key:'O3',value:originalGet},{value:renamedCallback},...kinds.map(kind=>{
      const owner=owners[kind],key=kind==='group'?'r4':methodKey;
      return {owner,key,value:owner[key]};
    })];
    if(duplicates)for(const member of members.slice()){
      if(!member.owner)continue;
      const wrapped=function(...args){return member.value(...args)};
      wrapped.toString=()=>String(member.value);
      members.push({...member,value:wrapped});
    }
    const siteApi=select=>async()=>select(members,value=>String(value)===String(originalGet));
  `,context);
  const result=await new Promise(resolve=>{
    context.pass=value=>resolve(JSON.parse(value));
    vm.runInContext(`(${source})(siteApi,[],'abc','/title/abc-',1000,pass)`,context);
  });
  return {result,requests,registrations,mapped};
}

test('current shared-map methods choose manga chapters when the group candidate appears first',async()=>{
  const {result,requests,registrations,mapped}=await readCurrent();
  assert.equal(result.complete,true);
  assert.equal(result.chapters[0].number,16);
  assert.deepEqual(registrations.map(call=>call.url),['/groups/abc/chapters','/manga/abc/chapters','/manga/abc/chapters']);
  assert.deepEqual(requests,[{url:'/manga/abc/chapters',method:'get',page:1}],'both selection probes must stop before network');
  assert.deepEqual(mapped,[1],'probe responses must never enter the shared mapper');
});

test('duplicate wrappers for an owner and key do not create ambiguous chapter methods or duplicate requests',async()=>{
  const {result,requests,registrations}=await readCurrent({duplicates:true});
  assert.equal(result.complete,true);
  assert.equal(requests.length,1);
  assert.equal(registrations.length,3,'each unique owner/key should be probed exactly once');
});

test('missing and ambiguous manga endpoints fail closed without fetching a chapter page',async()=>{
  for(const options of [{kinds:['group']},{endpoint:'/manga/wrong/chapters'},{kinds:['group','manga','anotherManga']}]){
    const {result,requests,mapped}=await readCurrent(options);
    assert.equal(result.complete,false,JSON.stringify(options));
    assert.equal(result.chapters.length,0);
    assert.match(result.error,/identify.*manga chapters API/);
    assert.deepEqual(requests,[]);
    assert.deepEqual(mapped,[]);
  }
});

test('chapter probes reject copied, altered or filtered request parameters',async()=>{
  for(const paramsExpression of [
    '{...b}',
    'Object.assign(b,{page:2})',
    'Object.assign(b,{limit:100})',
    'Object.assign(b,{order:{created_at:"asc"}})',
    'Object.assign(b,{order:{created_at:"desc",number:"asc"}})',
    'Object.assign(b,{scanlator_id:123})',
  ]){
    const {result,requests}=await readCurrent({kinds:['manga'],paramsExpression});
    assert.equal(result.complete,false,paramsExpression);
    assert.equal(result.chapters.length,0);
    assert.match(result.error,/identify.*manga chapters API/);
    assert.deepEqual(requests,[],paramsExpression);
  }
});

test('a read-only GET target fails before any preflight can reach the network',async()=>{
  const {result,requests}=await readCurrent({lockGet:true});
  assert.equal(result.complete,false);
  assert.match(result.error,/intercept.*chapter API/);
  assert.deepEqual(requests,[]);
});

test('a current method whose GET helper was not discovered is never invoked',async()=>{
  const {result,requests}=await readCurrent({kinds:['manga'],missingHelper:true});
  assert.equal(result.complete,false);
  assert.match(result.error,/chapters API/);
  assert.deepEqual(requests,[]);
});
