#!/usr/bin/env node
import puppeteer from "puppeteer";

import { startServer, PORT_NUMBER } from "./server.js";
import { getInvoiceFilePath } from "./get-invoice-info.js";

process.env.NODE_ENV = "production";
const path = getInvoiceFilePath().replace(/\.toml$/, ".pdf");

const closeServer = startServer();

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();

await page.goto(`http://localhost:${await PORT_NUMBER}/`, 
{ waitUntil: 'networkidle2' });

await page.pdf({
  path,
  printBackground: false,
  preferCSSPageSize: true,
});
await page.close();

await Promise.all([browser.close(), closeServer()]);

console.log("PDF created at", path);
