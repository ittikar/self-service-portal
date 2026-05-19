import YAML from "yaml";
import type { Manifest } from "~/server/schemas";

export function renderManifestYAML(manifest: Manifest): string {
  const doc = new YAML.Document(manifest);
  doc.commentBefore = ` Self-service portal request manifest\n Generated at ${new Date().toISOString()}\n Resource: ${manifest.resource}`;
  return String(doc);
}
