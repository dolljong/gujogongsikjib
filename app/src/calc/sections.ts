// 단면성능 산출공식 목록. (Phase 2 — I/A/Z 입력 보조: 단면 선택 팝업)
import rawData from "../data/formulas.json";
import type { Case } from "../types";

const all = rawData as unknown as Case[];

export const SECTION_CATEGORY = "단면성능 산출공식";

/** 단면성능 산출공식 케이스들(정사각형·직사각형·중공·원·다각형 …). */
export const sectionCases: Case[] = all.filter(
  (c) => c.category === SECTION_CATEGORY,
);

/** 목록/선택 표시용 라벨. */
export function sectionLabel(c: Case): string {
  return (
    c.classes.join(" ") ||
    c.results.find((r) => r.name)?.name ||
    c.id
  );
}
