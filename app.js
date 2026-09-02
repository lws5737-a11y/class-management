import { auth, db, provider, firestorePersistenceReady, firestorePersistenceState } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { applyRosterOverrides, buildBalancedTeamPlan, parseRosterTable } from './class-utils.mjs?v=20260902-2';

window.isDraggingCard = false; 
window.selectedGroupStudent = null; 

// ===============window.playBumpSound = function() {===========================
// ⏱️ 다중 스톱워치 상태 및 8자 줄넘기 변수
// ==========================================
let groupStudents = []; 
let groupStarts = Array(10).fill(null);   
let groupStops = Array(10).fill(null);    
let groupLoopId = null; 

// 8자 줄넘기 상태
let jumpRopeData = {}; 
let jumpRopeTimerMs = 0;
let jumpRopeTimerStart = 0;
let jumpRopeInterval = null;
let jumpRopeCount = 0;
let jumpRopeTimerMode = 'stopwatch'; // 'stopwatch' or 'timer'
let jumpRopeTargetMs = 60000;

// ==========================================
// 1. 오디오 초기화 및 재생
// ==========================================

let audioCtx;
function initAudio() {
    if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    if (audioCtx.state === 'suspended') { audioCtx.resume(); }
    return audioCtx;
}
document.body.addEventListener('click', initAudio, { once: true });
document.body.addEventListener('touchstart', initAudio, { once: true });

const PENALTY_CARD_SYSTEM_VERSION = 3;
const PENALTY_CARD_DETAILS = {
    verbal: { label: '입경고', subtitle: '구두 경고', background: '#f59e0b', foreground: '#451a03', symbol: '!' },
    yellow: { label: '옐로카드', subtitle: '주의', background: '#fde047', foreground: '#422006', symbol: '!' },
    red: { label: '레드카드', subtitle: '최종 경고', background: '#ef4444', foreground: '#ffffff', symbol: '!' }
};

function createPenaltyCardImage(type) {
    const detail = PENALTY_CARD_DETAILS[type] || PENALTY_CARD_DETAILS.verbal;
    const isVerbal = type === 'verbal';
    const shape = isVerbal
        ? `<path d="M115 105h370a55 55 0 0 1 55 55v210a55 55 0 0 1-55 55H300l-88 78 22-78H115a55 55 0 0 1-55-55V160a55 55 0 0 1 55-55Z" fill="${detail.background}"/>`
        : `<rect x="105" y="55" width="390" height="490" rx="34" fill="${detail.background}" transform="rotate(-5 300 300)"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
        <rect width="600" height="600" rx="56" fill="#0f172a" fill-opacity=".28"/>
        ${shape}
        <circle cx="300" cy="235" r="68" fill="${detail.foreground}" fill-opacity=".16"/>
        <text x="300" y="270" text-anchor="middle" font-family="Arial, sans-serif" font-size="112" font-weight="900" fill="${detail.foreground}">${detail.symbol}</text>
        <text x="300" y="365" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="900" fill="${detail.foreground}">${detail.label}</text>
        <text x="300" y="415" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="${detail.foreground}" fill-opacity=".82">${detail.subtitle}</text>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function playPenaltySound(type) {
    try {
        const ctx = initAudio();
        const patterns = type === 'verbal'
            ? [[0, 660, 0.11], [0.16, 820, 0.13]]
            : (type === 'yellow' ? [[0, 980, 0.18], [0.22, 1180, 0.2]] : [[0, 420, 0.2], [0.24, 350, 0.24], [0.52, 280, 0.32]]);
        patterns.forEach(([delay, frequency, duration]) => {
            const start = ctx.currentTime + delay;
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            oscillator.type = type === 'verbal' ? 'sine' : 'square';
            oscillator.frequency.setValueAtTime(frequency, start);
            if (type !== 'verbal') oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.82, start + duration);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(type === 'verbal' ? 0.13 : 0.2, start + 0.018);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
            oscillator.connect(gain).connect(ctx.destination);
            oscillator.start(start);
            oscillator.stop(start + duration + 0.03);
        });
    } catch (error) {
        console.log('경고 효과음 재생 실패:', error);
    }
}

window.showPenaltyCard = function(type) {
    const overlay = document.getElementById('card-overlay');
    const img = document.getElementById('card-image');
    const detail = PENALTY_CARD_DETAILS[type] || PENALTY_CARD_DETAILS.verbal;

    img.src = createPenaltyCardImage(type);
    img.alt = `${detail.label} 알림`;
    playPenaltySound(type);

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    
    img.classList.remove('animate-slide-tilt');
    void img.offsetWidth; 
    img.classList.add('animate-slide-tilt');
};

window.closeCardOverlay = function() {
    const overlay = document.getElementById('card-overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
};

// ▼ 새롭게 바뀐 도장 효과음 코드 ▼
window.playCoinSound = function() {
    try {
        // sound 폴더 안의 coin03.mp3 파일을 불러와서 재생합니다.
        const audio = new Audio('sound/coin03.mp3');
        audio.play().catch(e => console.log('도장 오디오 재생 막힘:', e));
    } catch(e) {}
}

// ▼ 새롭게 바뀐 도장 효과음 코드 ▼
window.playBumpSound = function() {
    try {
        // sound 폴더 안의 coin03.mp3 파일을 불러와서 재생합니다.
        const audio = new Audio('sound/coin03.mp3');
        audio.play().catch(e => console.log('도장 오디오 재생 막힘:', e));
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
let groupPenalties = {};
let classStamps = {}; 
let sortState = { field: 'no', direction: 'asc' };

const ALLOWED_EMAIL = 'lws5737@seoul-dongsan.es.kr';

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
}

function clearSensitiveLocalData() {
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('smart_run_backup_')) localStorage.removeItem(key);
    });
}

// 이전 버전이 입력창 전체를 저장했던 흔적을 앱 시작 시 제거합니다.
clearSensitiveLocalData();

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

window.currentDragY = -1;
window.autoScrollRaf = null;
window.dragOverUnassigned = false;

window.startAutoScroll = function() {
    if (window.autoScrollRaf) return;
    function scrollLoop() {
        if (!window.isTouchDragging && !window.isDraggingCard && !window.isClassTouchDragging && !window.draggedClass) {
            window.currentDragY = -1;
            window.autoScrollRaf = null;
            return;
        }
        if (window.currentDragY !== -1 && !window.dragOverUnassigned) {
            const threshold = 120;
            const speed = 12; 
            if (window.currentDragY < threshold) {
                window.scrollBy(0, -speed);
            } else if (window.innerHeight - window.currentDragY < threshold) {
                window.scrollBy(0, speed);
            }
        }
        window.autoScrollRaf = requestAnimationFrame(scrollLoop);
    }
    scrollLoop();
};

window.stopAutoScroll = function() {
    if (window.autoScrollRaf) {
        cancelAnimationFrame(window.autoScrollRaf);
        window.autoScrollRaf = null;
    }
    window.currentDragY = -1;
};

document.addEventListener('dragover', function(e) {
    if (window.isDraggingCard || window.draggedClass) {
        window.currentDragY = e.clientY;
        window.dragOverUnassigned = Boolean(e.target.closest?.('#unassigned-area'));
    }
});

window.showFloatingUnassigned = function() {
    const el = document.getElementById('unassigned-area');
    if (el) {
        el.classList.add('unassigned-floating');
        el.classList.remove('col-span-full', 'mt-2', 'bg-slate-100/80', 'border-slate-900', 'rounded-2xl');
        el.classList.add(
            'fixed', 'bottom-0', 'left-0', 'right-0', 'z-40', 
            'bg-slate-100', 'shadow-[0_-5px_20px_rgba(0,0,0,0.15)]', 
            'border-t-[3px]', 'border-slate-900', 'rounded-t-2xl', 'p-2', 'm-0', 'border-x-0', 'border-b-0'
        );
        
        const innerCont = el.querySelector('div.flex.flex-wrap, div.flex-wrap');
        if (innerCont) {
            innerCont.classList.remove('flex-wrap');
            innerCont.classList.add('flex-row', 'overflow-x-auto', 'flex-nowrap', 'no-scrollbar', 'max-h-[80px]', 'py-1');
        }
    }
};

window.hideFloatingUnassigned = function() {
    const el = document.getElementById('unassigned-area');
    if (el) {
        el.classList.remove('unassigned-floating');
        el.classList.add('col-span-full', 'mt-2', 'bg-slate-100/80', 'border-slate-900', 'rounded-2xl');
        el.classList.remove(
            'fixed', 'bottom-0', 'left-0', 'right-0', 'z-40', 
            'bg-slate-100', 'shadow-[0_-5px_20px_rgba(0,0,0,0.15)]', 
            'border-t-[3px]', 'border-slate-900', 'rounded-t-2xl', 'p-2', 'm-0', 'border-x-0', 'border-b-0'
        );
        
        const innerCont = el.querySelector('div.flex.flex-row, div.flex-row');
        if (innerCont) {
            innerCont.classList.remove('flex-row', 'overflow-x-auto', 'flex-nowrap', 'no-scrollbar', 'max-h-[80px]', 'py-1');
            innerCont.classList.add('flex-wrap');
        }
    }
};

window.draggedClass = null;
let classTouchTimeout;
window.classTouchClone = null;
window.activeClassTouchElement = null;
window.isClassTouchDragging = false;
window.classTouchStartX = 0;
window.classTouchStartY = 0;

function getSortedClasses() {
    let classes = Object.keys(classData);
    let savedOrder = JSON.parse(localStorage.getItem('classOrder')) || [];
    classes.sort((a, b) => {
        let idxA = savedOrder.indexOf(a);
        let idxB = savedOrder.indexOf(b);
        if(idxA === -1 && idxB === -1) return a.localeCompare(b);
        if(idxA === -1) return 1;
        if(idxB === -1) return -1;
        return idxA - idxB;
    });
    return classes;
}

function saveClassOrder(classes) {
    localStorage.setItem('classOrder', JSON.stringify(classes));
}

window.handleClassDragStart = function(e, cls) {
    window.draggedClass = cls;
    e.dataTransfer.effectAllowed = 'move';
    window.currentDragY = e.clientY;
    window.startAutoScroll();
    setTimeout(() => { e.target.style.opacity = '0.4'; }, 0);
}
window.handleClassDragEnd = function(e) {
    window.draggedClass = null;
    window.stopAutoScroll();
    e.target.style.opacity = '1';
    document.querySelectorAll('.class-drop-active').forEach(el => el.classList.remove('class-drop-active', 'ring-4', 'ring-blue-400', 'bg-blue-50'));
}
window.handleClassDragOver = function(e) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('class-drop-active', 'ring-4', 'ring-blue-400');
    if(e.currentTarget.classList.contains('hidden-drop-zone')) e.currentTarget.classList.add('bg-blue-50');
}
window.handleClassDragLeave = function(e) {
    e.currentTarget.classList.remove('class-drop-active', 'ring-4', 'ring-blue-400', 'bg-blue-50');
}
window.handleClassDropOnClass = function(e, targetCls) {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.classList.remove('class-drop-active', 'ring-4', 'ring-blue-400', 'bg-blue-50');
    window.processClassDrop(window.draggedClass, targetCls, null);
}
window.handleClassZoneDrop = function(e, zone) {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.classList.remove('class-drop-active', 'ring-4', 'ring-blue-400', 'bg-blue-50');
    window.processClassDrop(window.draggedClass, null, zone);
}

window.handleClassTouchStart = function(e, cls) {
    const touch = e.touches[0];
    const target = e.currentTarget;
    window.classTouchStartX = touch.clientX;
    window.classTouchStartY = touch.clientY;

    classTouchTimeout = setTimeout(() => {
        window.isClassTouchDragging = true;
        window.draggedClass = cls;
        window.currentDragY = touch.clientY;
        window.startAutoScroll();

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
        clone.style.transition = 'none'; 
        document.body.appendChild(clone);
        window.classTouchClone = clone;
        target.style.opacity = '0.3';
        window.activeClassTouchElement = target;
        if (navigator.vibrate) navigator.vibrate(50);
    }, 500); 
};

window.handleClassTouchMove = function(e) {
    if (!window.classTouchClone) { clearTimeout(classTouchTimeout); return; }
    e.preventDefault(); 
    const touch = e.touches[0];
    window.currentDragY = touch.clientY;
    
    const dx = touch.clientX - window.classTouchStartX;
    const dy = touch.clientY - window.classTouchStartY;
    window.classTouchClone.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.05)`;

    const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    document.querySelectorAll('.class-drop-active').forEach(el => {
        el.classList.remove('class-drop-active', 'ring-4', 'ring-blue-400', 'bg-blue-50');
    });

    if (elemBelow) {
        const classBtn = elemBelow.closest('.class-btn');
        const hiddenZone = elemBelow.closest('.hidden-drop-zone');
        const visibleZone = elemBelow.closest('.visible-drop-zone');
        
        if (classBtn && classBtn.getAttribute('data-class-name') !== window.draggedClass) {
            classBtn.classList.add('class-drop-active', 'ring-4', 'ring-blue-400');
        } else if (hiddenZone && !classBtn) {
            hiddenZone.classList.add('class-drop-active', 'ring-4', 'ring-blue-400', 'bg-blue-50');
        } else if (visibleZone && !classBtn) {
            visibleZone.classList.add('class-drop-active', 'ring-4', 'ring-blue-400');
        }
    }
};

window.handleClassTouchEnd = function(e) {
    clearTimeout(classTouchTimeout);
    if (!window.classTouchClone) return;
    e.preventDefault(); 
    
    window.stopAutoScroll();
    
    const touch = e.changedTouches[0];
    const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);

    if (window.activeClassTouchElement) window.activeClassTouchElement.style.opacity = '1';

    if (elemBelow) {
        const classBtn = elemBelow.closest('.class-btn');
        const hiddenZone = elemBelow.closest('.hidden-drop-zone');
        const visibleZone = elemBelow.closest('.visible-drop-zone');

        if (classBtn) {
            const targetCls = classBtn.getAttribute('data-class-name');
            if (targetCls && targetCls !== window.draggedClass) {
                window.processClassDrop(window.draggedClass, targetCls, null);
            }
        } else if (hiddenZone) {
            window.processClassDrop(window.draggedClass, null, 'hidden');
        } else if (visibleZone) {
            window.processClassDrop(window.draggedClass, null, 'visible');
        }
    }

    document.querySelectorAll('.class-drop-active').forEach(el => {
        el.classList.remove('class-drop-active', 'ring-4', 'ring-blue-400', 'bg-blue-50');
    });
    
    window.classTouchClone.remove();
    window.classTouchClone = null;
    window.activeClassTouchElement = null;
    window.draggedClass = null;
    
    setTimeout(() => { window.isClassTouchDragging = false; }, 10);
};

window.processClassDrop = function(draggedCls, targetCls, targetZone) {
    if(!draggedCls) return;
    let classes = getSortedClasses();
    
    if (targetCls && targetCls !== draggedCls) {
        const oldIdx = classes.indexOf(draggedCls);
        const newIdx = classes.indexOf(targetCls);
        if(oldIdx > -1 && newIdx > -1) {
            classes.splice(oldIdx, 1);
            classes.splice(newIdx, 0, draggedCls);
            saveClassOrder(classes);
        }
        window.saveClassVisibility(draggedCls, window.isClassVisible(targetCls));
    } else if (targetZone === 'hidden') {
        window.saveClassVisibility(draggedCls, false);
    } else if (targetZone === 'visible') {
        window.saveClassVisibility(draggedCls, true);
    }
    
    window.renderClassSelect();
}

let touchTimeout;
window.touchClone = null;
window.activeTouchElement = null;
window.touchStartX = 0;
window.touchStartY = 0;
window.isTouchDragging = false;

const clearDropStyles = () => {
    document.querySelectorAll('.drop-target-active').forEach(el => {
        el.classList.remove('drop-target-active', 'ring-[5px]', 'ring-red-500', 'shadow-[0_0_20px_rgba(239,68,68,0.6)]', 'scale-[1.02]', 'z-20', 'ring-4', 'scale-110', 'z-30');
    });
};

window.handleTouchStart = function(e, studentNo) {
    const touch = e.touches[0];
    const target = e.currentTarget;
    window.touchStartX = touch.clientX;
    window.touchStartY = touch.clientY;

    touchTimeout = setTimeout(() => {
        window.isTouchDragging = true;
        window.draggedStudentNo = studentNo;
        window.selectedGroupStudent = null; 
        
        window.currentDragY = touch.clientY;
        window.startAutoScroll();

        clearDropStyles();

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
        clone.style.transition = 'none'; 
        clone.classList.remove('transition-all', 'duration-200');
        clone.style.transform = 'translate3d(0px, 0px, 0px) scale(1.05)';
        clone.style.willChange = 'transform'; 
        document.body.appendChild(clone);
        window.touchClone = clone;
        target.style.opacity = '0.3';
        window.activeTouchElement = target;
        
        const student = classData[currentClass]?.find(s => s.no === studentNo);
        if (student && student[`group_${currentGroupMode}`] !== null && student[`group_${currentGroupMode}`] !== undefined) {
            window.showFloatingUnassigned();
        }

        if (navigator.vibrate) navigator.vibrate(50);
    }, 500); 
};

