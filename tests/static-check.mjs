import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const utils = await readFile(new URL('../class-utils.mjs', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const firebaseConfig = await readFile(new URL('../firebase-config.js', import.meta.url), 'utf8');

const appVersion = html.match(/app\.js\?v=([\w.-]+)/)?.[1];
const utilsVersion = app.match(/class-utils\.mjs\?v=([\w.-]+)/)?.[1];
assert.ok(appVersion && utilsVersion && appVersion === utilsVersion, 'app.js와 class-utils.mjs의 캐시 갱신 버전이 일치하지 않습니다.');

const allowedEmail = 'lws5737@seoul-dongsan.es.kr';
assert.ok(app.includes(`const ALLOWED_EMAIL = '${allowedEmail}'`), '클라이언트 허용 계정 검사가 없습니다.');
assert.ok(rules.includes(`request.auth.token.email == '${allowedEmail}'`), 'Firestore 허용 계정 검사가 없습니다.');
assert.ok(rules.includes('request.auth.token.email_verified == true'), '이메일 인증 검사가 없습니다.');
assert.ok(html.includes('id="class-selection-screen"'), '학급 선택 첫 화면이 없습니다.');
assert.ok(html.includes('id="class-selection-list"'), '학급 선택 목록이 없습니다.');
assert.ok(!html.includes('user-scalable=no'), '화면 확대가 차단되어 있습니다.');
assert.ok(!app.includes("text.includes('')"), 'CSV 인코딩 검사가 항상 참인 오류가 남아 있습니다.');
assert.ok(!app.includes('${s.name}'), '학생 이름이 HTML에 직접 삽입되는 코드가 남아 있습니다.');
assert.ok(!app.includes('{ merge: true }'), '삭제된 Firestore 중첩 필드를 되살릴 수 있는 merge 저장이 남아 있습니다.');
assert.ok(app.includes('saveData({ immediate: true })'), '학급 삭제 직후 즉시 저장하는 처리가 없습니다.');
assert.ok(app.includes('await updateDoc(docRef, payload)'), '앱 필드만 안전하게 교체하는 Firestore 저장이 없습니다.');
assert.ok(html.includes('id="delete-all-classes-btn"'), '첫 화면에 모든 학급 삭제 기능이 없습니다.');
assert.ok(app.includes('deleteButton.innerHTML') && app.includes('aria-hidden="true"'), '학급 삭제 아이콘이 안정적인 SVG로 표시되지 않습니다.');
assert.ok(!html.includes('id="modal-class-list"'), '명단·백업 화면에 학급 선택 UI가 남아 있습니다.');
assert.ok(!html.includes('id="new-class-input"'), '명단·백업 화면에 새 학급 추가 UI가 남아 있습니다.');
assert.ok(html.includes('학생 명단 및 백업') && html.includes('명단·백업'), '자료 관리 명칭이 이해하기 쉽게 바뀌지 않았습니다.');
assert.ok(html.includes('cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js') && html.includes('accept=".xlsx,.xls,.csv"'), 'XLS/XLSX 저장·불러오기 모듈이 연결되지 않았습니다.');
assert.ok(html.includes('exportAllToExcel()') && html.includes('exportCurrentClassToExcel()'), '전체/현재 학급 엑셀 저장 기능이 분리되지 않았습니다.');
assert.ok(html.includes('handleAllCSVUpload(event)') && html.includes('handleClassExcelUpload(event)'), '전체/현재 학급 엑셀 불러오기 기능이 분리되지 않았습니다.');
assert.ok(app.includes("['백업범위', scope]") && app.includes("scopeIsClass"), '학급/전체 백업 간 호환 범위 정보가 없습니다.');
assert.ok(app.includes("book_append_sheet(workbook, displaySheet, '학생명단')"), '보기 좋은 학생명단 시트가 없습니다.');
assert.ok(app.includes("book_append_sheet(workbook, backupSheet, '백업데이터')"), '복구용 백업 시트가 없습니다.');
assert.ok(app.includes('const hasSchoolRosterColumns = columns.length >= 5'), '학년·반·번호·이름·성별 붙여넣기 형식을 처리하지 않습니다.');
assert.ok(app.includes("workbook.Sheets['학생명단']") && app.includes('parseRosterTable(rows'), '일반 엑셀 학생명단 시트를 불러오는 처리가 없습니다.');
assert.ok(app.includes('buildBalancedTeamPlan(presentStudents, numGroups') && app.includes('buildBalancedTeamPlan(boys, 2') && app.includes('buildBalancedTeamPlan(girls, 2'), '인원·성별·능력치를 함께 고려하는 팀 편성기가 연결되지 않았습니다.');
assert.ok(app.includes('학생명단 편집값 ${rosterOverrideCount}/${rosterRecordCount}명 반영'), '엑셀 편집값 반영 결과가 사용자에게 표시되지 않습니다.');
assert.ok(app.includes('createMissingStudent: record => createStudentRecord'), '보이는 학생명단에만 있는 학생을 백업 복구 시 추가하지 않습니다.');
assert.ok(app.includes("parseStructuredJson(value, fallback, 'object')") && app.includes("parseStructuredJson(value, fallback, 'array')"), '손상된 백업 JSON 값을 방어하지 않습니다.');
assert.ok(app.includes('const cloudSaved = await saveData({ immediate: true })'), '엑셀 복구 후 Firebase 저장 완료를 기다리지 않습니다.');
assert.ok(app.includes("importTarget === 'class' ? '현재 학급 복구하기'"), '현재 학급 복구 버튼 문구가 명확하지 않습니다.');
assert.ok(app.includes('recordMs: recMs') && !app.includes('attendance, score, recordMs, memo'), '엑셀 복구의 순발력 변수명이 일치하지 않습니다.');
assert.ok(!html.includes('하교지도') && !app.includes('window.updateDismissal'), '하교 입력 기능이 남아 있습니다.');
assert.ok(!app.includes('Math.random() - 0.5'), '편향된 랜덤 정렬 방식이 남아 있습니다.');
assert.ok(app.includes("if (!['mixed2', 'mixed3', 'mixed4', 'gender'].includes(mode))"), '잘못된 모둠 모드를 방어하지 않습니다.');
assert.ok(html.includes('<span class="block">번호</span>') && html.includes('(출석)'), '출석부 번호 제목이 번호(출석)으로 표시되지 않습니다.');
assert.ok(html.includes('oninput="window.saveMemoImmediately()"') && !html.includes('onclick="window.saveMemo()"'), '메모 자동 저장 UI가 적용되지 않았습니다.');
assert.ok(app.includes('window.dragOverUnassigned') && app.includes("closest?.('#unassigned-area')"), '미편성 드롭 중 자동 스크롤 방지 처리가 없습니다.');
assert.ok(html.includes('href="./style.css"'), '모둠 드롭 영역 보완 스타일이 연결되지 않았습니다.');
assert.ok(firebaseConfig.includes('enableMultiTabIndexedDbPersistence') && firebaseConfig.includes('firestorePersistenceReady'), 'Firestore 오프라인 지속 저장 상태를 확인할 수 없습니다.');
assert.ok(app.includes("const RECOVERY_DB_NAME = 'smart-class-manager-recovery'") && app.includes('persistRecoveryRecord(record)'), '앱 전체 데이터의 IndexedDB 복구본이 없습니다.');
assert.ok(app.includes('persistEmergencyRecoveryBeforeExit') && app.includes("window.addEventListener('pagehide'"), '종료 직전 긴급 복구 저장이 없습니다.');
assert.ok(app.includes("window.addEventListener('online'") && app.includes("window.addEventListener('offline'"), '온라인 복귀 자동 동기화 처리가 없습니다.');
assert.ok(app.includes('includeMetadataChanges: true') && app.includes('docSnap.metadata.hasPendingWrites'), '로컬 대기/서버 완료 상태를 구분하지 않습니다.');
assert.ok(html.includes('id="sync-status-label"'), '사용자에게 저장 상태를 표시하지 않습니다.');
assert.ok(app.includes('mergeAppPayloads') && app.includes('archiveConflictRecord'), '여러 기기의 오프라인 변경 충돌을 보관·병합하지 않습니다.');
assert.ok(!html.includes('jumprope-mode-icon') && !app.includes('jumprope-mode-btn'), '8자 줄넘기 스톱워치/타이머 전환 버튼이 남아 있습니다.');
assert.ok(app.includes('let jumpRopeTimerMs = 60000') && app.includes('let jumpRopeTargetMs = 60000') && !app.includes('jumpRopeTimerMode'), '8자 줄넘기 기본 1분 타이머가 적용되지 않았습니다.');
assert.ok(app.includes('<path d="${makePath(maleData)}"') && app.includes('<path d="${makePath(femaleData)}"'), '줄넘기 기록 분석이 선 그래프로 표시되지 않습니다.');
assert.ok(['male-1', 'male-2', 'female-1', 'female-2'].every(name => html.includes(`id="jumprope-${name}-input"`)), '남녀 1차·2차 줄넘기 입력칸이 모두 없습니다.');
assert.ok(html.includes('id="jumprope-target-input"') && app.includes('targetRewarded') && app.includes('earnedStamps++'), '줄넘기 목표 달성 자동 도장 처리가 없습니다.');
assert.ok(html.includes('id="jumprope-results-btn"') && html.includes('id="jumprope-results-btn" onclick="window.reviewJumpRopeResults()" disabled'), '1·2차 기록 완료 전 결과 확인 버튼이 비활성화되지 않습니다.');
assert.ok(app.includes('sameGradeClasses') && app.includes('series.map(buildChart)'), '동학년 전체 학급 기록 분석 차트가 없습니다.');
assert.ok(app.includes("'combined-3-2-1'") && app.includes("'team-3-2-1'"), '4학년 합산 및 6학년 팀별 3·2·1 도장 규칙이 없습니다.');
assert.ok(html.includes('id="class-selection-list" class="grid grid-cols-2'), '스마트폰 학급 선택 목록이 2열로 구성되지 않았습니다.');
assert.ok(app.includes('handleDropOnStudent') && app.includes('handleDragOverStudent') && app.includes('handleStudentDropLogic'), '모바일/PC 학생 이동·교체용 드롭 처리가 없습니다.');
assert.ok(utils.includes('canDesignateCaptain') && utils.includes('enforceCaptainLimits') && utils.includes("mode === 'gender'"), '편성별 체육부장 인원 제한이 적용되지 않았습니다.');
assert.ok(app.includes('sortStudentsForGroupDisplay') && app.includes('{ captains }'), '체육부장 우선 정렬 또는 모둠별 자동 분산이 연결되지 않았습니다.');
assert.ok(html.includes("generateCurrentGroup('ball')") && html.includes("generateCurrentGroup('agility')"), '볼센스/순발력 우선 편성 버튼이 분리되지 않았습니다.');
assert.ok(html.includes('grid-cols-3') && html.includes('볼센스 편성') && html.includes('순발력 편성'), '모바일 편성 버튼 3개가 한 줄에 배치되지 않았습니다.');
assert.ok(html.includes('<details id="random-draw-details"') && !html.includes('<details id="random-draw-details" open'), '랜덤 뽑기가 기본 접힘 상태가 아닙니다.');
assert.ok(app.includes("'max-h-[180px]'"), '터치 이동 중 미편성 영역 내부 높이가 확장되지 않았습니다.');
assert.ok(html.includes('reviewJumpRopeResults()') && app.includes('jumpRopeAwards') && app.includes('addStampsToClass'), '줄넘기 순위 보상 및 중복 방지 처리가 없습니다.');
assert.ok(app.includes('mission-complete-v2.jpg') && !app.includes("bigImg.src = 'images/stamps/complete01.jpg'"), '새 미션 완료 이미지가 연결되지 않았습니다.');
assert.ok(app.includes("window.showPenaltyCard('verbal')") && app.includes('% 4'), '입경고를 포함한 3단계 경고 순환이 적용되지 않았습니다.');
assert.ok(app.includes('createPenaltyCardImage') && app.includes('playPenaltySound'), '입경고 이미지 또는 효과음 처리가 없습니다.');
assert.ok(app.includes("header.indexOf('경고단계')") && app.includes("header.indexOf('벌점카드')"), '새 경고 백업과 기존 벌점카드 백업의 호환 처리가 없습니다.');

function extractFunctionSource(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} 함수를 찾을 수 없습니다.`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}') depth--;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${functionName} 함수 범위를 찾을 수 없습니다.`);
}

