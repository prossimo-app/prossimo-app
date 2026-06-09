export type LegalDocument = "privacy-policy" | "terms";

export function getLegalDocumentUrl(document: LegalDocument) {
  return `https://prossimo.app/${document}`;
}
