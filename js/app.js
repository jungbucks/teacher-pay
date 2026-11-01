/* app.js — 입력을 계산에 묶고 급여대장에 live 렌더 + 호봉표·복사·PNG. 계산은 calc.js에 위임. */

/* 기능 스위치 — false로 바꾸면 그 기능이 생기기 전 동작과 똑같아진다.
   stickyTotal: 모바일(≤768px) 하단 고정 합계 바 / persistState: URL 쿼리·저장·초기화·복사 링크 */
const FLAGS = { stickyTotal: true, persistState: true };

const won = n => n.toLocaleString('ko-KR');

const el = {
  years: document.getElementById('years'),
  yearsVal: document.getElementById('yearsVal'),
  yrMinus: document.getElementById('yrMinus'),
  yrPlus: document.getElementById('yrPlus'),
  hobong: document.getElementById('hobong'),
  hobongVal: document.getElementById('hobongVal'),
  hbMinus: document.getElementById('hbMinus'),
  hbPlus: document.getElementById('hbPlus'),
  salaryVal: document.getElementById('salaryVal'),
  promo: document.getElementById('promo'),
  todayLabel: document.getElementById('todayLabel'),
  rateTag: document.getElementById('rateTag'),
  jgAmt: document.getElementById('jgAmt'),
  jgNote: document.getElementById('jgNote'),
  gasan: document.getElementById('gasan'),
  gasanYear: document.getElementById('gasanYear'),
  gasanFlag: document.getElementById('gasanFlag'),
  holAmt: document.getElementById('holAmt'),
  holNote: document.getElementById('holNote'),
  annual: document.getElementById('annual'),
  annualFormula: document.getElementById('annualFormula'),
  hobongTable: document.getElementById('hobongTable'),
  copyBtn: document.getElementById('copyBtn'),
  pngBtn: document.getElementById('pngBtn'),
  actMsg: document.getElementById('actMsg'),
  jgBtn: document.getElementById('jgBtn'),
  gaBtn: document.getElementById('gaBtn'),
  dlgJg: document.getElementById('dlgJg'),
  dlgGa: document.getElementById('dlgGa'),
  jgTableBody: document.getElementById('jgTableBody'),
  gaTableBody: document.getElementById('gaTableBody'),
  lgPromo: document.getElementById('lgPromo'),
  resetBtn: document.getElementById('resetBtn'),
  resultCard: document.getElementById('resultCard'),
  annualBox: document.getElementById('annualBox'),
  sticky: document.getElementById('stickyTotal'),
  stickyAmt: document.getElementById('stickyAmt'),
  stickyMore: document.getElementById('stickyMore'),
};

const YR_MIN = 0, YR_MAX = 45;
let curCell = null;   // 현재 하이라이트된 호봉표 셀 — 40칸 순회 대신 이전 것만 끄고 새 것만 켠다

function tick(node, text) {
  if (node.textContent === text) return;
  node.textContent = text;
  node.classList.remove('tick');
  void node.offsetWidth;
  node.classList.add('tick');
}

function todayMonth() { return window.__todayMonth || (new Date().getMonth() + 1); } // 테스트 주입 시임

function state() {
  const hobong = Math.min(HOBONG_MAX, Math.max(HOBONG_MIN, +el.hobong.value || HOBONG_MIN));
  const years = Math.max(YR_MIN, Math.min(YR_MAX, +el.years.value || 0));
  const promoMonth = +el.promo.value || 0;   // 0 = 승급 미반영
  const tm = todayMonth();
  return { hobong, years, promoMonth, tm, r: computeYear(hobong, years, promoMonth || null, tm) };
}

/* 금액칸 렌더: 승급월과 상관없이 항상 지급분별 2줄(지급월 → 금액 → 호봉 태그). */
function renderAmt(container, payArr, unit, labelFn) {
  container.classList.add('split');
  container.innerHTML = payArr.map(p =>
    `<span class="pay"><b class="pay-month">${labelFn(p)}</b><b class="num">${won(p.amt)}</b><span class="won">${unit}</span><i class="pay-tag">${p.hobong}호봉</i></span>`).join('');
  container.classList.remove('tick'); void container.offsetWidth; container.classList.add('tick');
}

