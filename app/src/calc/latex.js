// LaTeX(표시용) → mathjs 계산식 트랜스파일러.
// 순수 문자열 변환만 담당한다(평가는 호출부에서 mathjs로). 앱과 node 양쪽에서 사용.
//
// 핵심 아이디어: 엑셀엔 표시용 LaTeX만 있으므로, 그 LaTeX를 계산식으로 동적 변환하면
// 결과공식마다 별도로 수식을 주입할 필요가 없다.

// ---- 브레이스 매칭 헬퍼 ----------------------------------------------------
// s[open] 이 여는 괄호일 때, 짝이 되는 닫는 괄호 인덱스를 반환.
function matchBrace(s, open, oc = "{", cc = "}") {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === oc) depth++;
    else if (s[i] === cc) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// \cmd{...} 형태를 반복적으로 치환. transform(inner) 이 결과 문자열을 만든다.
function replaceCmdBraced(s, cmd, transform, optArg = false) {
  const re = new RegExp("\\\\" + cmd + (optArg ? "(\\[[^\\]]*\\])?" : "") + "\\s*\\{");
  for (let guard = 0; guard < 200; guard++) {
    const m = re.exec(s);
    if (!m) break;
    const braceStart = m.index + m[0].length - 1;
    const braceEnd = matchBrace(s, braceStart);
    if (braceEnd < 0) break;
    const inner = s.slice(braceStart + 1, braceEnd);
    const opt = optArg && m[1] ? m[1].slice(1, -1) : null;
    s = s.slice(0, m.index) + transform(inner, opt) + s.slice(braceEnd + 1);
  }
  return s;
}

// \frac{A}{B} 처럼 인수 2개짜리.
function replaceFrac(s) {
  for (let guard = 0; guard < 400; guard++) {
    const m = /\\d?frac\s*\{/.exec(s);
    if (!m) break;
    const b1 = m.index + m[0].length - 1;
    const e1 = matchBrace(s, b1);
    if (e1 < 0) break;
    let j = e1 + 1;
    while (s[j] === " ") j++;
    if (s[j] !== "{") break;
    const e2 = matchBrace(s, j);
    if (e2 < 0) break;
    const num = s.slice(b1 + 1, e1);
    const den = s.slice(j + 1, e2);
    s = s.slice(0, m.index) + "((" + num + ")/(" + den + "))" + s.slice(e2 + 1);
  }
  return s;
}

// 그리스문자 / 함수 / 상수 매핑.
const GREEK = [
  "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta",
  "theta", "vartheta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi",
  "varpi", "rho", "sigma", "tau", "upsilon", "phi", "varphi", "chi", "psi",
  "omega", "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Phi",
  "Psi", "Omega",
];
const FUNCS = ["sin", "cos", "tan", "cot", "sec", "csc", "sinh", "cosh", "tanh",
  "arcsin", "arccos", "arctan", "max", "min", "exp"];
const FUNC_SET = new Set([...FUNCS, "sqrt", "nthRoot", "log", "log10", "abs"]);

// mathjs는 `P(x)` 를 함수호출로 본다. 곱셈이어야 하는 자리에 '*' 삽입.
//  - 닫는괄호/숫자 뒤의 '('  →  `)*(`, `2*(`
//  - 식별자 뒤의 '(' 인데 그 식별자가 함수가 아니면  →  `P*(`
function insertImplicitMult(s) {
  let out = "";
  const idRe = /[A-Za-z_][A-Za-z0-9_]*/y;
  for (let i = 0; i < s.length; ) {
    const ch = s[i];
    if (/[A-Za-z_]/.test(ch)) {
      idRe.lastIndex = i;
      const m = idRe.exec(s);
      const name = m[0];
      out += name;
      i += name.length;
      let j = i;
      while (s[j] === " ") j++;
      if (s[j] === "(" && !FUNC_SET.has(name)) out += "*";
      continue;
    }
    // 숫자/닫는괄호 뒤의 '('
    if (ch === "(") {
      const prev = out.replace(/\s+$/, "").slice(-1);
      if (prev && /[0-9).]/.test(prev)) out += "*";
    }
    out += ch;
    i++;
  }
  return out;
}

// 계산식으로 못 옮기는(또는 위험한) 명령. 남아 있으면 실패 처리.
function stripSpacing(s) {
  return s.replace(/\\[,;! ]/g, " ").replace(/\\quad|\\qquad/g, " ");
}

