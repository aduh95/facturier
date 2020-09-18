import process from "process";
import { existsSync, promises as fs } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

import { LANG_DIR } from "./config.js";

const GET_LANG_FROM_LOCALE = /\n\s*locale\s*=\s*["']{1,3}([a-z]{2})-/;

export async function getLangFromCurrentInvoice() {
  const invoiceContent = await fs.readFile(getInvoiceFilePath(), "utf8");
  const [, lang] = invoiceContent.match(GET_LANG_FROM_LOCALE) ?? [];

  if (lang === undefined) {
    throw new Error(
      `No locale found in '${getInvoiceFilePath()}'.\n` +
        "\n" +
        "You must specify a locale using an IETF BCP 47 language tag. " +
        " Example:\n" +
        '  locale = "en-US"\n'
    );
  }
  return fileURLToPath(new URL(lang + ".toml", LANG_DIR));
}

let invoicePathCache;
export function getInvoiceFilePath() {
  if (invoicePathCache) return invoicePathCache;

  if (typeof process.argv[2] !== "string") {
    throw new Error("You must specify an invoice file as argument.");
  }
  invoicePathCache = resolve(process.argv[2]);
  if (!existsSync(invoicePathCache) || !invoicePathCache.endsWith(".toml")) {
    process.emitWarning(
      new Error(
        `The invoice file should be a valid TOML file. Received '${invoicePathCache}'.`
      )
    );
  }
  return invoicePathCache;
}
