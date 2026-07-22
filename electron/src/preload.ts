require('./rt/electron-rt');
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('AhorroInstall', {
  isDesktop: true,
  platform: process.platform,
});
//////////////////////////////
// User Defined Preload scripts below
console.log('User Preload!');
