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
};

const YR_MIN = 0, YR_MAX = 45;

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
  el.hobongTable.querySelectorAll('.hb-cell').forEach(c => c.classList.toggle('cur', +c.dataset.h === hobong));
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

/* 명세서를 canvas에 직접 그려 PNG로 저장 (라이브러리 없음) */
function drawSlip() {
  const { hobong, years, r } = state();
  const dpr = 2, W = 640, H = 470;
  const cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const F = (w, s) => `${w} ${s}px "Pretendard","Malgun Gothic",sans-serif`;
  const M = (w, s) => `${w} ${s}px "Consolas","D2Coding",monospace`;

  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#17553b'; ctx.fillRect(0, 0, W, 54);
  ctx.textBaseline = 'middle'; ctx.fillStyle = '#eef4ee';
  ctx.font = F(800, 22); ctx.textAlign = 'left'; ctx.fillText('급여 참고 명세서', 28, 28);
  ctx.font = F(700, 13); ctx.textAlign = 'right'; ctx.fillStyle = '#bfe0cd';
  ctx.fillText('2026 · 세전 · 참고용', W - 28, 28);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#46564b'; ctx.font = F(700, 14); ctx.textAlign = 'left';
  ctx.fillText(`근무연수 ${years}년 · ${hobong}호봉 (월봉급 ${won(r.salary)}원)`, 28, 84);

  let y = 124;
  const line = (name, amount, note) => {
    ctx.fillStyle = '#202a23'; ctx.font = F(700, 18); ctx.textAlign = 'left';
    ctx.fillText(name, 28, y);
    ctx.fillStyle = '#1f6b4a'; ctx.font = M(700, 22); ctx.textAlign = 'right';
    ctx.fillText(won(amount) + '원', W - 28, y);
    ctx.fillStyle = '#6c7a6f'; ctx.font = F(400, 12.5); ctx.textAlign = 'left';
    ctx.fillText(note, 28, y + 20);
    y += 58;
  };
  line(`정근수당 (${r.jeonggeunRate}%)`, r.jeonggeun, '월봉급액 × 지급률 · 1월·7월 각각 지급');
  line('정근수당 가산금', r.gasangeum, `근무연수 구간별 정액 · 매월 → 연 ${won(r.gasangeum * 12)}원`);
  line('명절휴가비', r.holiday, '월봉급액 × 60% · 설·추석 각각 지급');

  ctx.strokeStyle = '#8fa08c'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(28, y - 26); ctx.lineTo(W - 28, y - 26); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(28, y - 22); ctx.lineTo(W - 28, y - 22); ctx.stroke();

  ctx.fillStyle = '#202a23'; ctx.font = F(900, 20); ctx.textAlign = 'left';
  ctx.fillText('연간 합계', 28, y + 6);
  ctx.font = M(700, 26); ctx.textAlign = 'right';
  ctx.fillText(won(r.annual) + '원', W - 28, y + 8);
  ctx.fillStyle = '#6c7a6f'; ctx.font = F(400, 12); ctx.textAlign = 'left';
  ctx.fillText('정근수당 ×2 + 가산금 ×12 + 명절휴가비 ×2', 28, y + 30);

  // 참고 직인
  ctx.save();
  ctx.translate(W - 88, H - 92); ctx.rotate(-11 * Math.PI / 180);
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 27, 0, 2 * Math.PI); ctx.stroke();
  ctx.fillStyle = '#c0392b'; ctx.font = F(900, 15); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('참고', 0, 0);
  ctx.restore();

  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#6c7a6f'; ctx.font = F(400, 11.5); ctx.textAlign = 'left';
  ctx.fillText('출처: 인사혁신처 2026 공무원봉급표 · 공무원수당규정(별표2) · 개인 상황에 따라 다를 수 있는 참고용', 28, H - 18);
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

renderHobongTable();
render();
