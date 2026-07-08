// 차원별 단위 메뉴. (Phase 2 단위 처리)
// 기본값(첫 항목) = mm 계열(mm·kN·MPa·mm⁴). mathjs 단위엔진이 환산을 담당하므로
// 여기 문자열(u)은 mathjs 가 파싱 가능한 형태여야 한다.
import type { Dimension } from "./dimension";

export interface UnitOption {
  u: string; // mathjs 단위 문자열
  label: string; // 표시용(·, ², ⁴ …)
}

// 단위 선택이 있는 차원만. (temp·expansion·dimensionless·unknown → 순수 숫자입력)
export const UNIT_MENU: Partial<Record<Dimension, UnitOption[]>> = {
  length: [
    { u: "mm", label: "mm" },
    { u: "m", label: "m" },
    { u: "cm", label: "cm" },
  ],
  force: [
    { u: "kN", label: "kN" },
    { u: "N", label: "N" },
    { u: "tonf", label: "tonf" },
    { u: "kgf", label: "kgf" },
  ],
  dist_load: [
    { u: "kN/m", label: "kN/m" },
    { u: "N/mm", label: "N/mm" },
    { u: "tonf/m", label: "tonf/m" },
  ],
  moment: [
    { u: "kN*m", label: "kN·m" },
    { u: "kN*mm", label: "kN·mm" },
    { u: "N*mm", label: "N·mm" },
    { u: "tonf*m", label: "tonf·m" },
  ],
  stress: [
    { u: "MPa", label: "MPa" },
    { u: "N/mm^2", label: "N/mm²" },
    { u: "kPa", label: "kPa" },
    { u: "kgf/cm^2", label: "kgf/cm²" },
  ],
  modulus: [
    { u: "GPa", label: "GPa" },
    { u: "MPa", label: "MPa" },
    { u: "N/mm^2", label: "N/mm²" },
  ],
  area: [
    { u: "mm^2", label: "mm²" },
    { u: "cm^2", label: "cm²" },
    { u: "m^2", label: "m²" },
  ],
  Zmod: [
    { u: "mm^3", label: "mm³" },
    { u: "cm^3", label: "cm³" },
    { u: "m^3", label: "m³" },
  ],
  inertia: [
    { u: "mm^4", label: "mm⁴" },
    { u: "cm^4", label: "cm⁴" },
    { u: "m^4", label: "m⁴" },
  ],
  angle: [
    { u: "deg", label: "°" },
    { u: "rad", label: "rad" },
  ],
};

// 결과 차원 판별 순서(equalBase 로 검사). 같은 기저를 공유하는 것(응력≡탄성계수,
// 모멘트≡에너지)은 표시상 흔한 쪽을 먼저 둔다.
export const DETECT_ORDER: Dimension[] = [
  "length", "area", "Zmod", "inertia",
  "force", "dist_load", "moment", "stress", "angle",
];

/** 그 차원의 기본(첫) 단위 문자열. 없으면 null. */
export function defaultUnit(dim: Dimension): string | null {
  return UNIT_MENU[dim]?.[0]?.u ?? null;
}

/** 단위 선택 UI 를 제공하는 차원인가? */
export function hasUnits(dim: Dimension): boolean {
  return !!UNIT_MENU[dim];
}

/** mathjs 단위문자열 → 표시 라벨(메뉴에 있으면 그 라벨, 없으면 원문). */
export function unitLabel(u: string): string {
  for (const opts of Object.values(UNIT_MENU)) {
    const hit = opts?.find((o) => o.u === u);
    if (hit) return hit.label;
  }
  return u;
}
