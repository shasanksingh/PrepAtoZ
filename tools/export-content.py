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
obj={'version':2,'edition':'25 November 2026','topics':topics}
(OUT/'data.js').write_text('window.PREP_DATA = '+json.dumps(obj,ensure_ascii=False)+';\n',encoding='utf-8')
print(json.dumps({'topics':len(topics),'questions':sum(len(t['questions']) for t in topics),'followups':sum(len(q['followups']) for t in topics for q in t['questions'])}))
