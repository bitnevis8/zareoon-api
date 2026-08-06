/**
 * Capability 0 — chat message translation (assistant only; never auto-publishes content).
 * Stores original body untouched; translatedBody is the delivery language for the peer.
 */
const OpenAI = require("openai");
const config = require("config");
const { getParspackClient } = require("../parspackClient");
const { getParspackConfig, isFeatureEnabled } = require("../parspackConfig");
const { resolveChatTranslateModelId } = require("../modelCatalog");
const { consumeRateLimit } = require("../rateLimit");
const { CHAT_TRANSLATE_LANGUAGES, LANG_NAME } = require("../constants");

const ALLOWED = new Set(CHAT_TRANSLATE_LANGUAGES.map((l) => l.code));

function normalizeLang(code) {
  const c = String(code || "")
    .trim()
    .toLowerCase()
    .slice(0, 8);
  return ALLOWED.has(c) ? c : null;
}

function stripCodeFences(text) {
  let t = String(text || "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  }
  // strip accidental surrounding quotes
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("«") && t.endsWith("»")) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function errMessage(err) {
  return String(err?.error?.message || err?.message || "").trim();
}

function errorRank(err) {
  const msg = errMessage(err);
  if (/GoogleProvider failed/i.test(msg)) return 100;
  if (/Provider failed/i.test(msg)) return 90;
  if (/model .*not|not allowed|forbidden|unauthorized|401|403/i.test(msg)) return 80;
  if (/timeout|ETIMEDOUT|AbortError/i.test(msg)) return 40;
  if (/premature close|invalid response body/i.test(msg)) return 10;
  if (/empty translation/i.test(msg)) return 5;
  return 50;
}

function shortProviderError(err) {
  const msg = errMessage(err);
  if (!msg) return null;
  if (/GoogleProvider failed/i.test(msg)) {
    return "سرویس Google در ParsPack فعلاً قطع است — مدل Gemma";
  }
  if (/Provider failed/i.test(msg)) {
    return "ارائه‌دهنده مدل در ParsPack قطع است";
  }
  if (/premature close|invalid response body/i.test(msg)) {
    return "ParsPack پاسخ HTML/نامعتبر داد (مدل مجاز نیست یا محدودیت IP/بودجه)";
  }
  if (/timeout|ETIMEDOUT|AbortError/i.test(msg)) {
    return "زمان پاسخ ParsPack تمام شد";
  }
  return msg.slice(0, 140);
}

async function collectStreamText(stream) {
  let text = "";
  for await (const chunk of stream) {
    const piece = chunk?.choices?.[0]?.delta?.content;
    if (piece) text += piece;
  }
  return text;
}

/**
 * ParsPack docs use stream=true and usually a single user message.
 * We fold system instructions into the user prompt for compatibility.
 */
async function completeOnce(client, { modelId, prompt, maxTokens }) {
  const messages = [{ role: "user", content: prompt }];

  try {
    const stream = await client.chat.completions.create({
      model: modelId,
      messages,
      temperature: 0.2,
      max_tokens: maxTokens,
      stream: true,
    });
    return collectStreamText(stream);
  } catch (streamErr) {
    // Some gateways break on stream; try one non-stream attempt.
    try {
      const completion = await client.chat.completions.create({
        model: modelId,
        messages,
        temperature: 0.2,
        max_tokens: maxTokens,
        stream: false,
      });
      return completion?.choices?.[0]?.message?.content || "";
    } catch {
      throw streamErr;
    }
  }
}

function buildTranslatePrompt({ sourceHint, targetName, target, body }) {
  return [
    "You are a professional B2B marketplace chat translator for Zareoon.",
    "Translate the message into the requested target language.",
    "Output ONLY the translated text. No quotes, labels, or explanations.",
    "Preserve meaning. Do not add or remove facts.",
    "Keep brand names, company names, numbers, units, HS codes, emails, phones, and URLs unchanged.",
    `Source language hint: ${sourceHint}`,
    `Target language: ${targetName} (${target})`,
    "Message:",
    body,
  ].join("\n");
}

function getDeepseekClient() {
  if (!config.has("DEEPSEEK_API_KEY")) return null;
  const key = String(config.get("DEEPSEEK_API_KEY") || "").trim();
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: "https://api.deepseek.com",
    timeout: 30000,
    maxRetries: 1,
  });
}