const parseRosterLine = new Function(
  `${extractFunctionSource(app, 'normalizeClassName')}\n${extractFunctionSource(app, 'parseRosterLine')}\nreturn parseRosterLine;`
)();

const getJumpRopeWeekValue = new Function(
  `${extractFunctionSource(app, 'getJumpRopeWeekValue')}\nreturn getJumpRopeWeekValue;`
)();
assert.equal(getJumpRopeWeekValue(new Date(2026, 8, 1)), '9월 1주차', '월초의 줄넘기 주차 계산이 잘못되었습니다.');
assert.equal(getJumpRopeWeekValue(new Date(2026, 8, 15)), '9월 3주차', '월중의 줄넘기 주차 계산이 잘못되었습니다.');
assert.equal(getJumpRopeWeekValue(new Date(2026, 11, 31)), '12월 5주차', '월말의 줄넘기 주차 계산이 잘못되었습니다.');

const normalizeJumpRopeRecord = new Function(
  `${extractFunctionSource(app, 'normalizeJumpRopeRecord')}\nreturn normalizeJumpRopeRecord;`
)();
const isJumpRopeRecordComplete = new Function(
  `${extractFunctionSource(app, 'normalizeJumpRopeRecord')}\n${extractFunctionSource(app, 'isJumpRopeRecordComplete')}\nreturn isJumpRopeRecordComplete;`
)();
const migratedSingleAttempt = normalizeJumpRopeRecord({ male: 120, female: 110 });
assert.deepEqual(migratedSingleAttempt.maleAttempts, [120, null], '기존 남학생 최종 기록이 1차 기록으로 보존되지 않습니다.');
assert.equal(isJumpRopeRecordComplete(migratedSingleAttempt), false, '2차 기록이 없는데 결과 확인이 허용됩니다.');
const completedAttempts = normalizeJumpRopeRecord({ maleAttempts: [120, 135], femaleAttempts: [128, 121] });
assert.equal(completedAttempts.male, 135, '남학생 1·2차 중 높은 기록이 최종 기록이 아닙니다.');
assert.equal(completedAttempts.female, 128, '여학생 1·2차 중 높은 기록이 최종 기록이 아닙니다.');
assert.equal(isJumpRopeRecordComplete(completedAttempts), true, '남녀 1·2차 입력 완료 상태를 인식하지 못합니다.');

