// 정확성 스팟체크: 알려진 공식이 손계산과 맞는지.
import { create, all } from "../app/node_modules/mathjs/lib/esm/index.js";
import { latexExprToMath } from "../app/src/calc/latex.js";
const math = create(all, {});

const cases = [
  // [설명, LaTeX 우변, 변수, 기대값]
  ["캔틸레버 끝하중 M_B=-Pl", "-P l", { P: 10, l: 3 }, -30],
  ["캔틸레버 끝하중 δ_max=Pl³/3EI", "\\frac{P l^{3}}{3 E I}", { P: 10, l: 3, E: 200, I: 4 }, (10 * 27) / (3 * 200 * 4)],
  ["등분포 M_B=-wl²/2", "-\\frac{w l^{2}}{2}", { w: 5, l: 4 }, -40],
  ["단순보 중앙하중 M_max=Pl/4", "\\frac{P l}{4}", { P: 8, l: 6 }, 12],
  ["단순보 등분포 δ=5wl⁴/384EI", "\\frac{5 w l^{4}}{384 E I}", { w: 2, l: 3, E: 100, I: 5 }, (5 * 2 * 81) / (384 * 100 * 5)],
  ["제곱근", "\\sqrt{a^{2}+b^{2}}", { a: 3, b: 4 }, 5],
  ["삼각함수 sin(pi/6)", "\\sin\\frac{\\pi}{6}", {}, 0.5],
  ["괄호 곱 P(x-a)", "-P(x-a)", { P: 2, x: 5, a: 1 }, -8],
];

let ok = 0;
for (const [desc, tex, vars, expect] of cases) {
  try {
    const expr = latexExprToMath(tex);
    const got = math.evaluate(expr, { ...vars });
    const pass = Math.abs(got - expect) < 1e-9;
    ok += pass;
    console.log(`${pass ? "OK  " : "FAIL"}  ${desc}`);
    console.log(`      tex=${tex}`);
    console.log(`      expr=${expr}  →  ${got}  (기대 ${expect})`);
  } catch (e) {
    console.log(`ERR   ${desc}: ${e.message}`);
    console.log(`      tex=${tex}`);
  }
}
console.log(`\n${ok}/${cases.length} 통과`);
