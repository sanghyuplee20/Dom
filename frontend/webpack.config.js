const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    content: './src/content/content.js',
    popup: './src/popup/popup.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]/[name].js'
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/popup/popup.html', to: 'popup/popup.html' },
        { from: 'src/popup/popup.css', to: 'popup/popup.css' },
        { from: 'src/content/content.css', to: 'content/content.css' },
        { from: 'src/icons', to: 'icons' }
      ]
    })
  ]
};