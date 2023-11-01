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
  let subtotalOutlays = 0;
  for (const { unitPrice, pendingQuantity, quantity, outlay } of props.line) {
    const totalLine = unitPrice * (pendingQuantity ?? quantity);
    if (outlay) subtotalOutlays += totalLine;
    else subtotal += totalLine;
  }
  const _total = subtotal * (1 + tax) + subtotalOutlays;
  const total = props.roundUpTotalToNextInt ? Math.ceil(_total) : _total;
  const childProps = {
    ...props,
    tax,
    subtotal,
    subtotalOutlays,
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
