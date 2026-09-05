import type { StarterModel, StartFrom } from "./schemas";

/**
 * Generation-1 spec preview for screen 19, built live from the form values.
 * The same lines feed the mono well in the right panel and the YAML body the
 * review step submits, so what the operator sees is what gets written.
 */
export interface SpecPreviewInput {
  displayName: string;
  slug: string;
  startFrom: StartFrom;
  copyFromSlug?: string;
  yaml?: string;
  starterModel: StarterModel;
  autoHeal: boolean;
  resyncIntervalSeconds: number;
}

export type SpecValueTone = "plain" | "bool" | "number";

export interface SpecLine {
  indent: number;
  /** "key:" rendered in the key colour; absent for list items and raw lines */
  key?: string;
  value?: string;
  tone?: SpecValueTone;
  /** verbatim text (pasted YAML) */
  raw?: string;
}

const STARTER_ROLES: Record<StarterModel, string[]> = {
  "roles-only": ["tenant_admin", "tenant_viewer"],
  documents: ["tenant_admin", "tenant_editor", "tenant_viewer"],
};

export const STARTER_MODEL_LABELS: Record<StarterModel, { title: string; summary: string }> = {
  "roles-only": {
    title: "Roles only",
    summary: "tenant_admin and tenant_viewer, no relation graph",
  },
  documents: {
    title: "Documents starter",
    summary: "user · organization · document, viewer ⊂ editor ⊂ owner",
  },
};

function kv(indent: number, key: string, value?: string, tone: SpecValueTone = "plain"): SpecLine {
  return { indent, key, value, tone };
}

export function specPreviewLines(input: SpecPreviewInput): SpecLine[] {
  if (input.startFrom === "yaml" && input.yaml?.trim()) {
    return input.yaml.replace(/\r\n/g, "\n").split("\n").map((raw) => ({ indent: 0, raw }));
  }

  const slug = input.slug || "~";
  const name = input.displayName.trim() || "~";
  const lines: SpecLine[] = [
    kv(0, "apiVersion", "authzplane.dev/v1"),
    kv(0, "kind", "Tenant"),
    kv(0, "metadata"),
    kv(1, "slug", slug),
    kv(1, "displayName", name),
    kv(0, "spec"),
    kv(1, "reconcilePolicy"),
    kv(2, "autoHeal", String(input.autoHeal), "bool"),
    kv(2, "resyncIntervalSeconds", String(input.resyncIntervalSeconds), "number"),
  ];

  if (input.startFrom === "copy" && input.copyFromSlug) {
    lines.push(kv(1, "copyFrom", input.copyFromSlug));
  }

  lines.push(kv(1, "identityProviders", "[]"));
  lines.push(kv(1, "roles"));
  for (const role of STARTER_ROLES[input.starterModel]) {
    lines.push({ indent: 2, raw: `- key: ${role}` });
  }

  if (input.starterModel === "documents") {
    lines.push(kv(1, "authorizationModel"));
    lines.push(kv(2, "starter", "documents"));
    lines.push(kv(2, "types", "[user, organization, document]"));
  }

  return lines;
}

/** Plain-text YAML: what the create request carries and what tests assert on. */
export function specYaml(input: SpecPreviewInput): string {
  return specPreviewLines(input)
    .map((l) => {
      const pad = "  ".repeat(l.indent);
      if (l.raw !== undefined) return `${pad}${l.raw}`;
      return l.value === undefined ? `${pad}${l.key}:` : `${pad}${l.key}: ${l.value}`;
    })
    .join("\n");
}

export function starterRoles(model: StarterModel): string[] {
  return STARTER_ROLES[model];
}
