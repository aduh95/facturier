import { html } from "htm/preact";
import { render } from "preact";
import Invoice from "./Invoice.js";

render(
  html`<${Invoice}
    biller=${{
      name: "test",
    }}
    client=${{
      name: "test",
    }}
  />`,
  document.body
);
