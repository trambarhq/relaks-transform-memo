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
  var useProgressVisitor = {
    CallExpression: function CallExpression(path, state) {
      var callee = path.node.callee;

      if (callee.type === 'Identifier' && callee.name === state.hook) {
        state.hookCalled = true;
        path.stop();
      }
    }
  };
  var memoizationVisitor = {
    ImportDeclaration: function ImportDeclaration(path, state) {
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
    },
    FunctionDeclaration: function FunctionDeclaration(path, state) {
      if (!state.hook) {
        // hook wasn't imported
        return;
      }

      if (path.parent.type === 'ExportDefaultDeclaration') {
        return;
      }

      var _path$node2 = path.node,
          id = _path$node2.id,
          params = _path$node2.params,
          body = _path$node2.body,
          async = _path$node2.async;

      if (async) {
        state.hookCalled = false;
        path.traverse(useProgressVisitor, state);

        if (state.hookCalled) {
          // if the useProgress hook is called then it's a Relaks component
          // need to call Relaks.memo() to turn it into a React component
          var relaks = t.identifier(state.relaks);
          var memo = t.identifier('memo');
          var callee = t.memberExpression(relaks, memo);
          var funcExpr = t.functionExpression(id, params, body, false, true);
          var call = t.callExpression(callee, [funcExpr]);
          var varDecl = t.variableDeclarator(id, call);
          var memoized = t.variableDeclaration('const', [varDecl]);
          path.replaceWith(memoized);
          state.memoized = true;
        }
      }
    },
    ExportDefaultDeclaration: function ExportDefaultDeclaration(path, state) {
      if (!state.hook) {
        return;
      }

      var _path$node$declaratio = path.node.declaration,
          type = _path$node$declaratio.type,
          id = _path$node$declaratio.id,
          params = _path$node$declaratio.params,
          body = _path$node$declaratio.body,
          async = _path$node$declaratio.async;

      if (type === 'FunctionDeclaration' && async) {
        state.hookCalled = false;
        path.traverse(useProgressVisitor, state);

        if (state.hookCalled) {
          var cid = id || t.identifier('__defMemoized' + state.defaultExport++);
          var relaks = t.identifier(state.relaks);
          var memo = t.identifier('memo');
          var callee = t.memberExpression(relaks, memo);
          var funcExpr = t.functionExpression(id, params, body, false, true);
          var call = t.callExpression(callee, [funcExpr]);
          var varDecl = t.variableDeclarator(cid, call);
          var memoized = t.variableDeclaration('const', [varDecl]);
          var exportDefault = t.exportDefaultDeclaration(cid);
          path.replaceWithMultiple([memoized, exportDefault]);
          state.memoized = true;
        }
      }
    },
    CallExpression: function CallExpression(path, state) {
      var _path$node3 = path.node,
          callee = _path$node3.callee,
          args = _path$node3.arguments;

      if (callee.type === 'MemberExpression') {
        if (args[0] && args[0].type === 'ArrowFunctionExpression') {
          var _args = _toArray(args),
              arrowFunc = _args[0],
              otherArgs = _args.slice(1);

          var object = callee.object,
              property = callee.property;

          if (object.type === 'Identifier' && property.type === 'Identifier') {
            var methods;

            if (object.name === state.react) {
              methods = ['memo', 'forwardRef'];
            } else if (object.name === state.relaks) {
              methods = ['memo', 'use'];
            }

            if (methods && methods.indexOf(property.name) !== -1) {
              if (path.parent.type === 'VariableDeclarator') {
                var params = arrowFunc.params,
                    body = arrowFunc.body,
                    generator = arrowFunc.generator,
                    async = arrowFunc.async;
                var id = t.identifier(path.parent.id.name);
                var func = t.functionExpression(id, params, body, generator, async);
                var call = t.callExpression(callee, [func].concat(_toConsumableArray(otherArgs)));
                path.replaceWith(call);
              }
            }
          }
        }
      }
    }
  };
  var programVisitor = {
    Program: function Program(path) {
      var state = {
        hook: null,
        hookCalled: false,
        memoized: false,
        react: 'React',
        relaks: 'Relaks',
        importSpecifiers: null,
        defaultSpecifier: null,
        defaultExport: 0
      };
      path.traverse(memoizationVisitor, state);

      if (state.memoized && !state.defaultSpecifier) {
        // Need default import from Relaks
        var relaks = t.identifier(state.relaks);
        var def = t.importDefaultSpecifier(relaks);
        state.importSpecifiers.unshift(def);
      }
    }
  };
  return {
    visitor: programVisitor
  };
});

module.exports = index;
