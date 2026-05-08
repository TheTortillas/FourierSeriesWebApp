import type { SymbolicExpression } from "../../domain/types/fourier.types";

export function parseMarkeredOutput(
  raw: string,
  markers: string[],
): Record<string, SymbolicExpression> {
  const cleaned = raw.replace(/\\\n/g, "").replace(/\n/g, " ");
  const result: Record<string, SymbolicExpression> = {};

  for (let i = 0; i < markers.length; i += 2) {
    const maximaMarker = markers[i];
    const texMarker = markers[i + 1];

    const maximaValue = extractBetweenMarkers(cleaned, maximaMarker, texMarker);
    const nextMarker = markers[i + 2] ?? "__END__";
    const texValue = extractBetweenMarkers(cleaned, texMarker, nextMarker);

    const key = maximaMarker
      .replace(/__/g, "")
      .replace("_MAXIMA", "")
      .toLowerCase();

    result[key] = {
      maxima: maximaValue.replace(/false/g, "").trim(),
      tex: extractTex(texValue),
    };
  }

  return result;
}

function extractBetweenMarkers(
  text: string,
  start: string,
  end: string,
): string {
  const startIdx = text.indexOf(start);
  if (startIdx === -1) return "";
  const afterStart = text.indexOf(" ", startIdx) + 1;
  const endIdx = text.indexOf(end, afterStart);
  return endIdx === -1
    ? text.slice(afterStart).trim()
    : text.slice(afterStart, endIdx).trim();
}

function extractTex(raw: string): string {
  const match = raw.match(/\$\$(.+?)\$\$/s);
  return match ? match[1].trim() : raw.replace(/false/g, "").trim();
}