/* 지급분별 호봉 기준 문구 — 화면·복사·이미지 공통. kind = 'jg'(정근 1·7월) | 'hol'(설·추석).
   · 두 지급분 호봉이 다름 → 기존 "승급 반영 · …" 문구
   · 둘 다 선택한 호봉   → "1·7월 모두 20호봉 기준"
   · 둘 다 다른 같은 호봉 → "11월 승급 전이라 1·7월 모두 19호봉으로 계산" */
function basisNote(r, kind) {
  const [a, b] = kind === 'jg' ? r.jeonggeun : r.holiday;
  const both = kind === 'jg' ? '1·7월' : '설·추석';
  if (a.hobong !== b.hobong) return { mixed: true, text: `승급 반영 · ${both} 지급분을 각 호봉으로 계산` };
  if (a.hobong === r.hobong) return { mixed: false, text: `${both} 모두 ${a.hobong}호봉 기준` };
  // 둘 다 선택한 호봉이 아닌 경우: 아래면 아직 승급 전, 위면(예: 오늘 1월·2월 승급의 설·추석) 승급 반영
  const why = a.hobong < r.hobong ? `${r.promoMonth}월 승급 전이라` : `${r.promoMonth}월 승급 반영으로`;
  return { mixed: false, text: `${why} ${both} 모두 ${a.hobong}호봉으로 계산` };
}
function noteHtml(r, kind) {
  const n = basisNote(r, kind);
  if (n.mixed) return `<b>승급 반영</b> · ${kind === 'jg' ? '1·7월' : '설·추석'} 지급분을 각 호봉으로 계산`;
  return `<b>${n.text}</b> · ${kind === 'jg' ? '월봉급액 × 지급률' : '월봉급액 × 60%'}`;
}

/* 마지막 render()의 계산 결과 — 화면·결과 복사·이미지 저장이 모두 이 한 객체를 읽는다(따로 계산하지 않음). */
let current = null;

function render() {
  current = state();
  const { hobong, years, promoMonth, tm, r } = current;
  el.yearsVal.textContent = years;
  el.hobongVal.textContent = hobong;
  el.salaryVal.textContent = won(salaryOf(hobong));
  el.todayLabel.textContent = tm + '월';
  el.rateTag.textContent = r.rate + '%';
  el.yrMinus.disabled = years === YR_MIN;
  el.yrPlus.disabled = years === YR_MAX;
  el.hbMinus.disabled = hobong === HOBONG_MIN;
  el.hbPlus.disabled = hobong === HOBONG_MAX;
  el.years.setAttribute('aria-valuetext', years + '년');
  el.hobong.setAttribute('aria-valuetext', hobong + '호봉');

  renderAmt(el.jgAmt, r.jeonggeun, '원', p => p.month + '월');
  el.jgNote.innerHTML = noteHtml(r, 'jg');

  tick(el.gasan, won(r.gasan));
  el.gasanYear.textContent = won(r.gasanYear);
  el.gasanFlag.hidden = RULES_VERIFIED;

  renderAmt(el.holAmt, r.holiday, '원', p => p.label);
  el.holNote.innerHTML = noteHtml(r, 'hol');

  tick(el.annual, won(r.annual));
  if (FLAGS.stickyTotal && el.stickyAmt) {
    const t = won(r.annual) + '원';
    if (el.stickyAmt.textContent !== t) {
      const first = el.stickyAmt.textContent === '';
      el.stickyAmt.textContent = t;
      if (!first) { el.stickyAmt.classList.remove('pulse'); void el.stickyAmt.offsetWidth; el.stickyAmt.classList.add('pulse'); }  // 짧은 강조(reduced-motion이면 CSS가 끔)
    }
  }
  el.annualFormula.textContent = `정근 ${won(r.jgSum)} + 가산 ${won(r.gasanYear)} + 명절 ${won(r.holSum)}`;

  renderTimeline(r);
  if (el.lgPromo) el.lgPromo.hidden = !promoMonth;   // 승급월 "없음"이면 범례에서 뺀다

  const cell = el.hobongTable.children[hobong - HOBONG_MIN];  // 셀은 1~40 순서 → O(1) 접근
  if (cell !== curCell) {
    if (curCell) curCell.classList.remove('cur');
    if (cell) cell.classList.add('cur');
    curCell = cell;
  }
}

/* 사용자가 입력을 바꿨을 때: 다시 그리고 상태를 남긴다(persistState). */
function update() { render(); persist(); }

