# CLAUDE.md — 店分析 项目指令

> **版本**: 3.1 | 最后更新: 2026-06-07  
> **工作方法论**: Flow Engineering（流程工程）— 结构化多阶段工作流  
> **核心参考**: AlphaCodium（19%→44% 准确率提升）+ Aider（45k⭐ 仓库图模式）+ CodeGraph（43k⭐ 代码知识图谱）  
> **遵循协议**: [FLOW-ENGINEERING-PROTOCOL.md](./docs/FLOW-ENGINEERING-PROTOCOL.md) | [CONTEXT-HANDOFF-PROTOCOL.md](./docs/CONTEXT-HANDOFF-PROTOCOL.md)  
> **当前进度**: [28-项目升级跟踪表.md](./docs/项目计划/28-项目升级跟踪表.md)
> **文档体系**: `docs/项目计划/28-项目升级跟踪表.md → 十(附)、文档体系总览`（5层文档架构，每个文件干什么用）

## 一、沟通规则
- **必须使用中文** 与用户沟通（回复、解释、代码注释等）
- 当用户指令与本文档冲突时，以本文档为准
- 不确定时先问用户，不要擅自假设

## 二、项目定位
- 拼多多商家数据分析工具「店分析」
- 核心价值：算出每一单赚多少钱，每个数字都能说清来源
- 技术栈：React 18 + TypeScript + Webpack 5 + Tailwind CSS v3
- 关键依赖：Recharts（图表）、Zustand（状态）、Framer Motion（动画）

## 三、⚠️ Flow Engineering 强制流程（MANDATORY）

> **所有工作必须遵循 PLAN → EXECUTE → VERIFY → LOG 四阶段流程。**
> 这是将 AI 错误率从 40%+ 降至个位数的核心方法（参考 AlphaCodium）。
> 详细协议（含 STRUCTURE 阶段和偏离处理）见 `docs/FLOW-ENGINEERING-PROTOCOL.md`

### 3.1 每次会话开始时 — PLAN 阶段（先计划，后执行）
```markdown
□ 步骤 1 — 读跟踪表：读取 docs/项目计划/28-项目升级跟踪表.md
  → 了解当前整体进度和正在进行的任务
  → 定位文档体系：看「十(附)、文档体系总览」→ 明确本次要改的文档在哪一层、与谁关联

□ 步骤 2 — 读流程协议：读取 docs/FLOW-ENGINEERING-PROTOCOL.md
  → 了解 Flow Engineering 五阶段流程

□ 步骤 3 — 读上下文协议：读取 docs/CONTEXT-HANDOFF-PROTOCOL.md
  → 了解上下文压缩保护机制

□ 步骤 4 — 读会话摘要：读取 SESSION_SUMMARY.md
  → 了解上一次会话做到哪里、下一步要做什么

□ 步骤 5 — 根据任务定位文档：
  → 🆕 第一次接触？→ 先读 00-总览.md 和 01-核心原则与信任模型.md
  → 🔧 要做开发？→ 读 09-技术架构.md + 24-系统架构与数据逻辑.md
  → 🎨 要改UI？→ 读 21-蓝白企业级UI设计系统.md + 27-设计系统实施记录.md
  → 📄 要改页面？→ 读对应页面设计文档
  → 📋 要更新进度？→ 直接改 28-项目升级跟踪表.md

□ 步骤 6 — 写执行计划：向用户输出本次的执行计划
  → "本次计划做：① X ② Y ③ Z，预计影响文件：A.tsx, B.tsx"
  → 等待用户确认后再开始执行
```

### 3.2 每次修改后 — VERIFY 阶段（不验证 = 没完成）
```markdown
□ 步骤 1 — npm run typecheck（零错误必须通过）
□ 步骤 2 — 检查修改是否符合计划（有没有跑偏）
□ 步骤 3 — 如果改了 UI，用 Read 确认文件内容无误
□ 步骤 4 — 更新 28-项目升级跟踪表.md 的变更日志
```

### 3.3 每次会话结束时 — LOG 阶段（不记录 = 没发生过）
```markdown
□ 步骤 1 — 更新 SESSION_SUMMARY.md
  → 写入：已完成的工作、当前状态、下一步计划、已知问题

□ 步骤 2 — 更新 28-项目升级跟踪表.md
  → 更新对应任务状态、追加变更日志

□ 步骤 3 — 运行验证：
  → npm run typecheck（TypeScript 零错误）
  → npm run build（Webpack 构建通过）

□ 步骤 4 — 输出完成摘要：
  → "✅ 本次完成：X、Y、Z。当前进度：XX%。下一步建议：A"
```

### 3.4 计划偏离检测
```markdown
如果发现以下情况，立即停止并报告：
  ❌ 修改的内容与跟踪表上的任务不匹配
  ❌ 正在做的功能不在当前 Phase 的计划中
  ❌ 跳过了 typecheck 验证
  ❌ 一次改了 5 个以上文件
  ❌ 没有先读文件就做了修改

处理方法：STOP → 重新读取跟踪表 → 确认正确任务 → 重新开始
```

### 3.5 当检测到上下文压缩时
```markdown
如果发现以下情况，立即停止并执行"全状态同步"：
  - 数据对不上（如某个文件的内容和实际不一致）
  - 之前的修改消失了
  - 关键决策点记不清了

全状态同步步骤：
  1. 重新读取 SESSION_SUMMARY.md
  2. 重新读取 28-项目升级跟踪表.md
  3. 重新读取关键文件的最新版本（使用 Read 工具）
  4. 如果仍然不一致，输出"上下文可能已损坏，请重新加载"
```

## 四、代码规范
- 字段查找使用 `findField` 函数模糊匹配，不硬编码中文字段名
- CSS 颜色使用 `var(--pdd-xxx)` 格式，不直接写十六进制
- 数值默认值使用 `??` 操作符（`value ?? 30`），禁止用 `||`（`0` 是合法值）
- 成本/利润/GMV 等核心指标计算前，先搜索是否已有同样公式
- 任何 filter 跳过数据时，必须计数并告知用户
- 局部更新配置时，先读取已有值再合并，防止覆盖用户设置
- 每次修改后运行 `npm run typecheck && npm run build`

## 五、文件引用规则
> 以下文件只在实际需要时才读取（节省上下文空间）

- **项目进度**: `docs/项目计划/28-项目升级跟踪表.md`
- **UI 架构**: `frontend/meoo-react/AI-UI-ARCHITECTURE.md`
- **颜色令牌**: `frontend/meoo-react/src/ui/tokens/colors.ts`
- **组件库**: `frontend/meoo-react/src/components/ui/index.ts`
- **路由映射**: `AGENTS.md`（同一目录下的路由表）
- **会话摘要**: `SESSION_SUMMARY.md`
- **所有项目计划文档**: `docs/项目计划/` 目录下

