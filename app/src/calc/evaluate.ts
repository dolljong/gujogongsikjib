// 케이스의 결과 LaTeX들을 계산 가능한 방정식 목록으로 정리하고,
// 입력 변수들을 (단위와 함께) 평가한다. (Phase 2 계산기)
import { create, all, type MathJsInstance } from "mathjs";
import { parseLatexFormula, cleanSymbol, type Equation } from "./latex.js";
import { extractSymbol } from "./symbols";
import { buildDimensionMap } from "./dimension.js";
import type { Dimension } from "./dimension";
import { DETECT_ORDER, defaultUnit } from "./units";
import type { Case } from "../types";

const math: MathJsInstance = create(all, {});
// tonf 는 mathjs 기본에 없음(kgf 는 있음). 1 tonf = 9.80665 kN.
try {
  math.createUnit("tonf", "9.80665 kN");
} catch {
  /* 이미 등록됨 */
}

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
  dims: Map<string, Dimension>; // 기호 → 차원(단위 UI·결과판별용)
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
  return { equations, inputs, outputSymbols, dims: buildDimensionMap(c) };
}

export interface Solved {
  value: number | null; // 표시단위 기준 수치 (무단위면 순수값)
  error: string | null;
  substitutedTex: string | null; // 값이 대입된 계산 과정(LaTeX)
  unit: string | null; // 결과 표시단위(mathjs 문자열). null=무차원/무단위
  dim: Dimension | null; // 결과 차원(스위처 메뉴용)
  raw: unknown; // 재환산용 mathjs Unit(또는 number)
}

function emptySolved(): Solved {
  return { value: null, error: null, substitutedTex: null, unit: null, dim: null, raw: null };
}

// 대입 표시용 반올림(계산은 풀정밀도 값 사용, 표시만 6자리).
function roundDisp(n: number): number {
  if (!Number.isFinite(n) || n === 0) return n;
  const a = Math.abs(n);
  if (a >= 1e5 || a < 1e-4) return n;
  return Number(n.toPrecision(6));
}

// ---- 단위 결과 해석 --------------------------------------------------------
// 차원별 대표 단위(equalBase 비교용) 캐시.
const REP: Partial<Record<Dimension, unknown>> = {};
function rep(dim: Dimension): unknown {
  if (!(dim in REP)) {
    const u = defaultUnit(dim);
    REP[dim] = u ? math.unit(1, u) : null;
  }
  return REP[dim];
}

function isUnit(x: unknown): boolean {
  return !!x && typeof x === "object" && (x as any).type === "Unit";
}

interface Interpreted {
  value: number | null;
  unit: string | null;
  dim: Dimension | null;
  dispStr: string | null; // 대입 표시용 "값 단위"
  error: string | null;
}

/** mathjs 평가결과(Unit 또는 number) → 표시값·단위·차원. */
function interpretUnit(raw: unknown): Interpreted {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return { value: null, unit: null, dim: null, dispStr: null, error: "값 없음" };
    return { value: raw, unit: null, dim: "dimensionless", dispStr: String(roundDisp(raw)), error: null };
  }
  if (isUnit(raw)) {
    for (const d of DETECT_ORDER) {
      const r = rep(d);
      if (r && (raw as any).equalBase(r)) {
        const du = defaultUnit(d)!;
        try {
          const val = (raw as any).to(du).toNumber(du);
          if (!Number.isFinite(val)) return { value: null, unit: null, dim: null, dispStr: null, error: "값 없음" };
          return { value: val, unit: du, dim: d, dispStr: `${roundDisp(val)} ${du}`, error: null };
        } catch (e: any) {
          return { value: null, unit: null, dim: null, dispStr: null, error: String(e?.message ?? e) };
        }
      }
    }
    // 메뉴에 없는 차원 → 단위모드 실패로 처리(숫자 폴백이 대신 표시)
    return { value: null, unit: null, dim: null, dispStr: null, error: "단위 미매핑" };
  }
  return { value: null, unit: null, dim: null, dispStr: null, error: "값 없음" };
}

/** raw(Unit/number)를 목표 단위로 환산한 수치. UI의 결과단위 스위처가 호출. */
export function convertTo(raw: unknown, targetUnit: string): number | null {
  try {
    if (isUnit(raw)) return (raw as any).to(targetUnit).toNumber(targetUnit);
  } catch {
    /* 호환 안 됨 */
  }
  return null;
}

