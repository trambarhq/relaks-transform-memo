'use strict';

function _toArray(arr) {
  return _arrayWithHoles(arr) || _iterableToArray(arr) || _nonIterableRest();
}

function _toConsumableArray(arr) {
  return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread();
}

function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  }
}

function _arrayWithHoles(arr) {
  if (Array.isArray(arr)) return arr;
}

function _iterableToArray(iter) {
  if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter);
}

function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance");
}

function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance");
}

var index = (function (babel) {
  var t = babel.types;

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
      memoized: false,
      react: 'React',
      relaks: 'Relaks',
      importSpecifiers: null,
      defaultSpecifier: null,
      defaultExport: 0
    };
    var visitor = {
      ImportDeclaration: visitImportDeclaration,
      FunctionDeclaration: visitFunctionDeclaration,
      ExportDefaultDeclaration: visitExportDefaultDeclaration,
      CallExpression: visitorCallExpressionArrowFunction
    };
    path.traverse(visitor, state);

    if (state.memoized && !state.defaultSpecifier) {
      // Need default import from Relaks
      var relaks = t.identifier(state.relaks);
      var def = t.importDefaultSpecifier(relaks);
      state.importSpecifiers.unshift(def);
    }
  }

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
            }

            break;
          }
        } else if (type === 'ImportDefaultSpecifier') {
          if (source.type === 'StringLiteral' && source.value === 'react') {
            state.react = local.name;
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

  function visitFunctionDeclaration(path, state) {
    if (!state.hook) {
      // hook wasn't imported
      return;
    }

    if (path.parent.type === 'ExportDefaultDeclaration') {
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
      state.memoized = true;
    }
  }

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
        state.memoized = true;
      }
    }
  }

  function visitorCallExpressionArrowFunction(path, state) {
    var _path$node2 = path.node,
        callee = _path$node2.callee,
        args = _path$node2.arguments;

    if (args[0] && args[0].type === 'ArrowFunctionExpression') {
      var _args = _toArray(args),
          arrowFunc = _args[0],
          otherArgs = _args.slice(1);

      var qname = getFullyQualifiedName(callee);

      if (qname && state.hocs.indexOf(qname) !== -1) {
        if (path.parent.type === 'VariableDeclarator') {
          var id = t.identifier(path.parent.id.name);
          var func = nameArrowFunction(id, arrowFunc);
          var call = t.callExpression(callee, [func].concat(_toConsumableArray(otherArgs)));
          path.replaceWith(call);
        }
      }
    }
  }

  function visitCallExpressionHook(path, state) {
    var callee = path.node.callee;

    if (callee.type === 'Identifier' && callee.name === state.hook) {
      state.hookCalled = true;
      path.stop();
    }
  }

  function isUsingHook(path, state) {
    var visitor = {
      CallExpression: visitCallExpressionHook
    };
    state.hookCalled = false;
    path.traverse(visitor, state);
    return state.hookCalled;
  }

  function memoizeFunction(func, state) {
    var id = func.id,
        params = func.params,
        body = func.body;
    var relaks = t.identifier(state.relaks);
    var memo = t.identifier('memo');
    var callee = t.memberExpression(relaks, memo);
    var expr = t.functionExpression(id, params, body, false, true);
    return t.callExpression(callee, [expr]);
  }

  function nameArrowFunction(id, arrowFunc, state) {
    var params = arrowFunc.params,
        body = arrowFunc.body,
        generator = arrowFunc.generator,
        async = arrowFunc.async;
    return t.functionExpression(id, params, body, generator, async);
  }

  function declareConstant(id, init, state) {
    var varDecl = t.variableDeclarator(id, init);
    return t.variableDeclaration('const', [varDecl]);
  }

  function generateDefaultId(state) {
    var name = '__defMemoized' + state.defaultExport++;
    return t.identifier(name);
  }

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
