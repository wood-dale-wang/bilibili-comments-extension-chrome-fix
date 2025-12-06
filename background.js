// 说明：原先尝试在 onBeforeSendHeaders 中同步插入 Cookie，但
// chrome.cookies.get 是异步的，无法将 Promise 作为 header 值。
// 在 Manifest V3 中应避免这样做。此处移除该拦截逻辑，
// 并提供基于消息的接口，content script 可以请求 SESSDATA。

// 处理来自 content script 的消息：支持获取 SESSDATA 和下载 CSV
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) return;

  if (request.action === 'getSESSDATA') {
    // 获取 SESSDATA cookie 并返回给调用方（异步回调）
    chrome.cookies.get({ url: 'https://www.bilibili.com', name: 'SESSDATA' }, (cookie) => {
      const value = cookie ? cookie.value : '';
      sendResponse({ sessdata: value });
    });
    // 返回 true 表示将异步调用 sendResponse
    return true;
  }

  if (request.action === 'downloadCSV') {
    const { csvContent, filename } = request;
    try {
      // 在 service worker（MV3 后台）中没有 DOM 的 createObjectURL 可用，
      // 使用 data URL（base64 编码）的方式进行下载。
      // 注意：若 CSV 非常大，data URL 可能失败或消耗较多内存。
      const encoded = btoa(unescape(encodeURIComponent(csvContent)));
      const dataUrl = `data:text/csv;charset=utf-8;base64,${encoded}`;

      chrome.downloads.download({
        url: dataUrl,
        filename: filename || 'comments.csv',
        conflictAction: 'uniquify',
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, downloadId });
        }
      });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }
});