function setHobong(v) { el.hobong.value = Math.min(HOBONG_MAX, Math.max(HOBONG_MIN, v)); update(); }
function setYears(v) { el.years.value = Math.min(YR_MAX, Math.max(YR_MIN, v)); update(); }

/* ── 입력값 저장·공유 링크·초기화 (FLAGS.persistState) ──
   시작값 우선순위: URL 쿼리(?y=근무연수&h=호봉&m=승급월) > localStorage(teacherPay.v1) > 기본값.
   항목별로 검증해서, 범위 밖이거나 정수가 아니면 그 항목만 다음 순위 값을 쓴다. */
const STORE_KEY = 'teacherPay.v1';
const DEFAULTS = { y: 10, h: 20, m: 3 };
const RANGE = { y: [YR_MIN, YR_MAX], h: [HOBONG_MIN, HOBONG_MAX], m: [0, 12] };   // m 0 = 승급월 없음

function validInt(v, [lo, hi]) {
  let n = null;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d{1,3}$/.test(v.trim())) n = Number(v.trim());
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
}
function readQuery() {
  try { const p = new URLSearchParams(location.search); return { y: p.get('y'), h: p.get('h'), m: p.get('m') }; }
  catch (e) { return {}; }
}
function readStore() {
  try { const o = JSON.parse(localStorage.getItem(STORE_KEY)); return o && typeof o === 'object' ? o : {}; }
  catch (e) { return {}; }   // 저장값이 깨졌거나 저장소를 못 쓰면 무시
}
function initialValues() {
  const q = readQuery(), s = readStore(), out = {};
  for (const k of ['y', 'h', 'm']) {
    const fromQ = validInt(q[k], RANGE[k]), fromS = validInt(s[k], RANGE[k]);
    out[k] = fromQ !== null ? fromQ : fromS !== null ? fromS : DEFAULTS[k];
  }
  return out;
}
function applyValues(v) {
  el.years.value = v.y; el.hobong.value = v.h; el.promo.value = String(v.m);
}
/* 지금 조건이 담긴 전체 URL (다른 쿼리·해시는 보존) */
function shareUrl(v = current) {
  const u = new URL(location.href);
  u.searchParams.set('y', v.years); u.searchParams.set('h', v.hobong); u.searchParams.set('m', v.promoMonth);
  return u.toString();
}
function persist() {
  if (!FLAGS.persistState || !current) return;
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ y: current.years, h: current.hobong, m: current.promoMonth })); } catch (e) { /* 저장 불가 환경 */ }
  try { history.replaceState(history.state, '', shareUrl()); } catch (e) { /* file:// 등 URL 변경 불가 환경 */ }
}
function resetAll() {
  applyValues(DEFAULTS);
  render();
  try { localStorage.removeItem(STORE_KEY); } catch (e) { /* noop */ }
  try {
    const u = new URL(location.href);
    ['y', 'h', 'm'].forEach(k => u.searchParams.delete(k));
    history.replaceState(history.state, '', u.toString());
  } catch (e) { /* noop */ }
  flash('기본값으로 돌렸어요');
}

/* 전체 호봉표 렌더 (클릭하면 그 호봉으로 이동) */
function renderHobongTable() {
  let html = '';
  for (let h = HOBONG_MIN; h <= HOBONG_MAX; h++) {
    html += `<button class="hb-cell" data-h="${h}"><span>${h}호봉</span><b>${won(SALARY_2026[h])}</b></button>`;
  }
  el.hobongTable.innerHTML = html;
}

/* 시그니처: 월별 수당 지급 타임라인 — computeYear 결과를 시각화(표시 전용).
   정근 1·7월 / 명절 설·추석(대표월 2·9월) / 가산금 매월. 승급월엔 각 지급분 호봉을 함께 표기. */