async function tryDeepseekFallback({ prompt, maxTokens }) {
  const client = getDeepseekClient();
  if (!client) return null;
  const model = "deepseek-chat";
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: maxTokens,
  });
  return {
    text: completion?.choices?.[0]?.message?.content || "",
    modelId: `deepseek:${model}`,
  };
}

function resolveModelCandidates(primaryId) {
  const cfg = getParspackConfig().chatTranslate || {};
  const configured = Array.isArray(cfg.FALLBACK_MODEL_IDS)
    ? cfg.FALLBACK_MODEL_IDS.map(String).filter(Boolean)
    : [];
  const out = [];
  const push = (id) => {
    const v = String(id || "").trim();
    if (v && !out.includes(v)) out.push(v);
  };
  push(primaryId);
  // Only explicit fallbacks — auto-scanning catalog caused noisy 400s on restricted keys
  for (const id of configured) push(id);
  return out;
}

/**
 * @returns {Promise<{
 *   status: 'ok'|'failed'|'skipped'|'unavailable',
 *   translatedBody: string|null,
 *   targetLang: string|null,
 *   modelId: string|null,
 *   warning: string|null,
 *   usage: object|null
 * }>}
 */
async function translateChatText({
  userId,
  text,
  targetLang,
  sourceLang = null,
  preferredModelId = null,
}) {
  const target = normalizeLang(targetLang);
  if (!target) {
    return {
      status: "skipped",
      translatedBody: null,
      targetLang: null,
      modelId: null,
      warning: null,
      usage: null,
    };
  }

  const body = String(text || "").trim();
  if (!body) {
    return {
      status: "skipped",
      translatedBody: null,
      targetLang: target,
      modelId: null,
      warning: null,
      usage: null,
    };
  }

  const src = normalizeLang(sourceLang);
  if (src && src === target) {
    return {
      status: "skipped",
      translatedBody: null,
      targetLang: target,
      modelId: null,
      warning: null,
      usage: null,
    };
  }

  if (!isFeatureEnabled("CHAT_TRANSLATE")) {
    return {
      status: "unavailable",
      translatedBody: null,
      targetLang: target,
      modelId: null,
      warning: "دستیار ترجمه فعلاً در دسترس نیست. پیام با متن اصلی ارسال شد.",
      usage: null,
    };
  }

  const ct = getParspackConfig().chatTranslate || {};
  const maxChars = Number(ct.MAX_CHARS) || 4000;
  if (body.length > maxChars) {
    return {
      status: "failed",
      translatedBody: null,
      targetLang: target,
      modelId: null,
      warning: "متن برای ترجمه بیش از حد طولانی است. پیام با متن اصلی ارسال شد.",
      usage: null,
    };
  }

  const rate = consumeRateLimit(userId, "CHAT_TRANSLATE", {
    perMinute: Number(ct.RATE_PER_MINUTE) || 20,
    perDay: Number(ct.RATE_PER_DAY) || 200,
  });
  if (!rate.ok) {
    return {
      status: "unavailable",
      translatedBody: null,
      targetLang: target,
      modelId: null,
      warning: "محدودیت موقت ترجمه فعال است. پیام با متن اصلی ارسال شد.",
      usage: null,
    };
  }

  const client = getParspackClient();
  const { listChatModels } = require("../modelCatalog");
  const catalog = await listChatModels();
  const catalogIds = new Set(catalog.map((m) => m.id));

  let preferred = String(preferredModelId || "").trim();
  if (preferred && !catalogIds.has(preferred)) {
    // allow exact id even if filter excluded it, but only if present in raw list
    const { listModels } = require("../modelCatalog");
    const all = await listModels();
    if (!all.some((m) => m.id === preferred)) preferred = "";
  }

  const defaultModel = await resolveChatTranslateModelId();
  const primaryModel = preferred || defaultModel;
  const targetName = LANG_NAME[target] || target;
  const sourceHint = src ? LANG_NAME[src] || src : "auto-detect";
  const prompt = buildTranslatePrompt({ sourceHint, targetName, target, body });
  const maxTokens = Math.min(512, Math.max(64, Math.ceil(body.length * 2)));

  let bestError = null;
  let usedModel = primaryModel;

  if (client && primaryModel) {
    // User-selected model first; only use configured fallbacks if no preference
    const candidates = preferred
      ? [preferred]
      : resolveModelCandidates(primaryModel);
    for (const modelId of candidates) {
      usedModel = modelId;
      try {
        const raw = await completeOnce(client, { modelId, prompt, maxTokens });
        const translated = stripCodeFences(raw);
        if (!translated) {
          const emptyErr = new Error("empty translation");
          if (!bestError || errorRank(emptyErr) > errorRank(bestError)) bestError = emptyErr;
          continue;
        }
        return {
          status: "ok",
          translatedBody: translated.slice(0, 8000),
          targetLang: target,
          modelId,
          warning: null,
          usage: null,
        };
      } catch (err) {
        console.warn(`[ai] ParsPack translate failed on ${modelId}:`, errMessage(err));
        if (!bestError || errorRank(err) >= errorRank(bestError)) bestError = err;
        if (/GoogleProvider failed/i.test(errMessage(err))) break;
      }
    }
  } else if (!client || !primaryModel) {
    bestError = new Error("کلید یا مدل ParsPack تنظیم نشده است");
  }

  // Emergency fallback so chat UX is not blocked when ParsPack Google is down
  const allowDeepseek = ct.ALLOW_DEEPSEEK_FALLBACK !== false && !preferred;
  if (allowDeepseek) {
    try {
      const fb = await tryDeepseekFallback({ prompt, maxTokens });
      if (fb) {
        const translated = stripCodeFences(fb.text);
        if (translated) {
          console.warn("[ai] chat translate used DeepSeek fallback after ParsPack failure");
          return {
            status: "ok",
            translatedBody: translated.slice(0, 8000),
            targetLang: target,
            modelId: fb.modelId,
            warning: null,
            usage: null,
          };
        }
      }
    } catch (err) {
      console.warn("[ai] DeepSeek fallback failed:", errMessage(err));
      if (!bestError || errorRank(err) > errorRank(bestError)) bestError = err;
    }
  }

  const detail = shortProviderError(bestError);
  return {
    status: "failed",
    translatedBody: null,
    targetLang: target,
    modelId: usedModel,
    warning: detail
      ? `ترجمه انجام نشد (${detail}). پیام با متن اصلی ارسال شد.`
      : "ترجمه انجام نشد. پیام با متن اصلی ارسال شد.",
    usage: null,
  };
}

