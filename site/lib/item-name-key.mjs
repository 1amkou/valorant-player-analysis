// Exported inventory names sometimes differ from the public catalog in case,
// spacing, punctuation or typographic quote/dash style.
export const itemNameKey = value => value.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu,'');
