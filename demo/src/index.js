import { transform, registerPlugin } from '@babel/standalone';
import transformMemo from '../../src/index.js';

registerPlugin('transform-memo', transformMemo);

const input = document.getElementById('input');
const output = document.getElementById('output');

input.value = localStorage['input'] || '';
update();
input.addEventListener('input', update);

function update() {
  try {
    const original = localStorage['input'] = input.value;
    const options = {
      otherHOCs: [
        'Overlay.create',
        'Orange'
      ]
    };
    const result = transform(original, {
      presets: [ 'react' ],
      plugins: [ [ 'transform-memo', options ] ],
    });
    const transpiled = result.code;
    output.value = transpiled;
  } catch (err) {
    console.log(err.message);
  }
}
