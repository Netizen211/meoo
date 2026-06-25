import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Store, User, DollarSign, FileText, Bell, Palette, Database, Info,
  Settings as SettingsIcon, ChevronRight, LogOut, Save, Shield, Activity,
  Plus, Pencil, Trash2, Check, AlertTriangle, Upload, Clock, Moon, Sun,
  Package, TrendingUp, Download, Eye, Gift, Truck, ChevronDown
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useAuth, useStore, useData } from '../App';
import { apiClient } from '../../api/client';
import { toast } from '../components/ui/toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/collapsible';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';

interface Section { id: string; label: string; icon: React.ComponentType<any>; }
const SECTIONS: Section[] = [
  { id: 'stores', label: '店铺管理', icon: Store },
  { id: 'account', label: '账号安全', icon: User },
  { id: 'cost', label: '成本设置', icon: DollarSign },
  { id: 'tax', label: '税务设置', icon: FileText },
  { id: 'alert', label: '预警配置', icon: Bell },
  { id: 'preferences', label: '界面偏好', icon: Palette },
  { id: 'data', label: '数据策略', icon: Database },
  { id: 'about', label: '关于', icon: Info },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { stores, addStore, renameStore, deleteStore } = useStore();
  const [activeSection, setActiveSection] = useState('stores');
  const [cloudUsage, setCloudUsage] = useState({ usageMB: 0, limitMB: 30 });

  useEffect(() => {
    apiClient.get('/admin/storage/usage').then((r: any) => {
      if (r.success && r.data) setCloudUsage(r.data);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex h-full min-h-0 bg-pdd-bg">
      {/* Left sidebar */}
      <aside className="w-[240px] flex-shrink-0 border-r border-pdd-border bg-pdd-card">
        <div className="p-4 border-b border-pdd-border">
          <h2 className="text-sm font-bold text-pdd-text flex items-center gap-2">
            <SettingsIcon size={16} className="text-pdd-primary" />
            设置中心
          </h2>
          <p className="text-[11px] text-pdd-text-secondary mt-0.5">配置你的店铺、成本、账号等</p>
        </div>
        <nav className="py-2">
          {SECTIONS.map(s => (
            <div key={s.id} className="relative px-2 py-0.5">
              {activeSection === s.id && (
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-pdd-primary/10 via-purple-500/5 to-transparent border-l-2 border-pdd-primary" />
              )}
              <button onClick={() => setActiveSection(s.id)}
                className={'relative w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all rounded-lg ' +
                  (activeSection === s.id
                    ? 'text-pdd-primary font-medium'
                    : 'text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg/50')
                }>
                <s.icon size={16} className={activeSection === s.id ? 'text-pdd-primary' : ''} />
                <span>{s.label}</span>
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {/* Right content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="relative group max-w-3xl">
          <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-br from-pdd-primary/20 via-purple-500/10 to-pink-500/10 opacity-40 blur-[1px]" />
          <div className="relative rounded-xl" style={{ background: 'rgba(15, 18, 35, 0.85)' }}>
            {activeSection === 'stores' && <StoreSection stores={stores} addStore={addStore} renameStore={renameStore} deleteStore={deleteStore} />}
            {activeSection === 'account' && <AccountSection user={user} logout={logout} />}
            {activeSection === 'cost' && <CostSection />}
            {activeSection === 'tax' && <TaxSection />}
            {activeSection === 'alert' && <AlertSection />}
            {activeSection === 'preferences' && <PreferencesSection />}
            {activeSection === 'data' && <DataSection cloudUsage={cloudUsage} />}
            {activeSection === 'about' && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
// ===== Settings Section Components =====

function StoreSection({ stores, addStore, renameStore, deleteStore }: any) {
  const [newName, setNewName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; store: any; name: string }>({ open: false, store: null, name: '' });

  const storeList = stores.filter((s: any) => s.id !== '__all__');

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error('请输入店铺名称');
      return;
    }
    try {
      await addStore(newName.trim());
      toast.success(`店铺「${newName.trim()}」已添加`);
      setNewName('');
      setDialogOpen(false);
    } catch {
      toast.error('添加店铺失败，请重试');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteStore(id);
      toast.success(`店铺「${name}」已删除`);
    } catch {
      toast.error('删除店铺失败，请重试');
    }
  };

  const handleRename = async () => {
    if (!renameDialog.name.trim()) {
      toast.error('请输入新名称');
      return;
    }
    try {
      renameStore(renameDialog.store.id, renameDialog.name.trim());
      toast.success(`店铺已重命名为「${renameDialog.name.trim()}」`);
      setRenameDialog({ open: false, store: null, name: '' });
    } catch {
      toast.error('重命名失败');
    }
  };

  return (
    <div className="max-w-2xl">
      <SectionHeader icon={Store} title="店铺管理" desc="管理所有店铺的增删改查" />
      <Card>
        <CardContent className="p-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>店铺名</TableHead>
                <TableHead>默认店铺</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {storeList.map((s: any, i: number) => (
                <TableRow key={s.id}>
                  <TableCell className="text-pdd-text-secondary">{i + 1}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    {i === 0 ? <Badge variant="secondary">默认</Badge> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => setRenameDialog({ open: true, store: s, name: s.name })}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-pdd-danger hover:text-pdd-danger"
                      onClick={() => handleDelete(s.id, s.name)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <Plus size={14} className="mr-1" /> 添加店铺
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加店铺</DialogTitle>
                  <DialogDescription>输入新店铺的名称，添加后即可上传该店铺的数据</DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 pt-2">
                  <Input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="新店铺名称"
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    autoFocus
                  />
                  <Button onClick={handleAdd}>添加</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* 重命名弹窗 */}
          <Dialog open={renameDialog.open} onOpenChange={open => setRenameDialog(p => ({ ...p, open }))}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>重命名店铺</DialogTitle>
                <DialogDescription>修改店铺「{renameDialog.store?.name}」的名称</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 pt-2">
                <Input
                  value={renameDialog.name}
                  onChange={e => setRenameDialog(p => ({ ...p, name: e.target.value }))}
                  placeholder="新名称"
                  onKeyDown={e => e.key === 'Enter' && handleRename()}
                  autoFocus
                />
                <Button onClick={handleRename}>保存</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountSection({ user, logout }: any) {
  const membershipLabel = user?.membershipLevel === 'enterprise' ? '企业版'
    : user?.membershipLevel === 'pro' ? '专业版' : '免费版';
  const membershipVariant = user?.membershipLevel === 'enterprise' ? 'default'
    : user?.membershipLevel === 'pro' ? 'success' : 'secondary';
  const [apiToken, setApiToken] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiClient.get('/auth/api-token').then((r: any) => {
      if (r.success && r.data?.token) setApiToken(r.data.token);
    }).catch(() => {});
  }, []);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(apiToken).then(() => {
      setCopied(true);
      toast.success('API Token 已复制');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error('复制失败，请手动选中复制');
    });
  };

  return (
    <div className="max-w-2xl">
      <SectionHeader icon={User} title="账号安全" desc="当前账号信息和安全管理" />
      <Card>
        <CardContent className="p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-pdd-border/50">
              <span className="text-sm text-pdd-text-secondary">用户名</span>
              <span className="text-sm font-medium">{user?.username || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-pdd-border/50">
              <span className="text-sm text-pdd-text-secondary">邮箱</span>
              <span className="text-sm">{user?.email || '未设置'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-pdd-text-secondary">套餐</span>
              <Badge variant={membershipVariant as any}>{membershipLabel}</Badge>
            </div>
          </div>

          {/* API Token (for browser extension) */}
          {apiToken && (
            <div className="mt-4 pt-4 border-t border-pdd-border/50">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Shield size={14} className="text-pdd-primary" />
                浏览器扩展 API Token
              </h4>
              <p className="text-[11px] text-pdd-text-secondary mb-2">
                将此 Token 填入拼多多图片同步浏览器扩展中，即可自动导入商品图片。
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={apiToken}
                  readOnly
                  className="font-mono text-xs"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button variant="outline" size="sm" onClick={handleCopyToken} className="shrink-0">
                  {copied ? <Check size={14} /> : '复制'}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-pdd-border/50">
            <Button variant="destructive" size="sm" onClick={logout}>
              <LogOut size={14} className="mr-1.5" /> 退出登录
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CostSection() {
  const data = useData();
  const [packaging, setPackaging] = useState(String(data.packagingFeePerOrder || 2));
  const [labor, setLabor] = useState(String(data.laborFeePerOrder || 1));
  const [estRatio, setEstRatio] = useState(String(data.defaultCostRatio || 40));

  const handleSave = () => {
    const p = parseFloat(packaging);
    const l = parseFloat(labor);
    const r = parseFloat(estRatio);
    if (isNaN(p) || p < 0) { toast.error('包装费格式不正确'); return; }
    if (isNaN(l) || l < 0) { toast.error('人工费格式不正确'); return; }
    if (isNaN(r) || r < 0 || r > 100) { toast.error('估算比例需在 0-100 之间'); return; }
    data.setPackagingFeePerOrder(p);
    data.setLaborFeePerOrder(l);
    data.setDefaultCostRatio(r);
    toast.success('成本设置已保存并同步到云端');
  };

  return (
    <div className="max-w-2xl">
      <SectionHeader icon={DollarSign} title="成本设置" desc="全局成本参数默认值" />
      <Card>
        <CardContent className="p-5 space-y-5">
          <div>
            <h4 className="text-sm font-medium mb-3">按单费用</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-pdd-text-secondary">包装费（元/单）</label>
                <Input type="number" step="0.01" value={packaging} onChange={e => setPackaging(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-pdd-text-secondary">人工费（元/单）</label>
                <Input type="number" step="0.01" value={labor} onChange={e => setLabor(e.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-3">默认估算比例</h4>
            <label className="text-xs text-pdd-text-secondary">未填进价时，按售价的百分比估算</label>
            <div className="flex items-center gap-2 mt-1.5">
              <Input type="number" className="w-24" value={estRatio} onChange={e => setEstRatio(e.target.value)} />
              <span className="text-sm text-pdd-text-secondary">%</span>
            </div>
          </div>
          <Button onClick={handleSave}>
            <Save size={14} className="mr-1.5" /> 保存设置
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function TaxSection() {
  const loadTaxConfig = () => {
    try {
      const raw = localStorage.getItem('dianfx_tax_config');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { taxType: 'general', cityRate: '7', eduRate: '3', localEduRate: '2', corpTaxRate: '25' };
  };
  const saved = loadTaxConfig();
  const [taxType, setTaxType] = useState(saved.taxType);
  const [cityRate, setCityRate] = useState(saved.cityRate);
  const [eduRate, setEduRate] = useState(saved.eduRate);
  const [localEduRate, setLocalEduRate] = useState(saved.localEduRate);
  const [corpTaxRate, setCorpTaxRate] = useState(saved.corpTaxRate);

  const handleSave = () => {
    const config = { taxType, cityRate, eduRate, localEduRate, corpTaxRate };
    try {
      localStorage.setItem('dianfx_tax_config', JSON.stringify(config));
      apiClient.post('/admin/config/tax', config).catch(() => {});
      toast.success('税务设置已保存');
    } catch {
      toast.error('保存失败，请重试');
    }
  };

  return (
    <div className="max-w-2xl">
      <SectionHeader icon={FileText} title="税务设置" desc="税务计算配置（仅供参考）" />
      <Card>
        <CardContent className="p-5 space-y-5">
          <div>
            <h4 className="text-sm font-medium mb-3">增值税</h4>
            <Select value={taxType} onValueChange={setTaxType}>
              <SelectTrigger>
                <SelectValue placeholder="选择纳税人类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">一般纳税人（13%）</SelectItem>
                <SelectItem value="small">小规模纳税人（3%）</SelectItem>
                <SelectItem value="none">不计算增值税</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-3">
              附加税 <span className="text-[10px] text-pdd-text-secondary font-normal">（×增值税）</span>
            </h4>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: '城建税', val: cityRate, set: setCityRate },
                { label: '教育附加', val: eduRate, set: setEduRate },
                { label: '地方教育', val: localEduRate, set: setLocalEduRate },
              ].map(t => (
                <div key={t.label} className="space-y-1.5">
                  <label className="text-xs text-pdd-text-secondary">{t.label}</label>
                  <div className="flex items-center gap-1.5">
                    <Input type="number" value={t.val} onChange={e => t.set(e.target.value)} />
                    <span className="text-sm text-pdd-text-secondary shrink-0">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-3">企业所得税</h4>
            <div className="flex items-center gap-2">
              <Input type="number" className="w-24" value={corpTaxRate} onChange={e => setCorpTaxRate(e.target.value)} />
              <span className="text-sm text-pdd-text-secondary">%</span>
            </div>
          </div>
          <div className="pt-2 border-t border-pdd-border/50 text-[10px] text-pdd-text-secondary">
            💡 税务相关的计算结果会展示在财务管理的"含税利润"中
          </div>
          <Button onClick={handleSave}>
            <Save size={14} className="mr-1.5" /> 保存设置
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AlertSection() {
  const [rules, setRules] = useState<Record<string, boolean>>({
    freqPriceChange: true, highAfterSale: true, highRefund: true, priceFluctuation: true,
    profitDrop: true, penaltySurge: true, promoAbnormal: true,
    refundRateSurge: true, afterSaleTimeout: true, multiRefund: true,
    delayShip: true, fakeShip: true,
    lowRoi: true, costSurge: true,
    noCost: true, costAbnormal: true,
    dataDelay: true, dataMissing: true,
  });
  const [thresholds, setThresholds] = useState<Record<string, string>>({
    highAfterSale: '30', highRefund: '15', priceFluctuation: '50',
    profitDrop: '30', penaltySurge: '3', promoAbnormal: '30',
    refundRateSurge: '2', afterSaleTimeout: '48', multiRefund: '3',
    delayShip: '5', lowRoi: '1.5', costSurge: '3',
  });
  const [notify, setNotify] = useState<Record<string, boolean>>({
    criticalPage: true, criticalPopup: true, warnPage: true, warnPopup: false, infoPage: true, infoPopup: false,
  });

  const toggle = (k: string) => setRules(p => ({ ...p, [k]: !p[k] }));
  const setTh = (k: string, v: string) => setThresholds(p => ({ ...p, [k]: v }));
  const toggleNotify = (k: string) => setNotify(p => ({ ...p, [k]: !p[k] }));

  const handleSave = () => {
    const alertConfig = { rules, thresholds, notify };
    try {
      localStorage.setItem('dianfx_alert_config', JSON.stringify(alertConfig));
      apiClient.post('/admin/config/alert', alertConfig).catch(() => {});
      toast.success('预警配置已保存');
    } catch {
      toast.error('保存失败，请重试');
    }
  };

  // 从 localStorage 恢复
  useEffect(() => {
    try {
      const raw = localStorage.getItem('dianfx_alert_config');
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.rules) setRules(saved.rules);
      if (saved.thresholds) setThresholds(saved.thresholds);
      if (saved.notify) setNotify(saved.notify);
    } catch {}
  }, []);

  // 8大维度规则定义
  const dimensions = [
    { key: 'product', label: '商品风险', icon: Package, color: '#1F6BFF',
      rules: [
        { k: 'freqPriceChange', label: '频繁改价商品', type: 'toggle' },
        { k: 'highAfterSale', label: '高售后率商品', type: 'threshold', unit: '%', thKey: 'highAfterSale' },
        { k: 'highRefund', label: '高退款率商品', type: 'threshold', unit: '%', thKey: 'highRefund' },
        { k: 'priceFluctuation', label: '价格波动异常', type: 'threshold', unit: '%', thKey: 'priceFluctuation' },
      ]},
    { key: 'finance', label: '财务风险', icon: DollarSign, color: '#ef4444',
      rules: [
        { k: 'profitDrop', label: '利润暴跌', type: 'threshold', unit: '%', thKey: 'profitDrop' },
        { k: 'penaltySurge', label: '罚款激增', type: 'threshold', unit: '倍', thKey: 'penaltySurge' },
        { k: 'promoAbnormal', label: '推广费异常', type: 'threshold', unit: '%', thKey: 'promoAbnormal' },
      ]},
    { key: 'afterSale', label: '售后风险', icon: Bell, color: '#f97316',
      rules: [
        { k: 'refundRateSurge', label: '退款率突增', type: 'threshold', unit: '倍', thKey: 'refundRateSurge' },
        { k: 'afterSaleTimeout', label: '售后处理超时', type: 'threshold', unit: 'h', thKey: 'afterSaleTimeout' },
        { k: 'multiRefund', label: '多次退款', type: 'threshold', unit: '次', thKey: 'multiRefund' },
      ]},
    { key: 'logistics', label: '物流风险', icon: Truck, color: '#7c3aed',
      rules: [
        { k: 'delayShip', label: '延迟发货率', type: 'threshold', unit: '%', thKey: 'delayShip' },
        { k: 'fakeShip', label: '虚假发货', type: 'toggle' },
      ]},
    { key: 'promo', label: '推广风险', icon: TrendingUp, color: '#0891b2',
      rules: [
        { k: 'lowRoi', label: 'ROI过低', type: 'threshold', unit: '', thKey: 'lowRoi' },
        { k: 'costSurge', label: '花费突增', type: 'threshold', unit: '倍', thKey: 'costSurge' },
      ]},
    { key: 'cost', label: '成本风险', icon: Shield, color: '#16a34a',
      rules: [
        { k: 'noCost', label: '成本未配置', type: 'toggle' },
        { k: 'costAbnormal', label: '成本异常（利润为负）', type: 'toggle' },
      ]},
    { key: 'data', label: '数据风险', icon: Database, color: '#64748b',
      rules: [
        { k: 'dataDelay', label: '数据延迟', type: 'toggle' },
        { k: 'dataMissing', label: '数据缺失', type: 'toggle' },
      ]},
  ];

  return (
    <div className="max-w-2xl">
      <SectionHeader icon={Bell} title="预警配置" desc="管理风险预警规则和通知方式" />
      <div className="space-y-3">
        {dimensions.map(dim => (
          <Card key={dim.key}>
            <CardContent className="p-4">
              <Collapsible defaultOpen>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="flex w-full justify-between p-0 h-auto hover:bg-transparent">
                    <div className="flex items-center gap-2">
                      <dim.icon size={16} color={dim.color} />
                      <h4 className="text-sm font-semibold">{dim.label}</h4>
                    </div>
                    <ChevronDown size={14} className="text-pdd-text-secondary" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 space-y-2 pl-1">
                    {dim.rules.map(r => {
                      const enabled = rules[r.k] !== false;
                      const isThreshold = r.type === 'threshold';
                      return (
                        <div key={r.k} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={enabled}
                              onCheckedChange={() => toggle(r.k)}
                              className="scale-75 origin-left"
                            />
                            <span className={`text-xs ${enabled ? '' : 'text-pdd-gray-400'}`}>
                              {r.label}
                            </span>
                          </div>
                          {isThreshold && enabled && (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                className="w-16 h-7 text-xs text-center px-1"
                                value={thresholds[r.thKey!] || ''}
                                onChange={e => setTh(r.thKey!, e.target.value)}
                              />
                              <span className="text-[10px] text-pdd-text-secondary w-3">{r.unit}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        ))}

        {/* 通知设置 */}
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Eye size={14} /> 通知设置
            </h4>
            <div className="space-y-2">
              {[
                { label: '严重预警', k: 'critical', pageKey: 'criticalPage', popKey: 'criticalPopup', badge: 'destructive' as const },
                { label: '警告预警', k: 'warn', pageKey: 'warnPage', popKey: 'warnPopup', badge: 'warning' as const },
                { label: '提醒预警', k: 'info', pageKey: 'infoPage', popKey: 'infoPopup', badge: 'default' as const },
              ].map(n => (
                <div key={n.k} className="flex items-center gap-4 py-1">
                  <Badge variant={n.badge} className="w-20 justify-center">{n.label}</Badge>
                  <label className="flex items-center gap-1.5 text-xs text-pdd-text-secondary cursor-pointer">
                    <input type="checkbox" checked={notify[n.pageKey]} onChange={() => toggleNotify(n.pageKey)} className="w-3.5 h-3.5 rounded border-pdd-border" />
                    页面标记
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-pdd-text-secondary cursor-pointer">
                    <input type="checkbox" checked={notify[n.popKey]} onChange={() => toggleNotify(n.popKey)} className="w-3.5 h-3.5 rounded border-pdd-border" />
                    弹窗通知
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave}>
          <Save size={14} className="mr-1.5" /> 保存设置
        </Button>
      </div>
    </div>
  );
}

function PreferencesSection() {
  const { isDark, toggle } = useDarkMode();
  return (
    <div className="max-w-2xl">
      <SectionHeader icon={Palette} title="界面偏好" desc="控制页面的展示方式" />
      <Card>
        <CardContent className="p-5 space-y-4">
          {/* 暗色模式开关 */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-pdd-gray-100 flex items-center justify-center">
                {isDark ? <Moon size={18} className="text-pdd-primary" /> : <Sun size={18} className="text-pdd-warning" />}
              </div>
              <div>
                <p className="text-sm font-medium">暗色模式</p>
                <p className="text-xs text-pdd-text-secondary">
                  {isDark ? '深色背景，适合夜间使用' : '蓝白企业级风格'}
                </p>
              </div>
            </div>
            <Switch checked={isDark} onCheckedChange={toggle} />
          </div>

          <div className="border-t border-pdd-border/50" />

          {/* 主题色说明 */}
          <div className="text-xs text-pdd-text-secondary">
            <p className="font-medium mb-1">当前主题</p>
            <p>主色: <span className="text-pdd-primary">#1F6BFF</span></p>
            <p className="mt-0.5">切换后所有页面立即生效，偏好自动保存</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DataSection({ cloudUsage }: any) {
  const loadDataConfig = () => {
    try {
      const raw = localStorage.getItem('dianfx_data_config');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { uploadRetention: '90', logRetention: '30', autoBackup: false, backupFreq: 'weekly' };
  };
  const savedData = loadDataConfig();
  const [uploadRetention, setUploadRetention] = useState(savedData.uploadRetention);
  const [logRetention, setLogRetention] = useState(savedData.logRetention);
  const [autoBackup, setAutoBackup] = useState(savedData.autoBackup);
  const [backupFreq, setBackupFreq] = useState(savedData.backupFreq);

  const handleSave = () => {
    const config = { uploadRetention, logRetention, autoBackup, backupFreq };
    try {
      localStorage.setItem('dianfx_data_config', JSON.stringify(config));
      apiClient.post('/admin/config/data', config).catch(() => {});
      toast.success('数据策略已保存');
    } catch {
      toast.error('保存失败，请重试');
    }
  };

  const handleExport = () => {
    const allConfigs = {
      tax: localStorage.getItem('dianfx_tax_config') || '{}',
      alert: localStorage.getItem('dianfx_alert_config') || '{}',
      data: localStorage.getItem('dianfx_data_config') || '{}',
      exportedAt: new Date().toISOString(),
      version: '2.5.0',
    };
    const blob = new Blob([JSON.stringify(allConfigs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meoo-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('配置已导出');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const cfg = JSON.parse(text);
        if (cfg.tax) localStorage.setItem('dianfx_tax_config', cfg.tax);
        if (cfg.alert) localStorage.setItem('dianfx_alert_config', cfg.alert);
        if (cfg.data) localStorage.setItem('dianfx_data_config', cfg.data);
        toast.success('配置已导入，请刷新页面生效');
      } catch {
        toast.error('导入失败，文件格式不正确');
      }
    };
    input.click();
  };

  return (
    <div className="max-w-2xl">
      <SectionHeader icon={Database} title="数据策略" desc="数据保留和自动清理规则" />
      <Card>
        <CardContent className="p-5 space-y-5">
          <div>
            <h4 className="text-sm font-medium mb-3">数据保留</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-pdd-text-secondary">上传记录保留</span>
                <div className="flex items-center gap-2">
                  <Input type="number" className="w-20 text-center" value={uploadRetention} onChange={e => setUploadRetention(e.target.value)} />
                  <span className="text-xs text-pdd-text-secondary">天</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-pdd-text-secondary">操作日志保留</span>
                <div className="flex items-center gap-2">
                  <Input type="number" className="w-20 text-center" value={logRetention} onChange={e => setLogRetention(e.target.value)} />
                  <span className="text-xs text-pdd-text-secondary">天</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-pdd-border/50 pt-4">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Upload size={14} className="text-pdd-primary" /> 云盘用量
            </h4>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-pdd-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pdd-primary rounded-full transition-all"
                  style={{ width: `${Math.min((cloudUsage.usageMB || 0) / (cloudUsage.limitMB || 30) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs text-pdd-text-secondary font-mono whitespace-nowrap">
                {(cloudUsage.usageMB || 0).toFixed(1)}MB / {cloudUsage.limitMB || 30}MB
              </span>
            </div>
          </div>

          <div className="border-t border-pdd-border/50 pt-4">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Clock size={14} /> 自动备份
            </h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
                <span className="text-xs text-pdd-text-secondary">启用自动备份到云端</span>
              </div>
              {autoBackup && (
                <Select value={backupFreq} onValueChange={setBackupFreq}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">每天</SelectItem>
                    <SelectItem value="weekly">每周</SelectItem>
                    <SelectItem value="monthly">每月</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="border-t border-pdd-border/50 pt-4">
            <h4 className="text-sm font-medium mb-3">配置管理</h4>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download size={14} className="mr-1" /> 导出配置
              </Button>
              <Button variant="outline" size="sm" onClick={handleImport}>
                <Upload size={14} className="mr-1" /> 导入配置
              </Button>
            </div>
            <p className="text-[10px] text-pdd-text-secondary mt-1.5">导出所有配置为 JSON，可用于备份或恢复</p>
          </div>

          <Button onClick={handleSave}>
            <Save size={14} className="mr-1.5" /> 保存设置
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AboutSection() {
  const changelog = [
    { tag: 'v2.6.0', date: '2026-06-04', items: ['操作时间线 + 订单追溯深度解析', 'Settings 预警配置/税务设置/数据策略补齐', '全页面暗色模式兼容性测试通过'] },
    { tag: 'v2.5.0', date: '2026-06-04', items: ['蓝白企业级UI设计系统落地', '全站CSS变量体系 + 暗色模式', '运营中台14个模块全部部署'] },
    { tag: 'v2.4.0', date: '2026-05-20', items: ['成本管理全面重设计', '自定义扣费公式引擎', '快递分快递公司配置'] },
  ];

  return (
    <div className="max-w-2xl">
      <SectionHeader icon={Info} title="关于" desc="版本信息、更新记录、帮助反馈" />
      <div className="space-y-3">
        {/* Logo & 版本 */}
        <Card>
          <CardContent className="p-5 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pdd-primary to-blue-600 flex items-center justify-center mx-auto mb-3 shadow-md shadow-pdd-primary/20">
              <Activity size={24} className="text-white" />
            </div>
            <h3 className="text-sm font-bold">店分析 v2.5.0</h3>
            <p className="text-xs text-pdd-text-secondary mt-1">拼多多商家智能数据分析平台</p>
            <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-pdd-text-secondary">
              <Badge variant="secondary">Chrome 125</Badge>
              <Badge variant="secondary">Node.js 18</Badge>
            </div>
          </CardContent>
        </Card>

        {/* 更新记录 */}
        <Card>
          <CardContent className="p-5">
            <h4 className="text-sm font-medium mb-3">📋 更新记录</h4>
            <div className="space-y-2">
              {changelog.map(v => (
                <div key={v.tag} className="border-b border-pdd-border/50 pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">{v.tag}</Badge>
                    <span className="text-[10px] text-pdd-text-secondary">{v.date}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {v.items.map((item, i) => (
                      <li key={i} className="text-xs text-pdd-text-secondary flex items-start gap-1">
                        <span className="text-pdd-primary mt-0.5">·</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 帮助与反馈 */}
        <Card>
          <CardContent className="p-5">
            <h4 className="text-sm font-medium mb-3">💬 帮助与反馈</h4>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" disabled>
                📖 使用文档
              </Button>
              <Button variant="outline" size="sm" disabled>
                💬 提交反馈
              </Button>
              <Button variant="outline" size="sm" disabled>
                🐛 报告 Bug
              </Button>
            </div>
            <p className="text-[10px] text-pdd-text-secondary mt-3">联系邮箱：support@meoo.wang</p>
          </CardContent>
        </Card>

        {/* 数据声明 */}
        <Card>
          <CardContent className="p-5">
            <h4 className="text-sm font-medium mb-3">🔒 数据声明</h4>
            <p className="text-xs text-pdd-text-secondary leading-relaxed">
              所有数据存储在香港服务器，使用 Cloudflare CDN 加密传输。<br />
              你的上传数据仅用于本平台分析，不会分享给第三方。<br />
              可随时在数据管理页面清理或导出所有数据。
            </p>
          </CardContent>
        </Card>

        <p className="text-[10px] text-pdd-text-secondary text-center">&copy; 2026 Pro Analytics</p>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, desc }: { icon: React.ComponentType<any>; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-9 h-9 rounded-lg bg-pdd-primary/10 flex items-center justify-center">
        <Icon size={18} className="text-pdd-primary" />
      </div>
      <div>
        <h3 className="text-base font-bold text-pdd-text">{title}</h3>
        <p className="text-xs text-pdd-text-secondary">{desc}</p>
      </div>
    </div>
  );
}



