#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { google } from "googleapis";

import TOML from "@aduh95/toml";
import { getInvoiceFilePath } from "./get-invoice-info.js";
import assert from "node:assert";
import { authorize } from "./googleAPI.js";

const [, , , year = (new Date().getUTCFullYear() - 1).toString()] = process.argv;

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];
const API = "sheets.googleapis.com";

const draftContent = fs.readFileSync(getInvoiceFilePath());
const { email, client, working_days, line: {0: {description, quantity}} } = TOML.parse(draftContent);
const user_data_dir = path.dirname(getInvoiceFilePath());
const { name } = TOML.parse(fs.readFileSync(path.join(user_data_dir, 'biller.toml')));


/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function readSheet(auth, spreadsheetId, range) {
  const sheets = google.sheets({ version: "v4", auth });
  // Do the magic
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  let count = 0;
  for(const row of response.data.values) {
    assert.strictEqual(row[2], name);
    count += row.filter(cell => cell === 'Working').length / 2;
  }
  return count;
}



const promises = [
  authorize(email.from, SCOPES, API)
    .then(auth => readSheet(auth, working_days.sheetID, working_days.range))
];

for await(const dirent of await fs.promises.opendir(user_data_dir)) {
    if (dirent.isDirectory() || !dirent.name.endsWith('.toml') || !dirent.name.startsWith(year % 100)) {
        continue;
    }
    promises.push(fs.promises.readFile(path.join(user_data_dir, dirent.name)).then(TOML.parse).then(({client:c, line}) =>{
        if (c.name !== client.name) return 0;
        assert.strictEqual(line[0]?.description, description);
        return line[0].quantity;
    }));
}

const [daysWorked, ...dayAlreadyInvoiced] = await Promise.all(promises);
const daysAlreadyInvoiced = dayAlreadyInvoiced.reduce((current, sum) => current + sum, 0);
const diff = daysWorked - daysAlreadyInvoiced

console.log({daysWorked, daysAlreadyInvoiced, diff, quantityInDraft: quantity})

if (diff !== quantity) {
    console.log(`Updating ${getInvoiceFilePath()}...`);
    const draft = draftContent.toString('utf-8');
    const needle = `
[[line]]
description = ${JSON.stringify(description)}
unitPrice =`;
    const index = draft.indexOf(needle);
    assert.notStrictEqual(index, -1);
    const startNeedle = `\nquantity = `;
    const startIndex = draft.indexOf(`${startNeedle}${quantity}\n`, index + needle.length);
    assert.notStrictEqual(startIndex, -1);
    fs.writeFileSync(getInvoiceFilePath(), `${draft.slice(0, startIndex+startNeedle.length)}${diff}${draft.slice(startIndex+startNeedle.length+quantity.toString().length)}`);
}

