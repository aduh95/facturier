import { html } from "htm/preact";

import "./Footer.scss";

import STRINGS from "lang:strings.toml";

const createTerm = (terms) =>
  html`<section>
    ${terms.HEADING ? html`<h5>${terms.HEADING}</h5>` : null}
    <ul>
      ${terms.TEXT.map((txt) => html`<li>${txt}</li>`)}
    </ul>
  </section>`;

export default function Footer(props) {
  const { format, roundUpTotalToNextInt } = props;
  return html`<footer>
    <section>
      <h5>
        ${STRINGS.SUBTOTAL}${props.subtotalOutlays
          ? ` (${STRINGS.EXCLUDING} ${STRINGS.OUTLAYS})`
          : ""}
      </h5>
      <output>${format.currency(props.subtotal)}</output>
      <h5>${STRINGS.TAX} (${format.percent(props.tax)})</h5>
      <output>${format.currency(props.subtotal * props.tax)}</output>
      ${props.subtotalOutlays
        ? html`<hr />
            <h5>${STRINGS.SUBTOTAL} ${STRINGS.OUTLAYS}</h5>
            <output>${format.currency(props.subtotalOutlays)}</output>`
        : null}
      <hr />
      <h5>${STRINGS.TOTAL}${roundUpTotalToNextInt ? STRINGS.ROUNDED : ""}</h5>
      <output>${format.currency(props.total)}</output>
      <h5>${STRINGS.AMOUNT_PAID}</h5>
      <output>${format.currency(props.prepaid)}</output>
      <hr />
      <h4>${STRINGS.AMOUNT_DUE} (${props.currency})</h4>
      <strong>${format.currency(props.totalDue)}</strong>
    </section>
    <aside>
      ${(props.TERMS ?? []).concat(STRINGS.TERMS).map(createTerm)}
      <section>
        <h5>${STRINGS.BANK_INFO.HEADING}</h5>
        <ul>
          <li>${STRINGS.BANK_INFO.IBAN} ${props.biller.IBAN}</li>
          <li>${STRINGS.BANK_INFO.BIC} ${props.biller.BIC}</li>
        </ul>
      </section>
    </aside>
  </footer>`;
}
