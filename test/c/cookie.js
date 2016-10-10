define('c/cookie.js', function(require, exports, module) {

  (function (global) {
      var cookie = {
          set: function (key, val, time) {
              var date = new Date(),
                  expiresDays = time,
                  url = location.href,
                  cookieStr;
  
              date.setTime(date.getTime() + expiresDays * 24 * 3600 * 1000);
  
              if (url.indexOf('cricuc.com') > -1) {
                  cookieStr = ';domain=.cricuc.com;path=/;';
              } else if (url.indexOf('ucweb.com') > -1) {
                  cookieStr = ';domain=.ucweb.com;path=/;';
              } else if (url.indexOf('uc.cn') > -1) {
                  cookieStr = ';domain=.uc.cn;path=/;';
              }
  
              document.cookie = key + '=' + val + ';expires=' + date.toGMTString() + cookieStr;
  
          },
          get: function (key) {
              var cookie = document.cookie.replace(/[ ]/g, ''),
                  arrCookie = cookie.split(';'),
                  tips;
  
              for (var i = 0; i < arrCookie.length; i++) {
                  var arr = arrCookie[i].split('=');
                  if (key === arr[0]) {
                      tips = arr[1];
                      break;
                  }
              }
              return tips;
          }
      }
      global._cookie = cookie;
  })(window);

});
