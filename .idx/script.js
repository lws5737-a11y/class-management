import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 오디오 Context ---
let audioCtx;
window.playCoinSound = function() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(987.77, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.3);
    } catch(e) { console.error("Audio Error:", e); }
}
window.playBumpSound = function() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'triangle'; osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.2);
    } catch(e) { console.error("Audio Error:", e); }
}

// 🥁 이벤트 사운드 (두구두구 드럼롤)
window.playDrumRoll = function() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(100 + Math.random() * 50, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(); osc.stop(audioCtx.currentTime + 0.1);
            }, i * 100);
        }
    } catch(e) { console.error("Audio Error:", e); }
}

// 🎺 이벤트 사운드 (그랜드 팡파르)
window.playGrandFanfare = function() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const playChord = (freqs, t, d) => {
            freqs.forEach(f => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.value = f;
                gain.gain.setValueAtTime(0.15, audioCtx.currentTime + t);
                gain.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + t + d);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime + t); osc.stop(audioCtx.currentTime + t + d);
            });
        };
        playChord([440, 554.37, 659.25], 0, 0.2); // A major
        playChord([440, 554.37, 659.25], 0.2, 0.2);
        playChord([440, 554.37, 659.25], 0.4, 0.2);
        playChord([493.88, 587.33, 739.99], 0.6, 0.4); // B minor
        playChord([523.25, 659.25, 783.99, 1046.50], 1.0, 1.5); // C major
    } catch(e) { console.error("Audio Error:", e); }
}

// 🎉 화려한 폭죽(Confetti) 캔버스 로직
window.fireConfetti = function() {
    const canvas = document.getElementById('confetti-canvas');
    canvas.classList.remove('hidden');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const particles = [];
    const colors = ['#fce18a', '#ff726d', '#b48def', '#f4306d', '#48b8d0', '#3498db', '#2ecc71', '#ffb74d'];
    
    for(let i = 0; i < 200; i++) {
        particles.push({
            x: canvas.width / 2, // 정중앙 하단 부근에서 폭발
            y: canvas.height / 2 + 150,
            r: Math.random() * 8 + 4,
            dx: Math.random() * 30 - 15,
            dy: Math.random() * -25 - 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.floor(Math.random() * 10) - 10,
            tiltAngle: 0,
            tiltAngleInc: (Math.random() * 0.07) + 0.05
        });
    }
    let animationFrame;
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        particles.forEach(p => {
            p.tiltAngle += p.tiltAngleInc;
            p.y += (Math.cos(p.tiltAngle) + 1 + p.r / 2) / 2;
            p.x += Math.sin(p.tiltAngle) * 2;
            p.dy += 0.3; // 중력
            p.y += p.dy;
            p.x += p.dx;
            if (p.y <= canvas.height) active = true;
            
            ctx.beginPath();
            ctx.lineWidth = p.r;
            ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.tilt + p.r, p.y);
            ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
            ctx.stroke();
        });
        if (active) animationFrame = requestAnimationFrame(render);
        else {
            cancelAnimationFrame(animationFrame);
            canvas.classList.add('hidden');
        }
    }
    render();
}

// --- 볼센스로 통합된 UI 함수 ---
window.getAbilityHTML = function(type, val) {
    let emoji = type === 'ballSense' ? '⚽' : '⚡';

    if (val === '1' || val === '하') {
        return `<div class="emoji-lvl-1"><span>${emoji}</span></div>`;
    } else if (val === '2' || val === '중') {
        return `<div class="emoji-lvl-2"><span>${emoji}</span><span>${emoji}</span></div>`;
    } else if (val === '3' || val === '상') {
        return `<div class="emoji-lvl-3"><span>${emoji}</span><span>${emoji}</span><span>${emoji}</span></div>`;
    }
    return `<span class="text-slate-300 text-[10px] font-bold">-</span>`;
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
let activeStudentTimers = {}; 
let timerLoopStarted = false; 
let draggedStudentNo = null;

// 드래그 앤 드롭 ...
window.handleDragStart = function(e, studentNo) {
    window.isDraggingCard = true;
    draggedStudentNo = studentNo;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { e.target.style.opacity = '0.4'; e.target.style.transform = 'scale(0.95)'; }, 0);
};
window.handleDragEnd = function(e) {
    window.isDraggingCard = false;
    e.target.style.opacity = '1'; e.target.style.transform = 'scale(1)'; draggedStudentNo = null;
};
window.handleDragOver = function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

window.handleDropOnStudent = function(e, targetStudentNo) {
    e.preventDefault(); e.stopPropagation(); 
    if (!draggedStudentNo || draggedStudentNo === targetStudentNo) return;
    const students = classData[currentClass];
    const draggedIndex = students.findIndex(s => s.no === draggedStudentNo);
    const targetIndex = students.findIndex(s => s.no === targetStudentNo);

    if (draggedIndex > -1 && targetIndex > -1) {
        const draggedStudent = students[draggedIndex]; const targetStudent = students[targetIndex];
        const draggedGroup = draggedStudent[`group_${currentGroupMode}`]; const targetGroup = targetStudent[`group_${currentGroupMode}`];

        if (draggedGroup !== targetGroup) {
            draggedStudent[`group_${currentGroupMode}`] = targetGroup; targetStudent[`group_${currentGroupMode}`] = draggedGroup;
        } else {
            students.splice(draggedIndex, 1); 
            const newTargetIndex = students.findIndex(s => s.no === targetStudentNo);
            students.splice(newTargetIndex, 0, draggedStudent);
        }
        saveData(); renderStudentList(); renderGroups();
    }
};

window.handleDropOnGroup = function(e, targetGroupId) {
    e.preventDefault();
    if (!draggedStudentNo) return;
    const students = classData[currentClass];
    const draggedStudent = students.find(s => s.no === draggedStudentNo);
    if (draggedStudent && draggedStudent[`group_${currentGroupMode}`] !== targetGroupId) {
        draggedStudent[`group_${currentGroupMode}`] = targetGroupId;
        saveData(); renderStudentList(); renderGroups();
    }
};

// =========================================
// NEW: 학급 선택 모달 관련 함수
// =========================================
window.openClassSelectionModal = function() {
    const modal = document.getElementById('class-selection-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        renderClassSelect(); // 모달을 열 때마다 내용을 다시 렌더링
    }
}

window.closeClassSelectionModal = function() {
    const modal = document.getElementById('class-selection-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// =========================================
// NEW: 학생 추가 폼 토글 함수
// =========================================
window.toggleAddStudentForm = function() {
    const form = document.getElementById('add-student-form');
    const btn = document.getElementById('show-add-student-form-btn');
    if (form) {
        form.classList.toggle('hidden');
        if (btn) {
            btn.innerText = form.classList.contains('hidden') ? '✚ 새 학생 추가' : '▲ 추가 창 닫기';
        }
    }
}

const TOTAL_STAMP_CELLS = 20;
const defaultStampImg = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0NSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZWY0NDQ0IiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1kYXNoYXJyYXk9IjYgNCIvPgogIDxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjM4IiBmaWxsPSJub25lIiBzdHJva2U9IiNlZjQ0NDQiIHN0cm9rZS13aWR0aD0iMSIvPgogIDx0ZXh0IHg9IjUwIiB5PSI0NSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiNlZjQ0NDQiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7ssLg8L3RleHQ+CiAgPHRleHQgeD0iNTAiIHk9IjcwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iI2VmNDQ0NCIgZm9udC13ZWlnaHQ9ImJvbGQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPueemO2WiOyWtOyalDwvdGV4dD4KPC9zdmc+";
let globalStampImage = localStorage.getItem('customStamp') || defaultStampImg;

const abilitiesCycle = ['-', '1', '2', '3']; 
const getGroupsCycle = () => {
    let max = currentGroupMode === 'mixed2' ? 2 : (currentGroupMode === 'mixed3' ? 3 : 4);
    const cycle = [null]; for(let i=1; i<=max; i++) cycle.push(i); return cycle;
};

let db = null; let auth = null; let userId = null; let appId = 'smart-class-manager'; 
let isDebouncing = false; let unsubscribeSnapshot = null;

function normalizeClassName(name) { return !name ? name : name.replace(/(\d+)\s*학년\s*(\d+)\s*반/g, '$1-$2'); }

try {
    const firebaseConfig = {
        apiKey: "AIzaSyA-vIm-4bfeI73KIBTXfkUCaW2sLu5jRzc",
        authDomain: "lws5737-a6105.firebaseapp.com",
        projectId: "lws5737-a6105",
        storageBucket: "lws5737-a6105.firebasestorage.app",
        messagingSenderId: "729062934950",
        appId: "1:729062934950:web:615529a26e02081c182767",
        measurementId: "G-LVB2WTXNGV"
    };
    
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app); db = getFirestore(app);
    const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });

    window.signInWithGoogle = function() {
        const btn = document.getElementById('btn-login');
        btn.innerHTML = '<svg class="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 로그인 중...';
        
        signInWithPopup(auth, provider).catch((error) => {
            console.error("Login Failed:", error);
            alert("로그인에 실패했습니다. 팝업이 차단되었는지 확인해주세요.");
            btn.innerHTML = '<svg class="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg> Google 계정으로 시작하기';
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
        } else {
            userId = null;
            if(unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('app-container').classList.add('hidden');
            classData = {}; groupScores = {}; groupRecords = {}; classStamps = {}; activeTimers = {}; activeStudentTimers = {};
            currentClass = ""; 
            renderClassSelect();
        }
    });
} catch (e) { console.error("Firebase Init Error:", e); }


