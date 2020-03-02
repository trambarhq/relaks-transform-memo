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
      const { specifiers } = path.node;
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
        }
      }
    },
    FunctionDeclaration(path, state) {
      if (!state.hook) {
        // hook wasn't imported
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
    }
  };
  const programVisitor = {
    Program(path) {
      const state = {
        hook: null,
        hookCalled: false,
        memoized: false,
        relaks: 'Relaks',
        importSpecifiers: null,
        defaultSpecifier: null,
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
