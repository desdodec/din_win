const ALLOWED = new Set(["Italian","Japanese","Indian","Thai","Chinese","Korean","Vietnamese","Mexican","Spanish","French","Greek","Turkish","Lebanese","Middle Eastern","Mediterranean","British","American","Caribbean","Ethiopian","Portuguese","Seafood","Vegetarian","Vegan","Pizza","Steakhouse"]);
const PRICE = {PRICE_LEVEL_FREE:"Free",PRICE_LEVEL_INEXPENSIVE:"£",PRICE_LEVEL_MODERATE:"££",PRICE_LEVEL_EXPENSIVE:"£££",PRICE_LEVEL_VERY_EXPENSIVE:"££££"};
const headers={"Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(statusCode,data)=>({statusCode,headers,body:JSON.stringify(data)});
const score=p=>((p.rating??0)*Math.log10((p.reviewCount??0)+10))+0.7*(p.matchedCuisines?.length??0);
export const handler=async event=>{
  if(event.httpMethod!=="POST")return reply(405,{error:"Use POST to search."});
  const key=process.env.GOOGLE_PLACES_API_KEY;
  if(!key)return reply(503,{error:"Restaurant search is not configured yet. Add GOOGLE_PLACES_API_KEY in Netlify environment variables."});
  let body;try{body=JSON.parse(event.body||"{}");}catch{return reply(400,{error:"Invalid JSON."});}
  const location=typeof body.location==="string"?body.location.trim():"";
  const cuisines=Array.isArray(body.cuisines)?[...new Set(body.cuisines)].filter(c=>ALLOWED.has(c)).slice(0,5):[];
  if(!location||location.length>90||/[^\p{L}\p{N}\s,.'-]/u.test(location)||!cuisines.length)return reply(400,{error:"Enter a valid London area or postcode and select cuisines."});
  try{
    const searches=await Promise.all(cuisines.map(async cuisine=>{
      const response=await fetch("https://places.googleapis.com/v1/places:searchText",{
        method:"POST",
        headers:{"Content-Type":"application/json","X-Goog-Api-Key":key,"X-Goog-FieldMask":"places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.businessStatus"},
        body:JSON.stringify({textQuery:cuisine+" restaurants in "+location+", London, UK",languageCode:"en",regionCode:"GB",pageSize:20})
      });
      const json=await response.json();
      if(!response.ok)throw new Error(json?.error?.message||"Restaurant provider is unavailable.");
      return {cuisine,places:json.places||[]};
    }));
    const byId=new Map();
    for(const {cuisine,places} of searches)for(const p of places){
      if(!p.id||p.businessStatus==="CLOSED_PERMANENTLY")continue;
      const existing=byId.get(p.id);
      if(existing){if(!existing.matchedCuisines.includes(cuisine))existing.matchedCuisines.push(cuisine);continue;}
      byId.set(p.id,{id:p.id,name:p.displayName?.text||"Restaurant",address:p.formattedAddress||"",rating:typeof p.rating==="number"?p.rating:null,reviewCount:p.userRatingCount||0,price:PRICE[p.priceLevel]||null,phone:p.internationalPhoneNumber||p.nationalPhoneNumber||null,website:p.websiteUri||null,mapsUrl:p.googleMapsUri||null,matchedCuisines:[cuisine]});
    }
    const restaurants=[...byId.values()].sort((a,b)=>score(b)-score(a)).slice(0,30);
    return reply(200,{restaurants});
  }catch(error){console.error("Places lookup failed",error);return reply(502,{error:"Restaurant data could not be loaded. Check your Places API configuration and try again."});}
};