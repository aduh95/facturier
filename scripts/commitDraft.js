#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import * as readline from "node:readline/promises";
import { argv, stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";

import { findNextReference } from "./findNextReference.js";
import { getInvoiceFilePath } from "./get-invoice-info.js";
import safeCurrencyMultiplication from "./safeCurrencyMultiplication.js";

const [, , , cliFlag] = argv;

if (cliFlag === "--help" || cliFlag === "-h") {
  console.log("Usage:");
  console.log(
    "\t$0 path/to/invoice.toml",
    "\tBuild the invoice, sends the email if setup"
  );
  console.log(
    "\t$0 path/to/invoice.toml --open-pdf",
    "\tSame as above, but try to open the PDF (might not work on Windows)"
  );
  process.exit();
}

async function* sed(input, ref, date) {
  for await (const line of input) {
    if (line.includes('reference = "REPLACEME"')) {
      yield `reference = "${ref}"`;
    } else if (line.includes('date = "REPLACEME"')) {
      yield `date = ${date}`;
    } else if (/^\s*pending(UnitPrice|Quantity)\s*=/.test(line)) {
      yield line.replace(/pending[A-Z]/, (s) => s.charAt(7).toLowerCase());
    } else yield line;
  }
}

const emailTableHeader = /^\s*\[email\]/;
const convertToCurrency = /^\s*convertToCurrency\s*=\s*["']([A-Z]+)["']/;
const currencyToConvertFrom = /(?<=^\s*currency\s*=\s*["'])[A-Z]+/;
const unitPriceToConvert = /(?<=^\s*unitPrice\s*=\s)\d+(?:\.\d+)?/;
let exchangeRate;

async function convertCurrency(line, currencyToConvertTo) {
  if (currencyToConvertTo == null) return line;

  if (exchangeRate == null) {
    const match = currencyToConvertFrom.exec(line);
    if (match !== null) {
      const converter = await import("./get-exchange-rate.js");
      exchangeRate = await converter.default(match[0], currencyToConvertTo);
      console.log(
        `Converting from ${match[0]} to ${currencyToConvertTo} at rate of ${exchangeRate}`
      );
      return (
        line.replace(currencyToConvertFrom, currencyToConvertTo) +
        ` # Converted from ${match[0]} at rate of ${exchangeRate}.`
      );
    }
  }

  const match = unitPriceToConvert.exec(line);
  if (match == null)
    return line.replace(/^(\s*)finalU(nitPrice\s*=\s)/, "$1u$2");

  if (exchangeRate == null) throw new Error("Unknown exchange rate");

  return line.replace(
    unitPriceToConvert,
    safeCurrencyMultiplication(match[0], exchangeRate)
  );
}
try {
  const inputPath = getInvoiceFilePath();

  const now = new Date();
  const dir = path.dirname(inputPath);
  const date = now.toISOString().substring(0, 10);
  const ref = findNextReference(dir, date.substring(2, 4));

  const inputFile = await fs.promises.open(inputPath, "r");
  const input = inputFile.readLines();
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

    await convertCurrency(line, currencyToConvertTo).then(
      (line) =>
        new Promise((resolve, reject) =>
          output.write(line + "\n", (err) => (err ? reject(err) : resolve()))
        )
    );
  }

  await new Promise((resolve, reject) => {
    console.log("Building PDF file…");
    const child_process = spawn(
      process.execPath,
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

  if (cliFlag === "--open-pdf") {
    spawn("open", [outputPath.replace(/\.toml$/, ".pdf")], {
      stdio: "ignore",
      detached: true,
    });
  }

  {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const allowedAnswers = ["", "Y", "y", "N", "n"];

    try {
      let answer;
      do {
        answer = await rl.question("PTAL. Do you want to continue? [Y/n] ");
      } while (!allowedAnswers.includes(answer));

      if (answer === "N" || answer === "n") {
        do {
          answer = await rl.question(
            "Do you want to clean up temp files? [Y/n] "
          );
        } while (!allowedAnswers.includes(answer));

        if (answer !== "N" && answer !== "n") {
          await fs.promises.rm(outputPath);
          await fs.promises.rm(outputPath.replace(/\.toml$/, ".pdf"));
        }
        throw new Error("User requested changes");
      }
    } finally {
      rl.close();
    }
  }

  if (sendEmail) {
    console.log("Sending the email…");
    await new Promise((resolve, reject) => {
      const child_process = spawn(
        process.execPath,
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
    const child_process = spawn("git", ["push"], {
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
