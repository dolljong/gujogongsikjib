import { useMemo, useState } from "react";
import "katex/dist/katex.min.css";
import "./App.css";
import rawData from "./data/formulas.json";
import type { Case } from "./types";
import { buildTree, searchCases } from "./tree";
import TreeView from "./components/TreeView";
import FormulaDetail from "./components/FormulaDetail";

const cases = rawData as unknown as Case[];

export default function App() {
  const tree = useMemo(() => buildTree(cases), []);
  const [selected, setSelected] = useState<Case | null>(null);
  const [q, setQ] = useState("");

  const results = useMemo(() => searchCases(cases, q), [q]);

  return (
    <div className="app">
      <header className="topbar">
        <h2>구조공식집</h2>
        <span className="sub">{cases.length}개 공식 케이스</span>
      </header>

      <div className="body">
        <aside className="sidebar">
          <input
            className="search"
            placeholder="검색 (공식명 · 변수 · 번호)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q.trim() ? (
            <div className="search-results">
              <div className="sr-head">{results.length}건</div>
              {results.slice(0, 200).map((c) => (
                <div
                  key={c.id + c.category}
                  className={
                    "sr-item" + (selected?.id === c.id ? " selected" : "")
                  }
                  onClick={() => setSelected(c)}
                >
                  <span className="tv-id">{c.id}</span>
                  <span>
                    {c.classes[c.classes.length - 1] ??
                      c.results[0]?.name ??
                      c.id}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <TreeView
              tree={tree}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          )}
        </aside>

        <main className="main">
          <FormulaDetail c={selected} />
        </main>
      </div>
    </div>
  );
}
