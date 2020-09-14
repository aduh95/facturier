import { html } from "htm/preact";

import STRINGS from "lang:strings.toml";

const createTerm = (terms) =>
  html`<section>
    ${terms.HEADING ? html`<h5>${terms.HEADING}</h5>` : null}
    <ul>
      ${terms.TEXT.map((txt) => html`<li>${txt}</li>`)}
    </ul>
  </section>`;

export default function Footer(props) {
  const { format } = props;
  return html`<footer>
    ${STRINGS.TERMS.map(createTerm)}
    <section>
      <h5>${STRINGS.BANK_INFO.HEADING}</h5>
      <ul>
        <li>${STRINGS.BANK_INFO.IBAN} ${props.biller.IBAN}</li>
        <li>${STRINGS.BANK_INFO.BIC} ${props.biller.BIC}</li>
      </ul>
    </section>
    <section>
      <h5>${STRINGS.SUBTOTAL}</h5>
      <output>${format.currency(props.subtotal)}</output>
      <h5>${STRINGS.TAX}</h5>
      <output>${format.percent(props.tax)}</output>
      <hr />
      <h5>${STRINGS.TOTAL}</h5>
      <output>${format.currency(props.total)}</output>
      <h5>${STRINGS.AMOUNT_PAID}</h5>
      <output>${format.currency(props.prepaid)}</output>
      <hr />
      <h4>${STRINGS.AMOUNT_DUE} (${props.currency})</h4>
      <output>${format.currency(props.totalDue)}</output>
    </section>
  </footer>`;
}
