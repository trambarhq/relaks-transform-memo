export default (babel) => {
  const { types: t } = babel;

  /**
   * Initiate state nad start transforming program in question
   *
   * @param  {NodePath} path
   * @param  {Object} state
   */
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
      memoizedFunctions: [],
      react: 'React',
      relaks: 'Relaks',
      importSpecifiers: null,
      defaultSpecifier: null,
      defaultExport: 0,
      lhsVarId: null,
    };
    const visitor = {
      ImportDeclaration: visitImportDeclaration,
      FunctionDeclaration: visitFunctionDeclaration,
      ExportDefaultDeclaration: visitExportDefaultDeclaration,
      VariableDeclarator: visitVariableDeclarator,
      CallExpression: visitCallExpressionMemoized,
      FunctionExpression: visitFunctionExpression,
      ArrowFunctionExpression: visitFunctionExpression,
    };
    path.traverse(visitor, state);
    if (state.memoizedFunctions.length > 0 && !state.defaultSpecifier) {
      // Need default import from Relaks
      const relaks = t.identifier(state.relaks);
      const def = t.importDefaultSpecifier(relaks);
      state.importSpecifiers.unshift(def);
    }
  }

  /**
   * Look for Relaks and React import
   *
   * @param  {NodePath} path
   * @param  {Object} state
   */
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
            if (state.relaks !== 'Relaks') {
              state.hocs = state.hocs.map((qname) => {
                return qname.replace(/^Relaks\./, state.relaks + '.');
              });
            }
          }
          break;
        }
      } else if (type === 'ImportDefaultSpecifier') {
        if (source.type === 'StringLiteral' && source.value === 'react') {
          state.react = local.name;
          if (state.react !== 'React') {
            state.hocs = state.hocs.map((qname) => {
              return qname.replace(/^React\./, state.react + '.');
            });
          }
        }
      }
    }
  }

  /**
   * Look for function declarations and memoize those that use the Relaks hook
   *
   * @param  {NodePath} path
   * @param  {Object} state
   */
  function visitFunctionDeclaration(path, state) {
    if (!state.hook) {
      // hook wasn't imported
      return;
    }
    if (path.parent.type === 'ExportDefaultDeclaration') {
      // default export need to be handled differently
      // since the following is illegal:
      //
      // export default const Component = ...
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
    }
  }

  /**
   * Look for default export of async components and memoize them
   *
   * @param  {NodePath} path
   * @param  {Object} state
   */
  function visitExportDefaultDeclaration(path, state) {
    if (!state.hook) {
      return;
    }
    const func = path.node.declaration;
    if (func.type === 'FunctionDeclaration') {
      if (func.async && isUsingHook(path, state)) {
        const call = memoizeFunction(func, state);
        const cid = func.id || generateDefaultId(state);
        const constDecl = declareConstant(cid, call, state);
        const exportDefault = t.exportDefaultDeclaration(cid);
        path.replaceWithMultiple([ constDecl, exportDefault ]);
      }
    }
  }

  /**
   * Look for explicit calls to Relaks.memo() and .use()
   *
   * @param  {NodePath} path
   * @param  {Object} state
   */
  function visitCallExpressionMemoized(path, state) {
    const { callee, arguments: args } = path.node;
    if (callee.type === 'MemberExpression' && args.length > 0) {
      const { object, property } = callee;
      if (object.type === 'Identifier' && property.type === 'Identifier') {
        if (object.name === state.relaks) {
          if (property.name === 'memo' || property.name === 'use') {
            const func = args[0];
            if (func.type === 'FunctionExpression' || func.type === 'ArrowFunctionExpression') {
              state.memoizedFunctions.push(func);
            }
          }
        }
      }
    }
  }

  /**
   * Look for anonymous async components and memoize then
   *
   * @param  {NodePath} path
   * @param  {Object} state
   */
  function visitFunctionExpression(path, state) {
    const func = path.node;
    if (state.memoizedFunctions.indexOf(func) !== -1) {
      return;
    }
    if (func.async && isUsingHook(path, state)) {
      const call = memoizeFunction(func, state);
      path.replaceWith(call);
    }
  }

  /**
   * Remembering left-hand-side variable name, initiate search for anonymous
   * functions
   *
   * @param  {NodePath} path
   * @param  {Object} state
   */
  function visitVariableDeclarator(path, state) {
    const visitor = {
      ArrowFunctionExpression: visitArrowFunctionExpressionHOC,
      FunctionExpression: visitFunctionExpressionHOC,
    };
    state.lhsVarId = path.node.id;
    path.traverse(visitor, state);
    state.lhsVarId = null;
  }

  /**
   * Add name to arrow function passed to HOC (higher order component)
   *
   * @param  {NodePath} path
   * @param  {Object} state
   */
  function visitArrowFunctionExpressionHOC(path, state) {
    if (!state.lhsVarId) {
      return;
    }
    const func = path.node;
    if (state.memoizedFunctions.indexOf(func) !== -1) {
      return;
    }
    if (path.parent.type === 'CallExpression') {
      const qname = getFullyQualifiedName(path.parent.callee);
      if (qname && state.hocs.indexOf(qname) !== -1) {
        const id = state.lhsVarId;
        const named = nameAnonymousFunction(id, func, state);
        path.replaceWith(named);
      }
    }
  }

  /**
   * Add name to anonymouso function passed to HOC (higher order component)
   *
   * @param  {NodePath} path
   * @param  {Object} state
   */
  function visitFunctionExpressionHOC(path, state) {
    if (!state.lhsVarId) {
      return;
    }
    const func = path.node;
    if (state.memoizedFunctions.indexOf(func) !== -1) {
      return;
    }
    if (!path.node.id && path.parent.type === 'CallExpression') {
      const qname = getFullyQualifiedName(path.parent.callee);
      if (qname && state.hocs.indexOf(qname) !== -1) {
        const id = state.lhsVarId;
        const named = nameAnonymousFunction(id, func, state);
        path.replaceWith(named);
      }
    }
  }

  /**
   * Look for invocation of useProgress()
   *
   * @param  {NodePath} path
   * @param  {Object} state
   */
  function visitCallExpressionHook(path, state) {
    const { callee } = path.node;
    if (callee.type === 'Identifier' && callee.name === state.hook)  {
      state.hookCalled = true;
      path.stop();
    }
  }

  /**
   * Return true if useProgress() is used by the function in question
   *
   * @param  {NodePath} path
   * @param  {Object} state
   *
   * @return {boolean}
   */
  function isUsingHook(path, state) {
    const visitor = { CallExpression: visitCallExpressionHook };
    state.hookCalled = false;
    path.traverse(visitor, state);
    return state.hookCalled;
  }

  /**
   * Wrap function with Relaks.memo()
   *
   * @param  {Node} path
   * @param  {Object} state
   *
   * @return {Node}
   */
  function memoizeFunction(func, state) {
    const { id, params, body } = func;
    const relaks = t.identifier(state.relaks);
    const memo = t.identifier('memo');
    const callee = t.memberExpression(relaks, memo);
    const expr = t.functionExpression(id, params, body, false, true);
    state.memoizedFunctions.push(expr);
    return t.callExpression(callee, [ expr ]);
  }

  /**
   * Convert an anonymous function to a named one
   *
   * @param  {Node} id
   * @param  {Node} arrowFunc
   * @param  {Object} state
   *
   * @return {Node}
   */
  function nameAnonymousFunction(id, arrowFunc, state) {
    const { params, body, generator, async } = arrowFunc;
    return t.functionExpression(id, params, body, generator, async);
  }

  /**
   * Create an constant assignment expression
   *
   * @param  {Node} id
   * @param  {Node} init
   * @param  {Object} state
   *
   * @return {Node}
   */
  function declareConstant(id, init, state) {
    const varDecl = t.variableDeclarator(id, init);
    return t.variableDeclaration('const', [ varDecl ]);
  }

  /**
   * Generate an id for exporting a constant
   *
   * @param  {Object} state
   *
   * @return {Node}
   */
  function generateDefaultId(state) {
    const name = '__defMemoized' + state.defaultExport++;
    return t.identifier(name);
  }

  /**
   * Get full qualified name of a function call
   *
   * @param  {Node} callee
   *
   * @return {string}
   */
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
