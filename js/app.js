/* app.js — 입력을 계산에 묶고 급여대장에 live 렌더 + 호봉표·복사·PNG. 계산은 calc.js에 위임. */
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

/* 금액칸 렌더: 승급으로 갈리면 지급월·호봉 태그와 함께 2줄, 아니면 1줄. */
function renderAmt(container, payArr, split, unit, labelFn) {
  if (!split) {
    container.classList.remove('split');
    container.innerHTML = `<b class="num">${won(payArr[0].amt)}</b><span class="won">${unit}</span>`;
  } else {
    container.classList.add('split');
    container.innerHTML = payArr.map(p =>
      `<span class="pay"><b class="num">${won(p.amt)}</b><span class="won">${unit}</span><i class="pay-tag">${labelFn(p)} · ${p.hobong}호봉</i></span>`).join('');
  }
  container.classList.remove('tick'); void container.offsetWidth; container.classList.add('tick');
}

function render() {
  const { hobong, years, promoMonth, tm, r } = state();
  el.yearsVal.textContent = years;
  el.hobongVal.textContent = hobong;
  el.salaryVal.textContent = won(salaryOf(hobong));
  el.todayLabel.textContent = tm + '월';
  el.rateTag.textContent = r.rate + '%';

  renderAmt(el.jgAmt, r.jeonggeun, r.jgSplit, '원', p => p.month + '월');
  el.jgNote.innerHTML = r.jgSplit
    ? `<b>승급 반영</b> · 1·7월 지급분을 각 호봉으로 계산`
    : `월봉급액 × 지급률 · <b>1월·7월</b> 각각 지급`;

  tick(el.gasan, won(r.gasan));
  el.gasanYear.textContent = won(r.gasanYear);
  el.gasanFlag.hidden = RULES_VERIFIED;

  renderAmt(el.holAmt, r.holiday, r.holSplit, '원', p => p.label);
  el.holNote.innerHTML = r.holSplit
    ? `<b>승급 반영</b> · 설·추석 지급분을 각 호봉으로 계산`
    : `월봉급액 × 60% · <b>설·추석</b> 각각 지급`;

  tick(el.annual, won(r.annual));
  el.annualFormula.textContent = `정근 ${won(r.jgSum)} + 가산 ${won(r.gasanYear)} + 명절 ${won(r.holSum)}`;

  renderTimeline(r);

  const cell = el.hobongTable.children[hobong - HOBONG_MIN];  // 셀은 1~40 순서 → O(1) 접근
  if (cell !== curCell) {
    if (curCell) curCell.classList.remove('cur');
    if (cell) cell.classList.add('cur');
    curCell = cell;
  }
}

function setHobong(v) { el.hobong.value = Math.min(HOBONG_MAX, Math.max(HOBONG_MIN, v)); render(); }
function setYears(v) { el.years.value = Math.min(YR_MAX, Math.max(YR_MIN, v)); render(); }

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
  const cur = years >= 10 ? 10 : Math.max(0, years);
  let html = '';
  for (let k = 0; k <= 10; k++) {
    const label = k === 0 ? '1년 미만' : k === 10 ? '10년 이상' : k + '년';
    html += `<tr class="${k === cur ? 'cur' : ''}"><td>${label}</td><td class="amt">${jeonggeunRate(k)}%</td></tr>`;
  }
  el.jgTableBody.innerHTML = html;
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
  renderFn(state().years);
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
}
[el.dlgJg, el.dlgGa].forEach(dlg => {
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // 백드롭 클릭 닫기
  dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
});

/* 결과 요약 텍스트 */
function summaryText() {
  const { hobong, years, promoMonth, tm, r } = state();
  const jgStr = r.jgSplit
    ? r.jeonggeun.map(p => `${p.month}월 ${won(p.amt)}원(${p.hobong}호봉)`).join(' + ')
    : `${won(r.jeonggeun[0].amt)}원(1·7월 각각)`;
  const holStr = r.holSplit
    ? r.holiday.map(p => `${p.label} ${won(p.amt)}원(${p.hobong}호봉)`).join(' + ')
    : `${won(r.holiday[0].amt)}원(설·추석 각각)`;
  const promoStr = promoMonth ? `승급월 ${promoMonth}월(오늘 ${tm}월 기준)` : '승급 미반영';
  return [
    '[교사 수당 계산 · 2026년 기준 · 참고용]',
    `현재 ${hobong}호봉 · 근무연수 ${years}년 · ${promoStr}`,
    `· 정근수당 ${jgStr} (지급률 ${r.rate}%)`,
    `· 정근수당 가산금 ${won(r.gasan)}원/월 (연 ${won(r.gasanYear)}원)`,
    `· 명절휴가비 ${holStr}`,
    `· 연간 합계 ${won(r.annual)}원`,
    '※ 개인 상황에 따라 다를 수 있는 참고용입니다. (인사혁신처 봉급표·공무원수당규정 별표2)',
  ].join('\n');
}

