const STORAGE_KEY = "glidelink.links";
const SHORT_DOMAIN = "https://glq.ly/";

const form = document.querySelector("#shorten-form");
const formMessage = document.querySelector("#form-message");
const navTabs = document.querySelectorAll("[data-route]");
const routeButtons = document.querySelectorAll("[data-route-button]");
const views = {
  shorten: document.querySelector("#shorten-view"),
  dashboard: document.querySelector("#dashboard-view"),
};
const latestShortUrl = document.querySelector("#latest-short-url");
const latestClicks = document.querySelector("#latest-clicks");
const latestCreated = document.querySelector("#latest-created");
const resultStatus = document.querySelector("#result-status");
const copyLatest = document.querySelector("#copy-latest");
const qrCanvas = document.querySelector("#qr-canvas");
const linksTable = document.querySelector("#links-table");
const emptyRowTemplate = document.querySelector("#empty-row-template");
const searchLinks = document.querySelector("#search-links");
const filterButtons = document.querySelectorAll("[data-filter]");
const barChart = document.querySelector("#bar-chart");
const activityList = document.querySelector("#activity-list");

let activeFilter = "all";
let latestLinkId = null;

const today = new Date();
function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `link-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


const seedLinks = [
  {
    id: createId(),
    slug: "launch-kit",
    target: "https://example.com/product/launch-kit",
    campaign: "Launch",
    owner: "Product",
    status: "active",
    clicks: 1840,
    dailyClicks: [140, 188, 212, 244, 309, 376, 371],
    createdAt: offsetDate(-6),
    expiresAt: null,
  },
  {
    id: createId(),
    slug: "news-july",
    target: "https://example.com/newsletter/july",
    campaign: "Newsletter",
    owner: "Growth",
    status: "active",
    clicks: 962,
    dailyClicks: [82, 96, 110, 132, 148, 184, 210],
    createdAt: offsetDate(-5),
    expiresAt: null,
  },
  {
    id: createId(),
    slug: "partner-demo",
    target: "https://example.com/partners/demo-request",
    campaign: "Partner",
    owner: "Sales",
    status: "paused",
    clicks: 433,
    dailyClicks: [64, 62, 58, 54, 47, 39, 28],
    createdAt: offsetDate(-15),
    expiresAt: null,
  },
  {
    id: createId(),
    slug: "q2-offer",
    target: "https://example.com/offers/q2",
    campaign: "Social",
    owner: "Growth",
    status: "expired",
    clicks: 725,
    dailyClicks: [118, 100, 84, 64, 40, 18, 0],
    createdAt: offsetDate(-45),
    expiresAt: offsetDate(-2),
  },
];

function offsetDate(days) {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function getLinks() {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    saveLinks(seedLinks);
    return seedLinks;
  }

  try {
    return JSON.parse(stored);
  } catch {
    saveLinks(seedLinks);
    return seedLinks;
  }
}

function saveLinks(links) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value) {
  const date = new Date(value);
  const sameDay = date.toDateString() === today.toDateString();

  if (sameDay) {
    return "Today";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function normalizeSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function generateSlug() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let slug = "";

  for (let index = 0; index < 7; index += 1) {
    slug += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return slug;
}

function uniqueSlug(requestedSlug, links) {
  let slug = requestedSlug || generateSlug();
  let suffix = 2;

  while (links.some((link) => link.slug === slug)) {
    slug = `${requestedSlug || generateSlug()}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function expirationDate(value) {
  if (value === "never") {
    return null;
  }

  const date = new Date();
  date.setDate(date.getDate() + Number(value));
  return date.toISOString();
}

function getStatus(link) {
  if (link.status === "paused") {
    return "paused";
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return "expired";
  }

  return "active";
}

function shortUrl(link) {
  return `${SHORT_DOMAIN}${link.slug}`;
}

function setRoute(route) {
  const nextRoute = route === "dashboard" ? "dashboard" : "shorten";

  Object.entries(views).forEach(([key, view]) => {
    view.classList.toggle("is-active", key === nextRoute);
  });

  navTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.route === nextRoute);
  });

  window.location.hash = nextRoute;
}

