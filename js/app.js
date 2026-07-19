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
  rateTag: document.getElementById('rateTag'),
  jeonggeun: document.getElementById('jeonggeun'),
  gasan: document.getElementById('gasan'),
  gasanYear: document.getElementById('gasanYear'),
  gasanFlag: document.getElementById('gasanFlag'),
  holiday: document.getElementById('holiday'),
  annual: document.getElementById('annual'),
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

function state() {
  const hobong = Math.min(HOBONG_MAX, Math.max(HOBONG_MIN, +el.hobong.value || HOBONG_MIN));
  const years = Math.max(YR_MIN, Math.min(YR_MAX, +el.years.value || 0));
  return { hobong, years, r: computeAll(hobong, years) };
}

function render() {
  const { hobong, years, r } = state();
  el.yearsVal.textContent = years;
  el.hobongVal.textContent = hobong;
  el.salaryVal.textContent = won(r.salary);
  el.rateTag.textContent = r.jeonggeunRate + '%';
  tick(el.jeonggeun, won(r.jeonggeun));
  tick(el.gasan, won(r.gasangeum));
  el.gasanYear.textContent = won(r.gasangeum * 12);
  tick(el.holiday, won(r.holiday));
  tick(el.annual, won(r.annual));
  el.gasanFlag.hidden = RULES_VERIFIED;
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

/* 시그니처: 월별 수당 지급 타임라인 — 표시 전용(계산과 무관, 정적 구조).
   정근수당 1·7월 / 명절휴가비 설·추석(대표월 2·9월 근사) / 가산금 매월. */
function renderTimeline() {
  const track = document.getElementById('timeline');
  if (!track) return;
  const JG = [1, 7];              // 정근수당
  const HOL = { 2: '설', 9: '추석' }; // 명절휴가비(대표월 근사)
  let html = '';
  for (let m = 1; m <= 12; m++) {
    let dot = '';
    if (JG.includes(m)) dot = `<i class="tl-dot jg" title="${m}월 정근수당"></i>`;
    else if (HOL[m]) dot = `<i class="tl-dot hol" title="${HOL[m]} 명절휴가비(대표월)"></i>`;
    const event = dot ? ' event' : '';
    html += `<div class="tl-cell${event}"><span class="tl-slot">${dot}</span><span class="tl-seg"></span><span class="tl-mon">${m}</span></div>`;
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
  const { hobong, years, r } = state();
  return [
    '[교사 수당 계산 · 2026년 기준 · 참고용]',
    `근무연수 ${years}년 · ${hobong}호봉 (월봉급 ${won(r.salary)}원)`,
    `· 정근수당 ${won(r.jeonggeun)}원 (지급률 ${r.jeonggeunRate}%, 1·7월 각각)`,
    `· 정근수당 가산금 ${won(r.gasangeum)}원/월 (연 ${won(r.gasangeum * 12)}원)`,
    `· 명절휴가비 ${won(r.holiday)}원 (설·추석 각각)`,
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
  const { hobong, years, r } = state();
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
  ctx.fillText(`근무연수 ${years}년 · ${hobong}호봉 (월봉급 ${won(r.salary)}원)`, 28, 80);

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
  line(`정근수당 (${r.jeonggeunRate}%)`, r.jeonggeun, '원', '월봉급액 × 지급률 · 1월·7월 각각 지급');
  line('정근수당 가산금', r.gasangeum, '원/월', `근무연수 구간별 정액 · 매월 → 연 ${won(r.gasangeum * 12)}원`);
  line('명절휴가비', r.holiday, '원', '월봉급액 × 60% · 설·추석 각각 지급');

  // 연간 합계 — 초록 tint 블록 (시선 집중)
  y += 4;
  ctx.fillStyle = TINT; ctx.fillRect(28, y, W - 56, 60);
  ctx.fillStyle = BRAND; ctx.font = P(700, 18); ctx.textAlign = 'left';
  ctx.fillText('연간 합계', 46, y + 32);
  ctx.fillStyle = SOFT; ctx.font = F(500, 11.5);
  ctx.fillText('정근수당 ×2 + 가산금 ×12 + 명절휴가비 ×2', 46, y + 48);
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

renderHobongTable();
renderTimeline();
render();
