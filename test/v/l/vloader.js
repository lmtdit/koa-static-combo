(function(global) {
  'use strict';

  var slice = Array.prototype.slice,
    localStorage = global.localStorage,
    proto = {},
    vloader = create(proto);

  vloader.version = '0.1.0';
  vloader.options = {
    prefix: '__VL__',
    debug: false, // env flag, if false then env is development
    cache: false,
    combo: false,
    hash: '',
    timeout: 15, // seconds
    alias: {}, // key - name, value - id
    deps: {}, // key - id, value - name/id
    comboPattern: null, // '/path/to/combo-service/%s' or function (ids) { return url; }
    maxUrlLength: 2000 // approximate value of combo url's max length (recommend 2000)
  };
  vloader.cache = {}; // key - id
  vloader.maps = {
    old: {},
    curr: {}
  };
  vloader.traceback = null;

  /*
   * Mix obj to vloader.options
   * @param {Object} obj
   */
  proto.config = function(obj) {
    var options = vloader.options;
    each(obj, function(value, key) {
      var data = options[key],
        t = type(data);
      if (t === 'object') {
        each(value, function(v, k) {
          if (key === 'alias') {
            data[k] = v[0];
            vloader.maps.curr[k] = v[1];
          } else {
            data[k] = v;
          }
        });
      } else {
        if (t === 'array') value = data.concat(value);
        options[key] = value;
      }
    });
    // detect localStorage support and activate cache ability
    try {
      vloader.getHash();
      if (options.hash !== localStorage.getItem('__VL_HASH__')) {
        vloader.clean();
        localStorage.setItem('__VL_HASH__', options.hash);
      }
      options.cache = options.cache && !!options.hash;
    } catch (e) {
      options.cache = false;
    }
    // detect vloader=nocombo,nocache in location.search
    if (/\bvloader=([\w\.,]+)\b/.test(location.search)) {
      each(RegExp.$1.split(','), function(o) {
        switch (!!o) {
          case o === 'nocache':
            options.cache = false;
            vloader.clean();
            break;
          case o === 'nocombo':
            options.combo = false;
            break;
          case /^((25[0-5]|2[0-4]\d|[01]?\d\d?)($|(?!\.$)\.)){4}$/.test(o):
            options.domain = '//' + o + ':5000';
            options.debug = true;
            options.urlPattern = '/';
            options.comboPattern = '/co/??%s';
            break;
        }
      });
    }
    return options;
  };

  /*
   * Require modules asynchronously with a callback
   * @param {string|string[]} names
   * @param {Function} [onload]
   */
  proto.async = function(names, onload) {
    if (type(names) === 'string') names = [names];
    var reactor = new vloader.Reactor(names, function() {
      var args = [];
      each(names, function(id) {
        args.push(require(id));
      });
      if (onload) onload.apply(vloader, args);
      vloader.options.cache && vloader.saveHash();
    });
    reactor.run();
  };
  /*
   * Define a JS module with a factory function
   * @param {string} id
   * @param {Function} factory
   * @param {boolean} [cache=true]
   */
  proto.define = function(id, factory, cache) {
    var options = vloader.options,
      res = vloader.cache[id];
    if (res) {
      res.factory = factory;
    } else {
      vloader.cache[id] = {
        id: id,
        loaded: true,
        factory: factory
      };
    }
    if (options.cache && cache !== false) {
      try {
        localStorage.setItem(options.prefix + id, factory.toString());
      } catch (e) {
        options.cache = false;
      }
    }
  };

  /*
   * Define a CSS module
   * @param {string} id
   * @param {string} css
   * @param {boolean} [parsing=true]
   */
  proto.defineCSS = function(id, css, parsing) {
    var options = vloader.options;
    vloader.cache[id] = {
      id: id,
      loaded: true,
      rawCSS: css
    };
    if (parsing !== false) requireCSS(id);
    if (options.cache) {
      try {
        localStorage.setItem(options.prefix + id, css);
      } catch (e) {
        options.cache = false;
      }
    }
  };

  /*
   * Get a defined module
   * @param {string} id
   * @returns {Object} module
   */
  proto.get = function(id) {
    var options = vloader.options,
      fType = fileType(id),
      res = vloader.cache[id],
      raw;
    if (res) {
      return res;
    } else if (options.cache) {
      raw = localStorage.getItem(options.prefix + id);
      if (raw !== null) {
        if (fType === 'js') {
          // Don't use eval or new Function in UC (9.7.6 ~ 9.8.5)
          // global['eval'].call(global, 'define("' + id + '",' + raw + ')');
          // new Function('define("' + id + '",' + raw + ')')();
          var s = document.createElement('script');
          s.appendChild(document.createTextNode('define("' + id + '",' + raw + ')'));
          document.head.appendChild(s);
        } else if (fType === 'css') {
          vloader.defineCSS(id, raw, false);
        }
        vloader.cache[id].loaded = false;
        return vloader.cache[id];
      }
    }
    return null;
  };

  /*
   * check module isn't changed
   * @param {string} id module-id
   * @returns {boolean}
   */
  proto.isChanged = function(id) {
    var map = vloader.maps;
    return !map.old[id] || map.old[id] !== map.curr[id];
  };
  /*
   * Clean module cache in localStorage
   */
  proto.clean = function() {
    var options = vloader.options;
    try {
      each(vloader.maps.curr, function(_, id) {
        var key = options.prefix + id;
        if (!options.cache || proto.isChanged(id)) {
          localStorage.removeItem(key);
        }
      });
      localStorage.removeItem('__VL_HASH__');
    } catch (e) {}
  };

  /*
   * Save modules hash into localStorage
   */
  proto.saveHash = function() {
    var currMap = JSON.stringify(vloader.maps.curr);
    localStorage.setItem('__VL_HASH_MAP__', currMap);
  };

  /*
   * get modules hash from localStorage
   */
  proto.getHash = function() {
    var oldMap = JSON.parse(localStorage.getItem('__VL_HASH_MAP__'));
    oldMap && (vloader.maps.old = oldMap);
  };

  /*
   * Load any types of resources from specified url
   * @param {string} url
   * @param {Function|Object} [onload|options]
   */
  proto.load = function(url, options) {
    if (!url) return;
    if (type(options) === 'function') {
      options = {
        onload: options
      };
      if (type(arguments[2]) === 'function') options.onerror = arguments[2];
    }

    function onerror(e) {
      clearTimeout(tid);
      clearInterval(intId);
      e = (e || {}).error || new Error('load url timeout');
      e.message = 'Error loading url: ' + url + '. ' + e.message;
      if (options.onerror) options.onerror.call(vloader, e);
      else throw e;
    }
    var t = options.type || fileType(url),
      isScript = t === 'js',
      isCss = t === 'css',
      isOldWebKit = +navigator.userAgent.replace(/.*AppleWebKit\/(\d+)\..*/, '$1') < 536,
      head = document.head,
      node = document.createElement(isScript ? 'script' : 'link'),
      supportOnload = 'onload' in node,
      tid = setTimeout(onerror, (options.timeout || 15) * 1000),
      intId, intTimer;
    if (isScript) {
      node.type = 'text/javascript';
      node.async = false;
      node.src = url;
    } else {
      if (isCss) {
        node.type = 'text/css';
        node.rel = 'stylesheet';
      }
      node.href = url;
    }
    node.onload = node.onreadystatechange = function() {
      if (node && (!node.readyState ||
          /loaded|complete/.test(node.readyState))) {
        clearTimeout(tid);
        clearInterval(intId);
        node.onload = node.onreadystatechange = null;
        if (isScript && head && node.parentNode) head.removeChild(node);
        if (options.onload) options.onload.call(vloader);
        node = null;
      }
    };
    node.onerror = onerror;

    head.appendChild(node);

    // trigger onload immediately after nonscript node insertion
    if (isCss) {
      if (isOldWebKit || !supportOnload) {
        intTimer = 0;
        intId = setInterval(function() {
          if ((intTimer += 20) > options.timeout || !node) {
            clearTimeout(tid);
            clearInterval(intId);
            return;
          }
          if (node.sheet) {
            clearTimeout(tid);
            clearInterval(intId);
            if (options.onload) options.onload.call(vloader);
            node = null;
          }
        }, 20);
      }
    } else if (!isScript) {
      if (options.onload) options.onload.call(vloader);
    }
  };

  proto.Reactor = function(names, callback) {
    this.length = 0;
    this.depends = {};
    this.depended = {};
    this.push.apply(this, names);
    this.callback = callback;
  };

  var rproto = vloader.Reactor.prototype;

  rproto.push = function() {
    var that = this,
      args = slice.call(arguments);

    function onload() {
      if (--that.length === 0) that.callback();
    }
    each(args, function(id) {
      if (!vloader.maps.curr[id]) return;
      var fType = fileType(id),
        res = vloader.get(id);
      if (!res) {
        res = vloader.cache[id] = {
          id: id,
          loaded: false
        };
      } else if (that.depended[id] || res.loaded) return;
      if (!res.onload) res.onload = [];
      that.depended[id] = 1;
      that.push.apply(that, vloader.options.deps[id]);
      if ((fType === 'css' && !res.rawCSS && !res.parsed) ||
        (fType === 'js' && !res.factory && !res.exports)) {
        (that.depends[fType] || (that.depends[fType] = [])).push(res);
        ++that.length;
        res.onload.push(onload);
      } else if (res.rawCSS) {
        requireCSS(id);
      }
    });
  };

  function makeOnload(deps) {
    deps = deps.slice();
    return function(e) {
      if (e) error(e);
      each(deps, function(res) {
        if (!e) res.loaded = true;
        while (res.onload && res.onload.length) {
          var onload = res.onload.shift();
          onload.call(res);
        }
      });
    };
  }

  rproto.run = function() {
    var that = this,
      options = vloader.options,
      combo = options.combo,
      cache = options.cache,
      depends = this.depends;
    if (this.length === 0) return this.callback();

    function resourceCombo(resdeps) {
      var urlLength = 0,
        ids = [],
        deps = [];
      each(resdeps, function(res, i) {
        var onload;
        if (urlLength + res.id.length < options.maxUrlLength) {
          urlLength += res.id.length;
          ids.push(res.id);
          deps.push(res);
        } else {
          onload = makeOnload(deps);
          vloader.load(that.genUrl(ids), onload, onload);
          urlLength = res.id.length;
          ids = [res.id];
          deps = [res];
        }
        if (i === resdeps.length - 1) {
          onload = makeOnload(deps);
          vloader.load(that.genUrl(ids), onload, onload);
        }
      });
    }
    if (combo) {
      if (cache) {
        resourceCombo((depends.css || []).concat(depends.js || []));
      } else {
        resourceCombo(depends.css || []);
        resourceCombo(depends.js || []);
      }
    } else {
      each((depends.css || []).concat(depends.js || []), function(res) {
        var onload = makeOnload([res]);
        vloader.load(that.genUrl(res.id), onload);
      });
    }
  };

  rproto.genUrl = function(ids) {
    if (type(ids) === 'string') ids = [ids];
    var options = vloader.options,
      maps = vloader.maps.curr,
      url = options.domain;
    // options.combo && (url += options.comboPattern);
    var uris = [];
    each(ids, function(key) {
      var id = options.alias[key];
      var uri;
      if (id) {
        uri = (options.debug ? id : [id, maps[key]].join('_')) + '.js';
        uris.push(uri);
      }
    });
    if (options.combo) {
      url += options.comboPattern.replace('%s', uris.join(','));
    } else {
      url += options.urlPattern + uris[0] + '?v=' + Math.random();
    }
    return url;
  };

  /*
   * Require another module in factory
   * @param {string} name
   * @returns {*} module.exports
   */
  function require(id) {
    var module = vloader.get(id);
    if (fileType(id) !== 'js') return;
    if (!module) {
      error(new Error('failed to require "' + name + '"'));
      return null;
    }
    if (type(module.factory) === 'function') {
      var factory = module.factory;
      delete module.factory;
      try {
        factory.call(vloader, require, module.exports = {}, module);
      } catch (e) {
        e.id = id;
        throw (vloader.traceback = e);
      }
    }
    return module.exports;
  }

  // Mix vloader's prototype to require
  each(proto, function(m, k) {
    require[k] = m;
  });

  /*
   * Parse CSS module
   * @param {string} name
   */
  function requireCSS(id) {
    var module = vloader.get(id);
    if (fileType(id) !== 'css') return;
    if (!module) throw new Error('failed to require "' + name + '"');
    if (!module.parsed) {
      if (type(module.rawCSS) !== 'string') {
        throw new Error('failed to require "' + name + '"');
      }
      var styleEl = document.createElement('style');
      document.head.appendChild(styleEl);
      styleEl.appendChild(document.createTextNode(module.rawCSS));
      delete module.rawCSS;
      module.parsed = true;
    }
  }

  function type(obj) {
    var t;
    if (obj == null) {
      t = String(obj);
    } else {
      t = Object.prototype.toString.call(obj).toLowerCase();
      t = t.substring(8, t.length - 1);
    }
    return t;
  }

  function each(obj, iterator, context) {
    if (typeof obj !== 'object') return;
    var i, l, t = type(obj);
    context = context || obj;
    if (t === 'array' || t === 'arguments' || t === 'nodelist') {
      for (i = 0, l = obj.length; i < l; i++) {
        if (iterator.call(context, obj[i], i, obj) === false) return;
      }
    } else {
      for (i in obj) {
        if (obj.hasOwnProperty(i)) {
          if (iterator.call(context, obj[i], i, obj) === false) return;
        }
      }
    }
  }

  function create(pt) {
    function Dummy() {}
    Dummy.prototype = pt;
    return new Dummy();
  }

  // check file type, defalut is js
  function fileType(file) {
    return /\.css(?=[?&,]|$)/i.test(file) ? 'css' : 'js';
  }

  /* eslint no-console: ["error", { allow: ["warn", "error"] }] */
  function error() {
    if (console && type(console.error) === 'function') {
      console.error.apply(console, arguments);
    }
  }
  // global.pre_require = require;
  global.require = vloader;
  global.define = vloader.define;
  global.defineCSS = vloader.defineCSS;
  if (typeof module === 'object' && typeof module.exports === 'object') module.exports = vloader;
})(window);
