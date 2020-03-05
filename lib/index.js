'use strict';

function _toConsumableArray(arr) {
  return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread();
}

function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  }
}

function _iterableToArray(iter) {
  if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter);
}

function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance");
}

var index = (function (babel) {
  var t = babel.types;
  /**
   * Initiate state nad start transforming program in question
   *
   * @param  {NodePath} path
   * @param  {Object} state
   */

  function visitProgram(path, plugin) {
    var _plugin$opts = plugin.opts,
        _plugin$opts$hocs = _plugin$opts.hocs,
        hocs = _plugin$opts$hocs === void 0 ? ['Relaks.use', 'Relaks.memo', 'React.memo', 'React.forwardRef'] : _plugin$opts$hocs,
        otherHOCs = _plugin$opts.otherHOCs;

    if (otherHOCs) {
      hocs = [].concat(_toConsumableArray(hocs), _toConsumableArray(otherHOCs));
    }

    var state = {
      hocs: hocs,
      hook: null,
      hookCalled: false,
      memoizedFunctions: [],
      react: 'React',
      relaks: 'Relaks',
      importSpecifiers: null,
      defaultSpecifier: null,
      defaultExport: 0,
      lhsVarId: null
    };
    var visitor = {
      ImportDeclaration: visitImportDeclaration,
      FunctionDeclaration: visitFunctionDeclaration,
      ExportDefaultDeclaration: visitExportDefaultDeclaration,
      VariableDeclarator: visitVariableDeclarator,
      CallExpression: visitCallExpressionMemoized,
      FunctionExpression: visitFunctionExpression,
      ArrowFunctionExpression: visitFunctionExpression
    };
    path.traverse(visitor, state);

    if (state.memoizedFunctions.length > 0 && !state.defaultSpecifier) {
      // Need default import from Relaks
      var relaks = t.identifier(state.relaks);
      var def = t.importDefaultSpecifier(relaks);
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
    var _path$node = path.node,
        specifiers = _path$node.specifiers,
        source = _path$node.source;
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = specifiers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var specifier = _step.value;
        var type = specifier.type,
            imported = specifier.imported,
            local = specifier.local;

        if (type === 'ImportSpecifier') {
          // hook for the declaration importing useProgress()
          if (imported.type === 'Identifier' && imported.name === 'useProgress') {
            state.hook = local.name;
            state.importSpecifiers = specifiers; // look for default import

            var def = specifiers.find(function (s) {
              return s.type === 'ImportDefaultSpecifier';
            });

            if (def) {
              state.relaks = def.local.name;
              state.defaultSpecifier = def;

              if (state.relaks !== 'Relaks') {
                state.hocs = state.hocs.map(function (qname) {
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
              state.hocs = state.hocs.map(function (qname) {
                return qname.replace(/^React\./, state.react + '.');
              });
            }
          }
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator["return"] != null) {
          _iterator["return"]();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
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

    var func = path.node;

    if (func.async && isUsingHook(path, state)) {
      // if the useProgress hook is called then it's a Relaks component
      // need to call Relaks.memo() to turn it into a React component
      var call = memoizeFunction(func, state);
      var cid = func.id;
      var constDecl = declareConstant(cid, call);
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

    var func = path.node.declaration;

    if (func.type === 'FunctionDeclaration') {
      if (func.async && isUsingHook(path, state)) {
        var call = memoizeFunction(func, state);
        var cid = func.id || generateDefaultId(state);
        var constDecl = declareConstant(cid, call);
        var exportDefault = t.exportDefaultDeclaration(cid);
        path.replaceWithMultiple([constDecl, exportDefault]);
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
    var _path$node2 = path.node,
        callee = _path$node2.callee,
        args = _path$node2.arguments;

    if (callee.type === 'MemberExpression' && args.length > 0) {
      var object = callee.object,
          property = callee.property;

      if (object.type === 'Identifier' && property.type === 'Identifier') {
        if (object.name === state.relaks) {
          if (property.name === 'memo' || property.name === 'use') {
            var func = args[0];

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
    var func = path.node;

    if (state.memoizedFunctions.indexOf(func) !== -1) {
      return;
    }

    if (func.async && isUsingHook(path, state)) {
      var call = memoizeFunction(func, state);
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
    var visitor = {
      ArrowFunctionExpression: visitArrowFunctionExpressionHOC,
      FunctionExpression: visitFunctionExpressionHOC
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

    var func = path.node;

    if (state.memoizedFunctions.indexOf(func) !== -1) {
      return;
    }

    if (path.parent.type === 'CallExpression') {
      var qname = getFullyQualifiedName(path.parent.callee);

      if (qname && state.hocs.indexOf(qname) !== -1) {
        var id = state.lhsVarId;
        var named = nameAnonymousFunction(id, func);
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

    var func = path.node;

    if (state.memoizedFunctions.indexOf(func) !== -1) {
      return;
    }

    if (!path.node.id && path.parent.type === 'CallExpression') {
      var qname = getFullyQualifiedName(path.parent.callee);

      if (qname && state.hocs.indexOf(qname) !== -1) {
        var id = state.lhsVarId;
        var named = nameAnonymousFunction(id, func);
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
    var callee = path.node.callee;

    if (callee.type === 'Identifier' && callee.name === state.hook) {
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
    var visitor = {
      CallExpression: visitCallExpressionHook
    };
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
    var id = func.id,
        params = func.params,
        body = func.body;
    var relaks = t.identifier(state.relaks);
    var memo = t.identifier('memo');
    var callee = t.memberExpression(relaks, memo);
    var expr = t.functionExpression(id, params, body, false, true);
    state.memoizedFunctions.push(expr);
    return t.callExpression(callee, [expr]);
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
    var params = arrowFunc.params,
        body = arrowFunc.body,
        generator = arrowFunc.generator,
        async = arrowFunc.async;
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
    var varDecl = t.variableDeclarator(id, init);
    return t.variableDeclaration('const', [varDecl]);
  }
  /**
   * Generate an id for exporting a constant
   *
   * @param  {Object} state
   *
   * @return {Node}
   */


  function generateDefaultId(state) {
    var name = '__defMemoized' + state.defaultExport++;
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
    var names = [];
    var expr = callee;

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
});

module.exports = index;
