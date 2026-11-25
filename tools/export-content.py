import json,re,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'dist'; OUT.mkdir(exist_ok=True,parents=True)
data=json.loads((ROOT/'content/library.json').read_text(encoding='utf-8'))
ids=['start','python','llms','rag','vectors','evaluation','agents','backend','gpu','training','sql','deployment','domains','resume','mock','tooling','systems','ml','aws']
short=['Start here','Python','LLMs & transformers','RAG & retrieval','Vectors & ingestion','Evaluation','Agents & MCP','Backend & SDKs','GPU & vLLM','LoRA, QLoRA & ML','SQL Copilot','Cloud & full stack','Domain scenarios','Resume prep','Mock interviews','Frameworks & observability','Production scenarios','ML foundations','AWS & scaling']
cats=['Practice','Foundations','Foundations','Retrieval','Retrieval','Operations','Build','Build','Operations','Foundations','Build','Operations','Practice','Practice','Practice','Build','Practice','Foundations','Operations']
topics=[]
for i,d in enumerate(data['documents']):
    sections=[];qs=[];intro=[];section='Overview';q=None;code=[];incode=False
    def flush():
        global q
        if q:
            q['id']=ids[i]+'-'+hashlib.sha1(q['title'].encode()).hexdigest()[:10]
            q['search']=' '.join([q['title'],q['section']]+[b['text'] for b in q['blocks']]+[f['question']+' '+f['answer'] for f in q['followups']]).lower()
            q['kind']='Scenario' if ids[i] in ['systems','domains','mock'] or 'scenario' in q['title'].lower() or (ids[i]=='start' and len(qs)==0) else 'Foundation' if re.search(r'foundation|glossary|definitions|basics',q['section'],re.I) or re.match(r'What (is|are|does) ',q['title']) else 'Deep dive'
            qs.append(q);q=None
    for line in d['body'].splitlines():
        if line=='Code:':incode=True;code=[];continue
        if incode:
            if line=='EndCode:':
                if q:q['blocks'].append({'label':'Code','text':'\n'.join(code)})
                incode=False
            else:code.append(line)
            continue
        if line.startswith('# '):flush();section=line[2:];sections.append(section)
        elif line.startswith('## '):flush();q={'title':line[3:],'section':section,'blocks':[],'followups':[]}
        elif line.startswith('Follow-up:'):
            a,b=line[len('Follow-up:'):].strip().split(' | ',1)
            q['followups'].append({'question':a,'answer':b})
        elif ': ' in line:
            label,txt=line.split(': ',1)
            if q:q['blocks'].append({'label':label,'text':txt})
            elif label in ('Note','Architecture'):intro.append({'label':label,'text':txt})
    flush()
    topics.append({'id':ids[i],'title':short[i],'fullTitle':d['title'],'description':d['subtitle'],'category':cats[i],'pdf':d['file'],'sections':sections,'intro':intro,'questions':qs,'sources':[{'title':data['sources'][s][0],'url':data['sources'][s][1]} for s in d['sources']]})
quiz=json.loads((ROOT/'content/mcp-quiz.json').read_text(encoding='utf-8'))
mcp=[]
for row in quiz['questions']:
    q={'id':row['id'],'title':row['prompt'],'section':row['tag'],'kind':'Scenario' if row['tag']=='Incident' else 'Foundation','blocks':[{'label':'Simple','text':row['explanation']},{'label':'Technical','text':row['technical']}],'followups':[{'question':a,'answer':b} for a,b in row['followups']]}
    q['search']=' '.join([q['title']]+[b['text'] for b in q['blocks']]+[f['question']+' '+f['answer'] for f in q['followups']]).lower()
    mcp.append(q)
topics.append({'id':'mcp','title':'MCP preparation','fullTitle':'Model Context Protocol: concepts and practice','description':quiz['description'],'category':'Build','pdf':'public-mcp.pdf','sections':list(dict.fromkeys(q['section'] for q in mcp)),'intro':[{'label':'Note','text':quiz['reference']}],'questions':mcp,'sources':quiz['sources']})

# Do not ship protected project answers or their full PDFs in the static site.
from copy import deepcopy
restricted=re.compile(r'sql\s*copilot|memorae?(?:[\s_-]*ai)?',re.I)
public=[];private=[];protected=[]
for original in topics:
    hidden=[q for q in original['questions'] if restricted.search(json.dumps(q,ensure_ascii=False)) or original['id']=='sql' and q['section']=='Plan before generating']
    if hidden:
        secured=deepcopy(original);secured['privatePdf']=original['pdf']
        for q in secured['questions']:q['adminOnly']=q in hidden
        private.append(secured);protected.extend(q['id'] for q in hidden)
    safe=deepcopy(original)
    safe['questions']=[q for q in safe['questions'] if q['id'] not in protected]
    if not safe['questions']:continue
    safe['intro']=[b for b in safe['intro'] if not restricted.search(b['text'])]
    safe['sections']=list(dict.fromkeys(q['section'] for q in safe['questions']))
    if safe['id']=='sql':
        safe.update(title='SQL & databases',fullTitle='SQL and database fundamentals',description='Queries, joins, transactions, schemas and database reasoning')
    safe['description']=restricted.sub('SQL applications',safe['description'])
    safe['pdf']='public-'+safe['id']+'.pdf'
    public.append(safe)
obj={'version':2,'edition':'25 November 2026','topics':public}
(ROOT/'server').mkdir(exist_ok=True)
(ROOT/'server/private-data.json').write_text(json.dumps({'topics':private,'protectedIds':protected},ensure_ascii=False),encoding='utf-8')
(OUT/'data.js').write_text('window.PREP_DATA = '+json.dumps(obj,ensure_ascii=False)+';\n',encoding='utf-8')
(OUT/'quiz-data.js').write_text('window.PREP_QUIZZES = '+json.dumps({'mcp':quiz},ensure_ascii=False)+';\n',encoding='utf-8')
assert not restricted.search(json.dumps(obj,ensure_ascii=False)), 'Protected project content reached the public bundle'
print(json.dumps({'publicTopics':len(public),'publicQuestions':sum(len(t['questions']) for t in public),'protectedProjectQuestions':len(protected),'mcpQuizQuestions':len(mcp)}))
