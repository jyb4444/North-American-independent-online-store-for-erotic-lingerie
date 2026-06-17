export type CupSize = 'A' | 'B' | 'C' | 'D' | 'DD+';
export type BodyShape = 'hourglass' | 'pear' | 'apple' | 'rectangle' | 'inverted-triangle';
export type SkinTone = 'fair' | 'light' | 'medium' | 'dark' | 'deep';
export type SizeLabel = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'Free Size';

export type FitInput = {
  height: number;    // cm
  bust: number;      // cm (fullest point)
  waist: number;     // cm (narrowest point)
  hip: number;       // cm (fullest point)
  cupSize: CupSize;
  bodyShape: BodyShape;
  skinTone: SkinTone;
};

export type FitResult = {
  recommendedSize: SizeLabel;
  confidence: 'perfect' | 'good' | 'approximate';
  fitNotes: string[];
  styleNotes: string[];
  hemlineNote: string;
  aiPromptDescription: string; // used for AI image generation
};

// Size chart in cm
const SIZE_CHART: Record<SizeLabel, { bust: [number, number]; waist: [number, number]; hip: [number, number] }> = {
  XS:  { bust: [79, 82],  waist: [58, 62],  hip: [84, 87]  },
  S:   { bust: [83, 87],  waist: [63, 67],  hip: [88, 92]  },
  M:   { bust: [88, 92],  waist: [68, 72],  hip: [93, 97]  },
  L:   { bust: [93, 99],  waist: [73, 79],  hip: [98, 104] },
  XL:  { bust: [100, 107], waist: [80, 86], hip: [105, 112] },
  XXL: { bust: [108, 115], waist: [87, 94], hip: [113, 120] },
  'Free Size': { bust: [79, 99], waist: [58, 86], hip: [84, 104] },
};

function inRange(value: number, [min, max]: [number, number]): boolean {
  return value >= min && value <= max;
}

function scoreMeasurement(value: number, range: [number, number]): number {
  const [min, max] = range;
  const mid = (min + max) / 2;
  const halfSpan = (max - min) / 2;
  if (value < min) return Math.max(0, 1 - (min - value) / halfSpan);
  if (value > max) return Math.max(0, 1 - (value - max) / halfSpan);
  return 1 - Math.abs(value - mid) / halfSpan;
}

