// 케이스의 결과 LaTeX들을 계산 가능한 방정식 목록으로 정리하고,
// 입력 변수들을 모아 평가한다. (Phase 2 계산기)
import { create, all, type MathJsInstance } from "mathjs";
import { parseLatexFormula, cleanSymbol, type Equation } from "./latex.js";
import { extractSymbol } from "./symbols";
import type { Case } from "../types";

const math: MathJsInstance = create(all, {});

// π만 진짜 상수. mathjs는 E(오일러수)·e·phi(황금비)·tau(2π)도 상수로 알지만,
// 구조공식에선 E=탄성계수, e=편심, φ·τ=각/응력 → 전부 입력변수로 취급해야 한다.
const KNOWN = new Set(["pi", "PI"]);

/** expr 문자열에서 자유변수(입력 후보) 추출. 함수명·상수 제외. */
export function freeVars(expr: string): string[] {
  const syms = new Set<string>();
  try {
    const node = math.parse(expr);
    node.traverse((n: any, _path: string, parent: any) => {
      if (n.isSymbolNode) {
        if (parent && parent.isFunctionNode && parent.fn === n) return;
        if (KNOWN.has(n.name)) return;
        if (typeof (math as any)[n.name] === "function") return;
        syms.add(n.name);
      }
    });
  } catch {
    /* 파싱 실패 → 변수 없음 취급 */
  }
  return [...syms];
}

export interface CalcEquation extends Equation {
  vars: string[]; // 이 식이 필요로 하는 자유변수
  computable: boolean;
}

export interface CalcModel {
  equations: CalcEquation[];
  inputs: string[]; // 케이스 전체에서 모은 입력 변수(정렬)
  outputSymbols: Set<string>; // 다른 식의 결과이기도 한 기호
}

/** 케이스 → 계산 모델. 결과별 LaTeX를 파싱해 방정식과 입력변수 집합을 만든다. */
export function buildCalcModel(c: Case): CalcModel {
  const equations: CalcEquation[] = [];
  const outputSymbols = new Set<string>();

  const seen = new Set<string>();
  for (const r of c.results) {
    // 등호 없는 공식(단면성능 등)은 출력기호가 name에 있음 → 뽑아서 채운다.
    const nameSym = r.name ? extractSymbol(r.name) : null;
    for (const eq of parseLatexFormula(r.latex)) {
      if (eq.outputs.length === 0 && nameSym) {
        eq.outputs = nameSym.split(",").map((s) => s.trim()).filter(Boolean);
        eq.primary = cleanSymbol(eq.outputs[0]);
      }
      // 여러 결과행에서 같은 식이 반복될 때(예: k 정의) 한 번만.
      const sig = eq.outputs.join("|") + "=" + eq.exprLatex;
      if (seen.has(sig)) continue;
      seen.add(sig);
      const vars = eq.expr ? freeVars(eq.expr) : [];
      equations.push({ ...eq, vars, computable: !!eq.expr && !eq.error });
      for (const o of eq.outputs) outputSymbols.add(cleanOut(o));
    }
  }

  // 입력 = 모든 식의 자유변수 합집합에서, "다른 식의 출력기호"는 제외.
  const inputSet = new Set<string>();
  for (const eq of equations) {
    if (!eq.computable) continue;
    for (const v of eq.vars) {
      if (!outputSymbols.has(v)) inputSet.add(v);
    }
  }
  const inputs = [...inputSet].sort(varSort);
  return { equations, inputs, outputSymbols };
}

/** 주어진 입력값으로 한 방정식 평가. */
export function evalEquation(
  eq: CalcEquation,
  scope: Record<string, number>,
): { value: number | null; error: string | null } {
  if (!eq.expr) return { value: null, error: eq.error };
  try {
    const v = math.evaluate(eq.expr, scope);
    const num = Number(v);
    if (!Number.isFinite(num)) return { value: null, error: "값 없음" };
    return { value: num, error: null };
  } catch (e: any) {
    return { value: null, error: String(e?.message ?? e) };
  }
}

export interface Solved {
  value: number | null;
  error: string | null;
  substitutedTex: string | null; // 값이 대입된 계산 과정(LaTeX)
}

// 대입 표시용 반올림(계산은 풀정밀도 scope 값 사용, 표시만 6자리).
function roundDisp(n: number): number {
  if (!Number.isFinite(n) || n === 0) return n;
  const a = Math.abs(n);
  if (a >= 1e5 || a < 1e-4) return n;
  return Number(n.toPrecision(6));
}

/** expr의 자유변수를 scope 값으로 치환한 LaTeX(계산 과정) 생성. */
function substituteTex(
  expr: string,
  scope: Record<string, number>,
): string | null {
  try {
    const node = math.parse(expr);
    const sub = node.transform((n: any) =>
      n.isSymbolNode && n.name in scope
        ? new (math as any).ConstantNode(roundDisp(scope[n.name]))
        : n,
    );
    return sub.toTex({ implicit: "show", parenthesis: "auto" });
  } catch {
    return null;
  }
}

/** 입력값으로 모델 전체를 푼다. 다른 식의 출력을 참조하는 식은 반복 대입으로 해석.
 *  각 식마다 값이 대입된 계산과정(substitutedTex)도 함께 만든다. */
export function solve(
  model: CalcModel,
  inputScope: Record<string, number>,
): Solved[] {
  const scope: Record<string, number> = { ...inputScope };
  const out: Solved[] = model.equations.map(() => ({
    value: null,
    error: null,
    substitutedTex: null,
  }));
  const done = new Array(model.equations.length).fill(false);

  const run = (eq: CalcEquation, i: number) => {
    const r = evalEquation(eq, scope);
    // 대입 과정은 이 식의 출력을 scope에 넣기 전(입력·중간값 기준)에 만든다.
    const tex = eq.expr && r.value != null ? substituteTex(eq.expr, scope) : null;
    out[i] = { ...r, substitutedTex: tex };
    if (r.value != null) {
      // 연쇄등호(H = H_A = -H_D)의 모든 별칭을 scope에 등록(부호 반영).
      for (const o of eq.outputs) {
        const neg = /^\s*-/.test(o);
        const key = cleanOut(o);
        if (key && !(key in scope)) scope[key] = neg ? -r.value : r.value;
      }
    }
  };

  for (let pass = 0; pass < 4; pass++) {
    let progressed = false;
    model.equations.forEach((eq, i) => {
      if (done[i] || !eq.computable) return;
      const ready = eq.vars.every((v) => v in scope || KNOWN.has(v));
      if (!ready) return;
      run(eq, i);
      done[i] = true;
      progressed = true;
    });
    if (!progressed) break;
  }
  // 미해결(순환/입력부족) 식은 있는 값만으로 시도해 오류 표기
  model.equations.forEach((eq, i) => {
    if (!done[i] && eq.computable) run(eq, i);
  });
  return out;
}

function cleanOut(raw: string): string {
  return raw
    .replace(/\\[a-zA-Z]+/g, (m) => m.slice(1))
    .replace(/[{}\\()\s*-]/g, "")
    .replace(/_/g, "");
}

// 입력변수 정렬: 자주 쓰는 하중/치수 먼저, 나머지 알파벳.
const ORDER = ["P", "w", "q", "M", "l", "L", "a", "b", "c", "h", "E", "I", "x"];
function varSort(a: string, b: string): number {
  const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
  if (ia !== -1 || ib !== -1) {
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  }
  return a.localeCompare(b);
}
