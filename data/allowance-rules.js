/* [데이터·교체 지점] 수당 규정 값 — ★ 정근수당 지급률·가산금은 사용자(교사)가 공식 법령(공무원수당 등에 관한 규정 별표2) 확인 후 확정 예정.
   여기 값만 바꾸면 계산 전체가 반영됨. 규칙을 바꾸면 test/verify.mjs의 예시 검산도 함께 맞출 것.
   ─ 현재 값의 근거 ─
   · 정근수당 지급률: 별표2의 장기 고정 표(1년미만 0% → 10년이상 50%, 1년마다 5%p). 확신도 높음이나 사용자 확인 예정.
   · 정근수당 가산금: 블로그 출처가 상충 → ⚠️ 사용자 공식 확인 필수. 아래는 널리 쓰이는 공식형(잠정).
   · 명절휴가비: 월봉급액의 60%(설·추석 각각). 확신도 높음. */

/* 정근수당 지급률(%) — 근무연수(정수)로 조회. 1년미만은 years=0으로 취급. */
function jeonggeunRate(years) {
  if (years < 1) return 0;
  if (years >= 10) return 50;
  return years * 5; // 1년 5% … 9년 45%
}

/* 정근수당 가산금(원/월) — 근무연수 구간별 정액 + 추가가산금. ⚠️ 공식 별표2로 확정 예정. */
function gasangeum(years) {
  let base;
  if (years < 5) base = 0;
  else if (years < 10) base = 50000;
  else if (years < 15) base = 60000;
  else if (years < 20) base = 80000;
  else base = 100000;
  let extra = 0; // 추가가산금
  if (years >= 25) extra = 30000;
  else if (years >= 20) extra = 10000;
  return base + extra;
}

/* 명절휴가비율 — 월봉급액 대비. 설·추석 각각 지급. */
const HOLIDAY_RATE = 0.60;

/* 이 규정 값이 사용자 공식 검수를 통과했는지 표시(배포 게이트). 검수 완료 시 true로. */
const RULES_VERIFIED = false;

if (typeof module !== 'undefined') module.exports = { jeonggeunRate, gasangeum, HOLIDAY_RATE, RULES_VERIFIED };
