import { createHash } from "crypto";

/**
 * Normaliza un objeto recursivamente ordenando sus claves alfabéticamente.
 * Garantiza que JSON.stringify produzca la misma cadena sin importar el
 * orden en que el cliente envíe las claves.
 */
function sortKeysRecursively(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysRecursively);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeysRecursively(v)]),
    );
  }
  return value;
}

/**
 * Calcula un hash SHA-256 determinista para un input de cálculo.
 * El tipo de cálculo se incluye en el hash para que el mismo input
 * matemático usado en contextos distintos (FT vs IFT, trigonométrica
 * vs compleja) genere entradas canónicas separadas.
 *
 * @returns Hex string de 64 caracteres.
 */
export function computeInputHash(
  type: string,
  input: Record<string, unknown>,
): string {
  const canonical = { type, input: sortKeysRecursively(input) };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