const normalizePenaltyCardState = new Function(
  `const PENALTY_CARD_SYSTEM_VERSION = 3;\n${extractFunctionSource(app, 'normalizePenaltyCardState')}\nreturn normalizePenaltyCardState;`
)();
const legacyYellow = { penaltyCard: 1 };
const legacyRed = { penaltyCard: 2 };
assert.equal(normalizePenaltyCardState(legacyYellow), 2, '기존 옐로카드가 새 체계의 옐로카드로 보존되지 않습니다.');
assert.equal(normalizePenaltyCardState(legacyRed), 3, '기존 레드카드가 새 체계의 레드카드로 보존되지 않습니다.');
assert.equal(normalizePenaltyCardState({ penaltyCard: 1, penaltyCardSystem: 3 }), 1, '새 입경고 단계가 유지되지 않습니다.');
assert.deepEqual(
  parseRosterLine('6\t2\t1\t강루미\t여'),
  { sourceClass: '6-2', no: 1, name: '강루미', gender: '여', ballSense: undefined, recordMs: undefined, group: undefined },
  '학교 출석부 5열 붙여넣기를 잘못 해석합니다.'
);

const getNextGroupActionState = new Function(
  `${extractFunctionSource(app, 'getNextGroupActionState')}\nreturn getNextGroupActionState;`
)();
assert.deepEqual(getNextGroupActionState([null, null], [null, null]), { type: 'start', index: 0 }, '다중 스톱워치 첫 출발 순서가 잘못되었습니다.');
assert.deepEqual(getNextGroupActionState([10, 20], [null, null]), { type: 'stop', index: 0 }, '다중 스톱워치 도착 순서가 잘못되었습니다.');
assert.deepEqual(getNextGroupActionState([10, 20], [30, 40]), { type: 'save', index: -1 }, '다중 스톱워치 저장 단계가 잘못되었습니다.');

