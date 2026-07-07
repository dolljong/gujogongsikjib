import type { Case } from "../types";
import Katex from "./Katex";
import Calculator from "./Calculator";
import { symbolToLatex } from "../calc/symbols";

// 변수설명("sym : 설명, sym : 설명 …")에서 기호 부분을 LaTeX로 렌더.
function VariableList({ text }: { text: string }) {
  const segs = text.split(",");
  return (
    <div className="result-vars">
      <span className="vars-label">변수</span>{" "}
      {segs.map((seg, i) => {
        const ci = seg.indexOf(":");
        const sym = (ci >= 0 ? seg.slice(0, ci) : seg).trim();
        const desc = ci >= 0 ? seg.slice(ci + 1).trim() : "";
        return (
          <span className="var-item" key={i}>
            {i > 0 && ", "}
            {sym && <Katex tex={symbolToLatex(sym)} display={false} />}
            {ci >= 0 && <>: {desc}</>}
          </span>
        );
      })}
    </div>
  );
}

const BASE = import.meta.env.BASE_URL;

export default function FormulaDetail({ c }: { c: Case | null }) {
  if (!c) {
    return (
      <div className="detail empty">
        <p>왼쪽 트리에서 공식을 선택하세요.</p>
      </div>
    );
  }
  const crumb = [c.category, c.subCategory, ...c.classes].filter(Boolean);
  return (
    <div className="detail">
      <div className="crumb">
        {crumb.map((x, i) => (
          <span key={i}>
            {x}
            {i < crumb.length - 1 && <span className="sep">›</span>}
          </span>
        ))}
      </div>

      <div className="detail-head">
        <h1>
          {c.classes.length
            ? c.classes[c.classes.length - 1]
            : (c.results.find((r) => r.name)?.name ?? c.id)}
        </h1>
        <div className="meta">
          {!c.id.includes("#") && <span className="badge">{c.id}</span>}
          {c.page != null && <span className="page">p.{c.page}</span>}
        </div>
      </div>
      {c.desc && <p className="desc">{c.desc}</p>}

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

      <div className="results">
        {c.results.map((r, i) => (
          <div className="result" key={i}>
            {r.name && <div className="result-name">{r.name}</div>}
            {r.latex && (
              <div className="result-tex">
                <Katex tex={r.latex} />
              </div>
            )}
            {r.variables && <VariableList text={r.variables} />}
          </div>
        ))}
      </div>

      <Calculator c={c} />
    </div>
  );
}
