// 변수설명(한글) → 물리 차원 분류기. (Phase 2 단위 처리)
//
// 아이디어: 엑셀 변수설명이 케이스마다 "기호 : 한글의미" 로 있으므로,
// 한글 키워드로 각 기호의 차원(길이/힘/모멘트/응력…)을 추론한다.
// 같은 기호라도 케이스마다 의미가 달라(t=온도 vs 두께) 반드시 케이스별로 뽑는다.
// 앱(단위 드롭다운 기본값)과 node 리포트 양쪽에서 쓰므로 .js 로 둔다.

// ---- 기호 정규화 ----------------------------------------------------------
// 변수설명의 기호 토큰을 계산엔진 자유변수 이름과 같은 형태로 canon화.
//   "varepsilon _i" → "varepsiloni", "l_0" → "l0", "I_P" → "IP",
//   "Delta l" → "Deltal", "overline{x}" → "x"
export function canonSym(raw) {
  let s = String(raw).trim();
  s = s.replace(/\\/g, "");
  // overline{x}, bar x 등 장식 명령 → 안쪽 기호만
  s = s.replace(
    /(overline|underline|widehat|widetilde|bar|hat|vec|tilde|dot|ddot)\s*\{?([A-Za-z0-9]*)\}?/g,
    "$2",
  );
  s = s.replace(/[{}'\s]/g, "");
  s = s.replace(/_/g, "");
  return s;
}

// ---- 변수설명 파싱 --------------------------------------------------------
const HANGUL_G = /[가-힣]/g;

// 기호 나열 문자열 → canon 기호 배열. 구분자는 콤마·공백 무엇이든.
//   "t_1, t_2" → ["t1","t2"], "I_x I_y" → ["Ix","Iy"]
function splitSyms(str) {
  return String(str)
    .split(/[,\s]+/)
    .map(canonSym)
    .filter((s) => s && /^[A-Za-z]/.test(s));
}

// 한 조각 "...설명... [구분] 다음기호들" 을 [desc, nextSyms] 로 나눈다.
// 정의 사이 구분자가 콤마일 때도 공백/줄바꿈일 때도 있어(데이터 편차),
// "마지막 한글 이후에 오는 기호같은 토큰들" 을 다음 그룹의 기호로 떼어낸다.
function splitDescAndSyms(piece) {
  let last = -1;
  let m;
  HANGUL_G.lastIndex = 0;
  while ((m = HANGUL_G.exec(piece))) last = m.index;
  if (last < 0) return ["", piece]; // 한글이 없으면 통째로 다음 기호군
  const desc = piece.slice(0, last + 1);
  const tail = piece.slice(last + 1); // 마지막 한글 뒤 = 다음 기호 후보
  return [desc, tail];
}

// "기호 : 설명 [구분] 기호 : 설명 ..." → [{sym, desc}] (기호=canon)
export function parseVariables(variables) {
  if (!variables) return [];
  const text = String(variables).replace(/\r/g, "").replace(/\n/g, " ");
  const pieces = text.split(":");
  if (pieces.length < 2) return [];

  const records = [];
  let pendingSyms = pieces[0]; // 첫 콜론 앞 = 설명 #1 의 기호들
  for (let i = 1; i < pieces.length; i++) {
    const isLast = i === pieces.length - 1;
    const [desc, nextSyms] = isLast
      ? [pieces[i], ""]
      : splitDescAndSyms(pieces[i]);
    const d = desc.trim();
    for (const sy of splitSyms(pendingSyms)) records.push({ sym: sy, desc: d });
    pendingSyms = nextSyms;
  }
  return records;
}

// ---- 차원 분류 ------------------------------------------------------------
// 차원 키. UI/단위메뉴가 이 키로 단위목록을 고른다.
//   length 길이 · force 힘 · dist_load 분포하중 · moment 모멘트 ·
//   stress 응력 · modulus 탄성계수 · area 면적 · Zmod 단면계수(L³) ·
//   inertia 단면2차모멘트(L⁴) · angle 각 · temp 온도 · expansion 선팽창(1/℃) ·
//   dimensionless 무차원 · unknown 미분류
//
// 규칙은 위에서부터 첫 매치. 더 구체적인 것을 먼저 둔다.
const RULES = [
  ["expansion", ["선팽창"]],
  ["inertia", ["2차 모멘트", "2차모멘트", "상승 모멘트", "상승모멘트", "극2차", "극 2차"]],
  ["Zmod", ["1차 모멘트", "1차모멘트", "단면계수"]],
  ["length", ["2차 반경", "2차반경", "회전 반경", "회전반경"]],
  ["modulus", ["탄성계수", "영계수"]],
  ["stress", ["응력도", "강도"]],
  ["moment", ["모멘트"]],
  ["dist_load", ["등분포하중", "분포하중"]],
  ["force", ["축력", "전단력", "반력", "집중하중", "하중", "방향력", "힘"]],
  ["area", ["단면적", "면적"]],
  ["temp", ["온도"]],
  ["angle", ["처짐각", "회전각", "비틀림각", "경사각", "각도"]],
  ["dimensionless", ["변형도"]],
  ["dimensionless", ["포아송", "형상계수", "안전율", "안전계수", "분배율", "확대계수"]],
  ["length", [
    "길이", "거리", "폭", "너비", "높이", "두께", "변형량", "처짐", "반경",
    "반지름", "지름", "굵기", "편심", "지간", "스팬", "간격", "도심", "춤", "径",
  ]],
  ["angle", ["각"]],
  ["dimensionless", ["계수", "포아송비", "비", "수"]],
];

/** 한글 설명 → 차원 키. */
export function classifyDesc(desc) {
  if (!desc) return "unknown";
  const d = String(desc);
  for (const [dim, keys] of RULES) {
    for (const k of keys) {
      if (d.includes(k)) return dim;
    }
  }
  return "unknown";
}

// ---- 케이스 → 기호별 차원 맵 ----------------------------------------------
// 케이스의 모든 결과행 변수설명을 모아 canon기호 → 차원 맵을 만든다.
// (뒤 정의가 앞을 덮는다: 대개 동일 기호는 같은 차원이라 무해)
export function buildDimensionMap(c) {
  const map = new Map();
  for (const r of c.results || []) {
    if (!r.variables) continue;
    for (const { sym, desc } of parseVariables(r.variables)) {
      if (!sym) continue;
      const dim = classifyDesc(desc);
      // 이미 알려진 차원을 unknown 으로 덮지 않는다.
      const prev = map.get(sym);
      if (prev && prev !== "unknown" && dim === "unknown") continue;
      map.set(sym, dim);
    }
  }
  return map;
}
