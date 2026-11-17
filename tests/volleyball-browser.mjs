// Real app UI + real XLSX library. All Firebase I/O is replaced by an isolated local fixture.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..'), output=resolve(root,'.ui-artifacts/volleyball');
await mkdir(output,{recursive:true});
const mock = `
const auth={currentUser:{uid:'vb-fixture'}},db={},provider={};
const firestorePersistenceReady=Promise.resolve(true),firestorePersistenceState={enabled:true};
const onAuthStateChanged=()=>{},signInWithPopup=()=>{},signOut=()=>{};
let fixtureListener=null;
const doc=()=>({});
const emitFixture=()=>{const data=JSON.parse(localStorage.getItem('__vb_cloud'));if(data&&fixtureListener)fixtureListener({exists:()=>true,data:()=>structuredClone(data),metadata:{hasPendingWrites:false,fromCache:false}});};
const updateDoc=async(ref,payload)=>{localStorage.setItem('__vb_cloud',JSON.stringify(payload));setTimeout(emitFixture,40);};
const setDoc=updateDoc;
const onSnapshot=(ref,options,callback)=>{fixtureListener=callback;setTimeout(emitFixture,0);return()=>{fixtureListener=null;};};
`;
const bootstrap=`
userId='vb-fixture';hasLoadedRemoteData=true;
if(localStorage.getItem('__vb_cloud'))applyAppPayload(JSON.parse(localStorage.getItem('__vb_cloud')));
else {
classData=Object.fromEntries(['4-1','4-2'].map(cls=>[cls,Array.from({length:28},(_,i)=>createStudentRecord(i+1,i===1?'남궁긴이름테스트':'가상학생'+String(i+1).padStart(2,'0'),i%2?'여':'남'))]));
localStorage.setItem('__vb_cloud',JSON.stringify(createAppPayload()));
}
window.__vbState=()=>structuredClone(createAppPayload());
window.__vbSnapshot=emitFixture;
window.__vbFlush=()=>saveData({immediate:true});
window.__vbBackup=(classes,scope,source)=>buildExcelBackup(classes,scope,source);
document.getElementById('login-screen').classList.add('hidden');window.showClassSelectionScreen();setupFirestoreListener();
window.print=()=>{window.__printRequested=true;};
`;
const server=createServer(async(req,res)=>{
    const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const file=resolve(root,'.'+(path==='/'?'/index.html':path));
    if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/')){res.writeHead(403).end();return;}
    try{
        let data=await readFile(file);
        if(path==='/app.js')data=mock+data.toString().replace(/^import .*firebase.*;\r?\n/gm,'').replace(/^import .*https:.*;\r?\n/gm,'')+bootstrap;
        res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[extname(file)]||'application/octet-stream');res.end(data);
    }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_CHANNEL?{channel:process.env.UI_BROWSER_CHANNEL}:{})});
