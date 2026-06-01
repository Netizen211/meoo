---
name: meoo-xlsx
description: 使用此技能处理 Excel/电子表格的所有操作。包括：读取、编辑、修复 .xlsx, .xlsm, .csv, .tsv 文件；执行数据清洗、计算公式、设定排版。触发场景：提及 'spreadsheet'、'xlsx' 或要求处理表格数据。本技能已针对 meoo 沙箱环境优化，支持中文字体。
---

# meoo-xlsx: 电子表格与数据专家

## ⚠️ 核心执行原则

1. **环境适配**：
    - **已预装 (Python)**：`pandas`, `openpyxl`。
    - **需按需安装**：LibreOffice (用于 `recalc.py` 公式自动计算)。
2. **禁止直接读取**：绝对禁止通过 `read` 或 `view_file` 工具直接读取此类二进制文件，这会导致乱码且无法获取有效信息。你**必须**使用本技能推荐的库编写脚本来解析内容。
3. **脚本执行**：你**必须**先将脚本写入 `home/project/tmp/` 目录，然后运行。禁止使用 bash inline python。
4. **中文支持**：沙箱已安装 `fonts-wqy-microhei`。在使用 `openpyxl` 生成文件时，应显式设置中文字体为 `WenQuanYi Micro Hei`。
5. **公式计算**：`openpyxl` 保存后，公式通常不会自动计算。若需要计算结果，请务必执行内置的 `recalc.py`（**注：需先通过 apt 安装 LibreOffice**）。

---

## 📦 环境依赖安装指南

如果需要执行公式重算或复杂格式转换，请先确保安装了后台引擎：

```bash
apt-get update && apt-get install -y libreoffice
```

---

## 财务建模标准 (Financial Standards)

为了保证交付成果的行业级别专业度，必须遵循以下格式规范：

### 1. 颜色编码 (Color Coding)
- **蓝色文本 (Blue)**: 硬编码的输入值、假设值。
- **黑色文本 (Black)**: 所有的公式、计算结果。
- **绿色文本 (Green)**: 引用自同一工作簿内其他页签的链接。
- **黄色背景 (Yellow)**: 需要用户关注或待填写的关键单元格。

### 2. 数字格式 (Number Formatting)
- **金额**: 使用 `$#,##0` 格式。
- **零值**: 为保持页面整洁，零值应显示为横杠 `-`（格式代码：`$#,##0;($#,##0);-`）。
- **百分比**: 默认为 `0.0%`（保留一位小数）。
- **负数**: 必须使用括号包裹，如 `(123)`，而非使用负号 `-123`。

---

## 公式自检清单 (Verification Checklist)

在保存文件前，请通过代码检测或脚本结果确认：
- [ ] 是否存在 `#REF!`, `#DIV/0!`, `#VALUE!` 等错误？
- [ ] 所有的硬编码输入（Inputs）是否都是蓝色文本？
- [ ] 所有的计算逻辑（Calculations）是否都是黑色文本？
- [ ] 引用位置是否正确（防止 Off-by-one 错误，Excel 行号是从 1 开始的）？
- [ ] 针对所有硬编码值，是否在单元格批注中注明了“Source”来源？

---

## 🎨 报表美学与专业美化指导 (Professional Polish)

专业报表的关键在于“减少视觉噪音”：

### 1. 灰度法则 (The Power of Gray)
- **限制调色板**：主色调不超过 3-4 种。
- **大量使用灰色**：除关键指标（KPI）外的边框、轴线、非重要背景，统一使用深浅不一的灰色。这能让彩色高亮部分真正发挥导向作用。

### 2. 仪表盘排版原则
- **一屏原则**：核心看板内容应设计在“一屏”高度内，避免用户反复滚动查找。
- **极简图表**：去除所有不必要的图表特效（如阴影、发光）。优先使用折线图、条形图以及 Sparklines（单元格内微型图表）。

### 3. 清晰的数据流
- **输入/计算/输出分离**：将原始数据（Raw Data）、计算模型和最终产出结果分布在不同的 Sheet 中，并用颜色标签区分页签。
- **对齐**：数字统一右对齐，表头文字统一左对齐或居中，确保视觉扫描路径清晰。

---

## 中文支持配置 (Python - openpyxl)

```python
from openpyxl.styles import Font

# 设置单元格字体为文泉驿
chinese_font = Font(name='WenQuanYi Micro Hei', size=11)
cell.font = chinese_font
```

---

## 常用工作流

### 1. 数据分析与批量转换
优先使用 `pandas` 进行高效的数据读取和计算：
```python
import pandas as pd
df = pd.read_excel('file.xlsx')
# 执行清洗逻辑
df.to_excel('output.xlsx', index=False)
```

### 2. 精化排版与公式设置
使用 `openpyxl` 建立复杂的财务或数据模型。将脚本写入 `home/project/tmp/` 运行。

### 3. 强制公式重算 (重要)
如果你的电子表格包含复杂的交叉引用或需要立即获得计算结果（例如供后续 Python 读取），请运行：
```bash
python3 scripts/recalc.py output.xlsx
```
该脚本会自动调用沙箱中的 LibreOffice 环境进行强制重算，并返回包含错误检查（#REF!, #DIV/0!）的 JSON 结果。

---

## 捆绑资源说明
- `scripts/recalc.py`: 核心工具，利用沙箱中的 LibreOffice 引擎强制刷新 Excel 所有公式并验证其正确性。
- `scripts/office/soffice.py`: 底层 shim，确保 LibreOffice 在受限的沙箱环境中能绕过 UNIX 套接字限制正常运行。
