const { analyzeCode } = require('./analyze');
const fs = require('fs');

function generateReviewReport(filePath, analysis) {
  const lines = [
    '# 代码审查报告',
    '',
    `**文件**: ${filePath}`,
    `**审查时间**: ${new Date().toLocaleString()}`,
    '',
    '## 概览',
    '',
    `- 函数数量: ${analysis.functions.length}`,
    `- 类数量: ${analysis.classes.length}`,
    `- 导入数量: ${analysis.imports.length}`,
    `- 导出数量: ${analysis.exports.length}`,
    `- 复杂度评分: ${analysis.complexity}`,
    '',
    '## 详细分析',
    ''
  ];

  if (analysis.functions.length > 0) {
    lines.push('### 函数列表');
    lines.push('');
    analysis.functions.forEach(fn => {
      lines.push(`- **${fn.name}** (第 ${fn.loc.start.line} 行)`);
    });
    lines.push('');
  }

  if (analysis.classes.length > 0) {
    lines.push('### 类列表');
    lines.push('');
    analysis.classes.forEach(cls => {
      lines.push(`- **${cls.name}** (第 ${cls.loc.start.line} 行)`);
    });
    lines.push('');
  }

  if (analysis.imports.length > 0) {
    lines.push('### 依赖导入');
    lines.push('');
    analysis.imports.forEach(imp => {
      lines.push(`- \`${imp.source}\`: ${imp.specifiers.join(', ')}`);
    });
    lines.push('');
  }

  lines.push('## 建议');
  lines.push('');
  
  if (analysis.complexity > 10) {
    lines.push('⚠️ **复杂度较高**: 建议拆分复杂函数，提高可维护性');
  } else {
    lines.push('✅ **复杂度正常**: 代码结构良好');
  }

  return lines.join('\n');
}

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node review.js <file-path>');
    process.exit(1);
  }

  const code = fs.readFileSync(filePath, 'utf-8');
  const analysis = analyzeCode(code);
  const report = generateReviewReport(filePath, analysis);
  console.log(report);
}

module.exports = { generateReviewReport };
