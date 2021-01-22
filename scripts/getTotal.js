#!/usr/bin/env node
import fs from "fs";

import TOML from "@aduh95/toml";
import { getInvoiceFilePath } from "./get-invoice-info.js";

const { client, currency, line, prepaid, tax } = TOML.parse(
  fs.readFileSync(getInvoiceFilePath())
);

console.log("Invoiced to", client?.name);

const total = line?.length
  ? line.reduce((pv, { unitPrice, quantity }) => pv + unitPrice * quantity, 0)
  : 0;

console.log("Total without tax", total, currency);
console.log("Balance incl. tax", total * (1 - tax) - prepaid, currency);
