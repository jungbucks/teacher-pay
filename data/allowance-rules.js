/* [데이터·교체 지점] 수당 규정 값 — 여기 값만 바꾸면 계산 전체가 반영됨. 규칙을 바꾸면 test/verify.mjs 예시도 함께 맞출 것.
   ─ 근거 ─
   · 정근수당 지급률: 「공무원수당 등에 관한 규정」 별표2 <개정 2025. 1. 3.> 원문 대조(2026-11-02, law.go.kr 별표 PDF).
       2년 미만 10 / 5년 미만 20 / 6년 미만 25 / 7년 미만 30 / 8년 미만 35 / 9년 미만 40 / 10년 미만 45 / 10년 이상 50.
       → 근무연수 N년(정수): 0·1년 10 / 2~4년 20 / 5년 25 / 6년 30 / 7년 35 / 8년 40 / 9년 45 / 10년이상 50.
       ※ 2026-07-19판의 "2년 15%"는 개정 전 값이었음(2025.1.3 개정으로 2년 이상 5년 미만 20%).
   · 정근수당 가산금: 사용자 공식 확인(2026-07-19, 법 개정 반영). 5년미만 3만 / 5년~ 5만 / 10년~ 6만 / 15년~ 8만 / 20년~ 10만.
     ※ "5년 미만 미지급"은 개정 전 옛 표. 현행은 5년 미만도 3만원.
     ※ 추가가산금(2026-07-19 확인): 20년이상 25년미만 +10,000 / 25년이상 +30,000 (기본액 위에 가산).
   · 명절휴가비: 월봉급액의 60%(설·추석 각각). */

/* 정근수당 지급률 구간 — 계산(jeonggeunRate)과 연차별 모달 표가 함께 쓰는 단일 데이터.
   lo~hi = 근무연수(정수, 만 년). hi=Infinity는 "이상". */
const JG_RATE_TIERS = [
  { lo: 0, hi: 1, rate: 10, label: '1년 미만 ~ 1년' },
  { lo: 2, hi: 4, rate: 20, label: '2년 ~ 4년' },
  { lo: 5, hi: 5, rate: 25, label: '5년' },
  { lo: 6, hi: 6, rate: 30, label: '6년' },
  { lo: 7, hi: 7, rate: 35, label: '7년' },
  { lo: 8, hi: 8, rate: 40, label: '8년' },
  { lo: 9, hi: 9, rate: 45, label: '9년' },
  { lo: 10, hi: Infinity, rate: 50, label: '10년 이상' },
];

/* 근무연수가 속한 지급률 구간 */
function jeonggeunTier(years) {
  const y = Math.max(0, Math.floor(years) || 0);
  return JG_RATE_TIERS.find(t => y >= t.lo && y <= t.hi) || JG_RATE_TIERS[JG_RATE_TIERS.length - 1];
}

/* 정근수당 지급률(%) — 근무연수(정수)로 조회. */
function jeonggeunRate(years) {
  return jeonggeunTier(years).rate;
}

/* 정근수당 가산금(원/월) — 근무연수 구간별 기본액 + 추가가산금(근속). */
function gasangeum(years) {
  let base;
  if (years < 5) base = 30000;
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

/* 이 규정 값이 사용자 공식 검수를 통과했는지 표시(배포 게이트). 검수 완료 시 true로.
   2026-07-19 사용자(교사) 공식 법령 확인 완료 — 지급률·가산금·추가가산금·명절 전부 확정.
   2026-11-02 정근수당 지급률을 별표2(2025.1.3 개정) 원문과 대조해 2년 15%→20% 정정(사용자 지시서 + 법령 PDF 일치). */
const RULES_VERIFIED = true;

if (typeof module !== 'undefined') module.exports = { JG_RATE_TIERS, jeonggeunTier, jeonggeunRate, gasangeum, HOLIDAY_RATE, RULES_VERIFIED };