function renderTimeline(r) {
  const track = document.getElementById('timeline');
  if (!track) return;
  const hb = {};
  r.jeonggeun.forEach(p => { hb[p.month] = { type: 'jg', hobong: p.hobong, name: p.month + '월 정근수당' }; });
  r.holiday.forEach(p => { hb[p.month] = { type: 'hol', hobong: p.hobong, name: p.label + ' 명절휴가비(대표월)' }; });
  const promo = r.promoMonth || 0;
  let html = '';
  for (let m = 1; m <= 12; m++) {
    const ev = hb[m];
    let dot = '', tag = '';
    if (ev) {
      dot = `<i class="tl-dot ${ev.type}" title="${ev.name} · ${ev.hobong}호봉"></i>`;
      tag = promo ? `<span class="tl-hb">${ev.hobong}</span>` : '';
    }
    const cls = (ev ? ' event' : '') + (promo && m === promo ? ' promo' : '');
    html += `<div class="tl-cell${cls}"><span class="tl-slot">${dot}</span><span class="tl-seg"></span><span class="tl-mon">${m}</span><span class="tl-hbslot">${tag}</span></div>`;
  }
  track.innerHTML = html;
}

/* ── 연차별 지급표 모달 (표시 전용 — jeonggeunRate·gasangeum 재사용, 숫자 안 지어냄) ── */
function renderJgTable(years) {
  const cur = jeonggeunTier(years);   // 계산과 같은 구간 데이터(JG_RATE_TIERS)로 표를 그린다
  el.jgTableBody.innerHTML = JG_RATE_TIERS.map(t =>
    `<tr class="${t === cur ? 'cur' : ''}"><td>${t.label}</td><td class="amt">${t.rate}%</td></tr>`).join('');
}

const GA_TIERS = [
  { y: 0, label: '1년 미만 ~ 4년', lo: 0, hi: 4 },
  { y: 5, label: '5년 ~ 9년', lo: 5, hi: 9 },
  { y: 10, label: '10년 ~ 14년', lo: 10, hi: 14 },
  { y: 15, label: '15년 ~ 19년', lo: 15, hi: 19 },
  { y: 20, label: '20년 ~ 24년', lo: 20, hi: 24, extra: '기본 10만 + 추가 1만' },
  { y: 25, label: '25년 이상', lo: 25, hi: Infinity, extra: '기본 10만 + 추가 3만' },
];
function renderGaTable(years) {
  el.gaTableBody.innerHTML = GA_TIERS.map(t => {
    const isCur = years >= t.lo && years <= t.hi;
    const sub = t.extra ? `<span class="sub">${t.extra}</span>` : '';
    return `<tr class="${isCur ? 'cur' : ''}"><td>${t.label}</td><td class="amt">${won(gasangeum(t.y))}원${sub}</td></tr>`;
  }).join('');
}
function openModal(dlg, renderFn) {
  renderFn((current || state()).years);
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
}
[el.dlgJg, el.dlgGa].forEach(dlg => {
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // 백드롭 클릭 닫기
  dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
});

/* 결과 요약 텍스트 */
function summaryText(v = current || state()) {
  const { hobong, years, promoMonth, tm, r } = v;
  // 화면과 같은 규칙: 항상 지급분별 금액·호봉 + 기준 문구
  const jgStr = r.jeonggeun.map(p => `${p.month}월 ${won(p.amt)}원(${p.hobong}호봉)`).join(' + ');
  const holStr = r.holiday.map(p => `${p.label} ${won(p.amt)}원(${p.hobong}호봉)`).join(' + ');
  const promoStr = promoMonth ? `승급월 ${promoMonth}월(오늘 ${tm}월 기준)` : '승급 미반영';
  let link = '';
  if (FLAGS.persistState) { try { link = shareUrl(v); } catch (e) { link = ''; } }   // 받은 사람이 같은 조건으로 열 수 있게
  return [
    '[교사 수당 계산 · 2026년 기준 · 참고용]',
    `현재 ${hobong}호봉 · 근무연수 ${years}년 · ${promoStr}`,
    `· 정근수당 ${jgStr} (지급률 ${r.rate}%)`,
    `  ↳ ${basisNote(r, 'jg').text}`,
    `· 정근수당 가산금 ${won(r.gasan)}원/월 (연 ${won(r.gasanYear)}원)`,
    `· 명절휴가비 ${holStr}`,
    `  ↳ ${basisNote(r, 'hol').text}`,
    `· 연간 합계 ${won(r.annual)}원`,
    '※ 개인 상황에 따라 다를 수 있는 참고용입니다. (인사혁신처 봉급표·공무원수당규정 별표2)',
  ].concat(link ? [link] : []).join('\n');
}

