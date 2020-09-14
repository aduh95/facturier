import { promises as fs } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const STRING_DIR = new URL("../lang/", import.meta.url);

const GET_LANG_FROM_LOCALE = /locale\s*=\s*["']{1,3}([a-z]{2})-/;
export const INVOICE_FILE_PATH = resolve(process.argv[2]);

export async function getLangFromCurrentInvoice() {
  const invoiceContent = await fs.readFile(INVOICE_FILE_PATH, "utf8");
  const [, lang] = invoiceContent.match(GET_LANG_FROM_LOCALE);
  return fileURLToPath(new URL(lang + ".toml", STRING_DIR));
}
