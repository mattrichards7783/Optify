const cheerio = require("cheerio");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "OptifyAnalyzer/1.0 (+https://vercel.com)",
      },
      redirect: "follow",
    });
    const duration = Date.now() - start;
    const html = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      duration,
      html,
      finalUrl: response.url,
      contentLength: Number(response.headers.get("content-length") || html.length || 0),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchPageSpeed(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("strategy", "desktop");
    ["performance", "accessibility", "seo", "best-practices"].forEach((category) => {
      endpoint.searchParams.append("category", category);
    });

    if (process.env.PSI_API_KEY) {
      endpoint.searchParams.set("key", process.env.PSI_API_KEY);
    }

    const response = await fetch(endpoint.toString(), {
      signal: controller.signal,
      headers: {
        "user-agent": "OptifyAnalyzer/1.0 (+https://vercel.com)",
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function readAudit(lighthouse, auditId) {
  const audit = lighthouse?.audits?.[auditId];
  if (!audit) return null;

  return {
    id: auditId,
    title: audit.title,
    description: audit.description,
    score: audit.score,
    displayValue: audit.displayValue,
  };
}

function extractLighthouseInsights(lighthouse) {
  if (!lighthouse) return null;

  const categories = lighthouse.categories || {};
  const audits = lighthouse.audits || {};

  const keyAudits = [
    "first-contentful-paint",
    "largest-contentful-paint",
    "speed-index",
    "total-blocking-time",
    "interactive",
    "cumulative-layout-shift",
    "server-response-time",
  ]
    .map((id) => readAudit(lighthouse, id))
    .filter(Boolean);

  const opportunities = Object.values(audits)
    .filter((audit) => audit?.details?.type === "opportunity")
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
    .slice(0, 6)
    .map((audit) => ({
      id: audit.id,
      title: audit.title,
      score: audit.score,
      displayValue: audit.displayValue,
    }));

  const diagnostics = Object.values(audits)
    .filter((audit) => audit?.scoreDisplayMode === "numeric")
    .filter((audit) => typeof audit.score === "number" && audit.score < 0.9)
    .slice(0, 6)
    .map((audit) => ({
      id: audit.id,
      title: audit.title,
      score: audit.score,
      displayValue: audit.displayValue,
    }));

  return {
    categories: {
      performance: categories.performance?.score,
      accessibility: categories.accessibility?.score,
      seo: categories.seo?.score,
      bestPractices: categories["best-practices"]?.score,
    },
    keyAudits,
    opportunities,
    diagnostics,
  };
}

function scoreUi($) {
  const semantic = ["header", "main", "section", "article", "footer", "nav"].reduce(
    (sum, tag) => sum + $(tag).length,
    0,
  );
  const headingCount = $("h1, h2, h3").length;
  const ctaCount = $("a, button").filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return /start|book|buy|trial|demo|contact|get started|sign up/.test(text);
  }).length;

  let score = 45;
  score += clamp(semantic * 2, 0, 20);
  score += clamp(headingCount, 0, 12);
  score += clamp(ctaCount * 2, 0, 18);

  return clamp(score, 25, 98);
}

function scoreSpeed(fetchDuration, contentLength, $) {
  const scripts = $("script[src]").length;
  const styles = $("link[rel='stylesheet']").length;
  const images = $("img").length;

  let score = 95;
  score -= clamp(Math.floor(fetchDuration / 80), 0, 30);
  score -= clamp(Math.floor(contentLength / 45000), 0, 25);
  score -= clamp((scripts + styles) * 2, 0, 20);
  score -= clamp(Math.floor(images / 4), 0, 12);

  return clamp(score, 20, 99);
}

function scoreAccessibility($) {
  const images = $("img");
  const imagesCount = images.length;
  const altCount = images.filter((_, el) => !!$(el).attr("alt")).length;

  const inputs = $("input, select, textarea");
  const inputCount = inputs.length;
  const labeledCount = inputs.filter((_, el) => {
    const id = $(el).attr("id");
    if (!id) return false;
    return $(`label[for='${id}']`).length > 0;
  }).length;

  const hasLang = $("html").attr("lang") ? 1 : 0;

  const imgRatio = imagesCount ? altCount / imagesCount : 1;
  const formRatio = inputCount ? labeledCount / inputCount : 1;

  let score = 40;
  score += Math.round(imgRatio * 25);
  score += Math.round(formRatio * 25);
  score += hasLang ? 8 : 0;
  score += $("main").length ? 8 : 0;

  return clamp(score, 25, 98);
}

function scoreSeo($) {
  const title = $("title").text().trim();
  const metaDescription = $("meta[name='description']").attr("content");
  const h1Count = $("h1").length;
  const canonical = $("link[rel='canonical']").attr("href");
  const ogTitle = $("meta[property='og:title']").attr("content");

  let score = 30;
  if (title && title.length >= 15) score += 22;
  if (metaDescription && metaDescription.length >= 50) score += 20;
  if (h1Count === 1) score += 12;
  if (canonical) score += 8;
  if (ogTitle) score += 8;
  score += clamp($("h2").length * 2, 0, 16);

  return clamp(score, 18, 99);
}

function scoreConversion($) {
  const bodyText = $("body").text().toLowerCase();

  const keywords = [
    "testimonial",
    "customer",
    "pricing",
    "faq",
    "free trial",
    "book demo",
    "case study",
    "guarantee",
  ];

  const keywordHits = keywords.reduce((sum, keyword) => sum + (bodyText.includes(keyword) ? 1 : 0), 0);
  const ctaCount = $("a, button").filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return /start|get started|trial|demo|sign up|book|contact|buy/.test(text);
  }).length;

  let score = 35;
  score += clamp(keywordHits * 7, 0, 35);
  score += clamp(ctaCount * 2, 0, 26);

  return clamp(score, 20, 98);
}

