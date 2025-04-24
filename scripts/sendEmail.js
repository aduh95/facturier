#!/usr/bin/env node
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import { google } from "googleapis";

import TOML from "@aduh95/toml";
import { getInvoiceFilePath } from "./get-invoice-info.js";
import { authorize } from "./googleAPI.js";

const SCOPES = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.addons.current.action.compose",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];
const API = "gmail.googleapis.com";

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

const auth = await authorize(email.from, SCOPES, API);

await sendMail(auth, email);
