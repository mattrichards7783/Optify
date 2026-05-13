const rotatingTargets = [
  "website",
  "mobile app",
  "landing page",
  "checkout flow",
  "dashboard",
  "SaaS onboarding",
];

const cyclerEl = document.querySelector(".cycler");
const urlInput = document.getElementById("urlInput");
const scoreList = document.getElementById("scoreList");
const findingsList = document.getElementById("findingsList");
const reorderPlan = document.getElementById("reorderPlan");
const promptOutput = document.getElementById("promptOutput");
const analysisStatus = document.getElementById("analysisStatus");
const copyPromptBtn = document.getElementById("copyPromptBtn");

let rotateIndex = 0;
let analyzeTimer;

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

function renderScores(scores) {
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

function renderFindings(findings) {
  findingsList.innerHTML = findings.map((item) => `<li>${item}</li>`).join("");
}

function renderReorderPlan(plan) {
  reorderPlan.innerHTML = plan.map((item) => `<li>${item}</li>`).join("");
}

function updateStatus(text, isError = false) {
  analysisStatus.textContent = text;
  analysisStatus.classList.toggle("error", isError);
}

function performAnalysis(rawUrl) {
  const normalized = normalizeUrl(rawUrl);

  if (normalized === "") {
    scoreList.innerHTML = "";
    findingsList.innerHTML = "";
    reorderPlan.innerHTML = "";
    promptOutput.value = "";
    updateStatus("Waiting for URL");
    return;
  }

  if (!normalized) {
    updateStatus("Invalid URL", true);
    return;
  }

  updateStatus("Analyzing...");

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

      renderScores(data.scores || []);
      renderFindings(data.findings || []);
      renderReorderPlan(data.reorderSuggestions || []);
      promptOutput.value = data.prompt || "";
      updateStatus("Analysis complete");
    })
    .catch((error) => {
      scoreList.innerHTML = "";
      findingsList.innerHTML = "";
      reorderPlan.innerHTML = "";
      promptOutput.value = "";
      updateStatus(error.message || "Analysis failed", true);
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
  const text = promptOutput.value.trim();
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
