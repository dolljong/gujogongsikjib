import { useMemo, useState } from "react";
import type { Case } from "../types";
import { buildCalcModel, solve } from "../calc/evaluate";
import { varToLatex } from "../calc/symbols";
import Katex from "./Katex";

function fmt(n: number): string {
  if (n === 0) return "0";
  const a = Math.abs(n);
  if (a >= 1e5 || a < 1e-4) return n.toExponential(4);
  return Number(n.toPrecision(6)).toString();
}

// 최종값을 LaTeX로 (지수표기는 a\times10^{b})
function fmtTex(n: number): string {
  const s = fmt(n);
  const m = /^(-?[\d.]+)e([+-]?\d+)$/i.exec(s);
  return m ? `${m[1]} \\times 10^{${parseInt(m[2], 10)}}` : s;
}

const stripTex = (s: string) => s.replace(/[\s{}()]/g, "");

// 한 방정식을 "출력 = 원식 = 값대입 = 최종값" LaTeX 한 줄로.
function buildLine(
  outputs: string[],
  exprLatex: string,
  substitutedTex: string | null,
  value: number,
): string {
  const valTex = fmtTex(value);
  const parts = [...outputs, exprLatex];
  // 대입식이 최종값과 같지 않을 때만(예: W=P=10 에서 중복 방지) 추가
  if (substitutedTex && stripTex(substitutedTex) !== stripTex(valTex)) {
    parts.push(substitutedTex);
  }
  parts.push(valTex);
  return parts.join(" = ");
}

export default function Calculator({ c }: { c: Case }) {
  const model = useMemo(() => buildCalcModel(c), [c]);
  const [vals, setVals] = useState<Record<string, string>>({});

  // 입력 없으면 계산기 숨김
  if (model.inputs.length === 0 || !model.equations.some((e) => e.computable)) {
    return null;
  }

  const scope: Record<string, number> = {};
  let allFilled = true;
  for (const v of model.inputs) {
    const raw = vals[v];
    if (raw === undefined || raw === "" || Number.isNaN(Number(raw))) {
      allFilled = false;
    } else {
      scope[v] = Number(raw);
    }
  }

  const solved = allFilled ? solve(model, scope) : null;

  return (
    <div className="calc">
      <div className="calc-head">계산기 <span className="calc-badge">시험판</span></div>

      <div className="calc-inputs">
        {model.inputs.map((v) => (
          <label className="calc-field" key={v}>
            <span className="calc-var">
              <Katex tex={varToLatex(v)} display={false} />
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={vals[v] ?? ""}
              placeholder="0"
              onChange={(e) => setVals((s) => ({ ...s, [v]: e.target.value }))}
            />
          </label>
        ))}
      </div>

      {!allFilled && (
        <p className="calc-hint">모든 값을 입력하면 결과가 계산됩니다.</p>
      )}

      {solved && (
        <div className="calc-outputs">
          {model.equations.map((eq, i) => {
            const r = solved[i];
            const ok = eq.computable && r.value != null;
            return (
              <div className="calc-out" key={i}>
                {ok ? (
                  <div className="calc-line">
                    <Katex
                      tex={buildLine(eq.outputs, eq.exprLatex, r.substitutedTex, r.value as number)}
                      display={false}
                    />
                  </div>
                ) : (
                  <div className="calc-line calc-line-fail">
                    <Katex tex={`${eq.outputs.join(" = ")} = ${eq.exprLatex}`} display={false} />
                    <em className="calc-dom">
                      {" — "}
                      {!eq.computable ? "자동계산 미지원" : "값 없음(입력 확인)"}
                    </em>
                  </div>
                )}
                {eq.domain && <div className="calc-dom">조건: {eq.domain}</div>}
              </div>
            );
          })}
        </div>
      )}

      <p className="calc-note-small">
        표시용 LaTeX를 자동 변환해 계산합니다. 값·부호·단위는 반드시 원식과 대조하세요.
      </p>
    </div>
  );
}
