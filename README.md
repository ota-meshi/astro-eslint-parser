# astro-eslint-parser

[Astro] component parser for [ESLint].  
You can check it on [Online DEMO](https://ota-meshi.github.io/astro-eslint-parser/playground).

[![sponsors](https://img.shields.io/badge/-Sponsor-fafbfc?logo=GitHub%20Sponsors)](https://github.com/sponsors/ota-meshi)

[![NPM license](https://img.shields.io/npm/l/astro-eslint-parser.svg)](https://www.npmjs.com/package/astro-eslint-parser)
[![NPM version](https://img.shields.io/npm/v/astro-eslint-parser.svg)](https://www.npmjs.com/package/astro-eslint-parser)
[![NPM downloads](https://img.shields.io/badge/dynamic/json.svg?label=downloads&colorB=green&suffix=/day&query=$.downloads&uri=https://api.npmjs.org//downloads/point/last-day/astro-eslint-parser&maxAge=3600)](http://www.npmtrends.com/astro-eslint-parser)
[![NPM downloads](https://img.shields.io/npm/dw/astro-eslint-parser.svg)](http://www.npmtrends.com/astro-eslint-parser)
[![NPM downloads](https://img.shields.io/npm/dm/astro-eslint-parser.svg)](http://www.npmtrends.com/astro-eslint-parser)
[![NPM downloads](https://img.shields.io/npm/dy/astro-eslint-parser.svg)](http://www.npmtrends.com/astro-eslint-parser)
[![NPM downloads](https://img.shields.io/npm/dt/astro-eslint-parser.svg)](http://www.npmtrends.com/astro-eslint-parser)
[![Build Status](https://github.com/ota-meshi/astro-eslint-parser/workflows/CI/badge.svg?branch=main)](https://github.com/ota-meshi/astro-eslint-parser/actions?query=workflow%3ACI)
[![Coverage Status](https://coveralls.io/repos/github/ota-meshi/astro-eslint-parser/badge.svg?branch=main)](https://coveralls.io/github/ota-meshi/astro-eslint-parser?branch=main)

This parser is in the ***experimental stages*** of development.

At least it works fine with a [withastro/docs](https://github.com/withastro/docs) repository.

[@astrojs/compiler]: https://github.com/withastro/compiler

## :checkered_flag: Motivation

This parser allows us to lint the script of `.astro` files.

> Note that this parser alone will not lint the scripts inside the `<script>` tag. Use [eslint-plugin-astro] to lint the script inside the `<script>` tag as well.

### ESLint Plugins Using astro-eslint-parser

#### [eslint-plugin-astro]

ESLint plugin for Astro component.  

## 💿 Installation

```bash
npm install --save-dev eslint astro-eslint-parser
```

## 📖 Usage

1. Write `overrides.parser` option into your `.eslintrc.*` file.

    ```json
    {
        "extends": "eslint:recommended",
        "overrides": [
            {
                "files": ["*.astro"],
                "parser": "astro-eslint-parser"
            }
        ]
    }
    ```

2. If you have specified the extension in the CLI, add `.astro` as well.

    ```console
    $ eslint "src/**/*.{js,astro}"
    # or
    $ eslint src --ext .js,.astro
    ```

The commit diff [here](https://github.com/withastro/astro.build/compare/main...ota-meshi:eslint) is an example of introducing this parser to the `astro.build` repository.

## 🔧 Options

`parserOptions` has the same properties as what [espree](https://github.com/eslint/espree#usage), the default parser of ESLint, is supporting.
For example:

```json
{
    "parser": "astro-eslint-parser",
    "parserOptions": {
        "sourceType": "module",
        "ecmaVersion": 2021,
        "ecmaFeatures": {
            "globalReturn": false,
            "impliedStrict": false,
            "jsx": false
        }
    }
}
```

### parserOptions.parser

You can use `parserOptions.parser` property to specify a custom parser to parse scripts.
Other properties than parser would be given to the specified parser.
For example:

```json
{
    "parser": "astro-eslint-parser",
    "parserOptions": {
        "parser": "@typescript-eslint/parser"
    }
}
```

For example, if you are using the `"@typescript-eslint/parser"`, and if you want to use TypeScript in `.astro`, you need to add more `parserOptions` configuration.

```js
module.exports = {
  // ...
  parser: "@typescript-eslint/parser",
  parserOptions: {
    // ...
    project: "path/to/your/tsconfig.json",
    extraFileExtensions: [".astro"], // This is a required setting in `@typescript-eslint/parser` v5.
  },
  overrides: [
    {
      files: ["*.astro"],
      parser: "astro-eslint-parser",
      // Parse the script in `.astro` as TypeScript by adding the following configuration.
      parserOptions: {
        parser: "@typescript-eslint/parser",
      },
    },
    // ...
  ],
  // ...
}
```

### parserOptions.astroFeatures

You can use `parserOptions.astroFeatures` property to specify how to parse related to Astro component features. For example:

```json
{
    "parser": "astro-eslint-parser",
    "parserOptions": {
        "astroFeatures": {
            "syntax": "auto",
        }
    }
}
```

### parserOptions.vueFeatures.syntax

You can use `parserOptions.vueFeatures.syntax` property to choose whether to parse as Astro Component (`*.astro`) or Astro Markdown Page (`*.md`).  
If `"astro"` is specified, it will be parsed as `*.astro`. If `"markdown"` is specified, it will be parsed as `*.md`. If `"auto"` is specified, it will be automatically selected from the file extensions.  
For example:

```json
{
    "parser": "astro-eslint-parser",
    "parserOptions": {
        "astroFeatures": {
            "syntax": "auto", // or "astro", or "markdown"
        }
    }
}
```

#### Known Limitations on Markdown Pages

There are some known limitations when parsing Markdown Pages for ESLint integration.

- Incompatible with ESLint's [indent] rule. Turn off the [indent] rule in the markdown file. Otherwise the file syntax will be broken.
- Incompatible with [eslint-plugin-markdown]. eslint-plugin-markdown separates the contents of markdown by the processor. So using this parser doesn't work because the parser doesn't know the whole markdown.

[indent]: https://eslint.org/docs/rules/indent
[eslint-plugin-markdown]: https://github.com/eslint/eslint-plugin-markdown

## :computer: Editor Integrations

### Visual Studio Code

Use the [dbaeumer.vscode-eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) extension that Microsoft provides officially.

You have to configure the `eslint.validate` option of the extension to check `.astro` files, because the extension targets only `*.js` or `*.jsx` files by default.

Example **.vscode/settings.json**:

```json
{
    "eslint.validate": [
        "javascript",
        "javascriptreact",
        "astro"
    ]
}
```

## :handshake: Compatibility With Existing ESLint Rules

Most of the rules in the ESLint core work for the script part, but some rules are incompatible.  
This parser will generate a JSX compatible AST for most of the HTML part of the Astro component. Therefore, some rules of [eslint-plugin-react] may work.
For example, the [react/jsx-no-target-blank] rule works fine.  

[eslint-plugin-react]: https://github.com/jsx-eslint/eslint-plugin-react/
[react/jsx-no-target-blank]: https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-target-blank.md

## :ghost: Limitations

If this parser is used with `@typescript-eslint/parser` and `parserOptions.project` is set, it will temporarily create a `.tsx` file to parse the `.astro` file.  
This parser works by converting the `.astro` file to JSX and letting the JavaScript parser parse it.
Since `@typescript-eslint/parser` can only parse files with the extension `.tsx` as JSX, it is necessary to temporarily create a `.tsx` file. Temporarily created files will try to be deleted after parses, but if the parsing takes a long time, the files may be visible to you.

See also [`@typescript-eslint/parser` readme](https://github.com/typescript-eslint/typescript-eslint/tree/main/packages/parser#parseroptionsecmafeaturesjsx).

## :hammer_and_wrench: Usage for Custom Rules / Plugins

<!-- - [AST.md](./docs/AST.md) is AST specification. You can check it on the [Online DEMO](https://ota-meshi.github.io/astro-eslint-parser/). -->

- TBA
- You can check the AST in the [Online DEMO](https://ota-meshi.github.io/astro-eslint-parser/). However, AST is subject to major changes in the future.
- I have already [implemented some rules] in the [eslint-plugin-astro]. The source code for these rules will be helpful to you.

## :beers: Contributing

Welcome contributing!

Please use GitHub's Issues/PRs.

## :heart: Supporting

If you are willing to see that this package continues to be maintained, please consider sponsoring me.

[![sponsors](https://img.shields.io/badge/-Sponsor-fafbfc?logo=GitHub%20Sponsors)](https://github.com/sponsors/ota-meshi)

## :lock: License

See the [LICENSE](LICENSE) file for license rights and limitations (MIT).

[Astro]: https://astro.build/
[ESLint]: https://eslint.org/
[eslint-plugin-astro]: https://ota-meshi.github.io/eslint-plugin-astro/
[implemented some rules]: https://ota-meshi.github.io/eslint-plugin-astro/rules/
