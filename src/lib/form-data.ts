export function formDataToObject(formData: FormData, keys: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const key of keys) obj[key] = String(formData.get(key) ?? "");
  return obj;
}
