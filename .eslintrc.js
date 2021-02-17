module.exports = {
    // .eslintrc.js がプロジェクトのルートに配置されているか（指定がないと上位階層へ設定ファイルを探索される）
    root: true,
    env: {
        // ブラウザで実行されるコードを静的検証する
        browser: true,
        // ECMAScript 2015 (ES6) で書かれたコードを静的検証する
        es6: true,
        // Node.js で実行されるコードを静的検証する
        node: true,
    },
    // ESLint に TypeScript を理解させる
    parser: '@typescript-eslint/parser',
    parserOptions: {
        // ES Modules を有効
        sourceType: 'module',
        // ES2016 以降の構文を有効にするためには必要（ECMAScript のバージョン指定）
        ecmaVersion: 2019,
        // tsconfig.json の場所を指定（指定した場合は tsconfig.json の include で指定したファイルのみ ESLint が適用されるようになる）
        project: './tsconfig.json',
    },
    plugins: [
        // ESLint の TypeScript プラグインのルールを適用できる様にする（/eslint-pluginは省略可）
        '@typescript-eslint/eslint-plugin',
    ],
    extends: [
        // ESLint の JavaScript おすすめルールセットを適用
        'eslint:recommended',
        // eslint:recommended に含まれるルールを型チェックでカバーできるものは無効化
        'plugin:@typescript-eslint/eslint-recommended',
        // 型チェックが不要なルールを適用
        'plugin:@typescript-eslint/recommended',
        // 型チェックが必要なルールを適用
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
    ],
    rules: {
        // 不要なエスケープを禁止: off
        'no-useless-escape': false,
    },
};
