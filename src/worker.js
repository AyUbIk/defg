// Speakyz: Cloudflare Worker. Serves the static site (public/) and the AI endpoint POST /api/chat.
// Secret required: GOOGLE_API_KEY or GEMINI_API_KEY. Optional vars: GEMINI_MODEL / MODEL.

const MAX_MESSAGES = 12;
const MAX_CHARS = 6000;
const LANGS = { ru: "Russian", uz: "Uzbek (Latin script)", en: "English" };

const BASE = `You are the AI teacher of Speakyz, an English school in Tashkent (speaking clubs, IELTS preparation, individual lessons; the first Speaking lesson is free). Be warm, direct and concise. Help students improve speaking, grammar, writing and IELTS performance. Keep answers practical, friendly and easy to understand. Always answer in the user's language when possible, and use short examples in English when relevant.`;

const MODES = {
  speaking: `Task: give feedback on an IELTS Speaking answer. The user sends the question and a transcript of their spoken answer.
Score the four IELTS criteria on a 0 to 9 scale in steps of 0.5: Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation (say Pronunciation can only be estimated from speech, so be careful and explain it is approximated). Give a short overall band and 3 practical fixes. Keep the feedback encouraging but clear.`,
  writing: `Task: give feedback on an IELTS Writing answer (Task 1 or Task 2). The user sends the task and the essay.
Score Task Achievement or Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy on a 0 to 9 scale in steps of 0.5, then an approximate overall band. List the 3 most important improvements, with examples. Keep tone constructive and realistic.`,
  teacher: {
    free: `Task: free chat. Answer questions about English, IELTS and learning plans. Explain simply with short examples. Ask one follow-up question when it helps.`,
    grammar: `Task: grammar correction. The user writes English sentences. Reply with: the corrected sentence, then a one or two sentence explanation of each mistake in the user's interface language. Keep it practical and clear.`,
    speaking: `Task: speaking practice. Play an IELTS Speaking examiner and conversation partner. Speak English only, in short turns (1 to 3 sentences), ask one question at a time. After each user response, give a light correction or one actionable improvement.`,
  },
};

// ---------- SEO: per-page meta, robots.txt, sitemap.xml ----------
const PAGES = {
  "/": ["Speakyz — курсы английского и IELTS в Ташкенте", "Разговорные клубы, подготовка к IELTS и индивидуальные уроки английского в Ташкенте."],
  "/courses": ["Курсы английского в Ташкенте: Speaking club, IELTS, индивидуальные | Speakyz", "Speaking club, подготовка к IELTS и индивидуальные уроки английского в Ташкенте."],
  "/ielts": ["Подготовка к IELTS в Ташкенте | Speakyz", "Все четыре части IELTS: Speaking, Writing, Listening и Reading. Пробные тесты и разборы."],
  "/teachers": ["Преподаватели английского | Speakyz", "Познакомьтесь с преподавателями Speakyz и запишитесь на урок к ним."],
  "/schedule": ["Запись на бесплатный урок | Speakyz", "Выберите курс, формат, преподавателя и удобное время. Точную группу и время мы уточним в Telegram."],
  "/shop": ["Книги и курсы IELTS: Speaking 8.0, Writing 8.0, Reading 8.0 | Speakyz", "PDF-книги для подготовки к IELTS и курсы Speakyz. Первый урок Speaking бесплатный."],
  "/test": ["Тест уровня английского онлайн | Speakyz", "Три теста по уровням, 15 вопросов в каждом, результат сразу. Простой способ понять свой уровень."],
  "/university": ["Требования вузов к IELTS | Speakyz", "Минимальные баллы IELTS университетов с источником и датой проверки."],
  "/contact": ["Контакты Speakyz: Юнусабад, Ташкент", "Адрес, Telegram и ответы на частые вопросы. Занятия офлайн в Юнусабад и онлайн."],
};

const esc = (x) => x.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function seoPage(html, base, path) {
  const [title, desc] = PAGES[path];
  const url = base + (path === "/" ? "/" : path);
  const ld = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "Speakyz",
    url: base + "/",
    description: PAGES["/"][1],
    image: base + "/og.png",
    address: { "@type": "PostalAddress", streetAddress: "Yunus-Abad, 19 kv., near School 257", addressLocality: "Tashkent", addressCountry: "UZ" },
    sameAs: ["https://www.instagram.com/speakyz_engl", "https://youtube.com/@speakyz", "https://t.me/SpeakyzEnglish"],
  };
  const head = [
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Speakyz">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${base}/og.png">`,
    `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`,
    `<meta property="og:locale" content="ru_RU"><meta property="og:locale:alternate" content="uz_UZ"><meta property="og:locale:alternate" content="en_US">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${base}/og.png">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
  ].join("\n");
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`)
    .replace("</head>", head + "\n</head>");
}

function robots(base) {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`;
}

function sitemap(base) {
  const urls = Object.keys(PAGES).map((p) => `  <url><loc>${base}${p === "/" ? "/" : p}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function cleanMessages(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const m of list.slice(-MAX_MESSAGES)) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    const content = m.content.slice(0, MAX_CHARS).trim();
    if (!content) return null;
    out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out.length && out[out.length - 1].role === "user" ? out : null;
}

function getGoogleApiKey(env) {
  return env.GOOGLE_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY;
}

function getGoogleModel(env) {
  return env.GEMINI_MODEL || env.GOOGLE_MODEL || env.MODEL || "gemini-2.5-flash";
}

function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

async function chat(request, env) {
  const apiKey = getGoogleApiKey(env);
  if (!apiKey) return json({ error: "not_configured" }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }

  const mode = body.mode;
  const sub = body.sub;
  const lang = LANGS[body.lang] ? body.lang : "ru";
  let task = MODES[mode];
  if (mode === "teacher") task = MODES.teacher[sub] || MODES.teacher.free;
  if (typeof task !== "string") return json({ error: "bad_mode" }, 400);
  const messages = cleanMessages(body.messages);
  if (!messages) return json({ error: "bad_messages" }, 400);

  const system = `${BASE}\n\n${task}\n\nWrite your reply in ${LANGS[lang]}, except for English examples and corrections, which stay in English. Use plain text without markdown tables.`;
  const model = getGoogleModel(env);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    system_instruction: { parts: [{ text: system }] },
    generationConfig: { maxOutputTokens: 700, temperature: 0.7 },
    contents: toGeminiContents(messages),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Gemini API error", res.status, errText);
    return json({ error: "upstream_" + res.status }, 502);
  }

  const data = await res.json();
  const reply = (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .filter((part) => typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();

  if (!reply) return json({ error: "empty" }, 502);
  return json({ reply });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const base = (env.SITE_URL || url.origin).replace(/\/+$/, "");
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";

    if (path === "/api/chat") {
      if (request.method !== "POST") return json({ error: "method" }, 405);
      const origin = request.headers.get("Origin");
      if (origin && new URL(origin).host !== url.host) return json({ error: "forbidden" }, 403);
      try { return await chat(request, env); } catch (err) {
        console.error("chat failed", err);
        return json({ error: "server" }, 500);
      }
    }

    if (path === "/robots.txt") return new Response(robots(base), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    if (path === "/sitemap.xml") return new Response(sitemap(base), { headers: { "Content-Type": "application/xml; charset=utf-8" } });
    if (request.method === "GET" && PAGES[path]) {
      const res = await env.ASSETS.fetch(new Request(url.origin + "/", { headers: request.headers }));
      const html = await res.text();
      return new Response(seoPage(html, base, path), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
    }
    return env.ASSETS.fetch(request);
  },
};
