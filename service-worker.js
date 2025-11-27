// service-worker.js

// Currently simple, but you can expand with periodic cleanup logic
chrome.runtime.onInstalled.addListener(() => {
  console.log("Tab Angel installed.");
});

// Command: open popup-like behavior (can't open actual popup, but can open options page or a tab)
chrome.commands.onCommand.addListener((command) => {
  if (command === "open_tab_angel") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("popup.html")
    });
  }
});
