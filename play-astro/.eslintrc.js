module.exports = {
    extends: [require.resolve("../.eslintrc.js")],
    plugins: ["react"],
    parserOptions: {
        sourceType: "module",
        ecmaVersion: 2022,
        parser: "@typescript-eslint/parser",
    },
    overrides: [
        {
            files: ["*.astro"],
            extends: ["plugin:react/recommended", "plugin:react/jsx-runtime"],
            parser: require.resolve(".."),
            rules: {
                "prettier/prettier": "off",
                "react/jsx-equals-spacing": "error",

                // Incompatible rules
                "react/no-unknown-property": "off",
            },
            settings: {
                react: {
                    version: "16.3",
                },
            },
        },
    ],
}