// ==========================================
// 🏟️ V44 가가볼 전용 로직
// ==========================================
window.switchGagaTab = function(tab) {
    ['score', 'rank', 'team'].forEach(t => {
        document.getElementById(`gaga-view-${t}`).classList.add('hidden');
        document.getElementById(`gaga-btn-${t}`).classList.remove('bg-slate-800', 'text-white', 'shadow-md');
        document.getElementById(`gaga-btn-${t}`).classList.add('bg-slate-100', 'text-slate-600');
    });
    document.getElementById(`gaga-view-${tab}`).classList.remove('hidden');
    document.getElementById(`gaga-btn-${tab}`).classList.add('bg-slate-800', 'text-white', 'shadow-md');
    document.getElementById(`gaga-btn-${tab}`).classList.remove('bg-slate-100', 'text-slate-600');
    
    if(tab === 'score') renderGagaball();
    if(tab === 'rank') renderGagaRanking();
    if(tab === 'team') renderGagaTeamView();
}

function generateCuteAvatar(name) { return `https://robohash.org/${encodeURIComponent(name)}?set=set4&size=150x150`; }
const fallbackSVG = `data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2250%22%20fill%3D%22%23f1f2f6%22%2F%3E%3Ctext%20x%3D%2250%22%20y%3D%2268%22%20font-size%3D%2245%22%20text-anchor%3D%22middle%22%3E%F0%9F%91%A4%3C%2Ftext%3E%3C%2Fsvg%3E`;

window.renderGagaball = function() {
    const activeGrid = document.getElementById('gaga-active-grid');
    const inactiveGrid = document.getElementById('gaga-inactive-grid');
    if(!activeGrid || !currentClass) return;
    
    activeGrid.innerHTML = ''; inactiveGrid.innerHTML = '';
    let availableTotal = 0, availableBoys = 0, availableGirls = 0;

    const students = [...(classData[currentClass] || [])].sort((a,b) => a.no - b.no);

    students.forEach((s) => {
        const isDrawn = s.drawn; const drawnClass = isDrawn ? 'drawn' : '';
        const btnText = s.attendance ? '참석' : '불참';
        const btnClass = s.attendance ? 'bg-green-500 text-white' : 'bg-slate-400 text-white opacity-80';
        
        let borderStyle = s.gender === '남' ? '#3498db' : (s.gender === '여' ? '#e74c3c' : '#2ecc71');
        if(!s.attendance || isDrawn) borderStyle = '#95a5a6';

        if(s.attendance && !isDrawn) {
            availableTotal++; if(s.gender === '남') availableBoys++; if(s.gender === '여') availableGirls++;
        }
        let bgColor = s.attendance && !isDrawn ? (s.gender === '남' ? '#e3f2fd' : '#ffebee') : '#fff';
        const cuteAvatar = generateCuteAvatar(s.name); 

        const cardHTML = `
            <div class="score-item ${drawnClass}" style="border-color: ${borderStyle}; background-color: ${bgColor};" onclick="window.toggleAttendance(${s.no})">
                ${isDrawn ? '<div class="absolute -top-3 -right-3 bg-slate-800 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow">완료</div>' : ''}
                <div class="flex justify-between items-center mb-3">
                    <span class="font-mono font-bold text-slate-500 text-lg">${s.no}번</span>
                    <span class="${btnClass} px-3 py-1 rounded-md text-sm font-bold transition">${btnText}</span>
                </div>
                <img src="${cuteAvatar}" alt="avatar" class="avatar-img" onerror="this.onerror=null; this.src='${fallbackSVG}';" style="border-color: ${borderStyle};">
                <div class="name">${s.name} <span class="text-lg">(${s.gender})</span></div>
                <div class="score-val">${s.score || 0}</div>
                <div class="score-ctrl" onclick="event.stopPropagation()">
                    <button class="minus hover:bg-red-600" onclick="window.changeGagaScore(${s.no}, -1)">-</button>
                    <button class="hover:bg-blue-600" onclick="window.changeGagaScore(${s.no}, 1)">+</button>
                </div>
            </div>
        `;
        if(s.attendance) activeGrid.innerHTML += cardHTML; else inactiveGrid.innerHTML += cardHTML;
    });
    document.getElementById('gaga-draw-stats').innerText = `대기: 총 ${availableTotal}명 (남 ${availableBoys} / 여 ${availableGirls})`;
};

window.changeGagaScore = function(no, val) {
    const student = classData[currentClass].find(s => s.no == no); if(!student) return;
    if (val > 0) window.playCoinSound(); else window.playBumpSound();
    student.score = Math.max(0, (student.score || 0) + val);
    saveData(); renderGagaball(); renderGagaRanking(); renderDrawSection(); renderStudentList();
    
    const modalSpan = document.getElementById(`modal-score-${no}`); if(modalSpan) modalSpan.innerText = student.score;
}

window.renderGagaRanking = function() {
    const tbody = document.getElementById('gaga-ranking-body'); if(!tbody || !currentClass) return;
    tbody.innerHTML = '';
    const studentsForRank = [...(classData[currentClass] || [])].filter(s => s.attendance).sort((a, b) => (b.score || 0) - (a.score || 0));
    
    let rank = 1;
    studentsForRank.forEach((s, i) => {
        if (i > 0 && (studentsForRank[i].score || 0) < (studentsForRank[i-1].score || 0)) rank = i + 1;
        let rClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : ''));
        tbody.innerHTML += `<tr class="${rClass}"><td>${rank}위</td><td class="font-bold">${s.name}</td><td class="font-black text-red-500">${s.score || 0}점</td></tr>`;
    });
}

// --- 화려한 추첨 이벤트 로직 ---
window.triggerGagaDraw = function(targetGender) {
    if(!currentClass) return;
    const drawCount = parseInt(document.getElementById('gaga-draw-count').value, 10);
    let available = classData[currentClass].filter(s => s.attendance && !s.drawn && (targetGender === 'all' || s.gender === targetGender));
    if(available.length === 0) return window.showModal("알림", "현재 대기 중인 학생이 없습니다.");
    
    document.getElementById('event-loading-overlay').classList.remove('hidden');
    document.getElementById('event-loading-overlay').classList.add('flex');
    window.playDrumRoll();

    setTimeout(() => {
        document.getElementById('event-loading-overlay').classList.add('hidden');
        document.getElementById('event-loading-overlay').classList.remove('flex');
        window.executeGagaDraw(targetGender, drawCount, available);
    }, 2500);
}

window.executeGagaDraw = function(targetGender, drawCount, available) {
    const actualDrawCount = Math.min(drawCount, available.length);
    
    for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
    }

    const picked = available.slice(0, actualDrawCount);
    const pickedHTML = [];

    picked.forEach(s => {
        s.drawn = true;
        let borderColor = s.gender === '남' ? '#3498db' : '#e74c3c';
        const cuteAvatar = generateCuteAvatar(s.name);
        
        pickedHTML.push(`
            <div class="border-[6px] p-6 rounded-3xl text-center shadow-xl bg-white w-64 transform transition hover:scale-105" style="border-color: ${borderColor};">
                <img src="${cuteAvatar}" class="w-32 h-32 rounded-full mx-auto mb-4 bg-slate-50 border-4 border-slate-100" onerror="this.onerror=null; this.src='${fallbackSVG}';">
                <div class="text-4xl font-black text-slate-800 mb-4">${s.name}</div>
                <div class="text-3xl font-bold text-red-500 flex items-center justify-center gap-4">
                    <button class="bg-red-500 text-white rounded-xl w-14 h-14 flex items-center justify-center hover:bg-red-600 transition" onclick="window.changeGagaScore(${s.no}, -1)">-</button>
                    <span id="modal-score-${s.no}" class="w-16 text-center">${s.score || 0}</span>
                    <button class="bg-blue-500 text-white rounded-xl w-14 h-14 flex items-center justify-center hover:bg-blue-600 transition" onclick="window.changeGagaScore(${s.no}, 1)">+</button>
                </div>
            </div>
        `);
    });

    saveData(); renderGagaball(); renderDrawSection();
    
    document.getElementById('gagaDrawResultGrid').innerHTML = pickedHTML.join('');
    document.getElementById('gagaDrawModal').style.display = 'flex';

    window.playGrandFanfare();
    window.fireConfetti();
}

window.resetGagaDraw = function() {
    if(!currentClass) return;
    window.showModal("추첨 초기화", "추첨 기록을 초기화하시겠습니까?", true, () => {
        classData[currentClass].forEach(s => s.drawn = false); saveData(); renderGagaball(); renderDrawSection();
    });
}

window.closeGagaDrawModal = function() { document.getElementById('gagaDrawModal').style.display = 'none'; }

// --- 가가볼 팀 편성 (TV 최적화 & 화려한 이벤트) ---
let currentGagaTeams = [];

window.triggerGagaTeams = function() {
    if(!currentClass) return;
    const numTeams = parseInt(document.getElementById('gaga-team-count').value, 10);
    let available = classData[currentClass].filter(s => s.attendance);
    if(available.length < numTeams) return window.showModal("인원 부족", `참가 학생이 너무 적습니다.`);

    document.getElementById('event-loading-overlay').classList.remove('hidden');
    document.getElementById('event-loading-overlay').classList.add('flex');
    document.getElementById('event-loading-text').innerText = "팀 밸런스 조정중...";
    window.playDrumRoll();

    setTimeout(() => {
        document.getElementById('event-loading-overlay').classList.add('hidden');
        document.getElementById('event-loading-overlay').classList.remove('flex');
        document.getElementById('event-loading-text').innerText = "두구두구두구..."; // 복구
        window.executeGagaTeams(numTeams, available);
    }, 2500);
}

