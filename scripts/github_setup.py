"""Apply prepared GitHub labels/milestones/settings with an already authenticated gh CLI.
Does not invite users, change visibility, push code, merge PRs or deploy.
Default is dry-run. --apply performs exactly the documented metadata writes.
"""
import argparse,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; REPO='WB-DevWorld/cetech-pwa-pos'
def api(method,path,payload=None):
    cmd=['gh','api','--method',method,path]
    if payload is not None:cmd+=['--input','-']
    r=subprocess.run(cmd,input=json.dumps(payload) if payload is not None else None,text=True,capture_output=True)
    if r.returncode:raise SystemExit(r.stderr)
    return json.loads(r.stdout) if r.stdout.strip() else None
p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');p.add_argument('--with-protection',action='store_true');a=p.parse_args()
labels=json.loads((ROOT/'.github/bootstrap/labels.json').read_text()); milestones=json.loads((ROOT/'.github/bootstrap/milestones.json').read_text())
if not a.apply:
    print(f'DRY RUN: {REPO}; {len(labels)} labels, {len(milestones)} milestones, issue metadata, settings.' )
    print('Protection requested:',a.with_protection);raise SystemExit(0)
from urllib.parse import quote
for label in labels:
    # Inspect exact resource to make repeated runs safe.
    names=api('GET',f'repos/{REPO}/labels?per_page=100')
    exists=any(x['name']==label['name'] for x in names)
    api('PATCH' if exists else 'POST',f'repos/{REPO}/labels'+('/'+quote(label['name'],safe='') if exists else ''),label)
existing=api('GET',f'repos/{REPO}/milestones?state=all&per_page=100'); mapping={}
for m in milestones:
    match=next((x for x in existing if x['title']==m['title']),None)
    if match is None:match=api('POST',f'repos/{REPO}/milestones',{'title':m['title'],'description':m['description']})
    mapping[m['key']]=match['number']
issue_map_path=ROOT/'.github/bootstrap/issue-map.json'
if issue_map_path.exists():
    issue_map=json.loads(issue_map_path.read_text())
    for item in json.loads((ROOT/'.github/bootstrap/issues.json').read_text()):
        n=issue_map.get(item['task_id'],{}).get('number')
        if n:api('PATCH',f'repos/{REPO}/issues/{n}',{'labels':item['labels'],'milestone':mapping[item['milestone']]})
api('PATCH',f'repos/{REPO}',{'has_issues':True,'allow_squash_merge':True,'allow_merge_commit':False,'allow_rebase_merge':False,'delete_branch_on_merge':True})
if a.with_protection:
    api('PUT',f'repos/{REPO}/branches/main/protection',json.loads((ROOT/'.github/bootstrap/main-protection.json').read_text()))
print('Metadata configured. Verify actual rules/identities/CI in GitHub; no production actions performed.')
