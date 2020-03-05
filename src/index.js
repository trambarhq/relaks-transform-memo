export default (babel) => {
  const { types: t } = babel;

  function visitProgram(path, plugin) {
    let {
      hocs = [
        'Relaks.use',
        'Relaks.memo',
        'React.memo',
        'React.forwardRef'
      ],
      otherHOCs,
    } = plugin.opts;
    if (otherHOCs) {
      hocs = [ ...hocs, ...otherHOCs ];
    }

    const state = {
      hocs,
      hook: null,
      hookCalled: false,
      memoized: false,
      react: 'React',
      relaks: 'Relaks',
      importSpecifiers: null,
      defaultSpecifier: null,
      defaultExport: 0,
    };
    const visitor = {
      ImportDeclaration: visitImportDeclaration,
      FunctionDeclaration: visitFunctionDeclaration,
      ExportDefaultDeclaration: visitExportDefaultDeclaration,
      CallExpression: visitorCallExpressionArrowFunction,
    };
    path.traverse(visitor, state);
    if (state.memoized && !state.defaultSpecifier) {
      // Need default import from Relaks
      const relaks = t.identifier(state.relaks);
      const def = t.importDefaultSpecifier(relaks);
      state.importSpecifiers.unshift(def);
    }
  }

  function visitImportDeclaration(path, state) {
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
  }

  function visitFunctionDeclaration(path, state) {
    if (!state.hook) {
      // hook wasn't imported
      return;
    }
    if (path.parent.type === 'ExportDefaultDeclaration') {
      return;
    }
    const func = path.node;
    if (func.async && isUsingHook(path, state)) {
      // if the useProgress hook is called then it's a Relaks component
      // need to call Relaks.memo() to turn it into a React component
      const call = memoizeFunction(func, state);
      const cid = func.id;
      const constDecl = declareConstant(cid, call, state);
      path.replaceWith(constDecl);
      state.memoized = true;
    }
  }

  function visitExportDefaultDeclaration(path, state) {
    if (!state.hook) {
      return;
    }
    const func = path.node.declaration;
    if (func.type === 'FunctionDeclaration') {
      if (func.async && isUsingHook(path, state))  {
        const call = memoizeFunction(func, state);
        const cid = func.id || generateDefaultId(state);
        const constDecl = declareConstant(cid, call, state);
        const exportDefault = t.exportDefaultDeclaration(cid);
        path.replaceWithMultiple([ constDecl, exportDefault ]);
        state.memoized = true;
      }
    }
  }

  function visitorCallExpressionArrowFunction(path, state) {
    const { callee, arguments: args } = path.node;
    if (args[0] && args[0].type === 'ArrowFunctionExpression') {
      const [ arrowFunc, ...otherArgs ] = args;
      const qname = getFullyQualifiedName(callee);
      if (qname && state.hocs.indexOf(qname) !== -1) {
        if (path.parent.type === 'VariableDeclarator') {
          const id = t.identifier(path.parent.id.name);
          const func = nameArrowFunction(id, arrowFunc, state);
          const call = t.callExpression(callee, [ func, ...otherArgs ]);
          path.replaceWith(call);
        }
      }
    }
  }

  function visitCallExpressionHook(path, state) {
    const { callee } = path.node;
    if (callee.type === 'Identifier' && callee.name === state.hook)  {
      state.hookCalled = true;
      path.stop();
    }
  }

  function isUsingHook(path, state) {
    const visitor = { CallExpression: visitCallExpressionHook };
    state.hookCalled = false;
    path.traverse(visitor, state);
    return state.hookCalled;
  }

  function memoizeFunction(func, state) {
    const { id, params, body } = func;
    const relaks = t.identifier(state.relaks);
    const memo = t.identifier('memo');
    const callee = t.memberExpression(relaks, memo);
    const expr = t.functionExpression(id, params, body, false, true);
    return t.callExpression(callee, [ expr ]);
  }

  function nameArrowFunction(id, arrowFunc, state) {
    const { params, body, generator, async } = arrowFunc;
    return t.functionExpression(id, params, body, generator, async);
  }

  function declareConstant(id, init, state) {
    const varDecl = t.variableDeclarator(id, init);
    return t.variableDeclaration('const', [ varDecl ]);
  }

  function generateDefaultId(state) {
    const name = '__defMemoized' + state.defaultExport++;
    return t.identifier(name);
  }

  function getFullyQualifiedName(callee) {
    const names = [];
    let expr = callee;
    while (expr) {
      if (expr.type === 'Identifier') {
        names.push(expr.name);
        return names.join('.');
      } else if (expr.type === 'MemberExpression' && expr.object.type === 'Identifier') {
        names.push(expr.object.name);
        expr = expr.property;
      } else {
        break;
      }
    }
  }

  return {
    visitor: {
      Program: visitProgram
    }
  };
};