window.executeGagaTeams = function(numTeams, available) {
    const totalParticipants = available.length;
    const baseSize = Math.floor(totalParticipants / numTeams);
    const remainder = totalParticipants % numTeams;
    
    let targetSizes = new Array(numTeams).fill(baseSize);
    for(let i = 0; i < remainder; i++) targetSizes[i]++;

    const teams = Array.from({length: numTeams}, (_, i) => ({ id: i + 1, members: [], score: 0, targetSize: targetSizes[i] }));

    const sortByPower = (a, b) => {
        let powerA = (a.score || 0) * 10 + (parseInt(a.ballSense)||0) + (parseInt(a.agility)||0);
        let powerB = (b.score || 0) * 10 + (parseInt(b.ballSense)||0) + (parseInt(b.agility)||0);
        return powerB - powerA;
    };

    let boys = available.filter(s => s.gender === '남').sort(sortByPower);
    let girls = available.filter(s => s.gender === '여').sort(sortByPower);

    function distribute(group) {
        group.forEach(student => {
            let eligibleTeams = teams.filter(t => t.members.length < t.targetSize);
            let minMembers = Math.min(...eligibleTeams.map(t => t.members.length));
            eligibleTeams = eligibleTeams.filter(t => t.members.length === minMembers);
            
            eligibleTeams.sort(() => Math.random() - 0.5); 
            eligibleTeams.sort((a, b) => a.score - b.score); 
            
            eligibleTeams[0].members.push(student);
            eligibleTeams[0].score += (student.score || 0);
        });
    }
    
    distribute(boys); distribute(girls);
    currentGagaTeams = teams;
    renderGagaTeamView();

    window.playGrandFanfare();
    window.fireConfetti();
}

window.renderGagaTeamView = function() {
    const container = document.getElementById('gaga-team-matchups');
    if (!container) return;
    container.innerHTML = '';
    
    for(let i = 0; i < currentGagaTeams.length; i += 2) {
        const teamA = currentGagaTeams[i]; const teamB = currentGagaTeams[i+1];
        if (!teamA) continue;

        const createBadges = (members) => members.map(m => `
            <div class="team-member-badge" style="border-color:${m.gender==='남'?'#3498db':'#e74c3c'};">
                <img src="${generateCuteAvatar(m.name)}" onerror="this.onerror=null; this.src='${fallbackSVG}';">
                <div class="member-info">
                    <b>${m.name}</b>
                    <span>${m.score || 0}점</span>
                </div>
            </div>`).join('');

        const createPanel = (team) => `
            <div class="team-card-left">
                <div class="team-title">${team.id}팀</div>
                <div class="mt-auto">
                    <div class="stepper-ctrl">
                        <button class="stepper-btn" onclick="document.getElementById('ts-${team.id}').stepDown()">-</button>
                        <input type="number" id="ts-${team.id}" class="team-score-input" value="1" min="1">
                        <button class="stepper-btn" onclick="document.getElementById('ts-${team.id}').stepUp()">+</button>
                    </div>
                    <button class="btn-team-add" onclick="window.addGagaTeamScore(${team.id})">포인트 획득</button>
                </div>
            </div>
        `;

        container.innerHTML += `
            <div class="matchup-row">
                <div class="team-card team-a">${createPanel(teamA)} <div class="team-card-right">${createBadges(teamA.members)}</div></div>
                ${teamB ? `<div class="vs-badge">VS</div><div class="team-card team-b">${createPanel(teamB)} <div class="team-card-right">${createBadges(teamB.members)}</div></div>` : ''}
            </div>`;
    }
}

window.addGagaTeamScore = function(teamId) {
    const val = parseInt(document.getElementById(`ts-${teamId}`).value, 10);
    if(isNaN(val) || val === 0) return;
    if (val > 0) window.playCoinSound(); else window.playBumpSound();

    const team = currentGagaTeams.find(t => t.id === teamId);
    if (!team) return;
    team.members.forEach(m => {
        const student = classData[currentClass].find(s => s.no === m.no);
        if(student) { student.score = Math.max(0, (student.score || 0) + val); m.score = student.score; }
    });
    saveData(); renderGagaTeamView(); renderGagaball(); renderGagaRanking(); renderDrawSection(); renderStudentList();
}

// --- 모달 헬퍼 ---
window.openTimerSelectModal = function() { document.getElementById('timerSelectModal').style.display = 'flex'; }
window.closeTimerSelectModal = function() { document.getElementById('timerSelectModal').style.display = 'none'; }

// --- 룰렛 모달 ---
const individualMissions = [
    { text: "그냥 가가볼", weight: 70, color: "#81ecec", desc: "평소처럼 가가볼을 즐기세요." },
    { text: "체육쌤 레이드", weight: 10, color: "#ff7675", desc: "체육쌤이 경기장에 등장했습니다! 체육쌤을 아웃시키면 추가 점수가 주어집니다!" },
    { text: "포인트 X2", weight: 20, color: "#ffeaa7", desc: "최종 승자에게는 평소보다 2배의 포인트가 주어집니다." }
];
const teamMissions = [
    { text: "그냥 가가볼", weight: 70, color: "#81ecec", desc: "평소처럼 가가볼을 즐기세요." },
    { text: "왕을 잡아라!", weight: 15, color: "#a29bfe", desc: "양팀은 우리팀 왕을 한명 정해주세요. 상대팀 왕을 먼저 아웃시키는 팀이 승리합니다." },
    { text: "포인트 X2", weight: 15, color: "#ffeaa7", desc: "최종 승리팀 전원에게 평소보다 2배의 포인트가 주어집니다." }
];

let currentMissions = individualMissions; let currentRouletteRotation = 0; let isSpinning = false;

window.openRouletteModal = function(type) {
    if(type === 'team') { currentMissions = teamMissions; document.getElementById('rouletteModalTitle').innerText = "🎡 팀전 미션 룰렛"; } 
    else { currentMissions = individualMissions; document.getElementById('rouletteModalTitle').innerText = "🎡 개인전 미션 룰렛"; }
    document.getElementById('rouletteModal').style.display = 'flex'; setTimeout(window.drawRoulette, 50); 
}

window.closeRouletteModal = function() { if(isSpinning) return; document.getElementById('rouletteModal').style.display = 'none'; }

window.drawRoulette = function() {
    const canvas = document.getElementById("rouletteCanvas"); if (!canvas.getContext) return;
    const ctx = canvas.getContext("2d"); const cw = canvas.width; const ch = canvas.height; 
    ctx.clearRect(0, 0, cw, ch);
    let startAngle = -0.5 * Math.PI; 
    for(let i=0; i<currentMissions.length; i++) {
        let sliceAngle = (currentMissions[i].weight / 100) * 2 * Math.PI;
        ctx.beginPath(); ctx.moveTo(cw/2, ch/2); ctx.arc(cw/2, ch/2, cw/2, startAngle, startAngle + sliceAngle);
        ctx.fillStyle = currentMissions[i].color; ctx.fill();
        ctx.lineWidth = 8; ctx.strokeStyle = "#ffffff"; ctx.stroke();
        ctx.save(); ctx.translate(cw/2, ch/2); ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = "right"; ctx.fillStyle = "#2d3436"; ctx.font = "bold 42px Jua"; ctx.fillText(currentMissions[i].text, cw/2 - 45, 15); ctx.restore();
        startAngle += sliceAngle;
    }
    ctx.beginPath(); ctx.arc(cw/2, ch/2, 80, 0, 2 * Math.PI); ctx.fillStyle = "#2d3436"; ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = "#ffffff"; ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 40px Jua"; ctx.fillText("미션", cw/2, ch/2);
}

window.spinRoulette = function() {
    if(isSpinning) return; isSpinning = true;
    const canvas = document.getElementById("rouletteCanvas");
    const spinAngle = Math.floor(Math.random() * 360) + (360 * 5); currentRouletteRotation += spinAngle;
    canvas.style.transition = "transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)"; 
    canvas.style.transform = `rotate(${currentRouletteRotation}deg)`;

    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let startTime = audioCtx.currentTime;
        for(let i=0; i<45; i++) {
            let t = i / 45; let tickTime = startTime + 4.0 * (1 - Math.pow(1 - t, 3.5)); 
            const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
            osc.type = 'triangle'; osc.frequency.setValueAtTime(600 - (i*5), tickTime); 
            gain.gain.setValueAtTime(0, tickTime); gain.gain.linearRampToValueAtTime(0.3, tickTime + 0.01); gain.gain.exponentialRampToValueAtTime(0.01, tickTime + 0.05);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(tickTime); osc.stop(tickTime + 0.05);
        }
    } catch(e) {}

    setTimeout(() => {
        isSpinning = false;
        const normalizedRotation = currentRouletteRotation % 360; let pointerAngle = (360 - normalizedRotation) % 360;
        let currentPos = 0; let winner = null;
        for(let i=0; i<currentMissions.length; i++) {
            let sliceSize = (currentMissions[i].weight / 100) * 360;
            if(pointerAngle >= currentPos && pointerAngle < currentPos + sliceSize) { winner = currentMissions[i]; break; }
            currentPos += sliceSize;
        }
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const playTone = (f, t, d) => {
                const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
                osc.type = 'triangle'; osc.connect(gain); gain.connect(audioCtx.destination);
                osc.frequency.setValueAtTime(f, audioCtx.currentTime + t); gain.gain.setValueAtTime(0.3, audioCtx.currentTime + t); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + t + d);
                osc.start(audioCtx.currentTime + t); osc.stop(audioCtx.currentTime + t + d);
            };
            playTone(523.25, 0.0, 0.2); playTone(523.25, 0.2, 0.2); playTone(523.25, 0.4, 0.2); playTone(659.25, 0.6, 0.2); playTone(783.99, 0.8, 0.6); 
        } catch(e) {}
        window.showMissionDescModal(winner.text, winner.desc);
    }, 4000);
}

window.showMissionDescModal = function(title, text) {
    document.getElementById("missionDescTitle").innerText = "🎯 " + title; document.getElementById("missionDescText").innerText = text; document.getElementById("missionDescModal").style.display = "flex";
}
window.closeMissionDescModal = function() { document.getElementById("missionDescModal").style.display = "none"; }

// ==========================================
// 스마트 앱 기존 로직들
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
    if (isComplete) { badge.classList.remove('hidden'); badge.classList.add('badge-animate'); if (playEffect) window.playFanfareSound(); } 
    else { badge.classList.add('hidden'); }
};

window.resetStampBoard = () => {
    if (confirm("기록을 모두 초기화하시겠습니까?")) { classStamps[currentClass] = Array(TOTAL_STAMP_CELLS).fill(false); saveData(); renderStampBoard(); }
};

