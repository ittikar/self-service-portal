"use client";

import { useMemo, useState } from "react";
import type { FieldDef, ResourceDef } from "~/server/schemas/_types";
import { buildZodSchema } from "~/server/schemas/_types";
import type { Manifest } from "~/server/schemas";

type Props = {
  def: ResourceDef;
  onSubmit: (manifest: Manifest) => void;
  disabled?: boolean;
};

type FormValue = string | number | boolean | string[] | Record<string, string> | undefined;
type FormState = Record<string, FormValue>;

export function GenericForm({ def, onSubmit, disabled }: Props) {
  const initialState = useMemo<FormState>(() => {
    const s: FormState = {};
    for (const [name, field] of Object.entries(def.fields)) {
      s[name] = initialForField(field);
    }
    return s;
  }, [def]);

  const [values, setValues] = useState<FormState>(initialState);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const schema = useMemo(() => buildZodSchema(def), [def]);

  function setField(name: string, v: FormValue) {
    setValues((prev) => ({ ...prev, [name]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    const cleaned: Record<string, unknown> = { resource: def.type };
    for (const [name, field] of Object.entries(def.fields)) {
      const raw = values[name];
      const v = normalizeForSubmit(field, raw);
      if (v !== undefined) cleaned[name] = v;
    }
    const parsed = schema.safeParse(cleaned);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const key = String(issue.path[0] ?? "");
      const field = def.fields[key];
      const label = field?.label ?? key ?? "Input";
      const friendly = humanMessage(issue.message);
      setFieldError(`${label}: ${friendly}`);
      return;
    }
    onSubmit(parsed.data as Manifest);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-lg font-medium">{def.label}</h2>
      <p className="text-sm text-zinc-500 -mt-3">{def.description}</p>

      {Object.entries(def.fields).map(([name, field]) => (
        <FieldRenderer
          key={name}
          name={name}
          field={field}
          value={values[name]}
          onChange={(v) => setField(name, v)}
        />
      ))}

      {fieldError && (
        <p className="text-sm text-red-600 dark:text-red-400">{fieldError}</p>
      )}

      <div>
        <button
          type="submit"
          disabled={disabled}
          className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {disabled ? "Submitting…" : "Submit request"}
        </button>
      </div>
    </form>
  );
}

function FieldRenderer({
  name,
  field,
  value,
  onChange,
}: {
  name: string;
  field: FieldDef;
  value: FormValue;
  onChange: (v: FormValue) => void;
}) {
  const requiredMark =
    "required" in field && field.required ? <span className="text-red-500 ml-1">*</span> : null;
  const labelEl = (
    <label htmlFor={name} className="block text-sm font-medium">
      {field.label}
      {requiredMark}
    </label>
  );
  const hintEl = field.hint ? <p className="text-xs text-zinc-500">{field.hint}</p> : null;

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-1.5">
          {labelEl}
          <input
            id={name}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono"
          />
          {hintEl}
        </div>
      );
    case "longText":
      return (
        <div className="space-y-1.5">
          {labelEl}
          <textarea
            id={name}
            rows={4}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono"
          />
          {hintEl}
        </div>
      );
    case "number":
      return (
        <div className="space-y-1.5">
          {labelEl}
          <input
            id={name}
            type="number"
            value={(value as number | undefined)?.toString() ?? ""}
            onChange={(e) =>
              onChange(e.target.value === "" ? undefined : Number(e.target.value))
            }
            min={field.min}
            max={field.max}
            step={field.integer ? 1 : "any"}
            className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
          {hintEl}
        </div>
      );
    case "bool":
      return (
        <div className="flex items-start gap-3">
          <input
            id={name}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-1"
          />
          <div className="space-y-0.5">
            <label htmlFor={name} className="text-sm font-medium">
              {field.label}
            </label>
            {hintEl}
          </div>
        </div>
      );
    case "enum":
      return (
        <div className="space-y-1.5">
          {labelEl}
          <select
            id={name}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          >
            {!field.required && <option value="">(none)</option>}
            {field.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {hintEl}
        </div>
      );
    case "stringList":
      return (
        <div className="space-y-1.5">
          {labelEl}
          <input
            id={name}
            value={((value as string[]) ?? []).join(", ")}
            onChange={(e) =>
              onChange(
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            placeholder={field.placeholder ?? "comma-separated values"}
            className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono"
          />
          {hintEl ?? <p className="text-xs text-zinc-500">Comma-separated</p>}
        </div>
      );
    case "tagMap":
      return (
        <div className="space-y-1.5">
          {labelEl}
          <textarea
            id={name}
            rows={3}
            value={recordToKvText(value as Record<string, string> | undefined)}
            onChange={(e) => onChange(parseKvText(e.target.value))}
            placeholder="key=value (one per line)"
            className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono"
          />
          {hintEl ?? (
            <p className="text-xs text-zinc-500">
              One <code>key=value</code> per line
            </p>
          )}
        </div>
      );
  }
}

function initialForField(field: FieldDef): FormValue {
  if ("default" in field && field.default !== undefined) {
    return field.default as FormValue;
  }
  switch (field.type) {
    case "bool":
      return false;
    case "stringList":
      return [];
    case "tagMap":
      return {};
    case "enum":
      // Required enum with no default: pre-select the first option so the
      // displayed select widget matches the actual form state.
      return field.required ? field.options[0] : undefined;
    default:
      return undefined;
  }
}

function normalizeForSubmit(field: FieldDef, raw: FormValue): unknown {
  if (field.type === "text" || field.type === "longText") {
    if (raw === undefined || raw === "") return undefined;
    return raw;
  }
  if (field.type === "number") {
    if (raw === undefined || (typeof raw === "number" && Number.isNaN(raw))) return undefined;
    return raw;
  }
  if (field.type === "enum") {
    if (raw === undefined || raw === "") return undefined;
    return raw;
  }
  if (field.type === "stringList") {
    const arr = (raw as string[] | undefined) ?? [];
    // Required: pass through (even empty) so Zod gives a clean "at least 1" message.
    // Optional: omit empty arrays to keep manifest tidy.
    if (field.required) return arr;
    return arr.length === 0 ? undefined : arr;
  }
  if (field.type === "tagMap") {
    const rec = (raw as Record<string, string> | undefined) ?? {};
    return Object.keys(rec).length === 0 ? undefined : rec;
  }
  if (field.type === "bool") {
    return Boolean(raw);
  }
  return raw;
}

function humanMessage(msg: string): string {
  // Translate common Zod messages to friendly form copy
  if (/expected array, received undefined/i.test(msg)) return "required — add at least one value";
  if (/expected string, received undefined/i.test(msg)) return "required";
  if (/expected number, received nan/i.test(msg)) return "required — enter a number";
  if (/expected number, received undefined/i.test(msg)) return "required";
  if (/at least 1 element/i.test(msg)) return "add at least one value";
  if (/string must contain at least 1/i.test(msg)) return "required";
  if (/invalid_enum_value/i.test(msg)) return "pick one of the options";
  return msg.toLowerCase();
}

function recordToKvText(rec: Record<string, string> | undefined): string {
  if (!rec) return "";
  return Object.entries(rec)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

function parseKvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}
