// popup.js

const tabGridEl = document.getElementById("tabGrid");
const searchInputEl = document.getElementById("searchInput");
const totalTabsEl = document.getElementById("totalTabs");
const groupedTabsEl = document.getElementById("groupedTabs");
const suggestionTextEl = document.getElementById("suggestionText");

const groupTabsBtn = document.getElementById("groupTabsBtn");
const boosterBtn = document.getElementById("boosterBtn");
const closeDupesBtn = document.getElementById("closeDupesBtn");
const discardIdleBtn = document.getElementById("discardIdleBtn");

let allTabs = [];
let filteredTabs = [];

// --- Category detection --------------------------------------------------

function getCategoryForUrl(url) {
  if (!url) return "Other";

  const lower = url.toLowerCase();

  if (
    lower.includes("youtube.com") ||
    lower.includes("netflix.com") ||
    lower.includes("spotify.com") ||
    lower.includes("soundcloud.com")
  ) {
    return "Media";
  }

  if (
    lower.includes("twitter.com") ||
    lower.includes("x.com") ||
    lower.includes("facebook.com") ||
    lower.includes("instagram.com") ||
    lower.includes("reddit.com") ||
    lower.includes("discord.com")
  ) {
    return "Social";
  }

  if (
    lower.includes("amazon.") ||
    lower.includes("flipkart.") ||
    lower.includes("ebay.") ||
    lower.includes("myntra.") ||
    lower.includes("ajio.")
  ) {
    return "Shopping";
  }

  if (
    lower.includes("docs.google.com") ||
    lower.includes("notion.so") ||
    lower.includes("slack.com") ||
    lower.includes("microsoft.com") ||
    lower.includes("office.com")
  ) {
    return "Work";
  }

  if (
    lower.includes("github.com") ||
    lower.includes("stack overflow") ||
    lower.includes("stackoverflow.com") ||
    lower.includes("vercel.com") ||
    lower.includes("cloudflare.com")
  ) {
    return "Dev";
  }

  if (
    lower.includes("openai.com") ||
    lower.includes("gemini.") ||
    lower.includes("claude.") ||
    lower.includes("perplexity.ai")
  ) {
    return "AI";
  }

  if (lower.startsWith("chrome://") || lower.startsWith("edge://")) {
    return "Browser";
  }

  return "Other";
}

// Format time difference
function formatLastActive(lastAccessed) {
  if (!lastAccessed) return "";
  const diffMs = Date.now() - lastAccessed;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Idle / heavy heuristics
function markIdleOrHeavy(tab) {
  const result = {
    isIdle: false,
    isHeavy: false
  };

  if (!tab.active && tab.lastAccessed) {
    const diffMs = Date.now() - tab.lastAccessed;
    const mins = diffMs / 60000;
    if (mins > 45) {
      result.isIdle = true;
    }
    if (mins > 120) {
      result.isHeavy = true;
    }
  }

  if (tab.discarded) {
    // Already discarded tabs are not heavy – they are "sleeping"
    result.isIdle = true;
  }

  return result;
}

// --- Rendering -----------------------------------------------------------

function renderTabs() {
  tabGridEl.innerHTML = "";

  filteredTabs.forEach((tab) => {
    const card = document.createElement("div");
    card.className = "tab-card";
    card.title = tab.title || tab.url || "";

    const header = document.createElement("div");
    header.className = "tab-header";

    const favicon = document.createElement("img");
    favicon.className = "favicon";
    favicon.src =
      tab.favIconUrl && tab.favIconUrl.startsWith("http")
        ? tab.favIconUrl
        : "icons/icon16.png";
    favicon.onerror = () => {
      favicon.src = "icons/icon16.png";
    };

    const titleEl = document.createElement("div");
    titleEl.className = "tab-title";
    titleEl.textContent = tab.title || "(No title)";

    header.appendChild(favicon);
    header.appendChild(titleEl);

    const urlEl = document.createElement("div");
    urlEl.className = "tab-url";
    urlEl.textContent = tab.url || "";

    const meta = document.createElement("div");
    meta.className = "tab-meta";

    const category = document.createElement("span");
    category.className = "badge category";
    category.textContent = getCategoryForUrl(tab.url);

    const lastActive = document.createElement("span");
    lastActive.textContent = formatLastActive(tab.lastAccessed);

    meta.appendChild(category);
    meta.appendChild(lastActive);

    const { isIdle, isHeavy } = markIdleOrHeavy(tab);

    if (isIdle || isHeavy) {
      const stateBadge = document.createElement("span");
      stateBadge.className = "badge " + (isHeavy ? "heavy" : "idle");
      stateBadge.textContent = isHeavy ? "HEAVY" : "IDLE";
      meta.appendChild(stateBadge);
    }

    const actions = document.createElement("div");
    actions.className = "tab-actions";

    const btnFocus = document.createElement("button");
    btnFocus.textContent = "Focus";
    btnFocus.addEventListener("click", (event) => {
      event.stopPropagation();
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    });

    const btnDiscard = document.createElement("button");
    btnDiscard.textContent = "Sleep";
    btnDiscard.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!tab.discarded) {
        chrome.tabs.discard(tab.id);
      }
    });

    const btnClose = document.createElement("button");
    btnClose.textContent = "Close";
    btnClose.addEventListener("click", (event) => {
      event.stopPropagation();
      chrome.tabs.remove(tab.id);
      // Remove from local arrays
      allTabs = allTabs.filter((t) => t.id !== tab.id);
      filteredTabs = filteredTabs.filter((t) => t.id !== tab.id);
      updateStats();
      renderTabs();
    });

    actions.appendChild(btnFocus);
    actions.appendChild(btnDiscard);
    actions.appendChild(btnClose);

    card.appendChild(header);
    card.appendChild(urlEl);
    card.appendChild(meta);
    card.appendChild(actions);

    // Click card = focus tab
    card.addEventListener("click", () => {
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    });

    tabGridEl.appendChild(card);
  });

  if (filteredTabs.length === 0) {
    tabGridEl.innerHTML =
      '<div style="font-size:12px;color:#9ca3af;text-align:center;margin-top:20px;">No tabs match your search.</div>';
  }
}

