# 구조공식집 웹앱 — 프로젝트 안내 (Claude 세션 시작점)

**전체 계획·진행상태·다음 할 일은 [PLAN.md](PLAN.md) 참조.** 여기는 요약.

## 무엇을 만드는가
구조공식집(재료역학·단면·보·연속보·라멘·아치)을 트리로 탐색 → 공식 선택 →
삽도·수식·변수 표시 → (최종 목표) 제원 입력 시 결과 계산하는 웹앱.

## 구조
```
공식엑셀/                  원본 엑셀 7개 (분류별). 열: Page, NO, [형태], [하중], 공식이름, LaTeX, 변수설명
삽도/                      삽도 PNG. 파일명 = 공식번호 (예: 2.3.1.png)
scripts/import_excel.py    엑셀+삽도 → app/src/data/formulas.json + app/public/figures/
app/                       Vite8 + React19 + TS 웹앱
  src/data/formulas.json   변환 산출물 (454 케이스). 직접 편집 금지 — 변환기로 재생성
  src/tree.ts              트리 빌더 / 검색
  src/components/          TreeView, FormulaDetail, Katex
  public/figures/          삽도 (변환기가 복사)
```

## 실행
```bash
python scripts/import_excel.py          # 자료 재생성 (엑셀·삽도 바뀌면)
cd app && npm install && npm run dev     # http://localhost:5173
```
Windows에서 빌드가 rolldown 네이티브 바이너리 오류 나면:
`cd app && npm install @rolldown/binding-win32-x64-msvc --no-save`

## 현재 단계
- **Phase 1 (공식 사전) 완료**: 트리·삽도·KaTeX 수식·변수·검색 동작.
- **다음**: (a) 배포(Vercel/GH Pages), (b) **Phase 2 계산기** — 엑셀엔 표시용 LaTeX만
  있으므로 결과행마다 `expr`(계산식)을 주입해야 함. 단순보/캔틸레버 Mmax·δmax·반력부터
  프로토타입 → 방식 확정 후 확장 권장.

## 데이터 모델 (formulas.json 한 케이스)
`{ category, categoryOrder, subCategory, id, classes[], page, figure, desc, results[] }`
`results[] = { name, latex, variables, expr(=null, Phase2), outputs([], Phase2) }`
케이스 = 엑셀에서 NO(공식번호)로 묶은 행 그룹. 트리 경로 = category → (sheet) → classes.
