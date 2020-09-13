import { html } from "htm/preact";

import Header from "./Header.js";
import InvoiceContent from "./InvoiceContent.js";
import Footer from "./Footer.js";

function createIntlFormatters({ locale, currency }) {
  return Object.fromEntries(
    ["currency", "percent"].map((style) => {
      const formatter = new Intl.NumberFormat(locale, {
        currency,
        style,
      });
      return [style, formatter.format.bind(formatter)];
    })
  );
}

export default function Invoice(props) {
  const tax = props.tax / 100;
  let subtotal = 0;
  for (const { unitPrice, quantity } of props.line) {
    subtotal += unitPrice * quantity;
  }
  const total = subtotal * (1 + tax);
  const childProps = {
    ...props,
    tax,
    subtotal,
    total,
    totalDue: total - props.prepaid,
    format: createIntlFormatters(props),
  };
  return html`
    <${Header} ...${childProps} />
    <${InvoiceContent} ...${childProps} />
    <${Footer} ...${childProps} />
  `;
}
