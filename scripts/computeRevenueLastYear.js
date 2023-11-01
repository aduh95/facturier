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
  client,
  currency,
  line,
  roundUpTotalToNextInt,
  tax,
}) => {
  const sum = line.reduce(
    (pv, { unitPrice, quantity, outlay }) =>
      pv + unitPrice * (outlay ? 0 : quantity),
    0
  );
  return {
    reference,
    currency,
    country: client.address.at(-1),
    invoicedTotal: roundUpTotalToNextInt ? Math.ceil(sum) : sum,
    tax,
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
        .catch((cause) =>
          Promise.reject(new Error("Cannot parse " + dirent.name, { cause }))
        )
    );
  }
}

await Promise.allSettled(filesToCheck).then((promises) => {
  const currencies = new Set();
  let total = 0;
  let totalVAT = 0;
  const totalPerCountry = { __proto__: null };
  console.log(promises);
  for (const { status, value: result } of promises) {
    if (status === "fulfilled") {
      if (result.currency) currencies.add(result.currency);
      const vat = result.invoicedTotal * (result.tax / 100);
      total += result.invoicedTotal;
      totalVAT += vat;
      totalPerCountry[result.country] ??= { total: 0, vat: 0 };
      totalPerCountry[result.country].total += result.invoicedTotal;
      totalPerCountry[result.country].vat += vat;
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
    const formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    });
    const countryEntries = Object.entries(totalPerCountry);
    if (countryEntries.length !== 1) {
      for (const [country, { total, vat }] of countryEntries) {
        console.log(
          `Sub-total without taxes in ${country}:`,
          formatter.format(total)
        );
        if (vat) {
          console.log(`VAT in ${country}:`, formatter.format(vat));
          console.log(
            `Sub-total with VAT in ${country}:`,
            formatter.format(total + vat)
          );
        }
      }
    }
    console.log(`Total without taxes in ${year}:`, formatter.format(total));
    if (totalVAT) {
      console.log(`VAT in ${year}:`, formatter.format(totalVAT));
      console.log(
        `Total with VAT in ${year}:`,
        formatter.format(total + totalVAT)
      );
    }
  }
});
