/* [로직] 순수 계산 — 데이터(salary·rules)만 읽고 DOM은 모름. verify가 단위 검산. */

function salaryOf(hobong) {
  return SALARY_2026[hobong] || 0;
}

/* 정근수당 1회분(1월 또는 7월) = 월봉급액 × 지급률 */
function jeonggeunPay(salary, years) {
  return Math.round(salary * jeonggeunRate(years) / 100);
}

/* 명절휴가비 1회분(설 또는 추석) = 월봉급액 × 60% */
function holidayPay(salary) {
  return Math.round(salary * HOLIDAY_RATE);
}

/* 연간 합계 = 정근수당×2(1·7월) + 가산금×12(매월) + 명절휴가비×2(설·추석) */
function annualTotal(salary, years) {
  return jeonggeunPay(salary, years) * 2 + gasangeum(years) * 12 + holidayPay(salary) * 2;
}

/* 화면·검산이 함께 쓰는 요약 객체 */
function computeAll(hobong, years) {
  const salary = salaryOf(hobong);
  return {
    salary,
    jeonggeunRate: jeonggeunRate(years),
    jeonggeun: jeonggeunPay(salary, years),
    gasangeum: gasangeum(years),
    holiday: holidayPay(salary),
    annual: annualTotal(salary, years),
  };
}

/* ── 호봉 승급월 반영 ──
   교사 호봉은 1년에 한 번 '승급월'에 +1. 승급월 전 지급분은 옛 호봉, 승급월부터는 오른 호봉.
   curHobong = 오늘 기준 호봉, promoMonth = 승급월(1~12; falsy면 미반영), todayMonth = 오늘 월(1~12).
   오늘이 이미 승급월을 지났으면 → 승급월 이전 지급분은 curHobong-1(그땐 아직 안 올랐으므로). */
function hobongAtMonth(m, curHobong, promoMonth, todayMonth) {
  if (!promoMonth) return curHobong;
  const beforeBase = (todayMonth >= promoMonth) ? curHobong - 1 : curHobong;
  const hb = (m >= promoMonth) ? beforeBase + 1 : beforeBase;
  return Math.min(HOBONG_MAX, Math.max(HOBONG_MIN, hb));
}

/* 승급월·오늘을 반영한 '올해(1~12월)' 지급 내역.
   정근수당=1·7월, 명절휴가비=설(2월)·추석(9월) 근사, 가산금=매월(호봉 무관). */
function computeYear(hobong, years, promoMonth, todayMonth) {
  const rate = jeonggeunRate(years);
  const pay = (m, rateOrHoliday) => {
    const hb = hobongAtMonth(m, hobong, promoMonth, todayMonth);
    const salary = salaryOf(hb);
    const amt = rateOrHoliday === 'H' ? Math.round(salary * HOLIDAY_RATE) : Math.round(salary * rate / 100);
    return { month: m, hobong: hb, salary, amt };
  };
  const jeonggeun = [pay(1), pay(7)];
  const holiday = [{ ...pay(2, 'H'), label: '설' }, { ...pay(9, 'H'), label: '추석' }];
  const gasan = gasangeum(years);
  const jgSum = jeonggeun[0].amt + jeonggeun[1].amt;
  const holSum = holiday[0].amt + holiday[1].amt;
  return {
    rate, hobong, years, promoMonth, todayMonth,
    jeonggeun, holiday, gasan, gasanYear: gasan * 12,
    jgSum, holSum,
    jgSplit: jeonggeun[0].hobong !== jeonggeun[1].hobong,
    holSplit: holiday[0].hobong !== holiday[1].hobong,
    annual: jgSum + gasan * 12 + holSum,
  };
}

if (typeof module !== 'undefined') module.exports = { salaryOf, jeonggeunPay, holidayPay, annualTotal, computeAll, hobongAtMonth, computeYear };
