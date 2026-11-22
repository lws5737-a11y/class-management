export function parseSets(value) {
    const m = String(value).trim().match(/^(\d+)\s*:\s*(\d+)$/);
    if (!m) throw new Error('세트 스코어를 3:1처럼 입력하세요.');
    const a = Number(m[1]), b = Number(m[2]);
    if (a === b || Math.max(a, b) > 9) throw new Error('동점은 입력할 수 없으며 세트 수는 0~9입니다.');
    return [a, b];
}
export function makeTeams(students, skills, count, gender) {
    if (!Number.isInteger(count) || count < 2 || count > 8 || !['남','여','혼성'].includes(gender)) throw new Error('팀 개수(2~8팀)와 성별을 확인하세요.');
    const pool = students.filter(s => s.attendance && (gender === '혼성' || s.gender === gender));
    if (pool.length < count) throw new Error(`${count}팀을 만들려면 선택한 성별의 참석 학생이 최소 ${count}명 필요합니다.`);
    const value = (s, key) => Math.max(0, Number(skills[s.no]?.[key]) || 0);
    const scales = ['under','over'].map(key => Math.max(1, pool.reduce((sum,s) => sum + value(s,key),0) / count));
    const ability = s => [value(s,'under') / scales[0], value(s,'over') / scales[1]];
    const teams = Array.from({length:count}, (_,i) => ({id:i+1,name:`${i+1}팀`,members:[],totals:[0,0]}));
    const score = t => t.totals.reduce((sum,x) => sum+x*x,0);
    const buckets = [...new Set(pool.map(s=>s.gender))].map(g=>pool.filter(s=>s.gender===g));
    for (const bucket of buckets) {
        bucket.sort((a,b) => Math.max(...ability(b))-Math.max(...ability(a)) || a.no-b.no);
        for (const student of bucket) {
            const power = ability(student);
            const sameGender = t => t.members.filter(s=>s.gender===student.gender).length;
            const candidates = [...teams].sort((a,b) => sameGender(a)-sameGender(b)
                || a.members.length-b.members.length
                || power.reduce((sum,x,k)=>sum+2*x*(a.totals[k]-b.totals[k]),0) || a.id-b.id);
            const team = candidates[0];
            team.members.push(student);
            power.forEach((x,k)=>team.totals[k]+=x);
        }
    }
    // Same-gender swaps preserve team sizes and gender quotas while balancing each skill separately.
    for(let pass=0;pass<100;pass++) {
        let best=null, improvement=1e-9;
        for(let i=0;i<count;i++) for(let j=i+1;j<count;j++) {
            const a=teams[i],b=teams[j],before=score(a)+score(b);
            for(let x=0;x<a.members.length;x++) for(let y=0;y<b.members.length;y++) {
                if(a.members[x].gender!==b.members[y].gender)continue;
                const p=ability(a.members[x]),q=ability(b.members[y]);
                const after=p.reduce((sum,_,k)=>sum+(a.totals[k]-p[k]+q[k])**2+(b.totals[k]-q[k]+p[k])**2,0);
                if(before-after>improvement){improvement=before-after;best={a,b,x,y,p,q};}
            }
        }
        if(!best)break;
        const {a,b,x,y,p,q}=best;
        [a.members[x],b.members[y]]=[b.members[y],a.members[x]];
        p.forEach((_,k)=>{a.totals[k]+=q[k]-p[k];b.totals[k]+=p[k]-q[k];});
    }
    return teams.map(t=>({id:t.id,name:t.name,
        members:t.members.map(s=>({no:s.no,name:s.name,gender:s.gender})),
        power:t.members.reduce((sum,s)=>sum+value(s,'under')+value(s,'over'),0)}));
}

// Circle-method rounds; each wave uses up to two courts without sharing a team.
export function leagueWaves(teams, matches) {
    const rotation=teams.map(t=>t.id); if(rotation.length%2)rotation.push(null);
    const waves=[];
    for(let round=0;round<rotation.length-1;round++){
        const pairs=[];
        for(let i=0;i<rotation.length/2;i++){
            const a=rotation[i],b=rotation[rotation.length-1-i];
            if(a===null||b===null)continue;
            const index=matches.findIndex(m=>(m.a===a&&m.b===b)||(m.a===b&&m.b===a));
            if(index>=0)pairs.push({match:matches[index],index});
        }
        for(let i=0;i<pairs.length;i+=2)waves.push(pairs.slice(i,i+2));
        rotation.splice(1,0,rotation.pop());
    }
    return waves;
}

