const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    mode: 'development',
    entry: './src/main.js',
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: "src/index.html" },
                { from: "src/styles.css" },
                { from: "src/favicon.ico" },
                { from: "src/manifest.json" },
                { from: "src/images", to: "images" }
            ],
        }),
    ],
};