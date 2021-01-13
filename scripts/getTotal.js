#!/usr/bin/env node
import fs from "fs";

import TOML from "@aduh95/toml";
import { getInvoiceFilePath } from "./get-invoice-info.js";

const { line, currency } = TOML.parse(
  fs.readFileSync(getInvoiceFilePath()).toString()
);

console.log(
  line?.length
    ? line.reduce((pv, { unitPrice, quantity }) => pv + unitPrice * quantity, 0)
    : 0,
  currency
);