window.playStampSound = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const fallOsc = audioCtx.createOscillator(); const fallGain = audioCtx.createGain();
    fallOsc.type = 'sine'; fallOsc.frequency.setValueAtTime(900, now); fallOsc.frequency.exponentialRampToValueAtTime(100, now + 0.35);
    fallGain.gain.setValueAtTime(0, now); fallGain.gain.linearRampToValueAtTime(0.4, now + 0.15); fallGain.gain.linearRampToValueAtTime(0, now + 0.35);
    fallOsc.connect(fallGain); fallGain.connect(audioCtx.destination); fallOsc.start(now); fallOsc.stop(now + 0.35);

    const boomOsc = audioCtx.createOscillator(); const boomGain = audioCtx.createGain();
    boomOsc.type = 'square'; boomOsc.frequency.setValueAtTime(150, now + 0.35); boomOsc.frequency.exponentialRampToValueAtTime(20, now + 0.7);
    boomGain.gain.setValueAtTime(0, now + 0.34); boomGain.gain.setValueAtTime(1.5, now + 0.35); boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
    boomOsc.connect(boomGain); boomGain.connect(audioCtx.destination); boomOsc.start(now + 0.35); boomOsc.stop(now + 0.7);
};

const playTone = (freq, type, duration, gainVal) => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + duration);
};
window.playEraseSound = () => [659, 880, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.4, 0.15), i * 50));
window.playFanfareSound = () => [392, 523, 659].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.8, 0.1), i * 150));

document.getElementById('stampUpload').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { globalStampImage = event.target.result; localStorage.setItem('customStamp', globalStampImage); saveData(); renderStampBoard(); };
    reader.readAsDataURL(file);
});

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

function updateTimersLoop() {
    let now = Date.now();
    for (let i in activeTimers) {
        let t = activeTimers[i];
        if (t.isRunning) {
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
    for (let i in activeStudentTimers) {
        let t = activeStudentTimers[i];
        if (t.isRunning) {
            t.elapsed = now - t.startTime;
            const display = document.getElementById(`st-time-display-${i}`);
            if (display) display.innerText = window.formatTime(t.elapsed);
        }
    }
    requestAnimationFrame(updateTimersLoop);
}
if(!timerLoopStarted) { timerLoopStarted = true; requestAnimationFrame(updateTimersLoop); }

window.toggleStudentTimerPlay = function(studentNo) {
    let t = activeStudentTimers[studentNo]; if (!t) return;
    let now = Date.now();
    if (t.isRunning) {
        t.isRunning = false; window.updateStudentRecord(studentNo, t.elapsed);
        const btn = document.getElementById(`btn-st-play-${studentNo}`);
        if (btn) { btn.innerText = '▶'; btn.classList.remove('text-amber-500'); btn.classList.add('text-slate-400'); }
    } else {
        t.isRunning = true; t.startTime = now - t.elapsed;
        const btn = document.getElementById(`btn-st-play-${studentNo}`);
        if (btn) { btn.innerText = '⏸'; btn.classList.remove('text-slate-400'); btn.classList.add('text-amber-500'); }
    }
}
window.resetStudentTimer = function(studentNo) {
    let t = activeStudentTimers[studentNo]; if (!t) return;
    t.isRunning = false; t.elapsed = 0;
    const display = document.getElementById(`st-time-display-${studentNo}`); if (display) display.innerText = window.formatTime(t.elapsed);
    const btn = document.getElementById(`btn-st-play-${studentNo}`); if (btn) { btn.innerText = '▶'; btn.classList.remove('text-amber-500'); btn.classList.add('text-slate-400'); }
    window.updateStudentRecord(studentNo, t.elapsed);
}
window.manualStudentTimeEdit = function(studentNo) {
    let t = activeStudentTimers[studentNo]; if (!t || t.isRunning) return;
    let input = prompt("개인 기록을 초 단위 또는 분:초(예: 12.5 또는 1:23.45)로 입력하세요.", window.formatTime(t.elapsed));
    if (input !== null && input.trim() !== '') {
        t.elapsed = window.parseTime(input);
        const display = document.getElementById(`st-time-display-${studentNo}`); if (display) display.innerText = window.formatTime(t.elapsed);
        window.updateStudentRecord(studentNo, t.elapsed);
    }
}
window.updateStudentRecord = function(studentNo, elapsedMs) {
    if (!currentClass || !classData[currentClass]) return;
    const student = classData[currentClass].find(s => s.no == studentNo);
    if (student) { student.recordMs = elapsedMs; saveData(); }
}
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
                s.ballSense = maxSense > 0 ? String(maxSense) : '-'; delete s.handSense; delete s.footSense;
            }
            if (s.agility !== undefined) {
                let num = s.agility; if (s.agility === '상') num = '3'; else if (s.agility === '중') num = '2'; else if (s.agility === '하') num = '1';
                s.agility = num;
            }
            if (!s.ballSense) s.ballSense = '-'; if (!s.agility) s.agility = '-';
            if (s.isCaptain === undefined) s.isCaptain = false;
            if (s.group !== undefined) { s.group_mixed4 = s.group; s.group_mixed3 = null; s.group_mixed2 = null; s.group_gender = null; delete s.group; }
            if (s.group_mixed2 === undefined) s.group_mixed2 = null;
            if (s.group_mixed3 === undefined) s.group_mixed3 = null;
            if (s.group_mixed4 === undefined) s.group_mixed4 = null;
            if (s.group_gender === undefined) s.group_gender = null;
            delete s.group_partner;
        });
    }
}

