#!/usr/bin/env node
// Usage: yarn total <TOML-file> [<date>]
import fs from "fs";
import process from "process";

import TOML from "@aduh95/toml";
import { getInvoiceFilePath } from "./get-invoice-info.js";

const {
  client,
  currency,
  date,
  line,
  prepaid,
  roundUpTotalToNextInt,
  tax,
  hourlyRate,
} = TOML.parse(fs.readFileSync(getInvoiceFilePath()));

if (date === "REPLACEME") {
  console.log("Draft invoice for", client?.name);
} else if (typeof date === "object") {
  console.log("Invoiced to", client?.name, "on", date.$__toml_private_datetime);
}

const total = line?.length
  ? line.reduce(
      (pv, { unitPrice = 0, quantity = 0 }) => pv + unitPrice * quantity,
      0
    )
  : 0;
const totalWithTaxes = total * (1 - tax) - prepaid;

console.log("Total without tax", total, currency);
console.log(
  "Balance incl. tax",
  roundUpTotalToNextInt ? Math.ceil(totalWithTaxes) : totalWithTaxes,
  currency,
  { roundUpTotalToNextInt }
);

if (hourlyRate) {
  const { nbOfDaysOff, targetedNbOfWorkHourPerDay } = hourlyRate;
  const nbOfHours = line.reduce(
    (pv, { quantity = 0, hourFactor = 1 }) => pv + hourFactor * quantity,
    0
  );
  console.log("\nThe invoice contains hourly rate flag.");
  console.log("Number of hours: ", nbOfHours);

  const now = process.argv[3]
    ? new Date(process.argv[3])
    : date === "REPLACEME"
    ? new Date()
    : new Date(date.$__toml_private_datetime);
  let nbOfWorkDay = -nbOfDaysOff;
  for (let i = 1; i <= now.getDate(); i++) {
    if (new Date(now.getUTCFullYear(), now.getMonth(), i).getDay() % 6) {
      nbOfWorkDay++;
    }
  }
  if (nbOfWorkDay !== 0) {
    console.log(
      "Assuming you are sending invoice at monthly basis, working 5 days a week:"
    );
    console.log(
      "Number of work hours per week:",
      (nbOfHours / nbOfWorkDay) * 5
    );
    console.log(
      "Number of hours you need to work to meet target of today:",
      targetedNbOfWorkHourPerDay * nbOfWorkDay - nbOfHours
    );
  }
}
