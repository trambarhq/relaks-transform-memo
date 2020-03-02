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
  it('should correct handle inline export statement', function() {
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

})
