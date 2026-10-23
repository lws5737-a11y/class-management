// Presentation-only layer. All mutations use the existing classroom actions/save pipeline.
export function sortRoster(students, field = 'no', query = '', filter = 'all') {
    const needle = query.trim().toLocaleLowerCase();
    return students.filter(s => (!needle || `${s.no} ${s.name}`.toLocaleLowerCase().includes(needle))
        && (filter !== 'absent' || !s.attendance) && (filter !== 'selected' || (s.selected && s.attendance)))
        .slice().sort((a, b) => {
            if (field === 'name') return a.name.localeCompare(b.name, 'ko') || a.no - b.no;
            if (field === 'ballSense') return Number(b.ballSense) - Number(a.ballSense) || a.no - b.no;
            if (field === 'recordMs') return (a.recordMs > 0 ? a.recordMs : Infinity) - (b.recordMs > 0 ? b.recordMs : Infinity) || a.no - b.no;
            return a.no - b.no;
        });
}

export function initClassroomUI({ getState, clearSelection }) {
    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };
    const button = (text, action, className = 'ui-secondary') => {
        const node = el('button', className, text);
        node.type = 'button';
        node.addEventListener('click', action);
        return node;
    };
    const list = document.getElementById('mobile-student-list');
    const search = document.getElementById('roster-search');
    const sort = document.getElementById('roster-sort');
    let filter = 'all', rosterClass = null, previousTab = null, previousClass = null;
    const jumpRopeDrafts = new Map();
    const draftFields = ['male-1', 'male-2', 'female-1', 'female-2', 'target'].map(name => `jumprope-${name}-input`);
    const draftKey = () => JSON.stringify([getState().currentClass, document.getElementById('jumprope-week-select').value]);
    const draftHint = el('p', 'ui-draft-hint');
    draftHint.id = 'jumprope-draft-status';
    draftHint.setAttribute('role', 'status');
    document.querySelector('#jumprope-section button[onclick*="saveJumpRopeRecord"]').before(draftHint);
    function updateDraftHint() {
        draftHint.textContent = jumpRopeDrafts.has(draftKey()) ? '작성 중 · 아래 기록 저장 버튼을 눌러 확정하세요.' : '기록을 입력한 뒤 저장하세요. 미실시 회차는 0을 입력합니다.';
        draftHint.classList.toggle('is-dirty', jumpRopeDrafts.has(draftKey()));
    }
    // Capture before target's inline auto-save can trigger a remote render.
    document.addEventListener('input', event => {
        if (!draftFields.includes(event.target.id)) return;
        jumpRopeDrafts.set(draftKey(), draftFields.map(id => document.getElementById(id).value));
        updateDraftHint();
    }, true);
    function restoreJumpRopeDraft() {
        const draft = jumpRopeDrafts.get(draftKey());
        if (draft) draftFields.forEach((id, index) => { document.getElementById(id).value = draft[index]; });
        updateDraftHint();
    }
    function clearJumpRopeDraft() { jumpRopeDrafts.delete(draftKey()); updateDraftHint(); }
    const dialog = el('dialog', 'ui-sheet');
    dialog.setAttribute('aria-labelledby', 'student-sheet-title');
    document.body.append(dialog);
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => document.body.classList.remove('sheet-open'));
    const toast = el('div', 'ui-toast');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.append(toast);
    let toastTimer;
    function announce(message) {
        toast.textContent = message;
        toast.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
    }
    function sheet(title, subtitle) {
        dialog.replaceChildren();
        const panel = el('div', 'ui-sheet-panel');
        const heading = el('div', 'ui-sheet-heading');
        const h = el('h2', '', title); h.id = 'student-sheet-title';
        heading.append(h, button('닫기', () => dialog.close()));
        panel.append(heading, el('p', 'ui-hint', subtitle));
        const body = el('div', 'ui-sheet-actions');
        panel.append(body); dialog.append(panel);
        if (!dialog.open) dialog.showModal();
        document.body.classList.add('sheet-open');
        return body;
    }
    function act(no, action, message) {
        dialog.close();
        if (!getState().students.some(s => s.no === no)) return announce('학생 명단이 변경되었습니다. 다시 확인해 주세요.');
        action();
        if (message) announce(message);
    }
    function openMove(no) {
        const { students, currentGroupMode } = getState();
        const student = students.find(s => s.no === no);
        if (!student) return;
        const source = student[`group_${currentGroupMode}`] || 0;
        const count = currentGroupMode === 'mixed2' ? 2 : currentGroupMode === 'mixed3' ? 3 : 4;
        const body = sheet(`${student.name} · 모둠 이동`, '빈 공간으로 끌지 않아도 됩니다. 이동할 곳을 누르세요.');
        for (let i = 1; i <= count + 1; i++) {
            const target = i > count ? 0 : i;
            const label = target ? `${target}모둠` : '미편성';
            const present = students.filter(s => s.attendance && (s[`group_${currentGroupMode}`] || 0) === target).length;
            const b = button(`${label} · 참석 ${present}명${source === target ? ' (현재)' : ''}`, () => act(no, () => window.handleDropLogic(no, target), `${student.name} → ${label} 이동`));
            b.disabled = source === target;
            body.append(b);
        }
        body.append(button('다른 학생과 자리 교환', () => openSwap(no), 'ui-primary'));
    }
    function openSwap(no) {
        const { students, currentGroupMode } = getState();
        const student = students.find(s => s.no === no);
        if (!student) return;
        const source = student[`group_${currentGroupMode}`] || 0;
        const body = sheet(`${student.name} · 자리 교환`, '다른 모둠 또는 미편성 학생을 선택하면 서로의 자리로 이동합니다.');
        const candidates = students.filter(s => s.no !== no && (s[`group_${currentGroupMode}`] || 0) !== source)
            .sort((a, b) => (a[`group_${currentGroupMode}`] || 99) - (b[`group_${currentGroupMode}`] || 99) || a.no - b.no);
        for (const target of candidates) {
            const group = target[`group_${currentGroupMode}`];
            body.append(button(`${group ? group + '모둠' : '미편성'} · ${target.no}번 ${target.name}${target.attendance ? '' : ' (불참)'}`, () => act(no, () => {
                if (getState().students.some(s => s.no === target.no)) window.handleStudentDropLogic(no, target.no);
            }, '자리 교환을 적용했습니다.')));
        }
        if (!candidates.length) body.append(el('p', 'ui-empty', '교환할 다른 모둠의 학생이 없습니다.'));
        body.append(button('이동 선택으로 돌아가기', () => openMove(no)));
    }
    function openStudent(no) {
        const { students, currentGroupMode } = getState();
        const s = students.find(student => student.no === no);
        if (!s) return;
        const g = s[`group_${currentGroupMode}`];
        const body = sheet(`${s.no}번 ${s.name}`, `${s.gender} · ${g ? g + '모둠' : '미편성'} · ${s.attendance ? '참석' : '불참'}`);
        body.append(button('모둠 이동 / 자리 교환', () => openMove(no), 'ui-primary'));
        body.append(button(`볼센스 ${s.ballSense || 0}단계 · 눌러 변경`, () => act(no, () => window.cycleStudentAbility(no, 'ballSense'))));
        body.lastChild.disabled = !s.attendance;
        body.append(button(`순발력 ${s.recordMs > 0 ? (s.recordMs / 1000).toFixed(2) + '초' : '미측정'} · 수정`, () => act(no, () => window.manualStudentTimeEdit(no))));
        body.append(button(s.memo ? '학생 메모 보기 / 수정' : '학생 메모 남기기', () => act(no, () => window.openMemoModal(no))));
        body.append(button(s[`captain_${currentGroupMode}`] ? '체육부장 해제' : '체육부장 지정', () => act(no, () => window.toggleCaptain(no))));
        body.append(button('경고 카드 변경', () => act(no, () => window.cyclePenaltyCard(no))));
        body.append(button('학생 삭제…', () => act(no, () => window.deleteStudent(no)), 'ui-danger'));
    }
    function renderRoster() {
        const { students, currentClass, currentGroupMode } = getState();
        if (rosterClass !== currentClass) { rosterClass = currentClass; search.value = ''; filter = 'all'; }
        document.getElementById('mobile-roster-count').textContent = `참석 ${students.filter(s => s.attendance).length} / ${students.length}`;
        document.querySelectorAll('[data-roster-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rosterFilter === filter)));
        const activeKey = list.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
        list.replaceChildren();
        for (const s of sortRoster(students, sort.value, search.value, filter)) {
            const row = el('article', `ui-student-row${s.attendance ? '' : ' is-absent'}${s.selected ? ' is-selected' : ''}`);
            const attendance = button(s.attendance ? '출석' : '불참', () => window.toggleAttendance(s.no), 'ui-attendance');
            attendance.setAttribute('aria-label', `${s.name} ${s.attendance ? '출석, 불참으로 변경' : '불참, 출석으로 변경'}`);
            attendance.setAttribute('aria-pressed', String(Boolean(s.attendance)));
            attendance.dataset.focusKey = `attendance-${s.no}`;
            const name = button('', () => window.toggleSelection(s.no), 'ui-student-name');
            name.dataset.focusKey = `selection-${s.no}`;
            name.disabled = !s.attendance;
            name.setAttribute('aria-pressed', String(Boolean(s.selected)));
            name.setAttribute('aria-label', `${s.name} 측정 대상 ${s.selected ? '해제' : '선택'}`);
            name.append(el('strong', '', `${s.no}. ${s.name}`));
            const group = s[`group_${currentGroupMode}`];
            name.append(el('span', '', `${s.gender} · ${group ? group + '모둠' : '미편성'}${s[`captain_${currentGroupMode}`] ? ' · 체육부장' : ''}${s.memo ? ' · 메모' : ''}${s.selected ? ' · 선택됨' : ''}`));
            name.append(el('span', 'ui-student-record', `볼센스 ${s.ballSense || 0} · 순발력 ${s.recordMs > 0 ? (s.recordMs / 1000).toFixed(2) + '초' : '미측정'}`));
            const details = button('•••', () => openStudent(s.no), 'ui-student-more');
            details.dataset.focusKey = `details-${s.no}`;
            details.setAttribute('aria-label', `${s.name} 기록·메모·모둠 관리`);
            row.append(attendance, name, details); list.append(row);
        }
        if (!list.childElementCount) list.append(el('p', 'ui-empty', students.length ? '조건에 맞는 학생이 없습니다.' : '명단·백업에서 학생 명단을 추가해 주세요.'));
        if (activeKey) [...list.querySelectorAll('[data-focus-key]')].find(b => b.dataset.focusKey === activeKey)?.focus({ preventScroll: true });
        document.getElementById('roster-clear-selection').disabled = !students.some(s => s.selected);
    }
    function enhanceGroups() {
        document.querySelectorAll('#group-result .student-card[data-student-no]').forEach(card => {
            if (card.querySelector('.ui-card-more')) return;
            const no = Number(card.dataset.studentNo);
            const name = getState().students.find(s => s.no === no)?.name || '';
            const more = button('이동·더보기', () => {}, 'ui-card-more');
            more.setAttribute('aria-label', `${name} 이동·기록·메모`);
            more.addEventListener('click', event => { event.stopPropagation(); openStudent(no); });
            more.addEventListener('touchstart', event => event.stopPropagation(), { passive: true });
            more.addEventListener('pointerdown', event => event.stopPropagation());
            more.draggable = false;
            card.append(more);
        });
    }
    function updateNavigation() {
        const { currentTab, currentClass } = getState();
        document.body.dataset.tab = currentTab;
        document.querySelectorAll('#tab-navigation button').forEach(b => {
            if (b.id === `tab-${currentTab}`) b.setAttribute('aria-current', 'page');
            else b.removeAttribute('aria-current');
        });
        if (currentTab !== previousTab || currentClass !== previousClass) window.scrollTo({ top: 0, behavior: 'instant' });
        previousTab = currentTab; previousClass = currentClass;
        renderRoster();
    }
    search.addEventListener('input', renderRoster);
    sort.addEventListener('change', renderRoster);
    document.querySelectorAll('[data-roster-filter]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.rosterFilter; renderRoster(); }));
    document.getElementById('roster-clear-selection').addEventListener('click', clearSelection);
    document.getElementById('class-edit-toggle').addEventListener('click', event => {
        const active = document.getElementById('class-selection-list').classList.toggle('is-editing');
        event.currentTarget.setAttribute('aria-pressed', String(active));
        event.currentTarget.textContent = active ? '삭제 관리 마치기' : '학급 삭제 관리';
    });
    // Keep original handlers and IDs; the same controls serve keyboard, touch and desktop.
    const symbols = { student: '▤', group: '▦', jumprope: '◷', stamp: '☆' };
    Object.entries(symbols).forEach(([tab, symbol]) => {
        const icon = el('span', 'ui-nav-icon', symbol); icon.setAttribute('aria-hidden', 'true');
        document.getElementById(`tab-${tab}`).prepend(icon);
    });
    document.getElementById('class-tools-btn').setAttribute('aria-label', '학생 명단 및 백업');
    document.querySelectorAll('#jumprope-section input[type="number"]').forEach(input => input.inputMode = 'numeric');
    const tools = document.getElementById('jumprope-live-tools');
    const disclosure = el('details', 'ui-disclosure ui-live-tools');
    disclosure.open = true;
    disclosure.append(el('summary', '', '측정 도구 · 타이머와 카운터'));
    tools.before(disclosure); disclosure.append(tools);
    // Put measurement next to entry instead of below the complete ranking list.
    document.getElementById('jumprope-section').firstElementChild.after(disclosure);
    renderRoster(); updateNavigation();
    return { renderRoster, enhanceGroups, updateNavigation, restoreJumpRopeDraft, clearJumpRopeDraft };
}
