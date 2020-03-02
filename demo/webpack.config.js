const Path = require('path');
const Webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  context: Path.resolve('./src'),
  entry: './index.js',
  output: {
    path: Path.resolve('./'),
    filename: 'index.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: Path.resolve(`./src/index.html`),
      filename: Path.resolve(`./index.html`),
    }),
  ],
  devtool: 'inline-source-map',
  devServer: {
    inline: true,
    open: true,
  }
};
