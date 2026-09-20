(() => {
  "use strict";

  const USERNAME_SELECTOR = "#nameInput";
  const PASSWORD_SELECTOR = [
    'input[type="password"]',
    'input[autocomplete="current-password"]'
  ].join(",");
  const SUBMIT_SELECTOR = "#submitBtn";

  let clickTimer = null;
  let intervalId = null;
  let submitted = false;
  let configuredUsername = "";
  let settingsLoaded = false;

  function markState(state) {
    const root = document.documentElement;
    if (!root) return;

    root.dataset.ustcAutoLogin = state;
    root.dataset.ustcAutoLoginVersion = "1.2.0";
  }

  function setNativeInputValue(input, value) {
    if (input.value === value) return;

    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;

    if (valueSetter) {
      valueSetter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: value
    }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function isUsableButton(button) {
    return !button.disabled
      && button.getAttribute("aria-disabled") !== "true"
      && button.offsetParent !== null;
  }

  function isPasswordReady(input) {
    // 只有页面 DOM 确实能读到密码值时才允许提交。
    // 视觉上的浏览器自动填充伪状态不足以证明 Angular 已收到密码。
    return Boolean(input?.value);
  }

  function syncAutofilledInput(input) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function scheduleConsentSubmit(control, submitButton, state) {
    if (!control.checked) control.click();

    if (!control.checked) {
      markState(`${state}-control-failed`);
      return;
    }

    markState(`${state}-ready`);
    if (clickTimer !== null) return;

    clickTimer = window.setTimeout(() => {
      clickTimer = null;

      if (
        !submitted
        && control.isConnected
        && submitButton.isConnected
        && control.checked
        && isUsableButton(submitButton)
      ) {
        submitted = true;
        markState(`${state}-submitting`);
        observer.disconnect();
        if (intervalId !== null) window.clearInterval(intervalId);
        submitButton.click();
      }
    }, 300);
  }

  function tryCarsiConsent() {
    const termsCheckbox = document.querySelector(
      '#accept[name="_shib_idp_consentIds"][value="my-tou"]'
    );

    if (termsCheckbox) {
      const termsForm = termsCheckbox.form || document;
      const submitButton = termsForm.querySelector(
        'input[type="submit"][name="_eventId_proceed"][value="Submit"]'
      );

      if (submitButton) {
        scheduleConsentSubmit(termsCheckbox, submitButton, "carsi-terms");
        return true;
      }
    }

    const globalConsent = document.querySelector(
      '#_shib_idp_globalConsent[type="radio"]'
      + '[name="_shib_idp_consentOptions"]'
      + '[value="_shib_idp_globalConsent"]'
    );

    if (globalConsent) {
      const consentForm = globalConsent.form || document;
      const acceptButton = consentForm.querySelector(
        'input[type="submit"][name="_eventId_proceed"][value="Accept"]'
      );

      if (acceptButton) {
        scheduleConsentSubmit(globalConsent, acceptButton, "carsi-global-consent");
        return true;
      }
    }

    return false;
  }

  function tryAutoLogin() {
    markState("loaded");
    if (submitted) return;

    if (tryCarsiConsent()) return;

    if (!settingsLoaded) {
      markState("loading-settings");
      return;
    }

    if (!configuredUsername) {
      markState("account-not-configured");
      return;
    }

    const usernameInput = document.querySelector(USERNAME_SELECTOR);
    if (!usernameInput) return;

    const passwordInput = document.querySelector(PASSWORD_SELECTOR);
    if (passwordInput?.getAttribute("autocomplete") !== "current-password") {
      // 认证页目前错误地标为 new-password，会阻止密码管理器使用已有密码。
      passwordInput?.setAttribute("autocomplete", "current-password");
    }

    setNativeInputValue(usernameInput, configuredUsername);
    markState("waiting-password");

    const submitButton = document.querySelector(SUBMIT_SELECTOR);

    // 密码只由浏览器密码管理器回填；插件不读取、保存或写入密码。
    if (!isPasswordReady(passwordInput) || !submitButton || !isUsableButton(submitButton)) {
      return;
    }

    if (clickTimer !== null) return;

    clickTimer = window.setTimeout(() => {
      clickTimer = null;

      const currentUsername = document.querySelector(USERNAME_SELECTOR);
      const currentPassword = document.querySelector(PASSWORD_SELECTOR);
      const currentButton = document.querySelector(SUBMIT_SELECTOR);

      if (
        currentUsername?.value === configuredUsername
        && isPasswordReady(currentPassword)
        && currentButton
        && isUsableButton(currentButton)
      ) {
        // 密码值已经真实进入 DOM 后，再补发事件同步 Angular 表单模型。
        syncAutofilledInput(currentUsername);
        syncAutofilledInput(currentPassword);
        submitted = true;
        markState("submitting");
        currentButton.click();

        window.setTimeout(() => {
          if (!currentButton.isConnected) return;

          const remainingPassword = document.querySelector(PASSWORD_SELECTOR);
          if (!remainingPassword?.value) {
            submitted = false;
            markState("waiting-password");
            tryAutoLogin();
          } else {
            // 不自动重复提交非空密码，避免错误状态下连续尝试导致账号锁定。
            markState("submit-no-navigation");
          }
        }, 3000);
      }
    }, 400);
  }

  const observer = new MutationObserver(tryAutoLogin);
  // document_start 时 documentElement 可能尚未创建；Document 本身始终可观察。
  observer.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "aria-disabled", "class", "autocomplete"]
  });

  // 浏览器密码管理器的回填不一定产生 DOM 变更，因此同时做轻量检查。
  intervalId = window.setInterval(tryAutoLogin, 250);

  chrome.storage.local.get({ username: "" }, (settings) => {
    configuredUsername = String(settings.username || "").trim();
    settingsLoaded = true;
    tryAutoLogin();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.username) return;

    configuredUsername = String(changes.username.newValue || "").trim();
    settingsLoaded = true;
    submitted = false;
    tryAutoLogin();
  });

  tryAutoLogin();
})();
