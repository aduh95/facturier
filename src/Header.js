import { html } from "htm/preact";

import STRINGS from "lang:strings.toml";

function BillerInfo(props) {
  const { biller } = props;
  return html`
    <div>
      ${biller.name}
      <address>${biller.address.join("\n")}</address>
      <a href=${"tel:" + biller.tel.replace(/[^\d+]/g, "")}>${biller.tel}</a>
      ${biller.other_info}
    </div>
  `;
}

function ClientInfo(props) {
  const { client } = props;
  return html`<section>
    <h3>${STRINGS.BILLED_TO}</h3>
    ${client.name}
    <address>${client.address.join("\n")}</address>
    ${client.other_info}
  </section>`;
}

function InvoiceInfo(props) {
  return html`<div>
    <!-- Billed to -->
    <${ClientInfo} client=${props.client} />
    <!-- Invoice Number -->
    <label>
      <span>${STRINGS.NUMBER}</span>
      <input readonly value=${props.reference} />
    </label>
    <!-- Date of issue -->
    <label>
      <span>${STRINGS.DATE_OF_ISSUE}</span>
      <input readonly value=${props.date.$__toml_private_datetime} />
    </label>
  </div>`;
}

export default function Header(props) {
  return html`<h1>${STRINGS.INVOICE}</h1>
    <${BillerInfo} ...${props} />
    <${InvoiceInfo} ...${props} />`;
}
