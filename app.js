const rotatingTargets = [
  "website",
  "mobile app",
  "landing page",
  "checkout flow",
  "dashboard",
  "SaaS onboarding",
];

const STORAGE_KEY = "optify:lastAnalysis";
const STALE_MS = 24 * 60 * 60 * 1000;

const cyclerEl = document.querySelector(".cycler");
const urlInput = document.getElementById("urlInput");
const analysisStatus = document.getElementById("analysisStatus");
const analysisTimestamp = document.getElementById("analysisTimestamp");
const scoreList = document.getElementById("scoreList");
const findingsList = document.getElementById("findingsList");
const reorderPlan = document.getElementById("reorderPlan");
const promptOutput = document.getElementById("promptOutput");
const copyPromptBtn = document.getElementById("copyPromptBtn");
const signalList = document.getElementById("signalList");
const gradeBadge = document.getElementById("gradeBadge");
const urlBadge = document.getElementById("urlBadge");
const overviewStates = document.getElementById("overviewStates");

const detailStates = document.getElementById("detailStates");
const detailScore = document.getElementById("detailScore");
const detailGrade = document.getElementById("detailGrade");
const detailSummary = document.getElementById("detailSummary");
const detailBadges = document.getElementById("detailBadges");
const detailRisks = document.getElementById("detailRisks");
const detailActions = document.getElementById("detailActions");
const detailExperiments = document.getElementById("detailExperiments");
const promptPageOutput = document.getElementById("promptPageOutput");
const promptPageCopyBtn = document.getElementById("promptPageCopyBtn");

let rotateIndex = 0;
let analyzeTimer;

const page = document.body?.dataset?.page || "overview";

function rotateHeroWord() {
  if (!cyclerEl) return;

  cyclerEl.classList.add("flip-out");
  setTimeout(() => {
    rotateIndex = (rotateIndex + 1) % rotatingTargets.length;
    cyclerEl.textContent = rotatingTargets[rotateIndex];
    cyclerEl.classList.remove("flip-out");
    cyclerEl.classList.add("flip-in");
    setTimeout(() => cyclerEl.classList.remove("flip-in"), 220);
  }, 180);
}

setInterval(rotateHeroWord, 1750);

function normalizeUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.toString();
  } catch {
    return null;
  }
}

function setActiveNav() {
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    const isActive =
      (page === "overview" && href.includes("index")) ||
      href.includes(`${page}.html`);
    link.classList.toggle("active", isActive);
  });
}

function setState(state, errorMessage) {
  if (overviewStates) {
    overviewStates.dataset.state = state;
    if (errorMessage) {
      const el = overviewStates.querySelector("#errorMessage");
      if (el) el.textContent = errorMessage;
    }
  }

  if (detailStates) {
    detailStates.dataset.state = state;
    if (errorMessage) {
      const el = detailStates.querySelector("#detailErrorMessage");
      if (el) el.textContent = errorMessage;
    }
  }
}

function updateStatus(text, isError = false) {
  if (!analysisStatus) return;
  analysisStatus.textContent = text;
  analysisStatus.classList.toggle("error", isError);
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function storeAnalysis(data) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...data,
      fetchedAt: Date.now(),
    }),
  );
}

function getStoredAnalysis() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getScore(scores, label) {
  return scores.find((item) => item.label === label)?.value ?? 0;
}

function gradeFromScore(score) {
  if (score >= 90) return { label: "Elite", tone: "good" };
  if (score >= 80) return { label: "Strong", tone: "good" };
  if (score >= 70) return { label: "Solid", tone: "warn" };
  if (score >= 55) return { label: "At Risk", tone: "warn" };
  return { label: "Critical", tone: "bad" };
}

function buildSignals(data) {
  const scores = data.scores || [];
  const responseTimeMs = data.responseTimeMs ?? 0;
  const audits = data.lighthouse?.keyAudits || [];
  const lcpAudit = audits.find((audit) => audit.id === "largest-contentful-paint");
  const clsAudit = audits.find((audit) => audit.id === "cumulative-layout-shift");
  const tbtAudit = audits.find((audit) => audit.id === "total-blocking-time");
  const fcpAudit = audits.find((audit) => audit.id === "first-contentful-paint");
  const auditLines = [];

  if (fcpAudit?.displayValue) auditLines.push(`FCP: ${fcpAudit.displayValue}`);
  if (lcpAudit?.displayValue) auditLines.push(`LCP: ${lcpAudit.displayValue}`);
  if (tbtAudit?.displayValue) auditLines.push(`TBT: ${tbtAudit.displayValue}`);
  if (clsAudit?.displayValue) auditLines.push(`CLS: ${clsAudit.displayValue}`);

  return [
    `Crawl response time: ${responseTimeMs}ms`,
    ...auditLines,
    `UI score indicates a ${gradeFromScore(getScore(scores, "UI")).label.toLowerCase()} visual system.`,
    `Speed score suggests a ${gradeFromScore(getScore(scores, "Speed")).label.toLowerCase()} performance profile.`,
    `Accessibility score reflects a ${gradeFromScore(getScore(scores, "Accessibility")).label.toLowerCase()} baseline.`,
    `SEO score reflects a ${gradeFromScore(getScore(scores, "SEO")).label.toLowerCase()} metadata structure.`,
    `Conversion score shows a ${gradeFromScore(getScore(scores, "Conversion")).label.toLowerCase()} persuasion layer.`,
  ];
}

