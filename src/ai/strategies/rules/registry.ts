import type { Rule } from "./rule.interface";

export class RuleRegistry {
  private rules = new Map<string, Rule>();

  register(rule: Rule): void {
    this.rules.set(rule.id, rule);
  }

  get(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  getEnabled(): Rule[] {
    return Array.from(this.rules.values()).filter((r) => r.enabled);
  }

  getAll(): Rule[] {
    return Array.from(this.rules.values());
  }

  disable(id: string): void {
    const rule = this.rules.get(id);
    if (rule) {
      // Rules are immutable; replace with disabled version
      this.rules.set(id, { ...rule, enabled: false });
    }
  }

  enable(id: string): void {
    const rule = this.rules.get(id);
    if (rule) {
      this.rules.set(id, { ...rule, enabled: true });
    }
  }
}
