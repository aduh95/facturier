import { html } from "htm/preact";
import { render } from "preact";
import Invoice from "./Invoice.js";

import BILLER_INFO from "../user_data/biller.toml";
import INVOICE_INFO from "cli:argv[2].toml";

render(
  html`<${Invoice} biller=${BILLER_INFO} ...${INVOICE_INFO} />`,
  document.body
);

console.log(INVOICE_INFO);
