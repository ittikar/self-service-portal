import { z } from "zod";

export type FieldDef =
  | { type: "text"; label: string; hint?: string; required?: boolean; placeholder?: string; regex?: RegExp; regexMessage?: string; minLength?: number; maxLength?: number; default?: string }
  | { type: "longText"; label: string; hint?: string; required?: boolean; placeholder?: string; maxLength?: number; default?: string }
  | { type: "number"; label: string; hint?: string; required?: boolean; min?: number; max?: number; integer?: boolean; default?: number }
  | { type: "bool"; label: string; hint?: string; default?: boolean }
  | { type: "enum"; label: string; hint?: string; required?: boolean; options: readonly string[]; default?: string }
  | { type: "stringList"; label: string; hint?: string; required?: boolean; placeholder?: string; default?: string[] }
  | { type: "tagMap"; label: string; hint?: string; default?: Record<string, string> };

export type ResourceDef = {
  type: string;
  label: string;
  description: string;
  layer: "shared" | "compute" | "network" | "storage" | "infra";
  fields: Record<string, FieldDef>;
};

export function zodForField(field: FieldDef): z.ZodTypeAny {
  switch (field.type) {
    case "text": {
      let s = z.string();
      if (field.minLength !== undefined) s = s.min(field.minLength);
      if (field.maxLength !== undefined) s = s.max(field.maxLength);
      if (field.regex) s = s.regex(field.regex, field.regexMessage ?? "invalid format");
      const opt = field.required ? s.min(1) : s.optional();
      return field.default !== undefined ? opt.default(field.default as never) : opt;
    }
    case "longText": {
      let s = z.string();
      if (field.maxLength !== undefined) s = s.max(field.maxLength);
      const opt = field.required ? s.min(1) : s.optional();
      return field.default !== undefined ? opt.default(field.default as never) : opt;
    }
    case "number": {
      let s = field.integer ? z.number().int() : z.number();
      if (field.min !== undefined) s = s.min(field.min);
      if (field.max !== undefined) s = s.max(field.max);
      const opt = field.required ? s : s.optional();
      return field.default !== undefined ? opt.default(field.default as never) : opt;
    }
    case "bool": {
      const s = z.boolean();
      return field.default !== undefined ? s.default(field.default) : s.optional();
    }
    case "enum": {
      const s = z.enum(field.options as [string, ...string[]]);
      const opt = field.required ? s : s.optional();
      return field.default !== undefined ? opt.default(field.default as never) : opt;
    }
    case "stringList": {
      const s = z.array(z.string().min(1));
      const opt = field.required ? s.min(1) : s.optional();
      return field.default !== undefined ? opt.default(field.default as never) : opt;
    }
    case "tagMap": {
      const s = z.record(z.string(), z.string());
      return field.default !== undefined ? s.default(field.default) : s.optional();
    }
  }
}

export function buildZodSchema(def: ResourceDef): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {
    resource: z.literal(def.type),
  };
  for (const [name, field] of Object.entries(def.fields)) {
    shape[name] = zodForField(field);
  }
  return z.object(shape);
}