// 붙어 있는 낱글자(곱)를 분리: wl→w l, EI→E I, 0.375wl→0.375 w l.
// 이 공식집에서 변수는 대개 단일문자이고 곱을 공백/·없이 쓰기 때문.
// \명령(그리스·함수)과 아래·위첨자 {…} 는 건드리지 않는다.
function splitAdjacentLetters(s) {
  let out = "";
  let prevAtom = false; // 직전에 낱글자/숫자를 붙여 냈는가
  for (let i = 0; i < s.length; ) {
    const ch = s[i];
    if (ch === "\\") {                     // \command 통째로 보존
      let j = i + 1;
      if (/[a-zA-Z]/.test(s[j] || "")) while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      else j = i + 2;
      out += s.slice(i, j); i = j; prevAtom = false; continue;
    }
    if (ch === "_" || ch === "^") {        // 첨자: {…} 안은 분리 금지
      out += ch; i++;
      if (s[i] === "{") { const e = matchBrace(s, i); out += s.slice(i, e + 1); i = e + 1; }
      else if (s[i] !== undefined) { out += s[i]; i++; }
      prevAtom = false; continue;
    }
    if (/[a-zA-Z]/.test(ch)) {              // 낱글자: 직전이 낱글자/숫자면 공백 삽입
      if (prevAtom) out += " ";
      out += ch; i++; prevAtom = true; continue;
    }
    if (/[0-9.]/.test(ch)) { out += ch; i++; prevAtom = true; continue; }
    out += ch; i++; prevAtom = false;      // 연산자·괄호·공백 등 → 런 종료
  }
  return out;
}

// LaTeX 수식(우변 하나) → mathjs 문자열. 실패 시 예외.
export function latexExprToMath(src) {
  let s = " " + src + " ";
  s = stripSpacing(s);
  s = splitAdjacentLetters(s);

  // 각도: X^{\circ} → (X)*pi/180  (드묾)
  s = s.replace(/\^\s*\{\s*\\circ\s*\}/g, "*pi/180");
  s = s.replace(/\^\s*\\circ/g, "*pi/180");

  // 래퍼성 명령: 내용만 남김
  s = replaceCmdBraced(s, "text", (i) => i.replace(/\s+/g, ""));
  s = replaceCmdBraced(s, "mathrm", (i) => i.replace(/\s+/g, ""));
  s = replaceCmdBraced(s, "operatorname", (i) => i.replace(/\s+/g, ""));
  s = replaceCmdBraced(s, "bar", (i) => i);
  s = replaceCmdBraced(s, "hat", (i) => i);
  s = replaceCmdBraced(s, "vec", (i) => i);
  s = replaceCmdBraced(s, "overline", (i) => i);
  s = replaceCmdBraced(s, "left", (i) => i); // 방어(보통 \left( 형태라 아래서 처리)

  // \left( \right) 등 구분자
  s = s.replace(/\\left\s*\./g, " ").replace(/\\right\s*\./g, " ");
  s = s.replace(/\\left\s*\\?\{/g, "(").replace(/\\right\s*\\?\}/g, ")");
  s = s.replace(/\\left\s*/g, "").replace(/\\right\s*/g, "");
  s = s.replace(/\\{/g, "(").replace(/\\}/g, ")");
  s = s.replace(/\[/g, "(").replace(/\]/g, ")");

  // 분수·제곱근
  s = replaceFrac(s);
  s = replaceCmdBraced(s, "sqrt", (inner, opt) =>
    opt ? "nthRoot((" + inner + "),(" + opt + "))" : "sqrt((" + inner + "))", true);

  // 위첨자 ^{...} → ^(...)
  for (let guard = 0; guard < 400; guard++) {
    const i = s.indexOf("^{");
    if (i < 0) break;
    const e = matchBrace(s, i + 1);
    if (e < 0) break;
    s = s.slice(0, i) + "^(" + s.slice(i + 2, e) + ")" + s.slice(e + 1);
  }

  // 연산자
  s = s.replace(/\\cdot|\\times/g, "*").replace(/\\div/g, "/");
  s = s.replace(/\\pm|\\mp/g, "+"); // 근사(양의 분기)

  // 증분기호: \Delta x, \Delta v 는 곱이 아니라 한 변수(Δx, Δv) → 병합.
  s = s.replace(/\\Delta\s*([A-Za-z])/g, "Delta$1");

  // 함수/그리스 이름 매핑 — 아래첨자 병합 전에, 긴 이름 우선, \b 없이.
  for (const f of [...FUNCS].sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp("\\\\" + f, "g"), f);
  }
  for (const g of [...GREEK].sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp("\\\\" + g, "g"), g);
  }

  // 아래첨자: _{...} 또는 _x → 식별자에 합침 (l_{1} → l1, theta_{B} → thetaB)
  s = s.replace(/_\s*\{([^{}]*)\}/g, (_, g) => g.replace(/[^A-Za-z0-9]/g, ""));
  s = s.replace(/_\s*([A-Za-z0-9])/g, (_, g) => g);

  // 함수 인수 괄호 보정: sin 30 → sin(30)
  for (const f of FUNCS) {
    const re = new RegExp("\\b" + f + "\\s*(?!\\()([A-Za-z0-9.]+)", "g");
    s = s.replace(re, f + "($1)");
  }

  // 정리
  s = s.replace(/\\,/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/\{|\}/g, ""); // 남은 중괄호 제거

  // 암묵적 곱셈: 기호/숫자/닫는괄호 뒤에 오는 '(' → '*(' (함수호출은 제외)
  s = insertImplicitMult(s);

  if (s.includes("\\")) {
    const bad = (s.match(/\\[a-zA-Z]+/) || ["\\?"])[0];
    throw new Error("미지원 명령: " + bad);
  }
  if (/[<>≤≥]|\\leq|\\geq/.test(s)) throw new Error("부등식 포함");
  return s;
}