try{
 for(const width of [320,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<768,hasTouch:width<768,deviceScaleFactor:1});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{const host=new URL(route.request().url()).hostname;return ['127.0.0.1','cdn.tailwindcss.com','cdn.sheetjs.com','fonts.googleapis.com','fonts.gstatic.com'].includes(host)?route.continue():route.abort();});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(()=>!!window.XLSX);
    const choose=async cls=>{if(await page.locator('#app-container').isVisible())await page.locator('#current-class-display').click();await page.getByRole('button',{name:`${cls} 학급 선택`,exact:true}).click();await page.locator('#tab-volleyball').click();};
    await choose('4-1');
    await page.getByLabel('가상학생01 언더핸드 성공 횟수',{exact:true}).fill('0');
    await page.getByLabel('가상학생01 오버핸드 성공 횟수',{exact:true}).fill('12');
    await page.getByLabel('남궁긴이름테스트 언더핸드 성공 횟수',{exact:true}).fill('9');
    await page.locator('#volleyball-section h2').click();
    await page.evaluate(()=>window.__vbFlush());
    assert.deepEqual(await page.evaluate(()=>window.__vbState().volleyball['4-1'].skills[1]),{under:0,over:12});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'ability viewport overflow');
    await page.screenshot({path:resolve(output,`abilities-${width}.png`),animations:'disabled'});
    // Generate PDF from the same print-only DOM used by the actual print button.
    async function pdf(button,file){
        await page.getByRole('button',{name:button,exact:true}).click();
        await page.emulateMedia({media:'print'});
        assert.equal(await page.locator('#vb-print-area').isVisible(),true);
        assert.equal(await page.locator('#app-container').isVisible(),false);
        assert.equal(await page.locator('#vb-print-area button:visible').count(),0);
        await page.pdf({path:resolve(output,`${file}.pdf`),format:'A4',printBackground:true,preferCSSPageSize:true});
        await page.emulateMedia({media:'screen'});
        await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
    }
    if(width===390)await pdf('능력표 인쇄','abilities');
    await page.getByLabel('대회 이름',{exact:true}).fill('리그 검증');
    await page.getByLabel('팀 기준 인원',{exact:true}).selectOption('7');
    await page.getByRole('button',{name:'균형 팀 편성 및 대진표 생성',exact:true}).click();
    await page.locator('.vb-match input').first().fill('3:1');
    await page.locator('.vb-match').first().getByRole('button',{name:'결과 저장',exact:true}).click();
    await page.evaluate(()=>window.__vbFlush());
    assert.equal(await page.evaluate(()=>window.__vbState().volleyball['4-1'].events[0].matches[0].score),'3:1');
    await page.locator('.vb-match input').first().fill('3:2');
    await page.evaluate(()=>window.__vbSnapshot());
    assert.equal(await page.locator('.vb-match input').first().inputValue(),'3:2');
    await page.locator('.vb-match').first().getByRole('button',{name:'결과 저장',exact:true}).click();
    if(width===390)await pdf('리그전 대진·결과 인쇄','league');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'league viewport overflow');
    await page.getByLabel('대회 선택',{exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:resolve(output,`league-${width}.png`),animations:'disabled'});
    await page.getByLabel('대회 이름',{exact:true}).fill('토너먼트 검증');
    await page.getByLabel('팀 기준 인원',{exact:true}).selectOption('5');
    await page.getByLabel('경기 방식',{exact:true}).selectOption('토너먼트전');
    await page.getByRole('button',{name:'균형 팀 편성 및 대진표 생성',exact:true}).click();
    // Five teams include byes; complete all playable matches, then reverse an early result.
    for(let i=0;i<12;i++){
        const pending=page.locator('.vb-match').filter({has:page.locator('strong', {hasText:'미진행'})}).filter({has:page.locator('input')});
        if(!await pending.count())break;
        await pending.first().locator('input').fill('3:1');
        await pending.first().getByRole('button',{name:'결과 저장',exact:true}).click();
    }
    assert.ok(await page.getByRole('heading',{name:/우승:/}).count());
    if(width===390)await pdf('토너먼트전 대진·결과 인쇄','tournament');
    await page.locator('.vb-match input').first().fill('1:3');
    page.once('dialog',d=>d.accept());
    await page.locator('.vb-match:has(input)').first().getByRole('button',{name:'결과 저장',exact:true}).click();
    assert.equal(await page.getByRole('heading',{name:/우승:/}).count(),0);
    await page.evaluate(()=>window.__vbFlush());
    const saved=await page.evaluate(()=>window.__vbState().volleyball['4-1']);
    await page.reload();await choose('4-1');
    assert.deepEqual(await page.evaluate(()=>window.__vbState().volleyball['4-1']),saved);
    assert.equal(await page.locator('#tab-volleyball').getAttribute('aria-current'),'page');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'tournament viewport overflow');
    await page.getByLabel('대회 선택',{exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:resolve(output,`tournament-${width}.png`),animations:'disabled'});

    if(width===390){
        await choose('4-2');await page.getByLabel('가상학생01 언더핸드 성공 횟수',{exact:true}).fill('22');await page.locator('#volleyball-section h2').click();await page.evaluate(()=>window.__vbFlush());
        await choose('4-1');
        // Use the actual download controls and upload the generated file bytes back through the real FileReader.
        await page.locator('#class-tools-btn').click();
        const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'현재 학급 엑셀 저장하기 (.xlsx)',exact:true}).click();
        const currentFile=resolve(output,'class-backup.xlsx');await (await downloadPromise).saveAs(currentFile);
        await page.evaluate(()=>window.closeManageModal());
        await page.locator('#current-class-display').click();await page.locator('#class-settings').evaluate(e=>{e.open=true;});
        const allDownload=page.waitForEvent('download');await page.locator('#export-all-classes-btn').click();
        const allFile=resolve(output,'all-backup.xlsx');await (await allDownload).saveAs(allFile);
        const full=await page.evaluate(()=>window.__vbState().volleyball);
        async function importFile(file,all=false){
            if(all){if(await page.locator('#app-container').isVisible())await page.locator('#current-class-display').click();await page.locator('#all-class-excel-input').setInputFiles(file);}
            else{await page.locator('#class-tools-btn').click();await page.locator('#class-excel-file-input').setInputFiles(file);}
            await page.locator('#modal-confirm-btn').click();await page.waitForFunction(()=>document.getElementById('modal-title').textContent==='완료');await page.locator('#modal-alert-ok-btn').click();
            await page.evaluate(()=>window.closeManageModal());
        }
        await choose('4-1');
        // Change skill, then restore current-class backup without touching the other class.
        await page.locator('#volleyball-section details').evaluate(e=>{e.open=true;});
        await page.getByLabel('가상학생01 언더핸드 성공 횟수',{exact:true}).fill('55');await page.locator('#volleyball-section h2').click();await page.evaluate(()=>window.__vbFlush());
        await importFile(currentFile);assert.deepEqual(await page.evaluate(()=>window.__vbState().volleyball),full);
        await importFile(allFile);assert.deepEqual(await page.evaluate(()=>window.__vbState().volleyball),full);
        await importFile(currentFile,true);assert.deepEqual(await page.evaluate(()=>window.__vbState().volleyball),full);
        await importFile(allFile,true);assert.deepEqual(await page.evaluate(()=>window.__vbState().volleyball),full);
        // Legacy workbook excludes volleyball settings, and corrupted chunks must reject atomically.
        const variants=await page.evaluate(()=>{
            const wb=window.__vbBackup(['4-1'],'학급','4-1');
            const rows=XLSX.utils.sheet_to_json(wb.Sheets['앱설정'],{header:1});
            wb.Sheets['앱설정']=XLSX.utils.aoa_to_sheet(rows.filter(r=>!String(r[0]).startsWith('빅발리볼')));
            const legacy=Array.from(new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})));
            wb.Sheets['앱설정']=XLSX.utils.aoa_to_sheet(rows.filter(r=>r[0]!=='빅발리볼JSON_0001'));
            return {legacy,corrupt:Array.from(new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})))};
        });
        await importFile({name:'legacy.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(variants.legacy)},true);
        assert.deepEqual(await page.evaluate(()=>window.__vbState().volleyball),full);
        const before=await page.evaluate(()=>window.__vbState());
        await page.locator('#all-class-excel-input').setInputFiles({name:'corrupt.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(variants.corrupt)});
        await page.waitForFunction(()=>document.getElementById('modal-title').textContent==='불러오기 실패');
        const after=await page.evaluate(()=>window.__vbState());
        delete before.syncMeta;delete after.syncMeta;
        assert.deepEqual(after,before);
        await page.locator('#modal-alert-ok-btn').click();
        await choose('4-1');await page.evaluate(()=>window.__vbFlush());
        await context.setOffline(true);
        await page.locator('#volleyball-section details').evaluate(e=>{e.open=true;});
        await page.getByLabel('가상학생01 언더핸드 성공 횟수',{exact:true}).fill('17');await page.locator('#volleyball-section h2').click();
        assert.equal(await page.evaluate(()=>window.__vbState().volleyball['4-1'].skills[1].under),17);
        await context.setOffline(false);
    }
    assert.deepEqual(errors,[]);console.log(`PASS volleyball ${width}px: UI, skill save, league, bracket, snapshot, reload, layout${width===390?', XLSX class/all/cross-scope/legacy/corrupt, PDF x3, offline edit':''}`);
    await context.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
