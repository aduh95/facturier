#!/usr/bin/env node

import fs from "fs";
import path from "path";
import TOML from "@aduh95/toml";
import { Temporal } from "@js-temporal/polyfill";

const [, , data_folder, refDateFromUser] = process.argv;

if (!data_folder) {
  throw new Error("Missing data_folder");
}

const refDate = refDateFromUser
  ? Temporal.PlainDate.from(refDateFromUser)
  : Temporal.Now.plainDateISO();

const currentQuarterStart = Temporal.PlainDate.from({
  year: refDate.year,
  month: (Math.ceil(refDate.month / 3) - 1) * 3 + 1,
  day: 1,
});
const previousQuarterStart = currentQuarterStart.subtract("P3M");

console.warn({
  refDate,
  previousQuarterStart,
  currentQuarterStart,
});

const doesDateFit = (date) =>
  Temporal.PlainDate.compare(previousQuarterStart, date) !== 1 &&
  Temporal.PlainDate.compare(currentQuarterStart, date) === 1;
const extractDataIfDateFits = ({
  currency,
  date,
  client,
  line,
  reference,
  roundUpTotalToNextInt,
  tax,
}) =>
  doesDateFit(Temporal.PlainDate.from(date?.$__toml_private_datetime))
    ? {
        reference,
        currency,
        sum: line.reduce(
          (pv, { unitPrice, quantity, outlay }) =>
            pv + unitPrice * (outlay ? 0 : quantity),
          0
        ),
        roundUpTotalToNextInt: Boolean(roundUpTotalToNextInt),
        get invoicedTotal() {
          return roundUpTotalToNextInt ? Math.ceil(this.sum) : this.sum;
        },
        tax,
        country: client.address.at(-1),
      }
    : Promise.reject(
        new Error("Date does not fit in the time period.", { cause: reference })
      );

const filesToCheck = [];
const dir = await fs.promises.opendir(data_folder);
for await (const dirent of dir) {
  if (dirent.name.endsWith(".toml")) {
    filesToCheck[
      filesToCheck.push(
        fs.promises
          .readFile(path.join(data_folder, dirent.name))
          .then(TOML.parse)
          .then(extractDataIfDateFits)
          .catch((cause) =>
            Promise.reject(
              cause?.message === "Date does not fit in the time period."
                ? cause
                : new Error("Cannot parse " + dirent.name, { cause })
            )
          )
      ) - 1
      // Empty catch block to avoid unhandled promise rejection crash.
    ].catch(() => {});
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
    console.log(`Total without taxes:`, formatter.format(total));
    if (totalVAT) {
      console.log(`Total VAT:`, formatter.format(totalVAT));
      console.log(`Total with VAT:`, formatter.format(total + totalVAT));
    }
  }
});
