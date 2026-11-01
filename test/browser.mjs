/* browser.mjs — 실제 브라우저(Edge) 시나리오 검증. node test/browser.mjs
   probe.html(file:// iframe)로는 못 보는 것: URL 쿼리·localStorage·새로고침(B2), 뷰포트별 고정 합계 바(C1), FLAGS 끔.
   - 로컬 http 서버로 띄워 GitHub Pages와 같은 조건(https 대신 http)에서 연다.
   - playwright(또는 playwright-core)가 필요. 경로는 PLAYWRIGHT_MODULE 환경변수로 지정 가능
     예) PLAYWRIGHT_MODULE=D:/Works/token_economy/node_modules/playwright/index.js node test/browser.mjs
   - 브라우저는 하나만 띄우고 끝나면 닫는다(저사양 PC 배려).
   - BASELINE_DIR(선택): 이전 버전 사이트 폴더. 주면 FLAGS를 끈 화면이 이전 버전과 같은지 비교한다. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const modSpec = process.env.PLAYWRIGHT_MODULE || 'playwright-core';
const pw = await import(/^[a-zA-Z]:[\\/]|^\//.test(modSpec) ? pathToFileURL(modSpec).href : modSpec);
const chromium = pw.chromium || pw.default.chromium;

const TODAY = 11;   // 날짜 고정(window.__todayMonth) — 결과가 실행 날짜에 따라 바뀌지 않게
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const calc = vm.runInNewContext(read('data/salary-2026.js') + read('data/allowance-rules.js') + read('js/calc.js') + ';({computeYear})', {});
const annualOf = (h, y, m) => calc.computeYear(h, y, m || null, TODAY).annual;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png' };
function serve(dir) {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(dir, p === '/' ? 'index.html' : p);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, base: `http://127.0.0.1:${srv.address().port}` })));
}

let fail = 0, total = 0;
const check = (name, ok) => { total++; console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const { srv, base } = await serve(root);
const baseline = process.env.BASELINE_DIR ? await serve(path.resolve(process.env.BASELINE_DIR)) : null;
const browser = await chromium.launch({ channel: 'msedge', headless: true });

/* flags: { stickyTotal, persistState } 중 바꿀 것만. app.js를 응답 단계에서 글자 그대로 바꿔 끼운다(원본 파일 무변경). */
async function newPage({ width = 1280, height = 900, flags = {}, reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion });
  await ctx.addInitScript(t => { window.__todayMonth = t; }, TODAY);
  const keys = Object.keys(flags);
  if (keys.length) {
    let src = read('js/app.js');
    for (const k of keys) {
      const before = src;
      src = src.replace(new RegExp(`(const FLAGS = \\{[^}]*\\b${k}: )(true|false)`), `$1${flags[k]}`);
      if (src === before) throw new Error('FLAGS 치환 실패: ' + k);
    }
    await ctx.route('**/js/app.js', r => r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: src }));
  }
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  return { ctx, page };
}
const vals = page => page.evaluate(() => ({
  y: +document.getElementById('years').value, h: +document.getElementById('hobong').value, m: +document.getElementById('promo').value,
  annual: +document.getElementById('annual').textContent.replace(/[^0-9]/g, ''),
}));
const setInputs = (page, { y, h, m }) => page.evaluate(({ y, h, m }) => {
  const fire = (id, v, ev) => { const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event(ev)); };
  if (y !== undefined) fire('years', y, 'input');
  if (h !== undefined) fire('hobong', h, 'input');
  if (m !== undefined) fire('promo', m, 'change');
}, { y, h, m });
const stored = page => page.evaluate(() => localStorage.getItem('teacherPay.v1'));

