import { parseSets } from './volleyball.mjs?v=20261117-2';
import { normalizeClassIdentity } from './class-utils.mjs?v=20261117-2';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const safeKey = key => !['__proto__', 'constructor', 'prototype'].includes(key);
const fail = () => { throw new Error('빅발리볼 백업이 손상되었거나 지원하지 않는 형식입니다. 기존 자료는 변경하지 않았습니다.'); };
const integer = (value, max = 9999) => Number.isInteger(value) && value >= 0 && value <= max;

// Validate before changing any roster or class data. Do not silently replace a corrupt backup with {}.
export function validateVolleyballMap(map) {
    if (!object(map)) fail();
    for (const [name, data] of Object.entries(map)) {
        if (!safeKey(name) || !object(data) || !object(data.skills) || !Array.isArray(data.events)) fail();
        for (const [no, skill] of Object.entries(data.skills)) {
            if (!/^\d+$/.test(no) || !object(skill)) fail();
            for (const key of ['under', 'over']) if (skill[key] != null && !integer(skill[key])) fail();
        }
        const eventIds = new Set();
        for (const event of data.events) {
            if (!object(event) || typeof event.id !== 'string' || !event.id || eventIds.has(event.id)
                || typeof event.name !== 'string' || !['리그전', '토너먼트전'].includes(event.mode)
                || !Array.isArray(event.teams) || event.teams.length < 2 || event.teams.length > 128
                || !Array.isArray(event.matches) || !object(event.scores)) fail();
            eventIds.add(event.id);
            const teamIds = new Set(), members = new Set(), pairs = new Set();
            for (const team of event.teams) {
                if (!object(team) || !integer(team.id) || team.id < 1 || teamIds.has(team.id)
                    || typeof team.name !== 'string' || !Array.isArray(team.members)) fail();
                teamIds.add(team.id);
                for (const s of team.members) {
                    if (!object(s) || !integer(s.no) || typeof s.name !== 'string' || members.has(s.no)) fail();
                    members.add(s.no);
                }
            }
            const validateMatch = m => {
                if (!object(m) || !teamIds.has(m.a) || !teamIds.has(m.b) || m.a === m.b) fail();
            };
            for (const match of event.matches) {
                validateMatch(match);
                const pair = [match.a, match.b].sort((a,b)=>a-b).join(':');
                if (pairs.has(pair) || typeof match.score !== 'string') fail();
                pairs.add(pair);
                if (match.score) parseSets(match.score);
            }
            for (const [key, score] of Object.entries(event.scores)) {
                if (!/^\d+-\d+$/.test(key)) fail();
                validateMatch(score); parseSets(score.value);
            }
        }
    }
    return structuredClone(map);
}

export function volleyballSettingsRows(map, classes) {
    const selected = Object.fromEntries(classes.map(name => [name, map[name] || { skills: {}, events: [] }]));
    const json = JSON.stringify({ version: 1, classes: validateVolleyballMap(selected) });
    const chunks = json.match(/[\s\S]{1,30000}/g) || [];
    return [['빅발리볼형식', 1], ['빅발리볼조각수', chunks.length],
        ...chunks.map((chunk, i) => [`빅발리볼JSON_${String(i + 1).padStart(4, '0')}`, chunk])];
}

export function readVolleyballSettings(rows) {
    const entries = rows.filter(row => String(row[0]).startsWith('빅발리볼'));
    if (!entries.length) return null; // Legacy backup: preserve existing volleyball data.
    const map = Object.fromEntries(entries);
    if (entries.length !== Object.keys(map).length || Number(map['빅발리볼형식']) !== 1) fail();
    const count = Number(map['빅발리볼조각수']);
    if (!integer(count, 1000) || !count || entries.length !== count + 2) fail();
    let json = '';
    for (let i = 1; i <= count; i++) {
        const chunk = map[`빅발리볼JSON_${String(i).padStart(4, '0')}`];
        if (typeof chunk !== 'string') fail();
        json += chunk;
    }
    let value; try { value = JSON.parse(json); } catch { fail(); }
    if (value?.version !== 1) fail();
    return validateVolleyballMap(value.classes);
}

export function restoreVolleyball(current, incoming, { classes, targetClass = '', sourceClass = '', classScope = false }) {
    const next = targetClass || classScope ? structuredClone(current) : Object.fromEntries(classes.filter(k => Object.hasOwn(current, k)).map(k => [k, structuredClone(current[k])]));
    if (incoming === null || incoming === undefined) return next;
    for (const target of targetClass ? [targetClass] : classes) {
        const source = targetClass ? sourceClass : target;
        const keys = Object.keys(incoming).filter(k => normalizeClassIdentity(k) === normalizeClassIdentity(source));
        if (keys.length !== 1) throw new Error(`빅발리볼 백업에서 ${source} 학급을 확인할 수 없습니다.`);
        next[target] = structuredClone(incoming[keys[0]]);
    }
    return next;
}
