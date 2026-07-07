import type { Case } from "../types";
import Katex from "./Katex";

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

      {c.figure && (
        <div className="figure">
          <img src={`${BASE}${c.figure}`} alt={c.id} loading="lazy" />
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
            {r.variables && (
              <div className="result-vars">
                <span className="vars-label">변수</span> {r.variables}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="calc-note">
        계산기 기능(값 입력 → 결과)은 다음 단계에서 추가됩니다.
      </div>
    </div>
  );
}
