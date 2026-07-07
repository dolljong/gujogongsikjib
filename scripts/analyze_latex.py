# -*- coding: utf-8 -*-
"""계산기(Phase 2) 설계용: LaTeX 수식이 얼마나 규칙적인지 측정."""
import json, re, os, sys
from collections import Counter

io = sys.stdout
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(ROOT, 'app/src/data/formulas.json'), encoding='utf-8'))

cmds = Counter()
structs = Counter()
n_results = n_latex = 0
by_cat_struct = {}

for c in data:
    cat = c['category']
    for r in c['results']:
        n_results += 1
        tex = r['latex']
        if not tex:
            continue
        n_latex += 1
        if r'\begin{array}' in tex:
            s = 'array(다중식)'
        elif tex.count('=') >= 2:
            s = '연쇄등호(a=b=c)'
        elif '=' in tex:
            s = '단일등식'
        else:
            s = '등호없음'
        structs[s] += 1
        by_cat_struct.setdefault(cat, Counter())[s] += 1
        for m in re.findall(r'\\[a-zA-Z]+', tex):
            cmds[m] += 1

print('결과행:', n_results, '| latex 있음:', n_latex)
print('\n=== 구조 분류 ===')
for k, v in structs.most_common():
    print(f'  {v:5d}  {k}')
print('\n=== LaTeX 명령 빈도 ===')
for k, v in cmds.most_common(40):
    print(f'  {v:5d}  {k}')
print('\n=== 카테고리별 구조 ===')
for cat, cc in by_cat_struct.items():
    print(f'  {cat}: ' + ', '.join(f'{k}={v}' for k, v in cc.most_common()))
