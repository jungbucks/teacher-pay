/* app.js — 입력을 계산에 묶고 급여대장에 live 렌더. 계산은 calc.js에 위임. */
const won = n => n.toLocaleString('ko-KR');

const el = {
  hobong: document.getElementById('hobong'),
  hobongVal: document.getElementById('hobongVal'),
  hbMinus: document.getElementById('hbMinus'),
  hbPlus: document.getElementById('hbPlus'),
  years: document.getElementById('years'),
  salaryVal: document.getElementById('salaryVal'),
  rateTag: document.getElementById('rateTag'),
  jeonggeun: document.getElementById('jeonggeun'),
  gasan: document.getElementById('gasan'),
  gasanFlag: document.getElementById('gasanFlag'),
  holiday: document.getElementById('holiday'),
  annual: document.getElementById('annual'),
};

function tick(node, text) {
  if (node.textContent === text) return;
  node.textContent = text;
  node.classList.remove('tick');
  void node.offsetWidth; // reflow → 애니 재시작
  node.classList.add('tick');
}

function render() {
  const hobong = Math.min(HOBONG_MAX, Math.max(HOBONG_MIN, +el.hobong.value || HOBONG_MIN));
  const years = Math.max(0, Math.min(45, +el.years.value || 0));
  const r = computeAll(hobong, years);

  el.hobongVal.textContent = hobong;
  el.salaryVal.textContent = won(r.salary);
  el.rateTag.textContent = r.jeonggeunRate + '%';
  tick(el.jeonggeun, won(r.jeonggeun));
  tick(el.gasan, won(r.gasangeum));
  tick(el.holiday, won(r.holiday));
  tick(el.annual, won(r.annual));
  el.gasanFlag.hidden = RULES_VERIFIED;
}

function setHobong(v) {
  el.hobong.value = Math.min(HOBONG_MAX, Math.max(HOBONG_MIN, v));
  render();
}

el.hobong.addEventListener('input', render);
el.years.addEventListener('input', render);
el.hbMinus.addEventListener('click', () => setHobong(+el.hobong.value - 1));
el.hbPlus.addEventListener('click', () => setHobong(+el.hobong.value + 1));
render();
