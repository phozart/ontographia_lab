// eslint-config-next v16 ships a native flat config (no FlatCompat needed).
const nextCoreWebVitals = require('eslint-config-next/core-web-vitals');

module.exports = [
  {
    ignores: ['.next/**', 'node_modules/**', '.claude/**', 'public/**', 'coverage/**'],
  },
  ...nextCoreWebVitals,
  {
    // eslint-plugin-react-hooks v7 (bundled with eslint-config-next 16) adds React Compiler
    // rules that flag long-standing patterns in the existing codebase. Kept as warnings so
    // they stay visible without blocking; promote to errors once the code is cleaned up.
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/use-memo': 'warn',
    },
  },
];
