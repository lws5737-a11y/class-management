function cleanCell(value) {
    return String(value ?? '').trim();
}

function normalizeHeader(value) {
    return cleanCell(value).replace(/\s+/g, '').toLowerCase();
}

export function normalizeClassIdentity(value) {
    let raw = cleanCell(value);
    if (raw.startsWith('=')) raw = raw.slice(1).trim();
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        raw = raw.slice(1, -1);
    }
    const compact = raw.replace(/\s+/g, '').replace(/[‐‑‒–—―−]/g, '-');
    const match = compact.match(/^(\d+)(?:학년)?-?(\d+)(?:반)?$/);
    return match ? `${Number(match[1])}-${Number(match[2])}` : compact;
}

export function parseStructuredJson(value, fallback, expectedType = 'object') {
    if (value === undefined || value === null || String(value).trim() === '') return fallback;
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value.trim()) : value;
        if (expectedType === 'array') return Array.isArray(parsed) ? parsed : fallback;
        if (expectedType === 'object') {
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
        }
        return fallback;
    } catch (error) {
        return fallback;
    }
}

function normalizeGender(value) {
    const gender = cleanCell(value);
    if (['남', '남자', '남학생', 'm', 'male'].includes(gender.toLowerCase())) return '남';
    if (['여', '여자', '여학생', 'f', 'female'].includes(gender.toLowerCase())) return '여';
    return '-';
}

