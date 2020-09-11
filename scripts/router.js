import { createReadStream } from "fs";

import buildRuntimeJS from "./runtime.js";

const HTML_TEMPLATE_FILE = new URL("./template.html", import.meta.url);

const showErrorOnBrowser = function (errorMessage) {
  const d = document.createElement("dialog");
  const h = document.createElement("h2");
  h.append("Bundling error");
  const p = document.createElement("code");
  p.style.whiteSpace = "pre-wrap";
  p.style.border = "1px solid";
  p.style.display = "block";
  p.style.padding = ".5em";
  p.style.backgroundColor = "lightgray";
  p.append(errorMessage);
  d.append(h, p, "See console for more details.");
  document.body.append(d);
  d.showModal();
};

export default async function router(req, res) {
  switch (req.url) {
    case "/":
      res.setHeader("Content-Type", "text/html");
      createReadStream(HTML_TEMPLATE_FILE).pipe(res);
      return;

    case "/script.js":
      res.setHeader("Content-Type", "application/javascript");
      return buildRuntimeJS()
        .then(({ output }) => {
          const [{ code, map }] = output;
          res.write(code);

          // Appends Source map to help debugging
          delete map.sourcesContent;
          res.write("\n//# sourceMappingURL=data:application/json,");
          res.end(encodeURI(JSON.stringify(map)));
        })
        .catch((e) => {
          console.error(e);
          res.statusCode = 206;
          res.end(
            `(${showErrorOnBrowser.toString()})(${JSON.stringify(e.message)})`
          );
        });

    default:
      res.statusCode = 404;
      res.end(`Cannot find '${req.url}' on this server.`);
  }
}
