import type { PromptTemplate, PromptRegistry } from "./types";

class PromptRegistryImpl implements PromptRegistry {
  private templates = new Map<string, PromptTemplate>();

  register(template: PromptTemplate): void {
    const key = `${template.id}@${template.version}`;
    this.templates.set(key, template);
  }

  get(id: string, version: string = "latest"): PromptTemplate {
    const key = `${id}@${version}`;
    const template = this.templates.get(key);
    if (!template) {
      throw new Error(`Prompt template not found: ${key}`);
    }
    return template;
  }

  list(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }
}

export const promptRegistry = new PromptRegistryImpl();
