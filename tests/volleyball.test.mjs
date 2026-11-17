import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeTeams,makeLeague,standings,bracket,parseSets} from '../volleyball.mjs';
import {volleyballSettingsRows,readVolleyballSettings,restoreVolleyball} from '../volleyball-backup.mjs';

const demo = {skills:{1:{under:0,over:12}},events:[{id:'cup',name:'테스트 대회',mode:'리그전',teams:[{id:1,name:'1팀',members:[{no:1,name:'가상학생'}]},{id:2,name:'2팀',members:[{no:2,name:'가상학생2'}]}],matches:[{a:1,b:2,score:'3:1'}],scores:{}}]};
test('volleyball backup round-trip and class/all restore isolation',()=>{
 const source={'4-1':demo,'4-2':{skills:{},events:[]}};
 const decoded=readVolleyballSettings(volleyballSettingsRows(source,Object.keys(source)));
 assert.deepEqual(decoded,source);
 const current={'4-1':{skills:{},events:[]},'4-2':demo};
 const next=restoreVolleyball(current,decoded,{classes:['4-1','4-2'],targetClass:'4-2',sourceClass:'4-1'});
 assert.deepEqual(next['4-2'],demo);assert.deepEqual(next['4-1'],current['4-1']);
 assert.deepEqual(restoreVolleyball(current,null,{classes:['4-1','4-2']}),current);
 assert.equal(readVolleyballSettings([['기존설정','값']]),null);
});
test('corrupt and missing chunks reject before data mutation',()=>{
 const rows=volleyballSettingsRows({'4-1':demo},['4-1']);
 assert.throws(()=>readVolleyballSettings(rows.slice(0,-1)));
 assert.throws(()=>readVolleyballSettings([...rows,rows.at(-1)]));
 const broken=structuredClone(demo);broken.events[0].matches[0].score='3:3';
 assert.throws(()=>volleyballSettingsRows({'4-1':broken},['4-1']));
 const long=structuredClone(demo);long.events[0].name='긴이름'.repeat(15000);
 const many=volleyballSettingsRows({'4-1':long},['4-1']);
 assert.ok(many.length>3);assert.deepEqual(readVolleyballSettings(many)['4-1'],long);
});
test('sets reject draws and invalid values',()=>{assert.deepEqual(parseSets('3:2'),[3,2]);for(const v of ['0:0','2:2','-1:3','3.5:2','x'])assert.throws(()=>parseSets(v));});
test('teams retain all eligible students and balanced counts',()=>{const students=Array.from({length:29},(_,i)=>({no:i+1,name:String(i),gender:i%2?'남':'여',attendance:i!==28}));for(const size of [4,5,6,7]){const teams=makeTeams(students,{},size,'혼성');assert.equal(teams.flatMap(t=>t.members).length,28);assert.ok(Math.max(...teams.map(t=>t.members.length))-Math.min(...teams.map(t=>t.members.length))<=1);}});
test('league scores award points and sets',()=>{const teams=[{id:1,name:'1'},{id:2,name:'2'},{id:3,name:'3'}];const matches=makeLeague(teams);assert.equal(matches.length,3);matches[0].score='1:3';const rows=standings({teams,matches});assert.equal(rows[0].id,2);assert.equal(rows[0].points,3);assert.equal(rows[0].won,3);});
test('bracket advances byes and ignores stale downstream results',()=>{for(let n=2;n<=12;n++){const teams=Array.from({length:n},(_,i)=>({id:i+1}));const scores={};let rounds=bracket(teams,scores);for(let r=0;r<rounds.length;r++){for(const m of rounds[r])if(m.playable)scores[m.key]={a:m.a,b:m.b,value:'3:1'};rounds=bracket(teams,scores);}assert.ok(rounds.at(-1)[0].winner);}});
