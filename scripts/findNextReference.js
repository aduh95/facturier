import fs from "fs";

export function findNextReference(dir, year) {
  const files = fs
    .readdirSync(dir)
    .filter(
      (fileName) => fileName.startsWith(year) && fileName.endsWith(".toml")
    )
    .sort();

  const lastReference = files.pop();
  const ref =
    lastReference.substring(0, 2) === year
      ? (Number(lastReference.substring(2, 5)) + 1)
          .toString(10)
          .padStart(3, "0")
      : "001";

  return `${year}${ref}`;
}
