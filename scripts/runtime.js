import { fileURLToPath } from "url";
import { rollup } from "rollup";

import resolve from "@rollup/plugin-node-resolve";
// import sass from "./rollup-plugin-sass.mjs";
import toml from "./rollup-plugin-toml.mjs";

const plugins = [resolve(), /*sass(),*/ toml()];

const INPUT_DIR = new URL("../src/", import.meta.url);

let cache;
async function buildWithCache(input) {
  const bundle = await rollup({ input, plugins, cache });
  cache = bundle.cache;

  return bundle;
}

export default () =>
  buildWithCache(
    fileURLToPath(new URL("./index.js", INPUT_DIR))
  ).then((bundle) => bundle.generate({ sourcemap: "hidden", format: "esm" }));