const mergeAppPayloads = new Function(
  `const globalStampImage = 'default'; const getRecoveryDeviceId = () => 'test-device';\n${extractFunctionSource(app, 'cloneAppPayload')}\n${extractFunctionSource(app, 'mergeAppPayloads')}\nreturn mergeAppPayloads;`
)();
const mergedOfflinePayload = mergeAppPayloads(
  { data: { '6-1': [{ no: 1 }], '6-2': [{ no: 2, name: '서버' }] }, jumpRope: { '1월 1주차': { '6-1': { male: 10 } } } },
  { data: { '6-2': [{ no: 2, name: '기기' }], '6-3': [{ no: 3 }] }, jumpRope: { '1월 1주차': { '6-2': { female: 11 } } } },
  99
);
assert.deepEqual(Object.keys(mergedOfflinePayload.data).sort(), ['6-1', '6-2', '6-3'], '기기 간 병합 시 한쪽 학급이 사라집니다.');
assert.equal(mergedOfflinePayload.data['6-2'][0].name, '기기', '같은 학급 충돌에서 현재 기기 변경이 보존되지 않습니다.');
assert.ok(mergedOfflinePayload.jumpRope['1월 1주차']['6-1'] && mergedOfflinePayload.jumpRope['1월 1주차']['6-2'], '줄넘기 자료가 학급별로 병합되지 않습니다.');
assert.deepEqual(
  parseRosterLine('2 김나은 여'),
  { sourceClass: null, no: 2, name: '김나은', gender: '여', ballSense: undefined, recordMs: undefined, group: undefined },
  '기존 번호·이름·성별 형식을 잘못 해석합니다.'
);

const handlerNames = [...html.matchAll(/on(?:click|change|submit)="[^"]*window\.([A-Za-z_$][\w$]*)/g)].map(match => match[1]);
for (const handlerName of new Set(handlerNames)) {
  const assignment = new RegExp(`window\\.${handlerName}\\s*=`);
  assert.ok(assignment.test(app), `HTML에서 호출하는 window.${handlerName} 함수가 없습니다.`);
}

console.log('정적 검사 통과');