async function getChatTranslateOptionsPublic() {
  const enabled = isFeatureEnabled("CHAT_TRANSLATE");
  let models = [];
  let defaultModelId = null;
  if (enabled) {
    try {
      const { listChatModels, modelLabel } = require("../modelCatalog");
      models = await listChatModels();
      defaultModelId = await resolveChatTranslateModelId();
      if (defaultModelId && !models.some((m) => m.id === defaultModelId)) {
        models = [
          { id: defaultModelId, label: modelLabel(defaultModelId) || defaultModelId, ownedBy: null },
          ...models,
        ];
      } else if (defaultModelId) {
        // Pin default at top for easier selection
        const preferred = models.find((m) => m.id === defaultModelId);
        models = [preferred, ...models.filter((m) => m.id !== defaultModelId)];
      }
    } catch (e) {
      console.warn("[ai] listChatModels for options failed:", e?.message || e);
    }
  }
  return {
    enabled,
    languages: CHAT_TRANSLATE_LANGUAGES,
    models,
    defaultModelId,
    message: enabled
      ? null
      : "دستیار ترجمه فعلاً در دسترس نیست. می‌توانید بدون ترجمه پیام بفرستید.",
  };
}

module.exports = {
  translateChatText,
  normalizeLang,
  getChatTranslateOptionsPublic,
};
