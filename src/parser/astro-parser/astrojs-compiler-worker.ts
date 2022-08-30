import { runAsWorker } from "synckit";

const dynamicImport = new Function("m", "return import(m)");
runAsWorker(async (source) => {
  const { parse } = await dynamicImport("@astrojs/compiler");
  // console.time("parse")
  const result = parse(source);
  // console.timeEnd("parse")
  return result;
});
