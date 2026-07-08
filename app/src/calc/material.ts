// 재료별 탄성계수. (Phase 2 계산기 — E 입력 보조)
// 강재는 고정값, 콘크리트는 fck로부터 설계기준(KDS 14 20 10)에 따라 산정.

export type Material = "custom" | "steel" | "concrete";

// 강재 탄성계수(구조용 강재, KDS 14 31). 단위 MPa.
export const STEEL_E_MPA = 205000;

/** KDS 14 20 10: fcu = fck + Δf. Δf = 4MPa(fck≤40) ~ 6MPa(fck≥60) 선형보간. */
export function deltaF(fck: number): number {
  if (fck <= 40) return 4;
  if (fck >= 60) return 6;
  return 4 + 0.1 * (fck - 40);
}

export interface Ec {
  Ec: number; // 콘크리트 탄성계수 (MPa)
  fcu: number; // fck + Δf
  df: number; // Δf
  cbrt: number; // ∛fcu
}

/** 콘크리트 탄성계수 Ec = 8500·∛(fcu) (MPa). 보통중량콘크리트(mc=2300). */
export function concreteEc(fck: number): Ec {
  const df = deltaF(fck);
  const fcu = fck + df;
  const cbrt = Math.cbrt(fcu);
  return { Ec: 8500 * cbrt, fcu, df, cbrt };
}
