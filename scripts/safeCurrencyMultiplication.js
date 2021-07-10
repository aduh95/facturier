const strToBigInt = (str) => {
  const dotIndex = str.indexOf(".");
  const factor = dotIndex === -1 ? 0 : str.length - dotIndex - 1;
  return [
    BigInt(
      dotIndex === -1 ? str : str.slice(0, dotIndex) + str.substr(dotIndex + 1)
    ),
    factor,
  ];
};
export default function safeCurrencyMultiplication(a, b) {
  const [aBigInt, aFactor] = strToBigInt(a);
  const [bBigInt, bFactor] = strToBigInt(b);
  const bigIntStr = (aBigInt * bBigInt).toString(10);
  const factor = aFactor + bFactor;
  return factor === 0
    ? bigIntStr
    : bigIntStr.slice(0, bigIntStr.length - factor) +
        "." +
        bigIntStr.slice(bigIntStr.length - factor);
}