function setupFirestoreListener() {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', appId, 'users', userId, 'classData', 'mainDoc');
    if (unsubscribeSnapshot) unsubscribeSnapshot(); 
    const syncIcon = document.getElementById('sync-status');
    if(syncIcon) { syncIcon.classList.remove('hidden'); syncIcon.classList.add('flex'); }

    unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
        if (isDebouncing) return;
        if(syncIcon) { syncIcon.classList.add('hidden'); syncIcon.classList.remove('flex'); }
        if (docSnap.exists()) {
            const data = docSnap.data();
            classData = data.data || {}; 
            groupScores = data.scores || {}; 
            groupRecords = data.records || {}; 
            classStamps = data.stamps || {};
            if (data.stampImage) { 
                globalStampImage = data.stampImage; 
                localStorage.setItem('customStamp', globalStampImage); 
                document.querySelectorAll('.stamp-img').forEach(img => { img.src = globalStampImage; }); 
            }
            migrateData();
        }
        renderClassSelect();
        if (currentClass && classData[currentClass]) {
            showTab(currentTab);
        } else if (currentClass && !classData[currentClass]) {
            currentClass = "";
            document.getElementById('tab-navigation').classList.add('hidden');
            ['student-management', 'group-section', 'draw-section', 'stamp-section', 'gagaball-section'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
            renderClassSelect();
        } else {
            renderClassSelect();
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
        
        const docRef = doc(db, 'artifacts', appId, 'users', userId, 'classData', 'mainDoc');
        setDoc(docRef, { data: classData, scores: groupScores, records: groupRecords, stamps: classStamps, stampImage: globalStampImage })
            .then(() => { isDebouncing = false; setTimeout(() => {if(syncIcon) { syncIcon.classList.add('hidden'); syncIcon.classList.remove('flex'); }}, 500); } )
            .catch((error) => { console.error("클라우드 자동 저장 실패:", error); isDebouncing = false; if(syncIcon) { syncIcon.classList.add('hidden'); syncIcon.classList.remove('flex'); } });
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

// MODIFIED: 학급 선택 로직을 모달용으로 변경
window.renderClassSelect = function() {
    const container = document.getElementById('class-buttons-container');
    const display = document.getElementById('current-class-display');
    if(!container) return;
    
    container.innerHTML = '';
    const classes = Object.keys(classData).sort();
    
    if (classes.length === 0) {
        container.innerHTML = '<p class="text-slate-500 p-4 text-center">등록된 학급이 없습니다.<br>아래에서 새 학급을 추가해주세요.</p>';
    } else {
        classes.forEach(cls => {
            const button = document.createElement('button');
            button.className = "w-full p-4 mb-2 text-left font-bold rounded-lg transition text-lg";
            if (currentClass === cls) {
                button.classList.add('bg-blue-600', 'text-white', 'shadow-md');
            } else {
                button.classList.add('bg-slate-100', 'text-slate-800', 'hover:bg-slate-200');
            }
            button.innerText = cls;
            button.onclick = function() {
                window.selectClass(cls);
                window.closeClassSelectionModal();
            };
            container.appendChild(button);
        });
    }

    if (display) {
        if (currentClass) {
            display.innerText = currentClass;
        } else {
            display.innerText = "학급 선택";
        }
    }
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
    saveData(); input.value = ""; 
    window.selectClass(newClassName);
    renderClassSelect();
    window.showModal("학급 추가 완료", `<b class="text-blue-600">${newClassName}</b> 학급이 추가되었습니다.<br>학생 명단을 설정해주세요.`);
}

window.deleteCurrentClass = function() {
    if (!currentClass) { window.showModal("알림", "삭제할 학급을 먼저 선택해주세요."); return; }
    window.showModal("학급 완전 삭제", `<span class="font-bold text-red-500">${currentClass}</span> 학급을 목록에서 완전히 삭제하시겠습니까?<br><br>모든 학생 명단과 모둠 점수표가 삭제되며 되돌릴 수 없습니다.`, true, () => {
        delete classData[currentClass]; delete groupScores[currentClass]; delete groupRecords[currentClass]; delete classStamps[currentClass];
        saveData(); currentClass = ""; activeTimers = {}; activeStudentTimers = {};
        
        document.getElementById('tab-navigation').classList.add('hidden');
        ['student-management', 'group-section', 'draw-section', 'stamp-section', 'gagaball-section'].forEach(id => document.getElementById(id).classList.add('hidden'));
        
        renderClassSelect();
        window.closeClassSelectionModal();
        window.showModal("삭제 완료", "학급이 성공적으로 삭제되었습니다.");
    }, "삭제");
}

window.deleteAllClasses = function() {
    window.showModal("전체 학급 삭제", `<span class="font-bold text-red-600">등록된 모든 학급</span>의 데이터를 완전히 삭제하시겠습니까?<br><br><span class="text-red-500 font-bold">이 작업은 되돌릴 수 없으며</span> 모든 명단과 모둠 정보가 영구적으로 삭제됩니다.`, true, () => {
        classData = {}; groupScores = {}; groupRecords = {}; classStamps = {}; activeTimers = {}; activeStudentTimers = {}; saveData(); currentClass = "";
        document.getElementById('tab-navigation').classList.add('hidden');
        ['student-management', 'group-section', 'draw-section', 'stamp-section', 'gagaball-section'].forEach(id => document.getElementById(id).classList.add('hidden'));
        
        renderClassSelect();
        window.closeClassSelectionModal();
        window.showModal("삭제 완료", "모든 학급 데이터가 안전하게 삭제되었습니다.");
    }, "전체 삭제");
}

window.exportAllToExcel = function() {
    let csvContent = "\uFEFF"; 
    csvContent += "학급,번호,이름,성별,볼센스,순발력,참석상태,개인점수,혼성2모둠,혼성3모둠,혼성4모둠,동성모둠,그룹점수JSON,그룹기록JSON,체육부장,개인기록\n";

    if (Object.keys(classData).length === 0) {
        csvContent += "=\"6-1\",1,홍길동,남,-,-,참석,0,,,,,N,0\n";
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
                const bs = s.ballSense || '-'; const ag = s.agility || '-'; const score = s.score || 0;
                const g2 = s.group_mixed2 || ''; const g3 = s.group_mixed3 || ''; const g4 = s.group_mixed4 || s.group || ''; const gg = s.group_gender || '';
                const isCapt = s.isCaptain ? 'Y' : 'N';
                const recMs = s.recordMs || 0;
                const jsonScoreCol = (idx === 0) ? `"${gScoresJSON}"` : '';
                const jsonRecordCol = (idx === 0) ? `"${gRecordsJSON}"` : '';
                csvContent += `${safeClassName},${s.no},${s.name},${s.gender},${bs},${ag},${attendance},${score},${g2},${g3},${g4},${gg},${jsonScoreCol},${jsonRecordCol},${isCapt},${recMs}\n`;
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
    const reader = new FileReader();
    reader.onload = function(e) {
        let text = e.target.result; text = text.replace(/^\uFEFF/, '').replace(/\r/g, '');
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) { window.showModal("오류", "파일 형식이 올바르지 않거나 데이터가 없습니다."); event.target.value = ''; return; }

        const header = parseCSVLine(lines[0]);
        if (header[0].trim() !== '학급') { window.showModal("오류", "전체 데이터 백업 파일이 아닙니다."); event.target.value = ''; return; }

        window.showModal("전체 엑셀 불러오기", `파일 내용으로 모든 학급의 명단을 덮어쓰시겠습니까?<br><span class="font-bold text-red-500">주의: 현재 앱에 저장된 모든 데이터가 교체됩니다.</span>`, true, async () => {
            const newData = {}; const newGroupScores = {}; const newGroupRecords = {};
            let idxG2 = header.indexOf('혼성2모둠'); let idxG3 = header.indexOf('혼성3모둠'); let idxG4 = header.indexOf('혼성4모둠'); let idxGG = header.indexOf('동성모둠');
            let idxScores = header.indexOf('그룹점수JSON'); let idxRecords = header.indexOf('그룹기록JSON'); let idxCaptain = header.indexOf('체육부장'); let idxPersonalRec = header.indexOf('개인기록');
            let idxBall = header.indexOf('볼센스'); let idxAgil = header.indexOf('순발력');

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
                let bs = '-', ag = '-'; let attendance = true, score = 0, isCaptain = false, recMs = 0;
                let g2 = null, g3 = null, g4 = null, gg = null;

                if (idxBall > -1) bs = parts[idxBall].trim() === '-' ? '-' : parts[idxBall].trim();
                if (idxAgil > -1) ag = parts[idxAgil].trim() === '-' ? '-' : parts[idxAgil].trim();
                
                let attIdx = header.indexOf('참석상태');
                if(attIdx > -1) attendance = (parts[attIdx].trim() === '출석' || parts[attIdx].trim() === '참석');
                let scoreIdx = header.indexOf('개인점수');
                if(scoreIdx > -1) score = parseInt(parts[scoreIdx].trim()) || 0;

                if (idxG2 > -1 && parts[idxG2]) g2 = parseInt(parts[idxG2].trim()) || null;
                if (idxG3 > -1 && parts[idxG3]) g3 = parseInt(parts[idxG3].trim()) || null;
                if (idxG4 > -1 && parts[idxG4]) g4 = parseInt(parts[idxG4].trim()) || null;
                if (idxGG > -1 && parts[idxGG]) gg = parseInt(parts[idxGG].trim()) || null;
                if (idxCaptain > -1 && parts[idxCaptain]) isCaptain = (parts[idxCaptain].trim() === 'Y');
                if (idxPersonalRec > -1 && parts[idxPersonalRec]) recMs = parseInt(parts[idxPersonalRec].trim()) || 0;
                
                if (idxScores > -1 && parts[idxScores]) { try { newGroupScores[className] = JSON.parse(parts[idxScores].trim()); } catch(e){} }
                if (idxRecords > -1 && parts[idxRecords]) { try { newGroupRecords[className] = JSON.parse(parts[idxRecords].trim()); } catch(e){} }

                newData[className].push({ no: no || (newData[className].length + 1), name: name, gender: gender, ballSense: bs, agility: ag, attendance: attendance, score: score, recordMs: recMs, drawn: false, isCaptain: isCaptain, group_mixed2: g2, group_mixed3: g3, group_mixed4: g4, group_gender: gg });
            }

            if (Object.keys(newData).length > 0) {
                classData = newData; groupScores = newGroupScores; groupRecords = newGroupRecords;
                activeTimers = {}; activeStudentTimers = {};
                
                if (currentClass && !classData[currentClass]) {
                    currentClass = "";
                    document.getElementById('tab-navigation').classList.add('hidden');
                    ['student-management', 'group-section', 'draw-section', 'stamp-section', 'gagaball-section'].forEach(id => document.getElementById(id).classList.add('hidden'));
                }
                
                if (userId && db) {
                    isDebouncing = true;
                    try {
                        const docRef = doc(db, 'artifacts', appId, 'users', userId, 'classData', 'mainDoc');
                        await setDoc(docRef, { data: classData, scores: groupScores, records: groupRecords, stamps: classStamps, stampImage: globalStampImage });
                    } catch (error) { console.error("즉시 저장 실패:", error); } 
                    finally { isDebouncing = false; }
                }

                renderClassSelect();
                if (currentClass) { showTab(currentTab); }
                window.showModal("완료", "모든 학급의 데이터를 성공적으로 복구했습니다.");
            } else { window.showModal("오류", "올바른 데이터를 찾을 수 없습니다."); }
            document.getElementById('csv-all-file-input').value = ''; 
        }, "전체 복구하기");
    };
    reader.readAsText(file, "utf-8");
}

window.selectClass = function(className) {
    currentClass = className; activeTimers = {}; activeStudentTimers = {};
    
    document.getElementById('tab-navigation').classList.remove('hidden');
    window.showTab(currentTab); 
    window.renderClassSelect(); 
}

window.showTab = function(tabName) {
    if (!currentClass) {
        window.openClassSelectionModal();
        return;
    }

    currentTab = tabName;
    ['student-management', 'group-section', 'draw-section', 'stamp-section', 'gagaball-section'].forEach(id => document.getElementById(id).classList.add('hidden'));
    
    ['draw', 'student', 'group', 'stamp', 'gagaball'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if(btn) btn.className = "flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 rounded-xl font-bold text-[10px] sm:text-sm transition text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm whitespace-nowrap";
    });

    const mainContainer = document.getElementById('main-container');
    const headerContainer = document.getElementById('header-inner-container');
    const tabContainer = document.getElementById('tab-inner-container');

    if (tabName === 'gagaball') {
        mainContainer.classList.remove('max-w-4xl'); mainContainer.classList.add('max-w-[98%]');
        if(headerContainer) { headerContainer.classList.remove('max-w-4xl'); headerContainer.classList.add('max-w-[98%]'); }
        if(tabContainer) { tabContainer.classList.remove('max-w-4xl'); tabContainer.classList.add('max-w-[98%]'); }
        
        document.getElementById('gagaball-section').classList.remove('hidden');
        document.getElementById('tab-gagaball').className = "flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 rounded-xl font-bold text-[10px] sm:text-sm transition text-white bg-slate-800 shadow-md border border-slate-800 transform scale-[1.02] sm:scale-105 z-10 whitespace-nowrap";
        window.switchGagaTab('score'); 
    } else {
        mainContainer.classList.add('max-w-4xl'); mainContainer.classList.remove('max-w-[98%]');
        if(headerContainer) { headerContainer.classList.add('max-w-4xl'); headerContainer.classList.remove('max-w-[98%]'); }
        if(tabContainer) { tabContainer.classList.add('max-w-4xl'); tabContainer.classList.remove('max-w-[98%]'); }

        if (tabName === 'student') {
            document.getElementById('student-management').classList.remove('hidden');
            document.getElementById('tab-student').className = "flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 rounded-xl font-bold text-[10px] sm:text-sm transition text-white bg-blue-600 shadow-md border border-blue-600 transform scale-[1.02] sm:scale-105 z-10 whitespace-nowrap";
            renderStudentList();
        } else if (tabName === 'group') {
            document.getElementById('group-section').classList.remove('hidden');
            document.getElementById('tab-group').className = "flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 rounded-xl font-bold text-[10px] sm:text-sm transition text-white bg-indigo-600 shadow-md border border-indigo-600 transform scale-[1.02] sm:scale-105 z-10 whitespace-nowrap";
            renderGroups(); 
        } else if (tabName === 'draw') {
            document.getElementById('draw-section').classList.remove('hidden');
            document.getElementById('tab-draw').className = "flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 rounded-xl font-bold text-[10px] sm:text-sm transition text-white bg-purple-600 shadow-md border border-purple-600 transform scale-[1.02] sm:scale-105 z-10 whitespace-nowrap";
            renderDrawSection();
        } else if (tabName === 'stamp') {
            document.getElementById('stamp-section').classList.remove('hidden');
            document.getElementById('tab-stamp').className = "flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 rounded-xl font-bold text-[10px] sm:text-sm transition text-white bg-green-600 shadow-md border border-green-600 transform scale-[1.02] sm:scale-105 z-10 whitespace-nowrap";
            renderStampBoard();
        }
    }
}

window.importFromExcel = async function() {
    if (!currentClass) { window.showModal("알림", "먼저 학급을 선택해주세요."); return; }
    const input = document.getElementById('excel-input').value.trim();
    if (!input) { window.showModal("입력 오류", "내용을 입력해주세요."); return; }

    const lines = input.split('\n');
    if (!classData[currentClass]) classData[currentClass] = [];
    let addedCount = 0;
    lines.forEach(line => {
        const parts = line.split(/\t|\s+/).filter(p => p.trim() !== "");
        if (parts.length >= 2) {
            const no = parts[0]; const name = parts[1];
            const gender = (parts[2] && parts[2].includes('여')) ? '여' : '남';
            const bs = (parts[3] && ['1', '2', '3'].includes(parts[3])) ? parts[3] : '-'; // 볼센스
            const ag = (parts[4] && ['1', '2', '3'].includes(parts[4])) ? parts[4] : '-';
            let group = null; if (parts[5]) { const g = parseInt(parts[5]); if (!isNaN(g) && g >= 1) group = g; }
            
            const existingStudent = classData[currentClass].find(s => s.no == no);
            if(existingStudent) return; // 이미 있는 번호는 건너뛰기

            const newStudent = { no: parseInt(no) || (classData[currentClass].length + 1), name: name, gender: gender, ballSense: bs, agility: ag, attendance: true, score: 0, recordMs: 0, drawn: false, isCaptain: false, group_mixed2: null, group_mixed3: null, group_mixed4: null, group_gender: null };
            newStudent[`group_${currentGroupMode}`] = group;
            classData[currentClass].push(newStudent); addedCount++;
        }
    });

    if(addedCount > 0) {
        document.getElementById('excel-input').value = ""; 
        saveData();
        renderStudentList(); renderDrawSection(); window.renderGagaball();
        window.showModal("등록 완료", `<b class="text-blue-600">${addedCount}명</b>의 학생이 성공적으로 등록되었습니다.`);
    } else { window.showModal("형식 오류 또는 중복", "형식이 올바르지 않거나 이미 등록된 번호일 수 있습니다.<br>[번호 이름 성별 볼센스 순발력 모둠] 순으로 띄어쓰기하여 입력해주세요."); }
}

window.cycleInputAbility = function(type) {
    const hiddenInput = document.getElementById(`add-${type}`); 
    const btn = document.getElementById(`btn-add-${type}`);
    let currentIdx = abilitiesCycle.indexOf(hiddenInput.value); if(currentIdx === -1) currentIdx = 0;
    const nextIdx = (currentIdx + 1) % abilitiesCycle.length; 
    const nextVal = abilitiesCycle[nextIdx];
    hiddenInput.value = nextVal;
    
    let emoji = type === 'ballSense' ? '⚽' : '⚡';
    
    if (nextVal === '-') {
        btn.innerHTML = `<span class="text-slate-400 text-xs">${emoji}(-)</span>`;
    } else {
        btn.innerHTML = window.getAbilityHTML(type, nextVal);
    }
    
    btn.className = "w-[42px] sm:w-[60px] h-[36px] border rounded-lg shadow-sm transition flex items-center justify-center focus:outline-blue-500 ";
    if(nextVal === '3') btn.className += "bg-orange-50 border-orange-200 hover:bg-orange-100";
    else if(nextVal === '2') btn.className += "bg-emerald-50 border-emerald-200 hover:bg-emerald-100";
    else if(nextVal === '1') btn.className += "bg-stone-50 border-stone-200 hover:bg-stone-100";
    else btn.className += "bg-white border-slate-200 hover:bg-slate-50";
}

window.addSingleStudent = function() {
    if (!currentClass) { window.showModal("알림", "먼저 학급을 선택해주세요."); return; }
    const noInput = document.getElementById('add-no'); const nameInput = document.getElementById('add-name');
    const genderInput = document.getElementById('add-gender'); 
    const bsInput = document.getElementById('add-ballSense');
    const agInput = document.getElementById('add-agility'); 
    const groupInput = document.getElementById('add-group');

    if(!noInput.value || !nameInput.value) { window.showModal("입력 오류", "번호와 이름을 모두 입력해주세요."); return; }
    if(classData[currentClass].find(s => s.no == noInput.value)) { window.showModal("입력 오류", "이미 존재하는 학생 번호입니다."); return; }

    let groupVal = null;
    if (groupInput.value) { const g = parseInt(groupInput.value); if (g >= 1) groupVal = g; }
    if (!classData[currentClass]) classData[currentClass] = [];
    
    const newStudent = { no: parseInt(noInput.value), name: nameInput.value, gender: genderInput.value, ballSense: bsInput.value, agility: agInput.value, attendance: true, score: 0, recordMs: 0, drawn: false, isCaptain: false, group_mixed2: null, group_mixed3: null, group_mixed4: null, group_gender: null };
    newStudent[`group_${currentGroupMode}`] = groupVal;
    classData[currentClass].push(newStudent);
    
    noInput.value = ""; nameInput.value = ""; groupInput.value = "";
    ['ballSense', 'agility'].forEach(type => {
        document.getElementById(`add-${type}`).value = "-";
        const btn = document.getElementById(`btn-add-${type}`);
        let emoji = type === 'ballSense' ? '⚽' : '⚡';
        btn.innerHTML = `<span class="text-slate-400 text-xs">${emoji}(-)</span>`;
        btn.className = "w-[42px] sm:w-[60px] h-[36px] border rounded-lg bg-white shadow-sm transition flex items-center justify-center focus:outline-blue-500";
    });
    saveData(); renderStudentList(); renderDrawSection(); window.renderGagaball();
}

window.deleteStudent = function(studentNo) {
    const student = classData[currentClass].find(s => s.no == studentNo);
    if (!student) return;
    window.showModal("학생 정보 삭제", `<span class="font-bold text-red-500">${student.no}번 ${student.name}</span> 학생의 정보를 정말로 삭제하시겠습니까?`, true, () => {
        const idx = classData[currentClass].findIndex(s => s.no == studentNo);
        if (idx > -1) { 
            classData[currentClass].splice(idx, 1); 
            saveData(); renderStudentList(); renderDrawSection(); window.renderGagaball(); window.renderGagaTeamView(); renderGroups();
        }
    }, "삭제");
}

window.handleNameClick = function(studentNo) {
    const student = classData[currentClass].find(s => s.no == studentNo);
    if (!student) return;

    if (currentTab === 'group') { // 모둠 탭에서는 체육부장 토글
        if (student.attendance) {
            student.isCaptain = !student.isCaptain;
            saveData();
            renderStudentList();
            renderGroups();
        }
    } else { // 다른 탭에서는 출석 토글
        student.attendance = !student.attendance;
        saveData();
        renderStudentList();
        renderGroups();
        renderDrawSection();
        window.renderGagaball();
    }
}

window.toggleAttendance = function(studentNo) {
    const student = classData[currentClass].find(s => s.no == studentNo);
    if (student) { 
        student.attendance = !student.attendance; 
        saveData(); renderStudentList(); renderGroups(); renderDrawSection(); window.renderGagaball();
    }
}

window.cycleStudentAbility = function(studentNo, type) {
    const student = classData[currentClass].find(s => s.no == studentNo);
    if (student && student.attendance) {
        let currentIdx = abilitiesCycle.indexOf(student[type] || '-'); if (currentIdx === -1) currentIdx = 0;
        const nextIdx = (currentIdx + 1) % abilitiesCycle.length; student[type] = abilitiesCycle[nextIdx];
        saveData(); renderStudentList(); renderGroups();
    }
}

window.cycleStudentGroup = function(studentNo) {
    const student = classData[currentClass].find(s => s.no == studentNo);
    if (student && student.attendance) {
        const cycle = getGroupsCycle();
        let currentVal = student[`group_${currentGroupMode}`];
        let currentIdx = cycle.indexOf(currentVal); if (currentIdx === -1) currentIdx = 0;
        const nextIdx = (currentIdx + 1) % cycle.length; student[`group_${currentGroupMode}`] = cycle[nextIdx];
        saveData(); renderStudentList(); renderGroups();
    }
}

window.toggleSort = function(field) {
    if (sortState.field === field) sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    else { sortState.field = field; sortState.direction = 'asc'; }
    renderStudentList();
}

function updateSortIcons() {
    ['no', 'name', 'recordMs', 'gender', 'ballSense', 'agility', 'group'].forEach(f => {
        const icon = document.getElementById(`sort-${f}-icon`);
        if (icon) {
            if (sortState.field === f) { icon.innerText = sortState.direction === 'asc' ? '▲' : '▼'; icon.classList.add('text-blue-500'); } 
            else { icon.innerText = '↕'; icon.classList.remove('text-blue-500'); }
        }
    });
}

window.renderStudentList = function() {
    const tbody = document.getElementById('student-list-body'); 
    if (!tbody || !currentClass) return;
    tbody.innerHTML = "";
    const allStudents = [...(classData[currentClass] || [])];
    
    const excelSection = document.getElementById('excel-import-section');
    if (excelSection) { if (allStudents.length > 0) excelSection.classList.add('hidden'); else excelSection.classList.remove('hidden'); }
    
    const presentStudents = allStudents.filter(s => s.attendance);
    const presentCount = presentStudents.length;
    const maleCount = presentStudents.filter(s => s.gender === '남').length;
    const femaleCount = presentStudents.filter(s => s.gender === '여').length;

    let groupCounts = "";
    const g1 = presentStudents.filter(s => s[`group_${currentGroupMode}`] === 1).length;
    const g2 = presentStudents.filter(s => s[`group_${currentGroupMode}`] === 2).length;
    const g3 = presentStudents.filter(s => s[`group_${currentGroupMode}`] === 3).length;
    const g4 = presentStudents.filter(s => s[`group_${currentGroupMode}`] === 4).length;
    if(currentGroupMode === 'mixed2') groupCounts = `1조 ${g1} · 2조 ${g2}`;
    else if(currentGroupMode === 'mixed3') groupCounts = `1조 ${g1} · 2조 ${g2} · 3조 ${g3}`;
    else groupCounts = `1조 ${g1} · 2조 ${g2} · 3조 ${g3} · 4조 ${g4}`;
    
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
            if (sortState.direction === 'asc') {
                if (valA === 0) valA = Infinity;
                if (valB === 0) valB = Infinity;
            }
        }
        if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
        return a.no - b.no;
    });

    if (typeof updateSortIcons === 'function') updateSortIcons();

    allStudents.forEach((s) => {
        let rowBgClass = "hover:bg-slate-50"; 
        if (!s.attendance) { rowBgClass = "bg-red-50/40 text-slate-400 italic"; }

        const tr = document.createElement('tr'); tr.className = "border-b border-slate-100 student-row transition " + rowBgClass;
        
        const getAbilityColorClass = (val) => {
            if (!s.attendance) return 'bg-slate-100 opacity-50 cursor-not-allowed border-transparent';
            if (val === '3') return 'bg-orange-50 border-orange-200 hover:bg-orange-100 shadow-sm';
            if (val === '2') return 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 shadow-sm';
            if (val === '1') return 'bg-stone-50 border-stone-200 hover:bg-stone-100 shadow-sm';
            return 'bg-white hover:bg-slate-100 border border-slate-200 shadow-sm';
        };

        const bsColor = getAbilityColorClass(s.ballSense);
        const agColor = getAbilityColorClass(s.agility);

        let groupColorClass = 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200';
        if (!s.attendance) groupColorClass = 'bg-slate-200 text-slate-400 cursor-not-allowed';
        else if (s[`group_${currentGroupMode}`]) {
            const sGroup = s[`group_${currentGroupMode}`];
            if (sGroup % 4 === 1) groupColorClass = 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm';
            else if (sGroup % 4 === 2) groupColorClass = 'bg-fuchsia-500 text-white hover:bg-fuchsia-600 shadow-sm';
            else if (sGroup % 4 === 3) groupColorClass = 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-sm';
            else if (sGroup % 4 === 0) groupColorClass = 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm';
        }
        
        const captainBadge = s.isCaptain ? '<span class="text-[10px] bg-yellow-400 text-white rounded w-[14px] h-[14px] inline-flex items-center justify-center font-black ml-1 align-text-bottom shadow-sm leading-none pt-0.5">C</span>' : '';

        if (!activeStudentTimers[s.no]) {
            activeStudentTimers[s.no] = { isRunning: false, elapsed: s.recordMs || 0, startTime: 0 };
        }
        let st = activeStudentTimers[s.no];
        let stPlayIcon = st.isRunning ? '⏸' : '▶';
        let stPlayColor = st.isRunning ? 'text-amber-500' : 'text-slate-400';

        tr.innerHTML = `
            <td class="px-0 py-1 sm:p-2 text-center font-mono font-bold text-[10px] sm:text-[13px] text-slate-500 w-4 sm:w-8">${s.no}</td>
            <td class="px-0.5 py-1 sm:p-2 font-black text-center whitespace-normal break-words leading-tight min-w-[36px]">
                <button onclick="window.handleNameClick(${s.no})" class="w-full h-full text-[11px] sm:text-[14px] ${s.attendance ? 'text-slate-800' : 'text-slate-400'} px-1 py-0.5 rounded hover:bg-slate-200 transition" title="출석부/모둠: 출석/체육부장 토글">
                    ${s.name}${captainBadge}
                </button>
            </td>
            <td class="px-0 py-1 sm:p-2 text-center w-[54px] sm:w-auto">
                <div class="flex items-center justify-center bg-white rounded border border-slate-200 px-0.5 py-0.5 gap-0.5 w-fit mx-auto shadow-sm ${s.attendance ? '' : 'opacity-50 pointer-events-none'}">
                    <div id="st-time-display-${s.no}" onclick="window.manualStudentTimeEdit(${s.no})" class="w-8 sm:w-12 text-center text-[8px] sm:text-[11px] font-bold tracking-tighter cursor-pointer hover:text-blue-500 transition-colors font-mono">
                        ${window.formatTime(st.elapsed)}
                    </div>
                    <button onclick="window.toggleStudentTimerPlay(${s.no})" id="btn-st-play-${s.no}" class="w-3.5 h-3.5 sm:w-5 sm:h-5 flex items-center justify-center rounded hover:bg-slate-100 transition text-[7px] sm:text-[10px] ${stPlayColor}">
                        ${stPlayIcon}
                    </button>
                    <button onclick="window.resetStudentTimer(${s.no})" class="w-3.5 h-3.5 sm:w-5 sm:h-5 flex items-center justify-center rounded hover:bg-slate-100 transition text-[7px] sm:text-[10px] text-red-400 font-bold">↻</button>
                </div>
            </td>
            <td class="px-0 py-1 sm:p-2 text-center w-5 sm:w-8"><span class="text-[9px] sm:text-[11px] font-bold px-1 py-0.5 rounded ${s.gender === '남' ? (s.attendance ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400') : (s.attendance ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-400')}">${s.gender}</span></td>
            <td class="px-0 py-1 sm:p-2 text-center w-5 sm:w-8"><button onclick="window.cycleStudentGroup(${s.no})" class="w-5 h-5 sm:w-8 sm:h-8 text-[10px] sm:text-[13px] font-black rounded sm:rounded-lg transition outline-none ${groupColorClass}" ${!s.attendance ? 'disabled' : ''}>${s[`group_${currentGroupMode}`] ? s[`group_${currentGroupMode}`] : '-'}</button></td>
            <td class="px-0 py-1 sm:p-2 text-center w-[26px] sm:w-10">
                <button onclick="window.cycleStudentAbility(${s.no}, 'ballSense')" class="w-[24px] h-[22px] sm:w-9 sm:h-9 mx-auto rounded transition outline-none ${bsColor} flex items-center justify-center" ${!s.attendance ? 'disabled' : ''}>
                    ${window.getAbilityHTML('ballSense', s.ballSense)}
                </button>
            </td>
            <td class="px-0 py-1 sm:p-2 text-center w-[26px] sm:w-10">
                <button onclick="window.cycleStudentAbility(${s.no}, 'agility')" class="w-[24px] h-[22px] sm:w-9 sm:h-9 mx-auto rounded transition outline-none ${agColor} flex items-center justify-center" ${!s.attendance ? 'disabled' : ''}>
                    ${window.getAbilityHTML('agility', s.agility)}
                </button>
            </td>
            <td class="px-0 py-1 sm:p-2 text-center w-4 sm:w-8"><button onclick="window.deleteStudent(${s.no})" class="delete-btn text-slate-300 hover:text-red-500 transition p-0.5 sm:p-1"><svg class="h-3.5 w-3.5 sm:h-5 sm:w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.setGroupMode = function(mode) {
    currentGroupMode = mode; activeTimers = {}; 
    ['mixed2', 'mixed3', 'mixed4', 'gender'].forEach(m => {
        const btn = document.getElementById(`btn-mode-${m}`);
        if (btn) btn.className = (m === mode) ? "flex-1 sm:flex-none px-3 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition bg-white text-indigo-600 shadow-sm whitespace-nowrap" : "flex-1 sm:flex-none px-3 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition text-slate-500 hover:text-slate-700 whitespace-nowrap";
    });

    const descEl = document.getElementById('group-mode-desc');
    const btnText = document.getElementById('generate-btn-text');

    if (mode === 'mixed2') { descEl.innerHTML = "<b>혼성 2팀</b> 편성 결과입니다."; btnText.innerText = "혼성 2팀 편성하기"; } 
    else if (mode === 'mixed3') { descEl.innerHTML = "<b>혼성 3팀</b> 편성 결과입니다."; btnText.innerText = "혼성 3팀 편성하기"; } 
    else if (mode === 'mixed4') { descEl.innerHTML = "<b>혼성 4팀</b> 편성 결과입니다."; btnText.innerText = "혼성 4팀 편성하기"; } 
    else if (mode === 'gender') { descEl.innerHTML = "<b>동성 4팀 (남2/여2)</b> 편성 결과입니다."; btnText.innerText = "동성 4팀 편성하기"; }
    
    renderStudentList(); renderGroups();
}

window.resetCurrentGroup = function() {
    if (!currentClass || !classData[currentClass]) { window.showModal("알림", "학급을 먼저 선택해주세요."); return; }
    let modeName = currentGroupMode === 'mixed2' ? '혼성 2팀' : (currentGroupMode === 'mixed3' ? '혼성 3팀' : (currentGroupMode === 'mixed4' ? '혼성 4팀' : '동성 4팀'));
    
    window.showModal("모둠 초기화", `정말 현재 학급의 <b>${modeName}</b> 편성을 모두 초기화하시겠습니까?<br><span class="text-red-500 text-xs">※ 부여된 모둠 점수와 기록도 함께 지워집니다.</span>`, true, () => {
        classData[currentClass].forEach(student => { student[`group_${currentGroupMode}`] = null; student.isCaptain = false; });
        if (groupScores[currentClass] && groupScores[currentClass][currentGroupMode]) groupScores[currentClass][currentGroupMode] = {};
        if (groupRecords[currentClass] && groupRecords[currentClass][currentGroupMode]) groupRecords[currentClass][currentGroupMode] = {};
        activeTimers = {}; saveData(); renderStudentList(); renderGroups();
        window.showModal("완료", `${modeName} 편성이 초기화되었습니다.`);
    });
}

window.generateCurrentGroup = function() {
    let title = "", callback = null;
    if (currentGroupMode === 'mixed2') { title = "혼성 2팀 편성"; callback = () => window.generateMixedGroups(2); }
    else if (currentGroupMode === 'mixed3') { title = "혼성 3팀 편성"; callback = () => window.generateMixedGroups(3); }
    else if (currentGroupMode === 'mixed4') { title = "혼성 4팀 편성"; callback = () => window.generateMixedGroups(4); }
    else if (currentGroupMode === 'gender') { title = "동성 4팀 편성"; callback = () => window.generateGenderGroups(); }

    window.showModal(title, `새롭게 ${title}을(를) 진행하시겠습니까?<br><br><span class='text-red-500 font-bold'>현재 모드의 기존 편성 결과와 점수가 초기화됩니다.</span><br><span class='text-slate-500 text-xs'>(다른 모드의 결과는 그대로 유지됩니다.)</span>`, true, callback, "새로 편성하기");
}

window.updateGroupScore = function(groupId, change) {
    if (!groupScores[currentClass]) groupScores[currentClass] = {};
    if (!groupScores[currentClass][currentGroupMode]) groupScores[currentClass][currentGroupMode] = {};
    groupScores[currentClass][currentGroupMode][groupId] = (groupScores[currentClass][currentGroupMode][groupId] || 0) + change;
    saveData(); renderGroups();
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
    students.forEach(s => {
        s[`group_${currentGroupMode}`] = null;
        s.isCaptain = false;
    });

    const groups = Array.from({ length: numGroups }, (_, i) => ({ id: i + 1, total: 0, male: 0, female: 0, totalScore: 0 }));

    const assignToOptimalGroup = (student) => {
        let stScore = (parseInt(student.ballSense)||0) + (parseInt(student.agility)||0);
        const isMale = student.gender === '남';

        let minTotalScore = Math.min(...groups.map(g => g.totalScore));
        let candidates = groups.filter(g => g.totalScore === minTotalScore);

        let minTotal = Math.min(...candidates.map(g => g.total));
        candidates = candidates.filter(g => g.total === minTotal);

        let minGender = Math.min(...candidates.map(g => isMale ? g.male : g.female));
        let genderCandidates = candidates.filter(g => (isMale ? g.male : g.female) === minGender);
        if (genderCandidates.length > 0) candidates = genderCandidates;

        const targetGroup = candidates[Math.floor(Math.random() * candidates.length)];
        student[`group_${currentGroupMode}`] = targetGroup.id;
        
        targetGroup.totalScore += stScore; targetGroup.total++;
        if (isMale) targetGroup.male++; else targetGroup.female++;
    };

    presentStudents.sort((a, b) => {
        let scoreA = (parseInt(a.ballSense)||0) + (parseInt(a.agility)||0);
        let scoreB = (parseInt(b.ballSense)||0) + (parseInt(b.agility)||0);
        return scoreB - scoreA;
    });
    presentStudents.forEach(s => assignToOptimalGroup(s));

    if (!groupScores[currentClass]) groupScores[currentClass] = {}; groupScores[currentClass][currentGroupMode] = {};
    for(let i=1; i<=numGroups; i++) groupScores[currentClass][currentGroupMode][i] = 0;
    if (!groupRecords[currentClass]) groupRecords[currentClass] = {}; groupRecords[currentClass][currentGroupMode] = {};
    activeTimers = {};

    saveData(); renderStudentList(); renderGroups();
}

window.generateGenderGroups = function() {
    const students = classData[currentClass];
    if (!students || students.length < 4) { window.showModal("인원 부족", "학생 정보가 부족합니다. 최소 4명 이상 등록되어야 합니다."); return; }

    const shuffle = (array) => { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; };
    students.forEach(s => {
        s[`group_${currentGroupMode}`] = null;
        s.isCaptain = false;
    });

    const distribute = (targetStudents, groupIds) => {
        shuffle(targetStudents);
        targetStudents.sort((a, b) => {
            let scoreA = (parseInt(a.ballSense)||0) + (parseInt(a.agility)||0);
            let scoreB = (parseInt(b.ballSense)||0) + (parseInt(b.agility)||0);
            return scoreB - scoreA;
        });

        const groups = groupIds.map(id => ({ id: id, total: 0, totalScore: 0 }));
        
        const assignToOptimalGroup = (student) => {
            let stScore = (parseInt(student.ballSense)||0) + (parseInt(student.agility)||0);
            let minTotalScore = Math.min(...groups.map(g => g.totalScore));
            let candidates = groups.filter(g => g.totalScore === minTotalScore);
            let minTotal = Math.min(...candidates.map(g => g.total));
            candidates = candidates.filter(g => g.total === minTotal);

            const targetGroup = candidates[Math.floor(Math.random() * candidates.length)];
            student[`group_${currentGroupMode}`] = targetGroup.id;
            targetGroup.totalScore += stScore; targetGroup.total++;
        };
        
        targetStudents.forEach(s => assignToOptimalGroup(s));
    };

    const boys = students.filter(s => s.gender === '남' && s.attendance);
    const girls = students.filter(s => s.gender === '여' && s.attendance);

    if(boys.length > 0) distribute(boys, [1, 2]); 
    if(girls.length > 0) distribute(girls, [3, 4]);

    if (!groupScores[currentClass]) groupScores[currentClass] = {}; groupScores[currentClass][currentGroupMode] = {1:0, 2:0, 3:0, 4:0};
    if (!groupRecords[currentClass]) groupRecords[currentClass] = {}; groupRecords[currentClass][currentGroupMode] = {};
    activeTimers = {};

    saveData(); renderStudentList(); renderGroups();
}

function renderGroups() {
    const container = document.getElementById('group-result'); if (!container) return; container.innerHTML = "";
    const students = classData[currentClass] || [];
    
    let maxGroup = currentGroupMode === 'mixed2' ? 2 : (currentGroupMode === 'mixed3' ? 3 : 4);
    container.className = 'grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 p-1';

    let hasAnyGroup = false;

    for (let i = 1; i <= maxGroup; i++) {
        const members = students.filter(s => s[`group_${currentGroupMode}`] === i);
        if (members.length === 0) continue;
        
        hasAnyGroup = true;
        let themeIndex = (i - 1) % 4;
        let theme = { border: 'border-slate-200', hover: 'hover:border-slate-400', text: 'text-slate-700', btn: 'text-slate-500 hover:bg-slate-100', bg: 'bg-slate-50' };
        if (themeIndex === 0) theme = { border: 'border-blue-200', hover: 'hover:border-blue-400', text: 'text-blue-700', btn: 'text-blue-600 hover:bg-blue-50', bg: 'bg-blue-50/50' };
        else if (themeIndex === 1) theme = { border: 'border-pink-200', hover: 'hover:border-pink-400', text: 'text-pink-700', btn: 'text-pink-600 hover:bg-pink-50', bg: 'bg-pink-50/50' };
        else if (themeIndex === 2) theme = { border: 'border-emerald-200', hover: 'hover:border-emerald-400', text: 'text-emerald-700', btn: 'text-emerald-600 hover:bg-emerald-50', bg: 'bg-emerald-50/50' };
        else if (themeIndex === 3) theme = { border: 'border-amber-200', hover: 'hover:border-amber-400', text: 'text-amber-700', btn: 'text-amber-600 hover:bg-amber-50', bg: 'bg-amber-50/50' };

        const card = document.createElement('div');
        card.className = `bg-white border-2 ${theme.border} ${theme.hover} p-3 sm:p-5 rounded-2xl shadow-sm transition min-h-[150px]`;
        card.setAttribute('ondragover', 'window.handleDragOver(event)');
        card.setAttribute('ondrop', `window.handleDropOnGroup(event, ${i})`);

        const presentMembers = members.filter(m => m.attendance);
        const maleCount = presentMembers.filter(m => m.gender === '남').length; 
        const femaleCount = presentMembers.filter(m => m.gender === '여').length;
        
        let score = 0; if (groupScores[currentClass] && groupScores[currentClass][currentGroupMode]) score = groupScores[currentClass][currentGroupMode][i] || 0;

        let groupTotalAbility = 0;
        presentMembers.forEach(m => { groupTotalAbility += (parseInt(m.ballSense)||0) + (parseInt(m.agility)||0); });

        const headerExtra = `
            <div class="flex flex-wrap justify-start xl:justify-end gap-1 mt-1 xl:mt-0 w-full items-center">
                <span class="text-[9px] sm:text-[10px] font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded-md whitespace-nowrap shadow-sm text-slate-500">종합 전력: ${groupTotalAbility}점</span>
            </div>
        `;

        if (!activeTimers[i]) {
            let savedVal = '';
            if (groupRecords[currentClass] && groupRecords[currentClass][currentGroupMode]) savedVal = groupRecords[currentClass][currentGroupMode][i];
            let savedMs = 0; if (savedVal !== undefined && savedVal !== null && savedVal !== '') savedMs = window.parseTime(savedVal);
            activeTimers[i] = { mode: 'stopwatch', isRunning: false, elapsed: savedMs, target: 60000, startTime: 0 };
        }
        let t = activeTimers[i];
        let playIcon = t.isRunning ? '⏸' : '▶'; let playColor = t.isRunning ? 'text-amber-400' : 'text-slate-300';
        let modeIcon = t.mode === 'stopwatch' ? '⏱️' : '⏳';
        let timeColorClass = 'text-white';
