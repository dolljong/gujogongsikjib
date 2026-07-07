export interface Result {
  name: string | null;
  latex: string | null;
  variables: string | null;
  expr: string | null; // Phase 2: 계산식
  outputs: unknown[]; // Phase 2
}

export interface Case {
  category: string;
  categoryOrder: number;
  subCategory: string | null;
  id: string;
  classes: string[];
  page: number | string | null;
  figures: string[];
  desc: string | null;
  results: Result[];
}

// 트리 노드
export interface TreeNode {
  key: string; // 경로 고유 키
  label: string;
  children: TreeNode[];
  caseRef?: Case; // 리프면 케이스
  count: number; // 하위 케이스 수
}
