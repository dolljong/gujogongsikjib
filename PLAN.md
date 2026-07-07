# 구조공식집 웹앱 — 계획

## 목표
구조공식집(재료역학·단면·보·연속보·라멘·아치 등)을 트리로 탐색하고,
공식을 선택하면 삽도·수식·변수설명을 보여주며, 최종적으로 제원(변수)을 입력하면
결과를 계산해주는 웹앱.

## 결정 사항
- **방식**: 데이터 주도(JSON). 공식 추가 = 데이터 추가.
- **스택**: React + Vite + TypeScript, mathjs(계산), KaTeX(수식 표시).
- **배포**: 웹 공개 (Vercel/GitHub Pages, 무료). 계산은 전부 브라우저에서 → 서버 불필요.
- **트리 구성**: 분류 → 형태 → 하중별 케이스.
- **최종 목표**: 계산기. 단, 단계적으로 접근.

## 자료 현황
- `공식엑셀/` : 7개 xlsx (분류별), 약 1,370행 / 약 350 케이스.
  공통 열: Page, NO(공식번호), [형태], [하중형태], 공식이름, **LaTeX**, 변수설명.
  ⚠️ 엑셀에는 표시용 **LaTeX만** 있고 계산식은 없음 → 계산기는 별도 수식 주입 필요.
- `삽도/` : 케이스 번호와 파일명 일치 (예: 2.3.1 → `2.3.1.png`). 자동 연결 가능.
  (복사 진행 중 — 일부 폴더만 존재)

## 데이터 모델 (케이스 = NO로 묶은 행 그룹)
```
Case {
  id: "2.3.1", category: "보의 구조역학", categoryOrder: 2,
  classes: ["캔틸레버보", "끝단 집중하중"],   // 형태 → 하중형태
  page: 56, figure: "2.3.1.png",
  results: [
    { name:"휨모멘트 M", latex:"...", variables:"...",
      expr: null,      // Phase 2에서 주입할 계산식
      outputs: [] }    // Phase 2: 출력 기호/단위
  ]
}
```

## 로드맵
- **Phase 1 — 공식 사전 (자동 생성)**
  1. 엑셀→JSON 변환기 (`scripts/import_excel.py`) — 7파일 일괄, NO로 그룹핑, 삽도 연결.
  2. React+Vite 스캐폴드.
  3. 트리 탐색 UI + 상세 화면(삽도 + KaTeX 수식 + 변수설명).
  4. 검색.
  5. 배포.
- **Phase 2 — 계산기 (점진 확장)**
  6. 결과공식에 계산식(expr)+변수 스키마 주입 (많이 쓰는 것부터: Mmax, δmax, 반력…).
  7. 입력폼 자동 생성 + mathjs 계산 + 결과 표시.
  8. 위치 x 의존식·구간(piecewise) 처리.

## 진행 상태
- [x] Phase 1-1 변환기 (`scripts/import_excel.py`) — 454케이스/1368수식, 삽도 **426** 연결
      (다중삽도 지원: `<id>.N.png` 여러 장 → `figures[]` 배열. 라멘 3.6·3.8 등 복구)
- [x] Phase 1-2 스캐폴드 (Vite8+React19+TS, katex, mathjs) — `app/`
- [x] Phase 1-3 트리/상세 UI — 분류→형태→하중 트리 + 삽도 + KaTeX + 변수
- [x] Phase 1-4 검색 — 공식명/변수/번호 전문검색
- [ ] Phase 1-5 배포 (Vercel/GH Pages)
- [x] **Phase 2 계산기 프로토타입 — LaTeX 동적 변환 방식**
      표시용 LaTeX를 mathjs 식으로 자동 변환(별도 수식 주입 불필요).
      - `app/src/calc/latex.js` : LaTeX→mathjs 트랜스파일러 (frac·cdot·^·_·sqrt·그리스·삼각·암묵곱)
      - `app/src/calc/evaluate.ts` : 자유변수 추출·입력집합·의존식 반복해석(solve)
      - `app/src/components/Calculator.tsx` : 입력폼 자동생성 → 결과 표시
      - 커버리지 `scripts/probe_coverage.mjs`: **변환 99.6% / 변환+평가 97.2%**
      - 정확성 `scripts/probe_correct.mjs`: 알려진 공식 8/8 일치. 브라우저 검증 OK
      - **계산과정 표시**: `출력 = 원식 = 값대입 = 최종값` 한 줄(KaTeX). 대입값 6자리 반올림.
      - **의존식 연결**: 앞 수식 결과를 뒤 수식이 사용(`solve` 반복대입). 연쇄등호
        `H=H_A=-H_D` 의 모든 별칭을 부호까지 scope 등록. 동일식 중복은 1회만.
      - **변수설명도 LaTeX 렌더**(`symbols.ts`). 각 수식마다 결과 표시(미지원식도 노출).
      - 트랜스파일러 핵심 교훈:
        · `E/e/φ/τ` 는 mathjs 상수가 아니라 **입력변수**로 취급(KNOWN=π만).
        · 붙은 낱글자(`wl`,`EI`,`Pl`)는 **곱으로 분리**(변수는 단일문자·곱은 공백생략).
        · `\Delta v` 는 곱이 아니라 한 변수 Δv.
- [ ] Phase 2 잔여: 위치변수 x 슬라이더/그래프, piecewise 도메인 UI, 단위, 실패 3%(적분 등) 처리

## 실행 방법
```
python scripts/import_excel.py     # 엑셀/삽도 → app/src/data + app/public/figures
cd app && npm install && npm run dev
```
설치 시 Windows에서 rolldown 네이티브 바이너리 누락되면:
`npm install @rolldown/binding-win32-x64-msvc --no-save`

## 남은 자료 이슈
- 삽도 3·4·5 폴더 복사 완료되면 `import_excel.py` 재실행 → 삽도 커버리지 증가.
- 계산기(Phase 2): 결과행마다 `expr`(계산식)·변수 스키마 주입 필요. LaTeX만 있으므로
  자동 초벌 변환 + 검증. 많이 쓰는 결과공식(Mmax, δmax, 반력)부터.