let flashTimer = null;
function flash(msg) {
  el.actMsg.textContent = msg;
  clearTimeout(flashTimer);   // 연달아 띄울 때 앞 메시지의 타이머가 새 메시지를 일찍 지우지 않게
  flashTimer = setTimeout(() => { el.actMsg.textContent = ''; }, 2000);
}

function copyResult() {
  const text = summaryText();
  const done = () => flash('복사됐어요 — 단톡방·블로그에 붙여넣기');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) { /* noop */ }
  document.body.removeChild(ta); done();
}

/* 명세서를 canvas에 직접 그려 PNG로 저장 (라이브러리 없음).
   화면과 같은 미니멀 톤: 흰 배경 · 얇은 브랜드 액센트(딥그린) · 강조 면은 버터(연간 합계) · 직인/줄무늬 없음. */
function drawSlip(v = current || state()) {
  const { hobong, years, promoMonth, tm, r } = v;
  const dpr = 2, W = 640, H = 488;   // 정근·명절에 기준 줄이 1줄씩 늘어 +36
  const cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const texts = [];   // 그린 글자 기록 — 화면·복사와 같은 값인지 검증용
  const fillText = ctx.fillText.bind(ctx);
  ctx.fillText = (t, x, y) => { texts.push(String(t)); fillText(t, x, y); };
  const F = (w, s) => `${w} ${s}px "Pretendard","Malgun Gothic",sans-serif`;      // 본문
  const P = (w, s) => `${w} ${s}px "Paperlogy","Pretendard","Malgun Gothic",sans-serif`; // 디스플레이·숫자
  const INK = '#1a1d1b', SOFT = '#5b6560', FAINT = '#8a938d', BRAND = '#013e37', TINT = '#ffefb3';

  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = BRAND; ctx.fillRect(0, 0, W, 5);              // 얇은 브랜드 액센트 라인

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK; ctx.font = P(700, 22); ctx.textAlign = 'left';
  ctx.fillText('급여 명세', 28, 52);
  ctx.fillStyle = FAINT; ctx.font = F(600, 13); ctx.textAlign = 'right';
  ctx.fillText('2026 · 세전 · 참고용', W - 28, 52);
  ctx.fillStyle = SOFT; ctx.font = F(500, 14); ctx.textAlign = 'left';
  const promoNote = promoMonth ? ` · 승급월 ${promoMonth}월(오늘 ${tm}월 기준)` : '';
  ctx.fillText(`현재 ${hobong}호봉(월봉급 ${won(salaryOf(hobong))}원) · 근무연수 ${years}년${promoNote}`, 28, 80);

  let y = 122;
  const line = (name, amount, unit, notes) => {
    ctx.fillStyle = INK; ctx.font = F(600, 17); ctx.textAlign = 'left';
    ctx.fillText(name, 28, y);
    ctx.font = P(700, 22); ctx.textAlign = 'right';
    const suffix = unit ? '  ' + unit : '';
    ctx.fillText(won(amount) + suffix, W - 28, y);
    ctx.fillStyle = FAINT; ctx.font = F(400, 12.5); ctx.textAlign = 'left';
    notes.forEach((n, i) => ctx.fillText(n, 28, y + 20 + i * 18));
    y += 56 + (notes.length - 1) * 18;
  };
  // 화면·복사와 같은 규칙: 항상 지급분별 금액·호봉 + 기준 문구
  const jgPays = r.jeonggeun.map(p => `${p.month}월 ${won(p.amt)}(${p.hobong}호봉)`).join(' + ');
  const holPays = r.holiday.map(p => `${p.label} ${won(p.amt)}(${p.hobong}호봉)`).join(' + ');
  line(`정근수당 (연 · ${r.rate}%)`, r.jgSum, '원', [jgPays, basisNote(r, 'jg').text]);
  line('정근수당 가산금', r.gasan, '원/월', [`근무연수 구간별 정액 · 매월 → 연 ${won(r.gasanYear)}원`]);
  line('명절휴가비 (연)', r.holSum, '원', [holPays, basisNote(r, 'hol').text]);

  // 연간 합계 — 버터 tint 블록 (시선 집중)
  y += 4;
  ctx.fillStyle = TINT; ctx.fillRect(28, y, W - 56, 60);
  ctx.fillStyle = BRAND; ctx.font = P(700, 18); ctx.textAlign = 'left';
  ctx.fillText('연간 합계', 46, y + 32);
  ctx.fillStyle = SOFT; ctx.font = F(500, 11.5);
  ctx.fillText(`정근 ${won(r.jgSum)} + 가산 ${won(r.gasanYear)} + 명절 ${won(r.holSum)}`, 46, y + 48);
  ctx.fillStyle = BRAND; ctx.font = P(900, 27); ctx.textAlign = 'right';
  ctx.fillText(won(r.annual) + '원', W - 46, y + 40);

  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = FAINT; ctx.font = F(400, 11.5); ctx.textAlign = 'left';
  ctx.fillText('출처: 인사혁신처 2026 공무원봉급표 · 공무원수당규정(별표2) · 개인 상황에 따라 다를 수 있는 참고용', 28, H - 30);

  // @jungbucks 서명 스탬프 (절제된 초록, 우하단)
  ctx.save();
  ctx.translate(W - 78, y + 82); ctx.rotate(-5 * Math.PI / 180);
  ctx.globalAlpha = 0.82; ctx.strokeStyle = BRAND; ctx.lineWidth = 1.5;
  const sw = 104, sh = 30;
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-sw / 2, -sh / 2, sw, sh, 8); ctx.stroke(); }
  else { ctx.strokeRect(-sw / 2, -sh / 2, sw, sh); }
  ctx.fillStyle = BRAND; ctx.font = P(700, 14); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('@jungbucks', 0, 1);
  ctx.restore();
  return { cv, hobong, years, texts };
}

