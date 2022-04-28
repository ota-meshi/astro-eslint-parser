"use strict"

module.exports = {
    extends: [
        require.resolve("./.eslintrc.js"),
    ],
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
