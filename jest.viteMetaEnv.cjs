// Babel plugin for Jest only: rewrites Vite's `import.meta` to `{ env: process.env }` so modules that read
// import.meta.env load under babel-jest (tests set process.env instead). new.target is left alone.
// A file, not an inline function: Jest serialises transform options to its workers, and a function is lost.
module.exports = ({ types: t }) => ({
  visitor: {
    MetaProperty(path) {
      if (path.node.meta.name !== 'import') return;
      path.replaceWith(t.objectExpression([t.objectProperty(t.identifier('env'), t.memberExpression(t.identifier('process'), t.identifier('env')))]));
    },
  },
});
