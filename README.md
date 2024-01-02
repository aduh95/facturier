# Facturier

Facturier is a tool written in Node.js to edit invoices using
[TOML language](https://github.com/toml-lang/toml).

I find it more convenient than using a spreadsheet bacause:

- you can use git.
- it separates my info the lang strings from the client info.

## Getting started

Requires Node.js 18+.

You need to clone this repo locally and run `yarn install` (or `npm install`). I
recommend setting a private repo to store your client's data (the invoices).
That folder needs to contain:

- a `biller.toml` containing data regarding your company (see
  [sample](./biller-sample.toml) for reference).
- a `yourclient-draft.toml` containing the draft of your invoice (see
  [sample](./bill-sample.toml) for reference).
- a `.git` folder (I.E.: it should be a git repo).

Here's a few command you can use to get started quickly:

```sh
git clone https://github.com/aduh95/facturier.git
cd facturier
corepack yarn install
git init user_data
cp biller-sample.toml user_data/biller.toml
```

You can preview the invoice in your web browser by running:

```yarn
yarn start user_data/yourclient-draft.toml
```

You can save a PDF version by running:

```yarn
yarn build user_data/yourclient-draft.toml
```

The build script performs the following steps:

- it computes what the reference of the invoice should be (first two char is the
  current year last two digits, then a three-digit number that starts at `001`
  and increments for each invoice: `YYXXX`).
- it replaces `"REPLACEME"` for date and reference in the draft file.
- it writes a `YYXXX.toml` file in the same dir as the invoice (`YYXXX` is the
  reference of the invoice).
- it writes a `YYXXX.pdf` PDF document containing the final invoice.
- it commits both files (using `YYXXX` as message) and pushes the commit to
  `origin/main`.

### Useful scripts

```
# Computes the total for a (draft or not) invoice:
yarn total path/to/invoice-draft.toml

# Compute the total revenu last year, split per country, with and without VAT
node scripts/computeRevenueLastYear.js path/to/user_data

# Compute the total revenu last quarter, split per country, with and without VAT
node scripts/computeRevenueLastQuarter.js path/to/user_data
```