try {
  /* ───────── [B2] 입력값 저장 · 공유 링크 · 초기화 ───────── */
  {
    const { ctx, page } = await newPage();
    await page.goto(base + '/index.html');
    let v = await vals(page);
    check('[B2] 처음 열면 기본값 10년·20호봉·3월', v.y === 10 && v.h === 20 && v.m === 3);

    await setInputs(page, { y: 5, h: 12, m: 0 });
    const q = new URL(page.url()).searchParams;
    check('[B2-1] 바꾸면 URL이 ?y=5&h=12&m=0으로 갱신', q.get('y') === '5' && q.get('h') === '12' && q.get('m') === '0');
    check('[B2-1] localStorage teacherPay.v1 = {y:5,h:12,m:0}', JSON.stringify(JSON.parse(await stored(page))) === '{"y":5,"h":12,"m":0}');
    const histLen = await page.evaluate(() => history.length);
    await setInputs(page, { y: 6 }); await setInputs(page, { y: 5 });
    check('[B2-1] replaceState라 뒤로가기 기록이 쌓이지 않음', await page.evaluate(() => history.length) === histLen);

    await page.reload();
    v = await vals(page);
    check('[B2 완료1] 5년·12호봉·승급 없음 → 새로고침해도 유지', v.y === 5 && v.h === 12 && v.m === 0 && v.annual === annualOf(12, 5, 0));
    await page.goto(base + '/index.html');   // 쿼리 없이 열어도 저장값으로
    v = await vals(page);
    check('[B2] 쿼리 없이 다시 열어도 저장값(5·12·없음)', v.y === 5 && v.h === 12 && v.m === 0);

    await page.goto(base + '/index.html?y=2&h=9&m=3');
    v = await vals(page);
    check('[B2 완료2] ?y=2&h=9&m=3 → 그 값으로 계산(쿼리가 저장값보다 우선)', v.y === 2 && v.h === 9 && v.m === 3 && v.annual === annualOf(9, 2, 3));

    await page.goto(base + '/index.html?y=999&h=abc');
    v = await vals(page);
    // 공유 링크로 연 값은 저장하지 않는다(저장은 사용자가 바꿀 때만) → 저장값은 여전히 5·12·없음
    check('[B2 완료3] ?y=999&h=abc → 안 깨지고 잘못된 항목만 무시(저장값 5·12·없음 사용)', v.y === 5 && v.h === 12 && v.m === 0 && page.errors.length === 0 && v.annual === annualOf(12, 5, 0));
    await page.goto(base + '/index.html?y=2.5&h=-1&m=13');
    v = await vals(page);
    check('[B2] ?y=2.5&h=-1&m=13(소수·음수·범위 밖)도 무시', v.y === 5 && v.h === 12 && v.m === 0);
    await page.goto(base + '/index.html?y=7&h=abc');
    v = await vals(page);
    check('[B2] ?y=7&h=abc → y만 쿼리, h·m은 저장값', v.y === 7 && v.h === 12 && v.m === 0);

    const copy = await page.evaluate(() => summaryText());
    const last = copy.split('\n').at(-1);
    let lastUrl = null; try { lastUrl = new URL(last); } catch (e) { /* not url */ }
    check('[B2 완료4] 복사 텍스트 마지막 줄 = 현재 조건 전체 URL', !!lastUrl && lastUrl.origin === base &&
      lastUrl.searchParams.get('y') === '7' && lastUrl.searchParams.get('h') === '12' && lastUrl.searchParams.get('m') === '0');
    await page.click('#copyBtn');
    check('[B2] 결과 복사 버튼 동작(안내 문구)', (await page.textContent('#actMsg')).includes('복사됐어요'));

    check('[B2-5] 초기화 버튼 보임(계산 조건 머리줄)', await page.isVisible('.card-head #resetBtn'));
    await page.click('#resetBtn');
    v = await vals(page);
    const u = new URL(page.url());
    check('[B2-5] 초기화 → 10·20·3월, 저장값·쿼리 삭제, "기본값으로 돌렸어요"',
      v.y === 10 && v.h === 20 && v.m === 3 && (await stored(page)) === null &&
      !u.searchParams.has('y') && !u.searchParams.has('h') && !u.searchParams.has('m') &&
      (await page.textContent('#actMsg')) === '기본값으로 돌렸어요');
    await page.reload();
    v = await vals(page);
    check('[B2 완료5] 초기화 후 새로고침 → 10·20·3월', v.y === 10 && v.h === 20 && v.m === 3);

    for (const bad of ['{bad json', '"str"', 'null', '{"y":"x","h":99,"m":5}']) {
      await page.evaluate(b => localStorage.setItem('teacherPay.v1', b), bad);
      await page.goto(base + '/index.html');
      v = await vals(page);
      const want = bad.includes('"m":5') ? { y: 10, h: 20, m: 5 } : { y: 10, h: 20, m: 3 };
      check(`[B2] 잘못된 저장값 ${bad} → 그 항목만 무시`, v.y === want.y && v.h === want.h && v.m === want.m && page.errors.length === 0);
    }
    check('[B2] 페이지 오류 0건', page.errors.length === 0);
    await ctx.close();
  }

  /* ───────── [B2-6] FLAGS.persistState = false ───────── */
  {
    const { ctx, page } = await newPage({ flags: { persistState: false } });
    await page.goto(base + '/index.html?y=2&h=9&m=3');
    let v = await vals(page);
    check('[B2-6 끔] 쿼리 무시 → 기본값 10·20·3월', v.y === 10 && v.h === 20 && v.m === 3);
    await setInputs(page, { y: 5, h: 12, m: 0 });
    check('[B2-6 끔] 바꿔도 URL·저장 변화 없음', new URL(page.url()).search === '?y=2&h=9&m=3' && (await stored(page)) === null);
    await page.reload();
    v = await vals(page);
    check('[B2-6 끔] 새로고침하면 기본값으로', v.y === 10 && v.h === 20 && v.m === 3);
    check('[B2-6 끔] 초기화 버튼 없음', !(await page.isVisible('#resetBtn')));
    const copy = await page.evaluate(() => summaryText());
    check('[B2-6 끔] 복사 텍스트에 링크 없음(마지막 줄 = ※ 안내)', !/https?:\/\//.test(copy) && copy.split('\n').at(-1).startsWith('※'));
    check('[B2-6 끔] 페이지 오류 0건', page.errors.length === 0);
    await ctx.close();
  }
} catch (e) {
  check('예외: ' + e.message, false);
} finally {
  await browser.close();
  srv.close();
  if (baseline) baseline.srv.close();
}
console.log(fail === 0 ? `== 전체 PASS (${total}건) ==` : `== FAIL ${fail}건 / ${total}건 ==`);
process.exit(fail === 0 ? 0 : 1);
