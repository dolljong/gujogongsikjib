import fs from "node:fs";
import { parseLatexFormula } from "../app/src/calc/latex.js";
const data = JSON.parse(fs.readFileSync("app/src/data/formulas.json","utf-8"));
const id = process.argv[2] || "1.6.2";
const c = data.find(c => c.id===id);
if(!c){console.log("없음:",id);process.exit()}
console.log("id",c.id,"| category",c.category,"| results",c.results.length);
for (const r of c.results) {
  console.log(`\n[결과] name=${JSON.stringify(r.name)}`);
  console.log(`  latex=${JSON.stringify(r.latex)}`);
  const eqs = parseLatexFormula(r.latex);
  for (const e of eqs) console.log(`   out=${JSON.stringify(e.outputs)} expr=${e.expr} err=${e.error}`);
}
