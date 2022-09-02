<script>
  import { onDestroy, onMount } from "svelte";
  import { Linter } from "eslint";
  import pluginReact from "eslint-plugin-react";
  import * as astroEslintParser from "astro-eslint-parser";
  import ESLintEditor from "./ESLintEditor.svelte";
  import RulesSettings from "./RulesSettings.svelte";
  import { deserializeState, serializeState } from "./scripts/state";
  import { DEFAULT_RULES_CONFIG, getURL } from "./scripts/rules.js";

  let linter = null;
  let tsParser;

  async function setupLinter() {
    tsParser = await import("@typescript-eslint/parser");
    const linter = new Linter();
    linter.defineParser("astro-eslint-parser", astroEslintParser);
    for (const [id, rule] of Object.entries(pluginReact.rules)) {
      linter.defineRule(`react/${id}`, rule);
    }
    if (typeof globalThis.process === "undefined") {
      globalThis.process = {};
    }
    if (!process.env) {
      process.env = {};
    }
    if (!process.cwd) {
      process.cwd = () => "/";
    }
    return linter;
  }

  if (typeof window !== "undefined") {
    linter = astroEslintParser.setup().then(() => setupLinter());
  } else {
    linter = setupLinter();
  }

  const DEFAULT_CODE = `---
let a = 1;
let b = 2;
// let c = 2;
---

<p>{a} + {b} + {c} = {a + b + c}</p>`;
  const DEFAULT_FILE_PATH = "Example.astro";

  const state = deserializeState(
    (typeof window !== "undefined" && window.location.hash.slice(1)) || ""
  );
  let code = state.code || DEFAULT_CODE;
  let rules = state.rules || Object.assign({}, DEFAULT_RULES_CONFIG);
  let messages = [];
  let time = "";
  let options = {};
  let filePath = state.filePath || DEFAULT_FILE_PATH;

  $: {
    options = {};
  }
  // eslint-disable-next-line no-use-before-define -- false positive
  $: serializedString = (() => {
    const serializeCode = DEFAULT_CODE === code ? undefined : code;
    const serializeRules = equalsRules(DEFAULT_RULES_CONFIG, rules)
      ? undefined
      : rules;
    const serializeFilePath =
      filePath === DEFAULT_FILE_PATH ? undefined : filePath;
    return serializeState({
      code: serializeCode,
      rules: serializeRules,
      filePath: serializeFilePath,
    });
  })();
  $: {
    if (typeof window !== "undefined") {
      window.location.replace(`#${serializedString}`);
    }
  }
  onMount(() => {
    if (typeof window !== "undefined") {
      window.addEventListener("hashchange", onUrlHashChange);
    }
  });
  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("hashchange", onUrlHashChange);
    }
  });
  function onLintedResult(evt) {
    messages = evt.detail.messages;
    time = `${evt.detail.time}ms`;
  }
  function onUrlHashChange() {
    const newSerializedString =
      (typeof window !== "undefined" && window.location.hash.slice(1)) || "";
    if (newSerializedString !== serializedString) {
      const state = deserializeState(newSerializedString);
      code = state.code || DEFAULT_CODE;
      rules = state.rules || Object.assign({}, DEFAULT_RULES_CONFIG);
    }
  }

  /** */
  function equalsRules(a, b) {
    const akeys = Object.keys(a).filter((k) => a[k] !== "off");
    const bkeys = Object.keys(b).filter((k) => b[k] !== "off");
    if (akeys.length !== bkeys.length) {
      return false;
    }

    for (const k of akeys) {
      if (a[k] !== b[k]) {
        return false;
      }
    }
    return true;
  }
</script>

<div class="playground-root">
  <div class="playground-tools">
    <label style="margin-left: 16px"
      >FileName<input bind:value={filePath} /></label
    >
    <span style="margin-left: 16px">{time}</span>
  </div>
  <div class="playground-content">
    <RulesSettings bind:rules />
    <div class="editor-content">
      <ESLintEditor
        {linter}
        bind:code
        {filePath}
        config={{
          parser: "astro-eslint-parser",
          parserOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
            parser: tsParser,
          },
          rules,
          env: {
            browser: true,
            es2021: true,
          },
          settings: {
            react: {
              version: "999.999.999",
            },
          },
        }}
        {options}
        on:result={onLintedResult}
      />
      <div class="messages">
        <ol>
          {#each messages as msg, i (`${msg.line}:${msg.column}:${msg.ruleId}@${i}`)}
            <li class="message">
              [{msg.line}:{msg.column}]:
              {msg.message} (<a href={getURL(msg.ruleId)} target="_blank">
                {msg.ruleId}
              </a>)
            </li>
          {/each}
        </ol>
      </div>
    </div>
  </div>
</div>

<style>
  .playground-root {
    height: 100%;
  }
  .playground-tools {
    height: 24px;
  }
  .playground-content {
    display: flex;
    flex-wrap: wrap;
    height: calc(100% - 16px);
    border: 1px solid #cfd4db;
    background-color: #282c34;
    color: #f8c555;
  }

  .playground-content > .editor-content {
    height: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    border-left: 1px solid #cfd4db;
    min-width: 1px;
  }

  .playground-content > .editor-content > .messages {
    height: 30%;
    width: 100%;
    overflow: auto;
    box-sizing: border-box;
    border-top: 1px solid #cfd4db;
    padding: 8px;
    font-size: 12px;
  }
</style>
