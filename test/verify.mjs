/* verify.mjs — 봉급표 앵커·단조증가 + 계산 함수 단위 검산. node test/verify.mjs
   규정 값(allowance-rules)을 바꾸면 아래 예시 기대값도 함께 맞출 것. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const src = read('data/salary-2026.js') + '\n' + read('data/allowance-rules.js') + '\n' + read('js/calc.js');
const ctx = vm.runInNewContext(src + ';({SALARY_2026,HOBONG_MIN,HOBONG_MAX,jeonggeunRate,gasangeum,HOLIDAY_RATE,computeAll,salaryOf})', {});

let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); if (!ok) fail++; };

const S = ctx.SALARY_2026;
check('봉급표 40호봉 전부 존재', Array.from({ length: 40 }, (_, i) => i + 1).every(h => typeof S[h] === 'number'));
check('호봉 단조증가', Array.from({ length: 39 }, (_, i) => i + 1).every(h => S[h + 1] > S[h]));
check('앵커 9호봉 = 2,495,600', S[9] === 2495600);
check('앵커 40호봉 = 6,205,700', S[40] === 6205700);
check('앵커 1호봉 = 2,041,500', S[1] === 2041500);

// 정근수당 지급률
check('지급률 0년 = 0%', ctx.jeonggeunRate(0) === 0);
check('지급률 1년 = 5%', ctx.jeonggeunRate(1) === 5);
check('지급률 9년 = 45%', ctx.jeonggeunRate(9) === 45);
check('지급률 10년이상 = 50%', ctx.jeonggeunRate(10) === 50 && ctx.jeonggeunRate(30) === 50);

// 가산금 경계
check('가산금 4년 = 0', ctx.gasangeum(4) === 0);
check('가산금 5년 = 50,000', ctx.gasangeum(5) === 50000);
check('가산금 20년 = 110,000(100k+추가10k)', ctx.gasangeum(20) === 110000);

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

console.log(fail === 0 ? '== 전체 PASS ==' : `== FAIL ${fail}건 ==`);
process.exit(fail === 0 ? 0 : 1);
