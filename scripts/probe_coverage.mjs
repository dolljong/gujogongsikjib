// LaTeX→계산식 변환 커버리지 측정. node에서 실행.
//   node scripts/probe_coverage.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { create, all } from "../app/node_modules/mathjs/lib/esm/index.js";
import { parseLatexFormula } from "../app/src/calc/latex.js";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(__dir);
const math = create(all, {});
const data = JSON.parse(
  fs.readFileSync(path.join(ROOT, "app/src/data/formulas.json"), "utf-8"),
);

const KNOWN = new Set(["pi", "e", "PI", "E", "tau", "phi", "true", "false"]);
function freeVars(expr) {
  const syms = new Set();
  const node = math.parse(expr);
  node.traverse((n, _p, parent) => {
    if (n.isSymbolNode) {
      // 함수 호출의 함수명 제외
      if (parent && parent.isFunctionNode && parent.fn === n) return;
      if (KNOWN.has(n.name)) return;
      if (typeof math[n.name] === "function") return;
      syms.add(n.name);
    }
  });
  return [...syms];
}

let totalEq = 0, transpiled = 0, evaluated = 0;
const failTranspile = {};
const failEval = {};
const catStat = {};

for (const c of data) {
  const cs = (catStat[c.category] ??= { eq: 0, ev: 0 });
  for (const r of c.results) {
    if (!r.latex) continue;
    const eqs = parseLatexFormula(r.latex);
    for (const eq of eqs) {
      totalEq++;
      cs.eq++;
      if (eq.error || !eq.expr) {
        const key = (eq.error || "no-expr").slice(0, 40);
        failTranspile[key] = (failTranspile[key] || 0) + 1;
        continue;
      }
      transpiled++;
      try {
        const vars = freeVars(eq.expr);
        const scope = {};
        for (const v of vars) scope[v] = 2.0; // 샘플값
        const val = math.evaluate(eq.expr, scope);
        const num = typeof val === "object" && val && "re" in val ? NaN : Number(val);
        if (Number.isFinite(num)) {
          evaluated++;
          cs.ev++;
        } else {
          failEval["비유한값"] = (failEval["비유한값"] || 0) + 1;
        }
      } catch (e) {
        const key = String(e.message || e).slice(0, 45);
        failEval[key] = (failEval[key] || 0) + 1;
      }
    }
  }
}

const pct = (a, b) => ((100 * a) / b).toFixed(1) + "%";
console.log("=== 커버리지 ===");
console.log(`전체 방정식      : ${totalEq}`);
console.log(`  변환 성공      : ${transpiled}  (${pct(transpiled, totalEq)})`);
console.log(`  변환+평가 성공 : ${evaluated}  (${pct(evaluated, totalEq)})`);

console.log("\n=== 카테고리별 평가성공/전체 ===");
for (const [k, v] of Object.entries(catStat)) {
  console.log(`  ${pct(v.ev, v.eq).padStart(6)}  (${v.ev}/${v.eq})  ${k}`);
}

const top = (obj, n) =>
  Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
console.log("\n=== 변환 실패 사유 top ===");
for (const [k, v] of top(failTranspile, 15)) console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log("\n=== 평가 실패 사유 top ===");
for (const [k, v] of top(failEval, 15)) console.log(`  ${String(v).padStart(4)}  ${k}`);