// ---- 등식/블록 분해 --------------------------------------------------------
// 최상위(괄호·중괄호 밖) 구분자로 split.
function splitTop(s, seps) {
  const out = [];
  let depth = 0, last = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") depth--;
    else if (depth === 0) {
      for (const sep of seps) {
        if (s.startsWith(sep, i)) {
          out.push(s.slice(last, i));
          i += sep.length - 1;
          last = i + 1;
          break;
        }
      }
    }
  }
  out.push(s.slice(last));
  return out;
}

function isCondition(seg) {
  return /\\leq|\\geq|\\le\b|\\ge\b|≤|≥/.test(seg) ||
    (/[<>]/.test(seg) && !seg.includes("="));
}

// 좌변이 '단순 기호'인가? (M_{x}, \theta_{A}, -Q_{B}, e,e_1 …) — \frac·연산자가 있으면 식.
function isSimpleSymbol(s) {
  const atom = "(?:\\\\[a-zA-Z]+|[A-Za-z])(?:_\\{[^}]*\\}|_[A-Za-z0-9])?'?";
  return new RegExp("^-?\\s*" + atom + "(?:\\s*,\\s*" + atom + ")*$").test(s.trim());
}

// LaTeX 블록 → 방정식 목록.
// 반환: [{ outputs:[raw..], primary, exprLatex, expr|null, domain|null, error|null }]
//  - 좌변이 기호가 아니거나 등호가 없으면 outputs:[] (출력기호는 호출부가 name에서 채움).
export function parseLatexFormula(latex) {
  if (!latex) return [];
  let s = latex;
  // array/aligned 래퍼 제거
  s = s.replace(/\\begin\{[^}]*\}(\{[^}]*\})?/g, "").replace(/\\end\{[^}]*\}/g, "");
  s = s.replace(/&/g, ""); // 정렬 마커

  // 줄 분해: \\  → 여러 식
  const lines = s.split(/\\\\|\n/).map((x) => x.trim()).filter(Boolean);

  const eqs = [];
  for (const line of lines) {
    // 한 줄 안에서 \quad, 최상위 콤마로 다시 분해
    const parts = [];
    for (const byQuad of splitTop(line, ["\\quad", "\\qquad"])) {
      for (const p of splitTop(byQuad, [","])) {
        if (p.trim()) parts.push(p.trim());
      }
    }
    let pendingDomain = null;
    for (const part of parts) {
      if (isCondition(part)) {
        pendingDomain = part.replace(/[()]/g, "").trim();
        continue;
      }
      const sides = splitTop(part, ["="]).map((x) => x.trim()).filter(Boolean);
      if (sides.length === 0) continue;
      let outputs, exprLatex;
      if (sides.length >= 2 && isSimpleSymbol(sides[0])) {
        // A = B = expr : 좌변들이 출력기호
        outputs = sides.slice(0, -1);
        exprLatex = sides[sides.length - 1];
      } else {
        // 등호 없음(a^2) 또는 form1=form2(a/√3=0.577a): 통째로 식, 출력은 name에서.
        outputs = [];
        exprLatex = sides[0];
      }
      const eq = {
        outputs,
        primary: outputs.length ? cleanSymbol(outputs[0]) : "",
        exprLatex,
        expr: null,
        domain: pendingDomain,
        error: null,
      };
      try {
        eq.expr = latexExprToMath(exprLatex);
      } catch (e) {
        eq.error = String(e.message || e);
      }
      eqs.push(eq);
    }
  }
  // 도메인은 그 줄의 뒤쪽에 오는 경우가 많아 앞 방정식에도 소급
  return eqs;
}

// 출력 기호 표시용 정리: M_{x} → M_x, \theta_A → θ_A(간이)
export function cleanSymbol(raw) {
  return raw
    .replace(/\\[a-zA-Z]+/g, (m) => m.slice(1))
    .replace(/[{}\\]/g, "")
    .replace(/\s+/g, "")
    .replace(/\*/g, "");
}
