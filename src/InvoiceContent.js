import { html } from "htm/preact";

import STRINGS from "lang:strings.toml";

import "./InvoiceContent.scss";

export default function InvoiceContent(props) {
  const { line } = props;
  return html`<main>
    <table>
      <thead>
        <tr>
          <th>${STRINGS.DESCRIPTION}</th>
          <th>${STRINGS.UNIT_PRICE}</th>
          <th>${STRINGS.QUANTITY}</th>
          <th>${STRINGS.LINE_TOTAL}</th>
        </tr>
      </thead>
      <tbody>
        ${line.map(
          (line) => html`<tr>
            <td>${line.description}</td>
            <td>${props.format.currency(line.unitPrice)}</td>
            <td>${line.quantity}</td>
            <td>${props.format.currency(line.unitPrice * line.quantity)}</td>
          </tr>`
        )}
      </tbody>
    </table>
  </main>`;
}
