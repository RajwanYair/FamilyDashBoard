/**
 * ECB eurofxref-daily.xml adapter — , Roadmap #16.
 *
 * Parses the ECB's daily reference-rate XML (EUR base) and converts it
 * to an ILS-based rates record matching CurrencySchema.
 *
 * ECB XML format (excerpt):
 *   <Cube time="2026-04-29">
 *     <Cube currency="USD" rate="1.0982"/>
 *     <Cube currency="ILS" rate="4.0738"/>
 *     ...
 *   </Cube>
 *
 * Output: `{ rates: Record<string, number> }` — "how many X per 1 ILS"
 * e.g. rates.USD ≈ 0.27 means 0.27 USD = 1 ILS.
 *
 * Returns `null` if ILS is not present in the ECB dataset or the XML is
 * malformed (caller falls through to KV stale).
 */
export function parseEcbXml(xml: string): { rates: Record<string, number> } | null {
  const eurRates: Record<string, number> = {};
  // The ECB XML format is stable and machine-generated; regex is safe here.
  const re = /<Cube currency="([A-Z]{3})" rate="([\d.]+)"\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const code = m[1];
    const rateStr = m[2];
    if (!code || !rateStr) continue;
    const rate = parseFloat(rateStr);
    if (Number.isFinite(rate) && rate > 0) {
      eurRates[code] = rate;
    }
  }

  // ILS must be in the dataset to compute cross-rates.
  const ilsPerEur = eurRates["ILS"];
  if (ilsPerEur === undefined || ilsPerEur <= 0) return null;

  // Convert from EUR-base to ILS-base: X_per_ILS = X_per_EUR / ILS_per_EUR
  const rates: Record<string, number> = {
    ILS: 1.0,
    EUR: 1 / ilsPerEur,
  };
  for (const [code, eurRate] of Object.entries(eurRates)) {
    if (code !== "ILS" && code !== "EUR") {
      rates[code] = eurRate / ilsPerEur;
    }
  }
  return { rates };
}
