import type { PromptTemplate, PromptRegistry } from "./types";
import { reviewPrompt } from "./review.prompt";
import { riskPrompt } from "./risk.prompt";
import { summaryPrompt } from "./summary.prompt";

class PromptRegistryImpl implements PromptRegistry {
  private templates = new Map<string, PromptTemplate>();
  private defaultsRegistered = false;

  register(template: PromptTemplate): void {
    const key = `${template.id}@${template.version}`;
    this.templates.set(key, template);
  }

  get(id: string, version: string = "1.0.0"): PromptTemplate {
    this.ensureDefaults();
    const key = `${id}@${version}`;
    const template = this.templates.get(key);
    if (!template) {
      throw new Error(`Prompt template not found: ${key}`);
    }
    return template;
  }

  list(): PromptTemplate[] {
    this.ensureDefaults();
    return Array.from(this.templates.values());
  }

  private ensureDefaults(): void {
    if (this.defaultsRegistered) return;
    this.defaultsRegistered = true;
    this.register(reviewPrompt);
    this.register(riskPrompt);
    this.register(summaryPrompt);
  }
}

export const promptRegistry = new PromptRegistryImpl();
