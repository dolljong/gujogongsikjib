// 기호 표시용 LaTeX 변환 헬퍼 (계산기·변수설명 공용).

export const GREEK = [
  "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta",
  "theta", "vartheta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi",
  "varpi", "rho", "sigma", "tau", "upsilon", "phi", "varphi", "chi", "psi",
  "omega", "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Phi",
  "Psi", "Omega",
];

const GREEK_ALT = [...GREEK].sort((a, b) => b.length - a.length).join("|");
const GREEK_RE = new RegExp("(^|[^A-Za-z\\\\])(" + GREEK_ALT + ")(?![A-Za-z])", "g");

/** 변수설명 안의 기호 토큰을 표시용 LaTeX로.
 *  예) "varepsilon _i" → "\varepsilon _i", "Delta l" → "\Delta l", "I_P" → "I_P"(그대로) */
export function symbolToLatex(sym: string): string {
  return sym.replace(GREEK_RE, (_, pre, name) => pre + "\\" + name);
}

/** 계산기 입력변수(병합된 이름)를 표시용 LaTeX로.
 *  theta→\theta, l1→l_{1}, IP→I_{P}, Deltav→\Delta v */
export function varToLatex(name: string): string {
  const dm = /^Delta([A-Za-z].*)$/.exec(name);
  if (dm) return "\\Delta " + varToLatex(dm[1]);
  for (const g of GREEK) {
    if (name === g) return "\\" + g;
    if (name.startsWith(g)) return "\\" + g + "_{" + name.slice(g.length) + "}";
  }
  const m = /^([A-Za-z])([A-Za-z0-9]+)$/.exec(name);
  if (m && /^[A-Z]/.test(name)) return m[1] + "_{" + m[2] + "}";
  const d = /^([A-Za-z]+)(\d+)$/.exec(name);
  if (d) return d[1] + "_{" + d[2] + "}";
  return name;
}
