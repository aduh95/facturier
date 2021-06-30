import { html } from "htm/preact";
import { render } from "preact";
import Invoice from "./Invoice.js";

import "./index.scss";

import BILLER_INFO from "../user_data/biller.toml";
import INVOICE_INFO from "cli:argv[2].toml";

if (INVOICE_INFO.line.length > 7) {
  // Hack to workaround bug in chrome when table span into several pages while inside a flex container.
  document.body.style.display = "revert";
}

render(
  html`<${Invoice} biller=${BILLER_INFO} ...${INVOICE_INFO} />`,
  document.body
);

console.log(INVOICE_INFO);
