import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { createInterface as readline } from "readline";
import { findNextReference } from "./findNextReference.js";

import { getInvoiceFilePath } from "./get-invoice-info.js";
import { fileURLToPath } from "url";

async function* sed(input, ref, date) {
  for await (const line of input) {
    if (line.includes('reference = "REPLACEME"')) {
      yield `reference = "${ref}"`;
    } else if (line.includes('date = "REPLACEME"')) {
      yield `date = ${date}`;
    } else yield line;
  }
}
try {
  const inputPath = getInvoiceFilePath();

  const now = new Date();
  const dir = path.dirname(inputPath);
  const date = now.toISOString().substring(0, 10);
  const ref = findNextReference(dir, date.substring(2, 4));

  const input = readline(fs.createReadStream(inputPath));
  const outputPath = path.join(dir, ref + ".toml");
  const output = fs.createWriteStream(outputPath);

  for await (const line of sed(input, ref, date))
    await new Promise((resolve, reject) =>
      output.write(line + "\n", (err) => (err ? reject(err) : resolve()))
    );

  await new Promise((resolve, reject) => {
    const child_process = spawn(
      process.argv0,
      [fileURLToPath(new URL("./build.js", import.meta.url)), outputPath],
      {
        stdio: ["ignore", "inherit", "inherit"],
      }
    );
    child_process.on("error", reject);
    child_process.on("exit", (code) =>
      code
        ? reject(new Error(`Build script exited with error code: ${code}`))
        : resolve()
    );
  });

  await new Promise((resolve, reject) => {
    const child_process = spawn("git", ["add", `${ref}.*`], {
      stdio: ["ignore", "inherit", "inherit"],
      cwd: dir,
    });
    child_process.on("error", reject);
    child_process.on("exit", (code) =>
      code
        ? reject(new Error(`"git add" exited with error code: ${code}`))
        : resolve()
    );
  });

  await new Promise((resolve, reject) => {
    const child_process = spawn("git", ["commit", "-m", ref], {
      stdio: ["ignore", "inherit", "inherit"],
      cwd: dir,
    });
    child_process.on("error", reject);
    child_process.on("exit", (code) =>
      code
        ? reject(new Error(`"git commit" exited with error code: ${code}`))
        : resolve()
    );
  });

  await new Promise((resolve, reject) => {
    const child_process = spawn("git", ["push", "origin", "HEAD:main"], {
      stdio: ["inherit", "inherit", "inherit"],
      cwd: dir,
    });
    child_process.on("error", reject);
    child_process.on("exit", (code) =>
      code
        ? reject(new Error(`"git push" exited with error code: ${code}`))
        : resolve()
    );
  });
} catch (reason) {
  console.error("Failed because of reason", reason);
}