function detectLayout($) {
  const sections = [];

  $("header, main section, section, article, nav, footer").each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const id = ($(el).attr("id") || "").toLowerCase();
    const cls = ($(el).attr("class") || "").toLowerCase();
    const text = `${tag} ${id} ${cls}`;

    if (/hero|masthead|banner/.test(text)) sections.push("hero");
    else if (/feature|benefit|capabilit/.test(text)) sections.push("features");
    else if (/testimonial|review|social-proof|case-study/.test(text)) sections.push("social proof");
    else if (/pricing|plan/.test(text)) sections.push("pricing");
    else if (/faq|question/.test(text)) sections.push("faq");
    else if (tag === "footer") sections.push("footer");
    else if (tag === "nav") sections.push("navigation");
  });

  const deduped = [...new Set(sections)];
  const findings = [];

  findings.push(`Detected ${$("section, article").length} primary content blocks.`);
  findings.push(`Detected ${$("a, button").length} interactive action elements.`);

  if (!deduped.includes("hero")) findings.push("No explicit hero block detected by class/id hints.");
  if (!deduped.includes("social proof")) findings.push("Social proof section appears missing or weakly labeled.");
  if (!deduped.includes("pricing")) findings.push("Pricing/plan section not clearly identifiable.");

  const order = deduped.join(" -> ") || "unknown";
  findings.push(`Inferred section flow: ${order}.`);

  return {
    inferredOrder: deduped,
    findings,
  };
}

function buildReorderSuggestions(layout, scores) {
  const ui = scores.find((s) => s.label === "UI")?.value || 0;
  const speed = scores.find((s) => s.label === "Speed")?.value || 0;
  const conversion = scores.find((s) => s.label === "Conversion")?.value || 0;

  const suggestions = [
    "Use sequence: Hero -> Features -> Social Proof -> Pricing/Offer -> FAQ -> Final CTA -> Footer.",
    "Move one high-impact CTA directly into hero and repeat a secondary CTA after social proof.",
    "Group related feature cards into 3 to 6 scannable blocks with tighter headline hierarchy.",
  ];

  if (ui < 75) {
    suggestions.push("Reduce visual noise by removing duplicate section styles and increasing spacing rhythm consistency.");
  }

  if (speed < 70) {
    suggestions.push("Move heavy media lower in page order and lazy-load all below-the-fold assets.");
  }

  if (conversion < 75) {
    suggestions.push("Move testimonial and pricing clarity blocks above long explanatory content.");
  }

  if (!layout.inferredOrder.includes("social proof")) {
    suggestions.push("Add a social proof component before pricing to increase trust before decision points.");
  }

  return suggestions;
}

