const {test} = require('node:test');
const assert = require('node:assert/strict');
const Sync = require('./sync-engine.js');
const snapshot = name => ({state:{collections:[{id:name,words:[]}]},dailyGoal:{},streak:{},imageCache:{}});
function setup({dirty=true, base=0, remoteRevision=0}={}) {
  let local=snapshot('local'), remote=snapshot('remote'), queue=dirty?'edit1':null, rev=base, status, hook;
  const backups=[];
  const engine=new Sync({queue:()=>queue,snapshot:()=>local,revision:()=>rev,setRevision:v=>rev=v,
    clearQueue:q=>{if(q===queue)queue=null},apply:s=>local=s,backup:s=>backups.push(s),status:s=>status=s,
    rpc:async(r,s)=>{if(hook)await hook(r,s);if(s){if(r!==remoteRevision)return {data:remote,revision:remoteRevision,accepted:false};remote=s;remoteRevision++}return {data:remote,revision:remoteRevision,accepted:true}}});
  return {engine,backups,get:()=>({local,remote,queue,rev,status}),edit:()=>{local=snapshot('new');queue='edit2'},hook:f=>hook=f};
}
test('push dirty data at known revision',async()=>{const x=setup();assert.equal(await x.engine.run(),true);assert.equal(x.get().remote.state.collections[0].id,'local');assert.equal(x.get().queue,null)});
test('pull remote when clean',async()=>{const x=setup({dirty:false});await x.engine.run();assert.equal(x.get().local.state.collections[0].id,'remote');assert.equal(x.backups.length,1)});
test('offline edits conflict with newer remote',async()=>{const x=setup({remoteRevision:1});await x.engine.run();assert.equal(x.get().status,'conflict');assert.equal(x.get().queue,'edit1')});
test('cloud conflict choice never pushes local',async()=>{const x=setup({remoteRevision:1});await x.engine.run();await x.engine.run('cloud');assert.equal(x.get().local.state.collections[0].id,'remote');assert.equal(x.get().rev,1);assert.equal(x.get().queue,null)});
test('local conflict choice backs up cloud and uses CAS',async()=>{const x=setup({remoteRevision:1});await x.engine.run();await x.engine.run('local');assert.equal(x.get().remote.state.collections[0].id,'local');assert.equal(x.get().rev,2);assert.equal(x.backups.length,1)});
test('edits during push remain queued',async()=>{const x=setup();x.hook(async(r,s)=>{if(s)x.edit()});await x.engine.run();assert.equal(x.get().queue,'edit2');assert.equal(x.get().local.state.collections[0].id,'new');assert.equal(x.get().remote.state.collections[0].id,'local')});
test('edits during read do not get replaced',async()=>{const x=setup({dirty:false});x.hook(async()=>x.edit());await x.engine.run();assert.equal(x.get().local.state.collections[0].id,'new');assert.equal(x.get().queue,'edit2')});
test('network errors retain edits and never report success',async()=>{const x=setup();x.hook(async()=>{throw Error('offline')});assert.equal(await x.engine.run(),false);assert.equal(x.get().status,'offline');assert.equal(x.get().queue,'edit1')});
test('unknown base with local edits requests explicit choice',async()=>{const x=setup({base:null});await x.engine.run();assert.equal(x.get().status,'conflict')});
test('concurrent runs are serialized',async()=>{const x=setup();let release; x.hook(()=>new Promise(r=>release=r));const first=x.engine.run();assert.equal(await x.engine.run(),false);x.hook(null);release();await first;assert.equal(x.get().rev,1)});

test('JSON key ordering from PostgreSQL is irrelevant',()=>{assert.ok(Sync.equal({state:{collections:[],name:'a'},dailyGoal:{a:1,b:2}}, {dailyGoal:{b:2,a:1},state:{name:'a',collections:[]}}))});
