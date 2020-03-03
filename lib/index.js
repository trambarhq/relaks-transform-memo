'use strict';

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
      var specifiers = path.node.specifiers;
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

      var _path$node = path.node,
          id = _path$node.id,
          params = _path$node.params,
          body = _path$node.body,
          async = _path$node.async;

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
    }
  };
  var programVisitor = {
    Program: function Program(path) {
      var state = {
        hook: null,
        hookCalled: false,
        memoized: false,
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
