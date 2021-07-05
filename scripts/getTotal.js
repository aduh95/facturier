#!/usr/bin/env node
import fs from "fs";

import TOML from "@aduh95/toml";
import { getInvoiceFilePath } from "./get-invoice-info.js";

const { client, currency, line, prepaid, tax, hourlyRate } = TOML.parse(
  fs.readFileSync(getInvoiceFilePath())
);

console.log("Invoiced to", client?.name);

const total = line?.length
  ? line.reduce((pv, { unitPrice, quantity }) => pv + unitPrice * quantity, 0)
  : 0;

console.log("Total without tax", total, currency);
console.log("Balance incl. tax", total * (1 - tax) - prepaid, currency);

if (hourlyRate) {
  const { rate, nbOfDaysOff, targetedNbOfWorkHourPerDay } = hourlyRate;
  const nbOfHours = total / rate;
  console.log("\nIt looks like this invoice has an hourly rate:");
  console.log("Number of hours: ", nbOfHours);
  console.log(
    "Assuming you are sending invoice at monthly basis, working 5 days a week:"
  );

  const now = new Date();
  let nbOfWorkDay = -nbOfDaysOff;
  for (let i = 1; i <= now.getDate(); i++) {
    if (new Date(now.getUTCFullYear(), now.getMonth(), i).getDay() % 6) {
      nbOfWorkDay++;
    }
  }
  if (nbOfDaysOff !== 0) {
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
