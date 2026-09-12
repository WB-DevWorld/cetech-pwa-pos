"""Dependency-free foundation validation, NOT runtime/financial correctness certification.
Validates this contract's explicit JSON Schema subset; use a maintained full validator
in application and producer/consumer tests after CP-05. Fails on unsupported keywords.
"""
from pathlib import Path
import json,re,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from generate_contract_types import generate
from reference_integrity import inspect_reference
errors=[]
def require(ok,message):
    if not ok:errors.append(message)
def read(path):return json.loads((ROOT/path).read_text(encoding='utf-8'))
required=['AGENTS.md','PROJECT-CONSTITUTION.md','SOURCE-OF-TRUTH.md','OWNERSHIP.md','CURRENT-WORK.md','LIVE-ENVIRONMENT-FACTS.md','CONTRIBUTING.md','README.md','.env.example','.github/CODEOWNERS','.github/workflows/ci.yml','docs/plans/START-NOW.md','docs/integration/READINESS.md']
for path in required:require((ROOT/path).is_file(),'Missing '+path)
work=list((ROOT/'docs/workstreams').glob('WS-*'))
require(len(work)==3,'Exactly three workstream packages required')
headings=['Mission','Production Outcome','Scope','Out of Scope','Canonical Owners','Inputs','Outputs','File Ownership','Protected / Forbidden Files','Dependencies','Milestones','Task Sequence','Integration Points','Test Requirements','Failure Cases','Security Requirements','Performance Requirements','Definition of Done','STOP / Escalation Conditions','Handoff Requirements']
for p in work:
    for f in ['README.md','IMPLEMENTATION-PLAN.md','BOUNDARIES.md','CONTRACTS.md','TASKS.md','ACCEPTANCE.md','STATUS.md','HANDOFF.md']:require((p/f).is_file(),'Missing '+str(p/f))
    plan=(p/'IMPLEMENTATION-PLAN.md').read_text(encoding='utf-8')
    for h in headings:require('## '+h in plan,str(p.name)+' missing plan heading '+h)
manifest=read('reference/frontend-approved/SHA256SUMS.json');base=ROOT/'reference/frontend-approved/artifact'
reference_errors, _ = inspect_reference(base, manifest)
errors.extend(reference_errors)
require((ROOT/'docs/contracts/domain.generated.ts').read_text(encoding='utf-8')==generate(),'Generated TS differs; regenerate from schema')
# All local JSON pointers resolve, including shared OpenAPI references.
def pointers(node,file):
    if isinstance(node,dict):
        if '$ref' in node:
            ref=node['$ref'];path,_,frag=ref.partition('#')
            require(not path.startswith(('http:','https:')),'External dynamic ref forbidden '+ref)
            target=(file.parent/path).resolve() if path else file
            try:
                value=json.loads(target.read_text(encoding='utf-8'))
                for key in frag.lstrip('/').split('/') if frag else []:value=value[key.replace('~1','/').replace('~0','~')]
            except Exception as e:errors.append(f'Unresolved {ref} in {file}: {e}')
        for v in node.values():pointers(v,file)
    elif isinstance(node,list):
        for v in node:pointers(v,file)
for file in (ROOT/'docs/contracts').glob('*.json'):pointers(json.loads(file.read_text(encoding='utf-8')),file)
defs=read('docs/contracts/pos-domain.schema.json')['$defs']
allowed={'$ref','type','properties','required','additionalProperties','items','minItems','maxItems','minLength','maxLength','pattern','minimum','maximum','enum','const','oneOf'}
def schema_keywords(s):
    require(not(set(s)-allowed),'Unsupported fixture-validator schema keyword(s): '+str(set(s)-allowed))
    for child in s.get('properties',{}).values():schema_keywords(child)
    if 'items'in s:schema_keywords(s['items'])
    for child in s.get('oneOf',[]):schema_keywords(child)
for s in defs.values():schema_keywords(s)
def validate(s,v):
    if '$ref' in s:return validate(defs[s['$ref'].split('/')[-1]],v)
    if 'oneOf'in s:return sum(validate(x,v) for x in s['oneOf'])==1
    if 'const'in s:return type(v)==type(s['const']) and v==s['const']
    if 'enum'in s and v not in s['enum']:return False
    t=s.get('type')
    if t=='object':
        if not isinstance(v,dict):return False
        if any(k not in v for k in s.get('required',[])):return False
        if s.get('additionalProperties') is False and set(v)-set(s['properties']):return False
        return all(validate(s['properties'][k],x) for k,x in v.items())
    if t=='array':return isinstance(v,list) and len(v)>=s.get('minItems',0) and len(v)<=s.get('maxItems',10**9) and all(validate(s['items'],x) for x in v)
    if t=='integer':return type(v)==int and s.get('minimum',-float('inf'))<=v<=s.get('maximum',float('inf'))
    if t=='string':return isinstance(v,str) and s.get('minLength',0)<=len(v)<=s.get('maxLength',10**9) and ('pattern' not in s or re.search(s['pattern'],v) is not None)
    if t=='boolean':return type(v)==bool
    if t=='null':return v is None
    raise ValueError('Unsupported schema: '+str(s))
