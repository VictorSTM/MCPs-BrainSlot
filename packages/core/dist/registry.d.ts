import { ToolDef, ResourceDescriptor, ResourceTemplate, PromptTemplate } from "./types";
export declare class Registry<C> {
    tools: Map<string, ToolDef<C>>;
    resources: ResourceDescriptor[];
    resourceTemplates: ResourceTemplate[];
    prompts: Map<string, PromptTemplate>;
    addTool(def: ToolDef<C>): void;
    addResource(res: ResourceDescriptor): void;
    addResourceTemplate(tpl: ResourceTemplate): void;
    addPrompt(p: PromptTemplate): void;
}
