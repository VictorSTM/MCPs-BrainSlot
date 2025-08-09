export class Registry {
    tools = new Map();
    resources = [];
    resourceTemplates = [];
    prompts = new Map();
    addTool(def) {
        if (this.tools.has(def.name))
            throw new Error(`Tool already exists: ${def.name}`);
        this.tools.set(def.name, def);
    }
    addResource(res) { this.resources.push(res); }
    addResourceTemplate(tpl) { this.resourceTemplates.push(tpl); }
    addPrompt(p) {
        if (this.prompts.has(p.name))
            throw new Error(`Prompt already exists: ${p.name}`);
        this.prompts.set(p.name, p);
    }
}
