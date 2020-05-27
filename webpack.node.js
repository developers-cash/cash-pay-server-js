// webpack.config.js
const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: {
        main: __dirname + '/src/index.js'
    },
    output: {
      path: path.resolve(__dirname, 'lib'),
      filename: 'index.js',
      libraryTarget: 'commonjs',
    },
    module: {
      rules: [
        {
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
            plugins: [
              '@babel/transform-runtime'
            ]
          }
        },
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
      /^\w+/
    ]
}
