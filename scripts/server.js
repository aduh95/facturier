import http from "http";
import ws from "ws";

import requestListener from "./router.js";

let savePortNumber, onServerError;
export const PORT_NUMBER = new Promise((resolve, reject) => {
  savePortNumber = resolve;
  onServerError = reject;
});

const connections = new Set();
function registerConnection(connection) {
  connections.add(connection);
  connection.on("close", () => connections.delete(connection));

  connection.ping?.(1);
}

export function startServer() {
  const server = http.createServer(requestListener).listen(0, "localhost");
  let serverError;

  server.on("listening", () => {
    savePortNumber(server.address().port);
  });
  server.on("error", (err) => {
    serverError = err;
    onServerError(err);
  });
  server.on("connection", registerConnection);
  new ws.Server({ server }).on("connection", registerConnection);

  return () =>
    new Promise((done, reject) => {
      if (serverError) return reject(serverError);

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
