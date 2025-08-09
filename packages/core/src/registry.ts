import { ToolDef, ResourceDescriptor, ResourceTemplate, PromptTemplate } from "./types";

export class Registry<C> {
  tools: Map<string, ToolDef<C>> = new Map();
  resources: ResourceDescriptor[] = [];
  resourceTemplates: ResourceTemplate[] = [];
  prompts: Map<string, PromptTemplate> = new Map();

  addTool(def: ToolDef<C>) {
    if (this.tools.has(def.name)) throw new Error(`Tool already exists: ${def.name}`);
    this.tools.set(def.name, def);
  }

  addResource(res: ResourceDescriptor) { this.resources.push(res); }
  addResourceTemplate(tpl: ResourceTemplate) { this.resourceTemplates.push(tpl); }

  addPrompt(p: PromptTemplate) {
    if (this.prompts.has(p.name)) throw new Error(`Prompt already exists: ${p.name}`);
    this.prompts.set(p.name, p);
  }
}
