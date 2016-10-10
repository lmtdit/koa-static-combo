'use strict';

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _lruCache = require('lru-cache');

var _lruCache2 = _interopRequireDefault(_lruCache);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// 获取静态资源的真实地址
// 如果文件路径没有拆过root范围则返回真实地址
// 否则返回false，避免xss攻击
function getRealPath(root, file) {
  const realPath = _path2.default.join(root, file);
  return !/(?:^|[\\\/])\.\.(?:[\\\/]|$)/.test(_path2.default.relative(root, realPath)) && realPath;
}

function md5(source) {
  const str = new Buffer(source).toString('binary');
  return _crypto2.default.createHash('md5').update(str).digest('hex');
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
module.exports = function (o) {
  const opts = Object.assign({}, o);
  const cache = (0, _lruCache2.default)({
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
      const etag = cache && cache.get(url);
      const cons = [];
      const assetsPath = opts.assetsPath;
      const comboTag = opts.comboTag;
      const comboDirTag = opts.comboDirTag;
      const comboModSplit = opts.comboModSplit;
      const addToList = function (file) {
        let con = cache && cache.get(file);
        if (!con) {
          try {
            con = _fs2.default.readFileSync(file, {
              encoding: 'utf8'
            });
            if (cache) cache.set(file, con);
          } catch (e) {
            sendData = false;
          }
        }
        cons.push(con);
      };
      const comboArr = url.split(comboTag);
      const filePrefix = comboArr[0].split(comboDirTag);
      const files = comboArr[1].split(comboModSplit);
      filePrefix.shift();
      [].forEach.call(files, function (key, index) {
        if (sendData) {
          const file = filePrefix[0] ? _path2.default.join(filePrefix[0], key) : key;
          const filePath = getRealPath(assetsPath, file);
          sendData = sendData && !!filePath;
          const ext = _path2.default.extname(filePath);
          if (index === 0 && ['.css', '.js'].indexOf(ext) !== -1) fileExt = ext;
          if (fileExt === ext) addToList(filePath);
        }
      });
      if (sendData && cons.length) {
        const conString = cons.join('\n');
        const conMd5 = md5(conString);
        if (conMd5 === etag) {
          this.status = 304;
        } else {
          this.type = fileExt.slice(1);
          this.status = 200;
          this.set({ 'Cache-Control': `publish,max-age=${ opts.maxAge }` });
          this.set({ Etag: conMd5 });
          cache.set(url, conMd5);
          this.body = conString;
        }
        this.isCombo = true;
      } else {
        this.status = 404;
        this.body = 'Not Found';
      }
    }
    yield next;
  };
};