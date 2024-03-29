#!/usr/bin/env node
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { google } from "googleapis";

import TOML from "@aduh95/toml";
import { getInvoiceFilePath } from "./get-invoice-info.js";

const CREDENTIALS_DIR = new URL("../gmail_credentials/", import.meta.url);

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.addons.current.action.compose",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];

const { email } = TOML.parse(fs.readFileSync(getInvoiceFilePath()));
if (email?.from == null) {
  throw new Error(
    "The targeted invoice doesn't contain a valid `email` section."
  );
}

const pdf = getInvoiceFilePath().replace(/\.toml$/, ".pdf");
if (!fs.existsSync(pdf)) {
  throw new Error("You must build the PDF first.");
}
email.attachments = [pdf];

// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const EMAIL_CREDENTIALS_DIR = new URL(`./${email.from}/`, CREDENTIALS_DIR);
const TOKEN_URL = new URL(`./token.json`, EMAIL_CREDENTIALS_DIR);
const CREDENTIALS_URL = new URL(`./credentials.json`, EMAIL_CREDENTIALS_DIR);

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
async function authorize(credentials) {
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

function getName(fromPathOrURL) {
  const path = fromPathOrURL.toString();
  return path.toString().substring(path.lastIndexOf("/") + 1);
}

function signPlainText(txt) {
  const cp = spawn("gpg", ["--clearsign"], {
    stdio: ["pipe", "pipe", "inherit"],
  });
  cp.stdin.end(txt);
  const output = cp.stdout.toArray();
  return new Promise((resolve, reject) => {
    cp.on("error", reject);
    cp.on("close", (code) => {
      if (code === 0)
        resolve(
          output.then((result) => Buffer.concat(result).toString("utf-8"))
        );
      else reject(new Error("gpg exited with non-0 exit code: " + code));
    });
  });
}

function signBinaryFile(path) {
  const cp = spawn("gpg", ["--detach-sign", "-o", "-", path], {
    stdio: ["inherit", "pipe", "inherit"],
  });
  const output = cp.stdout.toArray();
  return new Promise((resolve, reject) => {
    cp.on("error", reject);
    cp.on("close", (code) => {
      if (code === 0) resolve(output.then(Buffer.concat));
      else reject(new Error("gpg exited with non-0 exit code: " + code));
    });
  });
}

async function getSignedAttachements(attachments) {
  const result = await Promise.all(
    attachments.map(async (attachment) => {
      const name = getName(attachment);
      const [plain, signed] = await Promise.all([
        readFile(attachment),
        signBinaryFile(attachment),
      ]);
      return [
        [name, plain],
        [`${name}.sig`, signed],
      ];
    })
  );
  return result.flat(1);
}

async function makeBody({ cc, to, from, subject, message, attachments, sign }) {
  cc = cc ? `Cc: ${cc.join(";")}\n` : "";
  subject = [...subject].some((char) => char.charCodeAt(0) > 127)
    ? `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`
    : subject;

  const headers =
    `From: ${from}\n` +
    `To: ${to.join(";")}\n` +
    cc +
    `Subject: ${subject}\n` +
    "MIME-Version: 1.0\n";

  const signedBody = sign ? await signPlainText(message) : message;
  const txtBody =
    'Content-Type: text/plain; charset="UTF-8"\n' +
    "Content-Transfer-Encoding: 8bit\n" +
    "\n" +
    signedBody;

  const separator =
    attachments?.length && crypto.randomBytes(20).toString("base64");
  const body = attachments?.length
    ? `Content-Type: multipart/mixed; boundary="${separator}"\n` +
      "Content-Transfer-Encoding: 7bit\n" +
      "This is a MIME encoded message.\n" +
      "\n" +
      `--${separator}\n` +
      txtBody +
      `\n--${separator}\n` +
      (sign
        ? await getSignedAttachements(attachments)
        : attachments.map((attachment) => [
            getName(attachment),
            fs.readFileSync(attachment),
          ])
      )
        .map(
          ([name, binary]) =>
            `Content-Type: application/octet-stream; name=${name}\n` +
            "Content-Transfer-Encoding: base64\n" +
            "Content-Disposition: attachment\n" +
            binary.toString("base64")
        )
        .join(`\n--${separator}\n`) +
      `--${separator}--`
    : txtBody;

  return Buffer.from(headers + body).toString("base64url");
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function sendMail(auth, email) {
  const gmail = google.gmail({ version: "v1", auth });
  // Do the magic
  const res = await gmail.users.messages.send({
    // The user's email address. The special value `me` can be used to indicate the authenticated user.
    userId: "me",

    // Request body metadata
    requestBody: {
      raw: await makeBody(email),
    },
  });
  console.log(res.data);
}

// Load client secrets from a local file.
let credentials;
try {
  credentials = await fs.promises.readFile(CREDENTIALS_URL, "utf-8");
} catch (err) {
  if (err.code === "ENOENT") {
    throw new Error(
      "You must get GMail API `credentials.json` first. Visit https://console.developers.google.com/apis/api/gmail.googleapis.com and store the file at " +
        CREDENTIALS_URL,
      { cause: err }
    );
  } else throw err;
}
const auth = await authorize(JSON.parse(credentials));

await sendMail(auth, email);