function renderLatest() {
  const links = getLinks();
  const latest = links.find((link) => link.id === latestLinkId) || links[0];

  if (!latest) {
    return;
  }

  const status = getStatus(latest);
  latestLinkId = latest.id;
  latestShortUrl.textContent = shortUrl(latest).replace("https://", "");
  latestClicks.textContent = formatNumber(latest.clicks);
  latestCreated.textContent = formatDate(latest.createdAt);
  resultStatus.textContent = status[0].toUpperCase() + status.slice(1);
  resultStatus.className = `badge ${status === "active" ? "" : status}`.trim();
  drawQr(latest.slug);
}

function drawQr(seed) {
  const context = qrCanvas.getContext("2d");
  const size = 184;
  const cells = 23;
  const cell = size / cells;

  context.clearRect(0, 0, size, size);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);

  drawFinder(context, 1, 1, cell);
  drawFinder(context, cells - 8, 1, cell);
  drawFinder(context, 1, cells - 8, cell);

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const inFinder =
        (x < 8 && y < 8) ||
        (x > cells - 9 && y < 8) ||
        (x < 8 && y > cells - 9);

      if (inFinder) {
        continue;
      }

      const value = Math.abs(Math.sin((x + 1) * 13.7 + (y + 1) * 7.3 + hash));

      if (value > 0.56) {
        context.fillStyle = value > 0.82 ? "#172033" : "#2563eb";
        context.fillRect(Math.round(x * cell), Math.round(y * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
}

function drawFinder(context, x, y, cell) {
  context.fillStyle = "#172033";
  context.fillRect(x * cell, y * cell, 7 * cell, 7 * cell);
  context.fillStyle = "#ffffff";
  context.fillRect((x + 1) * cell, (y + 1) * cell, 5 * cell, 5 * cell);
  context.fillStyle = "#172033";
  context.fillRect((x + 2) * cell, (y + 2) * cell, 3 * cell, 3 * cell);
}

function renderMetrics() {
  const links = getLinks();
  const activeLinks = links.filter((link) => getStatus(link) === "active");
  const campaignClicks = links.reduce((totals, link) => {
    totals[link.campaign] = (totals[link.campaign] || 0) + link.clicks;
    return totals;
  }, {});
  const topCampaign =
    Object.entries(campaignClicks).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  document.querySelector("#metric-links").textContent = formatNumber(links.length);
  document.querySelector("#metric-clicks").textContent = formatNumber(
    links.reduce((sum, link) => sum + link.clicks, 0),
  );
  document.querySelector("#metric-active").textContent = formatNumber(activeLinks.length);
  document.querySelector("#metric-campaign").textContent = topCampaign;
}

function renderChart() {
  const links = getLinks();
  const totals = Array.from({ length: 7 }, (_, index) =>
    links.reduce((sum, link) => sum + (link.dailyClicks?.[index] || 0), 0),
  );
  const max = Math.max(...totals, 1);
  const labels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - index));
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  });

  document.querySelector("#chart-total").textContent = `${formatNumber(
    totals.reduce((sum, value) => sum + value, 0),
  )} clicks`;

  barChart.innerHTML = totals
    .map((value, index) => {
      const height = Math.max(8, Math.round((value / max) * 100));
      return `
        <div class="bar-item" title="${labels[index]}: ${formatNumber(value)} clicks">
          <div class="bar" style="height: ${height}%"></div>
          <span class="bar-label">${labels[index]}</span>
        </div>
      `;
    })
    .join("");
}

function renderActivity() {
  const links = [...getLinks()]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4);

  activityList.innerHTML = links
    .map(
      (link) => `
        <li>
          <span class="activity-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 12h16" />
              <path d="M14 6l6 6-6 6" />
            </svg>
          </span>
          <span>
            <p>${escapeHtml(link.slug)} created</p>
            <time>${escapeHtml(link.owner)} - ${formatDate(link.createdAt)}</time>
          </span>
        </li>
      `,
    )
    .join("");
}