export function calculateSize(input: FitInput): FitResult {
  const { height, bust, waist, hip, cupSize, bodyShape, skinTone } = input;

  // Score each size (bust is weighted most for intimate apparel)
  const sizes: SizeLabel[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  let bestSize: SizeLabel = 'M';
  let bestScore = -1;

  for (const size of sizes) {
    const chart = SIZE_CHART[size];
    const bustScore = scoreMeasurement(bust, chart.bust);
    const waistScore = scoreMeasurement(waist, chart.waist);
    const hipScore = scoreMeasurement(hip, chart.hip);
    // Bust weighted highest for lingerie
    const total = bustScore * 0.5 + waistScore * 0.25 + hipScore * 0.25;
    if (total > bestScore) { bestScore = total; bestSize = size; }
  }

  // Confidence based on how well measurements fit
  const chart = SIZE_CHART[bestSize];
  const bustFit = inRange(bust, chart.bust);
  const waistFit = inRange(waist, chart.waist);
  const hipFit = inRange(hip, chart.hip);
  const matchCount = [bustFit, waistFit, hipFit].filter(Boolean).length;
  const confidence = matchCount === 3 ? 'perfect' : matchCount === 2 ? 'good' : 'approximate';

  // Cup size notes
  const fitNotes: string[] = [];
  if (cupSize === 'DD+') {
    fitNotes.push('For DD+ cups: pieces with underwire or structured cups will give the best support and shape.');
    fitNotes.push('Consider sizing up one size from your rib-cage measurement for extra cup room.');
  } else if (cupSize === 'D') {
    fitNotes.push('Built-in cups in this style should work well for your D cup. Check the cup depth notes on the product.');
  } else if (cupSize === 'A') {
    fitNotes.push('Adjustable straps will help achieve the right fit for your frame. Padding inserts are compatible if desired.');
  }

  // Body shape notes
  if (bodyShape === 'pear') {
    fitNotes.push('Pear shape: prioritize hip measurement when sizing. The waist will have slight extra room, which adds a flattering drape effect.');
  } else if (bodyShape === 'apple') {
    fitNotes.push('Apple shape: prioritize bust and waist. The fuller coverage at the hip creates a balanced silhouette.');
  } else if (bodyShape === 'rectangle') {
    fitNotes.push('Rectangle shape: ruched or structured styles will add dimension. Babydoll cuts are especially flattering.');
  } else if (bodyShape === 'hourglass') {
    fitNotes.push('Hourglass shape: this style is designed to complement your proportions. Your measurements are close to the fit model.');
  } else if (bodyShape === 'inverted-triangle') {
    fitNotes.push('Inverted-triangle: styles with detail at the hip (ruffles, lace trim) will balance your silhouette beautifully.');
  }

  // Hemline based on height
  const styleNotes: string[] = [];
  let hemlineNote = '';
  if (height < 158) {
    hemlineNote = 'At your height, babydoll styles will fall at mid-thigh. Chemises will hit closer to the knee for a more modest look.';
    styleNotes.push('Short-cut styles and mini babydolls will give the most proportional look on your frame.');
  } else if (height <= 170) {
    hemlineNote = 'Babydoll styles will fall at mid-to-upper thigh. Chemise styles will hit at mid-thigh — a very flattering length.';
    styleNotes.push('Most styles in our range are designed for this height range and will fall as photographed.');
  } else {
    hemlineNote = 'On your taller frame, babydolls will sit higher (upper thigh) and chemises will fall at mid-thigh.';
    styleNotes.push('Maxi-length styles and chemises will give the most coverage. Bodysuits and teddies are always a great fit regardless of height.');
  }

  // AI generation prompt (for Replicate)
  const heightDesc = height < 158 ? 'petite' : height <= 170 ? 'average-height' : 'tall';
  const shapeDesc: Record<BodyShape, string> = {
    hourglass: 'hourglass figure with defined waist',
    pear: 'pear-shaped figure with fuller hips',
    apple: 'apple-shaped figure with fuller midsection',
    rectangle: 'athletic and straight figure',
    'inverted-triangle': 'inverted triangle figure with broad shoulders',
  };
  const toneDesc: Record<SkinTone, string> = {
    fair: 'fair skin',
    light: 'light skin',
    medium: 'medium skin tone',
    dark: 'dark skin tone',
    deep: 'deep skin tone',
  };

  const aiPromptDescription = `a ${heightDesc} woman with a ${shapeDesc[bodyShape]}, ${toneDesc[skinTone]}`;

  return { recommendedSize: bestSize, confidence, fitNotes, styleNotes, hemlineNote, aiPromptDescription };
}

// Convert cm to inches for display
export function cmToInches(cm: number): string {
  return (cm / 2.54).toFixed(1) + '"';
}

// Body shape descriptions for UI
export const BODY_SHAPE_LABELS: Record<BodyShape, { label: string; description: string; emoji: string }> = {
  hourglass: { label: 'Hourglass', description: 'Bust ≈ hip, defined waist', emoji: '⧖' },
  pear: { label: 'Pear', description: 'Hip wider than bust', emoji: '🍐' },
  apple: { label: 'Apple', description: 'Fuller through the middle', emoji: '🍎' },
  rectangle: { label: 'Rectangle', description: 'Bust ≈ waist ≈ hip', emoji: '▭' },
  'inverted-triangle': { label: 'Inverted Triangle', description: 'Bust wider than hip', emoji: '▽' },
};

export const SKIN_TONE_LABELS: Record<SkinTone, { label: string; hex: string }> = {
  fair: { label: 'Fair', hex: '#f5e6d3' },
  light: { label: 'Light', hex: '#e8c9a0' },
  medium: { label: 'Medium', hex: '#c68642' },
  dark: { label: 'Dark', hex: '#8d5524' },
  deep: { label: 'Deep', hex: '#4a2912' },
};
