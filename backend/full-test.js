const BASE="http://localhost:3007/api/v1";
let P=0,F=0;const R=[];
function A(n,c,d){if(c){P++;R.push({n,s:"PASS",d});}else{F++;R.push({n,s:"FAIL",d});console.error("  FAIL: "+n+" - "+d);}}
async function api(m,p,o={}){const u=BASE+p;const hd={"Content-Type":"application/json",...(o.headers||{})};const bd=o.body?JSON.stringify(o.body):undefined;try{const r=await fetch(u,{method:m,headers:hd,body:bd,signal:AbortSignal.timeout(15000)});const j=await r.json().catch(()=>({}));return{status:r.status,data:j,ok:r.ok};}catch(e){return{status:0,data:{error:e.message},ok:false};}}
const G=(p,o)=>api("GET",p,o);const P2=(p,b,o)=>api("POST",p,{...o,body:b});const AH=t=>({Authorization:"Bearer "+t});
async function main(){
console.log("=== Meoo Test v2 ===");

console.log("--- 1. Health ---");
let r=await G("/health");
A("health 200",r.status===200,"s="+r.status);
A("db connected",r.data?.db==="connected","db="+r.data?.db);
A("has memory",typeof r.data?.memory?.heapUsedMB==="number","heap="+r.data?.memory?.heapUsedMB+"MB");

console.log("--- 2. Auth ---");
r=await P2("/auth/login",{});
A("empty login 400",r.status===400,"fields="+(r.data?.details||[]).map(d=>d.field).join(","));
r=await P2("/auth/login",{username:"demo888",password:"wrong"});
A("wrong pwd 401",r.status===401,"ok");
r=await P2("/auth/login",{username:"demo888",password:"1456"});
A("login ok",r.data?.success===true,"user="+r.data?.data?.user?.username);
const token=r.data?.data?.accessToken;
if(!token){console.error("NO TOKEN");printR();return;}
const h=AH(token);

console.log("--- 3. Stores ---");
r=await G("/stores",{headers:h});
A("stores list",r.data?.success===true,"n="+(r.data?.data?.length||0));

console.log("--- 4. Analytics ---");
r=await G("/analytics/dashboard?storeId=__all__",{headers:h});
A("dashboard",r.data?.success===true,"gmv="+(r.data?.data?.kpi?.gmv||0).toFixed(0));
r=await G("/analytics/products/stats?storeId=__all__",{headers:h});
A("products",r.data?.success===true,"products="+Object.keys(r.data?.data||{}).length);
A("products pagination",r.data?.pagination?.total>0,"total="+r.data?.pagination?.total);
r=await G("/analytics/promotion?storeId=__all__",{headers:h});
A("promotion",r.data?.success===true,"cost="+(r.data?.data?.summary?.cost||0).toFixed(0));
r=await G("/analytics/aftersale?storeId=__all__",{headers:h});
A("aftersale",r.data?.success===true,"count="+(r.data?.data?.total||0));

// Product deep analysis
const firstPid=r.data?.data?.total>0?Object.keys(r.data?.data?.reasons?.[0]||{}):null;
if(Object.keys(r.data?.data||{}).length>0){
  r=await G("/analytics/products/stats?storeId=__all__&pageSize=1",{headers:h});
  const pids=Object.keys(r.data?.data||{});
  if(pids.length>0){
    r=await G("/analytics/product/deep/"+encodeURIComponent(pids[0])+"?storeId=__all__",{headers:h});
    A("deep analysis",r.data?.success===true,"name="+(r.data?.data?.productName||"?"));
  }
}

console.log("--- 5. Security ---");
r=await G("/stores",{headers:AH("fake.token.here")});
A("fake token 401",r.status===401,"ok");
r=await G("/stores");
A("no auth 401",r.status===401,"ok");
r=await P2("/auth/login",{username:"a".repeat(1000),password:"x"});
A("long input 400",r.status===400,"ok");

console.log("--- 6. Data ---");
const tid="t-"+Date.now();
r=await P2("/data/sync",{storeId:tid,storeName:"x",data:{},configs:{},uploadRecords:[]},{headers:h});
A("sync",r.data?.success===true,"ok");
r=await P2("/data/config",{storeId:tid,configKey:"k",payloadJson:"{}"},{headers:h});
A("config",r.data?.success===true,"ok");
r=await P2("/data/pull",{storeId:tid},{headers:h});
A("pull",r.data?.success===true,"ok");

console.log("--- 7. SSE ---");
r=await G("/sse/stats",{headers:h});
A("sse stats",r.data?.success===true,"total="+(r.data?.data?.total||0));

printR();
}
function printR(){const t=P+F;console.log("");console.log("=== "+P+"/"+t+" passed ("+(t>0?(P/t*100).toFixed(1):0)+"%) ===");if(F>0){console.log("FAILED:");R.filter(r=>r.s==="FAIL").forEach(r=>console.log("  - "+r.n+": "+r.d));}}
main().catch(e=>{console.error("CRASH:",e);process.exit(1);});