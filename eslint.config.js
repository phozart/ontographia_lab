const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({ baseDirectory: __dirname });

module.exports = [
  {
    ignores: ['.next/**', 'node_modules/**', '.claude/**', 'public/**', 'coverage/**'],
  },
  ...compat.extends('next/core-web-vitals'),
];
