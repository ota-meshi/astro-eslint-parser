/* global MONACO_EDITOR_VERSION -- defined */
async function loadMonaco() {
  if (typeof window !== "undefined") {
    const monacoScript =
      Array.from(document.head.querySelectorAll("script")).find(
        (script) =>
          script.src &&
          script.src.includes("monaco") &&
          script.src.includes("vs/loader"),
      ) || (await appendMonacoEditorScript());
    window.require.config({
      paths: {
        vs: monacoScript.src.replace(/\/vs\/.*$/u, "/vs"),
      },
      "vs/nls": {
        availableLanguages: {
          "*": "ja",
        },
      },
    });
  }
}

function appendMonacoEditorScript() {
  return new Promise((resolve) => {
    const script = document.createElement("script");

    if (typeof MONACO_EDITOR_VERSION !== "undefined") {
      script.src = `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${MONACO_EDITOR_VERSION}/min/vs/loader.min.js`;
    } else {
      script.src = "https://unpkg.com/monaco-editor@latest/min/vs/loader.js";
    }
    script.onload = () => {
      script.onload = null;

      watch();

      function watch() {
        if (window.require) {
          resolve(script);
          return;
        }
        setTimeout(watch, 200);
      }
    };
    document.head.append(script);
  });
}

let loadedMonaco = null;
let editorLoaded = null;

export async function loadMonacoEditor() {
  await (loadedMonaco || (loadedMonaco = loadMonaco()));
  return (
    editorLoaded ||
    (editorLoaded = new Promise((resolve) => {
      if (typeof window !== "undefined") {
        window.require(["vs/editor/editor.main"], (r) => {
          resolve(r);
        });
      }
    }))
  );
}
