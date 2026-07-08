import { useState } from "react";
import type { Case } from "../types";
import { solve, convertTo, type CalcModel } from "../calc/evaluate";
import { varToLatex } from "../calc/symbols";
import { UNIT_MENU, unitLabel } from "../calc/units";
import { STEEL_E_MPA, concreteEc, type Material } from "../calc/material";
import Katex from "./Katex";
import SectionPicker from "./SectionPicker";

// I(단면2차모멘트) 입력 모드: 직접입력 / 단면 선택(팝업)
type IMode = "custom" | "section";
interface SectionVal { value: number; unit: string; label: string; secId: string }

const BASE = import.meta.env.BASE_URL;

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

// mathjs 단위문자열 → LaTeX ('kN*m'→'\mathrm{kN}\cdot\mathrm{m}', 'mm^4'→'\mathrm{mm}^{4}')
function unitToTex(u: string): string {
  let s = u.replace(/([A-Za-z]+)/g, "\\mathrm{$1}");
  s = s.replace(/\^(-?\d+)/g, "^{$1}");
  s = s.replace(/\*/g, "\\cdot ");
  return s;
}

const stripTex = (s: string) => s.replace(/[\s{}()]/g, "");

// 한 방정식을 "출력 = 원식 = 값대입 = 최종값[단위]" LaTeX 한 줄로.
function buildLine(
  outputs: string[],
  exprLatex: string,
  substitutedTex: string | null,
  value: number,
  unit: string | null,
): string {
  const valTex = fmtTex(value) + (unit ? `\\,${unitToTex(unit)}` : "");
  const parts = [...outputs.filter(Boolean), exprLatex];
  // 대입식이 최종값과 같지 않을 때만(예: W=P=10 에서 중복 방지) 추가
  if (substitutedTex && stripTex(substitutedTex) !== stripTex(valTex)) {
    parts.push(substitutedTex);
  }
  parts.push(valTex);
  return parts.join(" = ");
}

// 콘크리트 탄성계수 산정 과정(KDS 14 20 10) 한 줄.
function concreteLine(sym: string, fck: number): string {
  const { Ec, fcu, df, cbrt } = concreteEc(fck);
  const cbrtR = Number(cbrt.toPrecision(6));
  return (
    `${sym} = 8500\\sqrt[3]{f_{ck}+\\Delta f}` +
    ` = 8500\\sqrt[3]{${fmt(fck)} + ${fmt(df)}}` +
    ` = 8500\\sqrt[3]{${fmt(fcu)}}` +
    ` = 8500 \\times ${fmt(cbrtR)}` +
    ` = ${fmtTex(Ec)}\\,\\mathrm{MPa}`
  );
}

