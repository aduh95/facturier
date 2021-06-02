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

const emailTableHeader = /^\s*\[email\]/;
const convertToCurrency = /^\s*convertToCurrency\s*=\s*["']([A-Z]+)["']/;
const currencyToConvertFrom = /(?<=^\s*currency\s*=\s*["'])[A-Z]+/;
const unitPriceToConvert = /(?<=^\s*unitPrice\s*=\s)\d+(?:\.\d+)?/;
let exchangeRate;

function convertCurrency(line, currencyToConvertTo) {
  if (currencyToConvertTo == null) return line;

  if (exchangeRate == null) {
    const match = currencyToConvertFrom.exec(line);
    if (match !== null) {
      exchangeRate = 0.82; // hardcoded value for USD -> EUR
      console.log(
        `Converting from ${match[0]} to ${currencyToConvertTo} at rate of ${exchangeRate}`
      );
      return (
        line.replace(currencyToConvertFrom, currencyToConvertTo) +
        `# Converted from ${match[0]} at rate of ${exchangeRate}.`
      );
    }
  }

  const match = unitPriceToConvert.exec(line);
  if (match == null) return line;

  if (exchangeRate == null) throw new Error("Unknown exchange rate");

  return line.replace(unitPriceToConvert, Number(match[0]) * exchangeRate);
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

  let sendEmail = false;
  let currencyToConvertTo;

  for await (const line of sed(input, ref, date)) {
    if (emailTableHeader.test(line)) sendEmail = true;

    if (currencyToConvertTo == null) {
      const match = convertToCurrency.exec(line);
      if (match) {
        currencyToConvertTo = match[1];
        continue;
      }
    }

    await new Promise((resolve, reject) =>
      output.write(convertCurrency(line, currencyToConvertTo) + "\n", (err) =>
        err ? reject(err) : resolve()
      )
    );
  }

  await new Promise((resolve, reject) => {
    console.log("Building PDF file…");
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

  if (sendEmail) {
    console.log("Sending the email…");
    await new Promise((resolve, reject) => {
      const child_process = spawn(
        process.argv0,
        [fileURLToPath(new URL("./sendEmail.js", import.meta.url)), outputPath],
        {
          stdio: ["inherit", "inherit", "inherit"],
        }
      );
      child_process.on("error", reject);
      child_process.on("exit", (code) =>
        code
          ? reject(
              new Error(`sendEmail script exited with error code: ${code}`)
            )
          : resolve()
      );
    });
  }

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
