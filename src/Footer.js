import { html } from "htm/preact";

import STRINGS from "lang:strings.toml";

export default function Footer(props) {
  const { format } = props;
  return html`<footer>
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
