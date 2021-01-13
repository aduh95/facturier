import fs from "fs";

export function findNextReference(dir, year) {
  const files = fs
    .readdirSync(dir)
    .filter(
      (fileName) => fileName.startsWith(year) && fileName.endsWith(".toml")
    );
  const ref = files.length
    ? (Number(files.sort().pop().substring(2, 5)) + 1)
        .toString(10)
        .padStart(3, "0")
    : "001";

  return `${year}${ref}`;
}
