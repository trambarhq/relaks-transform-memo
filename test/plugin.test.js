const { expect } = require('chai');
const { transform, registerPlugin } = require('@babel/standalone');
const transformMemo = require('../lib/index.js') ;

registerPlugin('transform-memo', transformMemo);

function transpile(code) {
  const result = transform(code, {
    presets: [ 'react' ],
    plugins: [ 'transform-memo' ],
  });
  return result.code;
}

describe('Plugin', function() {
  it('should apply Relaks.memo() to async component', function() {
    const code = `
import Relaks, { useProgress } from 'relaks';

async function Hello(props) {
  const [ show ] = useProgress();
  show(<div>Test</div>);
}

export {
  Hello
};
    `.trim();
    const expected = `
import Relaks, { useProgress } from 'relaks';
const Hello = Relaks.memo(async function Hello(props) {
  const [show] = useProgress();
  show(React.createElement("div", null, "Test"));
});
export { Hello };
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
  it('should correctly handle inline export statement', function() {
    const code = `
import Relaks, { useProgress } from 'relaks';

export async function Hello(props) {
  const [ show ] = useProgress();
  show(<div>Test</div>);
}
    `.trim();
    const expected = `
import Relaks, { useProgress } from 'relaks';
export const Hello = Relaks.memo(async function Hello(props) {
  const [show] = useProgress();
  show(React.createElement("div", null, "Test"));
});
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
  it('should correctly handle default export', function() {
    const code = `
import Relaks, { useProgress } from 'relaks';

export default async function Hello(props) {
  const [ show ] = useProgress();
  show(<div>Test</div>);
}
    `.trim();
    const expected = `
import Relaks, { useProgress } from 'relaks';
const Hello = Relaks.memo(async function Hello(props) {
  const [show] = useProgress();
  show(React.createElement("div", null, "Test"));
});
export default Hello;
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
  it('should correctly handle default export of anonymous function', function() {
    const code = `
import Relaks, { useProgress } from 'relaks';

export default async function(props) {
  const [ show ] = useProgress();
  show(<div>Test</div>);
}
    `.trim();
    const expected = `
import Relaks, { useProgress } from 'relaks';

const __defMemoized0 = Relaks.memo(async function (props) {
  const [show] = useProgress();
  show(React.createElement("div", null, "Test"));
});

export default __defMemoized0;
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
  it('should add default import of Relaks if missing', function() {
    const code = `
import { useProgress } from 'relaks';

async function Hello(props) {
  const [ show ] = useProgress();
  show(<div>Test</div>);
}

export {
  Hello
};
    `.trim();
    const expected = `
import Relaks, { useProgress } from 'relaks';
const Hello = Relaks.memo(async function Hello(props) {
  const [show] = useProgress();
  show(React.createElement("div", null, "Test"));
});
export { Hello };
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
  it('should use default import of Relaks', function() {
    const code = `
import diff, { useProgress } from 'relaks';

async function Hello(props) {
  const [ show ] = useProgress();
  show(<div>Test</div>);
}

export {
  Hello
};
    `.trim();
    const expected = `
import diff, { useProgress } from 'relaks';
const Hello = diff.memo(async function Hello(props) {
  const [show] = useProgress();
  show(React.createElement("div", null, "Test"));
});
export { Hello };
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
  it('should detect usage of useProgress() when imported under different name ', function() {
    const code = `
import { useProgress as useProgressive } from 'relaks';

async function Hello(props) {
  const [ show ] = useProgressive();
  show(<div>Test</div>);
}

export {
  Hello
};
    `.trim();
    const expected = `
import Relaks, { useProgress as useProgressive } from 'relaks';
const Hello = Relaks.memo(async function Hello(props) {
  const [show] = useProgressive();
  show(React.createElement("div", null, "Test"));
});
export { Hello };
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
  it('should ignore async function that do not use useProgress', function() {
    const code = `
import { useProgress } from 'relaks';

async function Hello(props) {
  const [ show ] = useProgress();
  show(<div>Test</div>);
}

async function World() {
  console.log('world');
}

export {
  Hello,
  World
};
    `.trim();
    const expected = `
import Relaks, { useProgress } from 'relaks';
const Hello = Relaks.memo(async function Hello(props) {
  const [show] = useProgress();
  show(React.createElement("div", null, "Test"));
});

async function World() {
  console.log('world');
}

export { Hello, World };
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
  it('should not do anything when useProgress is not imported', function() {
    const code = `
async function Hello(props) {
  const [ show ] = useProgress();
  show(<div>Test</div>);
}

export {
  Hello
};
    `.trim();
    const expected = `
async function Hello(props) {
  const [show] = useProgress();
  show(React.createElement("div", null, "Test"));
}

export { Hello };
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
  it('should convert anonymous function passed to React.memo() to named function', function() {
    const code = `
import React from 'react';

const Test = React.memo((props) => {
  return <div/>;
});
    `.trim();
    const expected = `
import React from 'react';
const Test = React.memo(function Test(props) {
  return React.createElement("div", null);
});
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
  it('should convert anonymous function passed to React.forwardRef() to named function', function() {
    const code = `
import React from 'react';

const Test = React.forwardRef((props, ref) => {
  return <div ref={ref}/>;
});
    `.trim();
    const expected = `
import React from 'react';
const Test = React.forwardRef(function Test(props, ref) {
  return React.createElement("div", {
    ref: ref
  });
});
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
  it('should convert anonymous function passed to Relaks.memo() to named function', function() {
    const code = `
import Relaks, { useProgress } from 'relaks';

const Test = Relaks.memo(async (props) => {
  const [ show ] = useProgress();
});
    `.trim();
    const expected = `
import Relaks, { useProgress } from 'relaks';
const Test = Relaks.memo(async function Test(props) {
  const [show] = useProgress();
});
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
  it('should convert anonymous function passed to Relaks.use() to named function', function() {
    const code = `
import Relaks, { useProgress } from 'relaks';

const Test = Relaks.use(async (props) => {
  const [ show ] = useProgress();
});
    `.trim();
    const expected = `
import Relaks, { useProgress } from 'relaks';
const Test = Relaks.use(async function Test(props) {
  const [show] = useProgress();
});
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
  it('should ignore calls to React.memo() that are not assigned to variables', function() {
    const code = `
import React from 'react';

React.memo((props) => {
  return <div/>;
});
    `.trim();
    const expected = `
import React from 'react';
React.memo(props => {
  return React.createElement("div", null);
});
    `.trim();
    const transpiled = transpile(code);
    expect(transpiled).to.equal(expected);
  })
})
