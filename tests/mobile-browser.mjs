// Local-only fixture. Firebase imports are replaced in the HTTP response, never in production files.
// Requires Playwright (npm install --no-save playwright; npx playwright install chromium).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const output = process.env.UI_SCREENSHOTS || resolve(root, '.ui-artifacts');
await mkdir(output, { recursive: true });
const bootstrap = `
userId = 'local-ui-test'; hasLoadedRemoteData = true;
classData = Object.fromEntries(['4-1','4-2','4-3','4-4','4-5','4-6','6-1','6-2','6-3','6-4','6-5','6-6','긴 이름 학급 테스트'].map(name => [name, Array.from({length: 28}, (_, i) => ({
...createStudentRecord(i + 1, ['김가람','이바다','박하늘','최푸른','남궁긴이름테스트','정다온','윤해솔'][i % 7], i % 2 ? '여' : '남'),
group_mixed4: i < 24 ? i % 4 + 1 : null, attendance: i !== 5, captain_mixed4: i < 4,
ballSense: String(i % 3), recordMs: i % 5 ? 12000 + i * 370 : 0
}))]));
document.getElementById('login-screen').classList.add('hidden');
window.showClassSelectionScreen(); setSyncStatus('saved', 'Firebase 저장 완료');
window.__fixtureSnapshot = () => { window.renderStudentList(); window.renderGroups(); window.renderJumpRopeTab(); };
window.__fixtureState = () => JSON.parse(JSON.stringify({ currentClass, classData, jumpRopeData }));
`;
const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + '\\') && !file.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    try {
        let data = await readFile(file);
        if (pathname === '/app.js') {
            data = data.toString().replace(/^import .*firebase.*;\r?\n/gm, '')
                .replace(/^import .*https:.*;\r?\n/gm, '');
            data = `const auth = { currentUser: { uid: 'local-ui-test' } }, db = {}, provider = {};
const firestorePersistenceReady = Promise.resolve(true), firestorePersistenceState = {enabled: true};
const onAuthStateChanged = () => {}, signInWithPopup = () => {}, signOut = () => {};
const doc = () => ({}), setDoc = async () => {}, updateDoc = async () => {}, onSnapshot = () => () => {};
` + data + bootstrap;
        }
        res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg'})[extname(file)] || 'application/octet-stream');
        res.end(data);
    } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, ...(process.env.UI_BROWSER_CHANNEL ? { channel: process.env.UI_BROWSER_CHANNEL } : {}) });
