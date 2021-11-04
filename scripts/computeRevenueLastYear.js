#!/usr/bin/env node

import fs from "fs";
import path from "path";
import TOML from "@aduh95/toml";

const [, , data_folder, year = (new Date().getUTCFullYear() - 1).toString()] =
  process.argv;

if (!/20\d\d/.test(year))
  throw new Error(
    "Only 21st century is supported (plus year 2000) (except year 2100)."
  );

const getTotalAndCurrency = ({
  reference,
  currency,
  line,
  roundUpTotalToNextInt,
}) => {
  const sum = line.reduce(
    (pv, { unitPrice, quantity }) => pv + unitPrice * quantity,
    0
  );
  return {
    reference,
    currency,
    invoicedTotal: roundUpTotalToNextInt ? Math.ceil(sum) : sum,
  };
};

const filesToCheck = [];
const dir = await fs.promises.opendir(data_folder);
for await (const dirent of dir) {
  if (dirent.name.endsWith(".toml") && dirent.name.startsWith(year.slice(2))) {
    filesToCheck.push(
      fs.promises
        .readFile(path.join(data_folder, dirent.name))
        .then(TOML.parse)
        .then(getTotalAndCurrency)
    );
  }
}

await Promise.allSettled(filesToCheck).then((promises) => {
  const currencies = new Set();
  let total = 0;
  console.log(promises);
  for (const { status, value: result } of promises) {
    if (status === "fulfilled") {
      if (result.currency) currencies.add(result.currency);
      total += result.invoicedTotal;
    }
  }

  if (currencies.size === 0) {
    console.warn("No invoices found for the requested time period.");
  } else if (currencies.size !== 1) {
    console.warn(
      "Warning, it seems you have billed using more than 1 currency"
    );
    console.log(total, currencies);
  } else {
    const [currency] = currencies;
    console.log(total, currency);
  }
});
