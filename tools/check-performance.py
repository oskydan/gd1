#!/usr/bin/env python3
"""Fail before publication when public assets exceed reviewed budgets."""
from pathlib import Path
import os,sys
from performance import read_policy,audit,size_label

root=Path(__file__).resolve().parents[1]
try:
    policy=read_policy(root/'data/performance-budgets.json')
    result=audit(root/'dist',policy)
except (ValueError,KeyError) as error:
    print(str(error),file=sys.stderr);raise SystemExit(1)
for kind in ('image','video','package'):
    print(f'{kind.capitalize()}: {size_label(result["totals"].get(kind,0))} / {size_label(policy["totalLimitsBytes"][kind])}')
if result['exceptionsUsed']:print(f'Existing, hash-pinned media exceptions: {len(result["exceptionsUsed"])}; all still count toward totals.')
def escaped(text):return str(text).replace('%','%25').replace('\r','%0D').replace('\n','%0A')
for error in result['errors']:
    if os.environ.get('GITHUB_ACTIONS')=='true':print(f'::error file={escaped(error["file"])}::{escaped(error["message"])}')
    else:print(error['message'],file=sys.stderr)
summary=os.environ.get('GITHUB_STEP_SUMMARY')
if summary:
    with open(summary,'a') as output:
        output.write('### Performance budgets\n\n| Published content | Size | Limit |\n| --- | --- | --- |\n')
        for kind in ('image','video','package'):output.write(f'| {kind} | {size_label(result["totals"].get(kind,0))} | {size_label(policy["totalLimitsBytes"][kind])} |\n')
        output.write(f'\nFiles checked: {len(result["files"])}. Oversized files or total-budget failures: {len(result["errors"])}.\n')
if result['errors']:raise SystemExit(1)
print(f'Passed performance budgets for {len(result["files"])} published files.')