export default function Calculator({ c, model }: { c: Case; model: CalcModel }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, string>>({}); // 입력 기호 → 단위
  const [resUnit, setResUnit] = useState<Record<number, string>>({}); // 식 인덱스 → 결과 단위
  const [mat, setMat] = useState<Record<string, Material>>({}); // E 입력 → 재료
  const [fck, setFck] = useState<Record<string, string>>({}); // 콘크리트 fck (MPa)
  const [iMode, setIMode] = useState<Record<string, IMode>>({}); // I 입력 → 모드
  const [iSection, setISection] = useState<Record<string, SectionVal>>({}); // 적용된 단면값
  const [modalFor, setModalFor] = useState<string | null>(null); // 단면 팝업 대상 입력

  // 입력 없으면 계산기 숨김
  if (model.inputs.length === 0 || !model.equations.some((e) => e.computable)) {
    return null;
  }

  // 입력별 단위 메뉴/기본단위
  const menuOf = (v: string) => UNIT_MENU[model.dims.get(v) ?? "unknown"];
  const unitOf = (v: string) => units[v] ?? menuOf(v)?.[0]?.u;
  // E(영계수) 입력에는 재료(강재/콘크리트) 선택을 제공.
  const isMatInput = (v: string) => model.dims.get(v) === "modulus" && /^E/i.test(v);
  const matOf = (v: string): Material => mat[v] ?? "custom";
  // I(단면2차모멘트) 입력에는 단면 선택(팝업)을 제공.
  const isSectInput = (v: string) => model.dims.get(v) === "inertia";
  const iModeOf = (v: string): IMode => iMode[v] ?? "custom";

  // 입력값 해석: {수치, 단위, 채워짐}
  const stateOf = (v: string): { value: number | null; unit?: string; filled: boolean } => {
    if (isMatInput(v)) {
      const m = matOf(v);
      if (m === "steel") return { value: STEEL_E_MPA, unit: "MPa", filled: true };
      if (m === "concrete") {
        const f = Number(fck[v]);
        if (fck[v] === undefined || fck[v] === "" || Number.isNaN(f) || f <= 0) {
          return { value: null, unit: "MPa", filled: false };
        }
        return { value: concreteEc(f).Ec, unit: "MPa", filled: true };
      }
    }
    if (isSectInput(v) && iModeOf(v) === "section") {
      const sv = iSection[v];
      return sv
        ? { value: sv.value, unit: sv.unit, filled: true }
        : { value: null, unit: undefined, filled: false };
    }
    const raw = vals[v];
    if (raw === undefined || raw === "" || Number.isNaN(Number(raw))) {
      return { value: null, unit: unitOf(v), filled: false };
    }
    return { value: Number(raw), unit: unitOf(v), filled: true };
  };

  const scope: Record<string, number> = {};
  const inputUnits: Record<string, string> = {};
  let allFilled = true;
  for (const v of model.inputs) {
    const st = stateOf(v);
    if (!st.filled) allFilled = false;
    if (st.value != null) scope[v] = st.value;
    if (st.unit) inputUnits[v] = st.unit;
  }

  const solved = allFilled ? solve(model, scope, inputUnits) : null;

  // 콘크리트로 지정된 E 입력 중 fck 가 유효한 것 → 산정과정 표시용
  const concreteInputs = model.inputs
    .filter((v) => isMatInput(v) && matOf(v) === "concrete")
    .map((v) => ({ v, f: Number(fck[v]) }))
    .filter(({ f, v }) => fck[v] !== undefined && fck[v] !== "" && !Number.isNaN(f) && f > 0);

  return (
    <div className="calc">
      <div className="calc-head">계산기 <span className="calc-badge">시험판</span></div>

      <div className="calc-top">
        {c.figures.length > 0 && (
          <div className={`figure${c.figures.length > 1 ? " figure-multi" : ""}`}>
            {c.figures.map((f, i) => (
              <img
                key={i}
                src={`${BASE}${f}`}
                alt={c.figures.length > 1 ? `${c.id} (${i + 1})` : c.id}
                loading="lazy"
              />
            ))}
          </div>
        )}
        <div className="calc-inputs">
          {model.inputs.map((v) => {
            const menu = menuOf(v);
            const matInput = isMatInput(v);
            const sectInput = isSectInput(v);
            const m = matOf(v);
            return (
              <label className="calc-field" key={v}>
                <span className="calc-var">
                  <Katex tex={varToLatex(v)} display={false} />
                </span>

                {sectInput ? (
                  <div className="calc-mat">
                    <select
                      className="calc-unit"
                      value={iModeOf(v)}
                      onChange={(e) => setIMode((s) => ({ ...s, [v]: e.target.value as IMode }))}
                    >
                      <option value="custom">직접입력</option>
                      <option value="section">단면 선택</option>
                    </select>

                    {iModeOf(v) === "custom" && (
                      <>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={vals[v] ?? ""}
                          placeholder="0"
                          onChange={(e) => setVals((s) => ({ ...s, [v]: e.target.value }))}
                        />
                        {menu && (
                          <select
                            className="calc-unit"
                            value={unitOf(v)}
                            onChange={(e) => setUnits((s) => ({ ...s, [v]: e.target.value }))}
                          >
                            {menu.map((o) => (
                              <option key={o.u} value={o.u}>{o.label}</option>
                            ))}
                          </select>
                        )}
                      </>
                    )}

                    {iModeOf(v) === "section" && (
                      iSection[v] ? (
                        <span className="calc-sect-applied">
                          <span className="calc-ec">
                            {iSection[v].label.split(" · ")[0]}: {fmt(iSection[v].value)}{" "}
                            {unitLabel(iSection[v].unit)}
                          </span>
                          <button type="button" className="calc-sect-btn" onClick={() => setModalFor(v)}>
                            변경
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="calc-sect-btn" onClick={() => setModalFor(v)}>
                          단면 선택…
                        </button>
                      )
                    )}
                  </div>
                ) : matInput ? (
                  <div className="calc-mat">
                    <select
                      className="calc-unit"
                      value={m}
                      onChange={(e) =>
                        setMat((s) => ({ ...s, [v]: e.target.value as Material }))
                      }
                    >
                      <option value="custom">직접입력</option>
                      <option value="steel">강재</option>
                      <option value="concrete">콘크리트</option>
                    </select>

                    {m === "custom" && (
                      <>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={vals[v] ?? ""}
                          placeholder="0"
                          onChange={(e) => setVals((s) => ({ ...s, [v]: e.target.value }))}
                        />
                        {menu && (
                          <select
                            className="calc-unit"
                            value={unitOf(v)}
                            onChange={(e) => setUnits((s) => ({ ...s, [v]: e.target.value }))}
                          >
                            {menu.map((o) => (
                              <option key={o.u} value={o.u}>{o.label}</option>
                            ))}
                          </select>
                        )}
                      </>
                    )}

                    {m === "steel" && (
                      <span className="calc-fixed">205,000&nbsp;MPa</span>
                    )}

                    {m === "concrete" && (() => {
                      const f = Number(fck[v]);
                      const valid = fck[v] !== undefined && fck[v] !== "" && !Number.isNaN(f) && f > 0;
                      return (
                        <span className="calc-fck">
                          <span className="calc-fck-lab">
                            <Katex tex="f_{ck}" display={false} />
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={fck[v] ?? ""}
                            placeholder="0"
                            onChange={(e) => setFck((s) => ({ ...s, [v]: e.target.value }))}
                          />
                          <span className="calc-unit-static">MPa</span>
                          {valid && (
                            <span className="calc-ec">
                              → <Katex tex={varToLatex(v)} display={false} /> = {fmt(concreteEc(f).Ec)} MPa
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  </div>
                ) : (
                  <>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={vals[v] ?? ""}
                      placeholder="0"
                      onChange={(e) => setVals((s) => ({ ...s, [v]: e.target.value }))}
                    />
                    {menu && (
                      <select
                        className="calc-unit"
                        value={unitOf(v)}
                        onChange={(e) => setUnits((s) => ({ ...s, [v]: e.target.value }))}
                      >
                        {menu.map((o) => (
                          <option key={o.u} value={o.u}>{o.label}</option>
                        ))}
                      </select>
                    )}
                  </>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {!allFilled && (
        <p className="calc-hint">모든 값을 입력하면 결과가 계산됩니다.</p>
      )}

      {solved && (
        <div className="calc-outputs">
          {model.equations.map((eq, i) => {
            const r = solved[i];
            const ok = eq.computable && r.value != null;
            const resMenu = r.dim ? UNIT_MENU[r.dim] : undefined;
            const altU = resUnit[i];
            const altVal =
              ok && altU && altU !== r.unit ? convertTo(r.raw, altU) : null;
            return (
              <div className="calc-out" key={i}>
                {ok ? (
                  <>
                    <div className="calc-line">
                      <Katex
                        tex={buildLine(eq.outputs, eq.exprLatex, r.substitutedTex, r.value as number, r.unit)}
                        display={false}
                      />
                    </div>
                    {resMenu && (
                      <div className="calc-conv">
                        <span className="calc-conv-label">단위 변환</span>
                        <select
                          className="calc-unit"
                          value={altU ?? r.unit ?? ""}
                          onChange={(e) => setResUnit((s) => ({ ...s, [i]: e.target.value }))}
                        >
                          {resMenu.map((o) => (
                            <option key={o.u} value={o.u}>{o.label}</option>
                          ))}
                        </select>
                        {altVal != null && (
                          <span className="calc-conv-val">
                            = {fmt(altVal)} {altU ? unitLabel(altU) : ""}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="calc-line calc-line-fail">
                    <Katex
                      tex={[...eq.outputs.filter(Boolean), eq.exprLatex].join(" = ")}
                      display={false}
                    />
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

      {concreteInputs.length > 0 && (
        <div className="calc-concrete">
          <div className="calc-sub-head">
            콘크리트 탄성계수 <span className="calc-std">KDS 14 20 10</span>
          </div>
          {concreteInputs.map(({ v, f }) => (
            <div className="calc-line" key={v}>
              <Katex tex={concreteLine(varToLatex(v), f)} display={false} />
            </div>
          ))}
          <p className="calc-note-small">
            보통중량콘크리트(mc=2300), fcu = fck + Δf (Δf: 4MPa[fck≤40]~6MPa[fck≥60] 선형보간).
          </p>
        </div>
      )}

      <p className="calc-note-small">
        입력 단위로부터 결과 단위를 자동 도출합니다. 값·부호는 원식과 대조하세요.
      </p>

      {modalFor && (
        <SectionPicker
          targetDim="inertia"
          targetLabel={modalFor}
          initialSecId={iSection[modalFor]?.secId}
          onClose={() => setModalFor(null)}
          onApply={(value, unit, label, secId) => {
            const v = modalFor;
            setISection((s) => ({ ...s, [v]: { value, unit, label, secId } }));
            setModalFor(null);
          }}
        />
      )}
    </div>
  );
}
