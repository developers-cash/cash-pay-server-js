// webpack.config.js
const path = require('path');
const webpack = require('webpack');

module.exports = {
    node: false,
    entry: {
        main: __dirname + '/src/browser.js'
    },
    output: {
      path: path.resolve(__dirname, 'lib'),
      filename: 'module.js',
      libraryTarget: 'commonjs2',
    },
    module: {
      rules: [
        /*{
          test: /\.js$/,
          loader: 'babel-loader',
          exclude: /node_modules/,
          query: {
            presets: [
              ['@babel/preset-env', {
                modules: "commonjs",
                targets: {
                  node: "10"
                }
              }]
            ],
          }
        },*/
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.svg$/,
          loader: 'svg-inline-loader'
        },
        {
          test: /\.html$/i,
          loader: 'html-loader',
        },
      ]
    },
    externals: [
      /^\w+/,
      /^\@\w+/
    ]
}