window.handleTouchMove = function(e) {
    if (!window.touchClone) { clearTimeout(touchTimeout); return; }
    e.preventDefault(); 
    const touch = e.touches[0];
    
    window.currentDragY = touch.clientY;
    
    const dx = touch.clientX - window.touchStartX;
    const dy = touch.clientY - window.touchStartY;
    window.touchClone.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.05)`;

    const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    window.dragOverUnassigned = Boolean(elemBelow?.closest('#unassigned-area'));
    
    clearDropStyles();

    if (elemBelow) {
        const groupArea = elemBelow.closest('.group-area');
        if (groupArea) {
            groupArea.classList.add('drop-target-active', 'ring-[5px]', 'ring-red-500', 'shadow-[0_0_20px_rgba(239,68,68,0.6)]', 'scale-[1.02]', 'z-20');
        }
    }
};

window.handleTouchEnd = function(e) {
    clearTimeout(touchTimeout);
    if (!window.touchClone) return;
    e.preventDefault(); 
    
    window.stopAutoScroll();
    window.dragOverUnassigned = false;
    
    const touch = e.changedTouches[0];
    const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);

    if (window.activeTouchElement) { window.activeTouchElement.style.opacity = '1'; }

    window.hideFloatingUnassigned();

    if (elemBelow) {
        const groupArea = elemBelow.closest('.group-area');
        if (groupArea) {
            const targetGroupAttr = groupArea.getAttribute('data-group-id');
            if (targetGroupAttr !== null) {
                window.handleDropLogic(window.draggedStudentNo, parseInt(targetGroupAttr));
            }
        }
    }

    clearDropStyles();
    
    window.touchClone.remove();
    window.touchClone = null;
    window.activeTouchElement = null;
    window.draggedStudentNo = null;
    
    setTimeout(() => { window.isTouchDragging = false; }, 10);
};

window.handleDropLogic = function(draggedNo, targetGroup) {
    if (draggedNo === null || draggedNo === undefined) return;
    
    const students = classData[currentClass];
    const draggedIndex = students.findIndex(s => s.no === draggedNo);
    if (draggedIndex === -1) return;
    
    const draggedStudent = students[draggedIndex];
    let changed = false;

    clearDropStyles();

    if (targetGroup !== null) {
        let newGroup = targetGroup === 0 ? null : targetGroup;
        if (draggedStudent[`group_${currentGroupMode}`] !== newGroup) {
            draggedStudent[`group_${currentGroupMode}`] = newGroup;
            changed = true;
        }
    }
    
    if (changed) {
        normalizeGroupCaptains(currentGroupMode);
        saveData(); 
        window.renderStudentList(); 
    }
    window.renderGroups();
};

window.handleDragStart = function(e, studentNo) {
    window.isDraggingCard = true; window.draggedStudentNo = studentNo;
    window.selectedGroupStudent = null; 
    e.dataTransfer.effectAllowed = 'move';
    
    const student = classData[currentClass]?.find(s => s.no === studentNo);
    if (student && student[`group_${currentGroupMode}`] !== null && student[`group_${currentGroupMode}`] !== undefined) {
        window.showFloatingUnassigned();
    }
    
    window.currentDragY = e.clientY;
    window.startAutoScroll();
    
    setTimeout(() => { e.target.style.opacity = '0.4'; e.target.style.transform = 'scale(0.95)'; }, 0);
};

window.handleDragEnd = function(e) {
    window.isDraggingCard = false; window.draggedStudentNo = null;
    window.stopAutoScroll();
    window.dragOverUnassigned = false;
    window.hideFloatingUnassigned();
    e.target.style.opacity = '1'; e.target.style.transform = 'scale(1)'; 
    clearDropStyles();
};

window.handleDragOverGroup = function(e) { 
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; 
    e.currentTarget.classList.add('drop-target-active', 'ring-[5px]', 'ring-red-500', 'shadow-[0_0_20px_rgba(239,68,68,0.6)]', 'scale-[1.02]', 'z-20');
};
window.handleDragLeaveGroup = function(e) {
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drop-target-active', 'ring-[5px]', 'ring-red-500', 'shadow-[0_0_20px_rgba(239,68,68,0.6)]', 'scale-[1.02]', 'z-20');
    }
};

window.handleDropOnGroup = function(e, targetGroupId) {
    e.preventDefault();
    window.handleDropLogic(window.draggedStudentNo, targetGroupId);
    window.draggedStudentNo = null;
};

window.handleStudentCardClick = function(studentNo) {
    if (window.isTouchDragging) { window.isTouchDragging = false; return; } 
    window.toggleSelection(studentNo); 
};

window.handleGroupAreaClick = function(groupId) {
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

window.toggleHiddenClasses = function() {
    window.showHiddenClasses = !window.showHiddenClasses;
    window.renderClassSelect();
};

window.openManageModal = function() {
    document.getElementById('manage-modal').classList.remove('hidden');
    document.getElementById('manage-modal').classList.add('flex');
    window.renderClassSelect();
}

window.showClassSelectionScreen = function() {
    const appContainer = document.getElementById('app-container');
    const selectionScreen = document.getElementById('class-selection-screen');
    const manageModal = document.getElementById('manage-modal');
    if (appContainer) appContainer.classList.add('hidden');
    if (selectionScreen) selectionScreen.classList.remove('hidden');
    if (manageModal) { manageModal.classList.add('hidden'); manageModal.classList.remove('flex'); }
    window.renderClassLanding();
};

window.renderClassLanding = function() {
    const container = document.getElementById('class-selection-list');
    if (!container) return;
    container.replaceChildren();
    const deleteAllButton = document.getElementById('delete-all-classes-btn');
    const exportAllButton = document.getElementById('export-all-classes-btn');

    const isLoading = Boolean(userId && !hasLoadedRemoteData);
    if (deleteAllButton) deleteAllButton.disabled = isLoading;
    if (exportAllButton) exportAllButton.disabled = isLoading;
    document.querySelectorAll('#class-add-form input, #class-add-form button').forEach(control => {
        control.disabled = isLoading;
        control.classList.toggle('opacity-50', isLoading);
        control.classList.toggle('cursor-not-allowed', isLoading);
    });

    if (isLoading) {
        const loading = document.createElement('div');
        loading.className = 'sm:col-span-2 lg:col-span-3 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-10 text-center font-bold text-blue-600';
        loading.textContent = '학급 정보를 불러오는 중입니다…';
        container.appendChild(loading);
        return;
    }

    const classes = getSortedClasses();
    if (deleteAllButton) deleteAllButton.disabled = classes.length === 0 || isLoading;
    if (exportAllButton) exportAllButton.disabled = classes.length === 0 || isLoading;
    if (classes.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'sm:col-span-2 lg:col-span-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center';
        const title = document.createElement('p');
        title.className = 'font-black text-slate-500';
        title.textContent = '등록된 학급이 없습니다.';
        const hint = document.createElement('p');
        hint.className = 'mt-1 text-sm text-slate-400';
        hint.textContent = '아래 입력창에서 첫 학급을 추가하세요.';
        empty.append(title, hint);
        container.appendChild(empty);
        return;
    }

    classes.forEach((className) => {
        const card = document.createElement('article');
        card.className = 'group flex min-h-24 items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md';

        const selectButton = document.createElement('button');
        selectButton.type = 'button';
        selectButton.className = 'flex flex-1 items-center gap-3 px-4 py-4 text-left outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-100';
        selectButton.setAttribute('aria-label', `${className} 학급 선택`);
        selectButton.addEventListener('click', () => window.selectClass(className));

        const icon = document.createElement('span');
        icon.className = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl group-hover:bg-blue-100';
        icon.textContent = '🏫';
        const name = document.createElement('span');
        name.className = 'min-w-0 flex-1 truncate text-lg font-black text-slate-800';
        name.textContent = className;
        const arrow = document.createElement('span');
        arrow.className = 'text-lg font-black text-slate-300 group-hover:text-blue-500';
        arrow.textContent = '›';
        selectButton.append(icon, name, arrow);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'flex w-12 shrink-0 items-center justify-center border-l border-slate-100 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:bg-red-50 focus-visible:text-red-600';
        deleteButton.innerHTML = '<svg aria-hidden="true" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 7h12m-10 0 1 13h6l1-13M9 7V4h6v3" /></svg>';
        deleteButton.setAttribute('aria-label', `${className} 학급 삭제`);
        deleteButton.addEventListener('click', () => window.deleteClassFromSelection(className));

        card.append(selectButton, deleteButton);
        container.appendChild(card);
    });
};

window.addClassFromSelection = function() {
    if (!hasLoadedRemoteData) return;
    const input = document.getElementById('class-selection-new-input');
    const className = normalizeClassName(input?.value || '');
    if (!className) {
        input?.focus();
        return;
    }
    if (classData[className]) {
        window.showModal('학급 추가', '이미 등록된 학급입니다.');
        return;
    }

    classData[className] = [];
    groupScores[className] = { mixed2: {1:0, 2:0}, mixed3: {1:0, 2:0, 3:0}, mixed4: {1:0, 2:0, 3:0, 4:0}, gender: {1:0, 2:0, 3:0, 4:0} };
    groupRecords[className] = { mixed2: {}, mixed3: {}, mixed4: {}, gender: {} };
    classStamps[className] = Array(TOTAL_STAMP_CELLS).fill(false);
    groupPenalties[className] = { mixed2: {}, mixed3: {}, mixed4: {}, gender: {} };
    window.saveClassVisibility(className, true);
    saveData();
    input.value = '';
    window.renderClassSelect();
    window.renderClassLanding();
    input.focus();
};

function removeClassData(className) {
    delete classData[className];
    delete groupScores[className];
    delete groupRecords[className];
    delete classStamps[className];
    delete groupPenalties[className];
    Object.values(jumpRopeData).forEach(week => {
        if (week && typeof week === 'object') delete week[className];
    });
    localStorage.removeItem(`pinnedGroupMode_${className}`);

    const order = (JSON.parse(localStorage.getItem('classOrder')) || []).filter(name => name !== className);
    saveClassOrder(order);
    const visibility = JSON.parse(localStorage.getItem('classVisibility')) || {};
    delete visibility[className];
    localStorage.setItem('classVisibility', JSON.stringify(visibility));
}

window.deleteClassFromSelection = function(className) {
    if (!classData[className]) return;
    window.showModal(`학급 삭제: ${className}`, '이 학급의 학생 명단과 모든 수업 기록을 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.', true, () => {
        removeClassData(className);
        if (currentClass === className) currentClass = '';
        saveData({ immediate: true });
        window.renderClassSelect();
        window.renderClassLanding();
    }, '삭제');
};
window.closeManageModal = function() {
    document.getElementById('manage-modal').classList.add('hidden');
    document.getElementById('manage-modal').classList.remove('flex');
}

window.renderClassSelect = function() {
    const displayBtn = document.getElementById('current-class-display');
    window.renderClassLanding();
    const classes = getSortedClasses();
    if (currentClass && classes.includes(currentClass)) {
        if(displayBtn) displayBtn.textContent = `🏫 ${currentClass}`;
    } else { 
        if(displayBtn) displayBtn.innerHTML = "<span>⚙️ 설정 및 시작</span>";
    }
}

function createClassButtonDOM(cls, isVisible) {
    const btn = document.createElement('div');
    btn.setAttribute('draggable', 'true');
    btn.setAttribute('data-class-name', cls);
    
    let colorClass = "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300";
    if(currentClass === cls) colorClass = "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-200";
    if(!isVisible) colorClass = "bg-slate-100 border-dashed border-slate-300 text-slate-400 opacity-80 hover:bg-slate-200 hover:opacity-100";

    btn.className = `class-btn flex items-center justify-center px-4 py-2 font-black text-sm whitespace-nowrap outline-none rounded-xl border-2 shadow-sm transition cursor-grab ${colorClass}`;
    btn.innerText = cls;
    
    btn.onclick = function(e) { 
        if(window.isClassTouchDragging) { window.isClassTouchDragging = false; return; }
        window.selectClass(cls); 
        window.closeManageModal(); 
    }; 
    
    btn.ontouchstart = (e) => window.handleClassTouchStart(e, cls);
    btn.ontouchmove = window.handleClassTouchMove;
    btn.ontouchend = window.handleClassTouchEnd;
    
    btn.ondragstart = (e) => window.handleClassDragStart(e, cls);
    btn.ondragend = window.handleClassDragEnd;
    btn.ondragover = window.handleClassDragOver;
    btn.ondragleave = window.handleClassDragLeave;
    btn.ondrop = (e) => window.handleClassDropOnClass(e, cls);

    return btn;
}

// ==========================================
// 3. Firebase 로그인 및 연동 제어
// ==========================================
let userId = null; let appId = 'smart-class-manager'; 
let isDebouncing = false; let unsubscribeSnapshot = null;
let saveTimer = null; let saveInFlight = false; let saveRequested = false;
let hasLoadedRemoteData = false;
let pendingCloudPayload = null;
let latestLocalRevision = 0;
let latestSyncedRevision = 0;
let latestRecoveryRecord = null;
let syncStatusHideTimer = null;

const RECOVERY_DB_NAME = 'smart-class-manager-recovery';
const RECOVERY_STORE_NAME = 'snapshots';
const RECOVERY_RECORD_KEY = 'latest';
const EMERGENCY_RECOVERY_KEY = 'smart_class_emergency_recovery_v1';
const RECOVERY_SCHEMA_VERSION = 1;
let recoveryDbPromise = null;

function setSyncStatus(state, label) {
    const status = document.getElementById('sync-status');
    const icon = document.getElementById('sync-status-icon');
    const labelEl = document.getElementById('sync-status-label');
    if (!status || !icon || !labelEl) return;

    clearTimeout(syncStatusHideTimer);
    status.classList.remove('hidden', 'border-blue-100', 'bg-blue-50', 'text-blue-600', 'border-amber-200', 'bg-amber-50', 'text-amber-700', 'border-emerald-200', 'bg-emerald-50', 'text-emerald-700', 'border-red-200', 'bg-red-50', 'text-red-700');
    status.classList.add('flex');
    icon.classList.toggle('animate-spin', state === 'syncing');

    const styles = {
        syncing: ['border-blue-100', 'bg-blue-50', 'text-blue-600', '↻'],
        offline: ['border-amber-200', 'bg-amber-50', 'text-amber-700', '●'],
        saved: ['border-emerald-200', 'bg-emerald-50', 'text-emerald-700', '✓'],
        error: ['border-red-200', 'bg-red-50', 'text-red-700', '!']
    };
    const [border, background, color, symbol] = styles[state] || styles.syncing;
    status.classList.add(border, background, color);
    icon.textContent = symbol;
    labelEl.textContent = label;

    if (state === 'saved') {
        syncStatusHideTimer = setTimeout(() => {
            status.classList.add('hidden');
            status.classList.remove('flex');
        }, 1800);
    }
}

function createAppPayload(revision = latestLocalRevision) {
    return {
        data: classData,
        scores: groupScores,
        records: groupRecords,
        stamps: classStamps,
        stampImage: globalStampImage,
        penalties: groupPenalties,
        jumpRope: jumpRopeData,
        syncMeta: {
            revision,
            updatedAt: new Date().toISOString(),
            deviceId: getRecoveryDeviceId()
        }
    };
}

function cloneAppPayload(payload) {
    return typeof structuredClone === 'function' ? structuredClone(payload) : JSON.parse(JSON.stringify(payload));
}

function applyAppPayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    classData = payload.data || {};
    groupScores = payload.scores || {};
    groupRecords = payload.records || {};
    classStamps = payload.stamps || {};
    groupPenalties = payload.penalties || {};
    jumpRopeData = payload.jumpRope || {};
    if (payload.stampImage) {
        globalStampImage = payload.stampImage;
        localStorage.setItem('customStamp', globalStampImage);
    }
    migrateData();
    return true;
}

function mergeAppPayloads(serverPayload, localPayload, revision) {
    const mergeMap = (serverValue, localValue) => ({ ...(serverValue || {}), ...(localValue || {}) });
    const mergedJumpRope = { ...(serverPayload.jumpRope || {}) };
    Object.entries(localPayload.jumpRope || {}).forEach(([week, classes]) => {
        mergedJumpRope[week] = { ...(mergedJumpRope[week] || {}), ...(classes || {}) };
    });
    return cloneAppPayload({
        data: mergeMap(serverPayload.data, localPayload.data),
        scores: mergeMap(serverPayload.scores, localPayload.scores),
        records: mergeMap(serverPayload.records, localPayload.records),
        stamps: mergeMap(serverPayload.stamps, localPayload.stamps),
        stampImage: localPayload.stampImage || serverPayload.stampImage || globalStampImage,
        penalties: mergeMap(serverPayload.penalties, localPayload.penalties),
        jumpRope: mergedJumpRope,
        syncMeta: { revision, updatedAt: new Date().toISOString(), deviceId: getRecoveryDeviceId(), mergedConflict: true }
    });
}

function getRecoveryDeviceId() {
    const key = 'smart_class_recovery_device_id';
    let value = localStorage.getItem(key);
    if (!value) {
        value = (crypto.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        localStorage.setItem(key, value);
    }
    return value;
}

function nextLocalRevision() {
    latestLocalRevision = Math.max(Date.now(), latestLocalRevision + 1);
    return latestLocalRevision;
}

function openRecoveryDatabase() {
    if (recoveryDbPromise) return recoveryDbPromise;
    recoveryDbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error('IndexedDB를 지원하지 않는 브라우저입니다.')); return; }
        const request = indexedDB.open(RECOVERY_DB_NAME, 1);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(RECOVERY_STORE_NAME)) database.createObjectStore(RECOVERY_STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('로컬 복구 저장소를 열 수 없습니다.'));
    });
    return recoveryDbPromise;
}

async function persistRecoveryRecord(record) {
    latestRecoveryRecord = record;
    const database = await openRecoveryDatabase();
    await new Promise((resolve, reject) => {
        const transaction = database.transaction(RECOVERY_STORE_NAME, 'readwrite');
        transaction.objectStore(RECOVERY_STORE_NAME).put(record, RECOVERY_RECORD_KEY);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('로컬 복구본을 저장하지 못했습니다.'));
        transaction.onabort = () => reject(transaction.error || new Error('로컬 복구 저장이 중단되었습니다.'));
    });
}

async function archiveConflictRecord(record, label) {
    try {
        const database = await openRecoveryDatabase();
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(RECOVERY_STORE_NAME, 'readwrite');
            transaction.objectStore(RECOVERY_STORE_NAME).put(record, `conflict-${Date.now()}-${label}`);
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error || new Error('충돌 복구본 저장 실패'));
        });
    } catch (error) {
        console.warn('충돌 복구본을 별도로 보관하지 못했습니다:', error);
    }
}

async function readIndexedRecoveryRecord() {
    const database = await openRecoveryDatabase();
    return new Promise((resolve, reject) => {
        const request = database.transaction(RECOVERY_STORE_NAME, 'readonly').objectStore(RECOVERY_STORE_NAME).get(RECOVERY_RECORD_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('로컬 복구본을 읽지 못했습니다.'));
    });
}

function writeEmergencyRecovery(record) {
    try {
        localStorage.setItem(EMERGENCY_RECOVERY_KEY, JSON.stringify(record));
        return true;
    } catch (error) {
        console.error('긴급 로컬 백업 실패:', error);
        setSyncStatus('error', '기기 저장 실패');
        return false;
    }
}

function readEmergencyRecovery() {
    try {
        const raw = localStorage.getItem(EMERGENCY_RECOVERY_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('긴급 복구본을 읽지 못했습니다:', error);
        return null;
    }
}

function stageLocalRecovery(payload) {
    const record = {
        schemaVersion: RECOVERY_SCHEMA_VERSION,
        revision: payload.syncMeta.revision,
        savedAt: Date.now(),
        dirty: true,
        payload
    };
    latestRecoveryRecord = record;
    void persistRecoveryRecord(record).catch(error => {
        console.error('IndexedDB 로컬 백업 실패:', error);
        writeEmergencyRecovery(record);
    });
    return record;
}

async function markRecoverySynced(revision) {
    if (!latestRecoveryRecord || latestRecoveryRecord.revision > revision) return;
    const cleanRecord = { ...latestRecoveryRecord, dirty: false, syncedAt: Date.now() };
    latestRecoveryRecord = cleanRecord;
    try { await persistRecoveryRecord(cleanRecord); } catch (error) { console.warn('동기화 상태 저장 실패:', error); }
    const emergency = readEmergencyRecovery();
    if (!emergency || (Number(emergency.revision) || 0) <= revision) localStorage.removeItem(EMERGENCY_RECOVERY_KEY);
}

async function cacheCleanServerRecovery(payload, revision) {
    const record = {
        schemaVersion: RECOVERY_SCHEMA_VERSION,
        revision,
        savedAt: Date.now(),
        syncedAt: Date.now(),
        dirty: false,
        payload: cloneAppPayload(payload)
    };
    try { await persistRecoveryRecord(record); } catch (error) { console.warn('서버 자료의 로컬 복구본 저장 실패:', error); }
}

async function restoreLatestRecovery() {
    let indexedRecord = null;
    try { indexedRecord = await readIndexedRecoveryRecord(); } catch (error) { console.warn('IndexedDB 복구본 사용 불가:', error); }
    const emergencyRecord = readEmergencyRecovery();
    const candidates = [indexedRecord, emergencyRecord].filter(record => record?.payload && record.schemaVersion === RECOVERY_SCHEMA_VERSION);
    if (candidates.length === 0) return null;
    const record = candidates.sort((a, b) => (Number(b.revision) || 0) - (Number(a.revision) || 0))[0];
    latestRecoveryRecord = record;
    latestLocalRevision = Math.max(latestLocalRevision, Number(record.revision) || 0);
    applyAppPayload(record.payload);
    hasLoadedRemoteData = true;
    window.renderClassSelect();
    window.renderClassLanding();
    if (record.dirty) {
        pendingCloudPayload = record.payload;
        saveRequested = true;
        isDebouncing = true;
        setSyncStatus(navigator.onLine ? 'syncing' : 'offline', navigator.onLine ? '복구 자료 저장 중' : '기기에 안전하게 저장됨');
    }
    return record;
}

window.signInWithGoogle = function() {
    const btn = document.getElementById('btn-login');
    const message = document.getElementById('login-message');
    if (message) { message.classList.add('hidden'); message.textContent = ''; }
    btn.disabled = true;
    btn.textContent = '로그인 중...';
    signInWithPopup(auth, provider).catch((error) => {
        console.error('로그인 실패:', error);
        if (message) {
            message.textContent = '로그인하지 못했습니다. 팝업 허용 여부와 네트워크를 확인해주세요.';
            message.classList.remove('hidden');
        }
        btn.disabled = false;
        btn.textContent = 'Google 계정으로 시작하기';
    });
};

window.signOutApp = function() {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    clearSensitiveLocalData();
    signOut(auth);
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const email = (user.email || '').toLowerCase();
        if (!user.emailVerified || email !== ALLOWED_EMAIL) {
            const message = document.getElementById('login-message');
            if (message) {
                message.textContent = `${ALLOWED_EMAIL} 계정만 이용할 수 있습니다.`;
                message.classList.remove('hidden');
            }
            clearSensitiveLocalData();
            signOut(auth);
            return;
        }

        userId = user.uid;
        hasLoadedRemoteData = false;
        currentClass = '';
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('class-selection-screen').classList.remove('hidden');
        
        const emailEl = document.getElementById('user-email');
        if(emailEl) emailEl.innerText = email;
        const selectionUser = document.getElementById('class-selection-user');
        if(selectionUser) selectionUser.textContent = email;
        
        document.getElementById('tab-navigation').classList.add('hidden');
        document.getElementById('tab-navigation').classList.remove('flex');
        document.getElementById('logout-btn').classList.remove('hidden');
        const toolsBtn = document.getElementById('class-tools-btn');
        if (toolsBtn) toolsBtn.classList.add('hidden');
        
        const persistenceEnabled = await firestorePersistenceReady;
        if (auth.currentUser?.uid !== user.uid) return;
        const recoveredRecord = await restoreLatestRecovery();
        setupFirestoreListener();
        if (recoveredRecord?.dirty) {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(flushSaveData, 0);
        } else if (!persistenceEnabled || !firestorePersistenceState.enabled) {
            setSyncStatus('error', '오프라인 저장 제한');
        }
        window.renderClassLanding();
    } else {
        userId = null;
        hasLoadedRemoteData = false;
        clearTimeout(saveTimer);
        saveTimer = null;
        saveRequested = false;
        saveInFlight = false;
        pendingCloudPayload = null;
        isDebouncing = false;
        if(unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('class-selection-screen').classList.add('hidden');
        document.getElementById('tab-navigation').classList.add('hidden');
        document.getElementById('tab-navigation').classList.remove('flex');
        document.getElementById('logout-btn').classList.add('hidden');
        const toolsBtn = document.getElementById('class-tools-btn');
        if (toolsBtn) toolsBtn.classList.add('hidden');
        const loginBtn = document.getElementById('btn-login');
        if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Google 계정으로 시작하기'; }
        
        classData = {}; groupScores = {}; groupRecords = {}; classStamps = {}; activeTimers = {}; groupPenalties = {}; jumpRopeData = {};
        currentClass = ""; window.renderClassSelect();
    }
});

function setupFirestoreListener() {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', 'running-measurement-app', 'sharedRooms', 'dongsan-school-db');
    if (unsubscribeSnapshot) unsubscribeSnapshot(); 
    setSyncStatus(navigator.onLine ? 'syncing' : 'offline', navigator.onLine ? '자료 확인 중' : '오프라인 · 기기 저장');

    unsubscribeSnapshot = onSnapshot(docRef, { includeMetadataChanges: true }, (docSnap) => {
        hasLoadedRemoteData = true;
        const hasPendingWrites = docSnap.metadata.hasPendingWrites;
        const fromCache = docSnap.metadata.fromCache;
        if (hasPendingWrites || isDebouncing) {
            setSyncStatus(navigator.onLine ? 'syncing' : 'offline', navigator.onLine ? 'Firebase 저장 중' : '오프라인 · 기기 저장됨');
        } else if (fromCache && !navigator.onLine) {
            setSyncStatus('offline', '오프라인 · 기기 저장됨');
        }
        if (docSnap.exists()) {
            const data = docSnap.data();
            const serverRevision = Number(data.syncMeta?.revision) || 0;
            const localDirty = Boolean(latestRecoveryRecord?.dirty);
            const localRevision = Number(latestRecoveryRecord?.revision) || 0;
            const otherDeviceConflict = localDirty && !hasPendingWrites && serverRevision > localRevision
                && data.syncMeta?.deviceId && data.syncMeta.deviceId !== getRecoveryDeviceId();

            if (otherDeviceConflict) {
                void archiveConflictRecord(latestRecoveryRecord, 'local');
                void archiveConflictRecord({ schemaVersion: RECOVERY_SCHEMA_VERSION, revision: serverRevision, savedAt: Date.now(), dirty: false, payload: data }, 'server');
                latestLocalRevision = Math.max(Date.now(), serverRevision + 1, latestLocalRevision + 1);
                const mergedPayload = mergeAppPayloads(data, latestRecoveryRecord.payload, latestLocalRevision);
                applyAppPayload(mergedPayload);
                pendingCloudPayload = mergedPayload;
                stageLocalRecovery(mergedPayload);
                saveRequested = true;
                isDebouncing = true;
                setSyncStatus('syncing', '다른 기기 자료와 병합 중');
                if (navigator.onLine && !saveInFlight) {
                    clearTimeout(saveTimer);
                    saveTimer = setTimeout(flushSaveData, 0);
                }
            } else if (!localDirty || serverRevision >= localRevision) {
                applyAppPayload(data);
                latestLocalRevision = Math.max(latestLocalRevision, serverRevision);
            }

            if (!otherDeviceConflict && !hasPendingWrites && !fromCache && serverRevision >= localRevision) {
                latestSyncedRevision = Math.max(latestSyncedRevision, serverRevision);
                if (localDirty && serverRevision === localRevision) void markRecoverySynced(serverRevision);
                else void cacheCleanServerRecovery(data, serverRevision);
                if (!saveRequested && !saveInFlight) setSyncStatus('saved', 'Firebase 저장 완료');
            }
        } else if (!latestRecoveryRecord?.dirty) {
            classData = {}; groupScores = {}; groupRecords = {}; classStamps = {}; groupPenalties = {}; jumpRopeData = {};
        }
        window.renderClassSelect();
        if (currentClass && classData[currentClass]) {
            window.renderStudentList();
            if(typeof window.renderGroups === 'function') window.renderGroups();
            if(typeof window.renderStampBoard === 'function') window.renderStampBoard();
            if(currentTab === 'jumprope' && typeof window.renderJumpRopeTab === 'function') window.renderJumpRopeTab();
        } else if (currentClass && !classData[currentClass]) {
            currentClass = "";
            const display = document.getElementById('current-class-display');
            if (display) display.innerHTML = "<span>⚙️ 설정 및 시작</span>";
            ['student-management', 'group-section', 'stamp-section', 'jumprope-section'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
        }
    }, (error) => {
        console.error("데이터 동기화 오류:", error);
        hasLoadedRemoteData = true;
        window.renderClassLanding();
        setSyncStatus(navigator.onLine ? 'error' : 'offline', navigator.onLine ? 'Firebase 연결 오류' : '오프라인 · 기기 저장');
    });
}

function saveData({ immediate = false } = {}) {
    if ("" in classData) delete classData[""]; if ("" in groupScores) delete groupScores[""];
    if ("" in groupRecords) delete groupRecords[""]; if ("" in classStamps) delete classStamps[""]; if ("" in groupPenalties) delete groupPenalties[""];

    if (!userId || !db) return Promise.resolve(false);
    const revision = nextLocalRevision();
    const payload = cloneAppPayload(createAppPayload(revision));
    pendingCloudPayload = payload;
    stageLocalRecovery(payload);
    saveRequested = true;
    isDebouncing = true;
    setSyncStatus(navigator.onLine ? 'syncing' : 'offline', navigator.onLine ? 'Firebase 저장 중' : '오프라인 · 기기 저장됨');
    clearTimeout(saveTimer);
    if (immediate) {
        saveTimer = null;
        return flushSaveData();
    } else {
        saveTimer = setTimeout(flushSaveData, 300);
        return Promise.resolve(true);
    }
}

async function writeAppData(docRef, payload) {
    try {
        // 각 최상위 앱 필드는 통째로 교체해 삭제된 학급을 확실히 반영하고,
        // 같은 문서에 남아 있는 다른 프로그램의 최상위 필드는 보존합니다.
        await updateDoc(docRef, payload);
    } catch (error) {
        if (!['not-found', 'firestore/not-found'].includes(error?.code)) throw error;
        await setDoc(docRef, payload);
    }
}

async function flushSaveData() {
    if (!userId || !db || saveInFlight || !saveRequested) return;
    saveRequested = false;
    saveInFlight = true;
    const payload = pendingCloudPayload || cloneAppPayload(createAppPayload(nextLocalRevision()));
    pendingCloudPayload = null;
    const revision = Number(payload.syncMeta?.revision) || 0;
    let writeSucceeded = false;

    try {
        const payloadBytes = new Blob([JSON.stringify(payload)]).size;
        if (payloadBytes > 900_000) {
            throw new Error('저장 데이터가 Firestore 문서 크기 제한에 가까워졌습니다.');
        }
        const docRef = doc(db, 'artifacts', 'running-measurement-app', 'sharedRooms', 'dongsan-school-db');
        await writeAppData(docRef, payload);
        writeSucceeded = true;
        latestSyncedRevision = Math.max(latestSyncedRevision, revision);
        await markRecoverySynced(revision);
    } catch (error) {
        console.error('클라우드 자동 저장 실패:', error);
        const retryable = !navigator.onLine || ['unavailable', 'firestore/unavailable', 'deadline-exceeded', 'firestore/deadline-exceeded'].includes(error?.code);
        if (retryable) {
            if (!pendingCloudPayload || (Number(pendingCloudPayload.syncMeta?.revision) || 0) < revision) pendingCloudPayload = payload;
            saveRequested = true;
            setSyncStatus('offline', '기기에 저장됨 · 재연결 대기');
        } else {
            isDebouncing = false;
            setSyncStatus('error', 'Firebase 저장 실패');
            window.showModal('저장 실패', `${escapeHTML(error.message || 'Firebase에 저장하지 못했습니다.')}<br><span class="font-bold text-amber-600">입력 내용은 이 기기의 복구 저장소에 보관했습니다.</span>`);
        }
    } finally {
        saveInFlight = false;
        if (saveRequested && navigator.onLine) {
            saveTimer = setTimeout(flushSaveData, 100);
        } else if (!saveRequested && writeSucceeded) {
            isDebouncing = false;
            setSyncStatus('saved', 'Firebase 저장 완료');
        }
    }
}

// ==========================================
// 8자 줄넘기 기능 구현 (신규 탭 - 모드 및 그래프 추가)
// ==========================================
function getJumpRopeWeekValue(date = new Date()) {
    const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const month = safeDate.getMonth() + 1;
    const week = Math.min(5, Math.floor((safeDate.getDate() - 1) / 7) + 1);
    return `${month}월 ${week}주차`;
}

function initJumpRopeWeeks() {
    const select = document.getElementById('jumprope-week-select');
    if (!select) return;
    let html = '';
    // 1월부터 12월까지 모든 월 출력 (학기 구분 텍스트 제거)
    for(let m = 1; m <= 12; m++) {
        for(let w = 1; w <= 5; w++) {
            let val = `${m}월 ${w}주차`;
            html += `<option value="${val}">${val}</option>`;
        }
    }
    select.innerHTML = html;
    
    select.value = getJumpRopeWeekValue(new Date());
}
document.addEventListener('DOMContentLoaded', initJumpRopeWeeks);

window.renderJumpRopeTab = function() {
    if (!currentClass) return;
    const week = document.getElementById('jumprope-week-select').value;
    
    let match = currentClass.match(/^(\d+)/);
    let currentGradeStr = match ? match[1] : null;
    const badge = document.getElementById('jumprope-grade-badge');
    if (badge) {
        if (currentGradeStr) { badge.innerText = `${currentGradeStr}학년`; badge.classList.remove('hidden'); }
        else { badge.classList.add('hidden'); }
    }

    if (!jumpRopeData[week]) jumpRopeData[week] = {};
    if (!jumpRopeData[week][currentClass]) jumpRopeData[week][currentClass] = { male: null, female: null };

    document.getElementById('jumprope-male-input').value = jumpRopeData[week][currentClass].male !== null ? jumpRopeData[week][currentClass].male : '';
    document.getElementById('jumprope-female-input').value = jumpRopeData[week][currentClass].female !== null ? jumpRopeData[week][currentClass].female : '';

    const maleRanking = [];
    const femaleRanking = [];

    if (currentGradeStr) {
        Object.keys(jumpRopeData[week]).forEach(cls => {
            let m = cls.match(/^(\d+)/);
            if (m && m[1] === currentGradeStr) {
                let d = jumpRopeData[week][cls];
                if (d.male !== null && d.male > 0) maleRanking.push({ cls, score: d.male });
                if (d.female !== null && d.female > 0) femaleRanking.push({ cls, score: d.female });
            }
        });
    } else {
        let d = jumpRopeData[week][currentClass];
        if (d.male !== null && d.male > 0) maleRanking.push({ cls: currentClass, score: d.male });
        if (d.female !== null && d.female > 0) femaleRanking.push({ cls: currentClass, score: d.female });
    }

    maleRanking.sort((a, b) => b.score - a.score);
    femaleRanking.sort((a, b) => b.score - a.score);

    const renderList = (arr, listId) => {
        const ul = document.getElementById(listId);
        if (arr.length === 0) { ul.innerHTML = '<li class="text-slate-400 text-[11px] text-center py-2">아직 기록된 반이 없습니다.</li>'; return; }
        
        let html = '';
        arr.forEach((item, idx) => {
            let medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `<span class="text-slate-400 font-normal ml-1 mr-1.5">${idx+1}</span>`));
            let highlight = item.cls === currentClass ? 'bg-yellow-100 font-black text-yellow-800 rounded' : 'text-slate-700';
            
            // 랭킹 보상 도장 아이콘
            let reward = '';
            if(idx === 0) reward = '<span class="text-xs ml-1 tracking-tighter">💮💮💮</span>';
            else if(idx === 1) reward = '<span class="text-xs ml-1 tracking-tighter">💮💮</span>';
            else if(idx === 2) reward = '<span class="text-xs ml-1 tracking-tighter">💮</span>';

            html += `
                <li class="flex justify-between items-center px-2 py-1 ${highlight}">
                    <div class="flex items-center gap-1"><span>${medal}</span> <span>${escapeHTML(item.cls)}</span> ${reward}</div>
                    <span class="font-black">${item.score}개</span>
                </li>`;
        });
        ul.innerHTML = html;
    };

    renderList(maleRanking, 'jumprope-male-ranking');
    renderList(femaleRanking, 'jumprope-female-ranking');

};

window.openJumpRopeAnalysisModal = function() {
    if (!currentClass) return window.showModal('알림', '학급을 선택해주세요.');
    let maleData = []; let femaleData = []; let labels = [];
    let maxScore = 0; let minScore = Infinity; let hasData = false;

    // 그래프 출력을 위해 1월 1주차부터 순서대로 탐색
    for(let m=1; m<=12; m++) {
        for(let w=1; w<=5; w++) {
            let wk = `${m}월 ${w}주차`;
            if (jumpRopeData[wk] && jumpRopeData[wk][currentClass]) {
                let d = jumpRopeData[wk][currentClass];
                if (d.male !== null || d.female !== null) {
                    labels.push(wk);
                    let mScore = d.male || 0; let fScore = d.female || 0;
                    maleData.push(mScore); femaleData.push(fScore);
                    if(mScore > 0 || fScore > 0) hasData = true;
                    if(mScore > maxScore) maxScore = mScore;
                    if(fScore > maxScore) maxScore = fScore;
                    if(mScore > 0 && mScore < minScore) minScore = mScore;
                    if(fScore > 0 && fScore < minScore) minScore = fScore;
                }
            }
        }
    }

    if (!hasData) return window.showModal('기록 분석', '아직 입력된 줄넘기 기록이 없습니다.');
    if (minScore === Infinity) minScore = 0;

    let html = `<div class="flex flex-col gap-4 w-full">
        <div class="flex justify-between bg-slate-100 p-3 rounded-lg text-sm shadow-inner border border-slate-200">
            <div class="font-bold text-slate-700">🏆 최고 기록: <span class="text-blue-600">${maxScore}개</span></div>
            <div class="font-bold text-slate-700">📉 최저 기록: <span class="text-red-500">${minScore}개</span></div>
        </div>
        <div class="flex items-end gap-3 overflow-x-auto pb-2 h-48 border-b-2 border-slate-300 w-full whitespace-nowrap pt-4">`;

    labels.forEach((w, i) => {
        let mH = maxScore > 0 ? (maleData[i] / maxScore * 100) : 0;
        let fH = maxScore > 0 ? (femaleData[i] / maxScore * 100) : 0;
        html += `<div class="flex flex-col items-center gap-1 min-w-[50px] shrink-0">
            <div class="flex items-end gap-1 w-full h-36 justify-center">
                <div class="w-4 bg-blue-400 rounded-t-sm relative group flex items-end justify-center transition-all hover:bg-blue-500" style="height: ${mH}%">
                    <span class="absolute -top-5 text-[10px] hidden group-hover:block bg-slate-800 text-white px-1 rounded z-10">${maleData[i]}</span>
                </div>
                <div class="w-4 bg-pink-400 rounded-t-sm relative group flex items-end justify-center transition-all hover:bg-pink-500" style="height: ${fH}%">
                    <span class="absolute -top-5 text-[10px] hidden group-hover:block bg-slate-800 text-white px-1 rounded z-10">${femaleData[i]}</span>
                </div>
            </div>
            <span class="text-[10px] font-bold text-slate-500 w-full text-center mt-1">${w.replace('주차','')}</span>
        </div>`;
    });

    html += `</div>
        <div class="flex justify-center gap-4 text-xs mt-2 font-bold text-slate-600">
            <span class="flex items-center gap-1.5"><div class="w-3 h-3 bg-blue-400 rounded-sm shadow-sm"></div> 남학생</span>
            <span class="flex items-center gap-1.5"><div class="w-3 h-3 bg-pink-400 rounded-sm shadow-sm"></div> 여학생</span>
        </div>
    </div>`;

    window.showModal(`📊 ${currentClass} 줄넘기 기록 현황`, html);
};

window.saveJumpRopeRecord = function() {
    if (!currentClass) return;
    const week = document.getElementById('jumprope-week-select').value;
    const mVal = parseInt(document.getElementById('jumprope-male-input').value);
    const fVal = parseInt(document.getElementById('jumprope-female-input').value);

    if (!jumpRopeData[week]) jumpRopeData[week] = {};
    if (!jumpRopeData[week][currentClass]) jumpRopeData[week][currentClass] = { male: null, female: null };

    jumpRopeData[week][currentClass].male = isNaN(mVal) ? null : mVal;
    jumpRopeData[week][currentClass].female = isNaN(fVal) ? null : fVal;

    saveData();
    window.renderJumpRopeTab();
    window.playCoinSound();
    window.showModal("저장 완료", `<b>${week}</b> 기록이 성공적으로 저장되었습니다.`);
};

window.editJumpRopeTimerTarget = function() {
    if (jumpRopeInterval) {
        window.showModal('타이머 설정', '측정을 일시정지한 뒤 목표 시간을 변경해주세요.');
        return;
    }
    const currentSeconds = Math.max(1, Math.round(jumpRopeTargetMs / 1000));
    const input = prompt('목표 시간을 초 또는 분:초 형식으로 입력하세요. (예: 60 또는 1:00)', String(currentSeconds));
    if (input === null || input.trim() === '') return;
    const parsed = window.parseTime(input);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        window.showModal('타이머 설정', '0보다 큰 올바른 시간을 입력해주세요.');
        return;
    }
    jumpRopeTimerMode = 'timer';
    jumpRopeTargetMs = parsed;
    jumpRopeTimerMs = parsed;
    document.getElementById('jumprope-timer-display').innerText = window.formatTime(jumpRopeTimerMs);
};

function jumpRopeTimerLoop() {
    if(jumpRopeInterval) {
        let elapsed = Date.now() - jumpRopeTimerStart;
        if (jumpRopeTimerMode === 'timer') {
            jumpRopeTimerMs = jumpRopeTargetMs - elapsed;
            if (jumpRopeTimerMs <= 0) {
                jumpRopeTimerMs = 0;
                jumpRopeInterval = false;
                document.getElementById('jumprope-timer-display').innerText = window.formatTime(0);
                const btn = document.getElementById('jumprope-timer-btn');
                if (btn) {
                    btn.innerText = '시작';
                    btn.className = "flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl transition shadow-md text-sm sm:text-base";
                }
                try { window.playOlympicFanfare(); } catch(e){}
                return; 
            }
        } else {
            jumpRopeTimerMs = elapsed;
        }
        document.getElementById('jumprope-timer-display').innerText = window.formatTime(jumpRopeTimerMs);
        requestAnimationFrame(jumpRopeTimerLoop);
    }
}

window.toggleJumpRopeTimer = function() {
    const btn = document.getElementById('jumprope-timer-btn');
    if (jumpRopeInterval) {
        jumpRopeInterval = false;
        btn.innerText = '시작';
        btn.className = "flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl transition shadow-md text-sm sm:text-base";
    } else {
        jumpRopeInterval = true;
        if (jumpRopeTimerMode === 'timer') {
            if (jumpRopeTimerMs <= 0) jumpRopeTimerMs = jumpRopeTargetMs;
            jumpRopeTimerStart = Date.now() - (jumpRopeTargetMs - jumpRopeTimerMs);
        } else {
            jumpRopeTimerStart = Date.now() - jumpRopeTimerMs;
        }
        requestAnimationFrame(jumpRopeTimerLoop);
        btn.innerText = '일시정지';
        btn.className = "flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black py-3 rounded-xl transition shadow-md text-sm sm:text-base";
    }
};

window.resetJumpRopeTimer = function() {
    jumpRopeInterval = false;
    jumpRopeTimerMs = jumpRopeTimerMode === 'timer' ? jumpRopeTargetMs : 0;
    document.getElementById('jumprope-timer-display').innerText = window.formatTime(jumpRopeTimerMs);
    const btn = document.getElementById('jumprope-timer-btn');
    btn.innerText = '시작';
    btn.className = "flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl transition shadow-md text-sm sm:text-base";
};

window.updateJumpRopeCountUI = function() {
    document.getElementById('jumprope-counter-value').innerText = jumpRopeCount;
    document.getElementById('jumprope-counter-display').classList.remove('scale-95');
    void document.getElementById('jumprope-counter-display').offsetWidth;
    document.getElementById('jumprope-counter-display').classList.add('scale-95');
    setTimeout(() => { document.getElementById('jumprope-counter-display').classList.remove('scale-95'); }, 100);
}

window.incrementJumpRopeCount = function() {
    jumpRopeCount++;
    window.updateJumpRopeCountUI();
    try {
        const ctx = initAudio();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'sine'; osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
    } catch(e) {}
};

window.decrementJumpRopeCount = function() {
    if (jumpRopeCount > 0) { jumpRopeCount--; window.updateJumpRopeCountUI(); }
};

window.resetJumpRopeCount = function() {
    jumpRopeCount = 0; window.updateJumpRopeCountUI();
};
// ==========================================
// 4. 최적화된 도장판 렌더링 로직
// ==========================================
window.renderStampBoard = () => {
    if (!currentClass) return; 
    
    if (!classStamps[currentClass]) classStamps[currentClass] = Array(TOTAL_STAMP_CELLS).fill(false);

    let stampedCount = classStamps[currentClass].filter(Boolean).length;
    
    const countEl = document.getElementById('big-stamp-count');
    const placeholder = document.getElementById('stamp-placeholder');
    const bigImg = document.getElementById('big-stamp-img');

    if (countEl) countEl.innerText = `X ${stampedCount}`;

    if (stampedCount === 0) {
        bigImg.classList.add('hidden');
        placeholder.classList.remove('hidden');
    } else if (stampedCount >= TOTAL_STAMP_CELLS) {
        bigImg.src = 'images/stamps/complete01.jpg';
        bigImg.classList.remove('hidden');
        placeholder.classList.add('hidden');
    } else {
        bigImg.src = globalStampImage;
        bigImg.classList.remove('hidden');
        placeholder.classList.add('hidden');
    }
};

window.addOneStamp = () => {
    if (!currentClass || !classStamps[currentClass]) {
        window.showModal("알림", "학급을 먼저 선택해주세요.");
        return;
    }
    let currentCount = classStamps[currentClass].filter(Boolean).length;
    
    if (currentCount < TOTAL_STAMP_CELLS) {
        classStamps[currentClass][currentCount] = true;
        
        const img = document.getElementById('big-stamp-img');
        if(img) {
            img.classList.remove('animate-pop-in');
            void img.offsetWidth; 
            img.classList.add('animate-pop-in');
        }
        
        window.playStampSound();
        saveData();
        window.renderStampBoard();
        
        if (currentCount + 1 === TOTAL_STAMP_CELLS) {
            setTimeout(() => window.playOlympicFanfare(), 300);
            window.fireConfetti();
        }
    }
};

window.removeOneStamp = () => {
    if (!currentClass || !classStamps[currentClass]) return;
    let currentCount = classStamps[currentClass].filter(Boolean).length;
    if (currentCount > 0) {
        classStamps[currentClass][currentCount - 1] = false;
        window.playEraseSound();
        saveData();
        window.renderStampBoard();
    }
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

window.openMemoModal = function(studentNo) {
    currentEditingStudentNo = studentNo;
    const student = classData[currentClass].find(s => s.no === studentNo);
    if (!student) return;
    document.getElementById('memo-modal-name').innerText = student.name;
    document.getElementById('memo-modal-input').value = student.memo || '';
    
    document.getElementById('memo-modal').classList.remove('hidden');
    document.getElementById('memo-modal').classList.add('flex');
    setTimeout(() => document.getElementById('memo-modal-input')?.focus(), 0);
}

window.closeMemoModal = function() {
    if (currentEditingStudentNo !== null) window.saveMemoImmediately();
    document.getElementById('memo-modal').classList.add('hidden');
    document.getElementById('memo-modal').classList.remove('flex');
    currentEditingStudentNo = null;
    window.renderStudentList();
}

window.saveMemoImmediately = function() {
    if (currentEditingStudentNo === null) return;
    const student = classData[currentClass].find(s => s.no === currentEditingStudentNo);
    if (student) {
        student.memo = document.getElementById('memo-modal-input').value;
        saveData();
    }
}

window.cyclePenaltyCard = function(studentNo) {
    if (!currentClass || !classData[currentClass]) return;
    const student = classData[currentClass].find(s => s.no === studentNo);
    if (student) {
        normalizePenaltyCardState(student);
        student.penaltyCard = (student.penaltyCard + 1) % 4;
        if (student.penaltyCard === 1) window.showPenaltyCard('verbal');
        else if (student.penaltyCard === 2) window.showPenaltyCard('yellow');
        else if (student.penaltyCard === 3) window.showPenaltyCard('red');
        else window.playEraseSound();
        saveData();
        window.renderGroups();
    }
};

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
    const sel = document.getElementById('draw-group-count');
    if(!sel) return;
}

function normalizePenaltyCardState(student) {
    let level = Math.max(0, Number.parseInt(student?.penaltyCard, 10) || 0);
    if (student.penaltyCardSystem !== PENALTY_CARD_SYSTEM_VERSION) {
        level = level === 1 ? 2 : (level === 2 ? 3 : 0);
    }
    student.penaltyCard = Math.min(3, level);
    student.penaltyCardSystem = PENALTY_CARD_SYSTEM_VERSION;
    return student.penaltyCard;
}

function migrateData() {
    for (const className in classData) {
        if (!groupScores[className] || groupScores[className][1] !== undefined) {
            const oldScores = groupScores[className] || {1:0, 2:0, 3:0, 4:0};
            groupScores[className] = { mixed2: {1:0, 2:0}, mixed3: {1:0, 2:0, 3:0}, mixed4: oldScores, gender: {1:0, 2:0, 3:0, 4:0} };
        }
        if (!groupRecords[className]) groupRecords[className] = { mixed2: {}, mixed3: {}, mixed4: {}, gender: {} };
        if (!classStamps[className]) classStamps[className] = Array(TOTAL_STAMP_CELLS).fill(false);
        if (!groupPenalties[className]) groupPenalties[className] = { mixed2: {}, mixed3: {}, mixed4: {}, gender: {} };

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
            delete s.dismissalInfo;
            if (s.groupMemberDrawn === undefined) s.groupMemberDrawn = false; 
            normalizePenaltyCardState(s);
            if (s.selected === undefined) s.selected = false;

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

function normalizeClassName(name) {
    return name ? name.trim().replace(/\s+/g, '').replace(/[\\/<>\u0000-\u001F]/g, '').slice(0, 30) : name;
}

window.deleteAllClasses = function() {
    window.showModal("전체 학급 삭제", `<span class="font-bold text-red-600">등록된 모든 학급</span>의 데이터를 완전히 삭제하시겠습니까?<br><br><span class="text-red-500 font-bold">이 작업은 되돌릴 수 없으며</span> 모든 명단과 모둠 정보가 영구적으로 삭제됩니다.`, true, () => {
        Object.keys(classData).forEach(className => localStorage.removeItem(`pinnedGroupMode_${className}`));
        localStorage.removeItem('classOrder');
        localStorage.removeItem('classVisibility');
        classData = {}; groupScores = {}; groupRecords = {}; classStamps = {}; activeTimers = {}; groupPenalties = {}; jumpRopeData = {}; saveData({ immediate: true }); currentClass = ""; window.selectedGroupStudent = null;
        document.getElementById('current-class-display').innerHTML = "<span>⚙️ 설정 및 시작</span>";
        document.getElementById('tab-navigation').classList.add('hidden'); document.getElementById('tab-navigation').classList.remove('flex');
        ['student-management', 'group-section', 'stamp-section', 'jumprope-section'].forEach(id => document.getElementById(id).classList.add('hidden'));
        window.renderClassSelect(); window.showModal("삭제 완료", "모든 학급 데이터가 안전하게 삭제되었습니다.");
    }, "전체 삭제");
}

function buildExcelBackup(classNames, scope, sourceClass = '') {
    if (!window.XLSX) {
        window.showModal('엑셀 저장 실패', '엑셀 모듈을 불러오지 못했습니다. 인터넷 연결을 확인한 후 다시 시도해주세요.');
        return null;
    }
    if (classNames.length === 0) {
        window.showModal('저장할 자료 없음', '먼저 학급과 학생 명단을 등록해주세요.');
        return null;
    }

    const displayRows = [['학급', '번호', '이름', '성별', '출석', '볼센스', '개인점수', '순발력(초)', '혼성2모둠', '혼성3모둠', '혼성4모둠', '동성모둠', '메모']];
    const backupRows = [['학급', '번호', '이름', '성별', '볼센스', '참석상태', '개인점수', '혼성2모둠', '혼성3모둠', '혼성4모둠', '동성모둠', '그룹점수JSON', '그룹기록JSON', '혼성2부장', '혼성3부장', '혼성4부장', '동성부장', '순발력(초)', '메모', '경고단계', '그룹벌점JSON', '도장JSON']];
    const sortedClasses = [...classNames].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true, sensitivity: 'base' }));

    for (const className of sortedClasses) {
        const students = [...(classData[className] || [])].sort((a, b) => a.no - b.no || (a.name || '').localeCompare(b.name || '', 'ko'));
        const classScores = groupScores[className] || { mixed2: {1:0, 2:0}, mixed3: {1:0, 2:0, 3:0}, mixed4: {1:0, 2:0, 3:0, 4:0}, gender: {1:0, 2:0, 3:0, 4:0} };
        const classRecords = groupRecords[className] || { mixed2: {}, mixed3: {}, mixed4: {}, gender: {} };
        const classPenalties = groupPenalties[className] || { mixed2: {}, mixed3: {}, mixed4: {}, gender: {} };
        const classStampData = classStamps[className] || Array(TOTAL_STAMP_CELLS).fill(false);
        const rowsToWrite = students.length > 0 ? students : [null];

        rowsToWrite.forEach((student, index) => {
            if (student) {
                displayRows.push([
                    className, student.no, student.name, student.gender, student.attendance ? '출석' : '불참',
                    student.ballSense === '2' ? '상' : (student.ballSense === '1' ? '중' : '하'), student.score || 0,
                    student.recordMs ? Number((student.recordMs / 1000).toFixed(2)) : '', student.group_mixed2 || '',
                    student.group_mixed3 || '', student.group_mixed4 || '', student.group_gender || '', student.memo || ''
                ]);
            }

            backupRows.push([
                className, student?.no || '', student?.name || '', student?.gender || '', student?.ballSense || '0',
                student ? (student.attendance ? '참석' : '불참') : '', student?.score || 0, student?.group_mixed2 || '',
                student?.group_mixed3 || '', student?.group_mixed4 || '', student?.group_gender || '',
                index === 0 ? JSON.stringify(classScores) : '', index === 0 ? JSON.stringify(classRecords) : '',
                student?.captain_mixed2 ? 'Y' : 'N', student?.captain_mixed3 ? 'Y' : 'N', student?.captain_mixed4 ? 'Y' : 'N', student?.captain_gender ? 'Y' : 'N',
                student?.recordMs ? Number((student.recordMs / 1000).toFixed(2)) : '', student?.memo || '', student?.penaltyCard || 0,
                index === 0 ? JSON.stringify(classPenalties) : '', index === 0 ? JSON.stringify(classStampData) : ''
            ]);
        });
    }

    const workbook = window.XLSX.utils.book_new();
    const displaySheet = window.XLSX.utils.aoa_to_sheet(displayRows);
    displaySheet['!cols'] = [12, 7, 13, 7, 8, 9, 10, 12, 12, 12, 12, 12, 28].map(width => ({ wch: width }));
    displaySheet['!autofilter'] = { ref: displaySheet['!ref'] };
    const backupSheet = window.XLSX.utils.aoa_to_sheet(backupRows);
    backupSheet['!cols'] = backupRows[0].map((_, index) => ({ wch: index < 11 ? 12 : 20 }));
    const stampChunks = globalStampImage ? globalStampImage.match(/[\s\S]{1,30000}/g) || [] : [];
    const scopedJumpRopeData = scope === '학급'
        ? Object.fromEntries(Object.entries(jumpRopeData).map(([week, records]) => [week, sourceClass && records?.[sourceClass] ? { [sourceClass]: records[sourceClass] } : {}]))
        : jumpRopeData;
    const jumpRopeChunks = JSON.stringify(scopedJumpRopeData).match(/[\s\S]{1,30000}/g) || [];
    const settingsSheet = window.XLSX.utils.aoa_to_sheet([
        ['항목', '값'],
        ['백업범위', scope],
        ['원본학급', sourceClass],
        ['백업형식버전', 2],
        ...stampChunks.map((chunk, index) => [`스탬프이미지_${String(index + 1).padStart(4, '0')}`, chunk]),
        ...jumpRopeChunks.map((chunk, index) => [`줄넘기JSON_${String(index + 1).padStart(4, '0')}`, chunk])
    ]);
    window.XLSX.utils.book_append_sheet(workbook, displaySheet, '학생명단');
    window.XLSX.utils.book_append_sheet(workbook, backupSheet, '백업데이터');
    window.XLSX.utils.book_append_sheet(workbook, settingsSheet, '앱설정');
    workbook.Workbook = { Sheets: [{ name: '학생명단', Hidden: 0 }, { name: '백업데이터', Hidden: 1 }, { name: '앱설정', Hidden: 1 }] };

    return workbook;
}

function writeExcelBackup(workbook, fileLabel) {
    if (!workbook) return;
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const safeLabel = String(fileLabel).replace(/[\\/:*?"<>|]/g, '_');
    window.XLSX.writeFile(workbook, `스마트체육_${safeLabel}_${dateStr}.xlsx`, { compression: true });
}

window.exportAllToExcel = function() {
    writeExcelBackup(buildExcelBackup(Object.keys(classData), '전체'), '전체학급백업');
}

window.exportCurrentClassToExcel = function() {
    if (!currentClass || !classData[currentClass]) {
        window.showModal('학급 선택 필요', '첫 화면에서 백업할 학급을 먼저 선택해주세요.');
        return;
    }
    writeExcelBackup(buildExcelBackup([currentClass], '학급', currentClass), `${currentClass}_학급백업`);
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

function handleExcelUpload(event, importTarget) {
    const file = event.target.files[0]; if (!file) return;

    if (importTarget === 'class' && (!currentClass || !classData[currentClass])) {
        window.showModal('학급 선택 필요', '불러올 대상 학급을 먼저 선택해주세요.');
        event.target.value = '';
        return;
    }

    const resetFileInput = () => { event.target.value = ''; };
    const readJSON = (value, fallback) => {
        if (!value) return fallback;
        try { return JSON.parse(value.trim()); } catch (error) { return fallback; }
    };

    const mergeRosterStudent = (record, targetClass) => {
        const students = classData[targetClass] || [];
        const existing = students.find(student => student.no === record.no);
        const student = existing
            ? { ...existing, no: record.no, name: record.name, gender: record.gender }
            : createStudentRecord(record.no, record.name, record.gender);
        if (record.ballSense !== undefined) student.ballSense = record.ballSense;
        if (record.recordMs !== undefined) student.recordMs = record.recordMs;
        if (record.attendance !== undefined) student.attendance = record.attendance;
        if (record.score !== undefined) student.score = record.score;
        if (record.memo !== undefined) student.memo = record.memo;
        if (record.group !== undefined) student[`group_${currentGroupMode}`] = record.group;
        for (const mode of ['mixed2', 'mixed3', 'mixed4', 'gender']) {
            if (record.groups?.[mode] !== undefined) student[`group_${mode}`] = record.groups[mode];
        }
        return student;
    };

    const processRosterRows = (rows) => {
        const { records, invalidCount } = parseRosterTable(rows, importTarget === 'class' ? currentClass : '');
        if (records.length === 0) {
            window.showModal('불러오기 실패', '번호와 이름이 포함된 학생 명단을 찾지 못했습니다. 첫 행의 번호·이름·성별 열을 확인해주세요.');
            resetFileInput();
            return;
        }

        const sourceClasses = [...new Set(records.map(record => record.sourceClass).filter(Boolean))];
        const title = importTarget === 'class' ? `${currentClass} 명단 불러오기` : '전체 학급 명단 불러오기';
        const message = importTarget === 'class'
            ? `엑셀에서 찾은 <b>${records.length}명</b>을 현재 학급 명단에 등록하거나 갱신합니다.`
            : `엑셀에서 찾은 <b>${records.length}명 · ${sourceClasses.length}개 학급</b>을 등록하거나 갱신합니다.`;

        window.showModal(title, message, true, () => {
            const recordsByClass = new Map();
            if (importTarget === 'class') {
                let selectedRecords = records;
                if (sourceClasses.length > 1) {
                    selectedRecords = records.filter(record => record.sourceClass === normalizeClassName(currentClass));
                }
                if (selectedRecords.length === 0) {
                    window.showModal('현재 학급 자료 없음', `파일에서 <b>${escapeHTML(currentClass)}</b> 학급 학생을 찾지 못했습니다.`);
                    resetFileInput();
                    return;
                }
                recordsByClass.set(currentClass, selectedRecords);
            } else {
                records.forEach(record => {
                    if (!record.sourceClass) return;
                    if (!recordsByClass.has(record.sourceClass)) recordsByClass.set(record.sourceClass, []);
                    recordsByClass.get(record.sourceClass).push(record);
                });
                if (recordsByClass.size === 0) {
                    window.showModal('학급 정보 없음', '전체 학급 불러오기는 학급 열 또는 학년·반 열이 필요합니다.');
                    resetFileInput();
                    return;
                }
            }

            let importedCount = 0;
            recordsByClass.forEach((classRecords, className) => {
                const merged = [...(classData[className] || [])];
                classRecords.forEach(record => {
                    const student = mergeRosterStudent(record, className);
                    const index = merged.findIndex(existing => existing.no === record.no);
                    if (index >= 0) merged[index] = student;
                    else merged.push(student);
                    importedCount++;
                });
                merged.sort((a, b) => a.no - b.no || a.name.localeCompare(b.name, 'ko'));
                classData[className] = merged;
            });

            migrateData();
            saveData({ immediate: true });
            window.renderClassSelect();
            if (currentClass) { window.renderStudentList(); window.renderGroups(); }
            resetFileInput();
            const skipped = invalidCount > 0 ? `<br><span class="text-amber-600">형식을 확인할 수 없는 ${invalidCount}행은 건너뛰었습니다.</span>` : '';
            window.showModal('명단 불러오기 완료', `${importedCount}명의 학생을 등록하거나 갱신했습니다.${skipped}`);
        }, '명단 불러오기');
    };

    const processCSVOrRoster = (text) => {
        const normalized = text.replace(/^\uFEFF/, '').replace(/\r/g, '');
        const lines = normalized.split('\n').filter(line => line.trim());
        const firstRow = lines.length > 0 ? parseCSVLine(lines[0]) : [];
        const isBackup = firstRow.includes('그룹점수JSON') || firstRow.includes('그룹기록JSON') || firstRow.includes('도장JSON');
        if (isBackup) processCSV(normalized);
        else processRosterRows(lines.map(line => line.includes('\t') ? line.split('\t') : parseCSVLine(line)));
    };

    const processCSV = function(text, restoredSettings = {}) {
        text = text.replace(/^\uFEFF/, '').replace(/\r/g, '');
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) { window.showModal("오류", "파일 형식이 올바르지 않거나 데이터가 없습니다."); resetFileInput(); return; }

        const header = parseCSVLine(lines[0]);
        if (!header[0].includes('학급')) { window.showModal("오류", "전체 데이터 백업 파일이 아닙니다."); resetFileInput(); return; }

        const scopeIsClass = restoredSettings.backupScope === '학급';
        const confirmTitle = importTarget === 'class' ? `${currentClass} 학급 엑셀 불러오기` : (scopeIsClass ? '학급 백업 불러오기' : '전체 학급 엑셀 불러오기');
        const confirmMessage = importTarget === 'class'
            ? `파일에서 <b>${currentClass}</b> 학급 자료를 찾아 현재 학급만 교체합니다.`
            : scopeIsClass
                ? `백업 파일의 <b>${escapeHTML(restoredSettings.sourceClass || '해당 학급')}</b> 자료만 추가하거나 교체합니다. 다른 학급은 유지됩니다.`
                : `파일 내용으로 모든 학급의 자료를 교체하시겠습니까?<br><span class="font-bold text-red-500">주의: 현재 저장된 전체 학급 데이터가 교체됩니다.</span>`;
        window.showModal(confirmTitle, confirmMessage, true, async () => {
            const newData = {}; const newGroupScores = {}; const newGroupRecords = {}; const newGroupPenalties = {};
            const newClassStamps = {};
            const idxG2 = header.indexOf('혼성2모둠'); const idxG3 = header.indexOf('혼성3모둠'); const idxG4 = header.indexOf('혼성4모둠'); const idxGG = header.indexOf('동성모둠');
            const idxScores = header.indexOf('그룹점수JSON'); const idxRecords = header.indexOf('그룹기록JSON'); const idxLegacyCaptain = header.indexOf('체육부장');
            const idxCaptain2 = header.indexOf('혼성2부장'); const idxCaptain3 = header.indexOf('혼성3부장'); const idxCaptain4 = header.indexOf('혼성4부장'); const idxCaptainGender = header.indexOf('동성부장');
            const idxPenalties = header.indexOf('그룹벌점JSON'); const idxStamps = header.indexOf('도장JSON');
            const idxNewPenaltyCard = header.indexOf('경고단계'); const idxLegacyPenaltyCard = header.indexOf('벌점카드');
            
            let idxPersonalRec = header.indexOf('순발력(초)');
            if(idxPersonalRec === -1) idxPersonalRec = header.indexOf('달리기(초)');
            if(idxPersonalRec === -1) idxPersonalRec = header.indexOf('순발력(개인기록)');
            if(idxPersonalRec === -1) idxPersonalRec = header.indexOf('개인기록');
            
            const idxBall = header.indexOf('볼센스'); 
            const idxMemo = header.indexOf('메모');
            const attIdx = header.indexOf('참석상태');
            const scoreIdx = header.indexOf('개인점수');

            for (let i = 1; i < lines.length; i++) {
                const parts = parseCSVLine(lines[i]); if (parts.length < 1) continue;

                let className = parts[0].trim();
                if (className.startsWith('="') && className.endsWith('"')) className = className.slice(2, -1);
                else if (className.startsWith('=')) className = className.substring(1);
                className = normalizeClassName(className);
                if (!className) continue; 

                if (!newData[className]) {
                    newData[className] = [];
                    newGroupScores[className] = { mixed2: {1:0, 2:0}, mixed3: {1:0, 2:0, 3:0}, mixed4: {1:0, 2:0, 3:0, 4:0}, gender: {1:0, 2:0, 3:0, 4:0} };
                    newGroupRecords[className] = { mixed2: {}, mixed3: {}, mixed4: {}, gender: {} };
                    newGroupPenalties[className] = idxPenalties >= 0 ? { mixed2: {}, mixed3: {}, mixed4: {}, gender: {} } : (groupPenalties[className] || { mixed2: {}, mixed3: {}, mixed4: {}, gender: {} });
                    newClassStamps[className] = idxStamps >= 0 ? Array(TOTAL_STAMP_CELLS).fill(false) : (classStamps[className] || Array(TOTAL_STAMP_CELLS).fill(false));
                }

                if (idxScores > -1 && parts[idxScores]) newGroupScores[className] = readJSON(parts[idxScores], newGroupScores[className]);
                if (idxRecords > -1 && parts[idxRecords]) newGroupRecords[className] = readJSON(parts[idxRecords], newGroupRecords[className]);
                if (idxPenalties > -1 && parts[idxPenalties]) newGroupPenalties[className] = readJSON(parts[idxPenalties], newGroupPenalties[className]);
                if (idxStamps > -1 && parts[idxStamps]) newClassStamps[className] = readJSON(parts[idxStamps], newClassStamps[className]);

                const no = Number.parseInt(parts[1]?.trim(), 10); const name = parts[2]?.trim(); const gender = parts[3]?.trim();
                if (!Number.isInteger(no) || !name) continue;

                let bs = '0'; let attendance = true, score = 0, recMs = 0;
                let g2 = null, g3 = null, g4 = null, gg = null;
                let memo = "";

                if (idxBall > -1 && parts[idxBall]) {
                    const rawBs = parts[idxBall].trim();
                    if (rawBs === '3' || rawBs === '2' || rawBs === '상') bs = '2';
                    else if (rawBs === '1' || rawBs === '중') bs = '1';
                    else bs = '0';
                }

                if(attIdx > -1 && parts[attIdx]) attendance = (parts[attIdx].trim() === '출석' || parts[attIdx].trim() === '참석');
                if(scoreIdx > -1 && parts[scoreIdx]) score = Number.parseInt(parts[scoreIdx].trim(), 10) || 0;

                if (idxG2 > -1 && parts[idxG2]) g2 = Number.parseInt(parts[idxG2].trim(), 10) || null;
                if (idxG3 > -1 && parts[idxG3]) g3 = Number.parseInt(parts[idxG3].trim(), 10) || null;
                if (idxG4 > -1 && parts[idxG4]) g4 = Number.parseInt(parts[idxG4].trim(), 10) || null;
                if (idxGG > -1 && parts[idxGG]) gg = Number.parseInt(parts[idxGG].trim(), 10) || null;

                if (idxPersonalRec > -1 && parts[idxPersonalRec]) {
                    const parsed = Number.parseFloat(parts[idxPersonalRec].trim());
                    if(Number.isFinite(parsed)) recMs = Math.max(0, Math.round(parsed * 1000));
                }

                if (idxMemo > -1 && parts[idxMemo]) memo = parts[idxMemo].trim();
                const isYes = index => index > -1 && parts[index]?.trim() === 'Y';
                const legacyCaptain = isYes(idxLegacyCaptain);
                let penaltyCard = idxNewPenaltyCard > -1 ? Math.min(3, Math.max(0, Number.parseInt(parts[idxNewPenaltyCard], 10) || 0)) : 0;
                if (idxNewPenaltyCard < 0 && idxLegacyPenaltyCard > -1) {
                    const legacyLevel = Math.min(2, Math.max(0, Number.parseInt(parts[idxLegacyPenaltyCard], 10) || 0));
                    penaltyCard = legacyLevel === 1 ? 2 : (legacyLevel === 2 ? 3 : 0);
                }

                newData[className].push({
                    ...createStudentRecord(no, name, gender || '-'), ballSense: bs, attendance, score, recordMs, memo,
                    captain_mixed2: isYes(idxCaptain2), captain_mixed3: isYes(idxCaptain3), captain_mixed4: isYes(idxCaptain4) || legacyCaptain,
                    captain_gender: isYes(idxCaptainGender), group_mixed2: g2, group_mixed3: g3, group_mixed4: g4, group_gender: gg,
                    penaltyCard, penaltyCardSystem: PENALTY_CARD_SYSTEM_VERSION
                });
            }

            const importedClasses = Object.keys(newData);
            if (importedClasses.length > 0) {
                const rosterOverrideCount = applyRosterOverrides(newData, restoredSettings.rosterRecords);
                if (importTarget === 'class') {
                    const sourceClass = newData[currentClass] ? currentClass : (importedClasses.length === 1 ? importedClasses[0] : '');
                    if (!sourceClass) {
                        window.showModal('학급을 찾을 수 없음', `이 파일에는 <b>${escapeHTML(currentClass)}</b> 학급 자료가 없습니다. 전체 학급 불러오기를 이용해주세요.`);
                        resetFileInput();
                        return;
                    }
                    classData[currentClass] = newData[sourceClass];
                    groupScores[currentClass] = newGroupScores[sourceClass];
                    groupRecords[currentClass] = newGroupRecords[sourceClass];
                    groupPenalties[currentClass] = newGroupPenalties[sourceClass];
                    classStamps[currentClass] = newClassStamps[sourceClass];
                    if (restoredSettings.jumpRopeData) {
                        Object.entries(restoredSettings.jumpRopeData).forEach(([week, records]) => {
                            if (!jumpRopeData[week]) jumpRopeData[week] = {};
                            const sourceRecord = records?.[sourceClass] || records?.[restoredSettings.sourceClass];
                            if (sourceRecord) jumpRopeData[week][currentClass] = sourceRecord;
                        });
                    }
                } else if (scopeIsClass) {
                    importedClasses.forEach(className => {
                        classData[className] = newData[className];
                        groupScores[className] = newGroupScores[className];
                        groupRecords[className] = newGroupRecords[className];
                        groupPenalties[className] = newGroupPenalties[className];
                        classStamps[className] = newClassStamps[className];
                    });
                    if (restoredSettings.jumpRopeData) {
                        Object.entries(restoredSettings.jumpRopeData).forEach(([week, records]) => {
                            if (!jumpRopeData[week]) jumpRopeData[week] = {};
                            importedClasses.forEach(className => {
                                if (records?.[className]) jumpRopeData[week][className] = records[className];
                            });
                        });
                    }
                } else {
                    classData = newData; groupScores = newGroupScores; groupRecords = newGroupRecords; groupPenalties = newGroupPenalties;
                    classStamps = newClassStamps;
                    if (restoredSettings.jumpRopeData) jumpRopeData = restoredSettings.jumpRopeData;
                }
                if (restoredSettings.stampImage) globalStampImage = restoredSettings.stampImage;
                migrateData();
                activeTimers = {}; window.selectedGroupStudent = null;
                window.renderClassSelect();
                if (currentClass && !classData[currentClass]) {
                    currentClass = ""; document.getElementById('current-class-display').innerHTML = "<span>⚙️ 설정 및 시작</span>";
                    document.getElementById('tab-navigation').classList.add('hidden'); document.getElementById('tab-navigation').classList.remove('flex');
                    ['student-management', 'group-section', 'stamp-section', 'jumprope-section'].forEach(id => document.getElementById(id).classList.add('hidden'));
                }

                saveData({ immediate: true });

                if (currentClass) { window.renderStudentList(); window.renderGroups(); window.renderStampBoard(); if(currentTab==='jumprope') window.renderJumpRopeTab(); }
                const rosterMessage = Array.isArray(restoredSettings.rosterRecords)
                    ? `<br><span class="font-bold text-emerald-600">학생명단 편집값 ${rosterOverrideCount}명 반영</span>`
                    : '';
                const doneMessage = (importTarget === 'class'
                    ? `${escapeHTML(currentClass)} 학급 자료를 복구했습니다.`
                    : scopeIsClass ? '학급 자료를 추가하거나 교체했습니다.' : '모든 학급 자료를 복구했습니다.') + rosterMessage;
                window.showModal("완료", doneMessage);
            } else { window.showModal("오류", "올바른 데이터를 찾을 수 없습니다."); }
            resetFileInput();
        }, "전체 복구하기");
    };

    if (/\.xlsx?$/i.test(file.name)) {
        if (!window.XLSX) { window.showModal('오류', '엑셀 모듈을 불러오지 못했습니다.'); resetFileInput(); return; }
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const workbook = window.XLSX.read(e.target.result, { type: 'array' });
                const backupSheet = workbook.Sheets['백업데이터'];
                if (!backupSheet) {
                    const rosterSheet = workbook.Sheets['학생명단'] || workbook.Sheets[workbook.SheetNames[0]];
                    if (!rosterSheet) throw new Error('학생 명단 시트를 찾을 수 없습니다.');
                    const rosterRows = window.XLSX.utils.sheet_to_json(rosterSheet, { header: 1, defval: '', raw: false });
                    processRosterRows(rosterRows);
                    return;
                }
                const rosterSheet = workbook.Sheets['학생명단'];
                const rosterRecords = rosterSheet
                    ? parseRosterTable(window.XLSX.utils.sheet_to_json(rosterSheet, { header: 1, defval: '', raw: false })).records
                    : [];
                const settingsSheet = workbook.Sheets['앱설정'];
                let stampImage = '';
                let restoredJumpRopeData = null;
                let backupScope = '';
                let sourceClass = '';
                if (settingsSheet) {
                    const settingsRows = window.XLSX.utils.sheet_to_json(settingsSheet, { header: 1, defval: '' });
                    const settingsDataRows = settingsRows.slice(1);
                    const settingsMap = Object.fromEntries(settingsDataRows.map(row => [String(row[0]), row[1]]));
                    backupScope = String(settingsMap['백업범위'] || '');
                    sourceClass = normalizeClassName(String(settingsMap['원본학급'] || ''));
                    stampImage = settingsDataRows
                        .filter(row => String(row[0]).startsWith('스탬프이미지_'))
                        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
                        .map(row => String(row[1]))
                        .join('');
                    const jumpRopeJSON = settingsDataRows
                        .filter(row => String(row[0]).startsWith('줄넘기JSON_'))
                        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
                        .map(row => String(row[1]))
                        .join('');
                    if (jumpRopeJSON) restoredJumpRopeData = JSON.parse(jumpRopeJSON);
                }
                processCSV(window.XLSX.utils.sheet_to_csv(backupSheet, { blankrows: false }), { stampImage, jumpRopeData: restoredJumpRopeData, backupScope, sourceClass, rosterRecords });
            } catch (error) {
                console.error('엑셀 백업 읽기 실패:', error);
                window.showModal('불러오기 실패', escapeHTML(error.message || '엑셀 파일을 읽을 수 없습니다.'));
                resetFileInput();
            }
        };
        reader.readAsArrayBuffer(file);
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        let text = e.target.result;
        if (text.includes('\uFFFD')) {
            const eucReader = new FileReader();
            eucReader.onload = function(e2) {
                processCSVOrRoster(e2.target.result);
            };
            eucReader.readAsText(file, "euc-kr");
        } else {
            processCSVOrRoster(text);
        }
    };
    reader.readAsText(file, "utf-8");
}

window.handleAllCSVUpload = function(event) { handleExcelUpload(event, 'all'); }
window.handleClassExcelUpload = function(event) { handleExcelUpload(event, 'class'); }

window.selectClass = function(className) {
    if (!classData[className]) return;
    currentClass = className; activeTimers = {}; window.selectedGroupStudent = null;
    document.getElementById('class-selection-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    const displayBtn = document.getElementById('current-class-display');
    if (displayBtn) displayBtn.textContent = `🏫 ${className}`;
    const toolsBtn = document.getElementById('class-tools-btn');
    if (toolsBtn) toolsBtn.classList.remove('hidden');

    let pinnedKey = `pinnedGroupMode_${currentClass}`;
    currentGroupMode = localStorage.getItem(pinnedKey) || 'mixed4';

    document.getElementById('tab-navigation').classList.remove('hidden'); document.getElementById('tab-navigation').classList.add('flex');
    window.showTab(currentTab); window.renderClassSelect(); 
    window.setGroupMode(currentGroupMode, true); 
    window.updateGroupDrawSelect(); 
    window.renderStudentList(); window.renderGroups(); window.renderStampBoard();
    if(currentTab === 'jumprope') window.renderJumpRopeTab();
}

window.showTab = function(tabName) {
    currentTab = tabName; window.selectedGroupStudent = null;
    ['student-management', 'group-section', 'stamp-section', 'jumprope-section'].forEach(id => document.getElementById(id).classList.add('hidden'));

    ['student', 'group', 'stamp', 'jumprope'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if(btn) btn.className = "shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-[11px] sm:text-sm transition text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm whitespace-nowrap";
    });

    const mainContainer = document.getElementById('main-container');
    const headerContainer = document.getElementById('header-inner-container');

    mainContainer.classList.add('max-w-4xl'); mainContainer.classList.remove('max-w-[98%]');
    if(headerContainer) { headerContainer.classList.add('max-w-4xl'); headerContainer.classList.remove('max-w-[98%]'); }

    if (tabName === 'student') {
        document.getElementById('student-management').classList.remove('hidden');
        document.getElementById('tab-student').className = "shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-[11px] sm:text-sm transition text-white bg-blue-600 shadow-md border border-blue-600 transform scale-[1.02] sm:scale-105 z-10 whitespace-nowrap";
    } else if (tabName === 'group') {
        document.getElementById('group-section').classList.remove('hidden');
        document.getElementById('tab-group').className = "shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-[11px] sm:text-sm transition text-white bg-indigo-600 shadow-md border border-indigo-600 transform scale-[1.02] sm:scale-105 z-10 whitespace-nowrap";
        window.renderGroups(); 
    } else if (tabName === 'stamp') {
        document.getElementById('stamp-section').classList.remove('hidden');
        document.getElementById('tab-stamp').className = "shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-[11px] sm:text-sm transition text-white bg-green-600 shadow-md border border-green-600 transform scale-[1.02] sm:scale-105 z-10 whitespace-nowrap";
        window.renderStampBoard();
    } else if (tabName === 'jumprope') {
        document.getElementById('jumprope-section').classList.remove('hidden');
        document.getElementById('jumprope-section').classList.add('flex');
        document.getElementById('tab-jumprope').className = "shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-[11px] sm:text-sm transition text-white bg-amber-500 shadow-md border border-amber-500 transform scale-[1.02] sm:scale-105 z-10 whitespace-nowrap";
        window.renderJumpRopeTab();
    }
}

window.deleteStudent = function(studentNo) {
    const student = classData[currentClass].find(s => s.no == studentNo);
    if (!student) return;
    window.showModal("학생 정보 삭제", `<span class="font-bold text-red-500">${student.no}번 ${escapeHTML(student.name)}</span> 학생의 정보를 정말로 삭제하시겠습니까?`, true, () => {
        const idx = classData[currentClass].findIndex(s => s.no == studentNo);
        if (idx > -1) { classData[currentClass].splice(idx, 1); saveData(); window.renderStudentList(); window.renderGroups(); }
    }, "삭제");
}

window.toggleAttendance = function(studentNo) {
    const student = classData[currentClass].find(s => s.no == studentNo);
    if (student) {
        student.attendance = !student.attendance;
        if (!student.attendance) {
            student.selected = false;
            student.drawn = false;
            student.groupMemberDrawn = false;
            ['mixed2', 'mixed3', 'mixed4', 'gender'].forEach(mode => { student[`captain_${mode}`] = false; });
        }
        normalizeGroupCaptains(currentGroupMode);
        saveData(); window.renderStudentList(); window.renderGroups();
    }
}

window.toggleCaptain = function(studentNo) {
    const student = classData[currentClass].find(s => s.no == studentNo);
    if (student && student.attendance) { 
        const captainProp = 'captain_' + currentGroupMode;
        const isTurningOn = !student[captainProp];

        if (isTurningOn) {
            const groupId = student[`group_${currentGroupMode}`];
            if (groupId !== null && groupId !== undefined) {
                classData[currentClass].forEach(s => {
                    if (s[`group_${currentGroupMode}`] === groupId) {
                        s[captainProp] = false;
                    }
                });
            }
        }

        student[captainProp] = isTurningOn; 
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
        window.renderGroups();
        window.updateFloatingStopwatchBtn();
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
        normalizeGroupCaptains(currentGroupMode);
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
            rowBgClass = "bg-yellow-50 hover:bg-yellow-100 shadow-[inset_0_0_0_2px_#facc15] z-10 relative";
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

        const memoHighlight = s.memo ? 'bg-yellow-300 rounded-full ring-2 ring-yellow-400 shadow-sm text-blue-800 transform scale-110' : 'text-slate-300 hover:text-blue-400';

        tr.innerHTML = `
            <td class="px-0 py-1 sm:p-2 text-center w-12 sm:w-16">
                <button onclick="window.toggleAttendance(${s.no})" class="w-full h-full font-mono font-bold text-[12px] sm:text-[14px] ${s.attendance ? 'text-slate-600 hover:text-blue-500' : 'text-slate-400 hover:text-red-500'} transition" title="번호 터치: 참석/불참 토글">
                    ${s.no}
                </button>
            </td>
            
            <td class="px-2 py-1 sm:p-2 font-black text-center whitespace-nowrap min-w-[70px]">
                <div class="flex items-center justify-center gap-1.5">
                    <button onclick="window.toggleSelection(${s.no})" class="text-[11px] sm:text-[14px] whitespace-nowrap shrink-0 ${s.attendance ? 'text-slate-800' : 'text-slate-400 line-through'} px-1 py-0.5 rounded transition ${s.selected ? 'bg-yellow-400 text-yellow-900 shadow-sm' : 'hover:bg-slate-200'}" title="이름 터치: 다중 스톱워치 선택">
                        ${escapeHTML(s.name)}${drawnBadge}
                    </button>
                    <button onclick="event.stopPropagation(); window.openMemoModal(${s.no})" class="text-xs sm:text-sm transition flex items-center justify-center w-6 h-6 ${memoHighlight}" title="메모 쓰기">📝</button>
                </div>
            </td>
            
            <td class="px-0 py-1 sm:p-2 text-center w-5 sm:w-8">
                <div class="flex flex-col items-center justify-center leading-none mt-1">
                        <span class="text-[9px] sm:text-[11px] font-bold px-1 py-0.5 rounded ${s.gender === '남' ? (s.attendance ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400') : (s.attendance ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-400')}">${escapeHTML(s.gender)}</span>
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
    window.updateFloatingStopwatchBtn();
}

