export function baseResourceTemplates() {
    return [
        { uriTemplate: "bs://datasets/{id}", parameters: [{ name: "id", required: true }] },
        { uriTemplate: "bs://datasets/{id}/docs/{docId}", parameters: [
                { name: "id", required: true }, { name: "docId", required: true }
            ] },
        { uriTemplate: "bs://entities/{entityId}/manifest", parameters: [{ name: "entityId", required: true }] },
        { uriTemplate: "bs://runs/{id}", parameters: [{ name: "id", required: true }] }
    ];
}
export function seedResources(ctx) {
    return [
        { uri: `bs://entities/${ctx.entityId ?? "general"}/manifest`, title: "Entity Manifest", mimeType: "application/json" }
    ];
}
