import type { Case, TreeNode } from "./types";

/** 리프(케이스) 라벨: 분류가 있으면 마지막 분류값, 없으면 첫 공식명/ id. */
function leafLabel(c: Case): string {
  if (c.classes.length) return c.classes[c.classes.length - 1];
  return c.results.find((r) => r.name)?.name ?? c.id;
}

/** 케이스의 브랜치 경로(리프 제외). 마지막 분류값은 리프가 되므로 제외한다. */
function branchPath(c: Case): string[] {
  const p: string[] = [c.category];
  if (c.subCategory) p.push(c.subCategory);
  if (c.classes.length > 1) p.push(...c.classes.slice(0, -1));
  return p;
}

export function buildTree(cases: Case[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const byKey = new Map<string, TreeNode>();

  const sorted = [...cases].sort((a, b) => a.categoryOrder - b.categoryOrder);

  for (const c of sorted) {
    const path = branchPath(c);
    let level = roots;
    let prefix = "";
    // 브랜치(분류) 노드들을 따라 내려가며 생성/재사용
    for (const seg of path) {
      prefix += "/" + seg;
      let node = byKey.get(prefix);
      if (!node) {
        node = { key: prefix, label: seg, children: [], count: 0 };
        byKey.set(prefix, node);
        level.push(node);
      }
      node.count += 1;
      level = node.children;
    }
    // 케이스 = 항상 새 리프 (중복 제거하지 않음)
    level.push({
      key: prefix + "#" + c.id,
      label: leafLabel(c),
      children: [],
      count: 1,
      caseRef: c,
    });
  }
  return roots;
}

/** 검색: 케이스 안 텍스트(분류/공식명/변수/id)에서 질의어 매칭. */
export function searchCases(cases: Case[], q: string): Case[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  return cases.filter((c) => {
    const hay = [
      c.id,
      c.category,
      c.subCategory ?? "",
      ...c.classes,
      c.desc ?? "",
      ...c.results.flatMap((r) => [r.name ?? "", r.variables ?? ""]),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(t);
  });
}
