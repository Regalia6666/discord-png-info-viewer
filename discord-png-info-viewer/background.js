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
    // content.jsに画像のURLを送信して処理を依頼
    chrome.tabs.sendMessage(tab.id, {
      action: "processImage",
      imageUrl: info.srcUrl
    });
  }
});
