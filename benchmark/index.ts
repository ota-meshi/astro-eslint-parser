import * as Benchmark from "benchmark";
import fs from "fs";
import { parseForESLint } from "../src/index";
import { parseForESLint as parseOld } from "../node_modules/astro-eslint-parser";

const contents = `${fs.readFileSync(
  require.resolve("../tests/fixtures/parser/ast/withastro/astro.build/src/components/landing/Sponsors-input.astro"),
  "utf-8",
)}`;

type Result = { name: string; hz: number };
const results: Result[] = [];

function format(hz: number): string {
  return (~~(hz * 100) / 100).toString().padEnd(4, " ").padStart(6, " ");
}

function onCycle(event: { target: Result }): void {
  const { name, hz } = event.target;
  results.push({ name, hz });

  console.log(event.target.toString());
}

function onComplete(): void {
  console.log("-".repeat(72));
  const map: Record<string, number[]> = {};
  for (const result of results) {
    const r = (map[result.name.slice(2)] ??= []);
    r.push(result.hz);
  }
  for (const name of Object.keys(map)) {
    console.log(
      `${name.padEnd(15)} ${format(
        map[name].reduce((p, a) => p + a, 0) / map[name].length,
      )} ops/sec`,
    );
  }
  for (let i = 0; i < results.length; ++i) {
    const result = results[i];

    console.log(`${result.name.padEnd(15)} ${format(result.hz)} ops/sec`);
  }
}

const suite = new Benchmark.Suite("benchmark", { onCycle, onComplete });

for (const no of [1, 2, 3]) {
  suite.add(`${no} new   astro-eslint-parser`, function () {
    parseForESLint(contents, {
      loc: true,
      range: true,
      raw: true,
      tokens: true,
      comment: true,
      eslintVisitorKeys: true,
      eslintScopeManager: true,
    });
  });
  suite.add(`${no} old   astro-eslint-parser`, function () {
    parseOld(contents, {
      loc: true,
      range: true,
      raw: true,
      tokens: true,
      comment: true,
      eslintVisitorKeys: true,
      eslintScopeManager: true,
    });
  });
}

suite.run();
