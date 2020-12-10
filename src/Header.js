import { html } from "htm/preact";

import STRINGS from "lang:strings.toml";
import "./Header.scss";

function BillerInfo(props) {
  const { biller } = props;
  return html`
    <div>
      ${biller.name}
      <address>${biller.address.join("\n")}</address>
      <a href=${"tel:" + biller.tel.replace(/[^\d+]/g, "")}>${biller.tel}</a>
      <ul>
        ${biller.other_info?.map((item) => html`<li>${item}</li>`)}
      </ul>
    </div>
  `;
}

function ClientInfo(props) {
  const { client } = props;
  return html`<section class="client-info">
    <h3>${STRINGS.BILLED_TO}</h3>
    ${client.name}
    <address>${client.address.join("\n")}</address>
    <ul>
      ${client.other_info?.map((item) => html`<li>${item}</li>`)}
    </ul>
  </section>`;
}

function InvoiceInfo(props) {
  return html`
    <!-- Billed to -->
    <${ClientInfo} client=${props.client} />
    <div class="invoice-details">
      <!-- Invoice Number -->
      <label>
        <span>${STRINGS.NUMBER}</span>
        <output>${props.reference}</output>
      </label>
      <!-- Date of issue -->
      <label>
        <span>${STRINGS.DATE_OF_ISSUE}</span>
        <output
          >${props.date?.$__toml_private_datetime ??
          html`<i>REPLACEME</i>`}</output
        >
      </label>
      <label>
        <span>${STRINGS.AMOUNT_DUE}</span>
        <output>${props.format.currency(props.totalDue)}</output>
      </label>
    </div>
  `;
}

export default function Header(props) {
  return html`<header>
    <h1>${STRINGS.INVOICE}</h1>
    <${BillerInfo} ...${props} />
    <${InvoiceInfo} ...${props} />
  </header>`;
}
