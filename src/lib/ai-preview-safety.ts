const MINOR_TERMS = /\b(child|children|kid|kids|minor|minors|underage|under[\s-]?age|teen|teens|teenage|teenager|young[\s-]+girl|young[\s-]+boy|little[\s-]+girl|school[\s-]?girl|pre[\s-]?teen|loli|lolita|juvenile|infant|toddler|baby)\b/i;
const EXPLICIT_TERMS = /\b(nude|naked|nudity|topless|bottomless|nsfw|porn|porno|pornographic|explicit|sex|sexual|genital|genitals|nipple|nipples|erotic)\b/i;

function normalizedSafetyText(value: string) {
  return value.normalize('NFKC').replace(/[\u2010-\u2015_]+/g, '-').replace(/\s+/g, ' ').trim();
}

export function aiPreviewSafetyIssue(value: string): 'minor' | 'explicit' | null {
  const text = normalizedSafetyText(value);
  const ages = [...text.matchAll(/\b(\d{1,2})\s*(?:yo|y\/o|yrs?|years?)(?:\s*old)?\b/gi)]
    .map((match) => Number(match[1]));

  if (MINOR_TERMS.test(text) || ages.some((age) => age < 18)) return 'minor';
  if (EXPLICIT_TERMS.test(text)) return 'explicit';
  return null;
}

export function isAiPreviewEligibleProduct(product: { title: string; description: string }) {
  return aiPreviewSafetyIssue(`${product.title} ${product.description}`) === null;
}

export function aiPreviewRefusal(issue: 'minor' | 'explicit') {
  return issue === 'minor'
    ? 'AI preview is unavailable for this request. Preview generation is limited to unambiguously adult fashion content.'
    : 'Please describe body shape and size only.';
}