function savePng() {
  const { cv, hobong, years } = drawSlip();
  const trigger = (url) => {
    const a = document.createElement('a');
    a.href = url; a.download = `교사수당_명세서_${hobong}호봉_${years}년.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  if (cv.toBlob) {
    cv.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      trigger(url); setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash('이미지를 저장했어요');
    }, 'image/png');
  } else {
    trigger(cv.toDataURL('image/png')); flash('이미지를 저장했어요');
  }
}

/* ── 모바일 하단 고정 합계 바 (FLAGS.stickyTotal) ──
   ≤768px에서만 CSS로 보임. 노란 연간 합계 박스가 화면에 보이는 동안은 숨긴다(IntersectionObserver). */
function initStickyTotal() {
  if (!FLAGS.stickyTotal || !el.sticky) return;
  el.sticky.hidden = false;
  document.body.classList.add('has-sticky');   // 하단 여백(버튼·푸터를 가리지 않게)
  el.stickyMore.addEventListener('click', () => {
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.resultCard.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
  if (typeof window.IntersectionObserver === 'function' && el.annualBox) {
    // 바 높이만큼 아래를 깎아서, 합계 박스가 바 뒤에 깔려 있을 땐 '보임'으로 치지 않는다
    new window.IntersectionObserver(entries => {
      el.sticky.classList.toggle('is-away', entries[entries.length - 1].isIntersecting);
    }, { rootMargin: '0px 0px -96px 0px' }).observe(el.annualBox);
  }
}

el.hobong.addEventListener('input', update);
el.years.addEventListener('input', update);
el.hbMinus.addEventListener('click', () => setHobong(+el.hobong.value - 1));
el.hbPlus.addEventListener('click', () => setHobong(+el.hobong.value + 1));
el.yrMinus.addEventListener('click', () => setYears(+el.years.value - 1));
el.yrPlus.addEventListener('click', () => setYears(+el.years.value + 1));
el.hobongTable.addEventListener('click', e => {
  const cell = e.target.closest('.hb-cell');
  if (!cell) return;
  const from = (current || state()).hobong, to = +cell.dataset.h;
  setHobong(to);
  if (to !== from) flash(`${from}호봉 → ${to}호봉으로 바꿨어요`);   // 화면 폭·플래그와 상관없이 알려 준다
});
el.copyBtn.addEventListener('click', copyResult);
el.pngBtn.addEventListener('click', savePng);
el.jgBtn.addEventListener('click', () => openModal(el.dlgJg, renderJgTable));
el.gaBtn.addEventListener('click', () => openModal(el.dlgGa, renderGaTable));
el.promo.addEventListener('change', update);

renderHobongTable();
if (FLAGS.persistState) {
  applyValues(initialValues());
  if (el.resetBtn) { el.resetBtn.hidden = false; el.resetBtn.addEventListener('click', resetAll); }
}
render();
initStickyTotal();
