import { auth, db, provider } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

window.isDraggingCard = false; 
window.selectedGroupStudent = null; 

// ==========================================
// 1. 오디오 통합 관리
// ==========================================
let audioCtx;
function initAudio() {
if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
if (audioCtx.state === 'suspended') { audioCtx.resume(); }
return audioCtx;
}
document.body.addEventListener('click', initAudio, { once: true });
document.body.addEventListener('touchstart', initAudio, { once: true });

window.playCoinSound = function() {
try {
const ctx = initAudio();
const osc = ctx.createOscillator(); const gain = ctx.createGain();
osc.type = 'sine'; osc.connect(gain); gain.connect(ctx.destination);
osc.frequency.setValueAtTime(987.77, ctx.currentTime);
osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08);
gain.gain.setValueAtTime(0.1, ctx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
} catch(e) {}
}

window.playBumpSound = function() {
try {
const ctx = initAudio();
const osc = ctx.createOscillator(); const gain = ctx.createGain();
osc.type = 'triangle'; osc.connect(gain); gain.connect(ctx.destination);
osc.frequency.setValueAtTime(150, ctx.currentTime);
osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
gain.gain.setValueAtTime(0.2, ctx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
} catch(e) {}
}

window.playDrumRoll = function() {
try {
const ctx = initAudio();
for (let i = 0; i < 20; i++) {
setTimeout(() => {
const osc = ctx.createOscillator(); const gain = ctx.createGain();
osc.type = 'triangle';
osc.frequency.setValueAtTime(100 + Math.random() * 50, ctx.currentTime);
gain.gain.setValueAtTime(0.3, ctx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
osc.connect(gain); gain.connect(ctx.destination);
osc.start(); osc.stop(ctx.currentTime + 0.1);
}, i * 100);
}
} catch(e) {}
}

window.playGrandFanfare = function() {
try {
const ctx = initAudio();
const playChord = (freqs, t, d) => {
freqs.forEach(f => {
const osc = ctx.createOscillator(); const gain = ctx.createGain();
osc.type = 'square'; osc.frequency.value = f;
gain.gain.setValueAtTime(0.15, ctx.currentTime + t);
gain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + t + d);
osc.connect(gain); gain.connect(ctx.destination);
osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + d);
});
};
playChord([440, 554.37, 659.25], 0, 0.2); 
playChord([440, 554.37, 659.25], 0.2, 0.2);
playChord([440, 554.37, 659.25], 0.4, 0.2);
playChord([493.88, 587.33, 739.99], 0.6, 0.4); 
playChord([523.25, 659.25, 783.99, 1046.50], 1.0, 1.5); 
} catch(e) {}
}

window.playCardShuffleSound = function() {
    try {
        const ctx = initAudio();
        let startTime = ctx.currentTime;
        for (let i = 0; i < 18; i++) {
            let tickTime = startTime + i * 0.08;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400 + Math.random() * 200, tickTime);
            gain.gain.setValueAtTime(0, tickTime);
            gain.gain.linearRampToValueAtTime(0.06, tickTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, tickTime + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(tickTime);
            osc.stop(tickTime + 0.08);
        }
    } catch(e) {}
};

window.playCasinoJackpot = function() {
    try {
        const ctx = initAudio();
        let now = ctx.currentTime;
        const freqs = [523.25, 659.25, 783.99, 1046.50]; 
        for(let i=0; i<15; i++) {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freqs[i % freqs.length] + (Math.random() * 10 - 5);
            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.08);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.08);
        }
    } catch(e) {}
};

window.playOlympicFanfare = function() {
    try {
        const ctx = initAudio();
        const playBrass = (f, t, d) => {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'sawtooth'; osc.frequency.value = f;
            gain.gain.setValueAtTime(0, ctx.currentTime + t);
            gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + t + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + d);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + d);
        };
        
        const chords = [
            [261.63, 329.63, 392.00], 
            [349.23, 440.00, 523.25], 
            [392.00, 493.88, 587.33], 
            [523.25, 659.25, 783.99, 1046.50] 
        ];
        
        chords[0].forEach(f => playBrass(f, 0, 0.4));
        chords[1].forEach(f => playBrass(f, 0.4, 0.4));
        chords[2].forEach(f => playBrass(f, 0.8, 0.4));
        chords[3].forEach(f => playBrass(f, 1.2, 1.2));
    } catch(e) {}
};

let confettiAnimationFrame;
let confettiParticles = [];
window.fireConfetti = function() {
    const canvas = document.getElementById('confetti-canvas');
    canvas.classList.remove('hidden');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    
    if(confettiAnimationFrame) cancelAnimationFrame(confettiAnimationFrame);
    confettiParticles = [];
    
    const colors = ['#fce18a', '#ff726d', '#b48def', '#f4306d', '#48b8d0', '#3498db', '#2ecc71', '#ffb74d'];

    for(let i = 0; i < 200; i++) {
        confettiParticles.push({
            x: canvas.width / 2, y: canvas.height / 2 + 150,
            r: Math.random() * 8 + 4, dx: Math.random() * 30 - 15, dy: Math.random() * -25 - 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.floor(Math.random() * 10) - 10, tiltAngle: 0, tiltAngleInc: (Math.random() * 0.07) + 0.05
        });
    }
    
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        confettiParticles.forEach(p => {
            p.tiltAngle += p.tiltAngleInc;
            p.y += (Math.cos(p.tiltAngle) + 1 + p.r / 2) / 2;
            p.x += Math.sin(p.tiltAngle) * 2;
            p.dy += 0.3; p.y += p.dy; p.x += p.dx;
            if (p.y <= canvas.height) active = true;

            ctx.beginPath(); ctx.lineWidth = p.r; ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.tilt + p.r, p.y);
            ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
            ctx.stroke();
        });
        if (active) confettiAnimationFrame = requestAnimationFrame(render);
        else { 
            cancelAnimationFrame(confettiAnimationFrame); 
            canvas.classList.add('hidden'); 
        }
    }
    render();
}

// ==========================================
// 2. 상태 관리 및 유틸리티
// ==========================================

function isRegularClass(className) {
    if(!className) return false;
    return /^\d+-\d+$/.test(className);
}

window.openStampSelectModal = function() {
    document.getElementById('stampSelectModal').style.display = 'flex';
    let html = '';
    for(let i=1; i<=20; i++) {
        let num = String(i).padStart(2, '0');
        let path = `images/stamps/stamp${num}.jpg`;
        html += `<img src="${path}" class="w-full aspect-square rounded-2xl cursor-pointer border-4 border-transparent hover:border-green-500 hover:scale-105 transition bg-white shadow-sm object-cover" onclick="window.selectStamp('${path}')" onerror="this.style.display='none'">`;
    }
    document.getElementById('stamp-grid-container').innerHTML = html;
};

window.closeStampSelectModal = function() {
    document.getElementById('stampSelectModal').style.display = 'none';
};

window.selectStamp = function(path) {
    globalStampImage = path;
    localStorage.setItem('customStamp', globalStampImage);
    document.querySelectorAll('.stamp-img').forEach(img => { img.src = globalStampImage; });
    saveData();
    window.renderStampBoard();
    window.closeStampSelectModal();
};

window.getAbilityHTML = function(type, val) {
    let emoji = type === 'ballSense' ? '⚽' : '⚡';
    if (val === '2') return `<div class="emoji-lvl-2"><span>${emoji}</span><span>${emoji}</span></div>`;
    if (val === '1') return `<div class="emoji-lvl-1"><span>${emoji}</span></div>`;
    return `<span class="text-slate-300 text-[10px] font-bold">-</span>`;
};

const getStudentPower = (student, validRecords) => {
    let bs = (parseInt(student.ballSense) || 0) * 60; 
    let rs = 0;
    if (student.recordMs > 0 && validRecords.length > 0) {
        let rank = validRecords.indexOf(student.recordMs);
        rs = 100 - (rank / validRecords.length * 100);
    }
    return bs + rs; 
};

let currentClass = "";
let classData = {};
let groupScores = {};
let groupRecords = {}; 
let classStamps = {}; 
let sortState = { field: 'no', direction: 'asc' };
let currentGroupMode = 'mixed4'; 
let currentTab = 'student'; 

let activeTimers = {}; 
let timerLoopStarted = false; 
let draggedStudentNo = null;
let currentEditingStudentNo = null;
window.showHiddenClasses = false;

const TOTAL_STAMP_CELLS = 20;
let defaultStampImg = "images/stamps/stamp01.jpg";
let globalStampImage = localStorage.getItem('customStamp');
if (!globalStampImage || globalStampImage.startsWith("data:image/svg+xml")) {
    globalStampImage = defaultStampImg;
}

const abilitiesCycle = ['0', '1', '2']; 
const getGroupsCycle = () => {
let max = currentGroupMode === 'mixed2' ? 2 : (currentGroupMode === 'mixed3' ? 3 : 4);
const cycle = [null]; for(let i=1; i<=max; i++) cycle.push(i); return cycle;
};

// ==========================================
// --- 드래그 앤 드롭 및 터치 이동 통합 로직 ---
// ==========================================
let touchTimeout;
window.touchClone = null;
window.activeTouchElement = null;
window.touchStartX = 0;
window.touchStartY = 0;
window.isTouchDragging = false;

// 모바일: 카드를 꾹 눌렀을 때 (Touch Start)
window.handleTouchStart = function(e, studentNo) {
    const touch = e.touches[0];
    const target = e.currentTarget;

    window.touchStartX = touch.clientX;
    window.touchStartY = touch.clientY;

    touchTimeout = setTimeout(() => {
        window.isTouchDragging = true;
        window.draggedStudentNo = studentNo;
        window.selectedGroupStudent = null; 

        document.querySelectorAll('.student-card').forEach(card => card.classList.remove('ring-4', 'ring-yellow-400'));

        const clone = target.cloneNode(true);
        const rect = target.getBoundingClientRect();
        clone.style.position = 'fixed';
        clone.style.left = rect.left + 'px'; 
        clone.style.top = rect.top + 'px';
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
        clone.style.opacity = '0.9';
        clone.style.zIndex = '9999';
        clone.style.pointerEvents = 'none'; 
        clone.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5)';
        clone.style.transform = 'translate3d(0px, 0px, 0px) scale(1.05)';
        clone.style.willChange = 'transform'; 
        
        document.body.appendChild(clone);
        window.touchClone = clone;

        target.style.opacity = '0.3';
        window.activeTouchElement = target;
        
        if (navigator.vibrate) navigator.vibrate(50);
    }, 100); 
};