function buildCategoryProfile(category, data) {
  const scores = data.scores || [];
  const scoreMap = {
    ui: { label: "UI", title: "UI & Layout" },
    speed: { label: "Speed", title: "Speed" },
    accessibility: { label: "Accessibility", title: "Accessibility" },
    seo: { label: "SEO", title: "SEO" },
    conversion: { label: "Conversion", title: "Conversion" },
  };

  const label = scoreMap[category]?.label || "UI";
  const score = getScore(scores, label);
  const grade = gradeFromScore(score);
  const findings = data.findings || [];

  const commonActions = {
    ui: [
      "Reduce visual density in high-traffic sections and increase spacing cadence.",
      "Reinforce hierarchy with clearer heading scaling and consistent component styling.",
      "Group related content into 3-5 primary modules per section.",
    ],
    speed: [
      "Compress hero imagery and defer non-critical media below the fold.",
      "Split bundles and remove unused scripts/styles.",
      "Preload only the most critical fonts and above-the-fold assets.",
    ],
    accessibility: [
      "Ensure every form input has a visible label or aria-label.",
      "Provide alt text for every informative image.",
      "Confirm all focus states are visible and meet contrast guidelines.",
    ],
    seo: [
      "Write a single, descriptive H1 aligned to your core keyword.",
      "Provide unique meta descriptions for every top-level route.",
      "Use semantic sectioning to improve crawl clarity.",
    ],
    conversion: [
      "Place primary CTA within the first viewport and repeat after social proof.",
      "Introduce trust signals directly before pricing or demo steps.",
      "Clarify the top benefit in a single sentence before feature details.",
    ],
  };

  const experiments = {
    ui: [
      "Swap a dense feature grid for a 3-column layout with short copy blocks.",
      "Test a single hero CTA vs. dual CTA to reduce decision friction.",
      "Evaluate icon + text layout for scannability on mobile breakpoints.",
    ],
    speed: [
      "Test removing heavy video from the first viewport.",
      "Compare lazy-loading all below-the-fold images vs. a blurred placeholder.",
      "Audit third-party scripts and remove low-impact tags.",
    ],
    accessibility: [
      "Run a keyboard-only pass and log focus traps.",
      "Increase body text size to 16px+ and re-check contrast ratios.",
      "Add skip links for navigation-heavy layouts.",
    ],
    seo: [
      "Add structured data for products, reviews, or FAQs.",
      "Refactor headings into a single H1 + supporting H2 hierarchy.",
      "Improve internal linking between high-intent sections.",
    ],
    conversion: [
      "A/B test benefit-led hero copy vs. feature-led hero copy.",
      "Move pricing summary above the fold and compare click-through.",
      "Insert a mid-page CTA after the primary proof block.",
    ],
  };

  const risks = [];

  if (score < 70) {
    risks.push("Score indicates a need for immediate improvement in this category.");
  }

  if (category === "ui" && findings.some((item) => item.toLowerCase().includes("hero"))) {
    risks.push("Hero structure is inconsistent or missing according to layout scan.");
  }

  if (category === "conversion" && findings.some((item) => item.toLowerCase().includes("pricing"))) {
    risks.push("Pricing clarity may be delayed or absent in the flow.");
  }

  if (category === "seo" && findings.some((item) => item.toLowerCase().includes("flow"))) {
    risks.push("Section flow is unclear, which can affect crawl depth and relevance.");
  }

  if (category === "speed" && (data.responseTimeMs || 0) > 1200) {
    risks.push("Initial response time is high; prioritize server and asset optimization.");
  }

  if (risks.length === 0) {
    risks.push("Primary fundamentals look healthy; focus on marginal gains.");
  }

  const summary = `Score ${score}/100. ${grade.label} performance with ${grade.tone} urgency.`;

  return {
    score,
    grade,
    summary,
    actions: commonActions[category] || [],
    experiments: experiments[category] || [],
    risks,
  };
}

function renderScores(scores) {
  if (!scoreList) return;
  scoreList.innerHTML = "";

  scores.forEach(({ label, value }) => {
    const row = document.createElement("div");
    row.className = "score-item";

    row.innerHTML = `
      <span class="score-label">${label}</span>
      <div class="score-bar"><div class="score-fill" style="width: 0"></div></div>
      <span class="score-value">${value}</span>
    `;

    scoreList.appendChild(row);
    requestAnimationFrame(() => {
      const fill = row.querySelector(".score-fill");
      if (fill) fill.style.width = `${value}%`;
    });
  });
}

