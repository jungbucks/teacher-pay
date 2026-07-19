/* verify.mjs — 봉급표 앵커·단조증가 + 계산 함수 단위 검산. node test/verify.mjs
   규정 값(allowance-rules)을 바꾸면 아래 예시 기대값도 함께 맞출 것. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const src = read('data/salary-2026.js') + '\n' + read('data/allowance-rules.js') + '\n' + read('js/calc.js');
const ctx = vm.runInNewContext(src + ';({SALARY_2026,HOBONG_MIN,HOBONG_MAX,jeonggeunRate,gasangeum,HOLIDAY_RATE,RULES_VERIFIED,computeAll,salaryOf,hobongAtMonth,computeYear})', {});

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const S = ctx.SALARY_2026;
check('봉급표 40호봉 전부 존재', Array.from({ length: 40 }, (_, i) => i + 1).every(h => typeof S[h] === 'number'));
check('호봉 단조증가', Array.from({ length: 39 }, (_, i) => i + 1).every(h => S[h + 1] > S[h]));
check('앵커 9호봉 = 2,495,600', S[9] === 2495600);
check('앵커 40호봉 = 6,205,700', S[40] === 6205700);
check('앵커 1호봉 = 2,041,500', S[1] === 2041500);

// 정근수당 지급률 (2026-07-19 사용자 공식 확인: 10,10,15,20,20,25,30,35,40,45 → 10년이상 50)
check('지급률 표 0~9년 일치', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(y => ctx.jeonggeunRate(y)).join(',') === '10,10,15,20,20,25,30,35,40,45');
check('지급률 10년이상 = 50%', ctx.jeonggeunRate(10) === 50 && ctx.jeonggeunRate(30) === 50);

// 가산금 경계 (2026-07-19 확인, 법 개정: 5년미만도 3만)
check('가산금 4년(5년미만) = 30,000', ctx.gasangeum(4) === 30000);
check('가산금 5년 = 50,000', ctx.gasangeum(5) === 50000);
check('가산금 10년 = 60,000', ctx.gasangeum(10) === 60000);
check('가산금 15년 = 80,000', ctx.gasangeum(15) === 80000);
check('가산금 20~25년 = 110,000(100k+추가10k)', ctx.gasangeum(20) === 110000 && ctx.gasangeum(24) === 110000);
check('가산금 25년이상 = 130,000(100k+추가30k)', ctx.gasangeum(25) === 130000 && ctx.gasangeum(30) === 130000);
check('규정 검수 게이트 열림(RULES_VERIFIED=true)', ctx.RULES_VERIFIED === true);

// 명절휴가비율
check('명절휴가비율 60%', ctx.HOLIDAY_RATE === 0.60);

// 계산 예시: 월봉급 3,000,000 · 근무 10년
const S0 = { salary: 3000000 };
check('정근수당(3,000,000·10년) = 1,500,000', Math.round(S0.salary * 50 / 100) === 1500000);
check('명절휴가비(3,000,000) = 1,800,000', Math.round(S0.salary * ctx.HOLIDAY_RATE) === 1800000);

// computeAll 실제 호봉 예시(20호봉·근무10년)
const r = ctx.computeAll(20, 10);
check('computeAll 20호봉 salary=3,481,000', r.salary === 3481000);
check('computeAll 연합계 = 정근×2+가산×12+명절×2',
  r.annual === r.jeonggeun * 2 + ctx.gasangeum(10) * 12 + r.holiday * 2);

// ── 호봉 승급월 반영 (hobongAtMonth) ──
// 사용자 예시: 오늘 7월·20호봉·8월 승급 → 1·7월=20호봉, 9월(추석)=21호봉
check('승급 hobongAtMonth 8월승급 오늘7월: 1월=20', ctx.hobongAtMonth(1, 20, 8, 7) === 20);
check('승급 hobongAtMonth 8월승급 오늘7월: 7월=20', ctx.hobongAtMonth(7, 20, 8, 7) === 20);
check('승급 hobongAtMonth 8월승급 오늘7월: 9월=21', ctx.hobongAtMonth(9, 20, 8, 7) === 21);
// 3월 승급, 오늘 7월(이미 승급 지남): 승급 전(1·2월)=19, 승급 후=20
check('승급 hobongAtMonth 3월승급 오늘7월: 1월=19', ctx.hobongAtMonth(1, 20, 3, 7) === 19);
check('승급 hobongAtMonth 3월승급 오늘7월: 9월=20', ctx.hobongAtMonth(9, 20, 3, 7) === 20);
check('승급 미반영(null)이면 호봉 불변', ctx.hobongAtMonth(1, 20, null, 7) === 20);

// ── computeYear ──
const y0 = ctx.computeYear(20, 10, null, 7);  // 승급 미반영 → computeAll과 동일 연합
check('computeYear 미반영 = 정근×2+가산×12+명절×2', y0.annual === 8378200 && !y0.jgSplit && !y0.holSplit);
const y8 = ctx.computeYear(20, 10, 8, 7);      // 8월 승급: 추석만 21호봉으로 갈림
check('computeYear 8월승급: 명절만 분할', y8.jgSplit === false && y8.holSplit === true);
check('computeYear 8월승급 추석=21호봉', y8.holiday[1].hobong === 21 && y8.holiday[1].amt === Math.round(3600700 * 0.6));
check('computeYear 8월승급 연합계 = 8,450,020', y8.annual === 8450020);
const y3 = ctx.computeYear(20, 10, 3, 7);      // 3월 승급(오늘7월): 1·2월=19, 이후=20 → 정근·명절 둘 다 분할
check('computeYear 3월승급: 정근·명절 분할', y3.jgSplit === true && y3.holSplit === true);
check('computeYear 3월승급 1월 정근 = 19호봉분', y3.jeonggeun[0].hobong === 19 && y3.jeonggeun[0].amt === Math.round(3361200 * 0.5));
check('computeYear 3월승급 연합계 = 8,246,420', y3.annual === 8246420);

console.log(fail === 0 ? '== 전체 PASS ==' : `== FAIL ${fail}건 ==`);
process.exit(fail === 0 ? 0 : 1);
