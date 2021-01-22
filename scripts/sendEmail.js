#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs";
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

if (!fs.existsSync(CREDENTIALS_URL)) {
  throw new Error(
    "You must get GMail API `credentials.json` first. Visit https://console.developers.google.com/apis/api/gmail.googleapis.com and store the file at " +
      CREDENTIALS_URL
  );
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 */
async function authorize(credentials) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  try {
    const token = await fs.promises.readFile(TOKEN_URL);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  } catch {
    return getNewToken(oAuth2Client);
  }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 */
async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  const { createInterface } = await import("readline");
  return new Promise((callback, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Enter the code from that page here: ", (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject(err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_URL, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log("Token stored to", TOKEN_PATH);
        });
        callback(oAuth2Client);
      });
    });
  });
}

function getName(fromPathOrURL) {
  const path = fromPathOrURL.toString();
  return path.toString().substring(path.lastIndexOf("/"));
}

function makeBody({ cc, to, from, subject, message, attachments }) {
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

  const txtBody =
    'Content-Type: text/plain; charset="UTF-8"\n' +
    "Content-Transfer-Encoding: 8bit\n" +
    "\n" +
    message;

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
      attachments
        .map(
          (attachment) =>
            `Content-Type: application/octet-stream; name=${getName(
              attachment
            )}\n` +
            "Content-Transfer-Encoding: base64\n" +
            "Content-Disposition: attachment\n" +
            fs.readFileSync(attachment).toString("base64")
        )
        .join(`\n--${separator}\n`) +
      `--${separator}--`
    : txtBody;

  return Buffer.from(headers + body)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
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
      raw: makeBody(email),
    },
  });
  console.log(res.data);
}

// Load client secrets from a local file.
const credentials = await fs.promises.readFile(CREDENTIALS_URL);
const auth = await authorize(JSON.parse(credentials));

await sendMail(auth, email);
