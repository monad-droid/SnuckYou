export type VerdictCategory =
  | "Consumer Benefit"
  | "Cost Cutting"
  | "Health Concern"
  | "Neutral";

export type IngredientVerdict = {
  category: VerdictCategory;
  explanation: string;
  confidence: number; // 0-100
};

const VALID_CATEGORIES: VerdictCategory[] = [
  "Consumer Benefit",
  "Cost Cutting",
  "Health Concern",
  "Neutral",
];

const MODEL_ID =
  process.env.HF_MODEL_ID || "HuggingFaceH4/zephyr-7b-beta";

const PROMPT_TEMPLATE = `<|system|>
You are a food industry analyst. Given a before/after ingredient list for a food product, classify the change into exactly one category and provide a brief explanation (1-2 sentences). Also provide a confidence score from 0 to 100.

Categories:
- "Consumer Benefit": Healthier ingredients, removal of artificial additives, organic upgrades, cleaner label
- "Cost Cutting": Cheaper substitutes (e.g. cocoa butter replaced with palm oil), fillers added, quality ingredients replaced with lower-cost alternatives
- "Health Concern": Addition of known allergens, controversial additives, artificial colors/preservatives, or higher sugar/sodium content
- "Neutral": Minor reformulation, supplier name change, reordering without meaningful impact, or ambiguous change

Respond ONLY with valid JSON: {"category": "<one of the four>", "explanation": "<1-2 sentences>", "confidence": <0-100>}</s>
<|user|>
BEFORE: {{BEFORE}}
AFTER: {{AFTER}}</s>
<|assistant|>
`;

function parseVerdict(raw: string): IngredientVerdict | null {
  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(raw.trim());
    if (parsed.category && VALID_CATEGORIES.includes(parsed.category)) {
      return {
        category: parsed.category,
        explanation: String(parsed.explanation || "").slice(0, 500),
        confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
      };
    }
  } catch {
    // Fall through to regex extraction
  }

  // Try extracting JSON from surrounding text
  const jsonMatch = raw.match(/\{[^}]*"category"[^}]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.category && VALID_CATEGORIES.includes(parsed.category)) {
        return {
          category: parsed.category,
          explanation: String(parsed.explanation || "").slice(0, 500),
          confidence: Math.min(
            100,
            Math.max(0, Number(parsed.confidence) || 50)
          ),
        };
      }
    } catch {
      // Fall through
    }
  }

  // Last resort: look for category string anywhere
  for (const cat of VALID_CATEGORIES) {
    if (raw.includes(cat)) {
      return {
        category: cat,
        explanation: "Analysis partially parsed.",
        confidence: 20,
      };
    }
  }

  return null;
}

// Track calls per invocation to respect rate limits
let callCount = 0;
const MAX_CALLS_PER_INVOCATION = 50;

export async function analyzeIngredientChange(
  before: string,
  after: string
): Promise<IngredientVerdict | null> {
  const token = process.env.HF_ACCESS_TOKEN;
  if (!token) {
    console.warn("[hf-analysis] HF_ACCESS_TOKEN not set, skipping AI analysis");
    return null;
  }

  if (callCount >= MAX_CALLS_PER_INVOCATION) {
    console.warn("[hf-analysis] Rate limit reached for this invocation, skipping");
    return null;
  }

  callCount++;

  const prompt = PROMPT_TEMPLATE
    .replace("{{BEFORE}}", before.slice(0, 1500))
    .replace("{{AFTER}}", after.slice(0, 1500));

  try {
    const res = await fetch(
      `https://router.huggingface.co/hf-inference/models/${MODEL_ID}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 300,
            temperature: 0.1,
            return_full_text: false,
          },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`[hf-analysis] HTTP ${res.status}: ${body}`);
      return null;
    }

    const data = await res.json();
    const content = data?.[0]?.generated_text;
    if (!content) {
      console.error("[hf-analysis] No generated_text in response:", JSON.stringify(data));
      return null;
    }

    console.log("[hf-analysis] Raw response:", content.slice(0, 200));
    return parseVerdict(content);
  } catch (err) {
    console.error("[hf-analysis] Error:", err instanceof Error ? err.message : err);
    return null;
  }
}
