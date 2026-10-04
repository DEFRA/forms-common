export default {
  '*.{cjs,js,mjs,ts}':
    'eslint --cache --cache-location .cache/eslint --cache-strategy content --fix',
  '*.{cjs,js,json,md,mjs,ts}':
    'prettier --cache --cache-location .cache/prettier --cache-strategy content --check --write'
}
