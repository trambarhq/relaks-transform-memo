import { transform, registerPlugin } from '@babel/standalone';
import transformMemo from '../../src/index.js';

registerPlugin('transform-memo', transformMemo);

const input = document.getElementById('input');
const output = document.getElementById('output');

input.addEventListener('input', () => {
  try {
    const original = input.value;
    const result = transform(original, {
      presets: [ 'react' ],
      plugins: [ 'transform-memo' ],
    });
    const transpiled = result.code;
    output.value = transpiled;
  } catch (err) {
  }
});