function renderList(target, items, ordered = false) {
  if (!target) return;
  target.innerHTML = (items || [])
    .map((item) => `<li>${item}</li>`)
    .join("");

  if (ordered && target.children.length === 0) {
    target.innerHTML = "<li>No recommendations yet.</li>";
  }
}

function renderOverview(data) {
  if (!data) return;

  renderScores(data.scores || []);
  renderList(findingsList, data.findings || []);
  renderList(reorderPlan, data.reorderSuggestions || [], true);

  if (promptOutput) promptOutput.value = data.prompt || "";

  if (signalList) {
    renderList(signalList, buildSignals(data));
  }

  if (gradeBadge) {
    const uiScore = getScore(data.scores || [], "UI");
    const grade = gradeFromScore(uiScore);
    gradeBadge.textContent = `${grade.label} overall`;
    gradeBadge.dataset.tone = grade.tone;
  }

  if (urlBadge) {
    urlBadge.textContent = data.url || "No URL";
  }

  if (analysisTimestamp) {
    analysisTimestamp.textContent = `Last analysis: ${formatTimestamp(data.fetchedAt)}`;
  }
}

function renderDetail(data) {
  if (!data) return;

  const profile = buildCategoryProfile(page, data);

  if (detailScore) detailScore.textContent = profile.score;
  if (detailGrade) {
    detailGrade.textContent = profile.grade.label;
    detailGrade.dataset.tone = profile.grade.tone;
  }
  if (detailSummary) detailSummary.textContent = profile.summary;

  if (detailBadges) {
    detailBadges.innerHTML = "";
    const badges = [
      `Response ${data.responseTimeMs || 0}ms`,
      `Updated ${formatTimestamp(data.fetchedAt)}`,
      `Priority: ${profile.grade.tone === "bad" ? "High" : "Medium"}`,
    ];
    badges.forEach((item) => {
      const span = document.createElement("span");
      span.className = "badge badge-outline";
      span.textContent = item;
      detailBadges.appendChild(span);
    });
  }

  renderList(detailRisks, profile.risks);
  renderList(detailActions, profile.actions, true);
  renderList(detailExperiments, profile.experiments);
}

function renderPromptPage(data) {
  if (promptPageOutput) {
    promptPageOutput.value = data?.prompt || "";
  }
}

function applyStoredData() {
  const stored = getStoredAnalysis();
  if (!stored) {
    if (analysisTimestamp) {
      analysisTimestamp.textContent = "Enter a URL to begin analysis.";
    }
    setState("idle");
    return;
  }

  const age = Date.now() - (stored.fetchedAt || 0);
  const stale = age > STALE_MS;
  setState(stale ? "stale" : "ready");

  renderOverview(stored);
  renderDetail(stored);
  renderPromptPage(stored);
}

function performAnalysis(rawUrl) {
  const normalized = normalizeUrl(rawUrl);

  if (normalized === "") {
    updateStatus("Waiting for URL");
    setState("idle");
    return;
  }

  if (!normalized) {
    updateStatus("Invalid URL", true);
    setState("error", "Please enter a valid URL.");
    return;
  }

  updateStatus("Analyzing...");
  setState("loading");

  fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: normalized }),
  })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      storeAnalysis(data);
      updateStatus("Analysis complete");
      setState("ready");
      renderOverview(data);
      renderDetail(data);
      renderPromptPage(data);
    })
    .catch((error) => {
      updateStatus(error.message || "Analysis failed", true);
      setState("error", error.message || "Analysis failed");
    });
}

urlInput?.addEventListener("input", (event) => {
  clearTimeout(analyzeTimer);
  analyzeTimer = setTimeout(() => {
    const target = event.target;
    performAnalysis(target.value);
  }, 420);
});

copyPromptBtn?.addEventListener("click", async () => {
  const text = promptOutput?.value.trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    const original = copyPromptBtn.textContent;
    copyPromptBtn.textContent = "Copied";
    setTimeout(() => {
      copyPromptBtn.textContent = original;
    }, 1200);
  } catch {
    copyPromptBtn.textContent = "Copy failed";
    setTimeout(() => {
      copyPromptBtn.textContent = "Copy Prompt";
    }, 1200);
  }
});

promptPageCopyBtn?.addEventListener("click", async () => {
  const text = promptPageOutput?.value.trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    const original = promptPageCopyBtn.textContent;
    promptPageCopyBtn.textContent = "Copied";
    setTimeout(() => {
      promptPageCopyBtn.textContent = original;
    }, 1200);
  } catch {
    promptPageCopyBtn.textContent = "Copy failed";
    setTimeout(() => {
      promptPageCopyBtn.textContent = "Copy Prompt";
    }, 1200);
  }
});

setActiveNav();
applyStoredData();
