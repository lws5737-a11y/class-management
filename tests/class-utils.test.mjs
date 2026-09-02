import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBalancedTeamPlan, parseRosterTable } from '../class-utils.mjs';

function seededRandom(seed = 123456) {
    return () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}

test('parseRosterTable reads an ordinary school roster workbook', () => {
    const result = parseRosterTable([
        ['학년', '반', '번호', '이름', '성별', '볼센스', '순발력(초)'],
        [6, 2, 1, '강루미', '여자', '상', 12.35],
        [6, 2, 2, '김나은', '여', '중', '0:13.20']
    ]);
    assert.equal(result.records.length, 2);
    assert.deepEqual(result.records[0], {
        sourceClass: '6-2', no: 1, name: '강루미', gender: '여', ballSense: '2', recordMs: 12350,
        attendance: undefined, score: undefined, memo: undefined, group: undefined,
        groups: { mixed2: undefined, mixed3: undefined, mixed4: undefined, gender: undefined }
    });
    assert.equal(result.records[1].recordMs, 13200);
});

test('parseRosterTable reads the app student-list worksheet', () => {
    const result = parseRosterTable([
        ['학급', '번호', '이름', '성별', '출석', '볼센스', '개인점수', '순발력(초)', '혼성2모둠'],
        ['5-1', 3, '박체육', '남', '불참', '하', 7, 11.8, 2]
    ]);
    assert.equal(result.records[0].sourceClass, '5-1');
    assert.equal(result.records[0].attendance, false);
    assert.equal(result.records[0].score, 7);
    assert.equal(result.records[0].groups.mixed2, 2);
});

test('buildBalancedTeamPlan balances headcount, gender, and ability', () => {
    const students = Array.from({ length: 25 }, (_, index) => ({
        no: index + 1,
        gender: index < 13 ? '남' : '여',
        power: 260 - index * 9
    }));
    const teams = buildBalancedTeamPlan(students, 4, student => student.power, seededRandom(), 60);
    const sizes = teams.map(team => team.members.length);
    const maleCounts = teams.map(team => team.members.filter(student => student.gender === '남').length);
    const femaleCounts = teams.map(team => team.members.filter(student => student.gender === '여').length);
    const powers = teams.map(team => team.totalPower);

    assert.equal(teams.flatMap(team => team.members).length, students.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
    assert.ok(Math.max(...maleCounts) - Math.min(...maleCounts) <= 1);
    assert.ok(Math.max(...femaleCounts) - Math.min(...femaleCounts) <= 1);
    assert.ok(Math.max(...powers) - Math.min(...powers) <= Math.max(...students.map(student => student.power)));
});

test('buildBalancedTeamPlan keeps same-gender teams equal in size and power-aware', () => {
    const students = [210, 190, 170, 150, 130, 110, 90].map((power, index) => ({ no: index + 1, gender: '남', power }));
    const teams = buildBalancedTeamPlan(students, 2, student => student.power, seededRandom(7), 40);
    assert.ok(Math.max(...teams.map(team => team.members.length)) - Math.min(...teams.map(team => team.members.length)) <= 1);
    assert.ok(Math.max(...teams.map(team => team.totalPower)) - Math.min(...teams.map(team => team.totalPower)) <= 210);
});

test('buildBalancedTeamPlan preserves balance across common class sizes', () => {
    for (const teamCount of [2, 3, 4]) {
        for (const studentCount of [17, 24, 29, 31]) {
            const students = Array.from({ length: studentCount }, (_, index) => ({
                no: index + 1,
                gender: index % 5 < 3 ? '남' : '여',
                power: 40 + ((index * 47) % 230)
            }));
            const teams = buildBalancedTeamPlan(students, teamCount, student => student.power, seededRandom(studentCount * teamCount), 30);
            const sizes = teams.map(team => team.members.length);
            const males = teams.map(team => team.members.filter(student => student.gender === '남').length);
            const females = teams.map(team => team.members.filter(student => student.gender === '여').length);
            assert.equal(new Set(teams.flatMap(team => team.members).map(student => student.no)).size, studentCount);
            assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
            assert.ok(Math.max(...males) - Math.min(...males) <= 1);
            assert.ok(Math.max(...females) - Math.min(...females) <= 1);
        }
    }
});
