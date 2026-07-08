import { useMemo, useState } from "react";
import type { Dimension } from "../calc/dimension";
import { buildCalcModel, solve } from "../calc/evaluate";
import { UNIT_MENU, unitLabel } from "../calc/units";
import { varToLatex } from "../calc/symbols";
import { sectionCases, sectionLabel } from "../calc/sections";
import Katex from "./Katex";

const BASE = import.meta.env.BASE_URL;

function fmt(n: number): string {
  if (n === 0) return "0";
  const a = Math.abs(n);
  if (a >= 1e5 || a < 1e-4) return n.toExponential(4);
  return Number(n.toPrecision(6)).toString();
}

interface Props {
  targetDim: Dimension; // 부모 입력의 차원(예: inertia) — 이 차원 결과에만 [적용]
  targetLabel: string; // 부모 입력 기호(예: "I")
  initialSecId?: string; // 다시 열 때 직전 단면 복원
  onApply: (value: number, unit: string, label: string, secId: string) => void;
  onClose: () => void;
}

interface OutRow {
  sym: string;
  value: number;
  unit: string | null;
  isTarget: boolean;
}

export default function SectionPicker({ targetDim, targetLabel, initialSecId, onApply, onClose }: Props) {
  const [secId, setSecId] = useState<string>(initialSecId ?? sectionCases[0]?.id ?? "");
  const sec = useMemo(
    () => sectionCases.find((c) => c.id === secId) ?? sectionCases[0],
    [secId],
  );
  const model = useMemo(() => (sec ? buildCalcModel(sec) : null), [sec]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, string>>({});

  const changeSec = (id: string) => {
    setSecId(id);
    setVals({});
    setUnits({});
  };

  if (!model || !sec) return null;

  const menuOf = (v: string) => UNIT_MENU[model.dims.get(v) ?? "unknown"];
  const unitOf = (v: string) => units[v] ?? menuOf(v)?.[0]?.u;

  const scope: Record<string, number> = {};
  const inputUnits: Record<string, string> = {};
  let allFilled = true;
  for (const v of model.inputs) {
    const raw = vals[v];
    if (raw === undefined || raw === "" || Number.isNaN(Number(raw))) allFilled = false;
    else scope[v] = Number(raw);
    const u = unitOf(v);
    if (u) inputUnits[v] = u;
  }
  const solved = allFilled ? solve(model, scope, inputUnits) : null;

  // primary 기호별 1개, 계산된 결과만. 대상차원(적용가능)을 앞에 정렬.
  const outRows: OutRow[] = [];
  if (solved) {
    const seen = new Set<string>();
    model.equations.forEach((eq, i) => {
      const r = solved[i];
      if (!eq.computable || r.value == null || !eq.primary || seen.has(eq.primary)) return;
      seen.add(eq.primary);
      outRows.push({ sym: eq.primary, value: r.value, unit: r.unit, isTarget: r.dim === targetDim });
    });
    outRows.sort((a, b) => Number(b.isTarget) - Number(a.isTarget));
  }
  const hasTarget = outRows.some((r) => r.isTarget && r.unit);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>단면 성능 계산</span>
          <button className="modal-x" onClick={onClose} aria-label="닫기">×</button>
        </div>

        <div className="modal-body">
          <select className="sec-select" value={secId} onChange={(e) => changeSec(e.target.value)}>
            {sectionCases.map((c) => (
              <option key={c.id} value={c.id}>{sectionLabel(c)}</option>
            ))}
          </select>

          <div className="sec-main">
            {sec.figures.length > 0 && (
              <div className={`figure${sec.figures.length > 1 ? " figure-multi" : ""}`}>
                {sec.figures.map((f, i) => (
                  <img key={i} src={`${BASE}${f}`} alt={sec.id} loading="lazy" />
                ))}
              </div>
            )}
            <div className="sec-inputs">
              {model.inputs.map((v) => {
                const menu = menuOf(v);
                return (
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
                  </label>
                );
              })}
              {model.inputs.length === 0 && (
                <p className="calc-hint">이 단면은 제원 입력이 없습니다.</p>
              )}
            </div>
          </div>

          {!allFilled && (
            <p className="calc-hint">제원을 모두 입력하면 단면성능이 계산됩니다.</p>
          )}

          {solved && (
            <div className="sec-outputs">
              {outRows.map((r, i) => (
                <div className={`sec-out${r.isTarget ? " sec-out-target" : ""}`} key={i}>
                  <span className="sec-out-val">
                    <Katex tex={varToLatex(r.sym)} display={false} /> = {fmt(r.value)}{" "}
                    {r.unit ? unitLabel(r.unit) : ""}
                  </span>
                  {r.isTarget && r.unit && (
                    <button
                      className="sec-apply"
                      onClick={() => onApply(r.value, r.unit as string, `${sectionLabel(sec)} · ${r.sym}`, sec.id)}
                    >
                      {targetLabel}에 적용
                    </button>
                  )}
                </div>
              ))}
              {!hasTarget && (
                <p className="calc-hint">이 단면에는 {targetLabel}에 적용할 값이 없습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
