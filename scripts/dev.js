import { watch, promises as fs } from "fs";

import { PORT_NUMBER, startServer, refreshBrowser } from "./server.js";
import { getInvoiceFilePath } from "./get-invoice-info.js";

import { LANG_DIR, SRC_DIR } from "./config.js";

function watcher(event, fileName) {
  console.log(event, fileName);
  refreshBrowser();
}

const watchFile = (path) => watch(path, watcher);
const watchDir = (dir) =>
  fs.readdir(dir).then((files) =>
    Promise.all(
      files
        .filter(
          (fileName) =>
            !fileName.endsWith(".toml.d.ts") && !fileName.endsWith(".toml.js")
        )
        .map((file) => new URL(file, dir))
        .map((path) =>
          fs
            .stat(path)
            .then((stats) =>
              stats.isDirectory()
                ? watchDir(new URL(`${path}/`))
                : watchFile(path)
            )
        )
    )
  );

await Promise.all([
  watchDir(SRC_DIR),
  watchDir(LANG_DIR),
  watchFile(getInvoiceFilePath()),
]);
await startServer();
console.log(`Server started on http://localhost:${await PORT_NUMBER}`);
