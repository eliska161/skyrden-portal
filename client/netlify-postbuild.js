const fs = require('fs-extra');
const path = require('path');

// This script creates the client/client/build directory structure that Netlify expects
console.log('Running post-build script to fix directory structure...');

// Create the client subdirectory if it doesn't exist
if (!fs.existsSync('client')) {
  fs.mkdirSync('client');
  console.log('Created client directory');
}

// Create the client/build subdirectory if it doesn't exist
if (!fs.existsSync(path.join('client', 'build'))) {
  fs.mkdirSync(path.join('client', 'build'));
  console.log('Created client/build directory');
}

// Copy all files from build to client/build
fs.copySync('build', path.join('client', 'build'));
console.log('Copied build files to client/build');

console.log('Post-build directory fix complete!');