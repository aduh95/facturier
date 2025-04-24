import fs from "node:fs";
import { hash } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { google } from "googleapis";

async function findAsync(array, fn) {
  for (const item of array) {
    if (await fn(item)) return item;
  }
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 */
export async function authorize(emailAddress, SCOPES, API) {
  let credentials
  const CREDENTIALS_DIR = new URL("../gmail_credentials/", import.meta.url);
    
  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  const EMAIL_CREDENTIALS_DIR = new URL(`./${emailAddress}/`, CREDENTIALS_DIR);
  const TOKEN_URL = new URL(`./token-${hash('sha1', JSON.stringify(SCOPES))}.json`, EMAIL_CREDENTIALS_DIR);
  const CREDENTIALS_URL = new URL(`./credentials.json`, EMAIL_CREDENTIALS_DIR);

  // Load client secrets from a local file.
  try {
    credentials = JSON.parse(await fs.promises.readFile(CREDENTIALS_URL, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        "You must get `credentials.json` first. Visit https://console.developers.google.com/apis/api/" + API +
        " and store the file at " +
          CREDENTIALS_URL,
        { cause: err }
      );
    } else throw err;
  }
  const { client_secret, client_id, redirect_uris } = credentials.web;

  let requestHandler;
  const server = createServer(function () {
    return Reflect.apply(requestHandler, this, arguments);
  });

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    await findAsync(redirect_uris, (url) => {
      try {
        url = new URL(url);
      } catch {
        return false;
      }
      if (url.hostname !== "localhost") return false;
      server.listen(url.port);
      return Promise.race([
        once(server, "error").then(() => {
          server.close();
          return false;
        }),
        once(server, "listening").then(() => true),
      ]);
    })
  );

  try {
    const token = await fs.promises.readFile(TOKEN_URL, "utf-8");
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  } catch {
    let deferred;
    ({ deferred, requestHandler } = getNewToken(oAuth2Client));
    const result = await deferred;
    return result;
  } finally {
    server.close();
    server.unref();
  }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 */
function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  let callback, reject;
  return {
    deferred: new Promise((resolve, rej) => {
      callback = resolve;
      reject = rej;
    }),
    requestHandler: (req, res) => {
      const qs = new URL(req.url, "http://localhost").searchParams;
      if (qs.has("code")) {
        res.end("Authentication successful! Please return to the console.");
        oAuth2Client.getToken(qs.get("code"), (err, token) => {
          if (err) return reject(err);
          oAuth2Client.setCredentials(token);
          // Store the token to disk for later program executions
          fs.writeFile(TOKEN_URL, JSON.stringify(token), (err) => {
            if (err) return console.error(err);
            console.log("Token stored to", TOKEN_URL);
          });
          callback(oAuth2Client);
        });
        return;
      }
      res.statusCode = 410;
      res.end("Prerequesit failed");
    },
  };
}

