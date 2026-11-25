const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),ctx);
const topics=ctx.window.PREP_DATA.topics,ids=new Set();
for(const t of topics){
 assert(t.questions.length>0,`Empty topic: ${t.id}`);
 const pdf=path.join(root,'pdfs',t.pdf);assert(fs.existsSync(pdf),`Missing PDF: ${t.pdf}`);
 assert(fs.readFileSync(pdf).subarray(0,4).toString()==='%PDF',`Invalid PDF: ${t.pdf}`);
 for(const q of t.questions){
  assert(!ids.has(q.id),`Duplicate question ID: ${q.id}`);ids.add(q.id);
  assert(q.blocks.some(b=>b.label==='Simple'&&b.text.trim()),`Missing definition: ${q.title}`);
  assert(q.blocks.some(b=>b.label==='Technical'&&b.text.trim()),`Missing technical answer: ${q.title}`);
  assert(q.followups.length>=2&&q.followups.every(f=>f.question.trim()&&f.answer.trim()),`Incomplete follow-ups: ${q.title}`);
  if(q.title.startsWith('Scenario:'))for(const label of ['Architecture','Metrics','Trade-offs'])assert(q.blocks.some(b=>b.label===label&&b.text.trim()),`Missing ${label}: ${q.title}`);
 }
}
console.log(`PrepAtoZ content check: ${topics.length} tracks, ${ids.size} unique questions, all PDFs and required answers present.`);
