import type { PromptTemplate } from "./types";

export function defaultPrompts(): PromptTemplate[] {
  return [
    {
      name: "prepare-scraper-rules",
      description: "Crea reglas de scraping seguras dadas unas restricciones",
      arguments: [
        { name: "destination", required: true },
        { name: "rateLimit", required: false },
        { name: "selectors", required: false }
      ],
      render: (args) => {
        return `Destino: ${args.destination}\nLímites: ${args.rateLimit ?? "auto"}\nSelectores: ${args.selectors ?? "auto"}`;
      }
    },
    {
      name: "triage-ingestion-issues",
      description: "Checklist para revisar fallos comunes de ingesta",
      arguments: [{ name: "jobId", required: true }],
      render: (args) => `Revisa logs y normaliza doc para job ${args.jobId}`
    }
  ];
}
