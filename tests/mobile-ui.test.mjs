import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortRoster } from '../mobile-ui.mjs';

const students = [
    { no: 3, name: '박하늘', attendance: true, selected: true, ballSense: '2', recordMs: 18000 },
    { no: 1, name: '김가람', attendance: false, selected: false, ballSense: '0', recordMs: 0 },
    { no: 2, name: '이바다', attendance: true, selected: false, ballSense: '1', recordMs: 12000 }
];
test('mobile roster filters by number/name and does not mutate data', () => {
    assert.deepEqual(sortRoster(students).map(s => s.no), [1, 2, 3]);
    assert.deepEqual(sortRoster(students, 'no', '  하늘 ').map(s => s.no), [3]);
    assert.deepEqual(sortRoster(students, 'no', '2').map(s => s.no), [2]);
    assert.deepEqual(students.map(s => s.no), [3, 1, 2]);
});
test('mobile attendance/selection filters and skill sorting', () => {
    assert.deepEqual(sortRoster(students, 'no', '', 'absent').map(s => s.no), [1]);
    assert.deepEqual(sortRoster(students, 'no', '', 'selected').map(s => s.no), [3]);
    assert.deepEqual(sortRoster(students, 'ballSense').map(s => s.no), [3, 2, 1]);
    assert.deepEqual(sortRoster(students, 'recordMs').map(s => s.no), [2, 3, 1]);
    assert.deepEqual(sortRoster(students, 'name').map(s => s.no), [1, 3, 2]);
});
