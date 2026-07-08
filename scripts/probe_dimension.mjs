// 변수설명 → 차원 분류 커버리지 리포트. node에서 실행.
//   node scripts/probe_dimension.mjs           요약
//   node scripts/probe_dimension.mjs --unknown  미분류 입력변수 목록
//   node scripts/probe_dimension.mjs --all       전 입력변수 분류 나열
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { create, all } from "../app/node_modules/mathjs/lib/esm/index.js";
import { parseLatexFormula } from "../app/src/calc/latex.js";
import { buildDimensionMap, canonSym } from "../app/src/calc/dimension.js";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(__dir);
const math = create(all, {});
const data = JSON.parse(
  fs.readFileSync(path.join(ROOT, "app/src/data/formulas.json"), "utf-8"),
);
const mode = process.argv[2] || "";

const KNOWN = new Set(["pi", "PI"]);
function freeVars(expr) {
  const syms = new Set();
  try {
    const node = math.parse(expr);
    node.traverse((n, _p, parent) => {
      if (n.isSymbolNode) {
        if (parent && parent.isFunctionNode && parent.fn === n) return;
        if (KNOWN.has(n.name)) return;
        if (typeof math[n.name] === "function") return;
        syms.add(n.name);
      }
    });
  } catch {
    /* skip */
  }
  return [...syms];
}

// 케이스 입력변수 집합(= 자유변수 − 다른 식의 출력기호). evaluate.ts 로직 축약.
function caseInputs(c) {
  const outputs = new Set();
  const eqs = [];
  for (const r of c.results) {
    for (const eq of parseLatexFormula(r.latex)) {
      if (!eq.expr || eq.error) continue;
      const vars = freeVars(eq.expr);
      eqs.push(vars);
      for (const o of eq.outputs) outputs.add(canonSym(o));
    }
  }
  const inputs = new Set();
  for (const vars of eqs) {
    for (const v of vars) if (!outputs.has(v)) inputs.add(v);
  }
  return [...inputs];
}

const dimCount = {};
const unknownList = []; // {id, sym}
const allList = [];
let totalInputs = 0, classified = 0;

for (const c of data) {
  const dimMap = buildDimensionMap(c);
  for (const v of caseInputs(c)) {
    totalInputs++;
    const dim = dimMap.get(v) || "unknown";
    dimCount[dim] = (dimCount[dim] || 0) + 1;
    if (dim !== "unknown") classified++;
    if (dim === "unknown") unknownList.push({ id: c.id, sym: v });
    allList.push({ id: c.id, sym: v, dim });
  }
}

const pct = (a, b) => ((100 * a) / b).toFixed(1) + "%";

if (mode === "--unknown") {
  // 미분류 기호를 빈도순으로
  const byS = {};
  for (const u of unknownList) (byS[u.sym] ??= []).push(u.id);
  const rows = Object.entries(byS).sort((a, b) => b[1].length - a[1].length);
  console.log(`=== 미분류 입력변수 (${unknownList.length}건, 기호 ${rows.length}종) ===`);
  for (const [sym, ids] of rows) {
    console.log(`  ${String(ids.length).padStart(3)}  ${sym.padEnd(12)}  예: ${ids.slice(0, 6).join(", ")}`);
  }
} else if (mode === "--all") {
  for (const a of allList) console.log(`${a.id.padEnd(10)} ${a.sym.padEnd(12)} ${a.dim}`);
} else {
  console.log("=== 차원 분류 커버리지 ===");
  console.log(`전체 입력변수(케이스별) : ${totalInputs}`);
  console.log(`  분류 성공            : ${classified}  (${pct(classified, totalInputs)})`);
  console.log(`  미분류(unknown)      : ${totalInputs - classified}  (${pct(totalInputs - classified, totalInputs)})`);
  console.log("\n=== 차원별 분포 ===");
  for (const [k, v] of Object.entries(dimCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}  ${pct(v, totalInputs).padStart(6)}  ${k}`);
  }
  console.log("\n(미분류 목록: --unknown, 전체 나열: --all)");
}
