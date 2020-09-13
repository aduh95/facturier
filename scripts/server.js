import http from "http";
import ws from "ws";

import requestListener from "./router.js";

const PORT_NUMBER = 8080;

const connections = new Set();
function registerConnection(connection) {
  connections.add(connection);
  connection.on("close", () => connections.delete(connection));

  connection.ping?.(1);
}

export function startServer() {
  const server = http
    .createServer(requestListener)
    .listen(PORT_NUMBER, "localhost", () => {
      console.log(`Server started on http://localhost:${PORT_NUMBER}`);
    });

  server.on("connection", registerConnection);
  new ws.Server({ server }).on("connection", registerConnection);

  return () =>
    new Promise((done) => {
      for (const connection of connections) {
        connection.terminate?.();
        connection.destroy?.();
      }
      server.unref().close(done);
    });
}

export function refreshBrowser() {
  const OPEN = 1;
  for (const wsConnection of connections) {
    if (wsConnection.readyState === OPEN) {
      console.log("Sending socket to refresh browser");
      wsConnection.send("refresh");
    }
  }
  return true;
}
