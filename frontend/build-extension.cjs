#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔨 Building Accessly Browser Extension...');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy public files
console.log('📁 Copying public files...');
const publicDir = path.join(__dirname, 'public');
const publicFiles = fs.readdirSync(publicDir);

publicFiles.forEach(file => {
  const srcPath = path.join(publicDir, file);
  const destPath = path.join(distDir, file);
  
  if (fs.statSync(srcPath).isDirectory()) {
    // Copy directory recursively
    execSync(`cp -r "${srcPath}" "${destPath}"`);
  } else {
    // Copy file
    fs.copyFileSync(srcPath, destPath);
  }
});

// Copy content CSS
console.log('🎨 Copying content CSS...');
fs.copyFileSync(
  path.join(__dirname, 'content', 'content.css'),
  path.join(distDir, 'content.css')
);

// Compile TypeScript files
console.log('📝 Compiling TypeScript files...');

// Compile background script
try {
  execSync('npx tsc background/background.ts --outDir dist --target es2020 --module es2020 --moduleResolution node', { stdio: 'inherit' });
  console.log('✅ Background script compiled');
} catch (error) {
  console.error('❌ Failed to compile background script:', error.message);
}

// Compile content script
try {
  execSync('npx tsc content/content.ts --outDir dist --target es2020 --module es2020 --moduleResolution node', { stdio: 'inherit' });
  console.log('✅ Content script compiled');
} catch (error) {
  console.error('❌ Failed to compile content script:', error.message);
}

// Compile popup script
try {
  execSync('npx tsc popup/popup.ts --outDir dist --target es2020 --module es2020 --moduleResolution node', { stdio: 'inherit' });
  console.log('✅ Popup script compiled');
} catch (error) {
  console.error('❌ Failed to compile popup script:', error.message);
}

// Copy popup HTML
console.log('📄 Copying popup HTML...');
fs.copyFileSync(
  path.join(__dirname, 'popup', 'popup.html'),
  path.join(distDir, 'popup.html')
);

// Update popup.html to reference the compiled JS
const popupHtmlPath = path.join(distDir, 'popup.html');
let popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
popupHtml = popupHtml.replace('src="popup.js"', 'src="popup.js"');
fs.writeFileSync(popupHtmlPath, popupHtml);

console.log('🎉 Extension build complete!');
console.log('📂 Extension files are in the dist/ directory');
console.log('🔧 Load the extension from the dist/ directory in Chrome');
