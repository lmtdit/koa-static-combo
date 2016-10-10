require('babel-register');
const transform = require('babel-core').transform;
const fis = require('fis3');

fis.set('project.ignore', [
  'node_modules/**',
  '*.md',
  'test/**',
  'lib/**'
]);
fis.match('**', {
  release: false
}).match('src/(**.js)', {
  release: '$1',
  parser: function babelParser(content, file, conf) {
    return transform(content, {
      presets: ['stage-1'],
      plugins: [
        'transform-async-to-generator',
        'transform-decorators-legacy',
        'transform-es2015-arrow-functions',
        'transform-es2015-for-of',
        'transform-es2015-modules-commonjs',
        'transform-es2015-parameters',
        'transform-es2015-spread'
      ]
    }).code;
  }
});
