#!/usr/bin/env node

import puppeteer from "puppeteer";

const xeEndpoint = new URL("https://www.xe.com/currencyconverter/convert/");
xeEndpoint.searchParams.set("Amount", 1);

export default async function getExchangeRate(from, to) {
  if (process.env.EXCHANGE_RATE) return process.env.EXCHANGE_RATE;

  xeEndpoint.searchParams.set("From", from);
  xeEndpoint.searchParams.set("To", to);

  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();

    await page.goto(xeEndpoint);
    const rate = await page.waitForSelector("p[class^='result__BigRate']");

    return parseFloat(await rate.evaluate((rate) => rate.textContent), 10);
  } finally {
    await browser.close();
  }
}
