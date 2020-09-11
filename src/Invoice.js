import { html } from "htm/preact";
import Header from "./Header.js";

export default function Invoice(props) {
  return html`
    <${Header} ...${props} />
    <!-- <S{InvoiceContent} /> -->
    <!-- <S{Footer} /> -->
  `;
}
