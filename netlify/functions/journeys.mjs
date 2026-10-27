const HEAD={"Content-Type":"application/json","Cache-Control":"no-store"};
const HUBS=[["Waterloo","Waterloo Station"],["London Bridge","London Bridge Station"],["King's Cross","King's Cross St Pancras Station"],["Victoria","Victoria Station"],["Oxford Circus","Oxford Circus Underground Station"],["Liverpool Street","Liverpool Street Station"]];
const respond=(code,data)=>({statusCode:code,headers:HEAD,body:JSON.stringify(data)});
async function minutes(from,to){
 const url=new URL("https://api.tfl.gov.uk/Journey/JourneyResults/"+encodeURIComponent(from)+"/to/"+encodeURIComponent(to));
 url.searchParams.set("mode","tube,overground,elizabeth-line,dlr,bus,national-rail");
 if(process.env.TFL_APP_KEY)url.searchParams.set("app_key",process.env.TFL_APP_KEY);
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);
 try{
 const res=await fetch(url,{signal:controller.signal});
 if(!res.ok)return null;
 const data=await res.json();
 const times=(data.journeys||[]).map(j=>j.duration).filter(n=>Number.isFinite(n)&&n>=0);
 return times.length?Math.min(...times):null;
 }catch{return null}finally{clearTimeout(timer)}
}
export const handler=async event=>{
 if(event.httpMethod!=="POST")return respond(405,{error:"POST required"});
 let b;try{b=JSON.parse(event.body||"{}")}catch{return respond(400,{error:"Invalid request"})}
 const origins=Array.isArray(b.origins)?b.origins:[];
 const preferences=Array.isArray(b.preferences)?b.preferences.filter(x=>typeof x==="string"&&x.trim().length>1&&x.length<=90).map(x=>x.trim()):[];
 if(origins.length<2||origins.length>6||origins.some(x=>typeof x.from!=="string"||x.from.length>100||typeof x.name!=="string"||x.name.length>40))return respond(400,{error:"Two to six guest origins are required for TfL comparison."});
 try{
 // Limited candidate hubs and concurrency to respect TfL's free anonymous API quota.
 const hubs=[];
 // Limit the comparison to six combinations at once; avoid long serial waits.
 const candidates=[...HUBS];for(const area of preferences){if(!candidates.some(x=>x[0].toLowerCase()===area.toLowerCase()))candidates.push([area,area+", London"]);}const limited=candidates.slice(0,10);
 const tasks=limited.flatMap(([name,stop])=>origins.map(g=>({name,stop,g})));
 const computed=[];
 for(let i=0;i<tasks.length;i+=6){
  const batch=tasks.slice(i,i+6);
  computed.push(...await Promise.all(batch.map(async t=>({hub:t.name,name:t.g.name,minutes:await minutes(t.g.from,t.stop)}))));
 }
 for(const [name] of limited){
  const journeys=computed.filter(t=>t.hub===name).map(t=>({name:t.name,minutes:t.minutes}));
  const valid=journeys.every(j=>j.minutes!==null);
  const avg=valid?journeys.reduce((a,j)=>a+j.minutes,0)/journeys.length:null;const votes=preferences.filter(p=>p.toLowerCase()===name.toLowerCase()).length;
  hubs.push({name,journeys,worst:valid?Math.max(...journeys.map(j=>j.minutes)):null,average:avg,votes});
 }
 hubs.sort((a,b)=>(a.worst??Infinity)-(b.worst??Infinity)||(b.votes-a.votes)||(a.average??Infinity)-(b.average??Infinity));
 const eligible=hubs.filter(h=>h.worst!==null);if(eligible.length){const min=eligible[0].worst;const near=eligible.filter(h=>h.worst<=min+10);near.sort((a,b)=>b.votes-a.votes||a.worst-b.worst||a.average-b.average);const best=near[0];hubs.splice(hubs.indexOf(best),1);hubs.unshift(best);}
 return respond(200,{hubs,recommendation:hubs.find(h=>h.worst!==null)||null,method:"Minimise the longest TfL journey; within 10 minutes of the shortest worst-case journey, favour popular guest destination preferences."});
 return respond(200,{hubs});
 }catch{return respond(502,{error:"TfL journey comparison is temporarily unavailable."})}
};