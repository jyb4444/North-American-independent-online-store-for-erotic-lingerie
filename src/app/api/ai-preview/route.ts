import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const DEFAULT_HF_MODEL = 'black-forest-labs/FLUX.1-schnell';
const HF_ROUTER_BASE_URL = 'https://router.huggingface.co/hf-inference/models';
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 120_000;

type AiPreviewRequest = {
  productTitle?: string;
  productDescription?: string;
  bodyDescription?: string;
  productImage?: string;
};

type HuggingFaceError = {
  error?: string | string[];
  estimated_time?: number;
  message?: string;
};

function getHuggingFaceConfig() {
  const token = process.env.HF_TOKEN?.trim();
  const model = process.env.HF_MODEL?.trim() || DEFAULT_HF_MODEL;
  const width = Number(process.env.HF_IMAGE_WIDTH ?? 768);
  const height = Number(process.env.HF_IMAGE_HEIGHT ?? 1024);
  const steps = Number(process.env.HF_INFERENCE_STEPS ?? 4);

  return {
    token,
    model,
    endpoint: `${HF_ROUTER_BASE_URL}/${model}`,
    width: Number.isFinite(width) ? width : 768,
    height: Number.isFinite(height) ? height : 1024,
    steps: Number.isFinite(steps) ? steps : 4,
  };
}

function buildPrompt(productTitle: string, productDescription: string, bodyDescription: string): string {
  const styleKeywords = productDescription
    .replace(/[^a-zA-Z\s,]/g, '')
    .split(/[\s,]+/)
    .filter((w) =>
      ['lace', 'satin', 'mesh', 'sheer', 'strappy', 'floral', 'robe', 'silk', 'velvet', 'chiffon'].includes(
        w.toLowerCase()
      )
    )
    .slice(0, 3)
    .join(', ');

  return [
    `Tasteful high-end fashion editorial photograph of ${bodyDescription}`,
    `wearing a garment inspired by ${productTitle}`,
    styleKeywords ? `with ${styleKeywords} fabric details` : '',
    'professional studio fashion photography',
    'soft diffused lighting, clean neutral background',
    'accurate body proportions, full outfit visible, sharp focus, 4k quality',
  ]
    .filter(Boolean)
    .join(', ');
}

function buildNegativePrompt(): string {
  return [
    'explicit nudity',
    'pornographic',
    'distorted body',
    'extra limbs',
    'deformed hands',
    'blurry',
    'low quality',
    'text',
    'watermark',
    'logo',
  ].join(', ');
}

function normalizeHuggingFaceError(status: number, detail: string): string {
  if (status === 401) {
    return 'Hugging Face token is invalid or missing access. Create a new token and set HF_TOKEN in .env.local.';
  }

  if (status === 402 || detail.toLowerCase().includes('credits')) {
    return 'Hugging Face account has no available inference credits. Check Billing/Inference Providers credits on huggingface.co.';
  }

  if (status === 403) {
    if (detail.toLowerCase().includes('inference providers')) {
      return 'Your Hugging Face token does not have Inference Providers permission. Create a new token with permission to call Inference Providers, update HF_TOKEN, then restart the dev server.';
    }

    return 'Hugging Face refused this request. Check that your token has inference permission and that the model is available to your account.';
  }

  if (status === 404) {
    return 'Hugging Face model was not found. Check HF_MODEL in .env.local.';
  }

  if (status === 429) {
    return 'Hugging Face rate limit reached. Wait a minute and try again.';
  }

  return detail || `Hugging Face error (${status})`;
}

async function readHuggingFaceError(res: Response): Promise<HuggingFaceError> {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as HuggingFaceError;
  } catch {
    return { error: text };
  }
}

function getErrorMessage(err: HuggingFaceError): string {
  if (Array.isArray(err.error)) return err.error.join(' ');
  return err.error ?? err.message ?? '';
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Authenticated users: 5 previews/min. Guests: 2 previews/min to limit abuse.
  const ip = getClientIp(req);
  const rlKey = user ? `ai-preview:${user.id}` : `ai-preview-guest:${ip}`;
  const rlLimit = user ? 5 : 2;
  const { allowed } = rateLimit(rlKey, { limit: rlLimit, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 }
    );
  }

  const config = getHuggingFaceConfig();

  if (!config.token) {
    return NextResponse.json(
      {
        error:
          'AI preview requires HF_TOKEN. Create a Hugging Face token, add HF_TOKEN to .env.local, then restart the dev server.',
      },
      { status: 503 }
    );
  }

  let body: AiPreviewRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { productTitle, productDescription, bodyDescription } = body;
  if (!productTitle || !bodyDescription) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const prompt = buildPrompt(productTitle, productDescription ?? '', bodyDescription);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            width: config.width,
            height: config.height,
            num_inference_steps: config.steps,
            negative_prompt: buildNegativePrompt(),
          },
          options: { wait_for_model: true },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        return NextResponse.json(
          { error: 'Preview timed out. The model may be loading. Please try again in 30 seconds.' },
          { status: 504 }
        );
      }

      console.error('Hugging Face request failed:', err);
      return NextResponse.json(
        {
          error:
            'Could not reach Hugging Face from the server. Check your internet connection, VPN/proxy, or try again in a moment.',
        },
        { status: 502 }
      );
    }

    if (res.status === 503) {
      const errJson = await readHuggingFaceError(res);
      const waitSecs = errJson.estimated_time ?? 20;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, Math.min(waitSecs, 30) * 1000));
        continue;
      }
      return NextResponse.json(
        { error: 'Model is warming up. Please try again in about 30 seconds.' },
        { status: 503 }
      );
    }

    if (!res.ok) {
      const errJson = await readHuggingFaceError(res);
      const detail = getErrorMessage(errJson);
      console.error(`Hugging Face ${res.status}:`, detail);
      return NextResponse.json(
        { error: normalizeHuggingFaceError(res.status, detail) },
        { status: res.status === 401 || res.status === 403 ? 503 : 502 }
      );
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      const errJson = await readHuggingFaceError(res);
      const detail = getErrorMessage(errJson) || 'Hugging Face did not return an image.';
      return NextResponse.json({ error: normalizeHuggingFaceError(res.status, detail) }, { status: 502 });
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({ imageUrl: dataUrl, model: config.model });
  }

  return NextResponse.json({ error: 'Failed after retries. Please try again.' }, { status: 500 });
}
