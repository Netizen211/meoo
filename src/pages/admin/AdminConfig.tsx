import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  adminApi, type FeeConfig, type ExpressRateItem, type DeductionFormula,
  type TaxRateConfig, type ConfigHistoryItem, type GlobalConfig,
} from '../../api/adminApi';
import {
  DollarSign, Truck, Calculator, Landmark, Download, Upload,
  History, Save, Plus, Pencil, Trash2, X, Check, Power, AlertCircle,
} from 'lucide-react';

/* ==================== 类型 ==================== */

type TabKey = 'fees' | 'express' | 'formulas' | 'tax' | 'history';

const TABS: { key: TabKey; label: string; icon: React.ComponentType<any> }[] = [
  { key: 'fees', label: '费用配置', icon: DollarSign },
  { key: 'express', label: '快递费率', icon: Truck },
  { key: 'formulas', label: '扣费公式', icon: Calculator },
  { key: 'tax', label: '税务配置', icon: Landmark },
  { key: 'history', label: '变更历史', icon: History },
];

const DEFAULT_FEES: FeeConfig = {
  packagingFee: 0, expressFee: 0, platformCommissionRate: 0,
  shippingInsurance: 0, laborFee: 0, promotionFee: 0,
};

const DEFAULT_TAX: TaxRateConfig = { vatRate: 13, incomeTaxRate: 25, surtaxRate: 6 };

const EXPRESS_COMPANIES = ['中通', '圆通', '申通', '韵达', '顺丰', '极兔'];

/* ==================== 主组件 ==================== */