// ---- 대입 과정(LaTeX) ------------------------------------------------------
/** expr의 자유변수를 disp 문자열("10 kN", "0.001")로 치환한 LaTeX 생성. */
function substituteTex(expr: string, disp: Record<string, string>): string | null {
  try {
    const node = math.parse(expr);
    const sub = node.transform((n: any) =>
      n.isSymbolNode && n.name in disp ? math.parse(disp[n.name]) : n,
    );
    let tex = sub.toTex({ implicit: "show", parenthesis: "auto" });
    // 값·단위 사이의 \cdot → 얇은 공백(2\cdot\mathrm{kN} → 2\,\mathrm{kN})
    tex = tex.replace(/(\d|\})\s*\\cdot\s*\\mathrm/g, "$1\\,\\mathrm");
    return tex;
  } catch {
    return null;
  }
}

// ---- 풀이 (단위/숫자 두 경로) ----------------------------------------------
type Runner = (eq: CalcEquation, scope: Record<string, unknown>) => {
  raw: unknown;
  interp: Interpreted;
};

// 공통 반복대입 루프. 준비된 식부터 풀고 출력을 scope에 등록.
function runPasses(
  model: CalcModel,
  scope: Record<string, unknown>,
  disp: Record<string, string>,
  evalOne: Runner,
): Solved[] {
  const out = model.equations.map(emptySolved);
  const done = new Array(model.equations.length).fill(false);

  const run = (eq: CalcEquation, i: number) => {
    const { raw, interp } = evalOne(eq, scope);
    // 대입 과정은 이 식의 출력을 scope에 넣기 전(입력·중간값 기준)에 만든다.
    const tex = interp.error == null ? substituteTex(eq.expr!, disp) : null;
    out[i] = {
      value: interp.value,
      error: interp.error,
      substitutedTex: tex,
      unit: interp.unit,
      dim: interp.dim,
      raw,
    };
    if (interp.error == null && raw != null) {
      // 연쇄등호(H = H_A = -H_D)의 모든 별칭을 scope에 등록(부호 반영).
      for (const o of eq.outputs) {
        const neg = /^\s*-/.test(o);
        const key = cleanOut(o);
        if (key && !(key in scope)) {
          scope[key] = neg ? math.multiply(raw as any, -1) : raw;
          if (interp.dispStr) disp[key] = neg ? `-(${interp.dispStr})` : interp.dispStr;
        }
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

// 단위 경로 평가기.
const evalUnit: Runner = (eq, scope) => {
  try {
    const raw = math.evaluate(eq.expr!, scope);
    return { raw, interp: interpretUnit(raw) };
  } catch (e: any) {
    return { raw: null, interp: { value: null, unit: null, dim: null, dispStr: null, error: String(e?.message ?? e) } };
  }
};

// 숫자 경로 평가기(폴백/무단위).
const evalNumber: Runner = (eq, scope) => {
  try {
    const v = math.evaluate(eq.expr!, scope);
    const num = Number(v);
    if (!Number.isFinite(num)) {
      return { raw: null, interp: { value: null, unit: null, dim: null, dispStr: null, error: "값 없음" } };
    }
    return { raw: num, interp: { value: num, unit: null, dim: null, dispStr: String(roundDisp(num)), error: null } };
  } catch (e: any) {
    return { raw: null, interp: { value: null, unit: null, dim: null, dispStr: null, error: String(e?.message ?? e) } };
  }
};

/** 입력값(+단위)으로 모델 전체를 푼다.
 *  inputUnits[sym] 이 있으면 그 입력을 단위값으로 넣어 결과 단위를 자동 도출한다.
 *  단위 경로가 실패한 식은 순수 숫자 경로 결과로 폴백(단위 없이 표시). */
export function solve(
  model: CalcModel,
  inputScope: Record<string, number>,
  inputUnits: Record<string, string> = {},
): Solved[] {
  // 숫자 경로(항상): 폴백·무단위용
  const nScope: Record<string, unknown> = { ...inputScope };
  const nDisp: Record<string, string> = {};
  for (const [k, v] of Object.entries(inputScope)) nDisp[k] = String(roundDisp(v));
  const numeric = runPasses(model, nScope, nDisp, evalNumber);

  if (Object.keys(inputUnits).length === 0) return numeric;

  // 단위 경로
  const uScope: Record<string, unknown> = {};
  const uDisp: Record<string, string> = {};
  for (const v of model.inputs) {
    if (!(v in inputScope)) continue;
    const val = inputScope[v];
    const uStr = inputUnits[v];
    if (uStr) {
      uScope[v] = math.unit(val, uStr);
      uDisp[v] = `${roundDisp(val)} ${uStr}`;
    } else {
      uScope[v] = val;
      uDisp[v] = String(roundDisp(val));
    }
  }
  const unitOut = runPasses(model, uScope, uDisp, evalUnit);

  // 병합: 단위 경로가 성공한 식은 단위결과, 아니면 숫자결과.
  return model.equations.map((_, i) =>
    unitOut[i].error == null && unitOut[i].value != null ? unitOut[i] : numeric[i],
  );
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
