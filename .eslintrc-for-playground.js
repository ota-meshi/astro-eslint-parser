"use strict"

module.exports = {
    extends: [
        require.resolve("./.eslintrc.js"),
    ],
    parserOptions: {
        sourceType: "module",
        ecmaVersion: 2022,
        parser: "@typescript-eslint/parser",
    },
    overrides: [
        {
            files: ["*.astro"],
            parser: require.resolve("."),
            rules: {
                "prettier/prettier": "off"
            }
        },
    ],
}
