export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: 'v2.5',
    date: '2026-05-27',
    changes: [
      '修复跨设备登录后数据为空的问题 — 店铺列表现在从服务器同步，换设备也能看到数据',
      '新增网站更新日志面板',
    ],
  },
  {
    version: 'v2.4',
    date: '2026-05-26',
    changes: [
      '修复风险预警页时间筛选和趋势图不更新的问题',
      '修复地域分析页买家数据为空、饼图不显示的问题',
      '修复商品列表成本已填写但不展示的问题（useMemo 依赖缺失）',
      '禁止通过 IP 直接访问网站，仅允许域名访问',
      '百亿补贴标识展示优化',
      '运费险数据解析修复',
    ],
  },
  {
    version: 'v2.3',
    date: '2026-05-20',
    changes: [
      '自动部署流程优化，适配宝塔面板环境',
      '管理后台同步部署',
    ],
  },
  {
    version: 'v2.2',
    date: '2026-05-18',
    changes: [
      '商品分析推广费遗漏修复 — 公式引擎支持中文变量名',
      'GitHub Actions 自动部署流水线',
    ],
  },
  {
    version: 'v2.1',
    date: '2026-05-15',
    changes: [
      '服务端架构升级 — JWT 认证 + 数据同步 + 后台管理 + 安全加固',
    ],
  },
  {
    version: 'v2.0',
    date: '2026-05-10',
    changes: [
      '新增中国地图地域分析',
      '新增趋势分析页面',
      '新增活动日历',
      'TimeFilter 支持自定义日期和单天选择',
      '订单明细表格列对齐修复',
    ],
  },
  {
    version: 'v1.0',
    date: '2026-04-01',
    changes: [
      '项目初始化 — Webpack + React + TypeScript + Tailwind CSS',
      '支持 CSV/XLSX/ZIP 数据上传与解析',
      'Dashboard 核心数据看板',
      '商品分析、成本管理、推广分析等模块',
    ],
  },
];