function buildPrompt(url, scores, findings, reorder, pageInfo, lighthouse) {
  const scoreLines = scores.map((s) => `- ${s.label}: ${s.value}/100`).join("\n");
  const findingLines = findings.map((f) => `- ${f}`).join("\n");
  const reorderLines = reorder.map((r, i) => `${i + 1}. ${r}`).join("\n");
  const auditLines = (lighthouse?.keyAudits || [])
    .map((audit) => `- ${audit.title}: ${audit.displayValue || "n/a"}`)
    .join("\n");
  const opportunityLines = (lighthouse?.opportunities || [])
    .map((audit) => `- ${audit.title}${audit.displayValue ? ` (${audit.displayValue})` : ""}`)
    .join("\n");
  const pageLines = [
    pageInfo?.title ? `- Title: ${pageInfo.title}` : null,
    pageInfo?.metaDescription ? `- Meta description: ${pageInfo.metaDescription}` : null,
    pageInfo?.h1 ? `- H1: ${pageInfo.h1}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a senior SaaS UX designer and frontend engineer.\n\nAnalyze and redesign this website: ${url}\n\nCurrent scores (audit data where available):\n${scoreLines}\n\nObserved page metadata:\n${pageLines || "- Not detected"}\n\nLayout and component findings from HTML scan:\n${findingLines}\n\nPerformance & UX audit signals:\n${auditLines || "- Audit data unavailable"}\n\nTop performance opportunities:\n${opportunityLines || "- Opportunities unavailable"}\n\nReordering and component plan to execute:\n${reorderLines}\n\nRequired improvements:\n- Improve UI hierarchy, readability, and component consistency\n- Improve load performance and perceived speed\n- Improve accessibility and semantic HTML structure\n- Improve conversion through CTA placement and trust sequencing\n\nNow provide:\n1. A revised information architecture and section order.\n2. Component-by-component replacements and rationale.\n3. Updated copy examples for hero, feature cards, proof, pricing, and CTA.\n4. Technical implementation notes for HTML/CSS/JS changes.\n5. A prioritized execution checklist from highest to lowest impact.\n\nConstraints:\n- Keep it mobile-first and production-ready.\n- Maintain brand intent while modernizing the full UX.`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const rawUrl = req.body?.url;
    const normalized = normalizeUrl(rawUrl);

    if (!normalized) {
      res.status(400).json({ error: "Please enter a valid URL." });
      return;
    }

    const fetched = await fetchWithTimeout(normalized);
    if (!fetched.ok) {
      res.status(400).json({ error: `Could not fetch URL (HTTP ${fetched.status}).` });
      return;
    }

    const $ = cheerio.load(fetched.html);

    const lighthouseRaw = await fetchPageSpeed(fetched.finalUrl);
    const lighthouse = extractLighthouseInsights(lighthouseRaw?.lighthouseResult);

    const pageInfo = {
      title: $("title").text().trim() || "",
      metaDescription: $("meta[name='description']").attr("content") || "",
      h1: $("h1").first().text().trim() || "",
    };

    const scores = [
      { label: "UI", value: scoreUi($) },
      {
        label: "Speed",
        value: lighthouse?.categories?.performance
          ? Math.round(lighthouse.categories.performance * 100)
          : scoreSpeed(fetched.duration, fetched.contentLength, $),
      },
      {
        label: "Accessibility",
        value: lighthouse?.categories?.accessibility
          ? Math.round(lighthouse.categories.accessibility * 100)
          : scoreAccessibility($),
      },
      {
        label: "SEO",
        value: lighthouse?.categories?.seo
          ? Math.round(lighthouse.categories.seo * 100)
          : scoreSeo($),
      },
      { label: "Conversion", value: scoreConversion($) },
    ];

    const layout = detectLayout($);
    const reorderSuggestions = buildReorderSuggestions(layout, scores);
    const prompt = buildPrompt(
      fetched.finalUrl,
      scores,
      layout.findings,
      reorderSuggestions,
      pageInfo,
      lighthouse,
    );

    res.status(200).json({
      url: fetched.finalUrl,
      responseTimeMs: fetched.duration,
      scores,
      findings: layout.findings,
      reorderSuggestions,
      prompt,
      pageInfo,
      lighthouse,
      analysisSources: {
        lighthouse: Boolean(lighthouse),
        htmlScan: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Analysis failed. The target site may block crawling or be temporarily unavailable.",
      details: String(error?.message || error),
    });
  }
};
