import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');

const allowedEmail = 'lws5737@seoul-dongsan.es.kr';
assert.ok(app.includes(`const ALLOWED_EMAIL = '${allowedEmail}'`), '클라이언트 허용 계정 검사가 없습니다.');
assert.ok(rules.includes(`request.auth.token.email == '${allowedEmail}'`), 'Firestore 허용 계정 검사가 없습니다.');
assert.ok(rules.includes('request.auth.token.email_verified == true'), '이메일 인증 검사가 없습니다.');
assert.ok(html.includes('id="class-selection-screen"'), '학급 선택 첫 화면이 없습니다.');
assert.ok(html.includes('id="class-selection-list"'), '학급 선택 목록이 없습니다.');
assert.ok(!html.includes('user-scalable=no'), '화면 확대가 차단되어 있습니다.');
assert.ok(!app.includes("text.includes('')"), 'CSV 인코딩 검사가 항상 참인 오류가 남아 있습니다.');
assert.ok(!app.includes('${s.name}'), '학생 이름이 HTML에 직접 삽입되는 코드가 남아 있습니다.');

const handlerNames = [...html.matchAll(/on(?:click|change|submit)="[^"]*window\.([A-Za-z_$][\w$]*)/g)].map(match => match[1]);
for (const handlerName of new Set(handlerNames)) {
  const assignment = new RegExp(`window\\.${handlerName}\\s*=`);
  assert.ok(assignment.test(app), `HTML에서 호출하는 window.${handlerName} 함수가 없습니다.`);
}

console.log('정적 검사 통과');

