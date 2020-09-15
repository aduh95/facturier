import { fileURLToPath } from "url";
import { rollup } from "rollup";

import resolve from "@rollup/plugin-node-resolve";
import sass from "./rollup-plugin-sass.mjs";
import toml from "./rollup-plugin-toml.mjs";

import { SRC_DIR } from "./config.js";

const plugins = [resolve(), sass(), toml()];

let cache;
async function buildWithCache(input) {
  const bundle = await rollup({ input, plugins, cache });
  cache = bundle.cache;

  return bundle;
}

export default () =>
  buildWithCache(fileURLToPath(new URL("./index.js", SRC_DIR))).then((bundle) =>
    bundle.generate({ sourcemap: "hidden", format: "esm" })
  );
