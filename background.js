// 拡張機能がインストールされた時にコンテキストメニューを作成
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "png-info-viewer",
    title: "png-info-viewer で情報を表示",
    contexts: ["image"]
  });
});

// コンテキストメニューがクリックされた時の処理
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "png-info-viewer" && info.srcUrl) {
    // 1. CSSを注入
    chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["style.css"]
    }).catch(err => console.error("Failed to insert CSS:", err));

    // 2. content.js を注入し、完了後にメッセージを送信
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    }).then(() => {
      // 3. 注入が完了したので、content.jsにメッセージを送信
      chrome.tabs.sendMessage(tab.id, {
        action: "processImage",
        imageUrl: info.srcUrl
      });
    }).catch(err => {
      // スクリプトを注入できないページ（例：Chromeウェブストア）で実行した場合のエラー
      console.error("Failed to execute script:", err);
    });
  }
});
