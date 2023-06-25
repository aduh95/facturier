import * as sass from "sass";

const PLUGIN_HELPER = "sass-plugin:createStyleElement";

function createStyleElement(css, id) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  style.dataset.file = id;
  return style;
}

export default function plugin() {
  return {
    name: "sass",
    resolveId(source) {
      if (source === PLUGIN_HELPER) return { id: PLUGIN_HELPER, moduleSideEffects: true }
    },
    load(id) {
      if (id === PLUGIN_HELPER) {
        return `export default ${createStyleElement};`;
      } else if (id.endsWith(".scss")) {
        return new Promise((resolve, reject) =>
          sass.render(
            {
              file: id,
              sourceMap: "true",
              sourceMapEmbed: true,
            },
            (err, result) => (err ? reject(err) : resolve(result))
          )
        ).then(
          ({ css }) =>
            `import helper from "${PLUGIN_HELPER}";export default helper(\`${css
              .toString()
              .replace("`", "\\`")}\`,"${id.replace('"', '\\"')}")`
        );
      }
    },
  };
}
