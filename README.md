Relaks-transform-memo
=====================
This [Babel](https://babeljs.io/) plugin simplifies development of [Relaks](https://github.com/trambarhq/relaks) application by automatically memoizing asynchronous components.

Before:
```javascript
import { useProgress } from 'relaks';

export async function Widget(props) {
  const [ show ] = useProgress();

  /*...*/
}
```

After:
```javascript
import Relaks, { useProgress } from 'relaks';

export const Widget = Relaks.memo(async function Widget(props) {
  const [ show ] = useProgress();

  /*...*/
});
```

Usage
-----
This plugin is bundled with Relaks. There is no need to install it separately. In your Babel config, simply add it to the list of plugins:

```javascript
          plugins: [
            '@babel/transform-runtime',
            '@babel/proposal-nullish-coalescing-operator',
            '@babel/proposal-optional-chaining',
            /* ... */
            'relaks/transform-memo',
          ]
```

Anonymous function
------------------

This plugin will also add names to components created through calls to `Relaks.memo()`, `Relaks.use()`, `React.memo()`, and `React.forwardRef()`.

Before:
```javascript
import Relaks from 'relaks';

const Widget = React.forwardRef((props, ref) => {
  return <div ref={ref} />;
});
```

After:
```javascript
import Relaks from 'relaks';

const Widget = React.forwardRef(function Widget(props, ref) {
  return <div ref={ref} />;
});
```
