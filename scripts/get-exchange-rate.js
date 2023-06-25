#!/usr/bin/env node

import puppeteer from "puppeteer";

const xeEndpoint = new URL("https://www.xe.com/currencyconverter/convert/");
xeEndpoint.searchParams.set("Amount", 1);

export default async function getExchangeRate(from, to) {
  if (process.env.EXCHANGE_RATE) return process.env.EXCHANGE_RATE;

  xeEndpoint.searchParams.set("From", from);
  xeEndpoint.searchParams.set("To", to);

  const browser = await puppeteer.launch({ headless: "new" });
  try {
    const page = await browser.newPage();

    await page.goto(xeEndpoint);
    const rate = await page.waitForSelector("p[class^='result__BigRate']");

    const rateAsStr = await rate.evaluate((rate) => rate.textContent);
    const nonDecimalChar = /[^\d.]/.exec(rateAsStr);
    return nonDecimalChar
      ? rateAsStr.slice(0, nonDecimalChar.index)
      : rateAsStr;
  } finally {
    await browser.close();
  }
}
