import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import lru from 'lru-cache';

// 获取静态资源的真实地址
// 如果文件路径没有拆过root范围则返回真实地址
// 否则返回false，避免xss攻击
function getRealPath(root, file) {
  const realPath = path.join(root, file);
  return !/(?:^|[\\\/])\.\.(?:[\\\/]|$)/.test(path.relative(root, realPath)) && realPath;
}

function md5(source) {
  const str = new Buffer(source).toString('binary');
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * combo setting
 * @param  {object} o [combo setting]
 * @usage:
 * const app = require('koa')();
 * const opts = {
 *   assetsPath: serverRoot,
 *   routerReg: /^(\/co)(;.+)?(\?\?)(.+)/i,
 *   comboTag: '??',
 *   comboDirTag: ';',
 *   comboModSplit: ',',
 *   maxAge: 60 * 60 * 24 * 365 * 1000
 * };
 * app.use(combo(opts)).listen(5000);
 *
 *  URL request as:
 *  http://127.0.0.1:5000/co??v/l/vue.js,v/l/zepto.js
 *  or http://127.0.0.1:5000/co;v??l/vue.js,l/zepto.js
 *  or http://127.0.0.1:5000/co;v/l??vue.js,zepto.js
 *
 * @return {function}
 */
module.exports = (o) => {
  const opts = Object.assign({}, o);
  const cache = lru({
    max: 300,
    maxAge: 1000 * 60 * 60 * 24
  });
  return function* combo(next) {
    let sendData = true;
    let fileExt = null;
    const req = this.request;
    const url = req.url;
    this.isCombo = false;
    if (opts.routerReg.test(url)) {
      const cons = [];
      const assetsPath = opts.assetsPath;
      const comboTag = opts.comboTag;
      const comboDirTag = opts.comboDirTag;
      const comboModSplit = opts.comboModSplit;

      const hashCacheName = '__combo_hash__';
      const urlArr = url.split('&');
      const hash = urlArr.length > 1 ? urlArr[1] : '';
      const addToList = (file) => {
        let con = cache && cache.get(file);
        const hashCache = cache && cache.get(hashCacheName);
        if (!con || !hashCache || hashCache !== hash) {
          try {
            con = fs.readFileSync(file, {
              encoding: 'utf8'
            });
            if (cache) cache.set(file, con);
          } catch (e) {
            sendData = false;
          }
        }
        cons.push(con);
      };
      const comboArr = urlArr[0].split(comboTag);
      const filePrefix = comboArr[0].split(comboDirTag);
      const files = comboArr[1].split(comboModSplit);
      filePrefix.shift();
      [].forEach.call(files, (key, index) => {
        if (sendData) {
          const file = filePrefix[0] ? path.join(filePrefix[0], key) : key;
          const filePath = getRealPath(assetsPath, file);
          sendData = sendData && !!filePath;
          const ext = path.extname(filePath);
          if (index === 0 && ['.css', '.js'].indexOf(ext) !== -1) fileExt = ext;
          if (fileExt === ext) addToList(filePath);
        }
      });
      if (sendData && cons.length) {
        const conString = cons.join('\n');
        const conMd5 = md5(conString);
        this.type = fileExt.slice(1);
        this.status = 200;
        this.set({
          'Cache-Control': `publish,max-age=${opts.maxAge}`
        });
        this.body = conString;
        if (hash) cache.set(hashCacheName, hash);
      } else {
        this.status = 404;
        this.body = 'Not Found';
      }
    }
    yield next;
  };
};
