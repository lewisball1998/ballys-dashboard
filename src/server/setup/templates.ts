/**
 * Starter templates for the first-run wizard. v0.1 is categories-only — generic
 * homelab categories with NO hardcoded apps, domains, IPs, or private service
 * names (the user adds their own apps in the launcher). This keeps the platform
 * free of any environment-specific assumptions.
 */
export type TemplateId = "blank" | "homelab";

export interface StarterTemplate {
  id: TemplateId;
  name: string;
  description: string;
  categories: string[];
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Start with an empty dashboard — add your own categories and apps.",
    categories: [],
  },
  {
    id: "homelab",
    name: "Homelab starter",
    description: "Create common homelab categories to organise your apps.",
    categories: ["Media", "Infrastructure", "Automation", "AI", "Utilities"],
  },
];

export function getTemplate(id: TemplateId): StarterTemplate {
  const template = STARTER_TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error(`Unknown starter template: ${id}`);
  return template;
}
