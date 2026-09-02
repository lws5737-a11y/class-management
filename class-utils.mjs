function cleanCell(value) {
    return String(value ?? '').trim();
}

function normalizeHeader(value) {
    return cleanCell(value).replace(/\s+/g, '').toLowerCase();
}

function normalizeClassName(value) {
    const raw = cleanCell(value).replace(/^=["']?|["']$/g, '');
    const compact = raw.replace(/\s+/g, '');
    const match = compact.match(/^(\d+)학년(\d+)반$/);
    return match ? `${Number(match[1])}-${Number(match[2])}` : compact;
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
        sourceClass: isSchoolFormat ? normalizeClassName(`${cells[0]}-${cells[1]}`) : normalizeClassName(defaultClassName),
        no,
        name,
        gender: normalizeGender(cells[offset + 2]),
        ballSense: parseBallSense(cells[offset + 3]),
        recordMs: seconds === undefined ? undefined : Math.round(seconds * 1000),
        group: parsePositiveInteger(cells[offset + 5])
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

        let sourceClass = indexes.className >= 0 ? normalizeClassName(row[indexes.className]) : '';
        if (!sourceClass && indexes.grade >= 0 && indexes.room >= 0) {
            const grade = parsePositiveInteger(row[indexes.grade]);
            const room = parsePositiveInteger(row[indexes.room]);
            if (grade && room) sourceClass = `${grade}-${room}`;
        }
        if (!sourceClass) sourceClass = normalizeClassName(defaultClassName);

        const seconds = indexes.record >= 0 ? parseSeconds(row[indexes.record]) : undefined;
        const score = indexes.score >= 0 && cleanCell(row[indexes.score]) !== '' ? Number(row[indexes.score]) : undefined;
        records.push({
            sourceClass,
            no,
            name,
            gender: indexes.gender >= 0 ? normalizeGender(row[indexes.gender]) : '-',
            ballSense: indexes.ballSense >= 0 ? parseBallSense(row[indexes.ballSense]) : undefined,
            recordMs: seconds === undefined ? undefined : Math.round(seconds * 1000),
            attendance: indexes.attendance >= 0 ? parseAttendance(row[indexes.attendance]) : undefined,
            score: Number.isFinite(score) ? score : undefined,
            memo: indexes.memo >= 0 ? cleanCell(row[indexes.memo]) : undefined,
            group: indexes.genericGroup >= 0 ? parsePositiveInteger(row[indexes.genericGroup]) : undefined,
            groups: {
                mixed2: indexes.mixed2 >= 0 ? parsePositiveInteger(row[indexes.mixed2]) : undefined,
                mixed3: indexes.mixed3 >= 0 ? parsePositiveInteger(row[indexes.mixed3]) : undefined,
                mixed4: indexes.mixed4 >= 0 ? parsePositiveInteger(row[indexes.mixed4]) : undefined,
                gender: indexes.genderGroup >= 0 ? parsePositiveInteger(row[indexes.genderGroup]) : undefined
            }
        });
    }
    return { records, invalidCount };
}

function genderBucket(student) {
    return student.gender === '남' ? 'male' : (student.gender === '여' ? 'female' : 'other');
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

function optimizePowerBySwaps(teams, getPower) {
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

export function buildBalancedTeamPlan(students, teamCount, getPower, random = Math.random, attempts = 80) {
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

        const ordered = shuffled(students, random).sort((a, b) => getPower(b) - getPower(a));
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

        optimizePowerBySwaps(teams, getPower);

        const score = planScore(teams);
        if (score < bestScore) { bestScore = score; bestPlan = teams; }
    }
    return bestPlan || [];
}
