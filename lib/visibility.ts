export type Daily={date:string;search_clicks:number|null;search_impressions:number|null;search_position_sum?:number|null;analytics_organic_sessions:number|null;ai_referral_sessions:number|null};
export type Alert={title:string;confidence:"high"|"medium"|"low";started:string;evidence:string;action:string};
export function diagnoseTraffic(rows:Daily[],days=7,dropPercent=40,minBaseline=20):Alert[]{
  const complete=rows.filter(r=>r.date<=new Date(Date.now()-3*86400000).toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date));
  const current=complete.slice(-days),previous=complete.slice(-days*2,-days);
  if(current.length<days||previous.length<days)return [];
  const sum=(data:Daily[],key:"search_clicks"|"analytics_organic_sessions")=>data.every(r=>r[key]!==null)?data.reduce((n,r)=>n+(r[key]??0),0):null;
  const sc=sum(current,"search_clicks"),oldSc=sum(previous,"search_clicks"),ga=sum(current,"analytics_organic_sessions"),oldGa=sum(previous,"analytics_organic_sessions");
  const fell=(now:number|null,old:number|null)=>now!==null&&old!==null&&old>=minBaseline&&now<=old*(1-dropPercent/100);
  const steady=(now:number|null,old:number|null)=>now!==null&&old!==null&&old>=minBaseline&&now>=old*.8;
  const started=current[0].date;
  if(fell(ga,oldGa)&&steady(sc,oldSc))return [{title:"Website visits fell sharply, while Google Search clicks stayed steady.",confidence:"medium",started,evidence:`Analytics organic sessions: ${oldGa} → ${ga}; Search Console clicks: ${oldSc} → ${sc}. Equal ${days}-day periods ending at least 3 days ago.`,action:"Check the Analytics tag, consent settings, and property selection. Search traffic may still be reaching the site."}];
  if(fell(sc,oldSc))return [{title:"Google Search clicks fell sharply.",confidence:ga!==null&&oldGa!==null&&fell(ga,oldGa)?"high":"medium",started,evidence:`Search Console clicks: ${oldSc} → ${sc}${ga!==null&&oldGa!==null?`; Analytics organic sessions: ${oldGa} → ${ga}`:"; Analytics unavailable"}. Equal ${days}-day periods ending at least 3 days ago.`,action:"Review the affected searches and pages, then check indexing and recent site changes."}];
  if(fell(ga,oldGa))return [{title:"Analytics organic sessions fell; the search comparison is incomplete.",confidence:"low",started,evidence:`Analytics organic sessions: ${oldGa} → ${ga}; Search Console clicks: ${oldSc??"unavailable"} → ${sc??"unavailable"}.`,action:"Check Analytics tracking and connect Search Console to verify whether search clicks changed."}];
  return [];
}
