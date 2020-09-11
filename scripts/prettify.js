import { createReadStream, createWriteStream, promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createInterface as readLines } from "readline";

import TOMLPrettifier from "@aduh95/toml-prettifier";

/**
 * Prettifies a TOML file.
 * @param {string | URL | Buffer} inputFilePath
 */
export async function prettifyTOMLFile(inputFilePath) {
  // Create a temporary file to write the prettified TOML.
  const tmpFile = join(tmpdir(), "pretty-");
  const writer = createWriteStream(tmpFile);

  // Read the input file line by line.
  const reader = readLines({
    input: createReadStream(inputFilePath),
    crlfDelay: Infinity,
  });

  // Pass the input to TOMLPrettifier.
  for await (const line of TOMLPrettifier(reader)) {
    // Write the output to the temp file.
    writer.write(line + "\n");
  }
  // Close the temp file once filled up.
  writer.end();

  // Replace the input file by the temp file.
  await fs.rename(tmpFile, inputFilePath);
}

await prettifyTOMLFile(process.argv[2]);
