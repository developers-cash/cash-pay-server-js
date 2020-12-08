// webpack.config.js
const path = require('path');
const webpack = require('webpack');

module.exports = [{
  entry: {
      main: __dirname + '/src/browser.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'cashpay.min.js',
    library: 'CashPay',
    libraryTarget: 'window',
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
              modules: "commonjs"
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
}, {
    node: false,
    entry: {
        main: __dirname + '/src/browser.js'
    },
    output: {
      path: path.resolve(__dirname),
      filename: 'browser.js',
      libraryTarget: 'commonjs',
    },
    module: {
      rules: [
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
}, {
    node: false,
    entry: {
        main: __dirname + '/src/index.js'
    },
    output: {
      path: path.resolve(__dirname),
      filename: 'server.js',
      libraryTarget: 'commonjs',
    },
    module: {
      rules: [
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
}]