// 모바일: 카드를 끌고 이동할 때 (Touch Move) 
window.handleTouchMove = function(e) {
    if (!window.touchClone) {
        clearTimeout(touchTimeout); 
        return;
    }
    e.preventDefault(); 
    const touch = e.touches[0];
    
    const dx = touch.clientX - window.touchStartX;
    const dy = touch.clientY - window.touchStartY;
    window.touchClone.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.05)`;

    const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    
    document.querySelectorAll('.drop-target-active').forEach(el => {
        el.classList.remove('drop-target-active', 'ring-4', 'ring-yellow-400', 'ring-inset', 'bg-yellow-50');
    });

    if (elemBelow) {
        const studentCard = elemBelow.closest('.student-card');
        const groupArea = elemBelow.closest('.group-area');
        
        if (studentCard) {
            const targetNo = parseInt(studentCard.getAttribute('data-student-no'));
            if (targetNo && targetNo !== window.draggedStudentNo) {
                studentCard.classList.add('drop-target-active', 'ring-4', 'ring-yellow-400');
            }
        } else if (groupArea) {
            groupArea.classList.add('drop-target-active', 'ring-4', 'ring-yellow-400', 'ring-inset', 'bg-yellow-50');
        }
    }
};

// 모바일: 손가락을 뗐을 때 (Touch End)
window.handleTouchEnd = function(e) {
    clearTimeout(touchTimeout);
    if (!window.touchClone) return;
    e.preventDefault(); 
    
    const touch = e.changedTouches[0];
    const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);

    if (window.activeTouchElement) {
        window.activeTouchElement.style.opacity = '1';
    }

    if (elemBelow) {
        const studentCard = elemBelow.closest('.student-card');
        const groupArea = elemBelow.closest('.group-area');
        if (studentCard) {
            const targetNo = parseInt(studentCard.getAttribute('data-student-no'));
            if (targetNo && targetNo !== window.draggedStudentNo) {
                window.handleDropLogic(window.draggedStudentNo, targetNo, null);
            }
        } else if (groupArea) {
            const targetGroupAttr = groupArea.getAttribute('data-group-id');
            if (targetGroupAttr !== null) {
                window.handleDropLogic(window.draggedStudentNo, null, parseInt(targetGroupAttr));
            }
        }
    }

    document.querySelectorAll('.drop-target-active').forEach(el => {
        el.classList.remove('drop-target-active', 'ring-4', 'ring-yellow-400', 'ring-inset', 'bg-yellow-50');
    });
    
    window.touchClone.remove();
    window.touchClone = null;
    window.activeTouchElement = null;
    window.draggedStudentNo = null;
    
    setTimeout(() => { window.isTouchDragging = false; }, 10);
};

// PC 및 모바일 공용: 교체 및 이동 처리 함수
window.handleDropLogic = function(draggedNo, targetNo, targetGroup) {
    if (!draggedNo) return;
    const students = classData[currentClass];
    const draggedIndex = students.findIndex(s => s.no === draggedNo);
    if (draggedIndex === -1) return;
    
    const draggedStudent = students[draggedIndex];
    let changed = false;

    document.querySelectorAll('.drop-target-active').forEach(el => {
        el.classList.remove('drop-target-active', 'ring-4', 'ring-yellow-400', 'ring-inset', 'bg-yellow-50');
    });

    if (targetNo !== null && targetNo !== draggedNo) {
        const targetIndex = students.findIndex(s => s.no === targetNo);
        if (targetIndex > -1) {
            const targetStudent = students[targetIndex];
            const dGroup = draggedStudent[`group_${currentGroupMode}`];
            const tGroup = targetStudent[`group_${currentGroupMode}`];
            
            if (dGroup !== tGroup) { // 다른 모둠 학생과 교체 또는 미편성-편성 교체
                draggedStudent[`group_${currentGroupMode}`] = tGroup || null;
                targetStudent[`group_${currentGroupMode}`] = dGroup || null;
            } else { // 같은 모둠(또는 둘다 미편성) 내에서 순서 변경
                students.splice(draggedIndex, 1); 
                const newTargetIndex = students.findIndex(s => s.no === targetNo);
                students.splice(newTargetIndex, 0, draggedStudent);
            }
            changed = true;
        }
    } else if (targetGroup !== null) { // 특정 모둠 또는 미편성 영역(0)으로 이동
        let newGroup = targetGroup === 0 ? null : targetGroup;
        if (draggedStudent[`group_${currentGroupMode}`] !== newGroup) {
            draggedStudent[`group_${currentGroupMode}`] = newGroup;
            changed = true;
        }
    }
    
    if (changed) {
        saveData(); 
        window.renderStudentList(); 
    }
    window.renderGroups();
};

// PC 환경: 드래그 앤 드롭 이벤트
window.handleDragStart = function(e, studentNo) {
    window.isDraggingCard = true; window.draggedStudentNo = studentNo;
    window.selectedGroupStudent = null; 
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { e.target.style.opacity = '0.4'; e.target.style.transform = 'scale(0.95)'; }, 0);
};

window.handleDragEnd = function(e) {
    window.isDraggingCard = false; window.draggedStudentNo = null;
    e.target.style.opacity = '1'; e.target.style.transform = 'scale(1)'; 
    document.querySelectorAll('.drop-target-active').forEach(el => {
        el.classList.remove('drop-target-active', 'ring-4', 'ring-yellow-400', 'ring-inset', 'bg-yellow-50');
    });
};

window.handleDragOverGroup = function(e) { 
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; 
    e.currentTarget.classList.add('drop-target-active', 'ring-4', 'ring-yellow-400', 'ring-inset', 'bg-yellow-50');
};
window.handleDragLeaveGroup = function(e) {
    e.currentTarget.classList.remove('drop-target-active', 'ring-4', 'ring-yellow-400', 'ring-inset', 'bg-yellow-50');
};

window.handleDragOverStudent = function(e, studentNo) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    if (studentNo !== window.draggedStudentNo) {
        e.currentTarget.classList.add('drop-target-active', 'ring-4', 'ring-yellow-400');
    }
};
window.handleDragLeaveStudent = function(e) {
    e.currentTarget.classList.remove('drop-target-active', 'ring-4', 'ring-yellow-400');
};

window.handleDropOnStudent = function(e, targetStudentNo) {
    e.preventDefault(); e.stopPropagation(); 
    window.handleDropLogic(window.draggedStudentNo, targetStudentNo, null);
    window.draggedStudentNo = null;
};

window.handleDropOnGroup = function(e, targetGroupId) {
    e.preventDefault();
    window.handleDropLogic(window.draggedStudentNo, null, targetGroupId);
    window.draggedStudentNo = null;
};

window.handleStudentCardClick = function(studentNo) {
    if (window.isTouchDragging) { window.isTouchDragging = false; return; } 
    
    if (window.selectedGroupStudent === null) {
        window.selectedGroupStudent = studentNo;
    } else if (window.selectedGroupStudent === studentNo) {
        window.selectedGroupStudent = null; 
    } else {
        window.handleDropLogic(window.selectedGroupStudent, studentNo, null);
        window.selectedGroupStudent = null;
    }
    window.renderGroups();
};

window.handleGroupAreaClick = function(groupId) {
    if (window.isTouchDragging) return;
    if (window.selectedGroupStudent !== null) {
        window.handleDropLogic(window.selectedGroupStudent, null, groupId);
        window.selectedGroupStudent = null;
    }
};

window.saveClassVisibility = function(className, isVisible) {
    let visibilityData = JSON.parse(localStorage.getItem('classVisibility')) || {};
    visibilityData[className] = isVisible;
    localStorage.setItem('classVisibility', JSON.stringify(visibilityData));
};

window.isClassVisible = function(className) {
    let visibilityData = JSON.parse(localStorage.getItem('classVisibility')) || {};
    return visibilityData[className] !== false;
};

window.toggleClassVisibility = function(className, checkbox) {
    window.saveClassVisibility(className, checkbox.checked);
    window.renderClassSelect();
};

window.toggleHiddenClasses = function() {
    window.showHiddenClasses = !window.showHiddenClasses;
    window.renderClassSelect();
};

window.openManageModal = function() {
document.getElementById('manage-modal').classList.remove('hidden');
document.getElementById('manage-modal').classList.add('flex');
window.renderClassSelect();
}
window.closeManageModal = function() {
document.getElementById('manage-modal').classList.add('hidden');
document.getElementById('manage-modal').classList.remove('flex');
}

window.renderClassSelect = function() {
    const listEl = document.getElementById('modal-class-list');
    const displayBtn = document.getElementById('current-class-display');
    const toggleBtn = document.getElementById('toggle-hidden-classes-btn');

    if(!listEl) return;

    if (toggleBtn) {
        toggleBtn.innerText = window.showHiddenClasses ? "숨긴 학급 숨기기" : "전체 학급 보기";
    }

    listEl.innerHTML = ''; 
    const classes = Object.keys(classData).sort();

    if(classes.length === 0) { 
        listEl.innerHTML = '<div class="text-slate-400 font-bold text-sm w-full py-2">등록된 학급이 없습니다. 새 학급을 추가해주세요.</div>'; 
        if(displayBtn) displayBtn.innerHTML = "<span>⚙️ 설정 및 시작</span>";
    } else {
        let activeCount = 0;
        classes.forEach(cls => {
            const isVisible = window.isClassVisible(cls);
            if (!isVisible && !window.showHiddenClasses) return;
            activeCount++;

            const wrapper = document.createElement('div');
            wrapper.className = "flex items-center gap-1 border-2 shadow-sm rounded-xl px-1.5 py-1 bg-white border-slate-200 transition-colors w-auto shrink-0";
            if(currentClass === cls) wrapper.classList.add("border-blue-500");

            const toggleWrapper = document.createElement('label');
            toggleWrapper.className = "cursor-pointer flex items-center justify-center p-1 rounded-lg hover:bg-slate-100 transition";
            toggleWrapper.innerHTML = `
                <input type="checkbox" class="hidden" onchange="window.toggleClassVisibility('${cls}', this)" ${isVisible ? 'checked' : ''}>
                <span class="text-lg opacity-80">${isVisible ? '👁️' : '🙈'}</span>
            `;
            wrapper.appendChild(toggleWrapper);

            const btn = document.createElement('button'); 
            btn.className = "px-2 py-1.5 font-bold text-sm whitespace-nowrap outline-none ";
            if (!isVisible) btn.classList.add("opacity-40", "text-slate-400", "line-through");
            else btn.classList.add("text-slate-700", "hover:text-blue-600");
            
            if(currentClass === cls) btn.classList.add("text-blue-600", "font-black");
            
            btn.innerText = cls; 
            btn.onclick = function() { window.selectClass(cls); window.closeManageModal(); }; 
            wrapper.appendChild(btn);
            listEl.appendChild(wrapper);
        });

        if (activeCount === 0) {
            listEl.innerHTML = '<div class="text-slate-400 font-bold text-sm w-full py-2">활성화된 학급이 없습니다. [전체 학급 보기]를 눌러 확인해주세요.</div>';
        }

        if (currentClass && classes.includes(currentClass)) {
            if(displayBtn) displayBtn.innerHTML = `<span>⚙️ ${currentClass}</span>`;
        } else { 
            if(displayBtn) displayBtn.innerHTML = "<span>⚙️ 학급 선택</span>";
        }
    }
}

// ==========================================
// 3. Firebase 로그인 및 연동 제어
// ==========================================
let userId = null; let appId = 'smart-class-manager'; 
let isDebouncing = false; let unsubscribeSnapshot = null;

window.signInWithGoogle = function() {
    const btn = document.getElementById('btn-login');
    btn.innerHTML = '로그인 중...';
    signInWithPopup(auth, provider).catch((error) => {
        alert("로그인에 실패했습니다. 팝업이 차단되었는지 확인해주세요.");
        btn.innerHTML = 'Google 계정으로 시작하기';
    });
};

window.signOutApp = function() { if(confirm("로그아웃 하시겠습니까?")) signOut(auth); };

onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('user-email').innerText = user.email.split('@')[0];
        setupFirestoreListener();
        if (!currentClass) {
            window.openManageModal();
        }
    } else {
        userId = null;
        if(unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        classData = {}; groupScores = {}; groupRecords = {}; classStamps = {}; activeTimers = {};
        currentClass = ""; window.renderClassSelect();
    }
});

function setupFirestoreListener() {
if (!userId || !db) return;
const docRef = doc(db, 'artifacts', 'running-measurement-app', 'sharedRooms', 'dongsan-school-db');
if (unsubscribeSnapshot) unsubscribeSnapshot(); 
const syncIcon = document.getElementById('sync-status');
if(syncIcon) { syncIcon.classList.remove('hidden'); syncIcon.classList.add('flex'); }

unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
if (isDebouncing) return;
if(syncIcon) { syncIcon.classList.add('hidden'); syncIcon.classList.remove('flex'); }
if (docSnap.exists()) {
const data = docSnap.data();
classData = data.data || {}; groupScores = data.scores || {}; groupRecords = data.records || {}; classStamps = data.stamps || {};
if (data.stampImage) { globalStampImage = data.stampImage; localStorage.setItem('customStamp', globalStampImage); document.querySelectorAll('.stamp-img').forEach(img => { img.src = globalStampImage; }); }
migrateData();
}
window.renderClassSelect();
if (currentClass && classData[currentClass]) {
window.renderStudentList();
if(typeof window.renderGroups === 'function') window.renderGroups();
if(typeof window.renderStampBoard === 'function') window.renderStampBoard();
} else if (currentClass && !classData[currentClass]) {
currentClass = "";
const display = document.getElementById('current-class-display');
if (display) display.innerHTML = "<span>⚙️ 설정 및 시작</span>";
['tab-navigation', 'student-management', 'group-section', 'stamp-section'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
}
}, (error) => {
console.error("데이터 동기화 오류:", error);
if(syncIcon) { syncIcon.classList.add('hidden'); syncIcon.classList.remove('flex'); }
});
}

function saveData() {
if ("" in classData) delete classData[""]; if ("" in groupScores) delete groupScores[""];
if ("" in groupRecords) delete groupRecords[""]; if ("" in classStamps) delete classStamps[""];

if (userId && db) {
isDebouncing = true; 
const syncIcon = document.getElementById('sync-status');
if(syncIcon) { syncIcon.classList.remove('hidden'); syncIcon.classList.add('flex'); }

const docRef = doc(db, 'artifacts', 'running-measurement-app', 'sharedRooms', 'dongsan-school-db');
setDoc(docRef, { data: classData, scores: groupScores, records: groupRecords, stamps: classStamps, stampImage: globalStampImage }, { merge: true })
.then(() => { isDebouncing = false; if(syncIcon) { syncIcon.classList.add('hidden'); syncIcon.classList.remove('flex'); } })
.catch((error) => { 
    console.error("클라우드 자동 저장 실패:", error); 
    isDebouncing = false; 
    if(syncIcon) { syncIcon.classList.add('hidden'); syncIcon.classList.remove('flex'); } 
    window.showModal("저장 실패", "네트워크 문제 또는 도장 이미지 용량이 너무 커서 저장에 실패했습니다.");
});
}
}

// ==========================================
// 5. 도장판, 스톱워치 등 기존 공통 로직
// ==========================================
window.renderStampBoard = () => {
const board = document.getElementById('stampBoard'); if (!board) return;
const titleEl = document.getElementById('stamp-class-title');

if (!currentClass) { titleEl.innerText = "학급을 선택해주세요"; board.innerHTML = ""; return; }
titleEl.innerText = `${currentClass} 도장판`;
if (!classStamps[currentClass]) classStamps[currentClass] = Array(TOTAL_STAMP_CELLS).fill(false);

board.innerHTML = ''; let stampedCount = 0;
classStamps[currentClass].forEach((isStamped, i) => {
if (isStamped) stampedCount++;
const cell = document.createElement('div');
cell.className = `stamp-cell w-full aspect-square border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center bg-white hover:bg-green-50 ${isStamped ? 'stamped' : ''}`;
cell.innerHTML = `<span class="cell-number font-bold">${i + 1}</span><img src="${globalStampImage}" class="stamp-img">`;
cell.onclick = () => window.toggleStamp(i, cell);
board.appendChild(cell);
});
document.getElementById('progressCount').innerText = stampedCount;
window.checkMissionComplete(false);
};

window.toggleStampDropdown = function(e) {
    e.stopPropagation();
    const menu = document.getElementById('stamp-dropdown-menu');
    if (menu.classList.contains('hidden')) {
        menu.innerHTML = '';
        const classes = Object.keys(classData).sort();
        if(classes.length === 0) {
            menu.innerHTML = '<div class="p-4 text-sm text-slate-500 text-center font-medium">등록된 학급이 없습니다.</div>';
        } else {
            classes.forEach(cls => {
                const btn = document.createElement('button');
                btn.className = "w-full text-center px-4 py-3 text-lg font-bold hover:bg-green-50 text-slate-700 border-b border-gray-100 last:border-0 transition";
                btn.innerText = cls;
                if (cls === currentClass) {
                    btn.classList.add('bg-green-100', 'text-green-800');
                }
                btn.onclick = () => {
                    window.selectClass(cls);
                    menu.classList.add('hidden');
                    menu.classList.remove('flex');
                };
                menu.appendChild(btn);
            });
        }
        menu.classList.remove('hidden');
        menu.classList.add('flex');
    } else {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
    }
};

document.addEventListener('click', (e) => {
    const menu = document.getElementById('stamp-dropdown-menu');
    if (menu && !menu.classList.contains('hidden') && !e.target.closest('#stamp-dropdown-menu')) {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
    }
});

window.toggleStamp = (index, cellElement) => {
if (!currentClass) return;
const isStamped = !classStamps[currentClass][index]; classStamps[currentClass][index] = isStamped;
if (isStamped) { cellElement.classList.add('stamped'); window.playStampSound(); } 
else { cellElement.classList.remove('stamped'); window.playEraseSound(); }
document.getElementById('progressCount').innerText = classStamps[currentClass].filter(Boolean).length;
saveData(); window.checkMissionComplete(true);
};

window.checkMissionComplete = (playEffect) => {
const isComplete = classStamps[currentClass]?.every(s => s === true);
const badge = document.getElementById('missionBadgeContainer');
if (isComplete) { 
    badge.classList.remove('hidden'); 
    badge.classList.add('badge-animate'); 
    if (playEffect) window.playOlympicFanfare(); 
} 
else { badge.classList.add('hidden'); }
};

window.resetStampBoard = () => {
if (confirm("기록을 모두 초기화하시겠습니까?")) { classStamps[currentClass] = Array(TOTAL_STAMP_CELLS).fill(false); saveData(); window.renderStampBoard(); }
};

window.playStampSound = () => {
const ctx = initAudio(); const now = ctx.currentTime;
const fallOsc = ctx.createOscillator(); const fallGain = ctx.createGain();
fallOsc.type = 'sine'; fallOsc.frequency.setValueAtTime(900, now); fallOsc.frequency.exponentialRampToValueAtTime(100, now + 0.35);
fallGain.gain.setValueAtTime(0, now); fallGain.gain.linearRampToValueAtTime(0.4, now + 0.15); fallGain.gain.linearRampToValueAtTime(0, now + 0.35);
fallOsc.connect(fallGain); fallGain.connect(ctx.destination); fallOsc.start(now); fallOsc.stop(now + 0.35);

const boomOsc = ctx.createOscillator(); const boomGain = ctx.createGain();
boomOsc.type = 'square'; boomOsc.frequency.setValueAtTime(150, now + 0.35); boomOsc.frequency.exponentialRampToValueAtTime(20, now + 0.7);
boomGain.gain.setValueAtTime(0, now + 0.34); boomGain.gain.setValueAtTime(1.5, now + 0.35); boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
boomOsc.connect(boomGain); boomGain.connect(ctx.destination); boomOsc.start(now + 0.35); boomOsc.stop(now + 0.7);
};

const playTone = (freq, type, duration, gainVal) => {
const ctx = initAudio();
const osc = ctx.createOscillator(); const gain = ctx.createGain();
osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
gain.gain.setValueAtTime(gainVal, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + duration);
};
window.playEraseSound = () => [659, 880, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.4, 0.15), i * 50));
window.playFanfareSound = () => [392, 523, 659].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.8, 0.1), i * 150));

window.formatTime = function(ms) {
if (ms < 0) ms = 0;
let totalDeci = Math.floor(ms / 10); let centi = totalDeci % 100;
let totalSec = Math.floor(totalDeci / 100); let sec = totalSec % 60; let min = Math.floor(totalSec / 60);
let minStr = min > 0 ? String(min).padStart(2, '0') + ':' : '';
return `${minStr}${String(sec).padStart(2, '0')}.${String(centi).padStart(2, '0')}`;
}
window.parseTime = function(str) {
if (!str) return 0; str = String(str).trim();
if (!str.includes(':')) return isNaN(parseFloat(str)) ? 0 : Math.floor(parseFloat(str) * 1000);
let parts = str.split(':'); return ((parseInt(parts[0]) || 0) * 60 * 1000) + Math.floor((parseFloat(parts[1]) || 0) * 1000);
}

window.openMemoModal = function(studentNo, studentName) {
    currentEditingStudentNo = studentNo;
    const student = classData[currentClass].find(s => s.no === studentNo);
    document.getElementById('memo-modal-name').innerText = studentName;
    document.getElementById('memo-modal-input').value = student.memo || '';
    
    document.getElementById('memo-modal').classList.remove('hidden');
    document.getElementById('memo-modal').classList.add('flex');
}

window.closeMemoModal = function() {
    document.getElementById('memo-modal').classList.add('hidden');
    document.getElementById('memo-modal').classList.remove('flex');
    currentEditingStudentNo = null;
}

window.saveMemo = function() {
    if (currentEditingStudentNo === null) return;
    const student = classData[currentClass].find(s => s.no === currentEditingStudentNo);
    if (student) {
        student.memo = document.getElementById('memo-modal-input').value.trim();
        saveData();
        window.renderStudentList();
    }
    window.closeMemoModal();
}

window.updateDismissal = function(studentNo, value) {
    if (!classData[currentClass]) return;
    const student = classData[currentClass].find(s => s.no === studentNo);
    if(student) {
        student.dismissalInfo = value;
        saveData();
    }
}

// ==========================================
// 6. 타이머, 모달, 리스트 렌더링 등 코어 로직
// ==========================================
function updateTimersLoop() {
    let now = Date.now();
    let anyRunning = false;

    for (let i in activeTimers) {
        let t = activeTimers[i];
        if (t.isRunning) {
            anyRunning = true;
            if (t.mode === 'stopwatch') t.elapsed = now - t.startTime;
            else if (t.mode === 'timer') {
                t.elapsed = t.target - (now - t.startTime);
                if (t.elapsed <= 0) {
                    t.elapsed = 0; t.isRunning = false; window.updateGroupRecord(i, window.formatTime(t.elapsed));
                    const btn = document.getElementById(`btn-play-${i}`); if(btn) { btn.innerText = '▶'; btn.classList.remove('text-amber-400'); btn.classList.add('text-slate-300'); }
                }
            }
            const display = document.getElementById(`time-display-${i}`);
            if (display) {
                display.innerText = window.formatTime(t.elapsed);
                if(t.mode === 'timer' && t.elapsed <= 5000 && t.elapsed > 0) display.classList.add('text-red-400');
                else if (t.mode === 'timer' && t.elapsed === 0) display.classList.add('text-red-500');
                else display.classList.remove('text-red-400', 'text-red-500');
            }
        }
    }
    requestAnimationFrame(updateTimersLoop);
}

if(!timerLoopStarted) { timerLoopStarted = true; requestAnimationFrame(updateTimersLoop); }

window.manualStudentTimeEdit = function(studentNo) {
const student = classData[currentClass].find(s => s.no == studentNo);
if (!student) return;
let input = prompt("순발력(달리기) 기록을 초 단위 또는 분:초(예: 12.5 또는 1:23.45)로 입력하세요.", student.recordMs > 0 ? window.formatTime(student.recordMs) : "");
if (input !== null && input.trim() !== '') {
    student.recordMs = window.parseTime(input);
    saveData(); window.renderStudentList(); window.renderGroups();
}
}

window.resetRunningRecords = function() {
window.showModal("기록 초기화", "모든 학생의 순발력 기록을 정말로 지우시겠습니까?", true, function() {
if (!classData[currentClass]) return;
classData[currentClass].forEach(s => s.recordMs = 0);
saveData();
window.renderStudentList();
window.showModal("완료", "순발력 기록이 초기화되었습니다.");
}, "초기화");
};

window.toggleTimerPlay = function(groupId) {
let t = activeTimers[groupId]; if (!t) return;
let now = Date.now();
if (t.isRunning) {
t.isRunning = false; window.updateGroupRecord(groupId, window.formatTime(t.elapsed));
const btn = document.getElementById(`btn-play-${groupId}`);
if (btn) { btn.innerText = '▶'; btn.classList.remove('text-amber-400'); btn.classList.add('text-slate-300'); }
} else {
t.isRunning = true;
if (t.mode === 'stopwatch') t.startTime = now - t.elapsed;
else { if (t.elapsed <= 0) t.elapsed = t.target; t.startTime = now - (t.target - t.elapsed); }
const btn = document.getElementById(`btn-play-${groupId}`);
if (btn) { btn.innerText = '⏸'; btn.classList.remove('text-slate-300'); btn.classList.add('text-amber-400'); }
}
}
window.resetTimer = function(groupId) {
let t = activeTimers[groupId]; if (!t) return;
t.isRunning = false; t.elapsed = (t.mode === 'timer') ? t.target : 0;
const display = document.getElementById(`time-display-${groupId}`);
if (display) { display.innerText = window.formatTime(t.elapsed); display.classList.remove('text-red-500', 'text-red-400'); }
const btn = document.getElementById(`btn-play-${groupId}`); if (btn) { btn.innerText = '▶'; btn.classList.remove('text-amber-400'); btn.classList.add('text-slate-300'); }
window.updateGroupRecord(groupId, window.formatTime(t.elapsed));
}
window.toggleTimerMode = function(groupId) {
let t = activeTimers[groupId]; if (!t) return;
t.isRunning = false;
if (t.mode === 'stopwatch') { t.mode = 'timer'; t.elapsed = t.target; } else { t.mode = 'stopwatch'; t.elapsed = 0; }
const icon = document.getElementById(`mode-icon-${groupId}`); if (icon) icon.innerText = t.mode === 'stopwatch' ? '⏱️' : '⏳';
const display = document.getElementById(`time-display-${groupId}`);
if (display) { display.innerText = window.formatTime(t.elapsed); display.classList.remove('text-red-500', 'text-red-400'); }
const btn = document.getElementById(`btn-play-${groupId}`); if (btn) { btn.innerText = '▶'; btn.classList.remove('text-amber-400'); btn.classList.add('text-slate-300'); }
window.updateGroupRecord(groupId, window.formatTime(t.elapsed));
}
window.manualTimeEdit = function(groupId) {
let t = activeTimers[groupId]; if (!t || t.isRunning) return;
let promptMsg = t.mode === 'timer' ? "타이머 시간을 초 단위 또는 분:초로 입력하세요." : "스톱워치 기록을 초 단위 또는 분:초로 입력하세요.";
let defaultVal = t.mode === 'timer' ? "60" : window.formatTime(t.elapsed);
let input = prompt(promptMsg, defaultVal);
if (input !== null && input.trim() !== '') {
let ms = window.parseTime(input);
if (t.mode === 'timer') { t.target = ms; t.elapsed = ms; } else t.elapsed = ms;
const display = document.getElementById(`time-display-${groupId}`);
if (display) { display.innerText = window.formatTime(t.elapsed); display.classList.remove('text-red-500', 'text-red-400'); }
window.updateGroupRecord(groupId, window.formatTime(t.elapsed));
}
}

window.updateGroupDrawSelect = function() {
    const sel = document.getElementById('group-draw-target');
    if(!sel) return;
    let maxGroup = currentGroupMode === 'mixed2' ? 2 : (currentGroupMode === 'mixed3' ? 3 : 4);
    let html = '<option value="all">전체 모둠</option>';
    for(let i=1; i<=maxGroup; i++) {
        html += `<option value="${i}">${i}모둠</option>`;
    }
    sel.innerHTML = html;
}

function migrateData() {
for (const className in classData) {
if (!groupScores[className] || groupScores[className][1] !== undefined) {
const oldScores = groupScores[className] || {1:0, 2:0, 3:0, 4:0};
groupScores[className] = { mixed2: {1:0, 2:0}, mixed3: {1:0, 2:0, 3:0}, mixed4: oldScores, gender: {1:0, 2:0, 3:0, 4:0} };
}
if (!groupRecords[className]) groupRecords[className] = { mixed2: {}, mixed3: {}, mixed4: {}, gender: {} };
if (!classStamps[className]) classStamps[className] = Array(TOTAL_STAMP_CELLS).fill(false);
classData[className].forEach(s => {
if (s.handSense !== undefined || s.footSense !== undefined) {
let h = parseInt(s.handSense) || 0; let f = parseInt(s.footSense) || 0; let maxSense = Math.max(h, f);
s.ballSense = maxSense > 0 ? String(maxSense) : '0'; delete s.handSense; delete s.footSense;
}

        if (s.ballSense === '상') s.ballSense = '2';
        else if (s.ballSense === '중') s.ballSense = '1';
        else if (s.ballSense === '하' || s.ballSense === '-') s.ballSense = '0';
        else if (!s.ballSense) s.ballSense = '0';

if (s.isCaptain !== undefined) {
    s.captain_mixed4 = s.isCaptain; 
    delete s.isCaptain;
}
if (s.captain_mixed2 === undefined) s.captain_mixed2 = false;
if (s.captain_mixed3 === undefined) s.captain_mixed3 = false;
if (s.captain_mixed4 === undefined) s.captain_mixed4 = false;
if (s.captain_gender === undefined) s.captain_gender = false;

if (s.group !== undefined) { s.group_mixed4 = s.group; s.group_mixed3 = null; s.group_mixed2 = null; s.group_gender = null; delete s.group; }
if (s.group_mixed2 === undefined) s.group_mixed2 = null;
if (s.group_mixed3 === undefined) s.group_mixed3 = null;
if (s.group_mixed4 === undefined) s.group_mixed4 = null;
if (s.group_gender === undefined) s.group_gender = null;
if (s.running !== undefined) { delete s.running; } 
if (s.memo === undefined) s.memo = "";
if (s.dismissalInfo === undefined) s.dismissalInfo = "";
if (s.groupMemberDrawn === undefined) s.groupMemberDrawn = false; 

delete s.group_partner;
delete s.agility;
});
}
}

window.showModal = function(title, message, isConfirm = false, confirmCallback = null, confirmText = "확인") {
document.getElementById('modal-title').innerText = title; document.getElementById('modal-message').innerHTML = message;
const customModal = document.getElementById('custom-modal'); const confirmBtn = document.getElementById('modal-confirm-btn');
const cancelBtn = document.getElementById('modal-cancel-btn'); const alertOkBtn = document.getElementById('modal-alert-ok-btn');
confirmBtn.innerText = confirmText; confirmBtn.onclick = null; cancelBtn.onclick = null; alertOkBtn.onclick = null;

if (isConfirm) {
confirmBtn.classList.remove('hidden'); cancelBtn.classList.remove('hidden'); alertOkBtn.classList.add('hidden');
confirmBtn.onclick = () => { if (confirmCallback) confirmCallback(); window.closeModal(); };
cancelBtn.onclick = window.closeModal;
} else {
confirmBtn.classList.add('hidden'); cancelBtn.classList.add('hidden'); alertOkBtn.classList.remove('hidden');
alertOkBtn.onclick = window.closeModal;
}
customModal.classList.remove('hidden'); customModal.classList.add('flex');
}

window.closeModal = function() {
const customModal = document.getElementById('custom-modal'); customModal.classList.add('hidden'); customModal.classList.remove('flex');
}

window.addNewClass = function() {
const input = document.getElementById('new-class-input');
let newClassName = input.value.trim(); newClassName = normalizeClassName(newClassName);
if (!newClassName) { window.showModal("알림", "추가할 학급 이름을 입력해주세요."); return; }
if (classData[newClassName]) { window.showModal("알림", "이미 존재하는 학급입니다."); return; }

classData[newClassName] = [];
groupScores[newClassName] = { mixed2: {1:0, 2:0}, mixed3: {1:0, 2:0, 3:0}, mixed4: {1:0, 2:0, 3:0, 4:0}, gender: {1:0, 2:0, 3:0, 4:0} };
groupRecords[newClassName] = { mixed2: {}, mixed3: {}, mixed4: {}, gender: {} };
classStamps[newClassName] = Array(TOTAL_STAMP_CELLS).fill(false);

window.saveClassVisibility(newClassName, true);

saveData(); input.value = ""; window.renderClassSelect(); window.selectClass(newClassName);
window.showModal("학급 추가 완료", `<b class="text-blue-600">${newClassName}</b> 학급이 추가되었습니다.<br>학생 명단을 설정해주세요.`);
}

function normalizeClassName(name) {
    return name ? name.trim().replace(/\s+/g, '') : name;
}

window.deleteCurrentClass = function() {
if (!currentClass) return;
window.showModal("학급 완전 삭제", `<span class="font-bold text-red-500">${currentClass}</span> 학급을 목록에서 완전히 삭제하시겠습니까?<br><br>모든 학생 명단과 모둠 점수표가 삭제되며 되돌릴 수 없습니다.`, true, () => {
delete classData[currentClass]; delete groupScores[currentClass]; delete groupRecords[currentClass]; delete classStamps[currentClass];
saveData(); currentClass = ""; activeTimers = {}; window.selectedGroupStudent = null;
document.getElementById('current-class-display').innerHTML = "<span>⚙️ 설정 및 시작</span>";
document.getElementById('tab-navigation').classList.add('hidden'); document.getElementById('tab-navigation').classList.remove('flex');
['student-management', 'group-section', 'stamp-section'].forEach(id => document.getElementById(id).classList.add('hidden'));
window.renderClassSelect(); window.showModal("삭제 완료", "학급이 성공적으로 삭제되었습니다.");
}, "삭제");
}

window.deleteAllClasses = function() {
window.showModal("전체 학급 삭제", `<span class="font-bold text-red-600">등록된 모든 학급</span>의 데이터를 완전히 삭제하시겠습니까?<br><br><span class="text-red-500 font-bold">이 작업은 되돌릴 수 없으며</span> 모든 명단과 모둠 정보가 영구적으로 삭제됩니다.`, true, () => {
classData = {}; groupScores = {}; groupRecords = {}; classStamps = {}; activeTimers = {}; saveData(); currentClass = ""; window.selectedGroupStudent = null;
document.getElementById('current-class-display').innerHTML = "<span>⚙️ 설정 및 시작</span>";
document.getElementById('tab-navigation').classList.add('hidden'); document.getElementById('tab-navigation').classList.remove('flex');
['student-management', 'group-section', 'stamp-section'].forEach(id => document.getElementById(id).classList.add('hidden'));
window.renderClassSelect(); window.showModal("삭제 완료", "모든 학급 데이터가 안전하게 삭제되었습니다.");
}, "전체 삭제");
}

window.exportAllToExcel = function() {
let csvContent = "\uFEFF"; 
csvContent += "학급,번호,이름,성별,볼센스,참석상태,개인점수,혼성2모둠,혼성3모둠,혼성4모둠,동성모둠,그룹점수JSON,그룹기록JSON,체육부장,순발력(초),메모,하교지도\n";

if (Object.keys(classData).length === 0) {
csvContent += "=\"6-1\",1,홍길동,남,0,참석,0,,,,,{},{},N,0,,\n";
} else {
const sortedClasses = Object.keys(classData).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

for (const className of sortedClasses) {
const students = [...classData[className]].sort((a, b) => {
if (a.no !== b.no) return a.no - b.no; return (a.name || "").localeCompare(b.name || "");
});

if (!groupScores[className]) groupScores[className] = { mixed2: {1:0, 2:0}, mixed3: {1:0, 2:0, 3:0}, mixed4: {1:0, 2:0, 3:0, 4:0}, gender: {1:0, 2:0, 3:0, 4:0} };
if (!groupRecords[className]) groupRecords[className] = { mixed2: {}, mixed3: {}, mixed4: {}, gender: {} };
if (groupScores[className][1] !== undefined) { groupScores[className] = { mixed2: {1:0, 2:0}, mixed3: {1:0, 2:0, 3:0}, mixed4: groupScores[className], gender: {1:0, 2:0, 3:0, 4:0} }; }

const gScoresJSON = JSON.stringify(groupScores[className]).replace(/"/g, '""'); 
const gRecordsJSON = JSON.stringify(groupRecords[className]).replace(/"/g, '""'); 
const safeClassName = `="${className}"`; 

students.forEach((s, idx) => {
const attendance = s.attendance ? '참석' : '불참';
const bs = s.ballSense || '0'; const score = s.score || 0;
const g2 = s.group_mixed2 || ''; const g3 = s.group_mixed3 || ''; const g4 = s.group_mixed4 || s.group || ''; const gg = s.group_gender || '';
const isCapt = s.captain_mixed4 ? 'Y' : 'N';
const recSec = s.recordMs ? (s.recordMs / 1000).toFixed(2) : '';
const memo = (s.memo || "").replace(/"/g, '""');
const dismissal = (s.dismissalInfo || "").replace(/"/g, '""');
const jsonScoreCol = (idx === 0) ? `"${gScoresJSON}"` : '';
const jsonRecordCol = (idx === 0) ? `"${gRecordsJSON}"` : '';

csvContent += `${safeClassName},${s.no},${s.name},${s.gender},${bs},${attendance},${score},${g2},${g3},${g4},${gg},${jsonScoreCol},${jsonRecordCol},${isCapt},${recSec},"${memo}","${dismissal}"\n`;
});
}
}

const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
const today = new Date(); const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
link.download = `스마트학급관리_백업_${dateStr}.csv`;
link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function parseCSVLine(line) {
const result = []; let current = ''; let inQuotes = false;
for (let i = 0; i < line.length; i++) {
const char = line[i];
if (char === '"') { if (inQuotes && line[i+1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } } 
else if (char === ',' && !inQuotes) { result.push(current); current = ''; } 
else { current += char; }
}
result.push(current); return result;
}

window.handleAllCSVUpload = function(event) {
    const file = event.target.files[0]; if (!file) return;
    
    const processCSV = function(text) {
        text = text.replace(/^\uFEFF/, '').replace(/\r/g, '');
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) { window.showModal("오류", "파일 형식이 올바르지 않거나 데이터가 없습니다."); event.target.value = ''; return; }

        const header = parseCSVLine(lines[0]);
        if (!header[0].includes('학급')) { window.showModal("오류", "전체 데이터 백업 파일이 아닙니다."); event.target.value = ''; return; }

        window.showModal("전체 엑셀 불러오기", `파일 내용으로 모든 학급의 명단을 덮어쓰시겠습니까?<br><span class="font-bold text-red-500">주의: 현재 앱에 저장된 모든 데이터가 교체됩니다.</span>`, true, async () => {
            const newData = {}; const newGroupScores = {}; const newGroupRecords = {};
            let idxG2 = header.indexOf('혼성2모둠'); let idxG3 = header.indexOf('혼성3모둠'); let idxG4 = header.indexOf('혼성4모둠'); let idxGG = header.indexOf('동성모둠');
            let idxScores = header.indexOf('그룹점수JSON'); let idxRecords = header.indexOf('그룹기록JSON'); let idxCaptain = header.indexOf('체육부장'); 
            
            let idxPersonalRec = header.indexOf('순발력(초)');
            if(idxPersonalRec === -1) idxPersonalRec = header.indexOf('달리기(초)');
            if(idxPersonalRec === -1) idxPersonalRec = header.indexOf('순발력(개인기록)');
            if(idxPersonalRec === -1) idxPersonalRec = header.indexOf('개인기록');
            
            let idxBall = header.indexOf('볼센스'); 
            let idxMemo = header.indexOf('메모');
            let idxDismissal = header.indexOf('하교지도');

            for (let i = 1; i < lines.length; i++) {
                const parts = parseCSVLine(lines[i]); if (parts.length < 5) continue;

                let className = parts[0].trim();
                if (className.startsWith('="') && className.endsWith('"')) className = className.slice(2, -1);
                else if (className.startsWith('=')) className = className.substring(1);
                className = normalizeClassName(className);
                if (!className) continue; 

                if (!newData[className]) {
                    newData[className] = [];
                    newGroupScores[className] = { mixed2: {1:0, 2:0}, mixed3: {1:0, 2:0, 3:0}, mixed4: {1:0, 2:0, 3:0, 4:0}, gender: {1:0, 2:0, 3:0, 4:0} };
                    newGroupRecords[className] = { mixed2: {}, mixed3: {}, mixed4: {}, gender: {} };
                    if (!classStamps[className]) classStamps[className] = Array(TOTAL_STAMP_CELLS).fill(false);
                }

                const no = parseInt(parts[1].trim()); const name = parts[2].trim(); const gender = parts[3].trim();
                let bs = '0'; let attendance = true, score = 0, isCaptain = false, recMs = 0;
                let g2 = null, g3 = null, g4 = null, gg = null;
                let memo = "", dismissalInfo = "";

                if (idxBall > -1 && parts[idxBall]) {
                    let rawBs = parts[idxBall].trim();
                    if (rawBs === '3' || rawBs === '상') bs = '2';
                    else if (rawBs === '2' || rawBs === '중') bs = '1';
                    else bs = '0';
                }

                let attIdx = header.indexOf('참석상태');
                if(attIdx > -1 && parts[attIdx]) attendance = (parts[attIdx].trim() === '출석' || parts[attIdx].trim() === '참석');
                let scoreIdx = header.indexOf('개인점수');
                if(scoreIdx > -1 && parts[scoreIdx]) score = parseInt(parts[scoreIdx].trim()) || 0;

                if (idxG2 > -1 && parts[idxG2]) g2 = parseInt(parts[idxG2].trim()) || null;
                if (idxG3 > -1 && parts[idxG3]) g3 = parseInt(parts[idxG3].trim()) || null;
                if (idxG4 > -1 && parts[idxG4]) g4 = parseInt(parts[idxG4].trim()) || null;
                if (idxGG > -1 && parts[idxGG]) gg = parseInt(parts[idxGG].trim()) || null;
                if (idxCaptain > -1 && parts[idxCaptain]) isCaptain = (parts[idxCaptain].trim() === 'Y');

                if (idxPersonalRec > -1 && parts[idxPersonalRec]) {
                    const parsed = parseFloat(parts[idxPersonalRec].trim());
                    if(!isNaN(parsed)) recMs = Math.floor(parsed * 1000);
                }

                if (idxMemo > -1 && parts[idxMemo]) memo = parts[idxMemo].trim();
                if (idxDismissal > -1 && parts[idxDismissal]) dismissalInfo = parts[idxDismissal].trim();

                if (idxScores > -1 && parts[idxScores]) { try { newGroupScores[className] = JSON.parse(parts[idxScores].trim()); } catch(e){} }
                if (idxRecords > -1 && parts[idxRecords]) { try { newGroupRecords[className] = JSON.parse(parts[idxRecords].trim()); } catch(e){} }

                newData[className].push({ no: no || (newData[className].length + 1), name: name, gender: gender, ballSense: bs, attendance: attendance, score: score, recordMs: recMs, memo: memo, dismissalInfo: dismissalInfo, drawn: false, groupMemberDrawn: false, captain_mixed2: false, captain_mixed3: false, captain_mixed4: isCaptain, captain_gender: false, group_mixed2: g2, group_mixed3: g3, group_mixed4: g4, group_gender: gg });
            }

            if (Object.keys(newData).length > 0) {
                classData = newData; groupScores = newGroupScores; groupRecords = newGroupRecords;
                activeTimers = {}; window.selectedGroupStudent = null;
                window.renderClassSelect();
                if (currentClass && !classData[currentClass]) {
                    currentClass = ""; document.getElementById('current-class-display').innerHTML = "<span>⚙️ 설정 및 시작</span>";
                    document.getElementById('tab-navigation').classList.add('hidden'); document.getElementById('tab-navigation').classList.remove('flex');
                    ['student-management', 'group-section', 'stamp-section'].forEach(id => document.getElementById(id).classList.add('hidden'));
                }

                if (userId && db) {
                    isDebouncing = true;
                    try {
                        const docRef = doc(db, 'artifacts', 'running-measurement-app', 'sharedRooms', 'dongsan-school-db');
                        await setDoc(docRef, { data: classData, scores: groupScores, records: groupRecords, stamps: classStamps, stampImage: globalStampImage }, { merge: true });
                    } catch (error) { 
                        console.error("즉시 저장 실패:", error); 
                        window.showModal("저장 실패", "네트워크 또는 용량 문제로 클라우드 저장에 실패했습니다.");
                    } 
                    finally { isDebouncing = false; }
                }

                if (currentClass) { window.renderStudentList(); window.renderGroups(); window.renderStampBoard(); }
                window.showModal("완료", "모든 학급의 데이터를 성공적으로 복구했습니다.");
            } else { window.showModal("오류", "올바른 데이터를 찾을 수 없습니다."); }
            document.getElementById('csv-all-file-input').value = ''; 
        }, "전체 복구하기");
    };

    const reader = new FileReader();
    reader.onload = function(e) {
        let text = e.target.result;
        if (text.includes('')) {
            const eucReader = new FileReader();
            eucReader.onload = function(e2) {
                processCSV(e2.target.result);
            };
            eucReader.readAsText(file, "euc-kr");
        } else {
            processCSV(text);
        }
    };
    reader.readAsText(file, "utf-8");
}

window.selectClass = function(className) {
currentClass = className; activeTimers = {}; window.selectedGroupStudent = null;
const displayBtn = document.getElementById('current-class-display');
if (displayBtn) displayBtn.innerHTML = `<span>⚙️ ${className}</span>`;

document.getElementById('tab-navigation').classList.remove('hidden'); document.getElementById('tab-navigation').classList.add('flex');
window.showTab(currentTab); window.renderClassSelect(); 
window.setGroupMode(currentGroupMode); 
window.updateGroupDrawSelect(); 
window.renderStudentList(); window.renderGroups(); window.renderStampBoard();
}

window.showTab = function(tabName) {
currentTab = tabName; window.selectedGroupStudent = null;
['student-management', 'group-section', 'stamp-section'].forEach(id => document.getElementById(id).classList.add('hidden'));

['student', 'group', 'stamp'].forEach(t => {
const btn = document.getElementById(`tab-${t}`);
if(btn) btn.className = "flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 rounded-xl font-bold text-[10px] sm:text-sm transition text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm whitespace-nowrap";
});

const mainContainer = document.getElementById('main-container');
const headerContainer = document.getElementById('header-inner-container');

mainContainer.classList.add('max-w-4xl'); mainContainer.classList.remove('max-w-[98%]');
if(headerContainer) { headerContainer.classList.add('max-w-4xl'); headerContainer.classList.remove('max-w-[98%]'); }

if (tabName === 'student') {
document.getElementById('student-management').classList.remove('hidden');
document.getElementById('tab-student').className = "flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 rounded-xl font-bold text-[10px] sm:text-sm transition text-white bg-blue-600 shadow-md border border-blue-600 transform scale-[1.02] sm:scale-105 z-10 whitespace-nowrap";
} else if (tabName === 'group') {
document.getElementById('group-section').classList.remove('hidden');
document.getElementById('tab-group').className = "flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 rounded-xl font-bold text-[10px] sm:text-sm transition text-white bg-indigo-600 shadow-md border border-indigo-600 transform scale-[1.02] sm:scale-105 z-10 whitespace-nowrap";
window.renderGroups(); 
} else if (tabName === 'stamp') {
document.getElementById('stamp-section').classList.remove('hidden');
document.getElementById('tab-stamp').className = "flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 rounded-xl font-bold text-[10px] sm:text-sm transition text-white bg-green-600 shadow-md border border-green-600 transform scale-[1.02] sm:scale-105 z-10 whitespace-nowrap";
window.renderStampBoard();
}
}

window.cycleInputAbility = function(type) {
const hiddenInput = document.getElementById(`add-${type}`); 
const btn = document.getElementById(`btn-add-${type}`);
let currentIdx = abilitiesCycle.indexOf(hiddenInput.value); if(currentIdx === -1) currentIdx = 0;
const nextIdx = (currentIdx + 1) % abilitiesCycle.length; 
const nextVal = abilitiesCycle[nextIdx];
hiddenInput.value = nextVal;

let emoji = type === 'ballSense' ? '⚽' : '⚡';
if (nextVal === '0') { btn.innerHTML = `<span class="text-slate-400 text-xs">${emoji}(-)</span>`; } 
else { btn.innerHTML = window.getAbilityHTML(type, nextVal); }

btn.className = "w-[42px] sm:w-[60px] h-[36px] border rounded-lg shadow-sm transition flex items-center justify-center focus:outline-blue-500 ";
if(nextVal === '2') btn.className += "bg-emerald-50 border-emerald-200 hover:bg-emerald-100";
else if(nextVal === '1') btn.className += "bg-stone-50 border-stone-200 hover:bg-stone-100";
else btn.className += "bg-white border-slate-200 hover:bg-slate-50";
}

window.deleteStudent = function(studentNo) {
const student = classData[currentClass].find(s => s.no == studentNo);
if (!student) return;
window.showModal("학생 정보 삭제", `<span class="font-bold text-red-500">${student.no}번 ${student.name}</span> 학생의 정보를 정말로 삭제하시겠습니까?`, true, () => {
const idx = classData[currentClass].findIndex(s => s.no == studentNo);
if (idx > -1) { classData[currentClass].splice(idx, 1); saveData(); window.renderStudentList(); }
}, "삭제");
}

window.toggleAttendance = function(studentNo) {
const student = classData[currentClass].find(s => s.no == studentNo);
if (student) { student.attendance = !student.attendance; saveData(); window.renderStudentList(); window.renderGroups(); }
}

window.setAllAttendance = function(isAbsent) {
    if (!currentClass || !classData[currentClass]) return;
    const actionText = isAbsent ? "불참(결석)" : "참석";
    
    if (confirm(`현재 학급의 모든 학생을 '${actionText}' 처리하시겠습니까?`)) {
        classData[currentClass].forEach(student => {
            student.attendance = !isAbsent; 
        });
        saveData(); 
        if (typeof window.renderStudentList === 'function') window.renderStudentList();
        if (typeof window.renderGroups === 'function') window.renderGroups();
    }
};

window.toggleCaptain = function(studentNo) {
const student = classData[currentClass].find(s => s.no == studentNo);
if (student && student.attendance) { 
    const captainProp = 'captain_' + currentGroupMode;
    student[captainProp] = !student[captainProp]; 
    saveData(); 
    window.renderGroups(); 
}
}

window.toggleSelection = function(studentNo) {
if (!currentClass || !classData[currentClass]) return;
const student = classData[currentClass].find(s => s.no == studentNo);
if (student) {
student.selected = !student.selected;
saveData();
window.renderStudentList();
}
}

window.cycleStudentAbility = function(studentNo, type) {
const student = classData[currentClass].find(s => s.no == studentNo);
if (student && student.attendance) {
let currentIdx = abilitiesCycle.indexOf(student[type] || '0'); if (currentIdx === -1) currentIdx = 0;
const nextIdx = (currentIdx + 1) % abilitiesCycle.length; student[type] = abilitiesCycle[nextIdx];
saveData(); window.renderStudentList(); window.renderGroups();
}
}

window.cycleStudentGroup = function(studentNo) {
const student = classData[currentClass].find(s => s.no == studentNo);
if (student && student.attendance) {
const cycle = getGroupsCycle(); let currentVal = student[`group_${currentGroupMode}`];
let currentIdx = cycle.indexOf(currentVal); if (currentIdx === -1) currentIdx = 0;
const nextIdx = (currentIdx + 1) % cycle.length; student[`group_${currentGroupMode}`] = cycle[nextIdx];
saveData(); window.renderStudentList(); window.renderGroups();
}
}

window.toggleSort = function(field) {
if (sortState.field === field) sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
else { sortState.field = field; sortState.direction = 'asc'; }
window.renderStudentList();
}

function updateSortIcons() {
['no', 'name', 'recordMs', 'gender', 'ballSense', 'group'].forEach(f => {
const icon = document.getElementById(`sort-${f}-icon`);
if (icon) {
if (sortState.field === f) { icon.innerText = sortState.direction === 'asc' ? '▲' : '▼'; icon.classList.add('text-blue-500'); } 
else { icon.innerText = '↕'; icon.classList.remove('text-blue-500'); }
}
});
}

window.renderStudentList = function() {
const tbody = document.getElementById('student-list-body'); if (!tbody) return;
tbody.innerHTML = "";
const allStudents = [...(classData[currentClass] || [])];

const presentStudents = allStudents.filter(s => s.attendance);
const presentCount = presentStudents.length; const maleCount = presentStudents.filter(s => s.gender === '남').length; const femaleCount = presentStudents.filter(s => s.gender === '여').length;

let groupCounts = "";
const g1 = presentStudents.filter(s => s[`group_${currentGroupMode}`] === 1).length; const g2 = presentStudents.filter(s => s[`group_${currentGroupMode}`] === 2).length;
const g3 = presentStudents.filter(s => s[`group_${currentGroupMode}`] === 3).length; const g4 = presentStudents.filter(s => s[`group_${currentGroupMode}`] === 4).length;
if(currentGroupMode === 'mixed2') groupCounts = `1조 ${g1} · 2조 ${g2}`; else if(currentGroupMode === 'mixed3') groupCounts = `1조 ${g1} · 2조 ${g2} · 3조 ${g3}`; else groupCounts = `1조 ${g1} · 2조 ${g2} · 3조 ${g3} · 4조 ${g4}`;
const unassigned = presentStudents.filter(s => !s[`group_${currentGroupMode}`]).length;

const summaryEl = document.getElementById('student-summary');
if (summaryEl) {
summaryEl.innerHTML = `
                   <div class="text-[10px] sm:text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-slate-200 shadow-sm w-fit mb-1">
                       참석 <span class="text-blue-600">${presentCount}</span>명 <span class="text-slate-400 text-[9px] sm:text-[10px] ml-1 font-normal">(전체 ${allStudents.length}명)</span> <span class="text-slate-300 mx-1">|</span> 남 <span class="text-blue-500">${maleCount}</span> <span class="text-slate-300 mx-1">·</span> 여 <span class="text-pink-500">${femaleCount}</span>
                   </div>
                   <div class="flex flex-wrap justify-end gap-1.5 w-full">
                       <div class="text-[9px] sm:text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md border border-indigo-100 shadow-sm whitespace-nowrap">🎲 모둠: ${groupCounts} · 미배정 ${unassigned}</div>
                   </div>
               `;
}

allStudents.sort((a, b) => {
let valA = a[sortState.field]; let valB = b[sortState.field];
if (sortState.field === 'group') { valA = a[`group_${currentGroupMode}`] || 999; valB = b[`group_${currentGroupMode}`] || 999; }
if (sortState.field === 'recordMs') { 
valA = a.recordMs || 0; valB = b.recordMs || 0;
if (sortState.direction === 'asc') { if (valA === 0) valA = Infinity; if (valB === 0) valB = Infinity; }
}
if (valA < valB) return sortState.direction === 'asc' ? -1 : 1; if (valA > valB) return sortState.direction === 'asc' ? 1 : -1; return 0;
});

if (typeof updateSortIcons === 'function') updateSortIcons();

const isRegular = isRegularClass(currentClass);
const dismissalHeader = document.getElementById('dismissal-header-placeholder');
if (dismissalHeader) {
    if (!isRegular) {
        dismissalHeader.classList.remove('hidden');
        dismissalHeader.innerText = "하교지도";
        dismissalHeader.className = "bg-slate-50 border-b border-slate-200 px-1 py-1.5 sm:p-2 text-center text-slate-500 font-semibold whitespace-nowrap text-[9px] sm:text-xs w-16 sm:w-24";
    } else {
        dismissalHeader.classList.add('hidden');
        dismissalHeader.className = "hidden";
    }
}

allStudents.forEach((s) => {
let rowBgClass = "hover:bg-slate-50"; const sGroup = s[`group_${currentGroupMode}`];

if (s.attendance) {
if (sortState.field === 'gender') rowBgClass = s.gender === '남' ? 'bg-blue-50/60 hover:bg-blue-100/60' : 'bg-pink-50/60 hover:bg-pink-100/60';
else if (sortState.field === 'ballSense') {
const val = s[sortState.field];
if (val === '2') rowBgClass = 'bg-emerald-50/60 hover:bg-emerald-100/60'; else if (val === '1') rowBgClass = 'bg-stone-50/60 hover:bg-stone-100/60';
} else if (sortState.field === 'group' && sGroup) {
if (sGroup % 4 === 1) rowBgClass = 'bg-indigo-50/60 hover:bg-indigo-100/60'; else if (sGroup % 4 === 2) rowBgClass = 'bg-fuchsia-50/60 hover:bg-fuchsia-100/60';
else if (sGroup % 4 === 3) rowBgClass = 'bg-cyan-50/60 hover:bg-cyan-100/60'; else if (sGroup % 4 === 0) rowBgClass = 'bg-amber-50/60 hover:bg-amber-100/60';
}
} else { rowBgClass = "bg-red-50/40 text-slate-400 italic"; }

if (s.selected) {
rowBgClass = "bg-yellow-100 hover:bg-yellow-200 shadow-[inset_0_0_0_2px_#fde047] z-10 relative";
}

const tr = document.createElement('tr'); tr.className = "border-b border-slate-100 student-row transition " + rowBgClass;

const getAbilityColorClass = (val) => {
if (!s.attendance) return 'bg-slate-100 opacity-50 cursor-not-allowed border-transparent';
if (val === '2') return 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 shadow-sm';
if (val === '1') return 'bg-stone-50 border-stone-200 hover:bg-stone-100 shadow-sm'; return 'bg-white hover:bg-slate-100 border border-slate-200 shadow-sm';
};

const bsColor = getAbilityColorClass(s.ballSense); 

let groupColorClass = 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200';
if (!s.attendance) groupColorClass = 'bg-slate-200 text-slate-400 cursor-not-allowed';
else if (sGroup) {
if (sGroup % 4 === 1) groupColorClass = 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm'; else if (sGroup % 4 === 2) groupColorClass = 'bg-fuchsia-500 text-white hover:bg-fuchsia-600 shadow-sm';
else if (sGroup % 4 === 3) groupColorClass = 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-sm'; else if (sGroup % 4 === 0) groupColorClass = 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm';
}

const drawnBadge = s.drawn ? '<span class="text-[9px] bg-purple-500 text-white px-1 py-0.5 rounded ml-1 font-bold align-middle">뽑힘</span>' : '';

let dismissalCell = '';
if (!isRegular) {
    dismissalCell = `
        <td class="px-0.5 py-1 sm:p-2 text-center">
            <input type="text" value="${s.dismissalInfo || ''}" onblur="window.updateDismissal(${s.no}, this.value)" placeholder="하교방법 입력" class="w-full min-w-[50px] text-[10px] sm:text-xs border border-slate-200 rounded p-1 focus:outline-blue-500 bg-white" ${!s.attendance ? 'disabled' : ''}>
        </td>
    `;
}

const memoHighlight = s.memo ? 'bg-yellow-300 rounded-full ring-2 ring-yellow-400 shadow-sm text-blue-800 transform scale-110' : 'text-slate-300 hover:text-blue-400';

tr.innerHTML = `
                   <td class="px-0 py-1 sm:p-2 text-center w-12 sm:w-16">
                       <button onclick="window.toggleAttendance(${s.no})" class="w-full h-full font-mono font-bold text-[12px] sm:text-[14px] ${s.attendance ? 'text-slate-600 hover:text-blue-500' : 'text-slate-400 hover:text-red-500'} transition" title="번호 터치: 참석/불참 토글">
                           ${s.no}
                       </button>
                   </td>
                   
                   <td class="px-0.5 py-1 sm:p-2 font-black text-center whitespace-normal break-words leading-tight min-w-[36px]">
                       <div class="flex items-center justify-center gap-1.5">
                           <button onclick="window.toggleSelection(${s.no})" class="text-[11px] sm:text-[14px] ${s.attendance ? 'text-slate-800' : 'text-slate-400 line-through'} px-1 py-0.5 rounded transition ${s.selected ? 'bg-yellow-400 text-yellow-900 shadow-sm' : 'hover:bg-slate-200'}" title="이름 터치: 학생 하이라이트 선택">
                               ${s.name}${drawnBadge}
                           </button>
                           <button onclick="event.stopPropagation(); window.openMemoModal(${s.no}, '${s.name}')" class="text-xs sm:text-sm transition flex items-center justify-center w-6 h-6 ${memoHighlight}" title="메모 쓰기">
                               📝
                           </button>
                       </div>
                   </td>
                   
                   ${dismissalCell}

                   <td class="px-0 py-1 sm:p-2 text-center w-5 sm:w-8">
                       <div class="flex flex-col items-center justify-center leading-none mt-1">
                           <span class="text-[9px] sm:text-[11px] font-bold px-1 py-0.5 rounded ${s.gender === '남' ? (s.attendance ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400') : (s.attendance ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-400')}">${s.gender}</span>
                       </div>
                   </td>
                   
                   <td class="px-0 py-1 sm:p-2 text-center w-5 sm:w-8">
                       <div class="flex flex-col items-center justify-center gap-0.5">
                           <button onclick="window.cycleStudentGroup(${s.no})" class="w-5 h-5 sm:w-8 sm:h-8 text-[10px] sm:text-[13px] font-black rounded sm:rounded-lg transition outline-none ${groupColorClass} mx-auto" ${!s.attendance ? 'disabled' : ''}>${sGroup ? sGroup : '-'}</button>
                       </div>
                   </td>
                   
                   <td class="px-0 py-1 sm:p-2 text-center w-[26px] sm:w-10">
                       <div class="flex flex-col items-center justify-center gap-0.5">
                           <button onclick="window.cycleStudentAbility(${s.no}, 'ballSense')" class="w-[24px] h-[22px] sm:w-9 sm:h-9 mx-auto rounded transition outline-none ${bsColor} flex items-center justify-center" ${!s.attendance ? 'disabled' : ''}>
                               ${window.getAbilityHTML('ballSense', s.ballSense)}
                           </button>
                       </div>
                   </td>

                   <td class="px-0 py-1 sm:p-2 text-center w-[54px] sm:w-auto">
                       <button onclick="window.manualStudentTimeEdit(${s.no})" class="bg-white border border-slate-200 rounded px-2 py-1 shadow-sm text-[10px] sm:text-[12px] font-mono font-bold hover:bg-blue-50 hover:text-blue-600 transition outline-none ${s.recordMs > 0 ? 'text-slate-700' : 'text-slate-400'}">
                           ${s.recordMs > 0 ? window.formatTime(s.recordMs) : '기록없음'}
                       </button>
                   </td>

                   <td class="px-0 py-1 sm:p-2 text-center w-4 sm:w-8"><button onclick="window.deleteStudent(${s.no})" class="delete-btn text-slate-300 hover:text-red-500 transition p-0.5 sm:p-1"><svg class="h-3.5 w-3.5 sm:h-5 sm:w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button></td>
               `;
tbody.appendChild(tr);
});

if(window.updateDrawStatus) window.updateDrawStatus();
}

window.setGroupMode = function(mode) {
currentGroupMode = mode; activeTimers = {}; window.selectedGroupStudent = null;
['mixed2', 'mixed3', 'mixed4', 'gender'].forEach(m => {
const btn = document.getElementById(`btn-mode-${m}`);
if (btn) {
    if (m === mode) {
        // 선택된 모드 시각적 강조 효과 적용
        btn.className = "flex-1 sm:flex-none px-4 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm transition bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-300 ring-offset-1 transform scale-105 whitespace-nowrap z-10";
    } else {
        btn.className = "flex-1 sm:flex-none px-3 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition text-slate-500 bg-transparent hover:bg-slate-200 hover:text-slate-800 whitespace-nowrap border border-transparent hover:border-slate-200";
    }
}
});

const descEl = document.getElementById('group-mode-desc'); const btnText = document.getElementById('generate-btn-text');

if (mode === 'mixed2') { descEl.innerHTML = "<b>혼성 2팀</b> 편성 결과입니다."; btnText.innerText = "혼성 2팀 편성하기"; } 
else if (mode === 'mixed3') { descEl.innerHTML = "<b>혼성 3팀</b> 편성 결과입니다."; btnText.innerText = "혼성 3팀 편성하기"; } 
else if (mode === 'mixed4') { descEl.innerHTML = "<b>혼성 4팀</b> 편성 결과입니다."; btnText.innerText = "혼성 4팀 편성하기"; } 
else if (mode === 'gender') { descEl.innerHTML = "<b>동성 4팀 (남2/여2)</b> 편성 결과입니다."; btnText.innerText = "동성 4팀 편성하기"; }

window.updateGroupDrawSelect(); 
window.renderStudentList(); window.renderGroups();
}

window.resetCurrentGroup = function() {
if (!currentClass || !classData[currentClass]) { window.showModal("알림", "학급을 먼저 선택해주세요."); return; }
let modeName = currentGroupMode === 'mixed2' ? '혼성 2팀' : (currentGroupMode === 'mixed3' ? '혼성 3팀' : (currentGroupMode === 'mixed4' ? '혼성 4팀' : '동성 4팀'));

window.showModal("모둠 초기화", `정말 현재 학급의 <b>${modeName}</b> 편성을 모두 초기화하시겠습니까?<br><span class="text-red-500 text-xs">※ 모둠 기록이 초기화되며 모든 학생이 미편성 영역으로 이동합니다.</span>`, true, () => {
classData[currentClass].forEach(student => { 
    student[`group_${currentGroupMode}`] = null; 
    student[`captain_${currentGroupMode}`] = false;
});
if (groupScores[currentClass] && groupScores[currentClass][currentGroupMode]) groupScores[currentClass][currentGroupMode] = {};
if (groupRecords[currentClass] && groupRecords[currentClass][currentGroupMode]) groupRecords[currentClass][currentGroupMode] = {};
activeTimers = {}; window.selectedGroupStudent = null; saveData(); window.renderStudentList(); window.renderGroups();
window.showModal("완료", `${modeName} 편성이 초기화되었습니다.`);
});
}

// 모둠 편성 알고리즘 로직
window.generateCurrentGroup = function() {
window.selectedGroupStudent = null;
let title = "", callback = null;
if (currentGroupMode === 'mixed2') { title = "혼성 2팀 편성"; callback = () => window.generateMixedGroups(2); }
else if (currentGroupMode === 'mixed3') { title = "혼성 3팀 편성"; callback = () => window.generateMixedGroups(3); }
else if (currentGroupMode === 'mixed4') { title = "혼성 4팀 편성"; callback = () => window.generateMixedGroups(4); }
else if (currentGroupMode === 'gender') { title = "동성 4팀 편성"; callback = () => window.generateGenderGroups(); }

    window.showModal(title, `새롭게 ${title}을(를) 진행하시겠습니까?<br><br><span class='text-red-500 font-bold'>현재 모드의 기존 편성 결과와 점수가 초기화됩니다.</span><br><span class='text-slate-500 text-xs'>(다른 모드의 결과는 그대로 유지됩니다.)</span>`, true, () => {
        document.getElementById('group-shuffle-overlay').classList.remove('hidden');
        document.getElementById('group-shuffle-overlay').classList.add('flex');
        window.playCardShuffleSound();

        setTimeout(() => {
            document.getElementById('group-shuffle-overlay').classList.add('hidden');
            document.getElementById('group-shuffle-overlay').classList.remove('flex');
            
            if (groupRecords[currentClass] && groupRecords[currentClass][currentGroupMode]) {
                groupRecords[currentClass][currentGroupMode].drawnGroups = [];
            }
            classData[currentClass].forEach(s => {
                s.groupMemberDrawn = false;
                s[`captain_${currentGroupMode}`] = false;
            });

            callback(); 
            window.playCasinoJackpot(); 
            window.fireConfetti(); 
        }, 2200);
    }, "새로 편성하기");
}

window.updateGroupScore = function(groupId, change) {
if (change > 0) window.playCoinSound();
else window.playBumpSound();

if (!groupScores[currentClass]) groupScores[currentClass] = {};
if (!groupScores[currentClass][currentGroupMode]) groupScores[currentClass][currentGroupMode] = {};
groupScores[currentClass][currentGroupMode][groupId] = (groupScores[currentClass][currentGroupMode][groupId] || 0) + change;
saveData(); window.renderGroups();
}

window.updateGroupRecord = function(groupId, value) {
if (!groupRecords[currentClass]) groupRecords[currentClass] = {};
if (!groupRecords[currentClass][currentGroupMode]) groupRecords[currentClass][currentGroupMode] = {};
groupRecords[currentClass][currentGroupMode][groupId] = value;
saveData();
}

window.generateMixedGroups = function(numGroups) {
const students = classData[currentClass];
if (!students || students.length < numGroups) { window.showModal("인원 부족", `학생 정보가 부족합니다. 최소 ${numGroups}명 이상 등록되어야 합니다.`); return; }

const shuffle = (array) => { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; };
const presentStudents = students.filter(s => s.attendance); shuffle(presentStudents);
students.forEach(s => s[`group_${currentGroupMode}`] = null);

const groups = Array.from({ length: numGroups }, (_, i) => ({ id: i + 1, total: 0, male: 0, female: 0, totalScore: 0 }));
let validRecords = presentStudents.filter(s => s.recordMs > 0).map(s => s.recordMs).sort((a,b) => a - b);

const assignToOptimalGroup = (student) => {
let stScore = getStudentPower(student, validRecords);
const isMale = student.gender === '남';

let minTotal = Math.min(...groups.map(g => g.total));
let candidates = groups.filter(g => g.total === minTotal);

let minGender = Math.min(...candidates.map(g => isMale ? g.male : g.female));
let genderCandidates = candidates.filter(g => (isMale ? g.male : g.female) === minGender);
if (genderCandidates.length > 0) candidates = genderCandidates;

let minTotalScore = Math.min(...candidates.map(g => g.totalScore));
let scoreCandidates = candidates.filter(g => g.totalScore === minTotalScore);
if (scoreCandidates.length > 0) candidates = scoreCandidates;

const targetGroup = candidates[Math.floor(Math.random() * candidates.length)];
            student[`group_${currentGroupMode}`] = targetGroup.id;
            targetGroup.total++;
            if (isMale) targetGroup.male++; else targetGroup.female++;
            targetGroup.totalScore += stScore;
        };

        const sortedStudents = [...presentStudents].sort((a, b) => getStudentPower(b, validRecords) - getStudentPower(a, validRecords));
        sortedStudents.forEach(s => assignToOptimalGroup(s));

        if (!groupScores[currentClass]) groupScores[currentClass] = {};
        groupScores[currentClass][currentGroupMode] = {};
        for(let i=1; i<=numGroups; i++) groupScores[currentClass][currentGroupMode][i] = 0;
        
        if (!groupRecords[currentClass]) groupRecords[currentClass] = {};
        groupRecords[currentClass][currentGroupMode] = {};

        saveData(); 
        window.renderStudentList(); 
        window.renderGroups();
    }

    window.generateGenderGroups = function() {
        const students = classData[currentClass];
        if (!students || students.length < 4) { window.showModal("인원 부족", "학생 정보가 부족합니다. 최소 4명 이상 등록되어야 합니다."); return; }

        const shuffle = (array) => { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; };
        const presentStudents = students.filter(s => s.attendance); shuffle(presentStudents);
        students.forEach(s => s.group_gender = null);

        let validRecords = presentStudents.filter(s => s.recordMs > 0).map(s => s.recordMs).sort((a,b) => a - b);
        const boys = presentStudents.filter(s => s.gender === '남').sort((a, b) => getStudentPower(b, validRecords) - getStudentPower(a, validRecords));
        const girls = presentStudents.filter(s => s.gender === '여').sort((a, b) => getStudentPower(b, validRecords) - getStudentPower(a, validRecords));

        const assignToGroups = (studentList, groupA, groupB) => {
            let scoreA = 0, scoreB = 0;
            let countA = 0, countB = 0;
            studentList.forEach(student => {
                let stScore = getStudentPower(student, validRecords);
                let targetGroup;
                if (countA < countB) targetGroup = groupA;
                else if (countB < countA) targetGroup = groupB;
                else if (scoreA <= scoreB) targetGroup = groupA;
                else targetGroup = groupB;

                student.group_gender = targetGroup;
                if (targetGroup === groupA) { scoreA += stScore; countA++; }
                else { scoreB += stScore; countB++; }
            });
        };

        assignToGroups(boys, 1, 2);
        assignToGroups(girls, 3, 4);

        if (!groupScores[currentClass]) groupScores[currentClass] = {};
        groupScores[currentClass]['gender'] = {1:0, 2:0, 3:0, 4:0};
        
        if (!groupRecords[currentClass]) groupRecords[currentClass] = {};
        groupRecords[currentClass]['gender'] = {};

        saveData(); 
        window.renderStudentList(); 
        window.renderGroups();
    }

    // 모둠별 열(Column) 및 미편성 영역 렌더링
    window.renderGroups = function() {
        const container = document.getElementById('group-result'); if (!container) return;
        if (!currentClass || !classData[currentClass]) { container.innerHTML = ''; return; }
        
        let numGroups = currentGroupMode === 'mixed2' ? 2 : (currentGroupMode === 'mixed3' ? 3 : 4);
        let html = '';
        
        container.className = 'grid gap-1 sm:gap-4 p-1 w-full';
        if (numGroups === 2) container.classList.add('grid-cols-2');
        else if (numGroups === 3) container.classList.add('grid-cols-3');
        else container.classList.add('grid-cols-4');
        
        const students = classData[currentClass];
        const presentStudents = students.filter(s => s.attendance);
        let validRecords = presentStudents.filter(s => s.recordMs > 0).map(s => s.recordMs).sort((a,b) => a - b);

        const colors = [
            { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', header: 'bg-indigo-100', btn: 'bg-indigo-500 hover:bg-indigo-600', ring: 'ring-indigo-300' },
            { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-800', header: 'bg-fuchsia-100', btn: 'bg-fuchsia-500 hover:bg-fuchsia-600', ring: 'ring-fuchsia-300' },
            { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-800', header: 'bg-cyan-100', btn: 'bg-cyan-500 hover:bg-cyan-600', ring: 'ring-cyan-300' },
            { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', header: 'bg-amber-100', btn: 'bg-amber-500 hover:bg-amber-600', ring: 'ring-amber-300' }
        ];

        let drawnGroupIds = [];
        if (groupRecords[currentClass] && groupRecords[currentClass][currentGroupMode] && groupRecords[currentClass][currentGroupMode].drawnGroups) {
            drawnGroupIds = groupRecords[currentClass][currentGroupMode].drawnGroups;
        }

        for (let i = 1; i <= numGroups; i++) {
            const groupStudents = students.filter(s => s[`group_${currentGroupMode}`] === i && s.attendance);
            groupStudents.sort((a, b) => a.no - b.no);
            
            const color = colors[(i-1) % colors.length];
            let gScore = 0;
            if (groupScores[currentClass] && groupScores[currentClass][currentGroupMode]) {
                gScore = groupScores[currentClass][currentGroupMode][i] || 0;
            }
            
            if (!activeTimers[i]) {
                activeTimers[i] = { mode: 'stopwatch', isRunning: false, elapsed: 0, target: 60000, startTime: 0 };
            }
            let t = activeTimers[i];
            
            let storedRecord = "";
            if (groupRecords[currentClass] && groupRecords[currentClass][currentGroupMode] && groupRecords[currentClass][currentGroupMode][i]) {
                storedRecord = groupRecords[currentClass][currentGroupMode][i];
            }
            
            let timerDisplayVal = storedRecord || window.formatTime(t.elapsed);
            let timeColorClass = (t.mode === 'timer' && t.elapsed === 0 && !t.isRunning && storedRecord) ? 'text-red-500' : 'text-slate-700';
            
            const isGroupDrawn = drawnGroupIds.includes(i);
            const groupDrawnStyle = isGroupDrawn ? `ring-4 ${color.ring} transform scale-[1.02] shadow-lg` : '';

            html += `
            <div class="${color.bg} border sm:border-2 ${color.border} rounded-xl overflow-hidden flex flex-col transition-all duration-300 ${groupDrawnStyle} group-area"
                 data-group-id="${i}" 
                 ondragover="window.handleDragOverGroup(event)" 
                 ondragleave="window.handleDragLeaveGroup(event)"
                 ondrop="window.handleDropOnGroup(event, ${i})" 
                 onclick="window.handleGroupAreaClick(${i})">
                
                <div class="${color.header} px-1 py-1 sm:px-4 sm:py-3 flex flex-col sm:flex-row justify-between items-center border-b ${color.border}">
                    <h3 class="font-black text-sm sm:text-xl ${color.text} flex items-center gap-1 text-center">
                        <span>${i}모둠</span>
                    </h3>
                    <div class="flex items-center gap-1 mt-1 sm:mt-0">
                        <div class="flex items-center bg-white rounded shadow-sm overflow-hidden scale-75 sm:scale-100 transform origin-center">
                            <button onclick="window.updateGroupScore(${i}, -1)" class="w-6 h-6 sm:w-10 sm:h-10 text-sm sm:text-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition">-</button>
                            <span class="w-6 sm:w-12 text-center font-black text-sm sm:text-xl ${color.text}">${gScore}</span>
                            <button onclick="window.updateGroupScore(${i}, 1)" class="w-6 h-6 sm:w-10 sm:h-10 text-sm sm:text-xl font-bold ${color.btn} text-white transition">+</button>
                        </div>
                    </div>
                </div>
                
                <div class="p-1 sm:p-3 flex-1 min-h-[80px] flex flex-col gap-1 sm:gap-2 items-stretch relative">
                    ${groupStudents.length === 0 ? `<div class="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-[10px] sm:text-sm pointer-events-none text-center">이동</div>` : ''}
                    ${groupStudents.map(s => {
                        let bsEmoji = s.ballSense === '2' ? '⚽⚽' : (s.ballSense === '1' ? '⚽' : '-');
                        let rankStr = "";
                        if (s.recordMs > 0) {
                            let rank = validRecords.indexOf(s.recordMs) + 1;
                            rankStr = ` <span class="text-blue-600 font-black">(${rank}위)</span>`;
                        }
                        let recText = s.recordMs > 0 ? (s.recordMs / 1000).toFixed(2) + "초" + rankStr : '-';
                        let badgeColor = s.gender === '남' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-pink-100 text-pink-700 border-pink-200';
                        let isSelected = window.selectedGroupStudent === s.no;
                        let selectedStyle = isSelected ? 'ring-4 ring-yellow-400 transform scale-105 z-10 shadow-md' : 'shadow-sm hover:shadow hover:-translate-y-0.5';
                        let isCaptain = s[`captain_${currentGroupMode}`];
                        let captainBadge = isCaptain ? '<span class="absolute -top-2 -right-2 text-lg drop-shadow-sm z-20">👑</span>' : '';
                        let memberDrawnBadge = s.groupMemberDrawn ? '<div class="absolute -bottom-2 -right-2 bg-fuchsia-500 text-white text-[9px] px-1.5 py-0.5 rounded shadow z-20 font-bold animate-pop-in">당첨</div>' : '';

                        return `
                        <div draggable="true" data-student-no="${s.no}" 
                             ondragstart="window.handleDragStart(event, ${s.no})" ondragend="window.handleDragEnd(event)" 
                             ondragover="window.handleDragOverStudent(event, ${s.no})"
                             ondragleave="window.handleDragLeaveStudent(event)"
                             ondrop="window.handleDropOnStudent(event, ${s.no})" 
                             ontouchstart="window.handleTouchStart(event, ${s.no})"
                             ontouchmove="window.handleTouchMove(event)"
                             ontouchend="window.handleTouchEnd(event)"
                             onclick="event.stopPropagation(); window.handleStudentCardClick(${s.no})"
                             class="student-card relative bg-white border sm:border-2 ${badgeColor} p-1 sm:px-2 sm:py-2 rounded-lg cursor-pointer transition-all duration-200 select-none ${selectedStyle} flex flex-col items-center justify-center min-h-[46px] sm:min-h-[50px]">
                            ${captainBadge}
                            ${memberDrawnBadge}
                            <span class="text-[8px] sm:text-[10px] font-bold opacity-60 w-full text-left leading-none absolute top-0.5 left-1">${s.no}</span>
                            <span class="font-black text-[11px] sm:text-base whitespace-nowrap overflow-hidden text-ellipsis w-full text-center mt-1 sm:mt-0" onclick="event.stopPropagation(); window.toggleCaptain(${s.no})">${s.name}</span>
                            <div class="flex flex-col items-center w-full bg-slate-50/80 rounded px-1 py-0.5 border border-slate-100 mt-1">
                                <span class="text-[9px] sm:text-[10px] font-bold text-slate-500 tracking-tighter whitespace-nowrap leading-tight" title="볼센스">볼센스: ${bsEmoji}</span>
                                <span class="text-[9px] sm:text-[10px] font-mono font-bold text-slate-500 tracking-tighter whitespace-nowrap leading-tight" title="순발력">⚡${recText}</span>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>

                <div class="bg-white/50 border-t ${color.border} p-1 flex flex-col sm:flex-row justify-between items-center gap-1 print-hide">
                     <div class="w-full flex justify-between items-center">
                         <button id="mode-icon-${i}" onclick="window.toggleTimerMode(${i})" class="text-[10px] sm:text-2xl hover:scale-110 transition bg-white w-5 h-5 sm:w-10 sm:h-10 rounded-full shadow-sm flex items-center justify-center border border-slate-200" title="스톱워치/타이머 전환">
                             ${t.mode === 'stopwatch' ? '⏱️' : '⏳'}
                         </button>
                         <div class="flex-1 mx-1 bg-white border border-slate-200 rounded text-center cursor-pointer shadow-inner px-1" onclick="window.manualTimeEdit(${i})" title="터치하여 시간 직접 입력">
                             <span id="time-display-${i}" class="font-mono text-[10px] sm:text-xl font-black tracking-tighter ${timeColorClass}">${timerDisplayVal}</span>
                         </div>
                         <div class="flex gap-0.5">
                             <button id="btn-play-${i}" onclick="window.toggleTimerPlay(${i})" class="bg-white text-slate-300 w-5 h-5 sm:w-10 sm:h-10 rounded-full border border-slate-200 shadow-sm hover:text-blue-500 transition flex items-center justify-center text-[10px] sm:text-base font-bold">▶</button>
                             <button onclick="window.resetTimer(${i})" class="bg-white text-slate-400 w-5 h-5 sm:w-10 sm:h-10 rounded-full border border-slate-200 shadow-sm hover:text-red-500 transition flex items-center justify-center text-[10px] sm:text-base font-bold">↻</button>
                         </div>
                     </div>
                </div>
            </div>`;
        }

        // --- 🎲 미편성 영역 추가 ---
        const unassignedStudents = students.filter(s => !s[`group_${currentGroupMode}`] && s.attendance);
        unassignedStudents.sort((a, b) => a.no - b.no);

        html += `
        <div class="col-span-full mt-2 bg-slate-100/80 border-2 border-dashed border-slate-300 rounded-xl p-2 sm:p-4 group-area transition-all duration-300"
             data-group-id="0" 
             ondragover="window.handleDragOverGroup(event)" 
             ondragleave="window.handleDragLeaveGroup(event)"
             ondrop="window.handleDropOnGroup(event, 0)" 
             onclick="window.handleGroupAreaClick(0)">
            
            <div class="flex items-center gap-2 mb-2 px-1">
                <h3 class="font-bold text-sm sm:text-base text-slate-600 flex items-center gap-1">
                    <span>🤷 미편성 영역</span>
                </h3>
                <span class="text-[10px] sm:text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">${unassignedStudents.length}명</span>
                <span class="text-[10px] text-slate-400 ml-auto hidden sm:inline">※ 편성에서 제외되거나 아직 배치되지 않은 학생들입니다.</span>
            </div>
            
            <div class="flex flex-wrap gap-2 min-h-[60px] items-start p-2 bg-white/50 rounded-lg border border-slate-200">
                ${unassignedStudents.length === 0 ? `<div class="w-full flex items-center justify-center text-slate-400 font-bold text-xs sm:text-sm py-4 pointer-events-none">모든 학생이 편성되었습니다.</div>` : ''}
                ${unassignedStudents.map(s => {
                    let bsEmoji = s.ballSense === '2' ? '⚽⚽' : (s.ballSense === '1' ? '⚽' : '-');
                    let rankStr = "";
                    if (s.recordMs > 0) {
                        let rank = validRecords.indexOf(s.recordMs) + 1;
                        rankStr = ` <span class="text-blue-600 font-black">(${rank}위)</span>`;
                    }
                    let recText = s.recordMs > 0 ? (s.recordMs / 1000).toFixed(2) + "초" + rankStr : '-';
                    let badgeColor = s.gender === '남' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-pink-100 text-pink-700 border-pink-200';
                    let isSelected = window.selectedGroupStudent === s.no;
                    let selectedStyle = isSelected ? 'ring-4 ring-yellow-400 transform scale-105 z-10 shadow-md' : 'shadow-sm hover:shadow hover:-translate-y-0.5';
                    let isCaptain = s[`captain_${currentGroupMode}`];
                    let captainBadge = isCaptain ? '<span class="absolute -top-2 -right-2 text-lg drop-shadow-sm z-20">👑</span>' : '';
                    
                    return `
                    <div draggable="true" data-student-no="${s.no}" 
                         ondragstart="window.handleDragStart(event, ${s.no})" ondragend="window.handleDragEnd(event)" 
                         ondragover="window.handleDragOverStudent(event, ${s.no})"
                         ondragleave="window.handleDragLeaveStudent(event)"
                         ondrop="window.handleDropOnStudent(event, ${s.no})" 
                         ontouchstart="window.handleTouchStart(event, ${s.no})"
                         ontouchmove="window.handleTouchMove(event)"
                         ontouchend="window.handleTouchEnd(event)"
                         onclick="event.stopPropagation(); window.handleStudentCardClick(${s.no})"
                         class="student-card w-20 sm:w-28 relative bg-white border sm:border-2 ${badgeColor} p-1 sm:px-2 sm:py-2 rounded-lg cursor-pointer transition-all duration-200 select-none ${selectedStyle} flex flex-col items-center justify-center min-h-[46px] sm:min-h-[50px]">
                        ${captainBadge}
                        <span class="text-[8px] sm:text-[10px] font-bold opacity-60 w-full text-left leading-none absolute top-0.5 left-1">${s.no}</span>
                        <span class="font-black text-[11px] sm:text-base whitespace-nowrap overflow-hidden text-ellipsis w-full text-center mt-1 sm:mt-0" onclick="event.stopPropagation(); window.toggleCaptain(${s.no})">${s.name}</span>
                        <div class="flex flex-col items-center w-full bg-slate-50/80 rounded px-1 py-0.5 border border-slate-100 mt-1">
                            <span class="text-[9px] sm:text-[10px] font-bold text-slate-500 tracking-tighter whitespace-nowrap leading-tight" title="볼센스">볼센스: ${bsEmoji}</span>
                            <span class="text-[9px] sm:text-[10px] font-mono font-bold text-slate-500 tracking-tighter whitespace-nowrap leading-tight" title="순발력">⚡${recText}</span>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        </div>`;
        
        container.innerHTML = html;
    }

    window.drawRandomGroup = function() {
        if(!currentClass) return;
        let numGroups = currentGroupMode === 'mixed2' ? 2 : (currentGroupMode === 'mixed3' ? 3 : 4);
        
        let drawnGroupIds = [];
        if (groupRecords[currentClass] && groupRecords[currentClass][currentGroupMode] && groupRecords[currentClass][currentGroupMode].drawnGroups) {
            drawnGroupIds = groupRecords[currentClass][currentGroupMode].drawnGroups || [];
        }

        let available = [];
        for(let i=1; i<=numGroups; i++) {
            if(!drawnGroupIds.includes(i)) available.push(i);
        }

        if(available.length === 0) {
            window.showModal("알림", "모든 모둠이 한 번씩 뽑혔습니다. 기록을 초기화하세요.");
            return;
        }

        document.getElementById('event-loading-overlay').classList.remove('hidden');
        document.getElementById('event-loading-overlay').classList.add('flex');
        document.getElementById('event-loading-text').innerText = "모둠 뽑는 중...";
        window.playDrumRoll();

        setTimeout(() => {
            document.getElementById('event-loading-overlay').classList.add('hidden');
            document.getElementById('event-loading-overlay').classList.remove('flex');
            document.getElementById('event-loading-text').innerText = "두구두구두구...";

            const pickedGroup = available[Math.floor(Math.random() * available.length)];
            drawnGroupIds.push(pickedGroup);
            
            if(!groupRecords[currentClass]) groupRecords[currentClass] = {};
            if(!groupRecords[currentClass][currentGroupMode]) groupRecords[currentClass][currentGroupMode] = {};
            groupRecords[currentClass][currentGroupMode].drawnGroups = drawnGroupIds;

            saveData();
            window.renderGroups();
            window.playGrandFanfare();
            window.fireConfetti();
            
            const html = `
                <div class="text-center p-6 bg-indigo-50 border-4 border-indigo-300 rounded-3xl shadow-xl w-64 transform transition hover:scale-105 mx-auto">
                    <div class="text-7xl mb-4">🎉</div>
                    <div class="text-4xl font-black text-indigo-700">${pickedGroup}모둠!</div>
                </div>
            `;
            document.getElementById('drawResultGrid').innerHTML = html;
            document.getElementById('drawResultTitle').innerText = "🎲 모둠 뽑기 결과";
            document.getElementById('drawResultModal').style.display = 'flex';
        }, 2000);
    }

    window.drawRandomMembersInGroups = function() {
        if(!currentClass) return;
        const targetGroup = document.getElementById('group-draw-target').value;
        const drawCount = parseInt(document.getElementById('group-draw-count').value, 10);
        
        let groupsToProcess = [];
        let maxGroup = currentGroupMode === 'mixed2' ? 2 : (currentGroupMode === 'mixed3' ? 3 : 4);
        
        if (targetGroup === 'all') {
            for(let i=1; i<=maxGroup; i++) groupsToProcess.push(i);
        } else {
            groupsToProcess.push(parseInt(targetGroup));
        }

        let pickedStudents = [];
        let lackFlag = false;

        groupsToProcess.forEach(gId => {
            let studentsInGroup = classData[currentClass].filter(s => s.attendance && s[`group_${currentGroupMode}`] === gId && !s.groupMemberDrawn);
            if (studentsInGroup.length < drawCount) { lackFlag = true; }
            else {
                for (let i = studentsInGroup.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [studentsInGroup[i], studentsInGroup[j]] = [studentsInGroup[j], studentsInGroup[i]]; }
                const picked = studentsInGroup.slice(0, drawCount);
                picked.forEach(s => { s.groupMemberDrawn = true; pickedStudents.push(s); });
            }
        });

        if (pickedStudents.length === 0) {
            window.showModal("알림", lackFlag ? "뽑을 인원이 부족한 모둠이 있습니다. 초기화 후 다시 시도하세요." : "대기 중인 인원이 없습니다.");
            return;
        }

        document.getElementById('event-loading-overlay').classList.remove('hidden');
        document.getElementById('event-loading-overlay').classList.add('flex');
        document.getElementById('event-loading-text').innerText = "모둠원 뽑는 중...";
        window.playDrumRoll();

        setTimeout(() => {
            document.getElementById('event-loading-overlay').classList.add('hidden');
            document.getElementById('event-loading-overlay').classList.remove('flex');
            document.getElementById('event-loading-text').innerText = "두구두구두구...";

            saveData();
            window.renderGroups();
            window.playGrandFanfare();
            window.fireConfetti();

            let html = '';
            pickedStudents.sort((a, b) => a[`group_${currentGroupMode}`] - b[`group_${currentGroupMode}`]);
            pickedStudents.forEach(s => {
                const badgeColor = s.gender === '남' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-pink-100 text-pink-700 border-pink-300';
                html += `
                    <div class="${badgeColor} border-4 p-4 sm:p-6 rounded-2xl text-center shadow-lg w-32 sm:w-40 flex flex-col items-center justify-center transform transition hover:scale-105">
                        <div class="text-xs sm:text-sm font-bold opacity-70 mb-1">${s[`group_${currentGroupMode}`]}모둠</div>
                        <div class="text-xl sm:text-2xl font-black">${s.name}</div>
                    </div>
                `;
            });
            
            document.getElementById('drawResultGrid').innerHTML = html;
            document.getElementById('drawResultTitle').innerText = "👥 모둠원 뽑기 결과";
            document.getElementById('drawResultModal').style.display = 'flex';
        }, 2000);
    }

    window.resetGroupDraws = function() {
        if(!currentClass) return;
        window.showModal("초기화", "모둠 및 모둠원 뽑기 기록을 모두 초기화하시겠습니까?", true, () => {
            if(groupRecords[currentClass] && groupRecords[currentClass][currentGroupMode]) {
                groupRecords[currentClass][currentGroupMode].drawnGroups = [];
            }
            classData[currentClass].forEach(s => s.groupMemberDrawn = false);
            saveData();
            window.renderGroups();
        });
    }

    // 출석부 탭의 개인 뽑기 로직
    window.updateDrawStatus = function() {
        if (!currentClass || !classData[currentClass]) return;
        const target = document.getElementById('draw-target').value;
        let pool = classData[currentClass].filter(s => s.attendance && !s.drawn);
        if (target === '남') pool = pool.filter(s => s.gender === '남');
        if (target === '여') pool = pool.filter(s => s.gender === '여');
        const statusText = document.getElementById('draw-status-text');
        if (statusText) statusText.innerText = `대기: ${pool.length}명`;
    }

    window.drawStudents = function() {
        if (!currentClass || !classData[currentClass]) return;
        const count = parseInt(document.getElementById('draw-count').value);
        const target = document.getElementById('draw-target').value;
        let pool = classData[currentClass].filter(s => s.attendance && !s.drawn);
        if (target === '남') pool = pool.filter(s => s.gender === '남');
        if (target === '여') pool = pool.filter(s => s.gender === '여');

        if (pool.length < count) {
            window.showModal("인원 부족", `뽑을 수 있는 대기 인원(${pool.length}명)이 부족합니다. 초기화 후 다시 시도하세요.`);
            return;
        }

        document.getElementById('event-loading-overlay').classList.remove('hidden');
        document.getElementById('event-loading-overlay').classList.add('flex');
        window.playDrumRoll();

        setTimeout(() => {
            document.getElementById('event-loading-overlay').classList.add('hidden');
            document.getElementById('event-loading-overlay').classList.remove('flex');
            
            for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
            const picked = pool.slice(0, count);
            picked.forEach(s => s.drawn = true);
            
            saveData(); window.renderStudentList();
            
            const resultHtml = picked.map(s => {
                const badgeColor = s.gender === '남' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-pink-100 text-pink-700 border-pink-300';
                return `<div class="${badgeColor} border-4 p-4 sm:p-6 rounded-2xl text-center shadow-lg w-32 sm:w-40 flex flex-col items-center justify-center transform transition hover:scale-105">
                            <span class="text-sm font-bold opacity-70 mb-1">${s.no}번</span>
                            <div class="text-xl sm:text-2xl font-black">${s.name}</div>
                        </div>`;
            }).join('');
            
            document.getElementById('drawResultGrid').innerHTML = resultHtml;
            document.getElementById('drawResultTitle').innerText = "🎉 랜덤 뽑기 결과";
            document.getElementById('drawResultModal').style.display = 'flex';
            
            window.playGrandFanfare();
            window.fireConfetti();
        }, 2000);
    }

    window.resetDrawPool = function() {
        if (!currentClass || !classData[currentClass]) return;
        window.showModal("초기화", "출석부 랜덤 뽑기 기록을 모두 초기화하시겠습니까?", true, () => {
            classData[currentClass].forEach(s => s.drawn = false);
            saveData();
            window.renderStudentList();
        });
    }

    window.closeDrawResultModal = function() {
        document.getElementById('drawResultModal').style.display = 'none';
    }

    // ==========================================
    // 7. 엑셀 일괄 등록 로직
    // ==========================================
    window.importFromExcel = function() {
        const input = document.getElementById('excel-input').value.trim();
        if (!input) {
            window.showModal("알림", "입력된 데이터가 없습니다.");
            return;
        }

        if (!currentClass) {
            window.showModal("알림", "먼저 추가할 학급을 선택하거나 새 학급을 생성해주세요.");
            return;
        }

        const lines = input.split('\n');
        let addedCount = 0;
        let currentStudents = classData[currentClass] || [];

        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
                const no = parseInt(parts[0]);
                const name = parts[1];
                let gender = parts.length > 2 ? parts[2] : '-';
                let ballSense = '0';
                let recordMs = 0;
                let group = null;

                if (parts.length > 3) {
                    let bs = parts[3];
                    if(bs === '2' || bs === '상') ballSense = '2';
                    else if(bs === '1' || bs === '중') ballSense = '1';
                }
                if (parts.length > 4) {
                    const parsedRec = parseFloat(parts[4]);
                    if(!isNaN(parsedRec)) recordMs = Math.floor(parsedRec * 1000);
                }
                if (parts.length > 5) {
                    group = parseInt(parts[5]) || null;
                }

                if (!isNaN(no) && name) {
                    const existingIdx = currentStudents.findIndex(s => s.no === no);
                    const newStudent = { 
                        no: no, 
                        name: name, 
                        gender: gender, 
                        ballSense: ballSense, 
                        attendance: true, 
                        score: 0, 
                        recordMs: recordMs, 
                        memo: "", 
                        dismissalInfo: "", 
                        drawn: false, 
                        groupMemberDrawn: false, 
                        captain_mixed2: false, 
                        captain_mixed3: false, 
                        captain_mixed4: false, 
                        captain_gender: false, 
                        group_mixed2: group, 
                        group_mixed3: group, 
                        group_mixed4: group, 
                        group_gender: group 
                    };

                    if (existingIdx > -1) {
                        currentStudents[existingIdx] = newStudent;
                    } else {
                        currentStudents.push(newStudent);
                    }
                    addedCount++;
                }
            }
        });

        if (addedCount > 0) {
            classData[currentClass] = currentStudents;
            saveData();
            window.renderStudentList();
            document.getElementById('excel-input').value = "";
            window.showModal("등록 완료", `${addedCount}명의 학생이 성공적으로 등록/수정되었습니다.`);
        } else {
            window.showModal("알림", "올바른 형식의 데이터를 찾을 수 없습니다. (번호 이름 성별 순서)");
        }
    }
