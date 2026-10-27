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
 if(origins.length<2||origins.length>6||origins.some(x=>typeof x.from!=="string"||x.from.length>100||typeof x.name!=="string"||x.name.length>40))return respond(400,{error:"Two to six guest origins are required for TfL comparison."});
 try{
 // Limited candidate hubs and concurrency to respect TfL's free anonymous API quota.
 const hubs=[];
 for(const [name,stop] of HUBS){
  const journeys=[];
  for(const guest of origins){
   const t=await minutes(guest.from,stop);
   journeys.push({name:guest.name,minutes:t});
  }
  const valid=journeys.every(j=>j.minutes!==null);
  hubs.push({name,journeys,worst:valid?Math.max(...journeys.map(j=>j.minutes)):null});
 }
 hubs.sort((a,b)=>(a.worst??Infinity)-(b.worst??Infinity));
 return respond(200,{hubs});
 }catch{return respond(502,{error:"TfL journey comparison is temporarily unavailable."})}
};