export default function AdminConfig() {
  const [activeTab, setActiveTab] = useState<TabKey>('fees');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 配置数据
  const [fees, setFees] = useState<FeeConfig>(DEFAULT_FEES);
  const [expressRates, setExpressRates] = useState<ExpressRateItem[]>([]);
  const [formulas, setFormulas] = useState<DeductionFormula[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateConfig>(DEFAULT_TAX);

  // 导出/导入
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  useEffect(() => {
    (async () => {
      try {
        const config = await adminApi.getConfig();
        if (config) {
          setFees(config.fees || DEFAULT_FEES);
          setExpressRates(config.expressRates || []);
          setFormulas(config.deductionFormulas || []);
          setTaxRates(config.taxRates || DEFAULT_TAX);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Partial<GlobalConfig> = {};
      if (activeTab === 'fees') data.fees = fees;
      if (activeTab === 'express') data.expressRates = expressRates;
      if (activeTab === 'formulas') data.deductionFormulas = formulas;
      if (activeTab === 'tax') data.taxRates = taxRates;

      const res = await adminApi.updateConfig(data);
      showMsg(res.success ? 'success' : 'error', res.success ? '配置保存成功' : (res.error || '保存失败'));
    } catch {
      showMsg('error', '保存失败，请检查网络连接');
    }
    setSaving(false);
  };

  const handleExport = async () => {
    const ok = await adminApi.exportConfigJSON();
    showMsg(ok ? 'success' : 'error', ok ? '配置导出成功' : '配置导出失败');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.configs) {
        const res = await adminApi.importConfigJSON(data.configs);
        if (res.success) {
          showMsg('success', (res as any).message || '导入成功');
          // 刷新配置
          const config = await adminApi.getConfig();
          if (config) {
            setFees(config.fees || DEFAULT_FEES);
            setExpressRates(config.expressRates || []);
            setFormulas(config.deductionFormulas || []);
            setTaxRates(config.taxRates || DEFAULT_TAX);
          }
        } else {
          showMsg('error', (res as any).error || '导入失败');
        }
      }
    } catch {
      showMsg('error', '文件格式错误，请检查 JSON 文件');
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) return <div className="text-pdd-text-secondary py-8 text-center">加载配置中...</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pdd-text-primary">全局配置管理</h2>
          <p className="text-xs text-pdd-text-secondary mt-0.5">管理费用、快递、税务等业务参数</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-pdd-border text-xs
              text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
          >
            <Download size={12} /> 导出配置
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-pdd-border text-xs
            text-pdd-text-secondary hover:bg-pdd-bg transition-colors cursor-pointer">
            <Upload size={12} /> 导入配置
            <input
              ref={fileInputRef}
              type="file" accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {msg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={'text-sm px-4 py-2.5 rounded-lg border ' + (
            msg.type === 'success'
              ? 'text-green-400 bg-green-500/10 border-green-500/20'
              : 'text-red-400 bg-red-500/10 border-red-500/20'
          )}
        >
          {msg.text}
        </motion.div>
      )}

      {/* 标签页导航 */}
      <div className="flex items-center gap-1 bg-pdd-card rounded-xl border border-pdd-border p-1 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs whitespace-nowrap transition-all ' +
              (activeTab === tab.key
                ? 'bg-pdd-primary/10 text-pdd-primary font-medium'
                : 'text-pdd-text-secondary hover:text-pdd-text')
            }
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 标签页内容 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'fees' && <FeesTab fees={fees} onChange={setFees} />}
          {activeTab === 'express' && <ExpressTab rates={expressRates} onChange={setExpressRates} />}
          {activeTab === 'formulas' && <FormulasTab formulas={formulas} onChange={setFormulas} />}
          {activeTab === 'tax' && <TaxTab rates={taxRates} onChange={setTaxRates} />}
          {activeTab === 'history' && <HistoryTab />}
        </motion.div>
      </AnimatePresence>

      {/* 保存按钮（历史 tab 不需要） */}
      {activeTab !== 'history' && (
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-pdd-primary text-white rounded-lg text-sm font-medium
              disabled:opacity-50 hover:bg-pdd-primary/90 transition-colors flex items-center gap-2"
          >
            <Save size={14} />
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ==================== 费用配置 Tab ==================== */

function FeesTab({ fees, onChange }: { fees: FeeConfig; onChange: (f: FeeConfig) => void }) {
  const update = (key: keyof FeeConfig, value: number) => onChange({ ...fees, [key]: value });

  const fields: { key: keyof FeeConfig; label: string; hint: string; unit?: string }[] = [
    { key: 'packagingFee', label: '包装费', hint: '每单默认包装费用' },
    { key: 'expressFee', label: '快递费', hint: '每单默认快递费（未匹配快递公司时使用）' },
    { key: 'platformCommissionRate', label: '平台佣金率', hint: '平台抽成比例', unit: '%' },
    { key: 'shippingInsurance', label: '运费险', hint: '每单默认运费险费用' },
    { key: 'laborFee', label: '人工费', hint: '每单默认人工处理费用' },
    { key: 'promotionFee', label: '推广费默认值', hint: '推广费用默认金额' },
  ];

  return (
    <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
      <h3 className="text-sm font-semibold text-pdd-text-primary flex items-center gap-2 mb-4">
        <DollarSign size={16} className="text-green-400" /> 费用默认值
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(({ key, label, hint, unit }) => (
          <div key={key} className="space-y-1.5">
            <div className="text-sm text-pdd-text-primary">{label}</div>
            <div className="text-xs text-pdd-text-secondary">{hint}</div>
            <div className="flex items-center gap-1.5">
              <input
                type="number" min={0} step="0.01"
                value={fees[key]}
                onChange={e => update(key, parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm outline-none focus:border-pdd-primary"
              />
              {unit && <span className="text-xs text-pdd-text-secondary w-8">{unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================== 快递费率 Tab ==================== */

function ExpressTab({ rates, onChange }: { rates: ExpressRateItem[]; onChange: (r: ExpressRateItem[]) => void }) {
  const updateCompany = (idx: number, field: keyof ExpressRateItem, value: number) => {
    const next = [...rates];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };

  const initMissingCompanies = () => {
    const existing = new Set(rates.map(r => r.company));
    const toAdd = EXPRESS_COMPANIES.filter(c => !existing.has(c)).map(c => ({
      company: c, firstWeight: 1, firstPrice: 3.5, continuedWeight: 1, continuedPrice: 1.5,
    }));
    if (toAdd.length > 0) onChange([...rates, ...toAdd]);
  };

  return (
    <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-pdd-text-primary flex items-center gap-2">
          <Truck size={16} className="text-blue-400" /> 快递公司费率表
        </h3>
        <button
          onClick={initMissingCompanies}
          className="text-xs text-pdd-primary hover:underline"
        >
          初始化缺失公司
        </button>
      </div>

      {rates.length === 0 ? (
        <div className="text-center py-8 text-pdd-text-secondary text-sm">
          暂无快递费率配置，点击"初始化缺失公司"添加默认费率
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pdd-border bg-pdd-bg">
                <th className="text-left py-2 px-3 font-medium text-pdd-text-secondary">快递公司</th>
                <th className="text-left py-2 px-3 font-medium text-pdd-text-secondary">首重(kg)</th>
                <th className="text-left py-2 px-3 font-medium text-pdd-text-secondary">首重价格</th>
                <th className="text-left py-2 px-3 font-medium text-pdd-text-secondary">续重(kg)</th>
                <th className="text-left py-2 px-3 font-medium text-pdd-text-secondary">续重单价</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate, idx) => (
                <tr key={rate.company} className="border-b border-pdd-border/30 hover:bg-pdd-bg/50">
                  <td className="py-2 px-3 font-medium text-pdd-text-primary">{rate.company}</td>
                  <td className="py-2 px-3">
                    <input type="number" min={0} step="0.1" value={rate.firstWeight}
                      onChange={e => updateCompany(idx, 'firstWeight', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 bg-pdd-bg border border-pdd-border rounded text-xs outline-none text-center" />
                  </td>
                  <td className="py-2 px-3">
                    <input type="number" min={0} step="0.01" value={rate.firstPrice}
                      onChange={e => updateCompany(idx, 'firstPrice', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 bg-pdd-bg border border-pdd-border rounded text-xs outline-none text-center" />
                  </td>
                  <td className="py-2 px-3">
                    <input type="number" min={0} step="0.1" value={rate.continuedWeight}
                      onChange={e => updateCompany(idx, 'continuedWeight', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 bg-pdd-bg border border-pdd-border rounded text-xs outline-none text-center" />
                  </td>
                  <td className="py-2 px-3">
                    <input type="number" min={0} step="0.01" value={rate.continuedPrice}
                      onChange={e => updateCompany(idx, 'continuedPrice', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 bg-pdd-bg border border-pdd-border rounded text-xs outline-none text-center" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==================== 扣费公式 Tab ==================== */

function FormulasTab({ formulas, onChange }: { formulas: DeductionFormula[]; onChange: (f: DeductionFormula[]) => void }) {
  const [editing, setEditing] = useState<DeductionFormula | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState({ name: '', formula: '' });

  const openNew = () => {
    setFormData({ name: '', formula: '' });
    setEditing(null);
    setIsNew(true);
  };

  const openEdit = (f: DeductionFormula) => {
    setFormData({ name: f.name, formula: f.formula });
    setEditing(f);
    setIsNew(false);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.formula.trim()) return;
    if (isNew) {
      const newFormula: DeductionFormula = {
        id: Date.now().toString(),
        name: formData.name.trim(),
        formula: formData.formula.trim(),
        enabled: true,
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
      };
      onChange([...formulas, newFormula]);
    } else if (editing) {
      onChange(formulas.map(f => f.id === editing.id
        ? { ...f, name: formData.name.trim(), formula: formData.formula.trim() }
        : f
      ));
    }
    setEditing(null); setIsNew(false);
  };

  const handleDelete = (id: string) => {
    onChange(formulas.filter(f => f.id !== id));
    if (editing?.id === id) { setEditing(null); setIsNew(false); }
  };

  const handleToggle = (id: string) => {
    onChange(formulas.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
  };

  return (
    <div className="bg-pdd-card rounded-xl border border-pdd-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-pdd-text-primary flex items-center gap-2">
          <Calculator size={16} className="text-orange-400" /> 自定义扣费公式
        </h3>
        <button
          onClick={openNew}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-pdd-primary/10 text-pdd-primary text-xs hover:bg-pdd-primary/20 transition-colors"
        >
          <Plus size={12} /> 添加公式
        </button>
      </div>

      {/* 编辑表单 */}
      <AnimatePresence>
        {(isNew || editing) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-pdd-bg rounded-lg border border-pdd-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-pdd-text-primary">
                  {isNew ? '新建公式' : '编辑公式'}
                </span>
                <button onClick={() => { setEditing(null); setIsNew(false); }}
                  className="text-pdd-text-secondary hover:text-pdd-text">
                  <X size={14} />
                </button>
              </div>
              <input
                type="text" value={formData.name}
                onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                placeholder="公式名称，如：运费计算"
                className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm outline-none focus:border-pdd-primary"
              />
              <textarea
                value={formData.formula}
                onChange={e => setFormData(d => ({ ...d, formula: e.target.value }))}
                placeholder="公式表达式，如：firstPrice + continuedWeight * continuedPrice"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm outline-none focus:border-pdd-primary resize-none"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setEditing(null); setIsNew(false); }}
                  className="px-4 py-1.5 text-xs rounded-lg border border-pdd-border text-pdd-text-secondary">
                  取消
                </button>
                <button onClick={handleSave}
                  className="px-4 py-1.5 text-xs rounded-lg bg-pdd-primary text-white">
                  保存
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 公式列表 */}
      {formulas.length === 0 ? (
        <div className="text-center py-8 text-pdd-text-secondary text-sm">
          暂无扣费公式，点击"添加公式"创建
        </div>
      ) : (
        <div className="space-y-2">
          {formulas.map(f => (
            <div key={f.id}
              className={'flex items-center gap-3 p-3 rounded-lg border transition-colors ' +
                (f.enabled ? 'bg-pdd-bg border-pdd-border' : 'bg-pdd-bg/50 border-pdd-border/50 opacity-60')
              }
            >
              <button onClick={() => handleToggle(f.id)} className="flex-shrink-0">
                <Power size={16} className={f.enabled ? 'text-green-400' : 'text-pdd-text-secondary'} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-pdd-text-primary font-medium truncate">{f.name}</div>
                <div className="text-xs text-pdd-text-secondary font-mono mt-0.5 truncate">{f.formula}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(f)}
                  className="p-1.5 text-pdd-text-secondary hover:text-pdd-text rounded transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(f.id)}
                  className="p-1.5 text-pdd-text-secondary hover:text-red-400 rounded transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================== 税务配置 Tab ==================== */

function TaxTab({ rates, onChange }: { rates: TaxRateConfig; onChange: (r: TaxRateConfig) => void }) {
  const update = (key: keyof TaxRateConfig, value: number) => onChange({ ...rates, [key]: value });

  const fields: { key: keyof TaxRateConfig; label: string; hint: string }[] = [
    { key: 'vatRate', label: '增值税率', hint: '增值税适用税率（一般纳税人）' },
    { key: 'incomeTaxRate', label: '所得税率', hint: '企业所得税适用税率' },
    { key: 'surtaxRate', label: '附加税率', hint: '城建税、教育费附加等综合税率（基于增值税额的百分比）' },
  ];

  return (
    <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
      <h3 className="text-sm font-semibold text-pdd-text-primary flex items-center gap-2 mb-4">
        <Landmark size={16} className="text-purple-400" /> 税务配置
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {fields.map(({ key, label, hint }) => (
          <div key={key} className="space-y-1.5">
            <div className="text-sm text-pdd-text-primary">{label}</div>
            <div className="text-xs text-pdd-text-secondary">{hint}</div>
            <div className="flex items-center gap-1.5">
              <input
                type="number" min={0} max={100} step="0.1"
                value={rates[key]}
                onChange={e => update(key, parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm outline-none focus:border-pdd-primary"
              />
              <span className="text-xs text-pdd-text-secondary">%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================== 变更历史 Tab ==================== */

function HistoryTab() {
  const [history, setHistory] = useState<ConfigHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    adminApi.getConfigHistory({ page, pageSize }).then(res => {
      if (res.success) {
        setHistory(res.data ?? []);
        setTotal((res as any).total ?? 0);
      }
      setLoading(false);
    });
  }, [page]);

  const formatValue = (raw: string | null): string => {
    if (!raw) return '(空)';
    try {
      const obj = JSON.parse(raw);
      return JSON.stringify(obj, null, 0);
    } catch {
      return raw.length > 80 ? raw.substring(0, 80) + '...' : raw;
    }
  };

  return (
    <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
      <h3 className="text-sm font-semibold text-pdd-text-primary flex items-center gap-2 mb-4">
        <History size={16} className="text-cyan-400" /> 配置变更历史
      </h3>

      {loading ? (
        <div className="text-center py-8 text-pdd-text-secondary text-sm">加载中...</div>
      ) : history.length === 0 ? (
        <div className="text-center py-8 text-pdd-text-secondary text-sm">暂无变更记录</div>
      ) : (
        <div className="space-y-3">
          {history.map(item => (
            <div key={item.id} className="bg-pdd-bg rounded-lg border border-pdd-border p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                    {item.configKey}
                  </span>
                  <span className="text-xs text-pdd-text-secondary">{item.changedBy}</span>
                </div>
                <span className="text-[10px] text-pdd-text-secondary">
                  {new Date(item.changedAt).toLocaleString('zh-CN')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="text-red-400/70">旧值</div>
                  <div className="text-pdd-text-secondary font-mono bg-red-500/5 px-2 py-1 rounded break-all">
                    {formatValue(item.oldValue)}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-green-400/70">新值</div>
                  <div className="text-pdd-text-secondary font-mono bg-green-500/5 px-2 py-1 rounded break-all">
                    {formatValue(item.newValue)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* 分页 */}
          {total > pageSize && (
            <div className="flex items-center justify-between pt-2 border-t border-pdd-border text-xs text-pdd-text-secondary">
              <span>共 {total} 条</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2 py-1 bg-pdd-bg rounded disabled:opacity-30 hover:bg-pdd-border">
                  上一页
                </button>
                <span>{page} / {Math.ceil(total / pageSize)}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(total / pageSize)}
                  className="px-2 py-1 bg-pdd-bg rounded disabled:opacity-30 hover:bg-pdd-border">
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
