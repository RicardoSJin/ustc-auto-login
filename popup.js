(() => {
  "use strict";

  const form = document.querySelector("#settingsForm");
  const usernameInput = document.querySelector("#username");
  const clearButton = document.querySelector("#clearButton");
  const status = document.querySelector("#status");

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  chrome.storage.local.get({ username: "" }, (settings) => {
    usernameInput.value = String(settings.username || "");
    usernameInput.focus();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = usernameInput.value.trim();

    if (!username) {
      showStatus("请输入账号。", true);
      usernameInput.focus();
      return;
    }

    chrome.storage.local.set({ username }, () => {
      if (chrome.runtime.lastError) {
        showStatus("保存失败，请重试。", true);
        return;
      }

      usernameInput.value = username;
      showStatus("已保存在当前浏览器中。刷新认证页面后生效。");
    });
  });

  clearButton.addEventListener("click", () => {
    chrome.storage.local.remove("username", () => {
      if (chrome.runtime.lastError) {
        showStatus("清除失败，请重试。", true);
        return;
      }

      usernameInput.value = "";
      showStatus("账号已清除，自动登录已暂停。");
      usernameInput.focus();
    });
  });
})();