function renderTable() {
  const query = searchLinks.value.trim().toLowerCase();
  const links = getLinks().filter((link) => {
    const status = getStatus(link);
    const matchesFilter = activeFilter === "all" || status === activeFilter;
    const matchesQuery = [link.slug, link.target, link.campaign, link.owner].some((value) =>
      value.toLowerCase().includes(query),
    );

    return matchesFilter && matchesQuery;
  });

  if (!links.length) {
    linksTable.replaceChildren(emptyRowTemplate.content.cloneNode(true));
    return;
  }

  linksTable.innerHTML = links
    .map((link) => {
      const status = getStatus(link);
      return `
        <tr>
          <td>
            <div class="link-cell">
              <strong>${escapeHtml(shortUrl(link).replace("https://", ""))}</strong>
              <span>${escapeHtml(link.owner)}</span>
            </div>
          </td>
          <td class="destination-cell" title="${escapeHtml(link.target)}">${escapeHtml(link.target)}</td>
          <td>${escapeHtml(link.campaign)}</td>
          <td>${formatNumber(link.clicks)}</td>
          <td><span class="badge ${status === "active" ? "" : status}">${status}</span></td>
          <td>
            <div class="row-actions">
              <button class="icon-button" type="button" data-action="copy" data-id="${link.id}" title="Copy" aria-label="Copy ${escapeHtml(link.slug)}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="9" y="9" width="10" height="10" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              <button class="icon-button" type="button" data-action="toggle" data-id="${link.id}" title="${status === "paused" ? "Resume" : "Pause"}" aria-label="${status === "paused" ? "Resume" : "Pause"} ${escapeHtml(link.slug)}">
                ${status === "paused" ? playIcon() : pauseIcon()}
              </button>
              <button class="icon-button" type="button" data-action="track" data-id="${link.id}" title="Record click" aria-label="Record click for ${escapeHtml(link.slug)}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3v18h18" />
                  <path d="M7 14l4-4 4 4 5-6" />
                </svg>
              </button>
              <button class="icon-button" type="button" data-action="delete" data-id="${link.id}" title="Delete" aria-label="Delete ${escapeHtml(link.slug)}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function pauseIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14" />
      <path d="M16 5v14" />
    </svg>
  `;
}

function playIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  `;
}

function renderAll() {
  renderLatest();
  renderMetrics();
  renderChart();
  renderActivity();
  renderTable();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    setMessage("Copied to clipboard.");
  } catch {
    setMessage(text);
  }
}

function setMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("is-error", isError);
}

function handleSubmit(event) {
  event.preventDefault();

  const data = new FormData(form);
  const destination = data.get("destination").trim();
  const alias = normalizeSlug(data.get("alias"));
  const links = getLinks();

  let url;
  try {
    url = new URL(destination);
  } catch {
    setMessage("Enter a valid destination URL.", true);
    return;
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    setMessage("Only HTTP and HTTPS links are supported.", true);
    return;
  }

  const slug = uniqueSlug(alias, links);
  const link = {
    id: createId(),
    slug,
    target: url.href,
    campaign: data.get("campaign"),
    owner: data.get("owner"),
    status: "active",
    clicks: 0,
    dailyClicks: [0, 0, 0, 0, 0, 0, 0],
    createdAt: new Date().toISOString(),
    expiresAt: expirationDate(data.get("expires")),
  };

  latestLinkId = link.id;
  saveLinks([link, ...links]);
  form.reset();
  setMessage(`${shortUrl(link).replace("https://", "")} is ready.`);
  renderAll();
}

function handleTableAction(event) {
  const button = event.target.closest("[data-action]");

  if (!button) {
    return;
  }

  const links = getLinks();
  const link = links.find((item) => item.id === button.dataset.id);

  if (!link) {
    return;
  }

  if (button.dataset.action === "copy") {
    copyText(shortUrl(link));
    return;
  }

  if (button.dataset.action === "delete") {
    saveLinks(links.filter((item) => item.id !== link.id));
  }

  if (button.dataset.action === "toggle") {
    link.status = getStatus(link) === "paused" ? "active" : "paused";
    saveLinks(links);
  }

  if (button.dataset.action === "track") {
    link.clicks += 1;
    link.dailyClicks[6] += 1;
    latestLinkId = link.id;
    saveLinks(links);
  }

  renderAll();
}

form.addEventListener("submit", handleSubmit);
form.addEventListener("reset", () => setMessage(""));
copyLatest.addEventListener("click", () => {
  const link = getLinks().find((item) => item.id === latestLinkId) || getLinks()[0];
  if (link) {
    copyText(shortUrl(link));
  }
});
linksTable.addEventListener("click", handleTableAction);
searchLinks.addEventListener("input", renderTable);

navTabs.forEach((tab) => {
  tab.addEventListener("click", (event) => {
    event.preventDefault();
    setRoute(tab.dataset.route);
  });
});

routeButtons.forEach((button) => {
  button.addEventListener("click", () => setRoute(button.dataset.routeButton));
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    renderTable();
  });
});

window.addEventListener("hashchange", () => {
  setRoute(window.location.hash.replace("#", ""));
});

setRoute(window.location.hash.replace("#", ""));
renderAll();
