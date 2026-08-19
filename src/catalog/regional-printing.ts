export type RegionalPrintingSource = {
  englishCollectorNumber: string | null;
  japaneseCollectorNumber: string | null;
  englishSetName: string | null;
  japaneseSetName: string | null;
};

export type RegionalPrinting = {
  code: "EN" | "JP";
  label: "English Printing" | "Japanese Printing";
  collectorNumber: string | null;
  setName: string | null;
};

export function catalogProductRegionalPrintings(
  product: RegionalPrintingSource,
): RegionalPrinting[] {
  const printings: RegionalPrinting[] = [
    {
      code: "EN",
      label: "English Printing",
      collectorNumber: product.englishCollectorNumber,
      setName: product.englishSetName,
    },
    {
      code: "JP",
      label: "Japanese Printing",
      collectorNumber: product.japaneseCollectorNumber,
      setName: product.japaneseSetName,
    },
  ];
  return printings.filter(
    ({ collectorNumber, setName }) => collectorNumber !== null || setName !== null,
  );
}

export function regionalPrintingFacts(printing: RegionalPrinting) {
  return [printing.collectorNumber, printing.setName].filter((value) => value !== null).join(" · ");
}