export function makeLeague(teams) {
    const matches = [];
    for (let i=0;i<teams.length;i++) for(let j=i+1;j<teams.length;j++) matches.push({a:teams[i].id,b:teams[j].id,score:''});
    return matches;
}
export function standings(event) {
    const rows = event.teams.map(t => ({ id:t.id,name:t.name,played:0,wins:0,losses:0,points:0,won:0,lost:0 }));
    for(const m of event.matches) if(m.score) {
        const [a,b]=parseSets(m.score), x=rows.find(t=>t.id===m.a), y=rows.find(t=>t.id===m.b);
        if(!x||!y) continue;
        x.played++;y.played++;x.won+=a;x.lost+=b;y.won+=b;y.lost+=a;
        const winner=a>b?x:y, loser=a>b?y:x;winner.wins++;winner.points+=3;loser.losses++;
    }
    return rows.sort((a,b)=>b.points-a.points || (b.won-b.lost)-(a.won-a.lost) || b.won-a.won || a.id-b.id);
}
function seededBracket(teams, scores={}) {
    let size=2;while(size<teams.length)size*=2;
    // Standard seed placement spreads byes instead of creating empty matches.
    let seeds=[1,2];while(seeds.length<size){const next=seeds.length*2+1;seeds=seeds.flatMap(s=>[s,next-s]);}
    let slots=seeds.map(s=>({id:teams[s-1]?.id||null,ready:true})), rounds=[];
    for(let r=0;slots.length>1;r++) {
        const matches=[], next=[];
        for(let i=0;i<slots.length;i+=2){
            const a=slots[i],b=slots[i+1],key=`${r}-${i/2}`;
            const score=scores[key];let winner=null,ready=false;
            if(a.ready&&b.ready){
                if(!a.id||!b.id){winner=a.id||b.id;ready=true;}
                else if(score && score.a===a.id && score.b===b.id){const [x,y]=parseSets(score.value);winner=x>y?a.id:b.id;ready=true;}
            }
            matches.push({key,a:a.id,b:b.id,playable:a.ready&&b.ready&&!!a.id&&!!b.id,score:score?.a===a.id&&score?.b===b.id?score.value:'',winner,bye:ready&&(!a.id||!b.id)});
            next.push({id:winner,ready});
        }
        rounds.push(matches);slots=next;
    }
    return rounds;
}
export function bracket(teams, scores={}) {
    const rounds = [];
    let slots = teams.map(team => team.id);
    while (slots.length > 1) {
        const round = [];
        for (let i = 0; i < slots.length; i += 2) {
            const a = slots[i], b = slots[i + 1] ?? null;
            const bye = i + 1 === slots.length;
            const key = rounds.length + '-' + round.length;
            const saved = scores[key];
            const playable = a != null && b != null;
            const score = playable && saved?.a === a && saved.b === b ? saved.value : '';
            let winner = bye ? a : null;
            if (score) {
                const [left, right] = parseSets(score);
                winner = left > right ? a : b;
            }
            round.push({key, a, b, bye, playable, score, winner});
        }
        rounds.push(round);
        slots = round.map(match => match.winner);
    }
    return rounds;
}

function eventBracket(event) {
    return event.bracketVersion === 2 || !Object.keys(event.scores || {}).length
        ? bracket(event.teams, event.scores)
        : seededBracket(event.teams, event.scores);
}

