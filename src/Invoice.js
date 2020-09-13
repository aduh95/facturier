import { html } from "htm/preact";
import Header from "./Header.js";
import InvoiceContent from "./InvoiceContent.js";

export default function Invoice(props) {
  return html`
    <${Header} ...${props} />
    <${InvoiceContent} ...${props} />
    <!-- <S{Footer} /> -->
  `;
}
