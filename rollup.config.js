const Babel = require('rollup-plugin-babel');

module.exports =  {
  input: `./src/index.js`,
  output: {
    file: `./lib/index.js`,
    format: 'cjs',
  },
  plugins: [
    Babel({
      presets: [
        '@babel/env',
      ],
    }),
  ],
};
