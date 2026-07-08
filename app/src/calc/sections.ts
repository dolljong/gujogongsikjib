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

// 단면공식 중 변수설명 텍스트가 없어(그림에 치수 정의) 자동분류가 실패하는 케이스의
// 변수 차원을 명시 지정. 원본 구조공식집 스캔(1장 22~33쪽) 기준.
//   length=길이 · angle=각도(도°로 입력→내부 라디안) · count=개수(무차원)
export type SectionDim = "length" | "angle" | "count";
const L = "length" as const, A = "angle" as const, N = "count" as const;

export const SECTION_DIM_OVERRIDE: Record<string, Record<string, SectionDim>> = {
  // 정n각형: n=변의 수, b·r₁·r₂=길이, α=반중심각(=180°/n)
  "1.6.18": { n: N, b: L, r1: L, r2: L, alpha: A },
  "1.6.19": { n: N, b: L, r1: L, r2: L, alpha: A, a: A },
  // 부채꼴/활꼴: R=반지름, α·φ=각도(호 계수 → 라디안)
  "1.6.42": { R: L, alpha: A, a: A },
  "1.6.43": { R: L, phi: A },
  "1.6.44": { R: L, alpha: A },
  "1.6.45": { R: L, alpha: A, a: A },
  // 형강: 모든 그림 치수 = 길이
  "1.6.51": {
    B: L, H: L, b: L, h: L, a: L, t: L,
    b1: L, b3: L, b4: L, b5: L, h4: L, h5: L,
  },
};

/** 그 단면 케이스의 변수 차원 오버라이드(없으면 undefined). */
export function sectionDim(caseId: string, sym: string): SectionDim | undefined {
  return SECTION_DIM_OVERRIDE[caseId]?.[sym];
}
