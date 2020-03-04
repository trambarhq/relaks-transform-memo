export default (babel) => {
  const { types: t } = babel;
  const useProgressVisitor = {
    CallExpression(path, state) {
      const { callee } = path.node;
      if (callee.type === 'Identifier' && callee.name === state.hook)  {
        state.hookCalled = true;
        path.stop();
      }
    }
  };
  const memoizationVisitor = {
    ImportDeclaration(path, state) {
      const { specifiers, source } = path.node;
      for (let specifier of specifiers) {
        const { type, imported, local } = specifier;
        if (type === 'ImportSpecifier') {
          // hook for the declaration importing useProgress()
          if (imported.type === 'Identifier' && imported.name === 'useProgress') {
            state.hook = local.name;
            state.importSpecifiers = specifiers;

            // look for default import
            const def = specifiers.find(s => s.type === 'ImportDefaultSpecifier');
            if (def) {
              state.relaks = def.local.name;
              state.defaultSpecifier = def;
            }
            break;
          }
        } else if (type === 'ImportDefaultSpecifier') {
          if (source.type === 'StringLiteral' && source.value === 'react') {
            state.react = local.name;
          }
        }
      }
    },
    FunctionDeclaration(path, state) {
      if (!state.hook) {
        // hook wasn't imported
        return;
      }
      if (path.parent.type === 'ExportDefaultDeclaration') {
        return;
      }
      const { id, params, body, async } = path.node;
      if (async) {
        state.hookCalled = false;
        path.traverse(useProgressVisitor, state);
        if (state.hookCalled) {
          // if the useProgress hook is called then it's a Relaks component
          // need to call Relaks.memo() to turn it into a React component
          const relaks = t.identifier(state.relaks);
          const memo = t.identifier('memo');
          const callee = t.memberExpression(relaks, memo);
          const funcExpr = t.functionExpression(id, params, body, false, true);
          const call = t.callExpression(callee, [ funcExpr ]);
          const varDecl = t.variableDeclarator(id, call);
          const memoized = t.variableDeclaration('const', [ varDecl ]);
          path.replaceWith(memoized);
          state.memoized = true;
        }
      }
    },
    ExportDefaultDeclaration(path, state) {
      if (!state.hook) {
        return;
      }
      const { type, id, params, body, async } = path.node.declaration;
      if (type === 'FunctionDeclaration' && async) {
        state.hookCalled = false;
        path.traverse(useProgressVisitor, state);
        if (state.hookCalled) {
          const cid = id || t.identifier('__defMemoized' + state.defaultExport++);
          const relaks = t.identifier(state.relaks);
          const memo = t.identifier('memo');
          const callee = t.memberExpression(relaks, memo);
          const funcExpr = t.functionExpression(id, params, body, false, true);
          const call = t.callExpression(callee, [ funcExpr ]);
          const varDecl = t.variableDeclarator(cid, call);
          const memoized = t.variableDeclaration('const', [ varDecl ]);
          const exportDefault = t.exportDefaultDeclaration(cid);
          path.replaceWithMultiple([ memoized, exportDefault ]);
          state.memoized = true;
        }
      }
    },
    CallExpression(path, state) {
      const { callee, arguments: args } = path.node;
      if (callee.type === 'MemberExpression') {
        if (args[0] && args[0].type === 'ArrowFunctionExpression') {
          const [ arrowFunc, ...otherArgs ] = args;
          const { object, property } = callee;
          if (object.type === 'Identifier' && property.type === 'Identifier') {
            let methods;
            if (object.name === state.react) {
              methods = [ 'memo', 'forwardRef' ];
            } else if (object.name === state.relaks) {
              methods = [ 'memo', 'use' ];
            }
            if (methods && methods.indexOf(property.name) !== -1) {
              if (path.parent.type === 'VariableDeclarator') {
                const { params, body, generator, async } = arrowFunc;
                const id = t.identifier(path.parent.id.name);
                const func = t.functionExpression(id, params, body, generator, async);
                const call = t.callExpression(callee, [ func, ...otherArgs ]);
                path.replaceWith(call);
              }
            }
          }
        }
      }
    }
  };
  const programVisitor = {
    Program(path) {
      const state = {
        hook: null,
        hookCalled: false,
        memoized: false,
        react: 'React',
        relaks: 'Relaks',
        importSpecifiers: null,
        defaultSpecifier: null,
        defaultExport: 0,
      };
      path.traverse(memoizationVisitor, state);
      if (state.memoized && !state.defaultSpecifier) {
        // Need default import from Relaks
        const relaks = t.identifier(state.relaks);
        const def = t.importDefaultSpecifier(relaks);
        state.importSpecifiers.unshift(def);
      }
    }
  };
  return { visitor: programVisitor };
};
