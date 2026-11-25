const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),ctx);
const topics=ctx.window.PREP_DATA.topics,ids=new Set();
const privateData=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../server/private-data.json'),'utf8'));
assert(!/sql\s*copilot|memorae?/i.test(JSON.stringify(ctx.window.PREP_DATA)),'Protected project material reached the public bundle');
assert(!fs.readdirSync(path.join(root,'pdfs')).some(name=>!name.startsWith('public-')),'An original PDF is publicly accessible');
for(const t of topics){
 assert(t.questions.length>0,`Empty topic: ${t.id}`);
 const pdf=path.join(root,'pdfs',t.pdf);assert(fs.existsSync(pdf),`Missing PDF: ${t.pdf}`);
 assert(fs.readFileSync(pdf).subarray(0,4).toString()==='%PDF',`Invalid PDF: ${t.pdf}`);
 for(const q of t.questions){
  assert(!ids.has(q.id),`Duplicate question ID: ${q.id}`);ids.add(q.id);
  assert(q.blocks.some(b=>b.label==='Simple'&&b.text.trim()),`Missing definition: ${q.title}`);
  assert(q.blocks.some(b=>b.label==='Technical'&&b.text.trim()),`Missing technical answer: ${q.title}`);
  assert(q.blocks.some(b=>b.label==='Example'&&b.text.trim()),`Missing example: ${q.title}`);
  assert(q.followups.length>=2&&q.followups.every(f=>f.question.trim()&&f.answer.trim()),`Incomplete follow-ups: ${q.title}`);
  if(q.title.startsWith('Scenario:'))for(const label of ['Architecture','Metrics','Trade-offs'])assert(q.blocks.some(b=>b.label===label&&b.text.trim()),`Missing ${label}: ${q.title}`);
 }
}
for(const id of privateData.protectedIds)assert(!ids.has(id),`Protected question shipped publicly: ${id}`);
for(const t of privateData.topics){assert(t.privatePdf);assert(fs.existsSync(path.resolve(__dirname,'../private/pdfs',t.privatePdf)),`Missing protected PDF: ${t.id}`);}
const quizCtx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'quiz-data.js'),'utf8'),quizCtx);
const quizIds=new Set();let quizCount=0;
for(const topic of topics){const quiz=quizCtx.window.PREP_QUIZZES[topic.id];assert(quiz?.questions.length,`Missing topic quiz: ${topic.id}`);for(const q of quiz.questions){quizCount++;assert(!quizIds.has(q.id),`Duplicate quiz ID: ${q.id}`);quizIds.add(q.id);assert(q.options.length===4&&Number.isInteger(q.correct)&&q.correct>=0&&q.correct<q.options.length);assert(q.explanation.trim()&&q.technical.trim());assert(new Set(q.options).size===q.options.length);assert(ids.has(q.lessonId),`Quiz lesson missing: ${q.lessonId}`);assert(q.followups.length>=2);}}
assert(quizCount>=100,'Expected at least 100 multi-topic quiz questions');
assert(!/sql\s*copilot|memorae?/i.test(JSON.stringify(quizCtx.window.PREP_QUIZZES)),'Protected project material reached public quiz');
console.log(`Quiz check: ${quizCount} questions across ${topics.length} public tracks.`);
console.log(`PrepAtoZ content check: ${topics.length} tracks, ${ids.size} unique questions, all PDFs and required answers present.`);