window.setGroupMode = function(mode, isInit = false) {
    if (!currentClass) return;
    if (!['mixed2', 'mixed3', 'mixed4', 'gender'].includes(mode)) mode = 'mixed4';
    
    let pinnedKey = `pinnedGroupMode_${currentClass}`;
    
    if (!isInit && currentGroupMode === mode) {
        if (localStorage.getItem(pinnedKey) === mode) {
            localStorage.removeItem(pinnedKey);
        } else {
            localStorage.setItem(pinnedKey, mode);
        }
    } else {
        currentGroupMode = mode;
    }

    activeTimers = {}; window.selectedGroupStudent = null;
    const pinned = localStorage.getItem(pinnedKey);

    ['mixed2', 'mixed3', 'mixed4', 'gender'].forEach(m => {
        const btn = document.getElementById(`btn-mode-${m}`);
        if (btn) {
            if (m === currentGroupMode) {
                if (m === pinned) {
                    btn.className = "flex-1 sm:flex-none px-4 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm transition bg-indigo-600 text-white shadow-[0_0_12px_rgba(250,204,21,0.8)] ring-4 ring-yellow-400 transform scale-105 whitespace-nowrap z-10";
                } else {
                    btn.className = "flex-1 sm:flex-none px-4 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm transition bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-300 ring-offset-1 transform scale-105 whitespace-nowrap z-10";
                }
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
    if(!isInit) window.renderStudentList();
    window.renderGroups();
}

window.resetCurrentGroup = function() {
    if (!currentClass || !classData[currentClass]) { window.showModal("알림", "학급을 먼저 선택해주세요."); return; }
    let modeName = currentGroupMode === 'mixed2' ? '혼성 2팀' : (currentGroupMode === 'mixed3' ? '혼성 3팀' : (currentGroupMode === 'mixed4' ? '혼성 4팀' : '동성 4팀'));

    window.showModal("모둠 초기화", `정말 현재 학급의 <b>${modeName}</b> 편성을 모두 초기화하시겠습니까?<br><span class="text-red-500 text-xs">※ 모둠 기록이 초기화되며 모든 학생이 미편성 영역으로 이동합니다.</span>`, true, () => {
        classData[currentClass].forEach(student => { 
            student[`group_${currentGroupMode}`] = null; 
            student[`captain_${currentGroupMode}`] = false;
            student.penaltyCard = 0; 
            student.groupMemberDrawn = false;
        });
        if (groupScores[currentClass] && groupScores[currentClass][currentGroupMode]) groupScores[currentClass][currentGroupMode] = {};
        if (groupRecords[currentClass] && groupRecords[currentClass][currentGroupMode]) groupRecords[currentClass][currentGroupMode] = {};
        if (groupPenalties[currentClass] && groupPenalties[currentClass][currentGroupMode]) groupPenalties[currentClass][currentGroupMode] = {};

        activeTimers = {}; window.selectedGroupStudent = null; saveData(); window.renderStudentList(); window.renderGroups();
        window.showModal("완료", `${modeName} 편성이 초기화되었습니다.`);
    });
}

window.generateCurrentGroup = function() {
    if (!currentClass || !classData[currentClass]) { window.showModal('알림', '학급을 먼저 선택해주세요.'); return; }
    const presentStudents = classData[currentClass].filter(student => student.attendance);
    const requiredCount = currentGroupMode === 'mixed2' ? 2 : (currentGroupMode === 'mixed3' ? 3 : 4);
    if (currentGroupMode !== 'gender' && presentStudents.length < requiredCount) {
        window.showModal('출석 인원 부족', `현재 출석 학생이 ${presentStudents.length}명입니다. 이 편성에는 최소 ${requiredCount}명이 필요합니다.`);
        return;
    }
    if (currentGroupMode === 'gender') {
        const boys = presentStudents.filter(student => student.gender === '남').length;
        const girls = presentStudents.filter(student => student.gender === '여').length;
        if (boys < 2 || girls < 2) {
            window.showModal('출석 인원 부족', `동성 4팀은 출석한 남학생과 여학생이 각각 2명 이상 필요합니다.<br>현재 남 ${boys}명 · 여 ${girls}명`);
            return;
        }
    }
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
            if (groupPenalties[currentClass] && groupPenalties[currentClass][currentGroupMode]) {
                groupPenalties[currentClass][currentGroupMode] = {}; 
            }
            classData[currentClass].forEach(s => {
                s.groupMemberDrawn = false;
                s[`captain_${currentGroupMode}`] = false;
                s.penaltyCard = 0; 
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

function shuffleCopy(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
}

function normalizeGroupCaptains(mode) {
    if (!currentClass || !classData[currentClass]) return;
    const occupiedGroups = new Set();
    [...classData[currentClass]].sort((a, b) => a.no - b.no).forEach(student => {
        const groupId = student[`group_${mode}`];
        const captainKey = `captain_${mode}`;
        if (!student.attendance || !groupId) {
            student[captainKey] = false;
        } else if (student[captainKey]) {
            if (occupiedGroups.has(groupId)) student[captainKey] = false;
            else occupiedGroups.add(groupId);
        }
    });
}

window.generateMixedGroups = function(numGroups) {
    const students = classData[currentClass];
    if (!students) return;
    const presentStudents = students.filter(s => s.attendance);
    if (presentStudents.length < numGroups) { window.showModal("출석 인원 부족", `현재 출석 학생이 ${presentStudents.length}명입니다. ${numGroups}팀 편성에는 최소 ${numGroups}명이 필요합니다.`); return; }
    students.forEach(s => s[`group_${currentGroupMode}`] = null);

    let validRecords = presentStudents.filter(s => s.recordMs > 0).map(s => s.recordMs).sort((a,b) => a - b);
    const plan = buildBalancedTeamPlan(presentStudents, numGroups, student => getStudentPower(student, validRecords));
    plan.forEach(team => team.members.forEach(student => { student[`group_${currentGroupMode}`] = team.id; }));

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
    if (!students) return;
    const presentStudents = students.filter(s => s.attendance);
    const presentBoys = presentStudents.filter(s => s.gender === '남').length;
    const presentGirls = presentStudents.filter(s => s.gender === '여').length;
    if (presentBoys < 2 || presentGirls < 2) {
        window.showModal("출석 인원 부족", `동성 4팀은 출석한 남학생과 여학생이 각각 2명 이상 필요합니다.<br>현재 남 ${presentBoys}명 · 여 ${presentGirls}명`);
        return;
    }
    students.forEach(s => s.group_gender = null);

    let validRecords = presentStudents.filter(s => s.recordMs > 0).map(s => s.recordMs).sort((a,b) => a - b);
    const powerOf = student => getStudentPower(student, validRecords);
    const boysPlan = buildBalancedTeamPlan(presentStudents.filter(s => s.gender === '남'), 2, powerOf);
    const girlsPlan = buildBalancedTeamPlan(presentStudents.filter(s => s.gender === '여'), 2, powerOf);
    boysPlan.forEach(team => team.members.forEach(student => { student.group_gender = team.id; }));
    girlsPlan.forEach(team => team.members.forEach(student => { student.group_gender = team.id + 2; }));

    if (!groupScores[currentClass]) groupScores[currentClass] = {};
    groupScores[currentClass]['gender'] = {1:0, 2:0, 3:0, 4:0};
    
    if (!groupRecords[currentClass]) groupRecords[currentClass] = {};
    groupRecords[currentClass]['gender'] = {};

    saveData(); 
    window.renderStudentList(); 
    window.renderGroups();
}

window.showDrawResultModal = function(title, students) {
    document.getElementById('draw-modal-title').innerHTML = `🎉 ${title} 🎉`;
    const content = document.getElementById('draw-result-content');
    
    if (!students || students.length === 0) {
        content.innerHTML = '<div class="text-slate-400 font-bold p-4 text-center w-full">당첨자가 없습니다.</div>';
    } else {
        let html = '';
        students.sort((a, b) => a.no - b.no); 
        students.forEach(s => {
            let groupInfo = s[`group_${currentGroupMode}`] ? `${s[`group_${currentGroupMode}`]}모둠` : '미편성';
            html += `
                <div class="bg-white border-2 border-fuchsia-300 rounded-2xl p-3 sm:p-4 shadow-md flex flex-col items-center justify-center w-[100px] sm:w-[130px] transform hover:scale-105 transition-transform animate-pop-in" style="animation-delay: ${Math.random() * 0.2}s">
                    <span class="text-[10px] sm:text-xs font-bold text-fuchsia-600 bg-fuchsia-50 px-2 py-0.5 rounded-full mb-1.5 shadow-sm border border-fuchsia-100">${groupInfo}</span>
                    <span class="font-black text-xl sm:text-2xl text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center mt-1">${escapeHTML(s.name)}</span>
                    <span class="text-[11px] sm:text-xs text-slate-400 font-bold mt-1.5">${s.no}번 / ${escapeHTML(s.gender)}</span>
                </div>
            `;
        });
        content.innerHTML = html;
    }

    const modal = document.getElementById('draw-result-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeDrawResultModal = function() {
    const modal = document.getElementById('draw-result-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

window.resetGroupDraws = function(silent = false) {
    if (!currentClass || !classData[currentClass]) return;
    classData[currentClass].forEach(s => s.groupMemberDrawn = false);
    saveData();
    window.renderGroups();
    const summaryEl = document.getElementById('draw-result-summary');
    if (summaryEl) summaryEl.innerHTML = `📢 모든 당첨 마크가 깔끔하게 초기화되었습니다.`;
    if (!silent) window.playEraseSound();
};

window.drawFromClass = function() {
    if (!currentClass || !classData[currentClass]) { alert("학급 데이터가 유효하지 않습니다."); return; }
    const students = classData[currentClass];
    const presentStudents = students.filter(s => s.attendance);
    if (presentStudents.length === 0) { alert("출석 처리된 학생이 없습니다."); return; }

    const requestedCount = parseInt(document.getElementById('draw-class-count').value) || 4;
    const finalCount = Math.min(requestedCount, presentStudents.length);

    students.forEach(s => s.groupMemberDrawn = false);

    const boys = presentStudents.filter(s => s.gender === '남');
    const girls = presentStudents.filter(s => s.gender === '여');

    let targetBoys = 0; let targetGirls = 0;

    if (boys.length === 0) { targetGirls = finalCount; } 
    else if (girls.length === 0) { targetBoys = finalCount; } 
    else {
        targetBoys = Math.round(finalCount * boys.length / presentStudents.length);
        targetGirls = finalCount - targetBoys;

        if (targetBoys > boys.length) { targetBoys = boys.length; targetGirls = finalCount - targetBoys; } 
        else if (targetGirls > girls.length) { targetGirls = girls.length; targetBoys = finalCount - targetGirls; }
    }

    const pickedBoys = shuffleCopy(boys).slice(0, targetBoys);
    const pickedGirls = shuffleCopy(girls).slice(0, targetGirls);
    const totalPicked = [...pickedBoys, ...pickedGirls];

    totalPicked.forEach(p => {
        const targetStudent = students.find(s => s.no === p.no);
        if (targetStudent) targetStudent.groupMemberDrawn = true;
    });

    saveData();
    window.renderGroups();
    window.playCasinoJackpot();
    window.fireConfetti();
    
    window.showDrawResultModal("학급 랜덤 선발 결과", totalPicked);

    const summaryEl = document.getElementById('draw-result-summary');
    if (summaryEl) {
        const names = totalPicked.map(p => escapeHTML(p.name)).join(', ');
        summaryEl.innerHTML = `🎉 학급 비례 당첨(<span class="text-blue-600 font-black">${totalPicked.length}명</span>): <b class="text-slate-800">${names}</b>`;
    }
};

window.drawFromEachGroup = function() {
    if (!currentClass || !classData[currentClass]) return;
    const students = classData[currentClass];

    students.forEach(s => s.groupMemberDrawn = false);

    let maxGroups = currentGroupMode === 'mixed2' ? 2 : (currentGroupMode === 'mixed3' ? 3 : 4);
    const perGroupCount = parseInt(document.getElementById('draw-group-count').value) || 1;
    let totalPicked = [];

    for (let i = 1; i <= maxGroups; i++) {
        const groupPresentStudents = students.filter(s => s[`group_${currentGroupMode}`] === i && s.attendance);
        if (groupPresentStudents.length > 0) {
            const shuffled = shuffleCopy(groupPresentStudents);
            const chosen = shuffled.slice(0, Math.min(perGroupCount, groupPresentStudents.length));
            chosen.forEach(p => {
                p.groupMemberDrawn = true;
                totalPicked.push(p);
            });
        }
    }

    if (totalPicked.length === 0) { alert("모둠에 편성된 출석 학생이 한 명도 없습니다."); return; }

    saveData();
    window.renderGroups();
    window.playCasinoJackpot();
    window.fireConfetti();
    
    window.showDrawResultModal("모둠별 선발 결과", totalPicked);

    const summaryEl = document.getElementById('draw-result-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `🎉 각 모둠별 선발 완료! 총 <span class="font-black text-indigo-600">${totalPicked.length}명</span>이 당첨되었습니다.`;
    }
};

function renderPenaltyIndicator(student) {
    const level = normalizePenaltyCardState(student);
    const labels = ['경고 없음', '입경고', '옐로카드', '레드카드'];
    const verbalStyle = level >= 1 ? 'bg-amber-500 border-amber-700 text-white shadow-sm' : 'bg-slate-200 border-slate-300 text-slate-400';
    const yellowStyle = level >= 2 ? 'bg-yellow-400 border-yellow-600 shadow-sm' : 'bg-slate-200 border-slate-300';
    const redStyle = level >= 3 ? 'bg-red-500 border-red-700 shadow-sm' : 'bg-slate-200 border-slate-300';
    return `
        <button type="button" class="flex gap-0.5 ml-1.5 items-center rounded p-0.5 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                onclick="event.stopPropagation(); window.cyclePenaltyCard(${student.no})"
                title="입경고 → 옐로카드 → 레드카드 → 해제" aria-label="현재 ${labels[level]}. 다음 경고 단계로 변경">
            <span class="w-3.5 h-3.5 sm:w-4 sm:h-4 border ${verbalStyle} rounded-full text-[9px] sm:text-[10px] font-black leading-none flex items-center justify-center transition-colors duration-200">!</span>
            <span class="w-2.5 h-3.5 sm:w-3 sm:h-4 border ${yellowStyle} rounded-[2px] transition-colors duration-200"></span>
            <span class="w-2.5 h-3.5 sm:w-3 sm:h-4 border ${redStyle} rounded-[2px] transition-colors duration-200"></span>
        </button>`;
}

window.renderGroups = function() {
    const container = document.getElementById('group-result'); if (!container) return;
    if (!currentClass || !classData[currentClass]) { container.innerHTML = ''; return; }
    
    let numGroups = currentGroupMode === 'mixed2' ? 'grid-cols-2' : (currentGroupMode === 'mixed3' ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4');
    let maxGroups = currentGroupMode === 'mixed2' ? 2 : (currentGroupMode === 'mixed3' ? 3 : 4);
    let html = '';
    
    container.className = `grid gap-2 sm:gap-3 p-1 w-full items-stretch relative ${numGroups}`;
    container.style.gridTemplateColumns = ""; 
    
    const students = classData[currentClass];
    
    const presentStudents = students.filter(s => s.attendance);
    let validRecordsAll = presentStudents.filter(s => s.recordMs > 0).map(s => s.recordMs).sort((a,b) => a - b);
    let validRecordsMale = presentStudents.filter(s => s.gender === '남' && s.recordMs > 0).map(s => s.recordMs).sort((a,b) => a - b);
    let validRecordsFemale = presentStudents.filter(s => s.gender === '여' && s.recordMs > 0).map(s => s.recordMs).sort((a,b) => a - b);

    const colors = [
        { bg: 'bg-indigo-50', text: 'text-indigo-800', header: 'bg-indigo-100', btn: 'bg-indigo-500 hover:bg-indigo-600', ring: 'ring-indigo-300' },
        { bg: 'bg-fuchsia-50', text: 'text-fuchsia-800', header: 'bg-fuchsia-100', btn: 'bg-fuchsia-500 hover:bg-fuchsia-600', ring: 'ring-fuchsia-300' },
        { bg: 'bg-cyan-50', text: 'text-cyan-800', header: 'bg-cyan-100', btn: 'bg-cyan-500 hover:bg-cyan-600', ring: 'ring-cyan-300' },
        { bg: 'bg-amber-50', text: 'text-amber-800', header: 'bg-amber-100', btn: 'bg-amber-500 hover:bg-amber-600', ring: 'ring-amber-300' }
    ];

    let drawnGroupIds = [];
    if (groupRecords[currentClass] && groupRecords[currentClass][currentGroupMode] && groupRecords[currentClass][currentGroupMode].drawnGroups) {
        drawnGroupIds = groupRecords[currentClass][currentGroupMode].drawnGroups;
    }

    for (let i = 1; i <= maxGroups; i++) {
        const groupStudents = students.filter(s => s[`group_${currentGroupMode}`] === i);
        groupStudents.sort((a, b) => a.no - b.no);
        
        let presentBoys = groupStudents.filter(s => s.gender === '남' && s.attendance).length;
        let presentGirls = groupStudents.filter(s => s.gender === '여' && s.attendance).length;
        let presentTotal = presentBoys + presentGirls;

        let groupHasCaptain = groupStudents.some(st => st[`captain_${currentGroupMode}`] && st.attendance);

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
        <div class="${color.bg} border-[3px] border-slate-900 rounded-xl overflow-hidden flex flex-col transition-all duration-300 ${groupDrawnStyle} group-area"
             data-group-id="${i}" 
             ondragover="window.handleDragOverGroup(event)" 
             ondragleave="window.handleDragLeaveGroup(event)"
             ondrop="window.handleDropOnGroup(event, ${i})" 
             onclick="window.handleGroupAreaClick(${i})">
            
            <div class="${color.header} px-2 py-2 sm:px-3 sm:py-3 flex flex-col sm:flex-row justify-between items-center border-b-[3px] border-slate-900 gap-1 sm:gap-0">
                
                <h3 class="font-black text-base sm:text-xl ${color.text} flex items-center gap-2 whitespace-nowrap">
                    <span>${i}모둠</span>
                    <div class="flex items-center bg-white rounded shadow-sm overflow-hidden scale-90 sm:scale-100">
                        <button onclick="window.updateGroupScore(${i}, -1)" class="w-6 h-6 sm:w-8 sm:h-8 text-sm sm:text-lg font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition">-</button>
                        <span class="w-6 sm:w-10 text-center font-black text-sm sm:text-lg ${color.text}">${gScore}</span>
                        <button onclick="window.updateGroupScore(${i}, 1)" class="w-6 h-6 sm:w-8 sm:h-8 text-sm sm:text-lg font-bold ${color.btn} text-white transition">+</button>
                    </div>
                </h3>
                
                <div class="flex items-center mt-1 sm:mt-0">
                    <div class="text-xs sm:text-sm text-slate-700 bg-white/70 px-2 py-1 rounded shadow-sm border border-slate-200 whitespace-nowrap">
                        참석 <span class="font-bold text-blue-600">${presentTotal}</span>명 <span class="text-slate-400 mx-1">|</span> 남 ${presentBoys} 여 ${presentGirls}
                    </div>
                </div>
            </div>
            
            <div class="p-1 sm:p-3 flex-1 min-h-[80px] flex flex-col gap-1.5 sm:gap-2 items-stretch relative">
                ${groupStudents.length === 0 ? `<div class="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-[10px] sm:text-sm pointer-events-none text-center">이동</div>` : ''}
                ${groupStudents.map(s => {
                    let bsEmoji = s.ballSense === '2' ? '⚽⚽' : (s.ballSense === '1' ? '⚽' : '-');
                    
                    let rankStr = "";
                    if (s.recordMs > 0 && s.attendance) {
                        let rank; let rankPrefix = "";
                        if (currentGroupMode === 'gender') {
                            rank = (s.gender === '남' ? validRecordsMale : validRecordsFemale).indexOf(s.recordMs) + 1;
                            rankPrefix = s.gender;
                        } else {
                            rank = validRecordsAll.indexOf(s.recordMs) + 1;
                        }
                        rankStr = `<span class="text-blue-600 font-black text-[9px] sm:text-[10px] leading-tight">(${rankPrefix}${rank}위)</span>`;
                    }
                    
                    let recText = s.recordMs > 0 ? (s.recordMs / 1000).toFixed(2) + "초" : '-';
                    
                    let isCaptain = s[`captain_${currentGroupMode}`];
                    let badgeColor = '';
                    
                    if (!s.attendance) {
                        badgeColor = 'bg-slate-100 text-slate-400 border-slate-300 border-dashed opacity-70 grayscale';
                    } else {
                        // 성별 기본 배경색으로 설정 (선택 1번 요청사항 반영)
                        badgeColor = s.gender === '남' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-pink-50 text-pink-800 border-pink-200';
                    }

                    let isSelected = s.selected;
                    let selectedStyle = isSelected ? 'ring-4 ring-yellow-400 bg-yellow-100 transform scale-105 z-10 shadow-lg' : 'shadow-sm hover:shadow hover:-translate-y-0.5';
                    if (isSelected) badgeColor = 'text-yellow-800 border-yellow-300';

                    let captainBtnHtml = '';
                    if (isCaptain && s.attendance) {
                        // C 버튼만 강력하게 강조 (선택 1번 요청사항 반영)
                        captainBtnHtml = `<button onclick="event.stopPropagation(); window.toggleCaptain(${s.no})" class="absolute top-1 right-1 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm font-black rounded z-20 bg-yellow-400 text-white border-yellow-500 shadow-[0_0_10px_rgba(250,204,21,0.8)] ring-2 ring-yellow-400" title="체육부장 해제">C</button>`;
                    } else if (!groupHasCaptain && s.attendance) {
                        captainBtnHtml = `<button onclick="event.stopPropagation(); window.toggleCaptain(${s.no})" class="absolute top-1 right-1 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm font-black rounded z-20 hover:bg-slate-200 text-slate-400 bg-slate-100/50" title="체육부장 지정">c</button>`;
                    }

                    let attText = s.attendance ? 'O' : 'X';
                    let attColor = s.attendance ? 'text-emerald-600 bg-emerald-100 border-emerald-300' : 'text-red-500 bg-red-100 border-red-300';
                    let attendanceBtnHtml = `<button onclick="event.stopPropagation(); window.toggleAttendance(${s.no})" class="absolute top-1 left-1 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[10px] sm:text-xs font-black rounded-full border shadow-sm z-20 ${attColor}" title="출석/불참 토글">${attText}</button>`;

                    let memberDrawnBadge = s.groupMemberDrawn ? '<div class="absolute -bottom-2 -right-2 bg-fuchsia-500 text-white text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded shadow z-20 font-bold animate-pop-in">당첨</div>' : '';

                    const penaltyCardsHtml = renderPenaltyIndicator(s);

                    return `
                    <div draggable="true" data-student-no="${s.no}" 
                         ondragstart="window.handleDragStart(event, ${s.no})" ondragend="window.handleDragEnd(event)" 
                         ontouchstart="window.handleTouchStart(event, ${s.no})"
                         ontouchmove="window.handleTouchMove(event)"
                         ontouchend="window.handleTouchEnd(event)"
                         onclick="event.stopPropagation(); window.handleStudentCardClick(${s.no})"
                         class="student-card relative border sm:border-2 ${badgeColor} p-1.5 sm:px-2 sm:py-2 rounded-lg cursor-pointer transition-all duration-200 select-none ${selectedStyle} flex flex-col items-center justify-center min-h-[55px] sm:min-h-[65px]">
                        
                        ${attendanceBtnHtml}
                        ${captainBtnHtml}
                        ${memberDrawnBadge}
                        
                        <div class="flex items-center justify-center mt-2.5 sm:mt-1 z-10 w-full px-1">
                            <span class="font-black text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis ${!s.attendance ? 'line-through opacity-60' : ''}">${escapeHTML(s.name)}</span>
                            ${penaltyCardsHtml}
                        </div>

                        <div class="flex items-center justify-center gap-1.5 w-full bg-white/70 rounded px-1 py-1 border border-white/50 mt-1 shadow-inner flex-wrap">
                            <span class="text-[9px] sm:text-[10px] font-bold text-slate-600 tracking-tighter whitespace-nowrap flex items-center">
                                볼센스: <span class="ml-0.5 text-[10px] sm:text-xs">${bsEmoji}</span>
                            </span>
                            <span class="text-slate-300 text-[10px]">|</span>
                            <div class="flex items-center justify-center gap-0.5">
                                <span class="text-[9px] sm:text-[10px] font-mono font-bold text-slate-700 tracking-tighter whitespace-nowrap">⚡${recText}</span>
                                ${rankStr}
                            </div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>

            <div class="bg-white/50 border-t-[3px] border-slate-900 p-1 flex flex-col justify-center items-center gap-1 print-hide">
                 <div class="w-full flex justify-between items-center gap-0.5 sm:gap-1 overflow-hidden">
                     <button id="mode-icon-${i}" onclick="window.toggleTimerMode(${i})" class="text-[10px] sm:text-sm hover:scale-110 transition bg-white w-5 h-5 sm:w-8 sm:h-8 shrink-0 rounded-full shadow-sm flex items-center justify-center border border-slate-200">
                         ${t.mode === 'stopwatch' ? '⏱️' : '⏳'}
                     </button>
                     <div class="flex-1 min-w-0 mx-0.5 bg-white border border-slate-200 rounded text-center cursor-pointer shadow-inner px-1 overflow-hidden flex items-center justify-center h-5 sm:h-8" onclick="window.manualTimeEdit(${i})">
                         <span id="time-display-${i}" class="font-mono text-[9px] sm:text-sm font-black tracking-tighter truncate ${timeColorClass} block w-full">${timerDisplayVal}</span>
                     </div>
                     <div class="flex gap-0.5 shrink-0">
                         <button id="btn-play-${i}" onclick="window.toggleTimerPlay(${i})" class="bg-white text-slate-400 w-5 h-5 sm:w-8 sm:h-8 shrink-0 rounded-full border border-slate-200 shadow-sm hover:text-blue-500 transition flex items-center justify-center text-[9px] sm:text-sm font-bold">▶</button>
                         <button onclick="window.resetTimer(${i})" class="bg-white text-slate-400 w-5 h-5 sm:w-8 sm:h-8 shrink-0 rounded-full border border-slate-200 shadow-sm hover:text-red-500 transition flex items-center justify-center text-[9px] sm:text-sm font-bold">↻</button>
                     </div>
                 </div>
            </div>
        </div>`;
    }

    const unassignedStudents = students.filter(s => !s[`group_${currentGroupMode}`]);
    unassignedStudents.sort((a, b) => a.no - b.no);

    html += `
    <div id="unassigned-area" class="col-span-full mt-2 bg-slate-100/80 border-[3px] border-dashed border-slate-900 rounded-xl p-2 sm:p-4 group-area transition-all duration-300"
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
        </div>
        
        <div class="flex flex-wrap gap-2 min-h-[60px] items-start p-2 bg-white/50 rounded-lg border border-slate-200">
            ${unassignedStudents.length === 0 ? `<div class="w-full flex items-center justify-center text-slate-400 font-bold text-xs sm:text-sm py-4 pointer-events-none">모든 학생이 편성되었습니다.</div>` : ''}
            ${unassignedStudents.map(s => {
                let bsEmoji = s.ballSense === '2' ? '⚽⚽' : (s.ballSense === '1' ? '⚽' : '-');
                let rankStr = "";
                if (s.recordMs > 0 && s.attendance) {
                    let rank; let rankPrefix = "";
                    if (currentGroupMode === 'gender') {
                        rank = (s.gender === '남' ? validRecordsMale : validRecordsFemale).indexOf(s.recordMs) + 1;
                        rankPrefix = s.gender;
                    } else {
                        rank = validRecordsAll.indexOf(s.recordMs) + 1;
                    }
                    rankStr = `<span class="text-blue-600 font-black text-[9px] sm:text-[10px] leading-tight">(${rankPrefix}${rank}위)</span>`;
                }
                
                let recText = s.recordMs > 0 ? (s.recordMs / 1000).toFixed(2) + "초" : '-';
                let badgeColor = '';
                
                if (!s.attendance) {
                    badgeColor = 'bg-slate-100 text-slate-400 border-slate-300 border-dashed opacity-70 grayscale';
                } else {
                    badgeColor = s.gender === '남' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-pink-50 text-pink-800 border-pink-200';
                }

                let isSelected = s.selected;
                let selectedStyle = isSelected ? 'ring-4 ring-yellow-400 bg-yellow-100 transform scale-105 z-10 shadow-lg' : 'shadow-sm hover:shadow hover:-translate-y-0.5';
                if (isSelected) badgeColor = 'text-yellow-800 border-yellow-300';

                let attText = s.attendance ? 'O' : 'X';
                let attColor = s.attendance ? 'text-emerald-600 bg-emerald-100 border-emerald-300' : 'text-red-500 bg-red-100 border-red-300';
                let attendanceBtnHtml = `<button onclick="event.stopPropagation(); window.toggleAttendance(${s.no})" class="absolute top-1 left-1 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[10px] sm:text-xs font-black rounded-full border shadow-sm z-20 ${attColor}" title="출석/불참 토글">${attText}</button>`;
                
                let memberDrawnBadge = s.groupMemberDrawn ? '<div class="absolute -bottom-2 -right-2 bg-fuchsia-500 text-white text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded shadow z-20 font-bold animate-pop-in">당첨</div>' : '';

                const penaltyCardsHtml = renderPenaltyIndicator(s);

                return `
                <div draggable="true" data-student-no="${s.no}" 
                     ondragstart="window.handleDragStart(event, ${s.no})" ondragend="window.handleDragEnd(event)" 
                     ontouchstart="window.handleTouchStart(event, ${s.no})"
                     ontouchmove="window.handleTouchMove(event)"
                     ontouchend="window.handleTouchEnd(event)"
                     onclick="event.stopPropagation(); window.handleStudentCardClick(${s.no})"
                     class="student-card w-[110px] sm:w-[140px] relative border sm:border-2 ${badgeColor} p-1.5 sm:px-2 sm:py-2 rounded-lg cursor-pointer transition-all duration-200 select-none ${selectedStyle} flex flex-col items-center justify-center min-h-[55px] sm:min-h-[65px]">
                    
                    ${attendanceBtnHtml}
                    ${memberDrawnBadge}
                    
                    <div class="flex items-center justify-center mt-2.5 sm:mt-1 z-10 w-full px-1">
                        <span class="font-black text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis ${!s.attendance ? 'line-through opacity-60' : ''}">${escapeHTML(s.name)}</span>
                        ${penaltyCardsHtml}
                    </div>

                    <div class="flex items-center justify-center gap-1.5 w-full bg-white/70 rounded px-1 py-1 border border-white/50 mt-1 shadow-inner flex-wrap">
                        <span class="text-[9px] sm:text-[10px] font-bold text-slate-600 tracking-tighter whitespace-nowrap flex items-center">
                            볼센스: <span class="ml-0.5 text-[10px] sm:text-xs">${bsEmoji}</span>
                        </span>
                        <span class="text-slate-300 text-[10px]">|</span>
                        <div class="flex items-center justify-center gap-0.5">
                            <span class="text-[9px] sm:text-[10px] font-mono font-bold text-slate-700 tracking-tighter whitespace-nowrap">⚡${recText}</span>
                            ${rankStr}
                        </div>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    </div>`;
    
    container.innerHTML = html;
}

// 엑셀 명단 파싱 및 등록 기능
function createStudentRecord(no, name, gender) {
    return {
        no, name, gender, ballSense: '0', attendance: true, score: 0, recordMs: 0,
        memo: '', drawn: false, groupMemberDrawn: false, captain_mixed2: false, captain_mixed3: false,
        captain_mixed4: false, captain_gender: false, group_mixed2: null, group_mixed3: null,
        group_mixed4: null, group_gender: null, penaltyCard: 0, penaltyCardSystem: PENALTY_CARD_SYSTEM_VERSION, selected: false
    };
}

function parseRosterLine(line) {
    const columns = line.includes('\t') ? line.split('\t').map(value => value.trim()) : line.trim().split(/\s+/);
    if (columns.length < 2) return null;

    const hasSchoolRosterColumns = columns.length >= 5
        && /^\d+$/.test(columns[0])
        && /^\d+$/.test(columns[1])
        && /^\d+$/.test(columns[2]);

    const offset = hasSchoolRosterColumns ? 2 : 0;
    const no = Number.parseInt(columns[offset], 10);
    const name = columns[offset + 1]?.trim();
    const rawGender = columns[offset + 2]?.trim() || '-';
    const gender = rawGender === '남자' ? '남' : (rawGender === '여자' ? '여' : rawGender);

    if (!Number.isInteger(no) || no <= 0 || !name || !['남', '여', '-'].includes(gender)) return null;

    let ballSense;
    const rawBallSense = columns[offset + 3];
    if (rawBallSense !== undefined) {
        ballSense = (rawBallSense === '2' || rawBallSense === '상') ? '2' : ((rawBallSense === '1' || rawBallSense === '중') ? '1' : '0');
    }

    const recordSeconds = Number.parseFloat(columns[offset + 4]);
    const group = Number.parseInt(columns[offset + 5], 10);

    return {
        sourceClass: hasSchoolRosterColumns ? normalizeClassName(`${Number.parseInt(columns[0], 10)}-${Number.parseInt(columns[1], 10)}`) : null,
        no,
        name,
        gender,
        ballSense,
        recordMs: Number.isFinite(recordSeconds) ? Math.max(0, Math.round(recordSeconds * 1000)) : undefined,
        group: Number.isInteger(group) && group > 0 ? group : undefined
    };
}

window.importFromExcel = function() {
    const input = document.getElementById('excel-input').value.trim();
    if (!input) { window.showModal("알림", "입력된 데이터가 없습니다."); return; }
    if (!currentClass || !classData[currentClass]) { window.showModal("알림", "첫 화면에서 학급을 먼저 선택해주세요."); return; }

    const lines = input.split(/\r?\n/).filter(line => line.trim());
    let importedCount = 0;
    let invalidCount = 0;
    const mismatchedClasses = new Set();
    const currentStudents = [...classData[currentClass]];

    for (const line of lines) {
        const parsed = parseRosterLine(line);
        if (!parsed) {
            invalidCount++;
            continue;
        }
        if (parsed.sourceClass && parsed.sourceClass !== normalizeClassName(currentClass)) {
            mismatchedClasses.add(parsed.sourceClass);
            continue;
        }

        const existingIndex = currentStudents.findIndex(student => student.no === parsed.no);
        const student = existingIndex >= 0
            ? { ...currentStudents[existingIndex], no: parsed.no, name: parsed.name, gender: parsed.gender }
            : createStudentRecord(parsed.no, parsed.name, parsed.gender);

        if (parsed.ballSense !== undefined) student.ballSense = parsed.ballSense;
        if (parsed.recordMs !== undefined) student.recordMs = parsed.recordMs;
        if (parsed.group !== undefined) student[`group_${currentGroupMode}`] = parsed.group;

        if (existingIndex >= 0) currentStudents[existingIndex] = student;
        else currentStudents.push(student);
        importedCount++;
    }

    if (importedCount > 0) {
        currentStudents.sort((a, b) => a.no - b.no || a.name.localeCompare(b.name, 'ko'));
        classData[currentClass] = currentStudents; saveData(); window.renderStudentList(); window.renderGroups();
        document.getElementById('excel-input').value = "";
        const skippedMessage = mismatchedClasses.size > 0
            ? `<br><span class="text-amber-600">다른 학급(${[...mismatchedClasses].map(escapeHTML).join(', ')}) 자료는 건너뛰었습니다.</span>`
            : (invalidCount > 0 ? `<br><span class="text-amber-600">형식을 확인할 수 없는 ${invalidCount}줄은 건너뛰었습니다.</span>` : '');
        window.showModal("명단 등록 완료", `${importedCount}명의 학생을 현재 학급에 등록했습니다.${skippedMessage}`);
    } else {
        const detail = mismatchedClasses.size > 0 ? '붙여넣은 자료의 학년·반과 현재 선택한 학급이 다릅니다.' : '학년·반·번호·이름·성별 열을 확인해주세요.';
        window.showModal("등록할 학생 없음", detail);
    }
}

// ==========================================
// ⏱️ 다중 스톱워치 코어 엔진
// ==========================================
function getNextGroupActionState(starts, stops) {
    const nextStart = starts.indexOf(null);
    if (nextStart !== -1) return { type: 'start', index: nextStart };
    const nextStop = stops.indexOf(null);
    if (nextStop !== -1) return { type: 'stop', index: nextStop };
    return { type: 'save', index: -1 };
}

window.openGroupStopwatch = function() {
    if(!currentClass || !classData[currentClass]) return;
    groupStudents = classData[currentClass].filter(s => s.selected && s.attendance);
    if(groupStudents.length === 0) return alert("선택된 학생이 없습니다. 출석부나 모둠원 이름을 터치해 선택 상태로 만들어주세요.");

    let n = groupStudents.length;
    groupStarts = new Array(n).fill(null);
    groupStops = new Array(n).fill(null);

    document.getElementById('group-stopwatch-modal').classList.remove('hidden');
    window.renderGroupList();
    window.updateGroupActionButton();
    if(!groupLoopId) groupLoopId = requestAnimationFrame(groupTimerLoop);
}

window.closeGroupStopwatch = function() {
    document.getElementById('group-stopwatch-modal').classList.add('hidden');
    if(groupLoopId) { cancelAnimationFrame(groupLoopId); groupLoopId = null; }
}

window.resetGroupAction = function() {
    if(confirm("측정을 초기화하고 다시 처음부터 재시작하겠습니까?")) {
        let n = groupStudents.length;
        groupStarts = new Array(n).fill(null);
        groupStops = new Array(n).fill(null);
        window.renderGroupList();
        window.updateGroupActionButton();
    }
}

window.handleGroupAction = function() {
    if(navigator.vibrate) navigator.vibrate([30, 50]);
    let n = groupStudents.length;
    const action = getNextGroupActionState(groupStarts, groupStops);

    if(action.type === 'start') {
        groupStarts[action.index] = Date.now();
    } else if(action.type === 'stop') {
        groupStops[action.index] = Date.now();
    } else {
            for(let i = 0; i < n; i++) {
                let elapsed = groupStops[i] - groupStarts[i];
                let s = classData[currentClass].find(st => st.no === groupStudents[i].no);
                if(s) {
                    if(s.recordMs === 0 || elapsed < s.recordMs) s.recordMs = elapsed;
                    s.selected = false; 
                }
            }
            saveData(); 
            window.renderStudentList();
            window.closeGroupStopwatch();
            return;
    }
    window.renderGroupList();
    window.updateGroupActionButton();
}

window.startAllGroupAction = function() {
    if(navigator.vibrate) navigator.vibrate([30, 50, 30]);
    let now = Date.now();
    let n = groupStudents.length;
    let startedCount = 0;
    for(let i = 0; i < n; i++) {
        if(groupStarts[i] === null) { groupStarts[i] = now; startedCount++; }
    }
    if(startedCount > 0) { window.renderGroupList(); window.updateGroupActionButton(); }
}

window.handleIndividualGroupAction = function(i) {
    if (!Number.isInteger(i) || i < 0 || i >= groupStudents.length) return;
    if(navigator.vibrate) navigator.vibrate(20);
    if (groupStarts[i] === null) groupStarts[i] = Date.now();
    else if (groupStops[i] === null) groupStops[i] = Date.now();
    window.renderGroupList(); window.updateGroupActionButton();
}

window.updateGroupActionButton = function() {
    const btn = document.getElementById('btn-group-action');
    const startAllBtn = document.getElementById('btn-group-start-all');
    const action = getNextGroupActionState(groupStarts, groupStops);
    let anyStarted = groupStarts.some(s => s !== null);

    if (startAllBtn) {
        if (anyStarted) startAllBtn.classList.add('hidden');
        else startAllBtn.classList.remove('hidden');
    }
    
    if(action.type === 'start') {
        btn.className = "w-full py-5 sm:py-6 text-2xl sm:text-3xl font-black rounded-2xl shadow-xl transition-all transform active:scale-95 bg-blue-600 text-white hover:bg-blue-700 mt-2";
        btn.innerHTML = `▶ ${action.index + 1}번 출발`;
    } else if (action.type === 'stop') {
        btn.className = "w-full py-6 sm:py-8 text-3xl sm:text-4xl font-black rounded-2xl shadow-xl transition-all transform active:scale-95 bg-red-600 text-white hover:bg-red-700 animate-pulse mt-2";
        btn.innerHTML = `⏸ ${action.index + 1}번 도착`;
    } else {
        btn.className = "w-full py-6 sm:py-8 text-2xl sm:text-3xl font-black rounded-2xl shadow-xl transition-all transform active:scale-95 bg-emerald-600 text-white hover:bg-emerald-700 mt-2";
        btn.innerHTML = `✅ 완벽합니다! 기록 저장`;
    }
}

window.renderGroupList = function() {
    const list = document.getElementById('group-stopwatch-list');
    let html = '';
    groupStudents.forEach((s, i) => {
        let status = `<span class="text-slate-400">대기중</span>`;
        let timeStr = "00.00";
        let rowClass = "bg-white border-slate-200";
        let isNewRecord = false;
        
        let bestRecordStr = s.recordMs > 0 ? window.formatTime(s.recordMs) : '기록없음';
        let recordBadge = `<div class="text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-tighter">최고: ${bestRecordStr}</div>`;
        let btnHtml = `<button onclick="window.handleIndividualGroupAction(${i})" class="ml-2 w-12 sm:w-16 py-1.5 rounded-lg font-bold text-[10px] sm:text-xs border bg-white text-blue-600 border-blue-200 hover:bg-blue-50 transition">▶ 출발</button>`;

        if (groupStops[i] !== null) {
            let elapsed = groupStops[i] - groupStarts[i];
            timeStr = window.formatTime(elapsed);
            isNewRecord = s.recordMs > 0 && elapsed < s.recordMs;
            
            if (isNewRecord) {
                status = `<span class="text-pink-600 font-black px-1.5 py-0.5 bg-pink-100 rounded animate-bounce shadow-sm inline-block">🎉기록경신</span>`;
                rowClass = "bg-pink-50 border-pink-400 ring-2 ring-pink-300";
                recordBadge = `<div class="text-[9px] sm:text-[10px] font-bold text-pink-500 tracking-tighter line-through decoration-pink-300">최고: ${bestRecordStr}</div>`;
            } else {
                status = `<span class="text-emerald-600 font-bold px-1.5 py-0.5 bg-emerald-100 rounded">도착완료</span>`;
                rowClass = "bg-emerald-50 border-emerald-300";
            }
            btnHtml = `<button disabled class="ml-2 w-12 sm:w-16 py-1.5 rounded-lg font-bold text-[10px] sm:text-xs border bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed">완료</button>`;
        } else if (groupStarts[i] !== null) {
            status = `<span class="text-blue-600 font-bold animate-pulse px-1.5 py-0.5 bg-blue-100 rounded">달리는중</span>`;
            timeStr = window.formatTime(Date.now() - groupStarts[i]);
            rowClass = "bg-blue-50 border-blue-300 ring-1 ring-blue-300";
            btnHtml = `<button onclick="window.handleIndividualGroupAction(${i})" class="ml-2 w-12 sm:w-16 py-1.5 rounded-lg font-bold text-[10px] sm:text-xs border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition">⏸ 도착</button>`;
        }

        html += `
            <div class="flex justify-between items-center py-2 px-3 sm:py-2.5 sm:px-4 rounded-xl border ${rowClass} transition-colors shadow-sm">
                <div class="flex flex-col justify-center">
                    <div class="flex items-center gap-2 sm:gap-3">
                        <span class="font-black text-slate-400 w-4 sm:w-5 text-right text-[10px] sm:text-xs">${i+1}</span>
                        <span class="font-black text-slate-800 text-sm sm:text-base">${escapeHTML(s.name)}</span>
                    </div>
                    <div class="ml-6 sm:ml-8 mt-0.5">
                        ${recordBadge}
                    </div>
                </div>
                <div class="flex items-center gap-2 sm:gap-3">
                    <div class="flex flex-col items-end justify-center">
                        <span class="text-[10px] sm:text-xs mb-0.5">${status}</span>
                        <span class="font-mono text-lg sm:text-xl font-black ${isNewRecord ? 'text-pink-600' : 'text-slate-700'} w-16 sm:w-20 text-right leading-none" id="group-time-${i}">${timeStr}</span>
                    </div>
                    ${btnHtml}
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function groupTimerLoop() {
    if (!document.getElementById('group-stopwatch-modal').classList.contains('hidden')) {
        let now = Date.now();
        groupStudents.forEach((s, i) => {
            if (groupStarts[i] !== null && groupStops[i] === null) {
                let el = document.getElementById(`group-time-${i}`);
                if(el) el.innerText = window.formatTime(now - groupStarts[i]);
            }
        });
    }
    groupLoopId = requestAnimationFrame(groupTimerLoop);
}

window.updateFloatingStopwatchBtn = function() {
    if(!currentClass || !classData[currentClass]) return;
    const selectedCount = classData[currentClass].filter(s => s.selected && s.attendance).length;
    const btnContainer = document.getElementById('floating-group-btn-container');
    const countSpan = document.getElementById('float-group-count');
    
    if(btnContainer && countSpan) {
        if(selectedCount > 0) {
            btnContainer.classList.remove('hidden');
            countSpan.innerText = `${selectedCount}명`;
        } else {
            btnContainer.classList.add('hidden');
        }
    }
};
// ==========================================
// 🛡️ [보완 완료] 오프라인 자동저장 및 선택창(드롭다운) 기억 로직
// ==========================================

// 1. 화면 전환 및 브라우저 종료 시 자동 백업 (선택창 포함)
document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === 'hidden') {
    backupAllDataLocally();
    persistEmergencyRecoveryBeforeExit();
    
    // 모바일 사용성을 위한 짧은 진동 피드백
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
  }
});

window.addEventListener('beforeunload', function() {
    backupAllDataLocally();
    persistEmergencyRecoveryBeforeExit();
});

window.addEventListener('pagehide', persistEmergencyRecoveryBeforeExit);

window.addEventListener('offline', () => {
    if (userId) setSyncStatus('offline', latestRecoveryRecord?.dirty ? '오프라인 · 기기 저장됨' : '오프라인');
});

window.addEventListener('online', () => {
    if (!userId) return;
    if (latestRecoveryRecord?.dirty) {
        pendingCloudPayload = pendingCloudPayload || latestRecoveryRecord.payload;
        saveRequested = true;
        isDebouncing = true;
        setSyncStatus('syncing', 'Firebase 재연결 중');
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flushSaveData, 0);
    } else {
        setSyncStatus('syncing', '연결 확인 중');
    }
});

function persistEmergencyRecoveryBeforeExit() {
    if (!userId || !latestRecoveryRecord?.dirty) return;
    writeEmergencyRecovery(latestRecoveryRecord);
}

// 2. 현재 입력값 및 선택창(?월?주차 등) 상태 로컬 임시 저장 함수
function backupAllDataLocally() {
  // 민감하지 않다고 명시한 UI 상태만 저장합니다.
  const allElements = document.querySelectorAll('[data-persist="true"]');
  allElements.forEach(field => {
    if(field.id || field.name) {
       const key = 'smart_run_backup_' + (field.id || field.name);
       localStorage.setItem(key, field.value);
    }
  });
  
  // 팀 편성 모드 상태 저장
  if (typeof currentGroupMode !== 'undefined') {
      localStorage.setItem('smart_run_group_mode', currentGroupMode);
  }
}

// 3. 앱 재실행 또는 새로고침 시 데이터 및 선택창 상태 자동 복원
window.addEventListener('DOMContentLoaded', () => {
  // 페이지가 로드되면 잠시 후(0.1초 뒤) 데이터를 복원하여 브라우저 안정성을 높입니다.
  setTimeout(() => {
    const allElements = document.querySelectorAll('[data-persist="true"]');
    allElements.forEach(field => {
      const key = 'smart_run_backup_' + (field.id || field.name);
      const savedValue = localStorage.getItem(key);
      
      if (savedValue) {
        field.value = savedValue;
        
        // 드롭다운 선택창의 경우, 값이 바뀌었다고 앱에 알려주는 신호(이벤트)를 강제로 발생시킵니다.
        if (field.tagName === 'SELECT') {
          field.dispatchEvent(new Event('change'));
        }
      }
    });
    
    const savedGroupMode = localStorage.getItem('smart_run_group_mode');
    if (savedGroupMode && typeof currentGroupMode !== 'undefined') {
        currentGroupMode = savedGroupMode;
    }
  }, 100);
});

// 4. 사용자가 무언가를 타이핑하거나 드롭다운을 선택하는 즉시 실시간 백업
document.addEventListener('input', function(e) {
  saveTargetElement(e.target);
});

document.addEventListener('change', function(e) {
  saveTargetElement(e.target);
});

// 실시간 저장 처리 돕는 함수
function saveTargetElement(target) {
  if (target?.dataset?.persist !== 'true') return;
  if(['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      if(target.id || target.name) {
          const key = 'smart_run_backup_' + (target.id || target.name);
          localStorage.setItem(key, target.value);
      }
  }
}
