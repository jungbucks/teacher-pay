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

  /* ───────── [C1] 모바일 하단 고정 합계 바 ───────── */
  const barState = page => page.evaluate(() => {
    const b = document.getElementById('stickyTotal'), r = b.getBoundingClientRect(), cs = getComputedStyle(b);
    return { shown: cs.display !== 'none' && cs.visibility !== 'hidden' && !b.hidden, away: b.classList.contains('is-away'),
      top: r.top, bottom: r.bottom, amt: document.getElementById('stickyAmt').textContent, vh: innerHeight, sy: scrollY,
      pad: getComputedStyle(document.body).paddingBottom };
  });
  const won = n => n.toLocaleString('ko-KR');
  {
    const { ctx, page } = await newPage({ width: 390, height: 844 });
    await page.goto(base + '/index.html');
    await page.waitForTimeout(300);
    let s = await barState(page);
    check('[C1-1] 390px: 하단 고정 바 표시 "연간 합계 8,246,420원"', s.shown && !s.away && s.bottom <= s.vh && s.amt === '8,246,420원' &&
      (await page.textContent('#stickyTotal')).replace(/\s+/g, ' ').includes('연간 합계 8,246,420원'));
    const plus = await page.evaluate(() => document.getElementById('hbPlus').getBoundingClientRect().bottom);
    check('[C1] 390px: 첫 화면에 호봉 + 버튼이 바보다 위에 보임', plus < s.top);
    await page.click('#hbPlus');
    await page.waitForTimeout(100);
    const s2 = await barState(page);
    check('[C1 완료] 390x844에서 호봉 + → 스크롤 없이 바 금액이 바로 바뀜', s2.sy === 0 && s2.shown && !s2.away && s2.amt === won(annualOf(21, 10, 3)) + '원');
    check('[C1-2] 바뀔 때 짧게 강조(pulse)', await page.evaluate(() => {
      const a = document.getElementById('stickyAmt'); return a.classList.contains('pulse') && getComputedStyle(a).animationName === 'stpulse';
    }));
    check('[C1-6] 바 금액 aria-hidden, 버튼 aria-label "계산 결과로 이동"', await page.evaluate(() =>
      document.getElementById('stickyAmt').getAttribute('aria-hidden') === 'true' &&
      document.getElementById('stickyMore').getAttribute('aria-label') === '계산 결과로 이동' &&
      !document.getElementById('stickyTotal').closest('[aria-live]')));
    check('[C1-5] body 하단 여백(바 높이 + safe-area 자리)', parseFloat(s2.pad) >= (s2.bottom - s2.top) + 12);
    // 맨 아래까지 내렸을 때 푸터·버튼이 바에 가리지 않음
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    const end = await page.evaluate(() => {
      const bar = document.getElementById('stickyTotal').getBoundingClientRect();
      const last = [...document.querySelectorAll('.colophon p')].at(-1).getBoundingClientRect();
      return { lastBottom: last.bottom, barTop: bar.top, barShown: getComputedStyle(document.getElementById('stickyTotal')).visibility !== 'hidden' };
    });
    check('[C1-5] 맨 아래에서 푸터 마지막 줄이 바 위에 보임', end.barShown && end.lastBottom <= end.barTop);
    // 자세히 → 결과 카드로 이동, 연간 합계 박스가 보이면 바가 숨음
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.click('#stickyMore');
    await page.waitForTimeout(1200);
    const s3 = await barState(page);
    const cardTop = await page.evaluate(() => document.getElementById('resultCard').getBoundingClientRect().top);
    check('[C1-3] 자세히 → 계산 결과 카드로 스크롤', s3.sy > 300 && Math.abs(cardTop) < 40);
    check('[C1-4 완료] 결과 카드(연간 합계 박스)까지 내려가면 바가 사라짐', s3.away && !s3.shown && !(await page.isVisible('#stickyMore')));
    // 호봉표 행 클릭 → status 안내 + 바 갱신(합계 박스가 화면 밖일 때)
    await page.evaluate(() => { document.querySelector('.hobong-table').open = true; document.querySelector('.hb-cell[data-h="25"]').scrollIntoView({ block: 'center' }); });
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => +document.getElementById('hobong').value);
    await page.click('.hb-cell[data-h="25"]');
    await page.waitForTimeout(300);
    const s4 = await barState(page);
    check(`[C1-7] 390px 호봉표 클릭 → "${before}호봉 → 25호봉으로 바꿨어요"`, (await page.textContent('#actMsg')) === `${before}호봉 → 25호봉으로 바꿨어요`);
    check('[C1] 390px 호봉표 클릭 → 바가 보이고 금액 갱신', s4.shown && !s4.away && s4.amt === won(annualOf(25, 10, 3)) + '원');
    check('[C1] 390px 페이지 오류 0건', page.errors.length === 0);
    await ctx.close();
  }
  for (const width of [320, 390]) {
    const { ctx, page } = await newPage({ width, height: 700 });
    await page.goto(base + '/index.html?y=25&h=40&m=11');
    const ov = await page.evaluate(() => {
      const b = document.getElementById('stickyTotal').getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, barL: b.left, barR: b.right };
    });
    check(`[C1] ${width}px: 가로 넘침 없음(고정 바 포함)`, ov.sw <= ov.iw && ov.barL >= 0 && ov.barR <= ov.iw);
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage({ width: 390, height: 844, reducedMotion: 'reduce' });
    await page.goto(base + '/index.html');
    await page.click('#hbPlus');
    const anim = await page.evaluate(() => {
      const a = document.getElementById('stickyAmt'); return { name: getComputedStyle(a).animationName, amt: a.textContent };
    });
    check('[C1-2] reduced-motion: 애니메이션 없이 금액만 갱신', anim.name === 'none' && anim.amt === won(annualOf(21, 10, 3)) + '원');
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage({ width: 1280, height: 900 });
    await page.goto(base + '/index.html');
    const s = await barState(page);
    check('[C1 완료] 1280px: 고정 바 안 나옴·하단 여백 없음', !s.shown && s.pad === '0px');
    await page.evaluate(() => { document.querySelector('.hobong-table').open = true; });
    await page.click('.hb-cell[data-h="25"]');
    check('[C1-7] 1280px 호봉표 클릭 → "20호봉 → 25호봉으로 바꿨어요"', (await page.textContent('#actMsg')) === '20호봉 → 25호봉으로 바꿨어요');
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage({ width: 390, height: 844, flags: { stickyTotal: false } });
    await page.goto(base + '/index.html');
    const s = await barState(page);
    check('[C1-8 끔] 390px: 고정 바·하단 여백 없음', !s.shown && s.pad === '0px' && !(await page.evaluate(() => document.body.classList.contains('has-sticky'))));
    await page.evaluate(() => { document.querySelector('.hobong-table').open = true; });
    await page.click('.hb-cell[data-h="25"]');
    check('[C1-8 끔] 호봉표 안내는 그대로 "20호봉 → 25호봉으로 바꿨어요"', (await page.textContent('#actMsg')) === '20호봉 → 25호봉으로 바꿨어요');
    check('[C1-8 끔] 페이지 오류 0건', page.errors.length === 0);
    await ctx.close();
  }

  /* ───────── FLAGS 끔 = 이전 버전과 같은 화면인지 (BASELINE_DIR 줬을 때만) ─────────
     BASELINE_DIR=이전 버전 폴더, BASELINE_FLAGS=이 버전에서 끌 플래그(쉼표). 같은 입력을 넣고 결과·복사·배치를 비교. */
  if (baseline) {
    const off = Object.fromEntries((process.env.BASELINE_FLAGS || 'stickyTotal,persistState').split(',').map(k => [k.trim(), false]));
    const finger = async (url, opts, origin) => {
      const { ctx, page } = await newPage(opts);
      await page.goto(url + '/index.html');
      await setInputs(page, { y: 7, h: 15, m: 11 });
      const f = await page.evaluate(() => {
        const rect = s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(','); };
        return {
          result: document.getElementById('resultCard') ? document.getElementById('resultCard').innerText : document.querySelector('.card.result').innerText,
          summary: summaryText(),
          scrollH: document.documentElement.scrollHeight, bodyPad: getComputedStyle(document.body).paddingBottom,
          chip: rect('.inputs .chip'), png: rect('#pngBtn'), copy: rect('#copyBtn'), foot: rect('.colophon'),
          search: location.search, stored: (() => { try { return localStorage.getItem('teacherPay.v1'); } catch (e) { return 'ERR'; } })(),
          resetVisible: !!document.getElementById('resetBtn') && !document.getElementById('resetBtn').hidden,
        };
      });
      f.summary = f.summary.split(origin).join('ORIGIN');
      f.errors = page.errors.length;
      await ctx.close();
      return f;
    };
    for (const width of [390, 1280]) {
      const a = await finger(base, { width, height: 844, flags: off }, base);
      const b = await finger(baseline.base, { width, height: 844 }, baseline.base);
      for (const k of Object.keys(b)) check(`[FLAGS 끔 ${Object.keys(off).join('+')}] ${width}px ${k} 이전 버전과 같음`, JSON.stringify(a[k]) === JSON.stringify(b[k]));
    }
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