try {
    for (const width of [320, 390, 768, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 768, hasTouch: width < 768, deviceScaleFactor: 1 });
        const page = await context.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        // Network allow-list excludes all Firebase, auth and production app endpoints.
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (['127.0.0.1','cdn.tailwindcss.com','fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)) route.continue();
            else route.abort();
        });
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        await page.getByRole('button', { name: '4-1 학급 선택', exact: true }).waitFor();
        await page.screenshot({ path: resolve(output, `classes-${width}.png`), fullPage: true, animations: 'disabled' });
        assert.equal(await page.locator('#class-selection-list button[aria-label$="학급 삭제"]:visible').count(), 0);
        await page.locator('#class-edit-toggle').click();
        assert.equal(await page.locator('#class-selection-list button[aria-label$="학급 삭제"]:visible').count(), 13);
        await page.locator('#class-edit-toggle').click();
        await page.getByRole('button', { name: '4-1 학급 선택', exact: true }).click();
        if (width < 768) {
            assert.equal(await page.locator('.ui-student-row').count(), 28);
            await page.locator('#roster-search').fill('남궁');
            assert.equal(await page.locator('.ui-student-row').count(), 4);
            await page.locator('#roster-search').fill('');
            await page.locator('.ui-attendance').first().click();
            assert.equal(await page.locator('.ui-attendance').first().textContent(), '불참');
            await page.locator('.ui-attendance').first().click();
            await page.locator('.ui-student-name').first().click();
            assert.equal(await page.locator('#float-group-count').textContent(), '1명');
            await page.locator('#roster-clear-selection').click();
            await page.locator('.ui-student-more').first().click();
            assert.equal(await page.locator('dialog[open]').count(), 1);
            await page.getByRole('button', { name: '닫기', exact: true }).click();
            await page.screenshot({ path: resolve(output, `roster-${width}.png`), fullPage: false, animations: 'disabled' });
        }
        await page.locator('#tab-group').click();
        await page.screenshot({ path: resolve(output, `groups-${width}.png`), fullPage: false, animations: 'disabled' });
        const before = await page.evaluate(() => window.__fixtureState().classData['4-1'][0].group_mixed4);
        assert.equal(before, 1);
        await page.locator('.student-card[data-student-no="1"] .ui-card-more').click();
        await page.getByRole('button', { name: '모둠 이동 / 자리 교환', exact: true }).click();
        await page.getByRole('button', { name: /^미편성 · 참석/ }).click();
        assert.equal(await page.evaluate(() => window.__fixtureState().classData['4-1'][0].group_mixed4), null);
        await page.locator('.student-card[data-student-no="1"] .ui-card-more').click();
        await page.getByRole('button', { name: '모둠 이동 / 자리 교환', exact: true }).click();
        await page.getByRole('button', { name: '다른 학생과 자리 교환' }).click();
        await page.getByRole('button', { name: '2모둠 · 2번 이바다', exact: true }).click();
        assert.equal(await page.evaluate(() => window.__fixtureState().classData['4-1'][0].group_mixed4), 2);
        if (width < 768) {
            const cdp = await context.newCDPSession(page);
            const card = page.locator('#group-result .student-card[data-student-no="5"]');
            await card.scrollIntoViewIfNeeded();
            let box = await card.boundingBox();
            const point = { x: box.x + box.width / 2, y: box.y + 58 };
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
            await page.waitForFunction(() => Boolean(window.touchClone));
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
            assert.equal(await page.evaluate(() => window.touchClone), null);
            assert.equal(await page.evaluate(() => window.__fixtureState().classData['4-1'][4].group_mixed4), 1);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
            await page.waitForFunction(() => Boolean(window.touchClone));
            box = await page.locator('#unassigned-area > div').first().boundingBox();
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            assert.equal(await page.evaluate(() => window.__fixtureState().classData['4-1'][4].group_mixed4), null);
        } else {
            await page.locator('#group-result .student-card[data-student-no="5"]').dragTo(page.locator('#group-result > [data-group-id="2"] > div').first(), { sourcePosition: { x: 30, y: 40 }, targetPosition: { x: 20, y: 15 } });
            assert.equal(await page.evaluate(() => window.__fixtureState().classData['4-1'][4].group_mixed4), 2);
        }
        await page.locator('#tab-jumprope').click();
        assert.equal(await page.evaluate(() => scrollY), 0);
        await page.screenshot({ path: resolve(output, `jumprope-${width}.png`), fullPage: false, animations: 'disabled' });
        await page.locator('#jumprope-male-1-input').fill('42');
        await page.locator('#jumprope-target-input').fill('50');
        await page.evaluate(() => window.__fixtureSnapshot());
        assert.equal(await page.locator('#jumprope-male-1-input').inputValue(), '42');
        await page.locator('#tab-group').click();
        await page.locator('#tab-jumprope').click();
        assert.equal(await page.locator('#jumprope-male-1-input').inputValue(), '42');
        await page.locator('#jumprope-week-select').selectOption('1월 1주차');
        assert.equal(await page.locator('#jumprope-male-1-input').inputValue(), '');
        assert.equal(await page.locator('#floating-group-btn-container').isVisible(), false);
        for (const tab of ['student','group','jumprope','stamp']) {
            await page.locator(`#tab-${tab}`).click();
            assert.equal(await page.locator(`#tab-${tab}`).getAttribute('aria-current'), 'page');
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px ${tab} overflows horizontally`);
        }
        assert.deepEqual(errors, []);
        console.log(`PASS ${width}px: landing, attendance, search, selection, sheets, move/swap, touch or mouse drag, drafts, navigation, overflow`);
        await context.close();
    }
} finally { await browser.close(); await new Promise(r => server.close(r)); }
