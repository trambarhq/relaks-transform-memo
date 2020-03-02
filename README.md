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