// --- Fetch tabs ----------------------------------------------------------

function fetchTabs() {
  chrome.tabs.query({}, (tabs) => {
    allTabs = tabs.filter((t) => !t.pinned); // ignore pinned for now
    filteredTabs = allTabs.slice();
    updateStats();
    renderTabs();
    updateSuggestion();
  });
}

function updateStats() {
  totalTabsEl.textContent = `${allTabs.length} tabs`;

  // Tab groups count
  chrome.tabGroups.query({}, (groups) => {
    let totalCount = 0;
    let groupedTabIds = new Set();

    const promises = groups.map(
      (group) =>
        new Promise((resolve) => {
          chrome.tabs.query({ groupId: group.id }, (tabs) => {
            tabs.forEach((t) => groupedTabIds.add(t.id));
            resolve();
          });
        })
    );

    Promise.all(promises).then(() => {
      totalCount = groupedTabIds.size;
      groupedTabsEl.textContent = `${totalCount} grouped`;
    });
  });
}

function updateSuggestion() {
  const idleTabs = allTabs.filter((tab) => markIdleOrHeavy(tab).isIdle);
  const heavyTabs = allTabs.filter((tab) => markIdleOrHeavy(tab).isHeavy);

  if (heavyTabs.length > 0) {
    suggestionTextEl.textContent = `⚠️ You have ${heavyTabs.length} long-idle tabs. Try "Discard Idle Tabs".`;
  } else if (idleTabs.length > 0) {
    suggestionTextEl.textContent = `😴 ${idleTabs.length} tabs are idle. You can put them to sleep.`;
  } else if (allTabs.length > 15) {
    suggestionTextEl.textContent = `🤯 ${allTabs.length} tabs open. Try grouping or closing duplicates.`;
  } else {
    suggestionTextEl.textContent = `✨ Your tabs look pretty clean right now.`;
  }
}

// --- Search --------------------------------------------------------------

searchInputEl.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  if (!q) {
    filteredTabs = allTabs.slice();
  } else {
    filteredTabs = allTabs.filter((tab) => {
      const title = (tab.title || "").toLowerCase();
      const url = (tab.url || "").toLowerCase();
      return title.includes(q) || url.includes(q);
    });
  }
  renderTabs();
});

// --- Grouping ------------------------------------------------------------

async function autoGroupTabs() {
  // Group tabs by category
  const categoryMap = {};

  allTabs.forEach((tab) => {
    const category = getCategoryForUrl(tab.url);
    if (!categoryMap[category]) {
      categoryMap[category] = [];
    }
    categoryMap[category].push(tab);
  });

  const colorMap = {
    Media: "yellow",
    Social: "pink",
    Shopping: "red",
    Work: "cyan",
    Dev: "green",
    AI: "purple",
    Browser: "grey",
    Other: "blue"
  };

  for (const [category, tabs] of Object.entries(categoryMap)) {
    if (tabs.length <= 1) continue; // no need to group single tabs

    const tabIds = tabs.map((t) => t.id);
    try {
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, {
        title: category,
        color: colorMap[category] || "blue"
      });
    } catch (err) {
      console.warn("Failed to group tabs: ", err);
    }
  }

  updateStats();
}

// --- Performance Booster --------------------------------------------------

async function closeDuplicates() {
  const urlMap = {};
  const toClose = [];

  for (const tab of allTabs) {
    if (!tab.url) continue;
    const normalized = tab.url.split("#")[0].split("?")[0]; // basic normalization
    if (urlMap[normalized]) {
      // previously seen -> mark close
      toClose.push(tab.id);
    } else {
      urlMap[normalized] = tab.id;
    }
  }

  if (toClose.length > 0) {
    await chrome.tabs.remove(toClose);
  }

  fetchTabs();
}

async function discardIdleTabs() {
  const idleTabs = allTabs.filter((tab) => {
    const { isIdle } = markIdleOrHeavy(tab);
    return isIdle && !tab.active && !tab.discarded;
  });

  for (const tab of idleTabs) {
    try {
      await chrome.tabs.discard(tab.id);
    } catch (err) {
      console.warn("Failed to discard tab", tab.id, err);
    }
  }

  fetchTabs();
}

async function performanceBooster() {
  await closeDuplicates();
  await discardIdleTabs();
  suggestionTextEl.textContent = "🚀 Booster ran: duplicates closed and idle tabs slept.";
}

// --- Button events -------------------------------------------------------

groupTabsBtn.addEventListener("click", () => {
  autoGroupTabs().then(() => {
    suggestionTextEl.textContent = "📂 Tabs grouped by category.";
  });
});

closeDupesBtn.addEventListener("click", () => {
  closeDuplicates().then(() => {
    suggestionTextEl.textContent = "🔁 Closed duplicate tabs.";
  });
});

discardIdleBtn.addEventListener("click", () => {
  discardIdleTabs().then(() => {
    suggestionTextEl.textContent = "😴 Discarded idle tabs.";
  });
});

boosterBtn.addEventListener("click", () => {
  performanceBooster();
});

// --- Init ---------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  fetchTabs();
});
