// webpack.config.js
var webpack = require('webpack')

module.exports = {
    entry: {
        entry: __dirname + '/src/index.js'
    },
    output: {
        filename: 'cashpay.min.js',
        library: 'CashPay',
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                loader: 'babel-loader',
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
}
