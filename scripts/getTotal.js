#!/usr/bin/env node
import fs from "fs";

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

const _total = line?.length
  ? line.reduce((pv, { unitPrice, quantity }) => pv + unitPrice * quantity, 0)
  : 0;
const total = roundUpTotalToNextInt ? Math.ceil(_total) : _total;

console.log("Total without tax", total, currency);
console.log("Balance incl. tax", total * (1 - tax) - prepaid, currency);

if (date === "REPLACEME" && hourlyRate) {
  const { rate, nbOfDaysOff, targetedNbOfWorkHourPerDay } = hourlyRate;
  const nbOfHours = total / rate;
  console.log(
    "\nIt looks like this invoice is on going and has an hourly rate:"
  );
  console.log("Number of hours: ", nbOfHours);

  const now = new Date();
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
