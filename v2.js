const C=["Italian","Japanese","Indian","Thai","Chinese","Korean","Vietnamese","Mexican","Spanish","French","Greek","Turkish","Lebanese","Middle Eastern","Mediterranean","British","American","Caribbean","Ethiopian","Portuguese","Seafood","Vegetarian","Vegan","Pizza","Steakhouse"];
const qs=x=>document.querySelector(x), el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let db,user,room=null,me=null,members=[],roomData=null,clock=null,lastSearch=[],dirty=false;
const out=(s,bad=false)=>{qs("#notice").textContent=s;qs("#notice").className=bad?"error":"muted"};
const param=new URLSearchParams(location.search), requested=param.get("room");
function btn(label,fn,cls=""){const b=el("button",label,"btn "+cls);b.type="button";b.onclick=fn;return b;}
function field(placeholder,value="",max=100){const a=el("input");a.placeholder=placeholder;a.value=value;a.maxLength=max;return a;}
function box(id){const d=el("div");d.id=id;return d}
async function query(q){const {data,error}=await q;if(error)throw error;return data}
async function init(){
 try{
 const res=await fetch("/.netlify/functions/config");const conf=await res.json();
 if(!conf.url||!conf.anonKey)throw Error("Supabase not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY in Netlify, then redeploy.");
 db=window.supabase.createClient(conf.url,conf.anonKey);
 let {data:{session}}=await db.auth.getSession();
 if(!session){await query(db.auth.signInAnonymously());session=(await db.auth.getSession()).data.session;}
 user=session.user;
 qs("#intro").hidden=false;out("Connected. Create a room or open an invitation link.");
 if(requested){if(!uuid.test(requested))throw Error("Invalid invitation link.");room=requested;await showJoin();}
 }catch(e){out(e.message,true)}
}
async function showJoin(){
 qs("#intro").hidden=true;const parent=qs("#work");parent.replaceChildren();
 const title=el("h2","Join dinner");parent.append(title,el("p","Enter your name. Your invitation link is your access to this room."));
 const inp=field("Your name","",40);parent.append(inp);
 parent.append(btn("Join this dinner",async()=>{try{if(!inp.value.trim())throw Error("Please enter your name.");await query(db.rpc("join_dinner_room",{p_room:room,p_name:inp.value.trim()}));await activate();}catch(e){out(e.message,true)}}));
}
async function createRoom(){
 try{
 const name=qs("#new-name").value.trim();if(!name)throw Error("Enter your name.");
 room=await query(db.rpc("create_dinner_room",{p_name:name}));
 history.replaceState(null,"","?room="+room);await activate();
 }catch(e){out(e.message,true)}
}
async function activate(){qs("#intro").hidden=true;await refresh();if(clock)clearInterval(clock);clock=setInterval(()=>refresh(true).catch(e=>out(e.message,true)),5000);}
async function refresh(silent=false){
 const [r,g]=await Promise.all([query(db.from("dinner_rooms").select("*").eq("id",room).single()),query(db.from("dinner_guests").select("*").eq("room_id",room).order("joined_at"))]);
 roomData=r;members=g;me=g.find(x=>x.user_id===user.id);
 if(!me)throw Error("You are not in this room. Reopen the invitation link.");
 if(!silent||(!dirty && !document.activeElement?.matches("#work input, #work button")))render();
 if(!silent)out("Shared room connected. Changes sync automatically about every 5 seconds.");
}
function agreement(){
 const voted=members.filter(m=>m.cuisines.length>=5),complete=members.length>1&&voted.length===members.length;
 const counts=new Map();for(const g of voted)for(const c of new Set(g.cuisines))counts.set(c,(counts.get(c)||0)+1);
 const common=complete?[...counts].filter(([,v])=>v===members.length).map(([c])=>c):[];
 const ranked=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 return {complete,common,ranked,voted:voted.length};
}
function render(){
 const root=qs("#work");root.replaceChildren();root.append(el("h2","Dinner room"));
 const invite=location.origin+location.pathname+"?room="+room;
 const share=el("div",undefined,"bar");share.append(el("span",invite,"share-url"),btn("Copy invite",()=>navigator.clipboard.writeText(invite)));root.append(share);
 root.append(el("p","Invite friends using the link. Everyone votes on their own device. Guests currently in room: "+members.length,"muted"));
 const my=el("section",undefined,"panel");my.append(el("h3","Your ballot — "+me.guest_name));
 my.append(el("p","Choose at least 5 cuisines you'd happily eat. Up to 3 favourites can be marked after voting.","muted"));
 const chips=el("div",undefined,"chips");let picks=[...me.cuisines];for(const c of C){const ch=btn(c,()=>{picks=picks.includes(c)?picks.filter(x=>x!==c):[...picks,c];dirty=true;ch.classList.toggle("selected");save.disabled=picks.length<5;count.textContent=picks.length+" cuisines selected";},"chip"+(picks.includes(c)?" selected":""));chips.append(ch);}my.append(chips);
 const count=el("p",picks.length+" cuisines selected","muted");my.append(count);
 const save=btn("Save my choices",async()=>{try{save.disabled=true;await query(db.from("dinner_guests").update({cuisines:picks}).eq("room_id",room).eq("user_id",user.id));dirty=false;await refresh();}catch(e){out(e.message,true);save.disabled=false}});save.disabled=picks.length<5;my.append(save);root.append(my);
 const all=el("section",undefined,"panel");all.append(el("h3","Group votes"));
 for(const m of members)all.append(el("p",m.guest_name+" — "+(m.cuisines.length>=5?m.cuisines.length+" choices saved":"still choosing")));
 const a=agreement();all.append(el("h3","Cuisine consensus"));
 if(!a.complete)all.append(el("p","Waiting for everyone to select at least 5 cuisines. "+a.voted+"/"+members.length+" complete.","muted"));
 else if(a.common.length)all.append(el("p","Everybody accepts: "+a.common.join(", "),"success"));
 else {all.append(el("p","No unanimous overlap yet. This is a compromise round: discuss the highest-supported cuisines, and ask guests to add any they can accept. Nothing is forced.","warning"));all.append(el("p",a.ranked.slice(0,7).map(([c,n])=>c+" ("+n+"/"+members.length+")").join(" · ")));}
 root.append(all);
 const locations=el("section",undefined,"panel");locations.append(el("h3","London meeting area and public transport"));
 locations.append(el("p","Each guest enters a starting postcode or station. TfL estimates are calculated for candidate dinner hubs where available; no travel time is inferred from straight-line distance.","muted"));
 const area=field("Your departure station or postcode",me.origin||"",100);area.oninput=()=>{dirty=true};locations.append(area);
 locations.append(btn("Save my starting point",async()=>{try{await query(db.from("dinner_guests").update({origin:area.value.trim()}).eq("room_id",room).eq("user_id",user.id));dirty=false;await refresh();out("Starting point saved.");}catch(e){out(e.message,true)}}));
 for(const g of members)locations.append(el("p",g.guest_name+": "+(g.origin||"not set"),"muted"));
 const host=roomData.host_id===user.id;
 if(host){const chosen=field("Preferred area for restaurant search",roomData.location||"",90);chosen.oninput=()=>{dirty=true};locations.append(el("h4","Host: restaurant search area"));locations.append(chosen,btn("Save area",async()=>{try{const saved=await query(db.from("dinner_rooms").update({location:chosen.value.trim()}).eq("id",room).select("id,location").single());dirty=false;await refresh();out("Search area saved: "+saved.location)}catch(e){out(e.message,true)}}));
 locations.append(btn("Compare TfL journeys to central hubs",compareTravel,"secondary"));
 const go=btn("Search restaurants here",searchRestaurants);go.disabled=!roomData.location||!a.common.length;locations.append(go);if(go.disabled)locations.append(el("p",!roomData.location?"Search unavailable: enter an area (for example Soho) and click Save area.":"Search unavailable: every guest must complete their ballot and agree on at least one cuisine.","warning"));
 }else locations.append(el("p","The host chooses the final restaurant-search area after the group has voted.","muted"));
 root.append(locations);
 const travel=box("travel");root.append(travel);
 const rest=box("restaurants");root.append(rest);
 if(lastSearch.length)renderRestaurants(lastSearch);
}
async function compareTravel(){
 const starts=members.filter(g=>g.origin?.trim());if(starts.length!==members.length){out("Ask every guest to save a starting postcode or station first.",true);return;}
 const target=qs("#travel");target.replaceChildren(el("p","Calculating TfL public-transport journeys…"));
 try{const res=await fetch("/.netlify/functions/journeys",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({origins:starts.map(x=>({name:x.guest_name,from:x.origin}))})});const data=await res.json();if(!res.ok)throw Error(data.error);target.replaceChildren(el("h3","Public transport comparison"));for(const h of data.hubs){const lines=h.journeys.map(j=>j.name+": "+(j.minutes==null?"unavailable":j.minutes+" min"));target.append(el("p",h.name+" — "+lines.join(" · ")+(h.worst==null?"":" · longest: "+h.worst+" min")));}
 target.append(el("p","Live TfL journey estimates can vary by time and service disruption. Hubs with missing journeys are not ranked.","muted"));}catch(e){target.replaceChildren();out(e.message,true)}
}
async function searchRestaurants(){const cuisines=agreement().common;if(!cuisines.length){out("No unanimous cuisine yet. Complete a compromise round first.",true);return;}out("Looking up restaurants…");
 try{const response=await fetch("/.netlify/functions/restaurants",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:roomData.location,cuisines:cuisines.slice(0,5)})});const d=await response.json();if(!response.ok)throw Error(d.error);lastSearch=d.restaurants||[];renderRestaurants(lastSearch);out(lastSearch.length+" restaurants returned.");}catch(e){out(e.message,true)}}
function renderRestaurants(items){const target=qs("#restaurants");if(!target)return;target.replaceChildren(el("h3","Nearby restaurant shortlist"));if(!items.length){target.append(el("p","No results yet."));return;}for(const x of items){const card=el("article",undefined,"restaurant");card.append(el("h4",x.name),el("p",(x.address||"")+" — "+x.matchedCuisines.join(", "),"muted"));if(x.phone)card.append(el("p",x.phone));for(const [label,url] of [["Website",x.website],["View map & reviews",x.mapsUrl]]){if(!url)continue;try{const parsed=new URL(url);if(parsed.protocol!=="https:"&&parsed.protocol!=="http:")continue;const link=el("a",label+" ↗");link.href=parsed.href;link.target="_blank";link.rel="noopener noreferrer";card.append(link,el("span","  "));}catch{}}target.append(card)}}
qs("#create").onclick=createRoom;init();