function parsePositiveInteger(value) {
    const parsed = Number.parseInt(cleanCell(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseGroupNumber(value, maximum) {
    const parsed = parsePositiveInteger(value);
    return parsed !== undefined && parsed <= maximum ? parsed : undefined;
}

function parseSeconds(value) {
    const raw = cleanCell(value);
    if (!raw) return undefined;
    if (raw.includes(':')) {
        const parts = raw.split(':').map(Number);
        if (parts.some(part => !Number.isFinite(part))) return undefined;
        let seconds = 0;
        for (const part of parts) seconds = seconds * 60 + part;
        return seconds >= 0 ? seconds : undefined;
    }
    const seconds = Number(raw.replace(/초$/, ''));
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function findHeaderIndex(headers, aliases, startsWith = false) {
    const normalizedAliases = aliases.map(normalizeHeader);
    return headers.findIndex(header => normalizedAliases.some(alias => startsWith ? header.startsWith(alias) : header === alias));
}

function parseBallSense(value) {
    const raw = cleanCell(value);
    if (['2', '3', '상', '높음'].includes(raw)) return '2';
    if (['1', '중', '보통'].includes(raw)) return '1';
    if (raw) return '0';
    return undefined;
}

function parseAttendance(value) {
    const raw = cleanCell(value).toLowerCase();
    if (!raw) return undefined;
    return !['불참', '결석', '미출석', 'n', 'no', 'false', '0'].includes(raw);
}

function parseFallbackRow(row, defaultClassName) {
    const cells = row.map(cleanCell);
    const isSchoolFormat = cells.length >= 5
        && /^\d+$/.test(cells[0])
        && /^\d+$/.test(cells[1])
        && /^\d+$/.test(cells[2]);
    const offset = isSchoolFormat ? 2 : 0;
    const no = parsePositiveInteger(cells[offset]);
    const name = cells[offset + 1];
    if (!no || !name) return null;

    const seconds = parseSeconds(cells[offset + 4]);
    return {
        sourceClass: isSchoolFormat ? normalizeClassIdentity(`${cells[0]}-${cells[1]}`) : normalizeClassIdentity(defaultClassName),
        no,
        name,
        gender: normalizeGender(cells[offset + 2]),
        ballSense: parseBallSense(cells[offset + 3]),
        recordMs: seconds === undefined ? undefined : Math.round(seconds * 1000),
        group: parseGroupNumber(cells[offset + 5], 4)
    };
}

export function parseRosterTable(rows, defaultClassName = '') {
    const normalizedRows = (Array.isArray(rows) ? rows : [])
        .map(row => Array.isArray(row) ? row : [row])
        .filter(row => row.some(cell => cleanCell(cell)));
    if (normalizedRows.length === 0) return { records: [], invalidCount: 0 };

    const headerRowIndex = normalizedRows.slice(0, 10).findIndex(row => {
        const headers = row.map(normalizeHeader);
        return findHeaderIndex(headers, ['이름', '성명', '학생명']) >= 0
            && findHeaderIndex(headers, ['번호', '출석번호', '학생번호']) >= 0;
    });

    if (headerRowIndex < 0) {
        const parsed = normalizedRows.map(row => parseFallbackRow(row, defaultClassName));
        return { records: parsed.filter(Boolean), invalidCount: parsed.filter(record => !record).length };
    }

    const headers = normalizedRows[headerRowIndex].map(normalizeHeader);
    const indexes = {
        className: findHeaderIndex(headers, ['학급', '학급명']),
        grade: findHeaderIndex(headers, ['학년']),
        room: findHeaderIndex(headers, ['반', '학급반']),
        no: findHeaderIndex(headers, ['번호', '출석번호', '학생번호']),
        name: findHeaderIndex(headers, ['이름', '성명', '학생명']),
        gender: findHeaderIndex(headers, ['성별', '남녀', '남여']),
        ballSense: findHeaderIndex(headers, ['볼센스', '볼감각']),
        record: findHeaderIndex(headers, ['순발력', '달리기', '개인기록'], true),
        attendance: findHeaderIndex(headers, ['출석', '참석상태', '출결']),
        score: findHeaderIndex(headers, ['개인점수', '점수']),
        memo: findHeaderIndex(headers, ['메모', '비고']),
        genericGroup: findHeaderIndex(headers, ['모둠', '조']),
        mixed2: findHeaderIndex(headers, ['혼성2모둠']),
        mixed3: findHeaderIndex(headers, ['혼성3모둠']),
        mixed4: findHeaderIndex(headers, ['혼성4모둠']),
        genderGroup: findHeaderIndex(headers, ['동성모둠'])
    };

    const records = [];
    let invalidCount = 0;
    for (const row of normalizedRows.slice(headerRowIndex + 1)) {
        const no = parsePositiveInteger(row[indexes.no]);
        const name = cleanCell(row[indexes.name]);
        if (!no || !name) { invalidCount++; continue; }

        let sourceClass = indexes.className >= 0 ? normalizeClassIdentity(row[indexes.className]) : '';
        if (!sourceClass && indexes.grade >= 0 && indexes.room >= 0) {
            const grade = parsePositiveInteger(row[indexes.grade]);
            const room = parsePositiveInteger(row[indexes.room]);
            if (grade && room) sourceClass = `${grade}-${room}`;
        }
        if (!sourceClass) sourceClass = normalizeClassIdentity(defaultClassName);

        const recordCell = indexes.record >= 0 ? cleanCell(row[indexes.record]) : null;
        const seconds = indexes.record >= 0 ? parseSeconds(recordCell) : undefined;
        const score = indexes.score >= 0 && cleanCell(row[indexes.score]) !== '' ? Number(row[indexes.score]) : undefined;
        records.push({
            sourceClass,
            no,
            name,
            gender: indexes.gender >= 0 ? normalizeGender(row[indexes.gender]) : '-',
            ballSense: indexes.ballSense >= 0 ? parseBallSense(row[indexes.ballSense]) : undefined,
            // 내보낸 학생명단에서 순발력 셀을 비운 것은 기존 기록을
            // 유지하라는 뜻이 아니라 기록을 삭제(0ms)하라는 명시적 편집이다.
            recordMs: indexes.record < 0 ? undefined : (recordCell === '' ? 0 : (seconds === undefined ? undefined : Math.round(seconds * 1000))),
            attendance: indexes.attendance >= 0 ? parseAttendance(row[indexes.attendance]) : undefined,
            score: Number.isFinite(score) ? score : undefined,
            memo: indexes.memo >= 0 ? cleanCell(row[indexes.memo]) : undefined,
            group: indexes.genericGroup >= 0 ? parseGroupNumber(row[indexes.genericGroup], 4) : undefined,
            groups: {
                mixed2: indexes.mixed2 >= 0 ? parseGroupNumber(row[indexes.mixed2], 2) : undefined,
                mixed3: indexes.mixed3 >= 0 ? parseGroupNumber(row[indexes.mixed3], 3) : undefined,
                mixed4: indexes.mixed4 >= 0 ? parseGroupNumber(row[indexes.mixed4], 4) : undefined,
                gender: indexes.genderGroup >= 0 ? parseGroupNumber(row[indexes.genderGroup], 4) : undefined
            }
        });
    }
    return { records, invalidCount };
}

export function applyRosterOverrides(classData, records, options = {}) {
    if (!classData || !Array.isArray(records)) return 0;
    const createMissingStudent = typeof options.createMissingStudent === 'function'
        ? options.createMissingStudent
        : null;

    const classKeyMap = new Map();
    for (const existingClassName of Object.keys(classData)) {
        const normalized = normalizeClassIdentity(existingClassName);
        if (!classKeyMap.has(normalized) || existingClassName === normalized) {
            classKeyMap.set(normalized, existingClassName);
        }
    }

    let appliedCount = 0;
    for (const record of records) {
        const normalizedClassName = normalizeClassIdentity(record?.sourceClass);
        const className = Object.hasOwn(classData, record?.sourceClass)
            ? record.sourceClass
            : classKeyMap.get(normalizedClassName);
        const students = classData[className];
        if (!Array.isArray(students)) continue;

        let student = students.find(item => item.no === record.no);
        if (!student && createMissingStudent) {
            student = createMissingStudent(record, className);
            if (student && typeof student === 'object') students.push(student);
        }
        if (!student) continue;

        student.name = record.name;
        student.gender = record.gender;
        if (record.ballSense !== undefined) student.ballSense = record.ballSense;
        if (record.recordMs !== undefined) student.recordMs = record.recordMs;
        if (record.attendance !== undefined) student.attendance = record.attendance;
        if (record.score !== undefined) student.score = record.score;
        if (record.memo !== undefined) student.memo = record.memo;
        if (record.group !== undefined) student.group = record.group;
        if (record.groups?.mixed2 !== undefined) student.group_mixed2 = record.groups.mixed2;
        if (record.groups?.mixed3 !== undefined) student.group_mixed3 = record.groups.mixed3;
        if (record.groups?.mixed4 !== undefined) student.group_mixed4 = record.groups.mixed4;
        if (record.groups?.gender !== undefined) student.group_gender = record.groups.gender;
        appliedCount++;
    }
    return appliedCount;
}

function genderBucket(student) {
    return student.gender === '남' ? 'male' : (student.gender === '여' ? 'female' : 'other');
}

export function getCaptainLimit(mode) {
    return mode === 'mixed2' ? 2 : (mode === 'mixed3' ? 3 : 4);
}

export function canDesignateCaptain(students, student, mode) {
    if (!student?.attendance) return { allowed: false, reason: 'absent' };
    const captainKey = `captain_${mode}`;
    if (student[captainKey]) return { allowed: true, reason: 'already-captain' };

    if (mode === 'gender') {
        if (!['남', '여'].includes(student.gender)) return { allowed: false, reason: 'gender-required' };
        const sameGenderCount = students.filter(item => item.attendance && item.gender === student.gender && item[captainKey]).length;
        return { allowed: sameGenderCount < 2, reason: sameGenderCount < 2 ? 'available' : 'gender-limit' };
    }

    const count = students.filter(item => item.attendance && item[captainKey]).length;
    return { allowed: count < getCaptainLimit(mode), reason: count < getCaptainLimit(mode) ? 'available' : 'total-limit' };
}

export function enforceCaptainLimits(students, mode) {
    const captainKey = `captain_${mode}`;
    let totalCount = 0;
    const genderCounts = { 남: 0, 여: 0 };

    [...students].sort((a, b) => a.no - b.no).forEach(student => {
        if (!student.attendance) {
            student[captainKey] = false;
            return;
        }
        if (!student[captainKey]) return;

        if (mode === 'gender') {
            if (!['남', '여'].includes(student.gender) || genderCounts[student.gender] >= 2) {
                student[captainKey] = false;
                return;
            }
            genderCounts[student.gender]++;
            return;
        }

        totalCount++;
        if (totalCount > getCaptainLimit(mode)) student[captainKey] = false;
    });
}

export function sortStudentsForGroupDisplay(students, captainKey) {
    return [...students].sort((a, b) => {
        const captainDifference = Number(Boolean(b[captainKey])) - Number(Boolean(a[captainKey]));
        if (captainDifference) return captainDifference;

        const aHasRecord = Number(a.recordMs) > 0;
        const bHasRecord = Number(b.recordMs) > 0;
        if (aHasRecord !== bHasRecord) return aHasRecord ? -1 : 1;
        if (aHasRecord && Number(a.recordMs) !== Number(b.recordMs)) return Number(a.recordMs) - Number(b.recordMs);

        const ballDifference = (Number.parseInt(b.ballSense, 10) || 0) - (Number.parseInt(a.ballSense, 10) || 0);
        if (ballDifference) return ballDifference;
        return Number(a.no) - Number(b.no);
    });
}

export function sortStudentsForGroupingPriority(students, priority = 'ball') {
    const ballSenseOf = student => Number.parseInt(student.ballSense, 10) || 0;
    const hasAgilityRecord = student => Number(student.recordMs) > 0;

    return [...students].sort((a, b) => {
        if (priority === 'agility') {
            const aHasRecord = hasAgilityRecord(a);
            const bHasRecord = hasAgilityRecord(b);
            if (aHasRecord !== bHasRecord) return aHasRecord ? -1 : 1;
            if (aHasRecord && Number(a.recordMs) !== Number(b.recordMs)) {
                return Number(a.recordMs) - Number(b.recordMs);
            }
            const ballDifference = ballSenseOf(b) - ballSenseOf(a);
            if (ballDifference) return ballDifference;
        } else {
            const ballDifference = ballSenseOf(b) - ballSenseOf(a);
            if (ballDifference) return ballDifference;
            const aHasRecord = hasAgilityRecord(a);
            const bHasRecord = hasAgilityRecord(b);
            if (aHasRecord !== bHasRecord) return aHasRecord ? -1 : 1;
            if (aHasRecord && Number(a.recordMs) !== Number(b.recordMs)) {
                return Number(a.recordMs) - Number(b.recordMs);
            }
        }
        return Number(a.no) - Number(b.no);
    });
}

export function drawAcrossCycles(items, requestedCount, callbacks = {}) {
    const isDrawn = callbacks.isDrawn || (() => false);
    const resetDrawn = callbacks.resetDrawn || (() => {});
    const markDrawn = callbacks.markDrawn || (() => {});
    const selectBatch = callbacks.selectBatch || ((available, count) => available.slice(0, count));
    const targetCount = Math.min(Math.max(0, Number.parseInt(requestedCount, 10) || 0), items.length);
    const picked = [];
    const pickedItems = new Set();
    let resetCount = 0;

    while (picked.length < targetCount) {
        let available = items.filter(item => !pickedItems.has(item) && !isDrawn(item));
        if (available.length === 0) {
            resetDrawn(items);
            resetCount++;
            available = items.filter(item => !pickedItems.has(item) && !isDrawn(item));
        }
        if (available.length === 0) break;

        const batchSize = Math.min(targetCount - picked.length, available.length);
        const availableSet = new Set(available);
        const selected = selectBatch(available, batchSize)
            .filter((item, index, selectedItems) => availableSet.has(item) && selectedItems.indexOf(item) === index)
            .slice(0, batchSize);
        if (selected.length === 0) break;

        selected.forEach(item => {
            picked.push(item);
            pickedItems.add(item);
            markDrawn(item);
        });
    }

    return { picked, resetCount };
}

function shuffled(items, random) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
        const target = Math.floor(random() * (index + 1));
        [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
}

function createTargetSizes(total, teamCount, random) {
    const sizes = Array(teamCount).fill(Math.floor(total / teamCount));
    const order = shuffled(Array.from({ length: teamCount }, (_, index) => index), random);
    for (let index = 0; index < total % teamCount; index++) sizes[order[index]]++;
    return sizes;
}

function createGenderTargets(students, targetSizes, random) {
    const targets = targetSizes.map(() => ({ male: 0, female: 0, other: 0 }));
    const remaining = [...targetSizes];
    for (const bucket of ['male', 'female', 'other']) {
        const count = students.filter(student => genderBucket(student) === bucket).length;
        for (let index = 0; index < count; index++) {
            const candidates = remaining.map((space, teamIndex) => ({ space, teamIndex }))
                .filter(candidate => candidate.space > 0);
            const minRatio = Math.min(...candidates.map(candidate => targets[candidate.teamIndex][bucket] / targetSizes[candidate.teamIndex]));
            const balanced = candidates.filter(candidate => targets[candidate.teamIndex][bucket] / targetSizes[candidate.teamIndex] === minRatio);
            const chosen = balanced[Math.floor(random() * balanced.length)].teamIndex;
            targets[chosen][bucket]++;
            remaining[chosen]--;
        }
    }
    return targets;
}

function planScore(teams) {
    const powers = teams.map(team => team.totalPower);
    const average = powers.reduce((sum, power) => sum + power, 0) / Math.max(1, powers.length);
    return powers.reduce((sum, power) => sum + ((power - average) ** 2), 0);
}

function optimizePowerBySwaps(teams, getPower, fixedStudents = new Set()) {
    for (let pass = 0; pass < 100; pass++) {
        let bestSwap = null;
        let bestImprovement = 0;
        const currentScore = planScore(teams);
        for (let leftIndex = 0; leftIndex < teams.length; leftIndex++) {
            for (let rightIndex = leftIndex + 1; rightIndex < teams.length; rightIndex++) {
                const left = teams[leftIndex];
                const right = teams[rightIndex];
                for (let leftMemberIndex = 0; leftMemberIndex < left.members.length; leftMemberIndex++) {
                    for (let rightMemberIndex = 0; rightMemberIndex < right.members.length; rightMemberIndex++) {
                        const leftStudent = left.members[leftMemberIndex];
                        const rightStudent = right.members[rightMemberIndex];
                        if (fixedStudents.has(leftStudent) || fixedStudents.has(rightStudent)) continue;
                        if (genderBucket(leftStudent) !== genderBucket(rightStudent)) continue;
                        const leftPower = getPower(leftStudent);
                        const rightPower = getPower(rightStudent);
                        left.totalPower += rightPower - leftPower;
                        right.totalPower += leftPower - rightPower;
                        const improvement = currentScore - planScore(teams);
                        left.totalPower += leftPower - rightPower;
                        right.totalPower += rightPower - leftPower;
                        if (improvement > bestImprovement) {
                            bestImprovement = improvement;
                            bestSwap = { left, right, leftMemberIndex, rightMemberIndex, leftPower, rightPower };
                        }
                    }
                }
            }
        }
        if (!bestSwap) break;
        const leftStudent = bestSwap.left.members[bestSwap.leftMemberIndex];
        bestSwap.left.members[bestSwap.leftMemberIndex] = bestSwap.right.members[bestSwap.rightMemberIndex];
        bestSwap.right.members[bestSwap.rightMemberIndex] = leftStudent;
        bestSwap.left.totalPower += bestSwap.rightPower - bestSwap.leftPower;
        bestSwap.right.totalPower += bestSwap.leftPower - bestSwap.rightPower;
    }
}

export function buildBalancedTeamPlan(students, teamCount, getPower, random = Math.random, attempts = 80, options = {}) {
    if (!Array.isArray(students) || !Number.isInteger(teamCount) || teamCount < 1 || students.length < teamCount) return [];
    let bestPlan = null;
    let bestScore = Infinity;

    for (let attempt = 0; attempt < attempts; attempt++) {
        const targetSizes = createTargetSizes(students.length, teamCount, random);
        const genderTargets = createGenderTargets(students, targetSizes, random);
        const teams = targetSizes.map((targetSize, index) => ({
            id: index + 1, targetSize, members: [], totalPower: 0,
            genders: { male: 0, female: 0, other: 0 }, genderTargets: genderTargets[index]
        }));

        const captains = [...new Set((options.captains || []).filter(student => students.includes(student)))];
        const fixedStudents = new Set(captains);
        const orderedCaptains = shuffled(captains, random).sort((a, b) => getPower(b) - getPower(a));
        for (const captain of orderedCaptains) {
            const bucket = genderBucket(captain);
            let candidates = teams.filter(team => team.members.length < team.targetSize && team.members.length === 0 && team.genders[bucket] < team.genderTargets[bucket]);
            if (candidates.length === 0) candidates = teams.filter(team => team.members.length < team.targetSize && team.members.length === 0);
            if (candidates.length === 0) candidates = teams.filter(team => team.members.length < team.targetSize);
            const minimumPower = Math.min(...candidates.map(team => team.totalPower));
            candidates = candidates.filter(team => team.totalPower === minimumPower);
            const team = candidates[Math.floor(random() * candidates.length)];
            team.members.push(captain);
            team.totalPower += getPower(captain);
            team.genders[bucket]++;
        }

        const ordered = shuffled(students.filter(student => !fixedStudents.has(student)), random).sort((a, b) => getPower(b) - getPower(a));
        for (const student of ordered) {
            const bucket = genderBucket(student);
            let candidates = teams.filter(team => team.members.length < team.targetSize && team.genders[bucket] < team.genderTargets[bucket]);
            if (candidates.length === 0) candidates = teams.filter(team => team.members.length < team.targetSize);
            const minimumPower = Math.min(...candidates.map(team => team.totalPower));
            candidates = candidates.filter(team => team.totalPower === minimumPower);
            const minimumCount = Math.min(...candidates.map(team => team.members.length));
            candidates = candidates.filter(team => team.members.length === minimumCount);
            const team = candidates[Math.floor(random() * candidates.length)];
            team.members.push(student);
            team.totalPower += getPower(student);
            team.genders[bucket]++;
        }

        optimizePowerBySwaps(teams, getPower, fixedStudents);

        const score = planScore(teams);
        if (score < bestScore) { bestScore = score; bestPlan = teams; }
    }
    return bestPlan || [];
}

