# koa-static-combo

A static files combo server for Koa.

## Installation

```shell
npm i koa-static-combo
```

## Usage

```js
const app = require('koa')();
const opts = {
  assetsPath: 'path/to/static/server/root',
  routerReg: /^(\/co)(;.+)?(\?\?)(.+)/i,
  comboTag: '??',
  comboDirTag: ';',
  comboModSplit: ',',
  maxAge: 60 * 60 * 24 * 365 * 1000
};
app.use(combo(opts)).listen(5000);

```

### API
- `assetsPath` (str) - the directory you wish to serve.
- `comboDirTag` (str) - the url prefix you wish to add, default to `;`.
- `comboModSplit` (str) - the combo file tag you wish to split, default to `,`.
- `maxAge` (int) - cache control max age for the files, `365`days by default.
- `routerReg` (Regex) - the regular expression URL of judgment, must be matched with `comboTag`.


### Example

```html
http://127.0.0.1:5000/co??v/l/vue.js,v/l/zepto.js
<!-- or  -->
http://127.0.0.1:5000/co;v??l/vue.js,l/zepto.js
<!-- or -->
http://127.0.0.1:5000/co;v/l??vue.js,zepto.js
```
