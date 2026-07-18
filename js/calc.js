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

if (typeof module !== 'undefined') module.exports = { salaryOf, jeonggeunPay, holidayPay, annualTotal, computeAll };
