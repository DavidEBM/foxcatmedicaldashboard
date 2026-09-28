import type {
  AiValidationVerdict,
} from "@/types/doctor-ai-validation";

export function normalizeVerdict(
  value: unknown,
): AiValidationVerdict | "" {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "valid") {
    return "valid";
  }

  if (normalized === "incorrect") {
    return "incorrect";
  }

  return "";
}