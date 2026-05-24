const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs');

function analyzeCode(code) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  const result = {
    functions: [],
    classes: [],
    imports: [],
    exports: [],
    complexity: 0
  };

  traverse(ast, {
    FunctionDeclaration(path) {
      result.functions.push({
        name: path.node.id?.name || 'anonymous',
        loc: path.node.loc
      });
      result.complexity++;
    },
    ClassDeclaration(path) {
      result.classes.push({
        name: path.node.id.name,
        loc: path.node.loc
      });
    },
    ImportDeclaration(path) {
      result.imports.push({
        source: path.node.source.value,
        specifiers: path.node.specifiers.map(s => s.local.name)
      });
    },
    ExportNamedDeclaration(path) {
      result.exports.push({
        type: 'named',
        name: path.node.declaration?.id?.name
      });
    }
  });

  return result;
}

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node analyze.js <file-path>');
    process.exit(1);
  }

  const code = fs.readFileSync(filePath, 'utf-8');
  const analysis = analyzeCode(code);
  console.log(JSON.stringify(analysis, null, 2));
}

module.exports = { analyzeCode };
