const test=require('node:test'),assert=require('node:assert/strict');
const study=require('../dist/study-tools.js');
test('calendar dates cross leap day and year boundaries without elapsed-hour assumptions',()=>{
 assert.equal(study.shift('2024-02-28',1),'2024-02-29');
 assert.equal(study.shift('2024-02-29',1),'2024-03-01');
 assert.equal(study.shift('2026-12-31',1),'2027-01-01');
 assert.equal(study.shift('2026-03-08',1),'2026-03-09');
 assert.equal(study.validDay('2026-02-30'),false);
});
test('daily choice is stable through the day and changes on the next day',()=>{
 const pool=Array.from({length:379},(_,id)=>({id}));
 assert.equal(study.dailyQuestion(pool,'2026-11-25'),study.dailyQuestion(pool,'2026-11-25'));
 assert.notEqual(study.dailyQuestion(pool,'2026-11-25'),study.dailyQuestion(pool,'2026-11-26'));
 assert.equal(study.dailyQuestion([]),null);
});
test('streak remains alive until today is over and breaks after a missed full day',()=>{
 const days=['2026-11-22','2026-11-23','2026-11-24'];
 assert.equal(study.streak(days,'2026-11-25').current,3);
 assert.equal(study.streak(days,'2026-11-26').current,0);
 assert.equal(study.streak(days,'2026-11-25').todayDone,false);
});
test('repeated actions count one day and best streak survives a later gap',()=>{
 const result=study.streak(['2026-11-20','2026-11-21','2026-11-22','2026-11-25','2026-11-25'],'2026-11-25');
 assert.equal(result.current,1);assert.equal(result.best,3);assert.equal(result.total,4);assert.equal(result.week.length,7);
});
test('malformed and future activity dates do not inflate a streak',()=>{
 assert.deepEqual(study.cleanDays(['2099-01-01','2026-02-30',{},'2026-11-25'],'2026-11-25'),['2026-11-25']);
 assert.equal(study.streak(undefined,'2026-11-25').current,0);
});
test('worked attention and temperature numerical examples are internally consistent',()=>{
 const softmax=(z,T=1)=>{const ex=z.map(x=>Math.exp(x/T-Math.max(...z.map(x=>x/T))));return ex.map(x=>x/ex.reduce((a,b)=>a+b,0));};
 assert(Math.abs(softmax([2,1,0])[0]-0.66524)<0.0001);
 assert(Math.abs(softmax([2,1,0],2)[0]-0.50648)<0.0001);
 const a=softmax([1/Math.sqrt(2),0]);assert(Math.abs(a[0]*10-6.6976)<0.001);assert(Math.abs(a[1]*20-6.6048)<0.001);
});
