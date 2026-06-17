import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { apiClient } from '../../../api/client';

interface Props { roleId: string; onClose?: () => void; }

const PAGE_GROUPS: Record<string, {label:string,kpis:string[]}> = {
  dashboard: {label:'数据中心',kpis:['GMV','有效订单量','自然单','客单价','售后率','退款率','退款金额','买家数','商品数','罚款金额','优惠总额','利润金额','平均发货时长','用户实付','推广花费','推广GMV','推广ROI','点击率','转化率']},
  product: {label:'商品分析',kpis:['商品GMV','商品利润','商品ROI','SKU矩阵']},
  promotion: {label:'推广分析',kpis:['推广概览','推广产品明细','推广趋势']},
  afterSale: {label:'售后分析',kpis:['售后概览','退款原因','退款时效']},
  logistics: {label:'物流分析',kpis:['物流概览','发货时效','快递分布']},
  user: {label:'用户分析',kpis:['用户概览','复购率','地区分布']},
  cost: {label:'成本管理',kpis:['成本概览','税务配置','定价计算器']},
};

const FIELDS = ['value','change','source','detail'];
const FLABELS: Record<string,string> = {value:'数值',change:'变化',source:'来源',detail:'明细'};
const ACTIONS = ['export','delete_data','edit_costs'];
const ALABELS: Record<string,string> = {export:'导出报表',delete_data:'删除数据',edit_costs:'修改成本'};

export default function RolePermissionEditor({ roleId, onClose }: Props) {
  const [pages, setPages] = useState<Record<string,boolean>>({});
  const [kpi, setKpi] = useState<Record<string,Record<string,Record<string,boolean>>>>({});
  const [actions, setActions] = useState<Record<string,boolean>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient.get('/admin/roles/'+roleId+'/permissions').then(res => {
      if (res.success && res.data) {
        setPages((res.data as any).feature_permissions?.pages || {});
        setActions((res.data as any).feature_permissions?.actions || {});
        setKpi((res.data as any).data_permissions || {});
      }
    }).catch(() => {});
  }, [roleId]);

  const toggle = (s:any,f:any,k:string) => f((p:any)=>({...p,[k]:!p[k]}));
  const toggleKpi = (page:string,k:string) => setKpi(p=>{const n={...(p[page]||{})};n[k]={...(n[k]||{}),value:!(n[k]?.value)};return{...p,[page]:n};});
  const toggleFld = (page:string,k:string,f:string) => setKpi(p=>{const n={...(p[page]||{})};n[k]={...(n[k]||{}),[f]:!(n[k]?.[f])};return{...p,[page]:n};});

  const save = async () => {
    await apiClient.put('/admin/roles/'+roleId+'/permissions', {feature_permissions:{pages,actions},data_permissions:kpi});
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  const isOn = (page:string,k?:string,f?:string) => {
    if (!k) return pages[page] !== false;
    if (!f) return kpi[page]?.[k]?.value !== false;
    return kpi[page]?.[k]?.[f] !== false;
  };

  return (
    <div className="p-4 bg-pdd-card rounded-lg border border-pdd-border max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-pdd-text">权限编辑</h3>
        <div className="flex gap-2">
          <button onClick={save} className="flex items-center gap-1 px-4 py-1.5 bg-pdd-primary text-white rounded text-xs hover:opacity-90"><Save size={14}/>保存</button>
          {onClose && <button onClick={onClose} className="px-3 py-1.5 border border-pdd-border rounded text-xs text-pdd-text-secondary">关闭</button>}
        </div>
      </div>
      {saved && <p className="text-pdd-success text-xs mb-2">保存成功</p>}
      <details className="mb-3" open>
        <summary className="text-sm font-medium text-pdd-text cursor-pointer mb-2">页面访问权限</summary>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(PAGE_GROUPS).map(([k,v])=>(
            <label key={k} className={"flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer "+(isOn(k)?'text-pdd-text':'text-pdd-text-secondary/50')}>
              <input type="checkbox" checked={isOn(k)} onChange={()=>toggle(pages,setPages,k)} className="w-3 h-3"/>{v.label}
            </label>))}
        </div>
      </details>
      <details className="mb-3">
        <summary className="text-sm font-medium text-pdd-text cursor-pointer mb-2">数据可见性</summary>
        {Object.entries(PAGE_GROUPS).map(([pk,pv])=>(
          <details key={pk} className="ml-3 mb-1">
            <summary className={"text-xs cursor-pointer "+(isOn(pk)?'text-pdd-text':'text-pdd-text-secondary/50')}>
              {pv.label} ({pv.kpis.filter(k=>isOn(pk,k)).length}/{pv.kpis.length})
            </summary>
            <div className="ml-4 mt-1 space-y-0.5">
              {pv.kpis.map(k=>(
                <div key={k} className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={isOn(pk,k)} onChange={()=>toggleKpi(pk,k)} disabled={!isOn(pk)} className="w-3 h-3"/>
                    <span className={isOn(pk,k)?'text-pdd-text':'text-pdd-text-secondary/50'}>{k}</span>
                  </label>
                  {isOn(pk,k) && FIELDS.map(f=>(
                    <label key={f} className="flex items-center gap-0.5 text-[10px] cursor-pointer text-pdd-text-secondary/70">
                      <input type="checkbox" checked={isOn(pk,k,f)} onChange={()=>toggleFld(pk,k,f)} className="w-2.5 h-2.5"/>{FLABELS[f]}
                    </label>))}
                </div>))}
            </div>
          </details>))}
      </details>
      <details className="mb-3">
        <summary className="text-sm font-medium text-pdd-text cursor-pointer mb-2">操作权限</summary>
        <div className="flex gap-4">
          {ACTIONS.map(a=>(
            <label key={a} className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox" checked={actions[a]!==false} onChange={()=>toggle(actions,setActions,a)} className="w-3 h-3"/>
              <span className={actions[a]!==false?'text-pdd-text':'text-pdd-text-secondary/50'}>{ALABELS[a]}</span>
            </label>))}
        </div>
      </details>
    </div>
  );
}