export function initVolleyball({state,save}) {
    const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
    const btn=(text,fn)=>{const b=node('button',text,'ui-secondary');b.type='button';b.onclick=fn;return b;};
    const panel=node('section',undefined,'hidden vb');panel.id='volleyball-section';document.getElementById('main-container').append(panel);
    const tab=btn('빅발리볼',()=>window.showTab('volleyball'));tab.id='tab-volleyball';document.getElementById('tab-stamp').after(tab);
    const icon = node('span','◉','ui-nav-icon'); icon.setAttribute('aria-hidden','true'); tab.prepend(icon);
    const stylesheet = node('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = './volleyball.css?v=20261118-4'; document.head.append(stylesheet);
    let activeEvent='',activeClass='';
    let refreshPending = false;
    const scoreDrafts = new Map();
    function refresh() {
        if (panel.querySelector('input:focus,select:focus') || scoreDrafts.size) { refreshPending = true; return; }
        render();
    }
    panel.addEventListener('focusout', () => setTimeout(() => { if (refreshPending && !scoreDrafts.size && !panel.querySelector('input:focus,select:focus')) { refreshPending=false; render(); } }, 100));
    window.addEventListener('beforeunload', event => { if (scoreDrafts.size) { event.preventDefault(); event.returnValue=''; } });
    const commit=data=>{save(data);render();};
    const guard=fn=>{try{fn();}catch(e){alert(e.message);}};
    function print(title,content){
        if(scoreDrafts.size && !confirm('저장하지 않은 경기 입력이 있습니다. 인쇄에는 저장된 결과만 표시됩니다. 계속할까요?')) return;
        let area=document.getElementById('vb-print-area');area?.remove();area=node('div');area.id='vb-print-area';area.style.display='none';
        area.append(node('h2',`${state().className} · ${title}`),content.cloneNode(true));document.body.append(area);document.body.classList.add('vb-print');window.print();
    }
    window.addEventListener('afterprint',()=>{document.body.classList.remove('vb-print');document.getElementById('vb-print-area')?.remove();});
    function render(){
        const {className,students}=state();if(!className)return;
        const data=structuredClone(state().data);data.skills ||= {};data.events ||= [];
        if(activeClass!==className){activeClass=className;activeEvent='';}
        refreshPending=false;
        panel.replaceChildren(node('h2','빅발리볼'));
        panel.append(node('p','성공 횟수 입력 → 참석 학생 팀 편성 → 대회 생성 → 세트 스코어 기록. 능력은 입력 후 다른 칸을 누르면 저장됩니다.'));
        const skills=node('details');skills.open=!data.events.length;skills.append(node('summary','개인 능력 입력 · 성공 횟수'));
        const table=node('table'), head=node('tr'), thead=node('thead');['번호','이름','언더핸드','오버핸드'].forEach(v=>head.append(node('th',v)));thead.append(head);table.append(thead);
        for(const s of students){const row=node('tr');row.append(node('td',s.no),node('td',s.name));for(const key of ['under','over']){const td=node('td'),input=node('input');input.type='number';input.min='0';input.max='9999';input.step='1';input.inputMode='numeric';input.value=data.skills[s.no]?.[key]??'';input.setAttribute('aria-label',`${s.name} ${key==='under'?'언더핸드':'오버핸드'} 성공 횟수`);input.onchange=()=>guard(()=>{if(!input.validity.valid)throw new Error('0~9999의 정수를 입력하세요.');const fresh=structuredClone(state().data);fresh.skills ||= {};fresh.skills[s.no] ||= {};fresh.skills[s.no][key]=input.value===''?null:Number(input.value);save(fresh);});td.append(input);row.append(td);}table.append(row);}
        const scroll=node('div',undefined,'vb-scroll');scroll.append(table);skills.append(scroll,btn('능력표 인쇄',()=>{const copy=table.cloneNode(true);copy.querySelectorAll('input').forEach(i=>i.replaceWith(document.createTextNode(i.value)));print('빅발리볼 능력표',copy);}));panel.append(skills);
        const setup=node('div',undefined,'vb-card');setup.append(node('h3','새 대회 만들기'));
        const title=node('input');title.placeholder='대회 이름';title.value=`빅발리볼 ${new Date().toLocaleDateString('ko-KR')}`;title.setAttribute('aria-label','대회 이름');
        const select=(values,label)=>{const s=node('select');s.setAttribute('aria-label',label);values.forEach(v=>{const o=node('option',v);o.value=v;s.append(o);});return s;};
        const teamCount=select([2,3,4,5,6,7,8],'팀 개수'),gender=select(['혼성','남','여'],'성별'),mode=select(['리그전','토너먼트전'],'경기 방식');const controls=node('div',undefined,'vb-tools');controls.append(teamCount,gender,mode);
        [...teamCount.options].forEach(option => { option.textContent = `${option.value}팀`; });
        teamCount.value = '4';
        setup.append(title,controls,node('p','선택한 팀 개수에 맞춰 참석 학생 전원을 편성합니다. 팀별 인원과 성별 인원 차이를 1명 이내로 맞추고, 언더핸드·오버핸드 능력을 각각 고려합니다. 미입력 능력은 0으로 계산합니다. 팀은 생성 당시 명단으로 보관됩니다.'));
        setup.append(btn('균형 팀 편성 및 대진표 생성',()=>guard(()=>{const fresh=structuredClone(state().data);fresh.events ||= [];fresh.skills ||= {};const teams=makeTeams(state().students,fresh.skills,Number(teamCount.value),gender.value);const event={id:crypto.randomUUID(),name:title.value.trim()||'빅발리볼',createdAt:new Date().toISOString(),mode:mode.value,teams,bracketVersion:2,matches:makeLeague(teams),scores:{}};fresh.events.push(event);activeEvent=event.id;commit(fresh);})));panel.append(setup);
        if(!data.events.length)return;
        const chooser=select([], '대회 선택');data.events.slice().reverse().forEach(e=>{const o=node('option',`${e.name} · ${e.mode}`);o.value=e.id;chooser.append(o);});if(!data.events.some(e=>e.id===activeEvent))activeEvent=data.events.at(-1).id;chooser.value=activeEvent;chooser.onchange=()=>{activeEvent=chooser.value;render();};panel.append(chooser);
        const event=data.events.find(e=>e.id===activeEvent), content=node('div');content.append(node('h3',`${event.name} · ${event.mode}`));
        panel.append(btn('선택한 대회 삭제',()=>{
            if(!confirm(`“${event.name}” 대회의 팀과 경기 결과를 삭제할까요? 개인 능력 기록은 유지됩니다.`))return;
            const fresh=structuredClone(state().data);
            fresh.events=(fresh.events||[]).filter(e=>e.id!==event.id);
            for(const key of scoreDrafts.keys()){
                const [draftClass,draftEvent]=JSON.parse(key);
                if(draftClass===className && draftEvent===event.id)scoreDrafts.delete(key);
            }
            activeEvent='';commit(fresh);
        }));
        
        const teamGrid=node('div',undefined,'vb-team-grid');
        for(const [i,team] of event.teams.entries()){
            const card=node('section',undefined,'vb-team-card');card.style.setProperty('--team-color',['#2563eb','#db2777','#059669','#d97706','#7c3aed','#0891b2','#dc2626','#475569'][i%8]);
            const heading=node('h3',team.name);
            const rename=btn('팀명 수정',()=>guard(()=>{
                const entered=prompt('팀 이름을 입력하세요.',team.name);
                if(entered===null)return;
                const nextName=entered.trim();
                if(!nextName)throw new Error('팀 이름을 입력하세요.');
                if(nextName===team.name)return;
                const fresh=structuredClone(state().data);
                const target=fresh.events.find(item=>item.id===event.id)?.teams.find(item=>item.id===team.id);
                if(!target || target.name!==team.name)throw new Error('팀 정보가 변경되었습니다. 화면을 새로고침하세요.');
                target.name=nextName;
                commit(fresh);
            }));
            card.append(heading,rename,node('p',`${team.members.length}명 · 남 ${team.members.filter(s=>s.gender==='남').length} / 여 ${team.members.filter(s=>s.gender==='여').length}`));
            const names=node('div',undefined,'vb-member-chips');
            team.members.forEach(s=>names.append(node('span',s.name)));
            card.append(names);teamGrid.append(card);
        }
        content.append(teamGrid);
        const name=id=>event.teams.find(t=>t.id===id)?.name||'진출 대기';
            function saveMatchScore(m,index,key,value) { return guard(()=>{
                if(value) { const [a,b]=parseSets(value);value=`${a}:${b}`; }
                const fresh=structuredClone(state().data), e=fresh.events.find(e=>e.id===event.id);
                if(!e)throw new Error('대회가 삭제되었습니다.');
                if(e.mode==='리그전') {
                    const latest=e.matches[index];
                    if(!latest || latest.a!==m.a || latest.b!==m.b || latest.score!==m.score) throw new Error('다른 화면에서 결과가 변경되었습니다. 탭을 다시 열어 확인하세요.');
                    latest.score=value;
                } else {
                    const latest=eventBracket(e).flat().find(item=>item.key===m.key);
                    if(!latest?.playable || latest.a!==m.a || latest.b!==m.b || latest.score!==m.score)throw new Error('진출팀 또는 결과가 변경되었습니다. 탭을 다시 열어 확인하세요.');
                    const round=Number(m.key.split('-')[0]);
                    const later=Object.keys(e.scores).filter(k=>Number(k.split('-')[0])>round);
                    if(later.length && value!==m.score && !confirm('결과 변경 시 이후 라운드의 결과를 초기화합니다. 계속할까요?'))return;
                    if(value!==m.score)later.forEach(k=>delete e.scores[k]);
                    if(!Object.keys(e.scores).length)e.bracketVersion=2;
                    if(value)e.scores[m.key]={a:m.a,b:m.b,value};else delete e.scores[m.key];
                }
                scoreDrafts.delete(key);commit(fresh);
            }); }
        function match(m,index) {
            const row=node('div',undefined,'vb-match');
            const key = JSON.stringify([className,event.id,m.key ?? index]);
            row.append(node('span',`${name(m.a)} : ${m.bye && !m.b ? '부전승' : name(m.b)}${m.winner ? ' → '+name(m.winner)+' 진출' : ''}`),node('strong',m.score|| (m.bye ? '자동 진출' : '미진행')));
            if(m.playable===false||m.bye)return row;
            const input=node('input'); input.type='text'; input.placeholder='3:1';
            input.value=scoreDrafts.get(key) ?? m.score ?? '';
            input.setAttribute('aria-label',`${name(m.a)} 대 ${name(m.b)} 세트 스코어`);
            input.addEventListener('input',()=>{ if(input.value===(m.score||''))scoreDrafts.delete(key);else scoreDrafts.set(key,input.value); });
            const storeScore = value => saveMatchScore(m,index,key,value);
            row.append(input,btn('결과 저장',()=>storeScore(input.value.trim())));
            if(m.score)row.append(btn('결과 지우기',()=>{if(confirm('이 경기 결과를 지울까요?'))storeScore('');}));
            return row;
        }
        if(event.mode==='리그전'){
            content.append(node('p','승리 3점 · 패배 0점 / 승점 → 세트 득실차 → 세트 득수 순. 모두 같으면 공동 순위입니다.'));
            const table=node('table'),h=node('tr');['순위','팀','경기','승','패','승점','득/실 세트'].forEach(v=>h.append(node('th',v)));table.append(h);let rank=0,previous='';standings(event).forEach((r,i)=>{const key=`${r.points}/${r.won-r.lost}/${r.won}`;if(key!==previous)rank=i+1;previous=key;const tr=node('tr');[rank,r.name,r.played,r.wins,r.losses,r.points,`${r.won}/${r.lost}`].forEach(v=>tr.append(node('td',v)));table.append(tr);});content.append(table);
            content.append(node('h3','2코트 리그 경기 순서'),node('p','같은 차수의 A·B코트 경기는 동시에 진행합니다. 두 경기 종료 후 다음 차수를 시작하세요.'));
            leagueWaves(event.teams,event.matches).forEach((wave,i)=>{
                const block=node('section',undefined,'vb-wave');block.append(node('h4',`${i+1}차 경기`));
                const courts=node('div',undefined,'vb-courts');
                for(let c=0;c<2;c++){const court=node('div');court.append(node('h4',`${c===0?'A':'B'}코트`));court.append(wave[c]?match(wave[c].match,wave[c].index):node('p','휴식 · 코트 비움'));courts.append(court);}
                block.append(courts);content.append(block);
            });
        }else{
            const rounds=eventBracket(event),winner=rounds.at(-1)[0].winner;
            const chart=node('div',undefined,'vb-bracket-scroll');
            const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
            const width=960,height=rounds.length*150+100;
            svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','group');svg.setAttribute('aria-label','우승 트로피로 이어지는 토너먼트 대진표');
            const draw=(tag,attrs,text)=>{const e=document.createElementNS(svg.namespaceURI,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!==undefined)e.textContent=text;svg.append(e);return e;};
            const pos=(r,j)=>({x:(j+.5)*width/rounds[r].length,y:height-75-r*150});
            rounds.forEach((round,r)=>round.forEach((m,j)=>{
                const p=pos(r,j),parent=r<rounds.length-1?pos(r+1,Math.floor(j/2)):{x:width/2,y:45};
                draw('path',{d:`M ${p.x} ${p.y-35} V ${p.y-75} H ${parent.x} V ${parent.y+35}`,fill:'none',stroke:m.winner?'#e5a51c':'#b5c5d8','stroke-width':4});
            }));
            draw('text',{x:width/2,y:35,'text-anchor':'middle','font-size':32},'🏆');
            draw('text',{x:width/2,y:65,'text-anchor':'middle','font-size':18,'font-weight':800,fill:'#9a6700'},winner?name(winner)+' 우승':'우승을 향해!');
            rounds.forEach((round,r)=>round.forEach((m,j)=>{
                const p=pos(r,j),w=Math.min(210,width/round.length-16);
                draw('rect',{x:p.x-w/2,y:p.y-34,width:w,height:70,rx:12,fill:m.winner?'#fff7dc':'#fff',stroke:m.winner?'#e5a51c':'#b5c5d8','stroke-width':2});
                const label=id=>id?name(id):(m.bye?'부전승':'진출 대기');
                draw('text',{x:p.x,y:p.y-10,'text-anchor':'middle','font-size':15,'font-weight':700,fill:'#172b4d'},label(m.a)+' vs '+label(m.b));
                draw('text',{x:p.x,y:p.y+14,'text-anchor':'middle','font-size':13,fill:'#53657e'},m.score || (m.bye?'자동 진출':m.playable?'결과 입력':'진출 대기'));
                if(m.playable){
                    const hit=draw('rect',{x:p.x-w/2,y:p.y-34,width:w,height:70,rx:12,fill:'transparent',role:'button',tabindex:0,'aria-label':label(m.a)+' 대 '+label(m.b)+' 결과 입력'});
                    hit.style.cursor='pointer';
                    const edit=()=>{
                        const key=JSON.stringify([className,event.id,m.key]);
                        const value=prompt(label(m.a)+' 대 '+label(m.b)+' 세트 스코어 (예: 3:1)',scoreDrafts.get(key) ?? m.score ?? '');
                        if(value!==null && value.trim())saveMatchScore(m,undefined,key,value.trim());
                    };
                    hit.addEventListener('click',edit);
                    hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();edit();}});
                }
            }));
            chart.append(svg);content.append(chart,node('p','경기 칸을 누르면 세트 스코어를 입력하거나 수정할 수 있습니다. 라운드가 끝난 뒤 다음 라운드를 진행하세요. 부전승은 코트를 사용하지 않습니다.'));
            rounds.forEach((round,r)=>{
                content.append(node('h3',r===rounds.length-1?'결승':`${r+1}라운드`));
                const games=round.filter(m=>!m.bye);
                for(let i=0;i<games.length;i+=2){
                    const wave=node('section',undefined,'vb-wave');wave.append(node('h4',`${i/2+1}차 경기`));
                    const courts=node('div',undefined,'vb-courts');
                    games.slice(i,i+2).forEach((m,c)=>{const court=node('div');court.append(node('h4',c===0?'A코트':'B코트'),match(m));courts.append(court);});
                    wave.append(courts);content.append(wave);
                }
            });
        }
        panel.append(content,btn(`${event.mode} 대진·결과 인쇄`,()=>print(event.name,content)));
    }
    return {render,refresh};
}
