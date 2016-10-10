const path = require('path');
const openUrl = require('openurl');
const app = require('koa')();
const koaStatic = require('koa-static');
const combo = require('../lib');
const comboSetting = {
  assetsPath: __dirname,
  routerReg: /^(\/co)(;.+)?(\?\?)(.+)/i,
  comboTag: '??',
  comboDirTag: ';',
  comboModSplit: ',',
  maxAge: 60 * 60 * 24 * 365 * 1000
};
app.use(koaStatic(comboSetting.assetsPath)).use(combo(comboSetting)).listen(5000, function(){
  console.log('> Combo server listening on port 5000');
});

openUrl.open('http://127.0.0.1:5000/index.html');
