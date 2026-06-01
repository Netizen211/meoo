/**
 * DataStore — 单源真理数据层
 * localStorage做主存储(刷新不丢), 服务器做备份, 版本号保证一致性
 */
import { pullStoreData, syncStoreData } from "../../api/dataApi";

const PREFIX = "meoo_ds_";

export interface DataStoreItem {
  orders: any[]; promotionSummary: any[]; promotionProducts: any[];
  starStoreSummary: any[]; liveStreamSummary: any[]; shippingInsurance: any[];
  afterSaleRecords: any[]; financialRecords: any[];
  availableFields: { csv: Set<string>; promotion: Set<string>; insurance: Set<string>; afterSale: Set<string> };
}

export interface Snapshot {
  data: DataStoreItem; version: number; updatedAt: number; synced: boolean;
}

const EMPTY: DataStoreItem = {
  orders:[],promotionSummary:[],promotionProducts:[],starStoreSummary:[],liveStreamSummary:[],
  shippingInsurance:[],afterSaleRecords:[],financialRecords:[],
  availableFields:{csv:new Set(),promotion:new Set(),insurance:new Set(),afterSale:new Set()},
};

function ser(d:DataStoreItem){return JSON.stringify({o:d.orders,ps:d.promotionSummary,pp:d.promotionProducts,ss:d.starStoreSummary,ls:d.liveStreamSummary,si:d.shippingInsurance,as:Array.from(d.afterSaleRecords||[]),fr:Array.from(d.financialRecords||[]),af:{csv:Array.from(d.availableFields.csv),promotion:Array.from(d.availableFields.promotion),insurance:Array.from(d.availableFields.insurance),afterSale:Array.from(d.availableFields.afterSale)}});}
function des(raw:any):DataStoreItem{try{const r=typeof raw==="string"?JSON.parse(raw):raw;return{orders:r.o||[],promotionSummary:r.ps||[],promotionProducts:r.pp||[],starStoreSummary:r.ss||[],liveStreamSummary:r.ls||[],shippingInsurance:r.si||[],afterSaleRecords:r.as||[],financialRecords:r.fr||[],availableFields:{csv:new Set(r.af?.csv||[]),promotion:new Set(r.af?.promotion||[]),insurance:new Set(r.af?.insurance||[]),afterSale:new Set(r.af?.afterSale||[])}};}catch{return{...EMPTY,availableFields:{csv:new Set(),promotion:new Set(),insurance:new Set(),afterSale:new Set()}};}}

function loadSnap(sid:string):Snapshot|null{try{const r=localStorage.getItem(PREFIX+sid);if(!r)return null;const p=JSON.parse(r);return{data:des(p.d),version:p.v||0,updatedAt:p.t||0,synced:p.s||false};}catch{return null;}}
function saveSnap(sid:string,s:Snapshot){try{localStorage.setItem(PREFIX+sid,JSON.stringify({d:JSON.parse(ser(s.data)),v:s.version,t:s.updatedAt,s:s.synced}));}catch(e){try{const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(PREFIX))keys.push(k);}keys.slice(0,Math.floor(keys.length/2)).forEach(k=>localStorage.removeItem(k));localStorage.setItem(PREFIX+sid,JSON.stringify({d:JSON.parse(ser(s.data)),v:s.version,t:s.updatedAt,s:s.synced}));}catch{}}}

/** 从localStorage加载所有数据(刷新时首先调用) */
export function loadAllFromLocal():Record<string,Snapshot>{const r:Record<string,Snapshot>={};try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(PREFIX)){const sid=k.replace(PREFIX,"");const s=loadSnap(sid);if(s)r[sid]=s;}}}catch{}return r;}

/** 从服务器拉取并合并(版本比对) */
export async function pullAndMerge(sid:string):Promise<Snapshot>{const local=loadSnap(sid);try{const sd=await pullStoreData(sid);if(!sd?.data)return local||{data:{...EMPTY,availableFields:{csv:new Set(),promotion:new Set(),insurance:new Set(),afterSale:new Set()}},version:0,updatedAt:Date.now(),synced:false};const sv=(sd as any)._version||0;const lv=local?.version||0;if(sv>=lv){const s:Snapshot={data:des({o:sd.data.orders||[],ps:sd.data.promotionSummary||[],pp:sd.data.promotionProducts||[],ss:sd.data.starStoreSummary||[],ls:sd.data.liveStreamSummary||[],si:sd.data.shippingInsurance||[],as:sd.data.afterSaleRecords||[],fr:sd.data.financialRecords||[],af:sd.data.availableFields||{csv:[],promotion:[],insurance:[],afterSale:[]}}),version:sv,updatedAt:Date.now(),synced:true};saveSnap(sid,s);return s;}return{...local!,synced:false};}catch{return local||{data:{...EMPTY,availableFields:{csv:new Set(),promotion:new Set(),insurance:new Set(),afterSale:new Set()}},version:0,updatedAt:Date.now(),synced:false};}}

/** 写入数据(立即生效+后台同步) */
export function writeData(sid:string,sname:string,dataOrUpdater:DataStoreItem|((prev:DataStoreItem)=>DataStoreItem),onSync?:(ok:boolean)=>void):Snapshot{const prev=loadSnap(sid);const pd=prev?.data||EMPTY;const nd=typeof dataOrUpdater==="function"?dataOrUpdater({...pd,availableFields:{...pd.availableFields}}):dataOrUpdater;const nv=(prev?.version||0)+1;const snap:Snapshot={data:nd,version:nv,updatedAt:Date.now(),synced:false};saveSnap(sid,snap);const slim:Record<string,any[]>={};["orders","promotionSummary","promotionProducts","starStoreSummary","liveStreamSummary","shippingInsurance","afterSaleRecords","financialRecords"].forEach(cat=>{if(Array.isArray((nd as any)[cat])&&(nd as any)[cat].length>0)slim[cat]=(nd as any)[cat];});slim.availableFields={csv:Array.from(nd.availableFields?.csv||[]),promotion:Array.from(nd.availableFields?.promotion||[]),insurance:Array.from(nd.availableFields?.insurance||[]),afterSale:Array.from(nd.availableFields?.afterSale||[])};syncStoreData(sid,sname,slim as any,{},[]).then(()=>{saveSnap(sid,{...snap,synced:true});onSync?.(true);}).catch(e=>{console.error("[DS] sync failed:",e);onSync?.(false);});return snap;}

export function getLocalData(sid:string):Snapshot|null{return loadSnap(sid);}
export function deleteStoreData(sid:string){try{localStorage.removeItem(PREFIX+sid);}catch{}}
