// Global polyfills for Node.js environment
const { Blob } = require('buffer');

// File API polyfill for Recall SDK
global.File = class File extends Blob {
  constructor(fileBits, fileName, options = {}) {
    super(fileBits, options);
    this.name = fileName;
    this.lastModified = Date.now();
    this.webkitRelativePath = '';
  }
};

console.log('✅ File polyfill loaded for trading agent');
