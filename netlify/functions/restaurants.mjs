const CATEGORIES = {
"Italian":["catering.restaurant.italian"],"Japanese":["catering.restaurant.japanese","catering.restaurant.sushi"],"Indian":["catering.restaurant.indian"],"Thai":["catering.restaurant.thai"],"Chinese":["catering.restaurant.chinese"],"Korean":["catering.restaurant.korean"],"Vietnamese":["catering.restaurant.vietnamese"],"Mexican":["catering.restaurant.mexican"],"Spanish":["catering.restaurant.spanish","catering.restaurant.tapas"],"French":["catering.restaurant.french"],"Greek":["catering.restaurant.greek"],"Turkish":["catering.restaurant.turkish"],"Lebanese":["catering.restaurant.lebanese"],"Middle Eastern":["catering.restaurant.arab","catering.restaurant.persian"],"Mediterranean":["catering.restaurant.mediterranean"],"British":["catering.restaurant.british"],"American":["catering.restaurant.american"],"Caribbean":["catering.restaurant.jamaican"],"Ethiopian":["catering.restaurant.african"],"Portuguese":["catering.restaurant.portuguese"],"Seafood":["catering.restaurant.seafood"],"Vegetarian":["catering.restaurant.vegetarian"],"Vegan":["catering.restaurant.vegan"],"Pizza":["catering.restaurant.pizza"],"Steakhouse":["catering.restaurant.steak_house"]};
const headers={"Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(statusCode,data)=>({statusCode,headers,body:JSON.stringify(data)});
const london={minLat:51.28,maxLat:51.70,minLon:-0.52,maxLon:0.34};
const withinLondon=({lat,lon})=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=london.minLat&&lat<=london.maxLat&&lon>=london.minLon&&lon<=london.maxLon;
async function geoFetch(url,key){
  const r=await fetch(url,{headers:{"x-api-key":key}});
  const data=await r.json();
  if(!r.ok){const msg=r.status===401||r.status===403?"Geoapify rejected the API key or its restrictions.":r.status===429?"Geoapify rate limit or daily quota reached.":"Geoapify service request failed ("+r.status+").";throw Error(msg);}
  return data;
}
export const handler=async event=>{
  if(event.httpMethod!=="POST")return reply(405,{error:"Use POST to search."});
  const key=process.env.GEOAPIFY_API_KEY;
  if(!key)return reply(503,{error:"Add GEOAPIFY_API_KEY to Netlify environment variables and redeploy."});
  let body;try{body=JSON.parse(event.body||"{}");}catch{return reply(400,{error:"Invalid request."});}
  const location=typeof body.location==="string"?body.location.trim():"";
  const cuisines=Array.isArray(body.cuisines)?[...new Set(body.cuisines)].filter(c=>Object.hasOwn(CATEGORIES,c)).slice(0,5):[];
  if(!location||location.length>90||/[^\\p{L}\\p{N}\\s,.'-]/u.test(location)||!cuisines.length)return reply(400,{error:"Enter a valid London area or postcode and select cuisines."});
  try{
    const geocode=new URL("https://api.geoapify.com/v1/geocode/search");
    geocode.searchParams.set("text",location+", London, United Kingdom");
    geocode.searchParams.set("format","json");geocode.searchParams.set("filter","countrycode:gb");geocode.searchParams.set("limit","5");
    const locations=await geoFetch(geocode,key);
    const centre=(locations.results||[]).find(withinLondon);
    if(!centre)return reply(400,{error:"That area could not be found in London. Try a London postcode such as W1D 3QF."});
    const categorySet=[...new Set(cuisines.flatMap(c=>CATEGORIES[c]))];
    const url=new URL("https://api.geoapify.com/v2/places");
    url.searchParams.set("categories",categorySet.join(","));
    url.searchParams.set("filter","circle:"+centre.lon+","+centre.lat+",2500");
    url.searchParams.set("bias","proximity:"+centre.lon+","+centre.lat);
    url.searchParams.set("limit","150");
    const found=await geoFetch(url,key);
    const restaurants=(found.features||[]).map(f=>{
      const p=f.properties||{}, categories=p.categories||[], matched=cuisines.filter(c=>CATEGORIES[c].some(cat=>categories.some(actual=>actual===cat||actual.startsWith(cat+"."))));
      if(!matched.length||!p.name)return null;
      const raw=p.datasource?.raw||{};
      const lat=Number(p.lat??f.geometry?.coordinates?.[1]),lon=Number(p.lon??f.geometry?.coordinates?.[0]);
      return {id:p.place_id||p.name+":"+lat+":"+lon,name:p.name,address:p.formatted||"",distance:Number.isFinite(p.distance)?p.distance:null,phone:p.contact?.phone||raw.phone||raw["contact:phone"]||null,website:p.website||p.contact?.website||raw.website||raw["contact:website"]||null,mapsUrl:Number.isFinite(lat)&&Number.isFinite(lon)?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(p.name+" "+(p.formatted||"")):null,matchedCuisines:matched};
    }).filter(Boolean).sort((a,b)=>b.matchedCuisines.length-a.matchedCuisines.length||(a.distance??Infinity)-(b.distance??Infinity)).slice(0,30);
    return reply(200,{restaurants});
  }catch(error){console.error("Geoapify lookup error:",error.message);return reply(502,{error:error.message||"Restaurant search failed."});}
};