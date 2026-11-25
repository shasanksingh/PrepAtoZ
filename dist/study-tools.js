'use strict';
// Local calendar dates are used consistently, including across DST changes.
((root) => {
  const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function ordinal(key) { const [y,m,d] = key.split('-').map(Number); return Math.floor(Date.UTC(y,m-1,d)/86400000); }
  function validDay(key) { if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false; const n=ordinal(key); return Number.isFinite(n) && new Date(n*86400000).toISOString().slice(0,10)===key; }
  function shift(key, n) { return new Date((ordinal(key)+n)*86400000).toISOString().slice(0,10); }
  function cleanDays(days, today=dayKey()) { return [...new Set((Array.isArray(days)?days:[]).filter(d=>validDay(d)&&d<=today))].sort().slice(-400); }
  function streak(days, today=dayKey()) {
    const dates=cleanDays(days,today), set=new Set(dates); let best=0,count=0,previous;
    for(const date of dates){count=previous&&ordinal(date)===ordinal(previous)+1?count+1:1;best=Math.max(best,count);previous=date;}
    let current=0,cursor=set.has(today)?today:shift(today,-1);while(set.has(cursor)){current++;cursor=shift(cursor,-1);}
    return {current,best,total:dates.length,todayDone:set.has(today),days:dates,week:Array.from({length:7},(_,i)=>{const day=shift(today,i-6);return {day,done:set.has(day)};})};
  }
  function dailyQuestion(questions,today=dayKey()) { return questions.length?questions[((ordinal(today)%questions.length)+questions.length)%questions.length]:null; }
  const api={dayKey,ordinal,validDay,shift,cleanDays,streak,dailyQuestion};
  if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.PrepStudy=api;
})(typeof window!=='undefined'?window:globalThis);