function flash(msg) { el.actMsg.textContent = msg; setTimeout(() => { el.actMsg.textContent = ''; }, 2000); }

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
   화면과 같은 미니멀 톤: 흰 배경 · 얇은 브랜드 액센트 · 초록은 연간 합계에만 · 직인/줄무늬 없음. */
function drawSlip() {
  const { hobong, years, promoMonth, tm, r } = state();
  const dpr = 2, W = 640, H = 452;
  const cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const F = (w, s) => `${w} ${s}px "Pretendard","Malgun Gothic",sans-serif`;      // 본문
  const P = (w, s) => `${w} ${s}px "Paperlogy","Pretendard","Malgun Gothic",sans-serif`; // 디스플레이·숫자
  const INK = '#1a1d1b', SOFT = '#5b6560', FAINT = '#8a938d', BRAND = '#17553b', TINT = '#eef4f0';

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
  const line = (name, amount, unit, note) => {
    ctx.fillStyle = INK; ctx.font = F(600, 17); ctx.textAlign = 'left';
    ctx.fillText(name, 28, y);
    ctx.font = P(700, 22); ctx.textAlign = 'right';
    const suffix = unit ? '  ' + unit : '';
    ctx.fillText(won(amount) + suffix, W - 28, y);
    ctx.fillStyle = FAINT; ctx.font = F(400, 12.5); ctx.textAlign = 'left';
    ctx.fillText(note, 28, y + 20);
    y += 56;
  };
  const jgNote = r.jgSplit
    ? `승급 반영: 1월 ${won(r.jeonggeun[0].amt)}(${r.jeonggeun[0].hobong}호봉) + 7월 ${won(r.jeonggeun[1].amt)}(${r.jeonggeun[1].hobong}호봉)`
    : '월봉급액 × 지급률 · 1월·7월 각각 지급';
  const holNote = r.holSplit
    ? `승급 반영: 설 ${won(r.holiday[0].amt)}(${r.holiday[0].hobong}호봉) + 추석 ${won(r.holiday[1].amt)}(${r.holiday[1].hobong}호봉)`
    : '월봉급액 × 60% · 설·추석 각각 지급';
  line(`정근수당 (연 · ${r.rate}%)`, r.jgSum, '원', jgNote);
  line('정근수당 가산금', r.gasan, '원/월', `근무연수 구간별 정액 · 매월 → 연 ${won(r.gasanYear)}원`);
  line('명절휴가비 (연)', r.holSum, '원', holNote);

  // 연간 합계 — 초록 tint 블록 (시선 집중)
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
  return { cv, hobong, years };
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

el.hobong.addEventListener('input', render);
el.years.addEventListener('input', render);
el.hbMinus.addEventListener('click', () => setHobong(+el.hobong.value - 1));
el.hbPlus.addEventListener('click', () => setHobong(+el.hobong.value + 1));
el.yrMinus.addEventListener('click', () => setYears(+el.years.value - 1));
el.yrPlus.addEventListener('click', () => setYears(+el.years.value + 1));
el.hobongTable.addEventListener('click', e => {
  const cell = e.target.closest('.hb-cell');
  if (cell) setHobong(+cell.dataset.h);
});
el.copyBtn.addEventListener('click', copyResult);
el.pngBtn.addEventListener('click', savePng);
el.jgBtn.addEventListener('click', () => openModal(el.dlgJg, renderJgTable));
el.gaBtn.addEventListener('click', () => openModal(el.dlgGa, renderGaTable));
el.promo.addEventListener('change', render);

renderHobongTable();
render();
