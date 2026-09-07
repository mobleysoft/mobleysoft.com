const doc = document;

const titleNode = doc.getElementById("mobley-title");
const summaryNode = doc.getElementById("mobley-summary");
const taglineNode = doc.getElementById("mobley-tagline");
const stateNode = doc.getElementById("mobley-state");
const versionNode = doc.getElementById("mobley-version");
const primaryActionNode = doc.getElementById("mobley-primary-action");
const secondaryActionNode = doc.getElementById("mobley-secondary-action");
const updateNoteNode = doc.getElementById("mobley-update-note");
const contractNoteNode = doc.getElementById("mobley-contract-note");
const ruleListNode = doc.getElementById("mobley-route-rules");
const capabilityGridNode = doc.getElementById("mobley-capabilities");
const routerFormNode = doc.getElementById("mobley-router-form");
const queryNode = doc.getElementById("mobley-query");
const outputNode = doc.getElementById("mobley-route-output");
const resetNode = doc.getElementById("mobley-reset");

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

function classifyRequest(text, config) {
  const normalized = text.trim().toLowerCase();
  const rules = Array.isArray(config.routing_rules) ? config.routing_rules : [];
  const fallback = {
    route: config.default_route || "local analysis",
    note: config.default_note || "Treat as local analysis until a connector or approval gate is required.",
  };

  if (!normalized) return fallback;

  const matchedRule = rules.find((rule) => {
    const matches = Array.isArray(rule.match) ? rule.match : [];
    return matches.some((token) => normalized.includes(String(token).toLowerCase()));
  });

  return matchedRule || fallback;
}

function renderActions(launch) {
  primaryActionNode.textContent = launch.primary_label || "Open Mobley";
  primaryActionNode.href = launch.primary_href || "#mobley-router";
  secondaryActionNode.textContent = launch.secondary_label || "Machine-readable manifest";
  secondaryActionNode.href = launch.secondary_href || "/products/mobley/product.json";
}

function renderRules(rules) {
  ruleListNode.innerHTML = (rules || []).map((rule) => `
    <div class="mobley-rule-card">
      <strong>${escapeHtml(rule.route || "route")}</strong>
      <p>${escapeHtml((rule.match || []).map((token) => `#${token}`).join(" "))}</p>
      <p>${escapeHtml(rule.note || "")}</p>
    </div>
  `).join("");
}

function renderCapabilities(capabilities) {
  capabilityGridNode.innerHTML = (capabilities || []).map((capability, index) => `
    <article>
      <span>${String(index + 1).padStart(2, "0")}</span>
      <h2>${escapeHtml(capability.title || "Capability")}</h2>
      <p>${escapeHtml(capability.description || "")}</p>
      <code>${escapeHtml(capability.command || "")}</code>
    </article>
  `).join("");
}

function renderRouteResult(query, config) {
  const route = classifyRequest(query, config);
  const routeLabel = route.route || config.default_route || "local analysis";
  const note = route.note || config.default_note || "Treat as local analysis until a connector or approval gate is required.";
  const matchedTokens = Array.isArray(route.match) ? route.match : [];

  outputNode.innerHTML = `
    <div class="mobley-route-head">
      <span class="route-chip"><strong>ROUTE</strong> ${escapeHtml(routeLabel)}</span>
      <span class="route-chip">Status: <strong>${escapeHtml(config.status || "published")}</strong></span>
    </div>
    <p>${escapeHtml(query || "No request entered.")}</p>
    <p><strong>Next step:</strong> ${escapeHtml(note)}</p>
    <p>${matchedTokens.length ? `Matched tokens: ${matchedTokens.map((token) => `#${token}`).join(", ")}` : "No direct keyword match. Use the manifest defaults."}</p>
  `;
}

async function main() {
  try {
    const response = await fetch("/products/mobley/product.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`product manifest returned ${response.status}`);
    const config = await response.json();

    titleNode.textContent = config.product || "Mobley";
    summaryNode.textContent = config.summary || summaryNode.textContent;
    taglineNode.textContent = config.tagline || taglineNode.textContent;
    stateNode.textContent = config.status || stateNode.textContent;
    versionNode.textContent = `${(config.product || "Mobley").toUpperCase()} ${config.version || ""}`.trim();
    updateNoteNode.innerHTML = `Change <code>/products/mobley/product.json</code> to revise the published copy, route rules, and capability cards. The browser is only the shell.`;
    contractNoteNode.textContent = config.contract?.update_model || contractNoteNode.textContent;

    renderActions(config.launch || {});
    renderRules(config.routing_rules || []);
    renderCapabilities(config.capabilities || []);

    const seedQuery = "Summarize the latest book drafts and prepare a publish checklist.";
    queryNode.value = seedQuery;
    renderRouteResult(seedQuery, config);

    routerFormNode.addEventListener("submit", (event) => {
      event.preventDefault();
      renderRouteResult(queryNode.value, config);
    });

    resetNode.addEventListener("click", () => {
      queryNode.value = "";
      renderRouteResult("", config);
      queryNode.focus();
    });

    queryNode.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.ctrlKey) {
        event.preventDefault();
        renderRouteResult(queryNode.value, config);
      }
    });
  } catch (error) {
    titleNode.textContent = "Mobley";
    summaryNode.textContent = "The manifest could not be loaded.";
    taglineNode.textContent = error.message;
    outputNode.innerHTML = `
      <div class="mobley-route-head">
        <span class="route-chip"><strong>ERROR</strong> Manifest unavailable</span>
      </div>
      <p>${escapeHtml(error.message)}</p>
    `;
  }
}

main();
