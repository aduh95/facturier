import { watch, promises as fs } from "fs";
import { startServer, refreshBrowser } from "./server.js";

const INPUT_DIR = new URL("../", import.meta.url);
const excluded = [".git", "node_modules"];

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
            !fileName.endsWith(".toml.d.ts") &&
            !fileName.endsWith(".toml.js") &&
            !excluded.includes(fileName)
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

watchDir(INPUT_DIR)
  .then(() => startServer())
  .catch(console.error);
