export function parseSets(value) {
    const m = String(value).trim().match(/^(\d+)\s*:\s*(\d+)$/);
    if (!m) throw new Error('세트 스코어를 3:1처럼 입력하세요.');
    const a = Number(m[1]), b = Number(m[2]);
    if (a === b || Math.max(a, b) > 9) throw new Error('동점은 입력할 수 없으며 세트 수는 0~9입니다.');
    return [a, b];
}
export function makeTeams(students, skills, size, gender) {
    if (![4,5,6,7].includes(size) || !['남','여','혼성'].includes(gender)) throw new Error('편성 인원과 성별을 확인하세요.');
    const pool = students.filter(s => s.attendance && (gender === '혼성' || s.gender === gender));
    const count = Math.floor(pool.length / size);
    if (count < 2) throw new Error(`참석 학생이 최소 ${size * 2}명 필요합니다.`);
    const teams = Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `${i + 1}팀`, members: [], power: 0 }));
    const strength = s => Number(skills[s.no]?.under || 0) + Number(skills[s.no]?.over || 0);
    // Largest teams differ by at most one player. Distribute each gender by strength.
    const buckets = gender === '혼성' ? ['남','여'].map(g => pool.filter(s => s.gender === g)) : [pool];
    for (const bucket of buckets) for (const student of bucket.sort((a,b) => strength(b)-strength(a) || a.no-b.no)) {
        const target = [...teams].sort((a,b) => a.members.length-b.members.length || a.power-b.power || a.id-b.id)[0];
        target.members.push({ no: student.no, name: student.name, gender: student.gender }); target.power += strength(student);
    }
    return teams;
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
export function bracket(teams, scores={}) {
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
export function initVolleyball({state,save}) {
    const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
    const btn=(text,fn)=>{const b=node('button',text,'ui-secondary');b.type='button';b.onclick=fn;return b;};
    const panel=node('section',undefined,'hidden vb');panel.id='volleyball-section';document.getElementById('main-container').append(panel);
    const tab=btn('빅발리볼',()=>window.showTab('volleyball'));tab.id='tab-volleyball';document.getElementById('tab-stamp').after(tab);
    const icon = node('span','◉','ui-nav-icon'); icon.setAttribute('aria-hidden','true'); tab.prepend(icon);
    const stylesheet = node('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = './volleyball.css?v=20261117-2'; document.head.append(stylesheet);
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
        const scroll=node('div',undefined,'vb-scroll');scroll.append(table);skills.append(scroll,btn('능력표 인쇄',()=>{const copy=table.cloneNode(true);copy.querySelectorAll('input').forEach(i=>i.replaceWith(document.createTextNode(i.value||'미입력')));print('빅발리볼 능력표',copy);}));panel.append(skills);
        const setup=node('div',undefined,'vb-card');setup.append(node('h3','새 대회 만들기'));
        const title=node('input');title.placeholder='대회 이름';title.value=`빅발리볼 ${new Date().toLocaleDateString('ko-KR')}`;title.setAttribute('aria-label','대회 이름');
        const select=(values,label)=>{const s=node('select');s.setAttribute('aria-label',label);values.forEach(v=>{const o=node('option',v);o.value=v;s.append(o);});return s;};
        const size=select([4,5,6,7],'팀 기준 인원'),gender=select(['혼성','남','여'],'성별'),mode=select(['리그전','토너먼트전'],'경기 방식');const controls=node('div',undefined,'vb-tools');controls.append(size,gender,mode);
        setup.append(title,controls,node('p','인원은 기준값이며 남는 학생은 팀별 인원 차이가 1명 이내가 되도록 배분합니다. 미입력 능력은 0으로 계산합니다. 팀은 생성 당시 명단으로 보관됩니다.'));
        setup.append(btn('균형 팀 편성 및 대진표 생성',()=>guard(()=>{const fresh=structuredClone(state().data);fresh.events ||= [];fresh.skills ||= {};const teams=makeTeams(state().students,fresh.skills,Number(size.value),gender.value);const event={id:crypto.randomUUID(),name:title.value.trim()||'빅발리볼',createdAt:new Date().toISOString(),mode:mode.value,teams,matches:makeLeague(teams),scores:{}};fresh.events.push(event);activeEvent=event.id;commit(fresh);})));panel.append(setup);
        if(!data.events.length)return;
        const chooser=select([], '대회 선택');data.events.slice().reverse().forEach(e=>{const o=node('option',`${e.name} · ${e.mode}`);o.value=e.id;chooser.append(o);});if(!data.events.some(e=>e.id===activeEvent))activeEvent=data.events.at(-1).id;chooser.value=activeEvent;chooser.onchange=()=>{activeEvent=chooser.value;render();};panel.append(chooser);
        const event=data.events.find(e=>e.id===activeEvent), content=node('div');content.append(node('h3',`${event.name} · ${event.mode}`));
        for(const team of event.teams)content.append(node('p',`${team.name} (${team.members.length}명): ${team.members.map(s=>`${s.no}번 ${s.name}`).join(', ')}`));
        const name=id=>event.teams.find(t=>t.id===id)?.name||'진출 대기';
        function match(m,index) {
            const row=node('div',undefined,'vb-match');
            const key = JSON.stringify([className,event.id,m.key ?? index]);
            row.append(node('span',`${name(m.a)} : ${m.bye && !m.b ? '부전승' : name(m.b)}${m.winner ? ' → '+name(m.winner)+' 진출' : ''}`),node('strong',m.score|| (m.bye ? '자동 진출' : '미진행')));
            if(m.playable===false||m.bye)return row;
            const input=node('input'); input.type='text'; input.placeholder='3:1';
            input.value=scoreDrafts.get(key) ?? m.score ?? '';
            input.setAttribute('aria-label',`${name(m.a)} 대 ${name(m.b)} 세트 스코어`);
            input.addEventListener('input',()=>{ if(input.value===(m.score||''))scoreDrafts.delete(key);else scoreDrafts.set(key,input.value); });
            const storeScore = value => guard(()=>{
                if(value) { const [a,b]=parseSets(value);value=`${a}:${b}`; }
                const fresh=structuredClone(state().data), e=fresh.events.find(e=>e.id===event.id);
                if(!e)throw new Error('대회가 삭제되었습니다.');
                if(e.mode==='리그전') {
                    const latest=e.matches[index];
                    if(!latest || latest.a!==m.a || latest.b!==m.b || latest.score!==m.score) throw new Error('다른 화면에서 결과가 변경되었습니다. 탭을 다시 열어 확인하세요.');
                    latest.score=value;
                } else {
                    const latest=bracket(e.teams,e.scores).flat().find(item=>item.key===m.key);
                    if(!latest?.playable || latest.a!==m.a || latest.b!==m.b || latest.score!==m.score)throw new Error('진출팀 또는 결과가 변경되었습니다. 탭을 다시 열어 확인하세요.');
                    const round=Number(m.key.split('-')[0]);
                    const later=Object.keys(e.scores).filter(k=>Number(k.split('-')[0])>round);
                    if(later.length && value!==m.score && !confirm('결과 변경 시 이후 라운드의 결과를 초기화합니다. 계속할까요?'))return;
                    if(value!==m.score)later.forEach(k=>delete e.scores[k]);
                    if(value)e.scores[m.key]={a:m.a,b:m.b,value};else delete e.scores[m.key];
                }
                scoreDrafts.delete(key);commit(fresh);
            });
            row.append(input,btn('결과 저장',()=>storeScore(input.value.trim())));
            if(m.score)row.append(btn('결과 지우기',()=>{if(confirm('이 경기 결과를 지울까요?'))storeScore('');}));
            return row;
        }
        if(event.mode==='리그전'){
            content.append(node('p','승리 3점 · 패배 0점 / 승점 → 세트 득실차 → 세트 득수 순. 모두 같으면 공동 순위입니다.'));
            const table=node('table'),h=node('tr');['순위','팀','경기','승','패','승점','득/실 세트'].forEach(v=>h.append(node('th',v)));table.append(h);let rank=0,previous='';standings(event).forEach((r,i)=>{const key=`${r.points}/${r.won-r.lost}/${r.won}`;if(key!==previous)rank=i+1;previous=key;const tr=node('tr');[rank,r.name,r.played,r.wins,r.losses,r.points,`${r.won}/${r.lost}`].forEach(v=>tr.append(node('td',v)));table.append(tr);});content.append(table);event.matches.forEach((m,i)=>content.append(match(m,i)));
        }else{const rounds=bracket(event.teams,event.scores);rounds.forEach((round,i)=>{content.append(node('h3',i===rounds.length-1?'결승':`${i+1}라운드`));round.forEach(m=>content.append(match(m)));});const winner=rounds.at(-1)[0].winner;if(winner)content.append(node('h3',`🏆 우승: ${name(winner)}`));}
        panel.append(content,btn(`${event.mode} 대진·결과 인쇄`,()=>print(event.name,content)));
        panel.append(btn('이 대회 삭제',()=>{if(confirm('선택한 대회의 팀과 경기 결과를 삭제할까요?')){const fresh=structuredClone(state().data);fresh.events=fresh.events.filter(e=>e.id!==event.id);commit(fresh);}}));
    }
    return {render,refresh};
}
