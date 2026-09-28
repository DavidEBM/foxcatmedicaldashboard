export function unwrapImportedValue(
  value: unknown
): unknown {
  if (
    value &&
    typeof value === "object" &&
    "value" in value
  ) {
    return (value as { value: unknown }).value;
  }

  return value;
}

export function getPathValue(
  source: unknown,
  path: string
): unknown {
  return path.split(".").reduce<unknown>(
    (current, segment) => {
      if (
        current === null ||
        current === undefined
      ) {
        return undefined;
      }

      if (
        typeof current !== "object"
      ) {
        return undefined;
      }

      return (
        current as Record<string, unknown>
      )[segment];
    },
    source
  );
}

export function getPatientField(
  raw: unknown,
  ...keys: string[]
): unknown {
  const source =
    raw &&
    typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};

  for (const key of keys) {
    const directValue =
      unwrapImportedValue(
        source[key]
      );

    if (
      directValue !== undefined &&
      directValue !== null &&
      String(directValue).trim() !== ""
    ) {
      return directValue;
    }

    if (!key.includes(".")) {
      continue;
    }

    const nestedValue =
      unwrapImportedValue(
        getPathValue(source, key)
      );

    if (
      nestedValue !== undefined &&
      nestedValue !== null &&
      String(nestedValue).trim() !== ""
    ) {
      return nestedValue;
    }
  }

  return "";
}