fixtures=read('tests/contracts/fixtures.json')
for f in fixtures:require(validate(defs[f['schema']],f['value'])==f['valid'],'Fixture failed: '+f['name'])
policy=read('docs/contracts/error-policy.json')
require(set(x['code'] for x in policy)==set(defs['ApiErrorCode']['enum']),'Error enum/policy drift')
state=read('docs/contracts/SALE-STATE-MACHINE.json')
require(all(x['from']not in state['terminal'] for x in state['transitions']),'Terminal sale state has effectful exit')
require(any(x['from']=='finalizing' and x['to']=='completed' for x in state['transitions']),'Finalization boundary absent')
for fn in ['pos-api.openapi.json','bridge-api.openapi.json']:
    spec=read('docs/contracts/'+fn); ids=[]
    require(spec['info']['version']=='1.0.0','Version drift '+fn)
    for path,methods in spec['paths'].items():
        for method,op in methods.items():
            ids.append(op['operationId']);require(bool(spec.get('security')),'Unauthenticated API '+fn)
            names={p['name'] for p in op.get('parameters',[])}
            require('X-Correlation-ID' in names,'Missing correlation '+path)
            if any(x in op['operationId'].lower() for x in ['prepare','finalize','cash','openshift','closeshift','executereturn','cancel']):require('Idempotency-Key' in names,'Missing mutation key '+path)
    require(len(ids)==len(set(ids)),'Duplicate operation IDs '+fn)
# Validate task coverage and dependency DAG.
tasks=read('.github/bootstrap/tasks.json');table={x['id']:x for x in tasks}
require(len(tasks)==len(table),'Duplicate task ID')
seen=set();active=set()
def visit(id):
    if id in active:errors.append('Dependency cycle '+id);return
    if id in seen:return
    active.add(id)
    for dep in table[id]['deps'].split(', '):
        if dep=='none':continue
        if dep not in table:errors.append('Unknown prerequisite '+dep)
        else:visit(dep)
    active.remove(id);seen.add(id)
for id in table:visit(id)
for t in tasks:require(t['ws'] in [1,2,3] and all(t[k] for k in ['allowed','contracts','steps','acceptance','risk']),'Incomplete task '+t['id'])
for issue in read('.github/bootstrap/issues.json'):
    for heading in ['Objective','Context','Workstream','Owner','Allowed Files','Forbidden Files','Contracts','Dependencies','Implementation Steps','Acceptance Criteria','Required Tests','Risks','Definition of Done','Handoff']:require('## '+heading in issue['body'],'Incomplete issue '+issue['task_id']+': '+heading)
SKIP_WALK_PARTS={'.git','artifact','node_modules','.next','playwright-report','test-results','coverage','dist','out'}
def skipped(path):
    return any(part in SKIP_WALK_PARTS for part in path.parts)
# Actual Markdown local file links outside the immutable source must resolve.
for p in ROOT.rglob('*.md'):
    if skipped(p):continue
    for link in re.findall(r'\]\(([^)]+)\)',p.read_text(encoding='utf-8')):
        if link.startswith(('http:','https:','#','mailto:')):continue
        link=link.split('#')[0]
        if link:require((p.parent/link).exists(),'Broken file link '+str(p.relative_to(ROOT))+' -> '+link)
# Obvious secret patterns are a tripwire, not a complete secret scanner.
patterns=[r'ghp_[A-Za-z0-9]{30,}',r'github_pat_[A-Za-z0-9_]{30,}',r'sk_live_[A-Za-z0-9]{16,}',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----']
for p in ROOT.rglob('*'):
    if not p.is_file() or skipped(p) or p.suffix in ['.png','.zip','.pyc']:continue
    text=p.read_text(encoding='utf-8',errors='ignore')
    for pat in patterns:require(re.search(pat,text)is None,'Possible secret in '+str(p.relative_to(ROOT)))
if errors:
    print('\n'.join('FAIL: '+x for x in errors));raise SystemExit(1)
print(f'PASS: 3 workstream packages, {len(tasks)} scoped tasks/DAG, {len(manifest)} immutable reference files, {len(defs)} schemas, {len(fixtures)} contract fixtures, shared OpenAPI refs, generated types, errors/state guards, local links and secret tripwires.')
print('LIMIT: no application/bridge/RLS/live payment/pricing/hardware tests have run in this foundation check.')
