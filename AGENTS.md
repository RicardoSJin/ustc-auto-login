# AGENTS.md

中科大认证自动登录：一个 Chrome / Edge Manifest V3 扩展。在中科大统一身份认证页，把用户在扩展弹窗里配置的学工号 / GID 填进账号框，等浏览器密码管理器把密码回填进来以后点击"登录"；在 CARSI（Shibboleth IdP）流程里自动勾选使用条款，并选择"全局同意"。扩展不保存、不记录、不写入密码。

## 技术栈与约束

- 纯 JavaScript（普通脚本，用 IIFE 包裹，不是 ES Module）+ HTML / CSS。**没有依赖、没有构建步骤、没有 `package.json`、没有测试、也没有 lint 配置**；仓库根目录就是可以直接"加载已解压的扩展程序"的扩展目录
- 权限只有 `storage`；没有 `host_permissions`，也没有 background / service worker，只靠 `content_scripts` 注入页面
- `manifest.json` 没有设置 `minimum_chrome_version`
- 不发网络请求，不带统计、遥测或远程代码（README 的隐私承诺）
- 界面文字、代码注释、README 都是中文

## 目录结构

| 文件 | 作用 |
|---|---|
| `manifest.json` | MV3 清单：权限只有 `storage`；content script 匹配 4 个 USTC 域名；工具栏弹窗是 `popup.html` |
| `content.js` | 注入认证页的全部逻辑：CARSI 授权确认、填账号、等待密码回填、提交、写状态标记 |
| `popup.html` / `popup.js` / `popup.css` | 工具栏弹窗：保存 / 清除账号（`chrome.storage.local` 的 `username` 键） |
| `README.md` | 面向用户的中文说明（安装、首次使用、WebVPN 密码说明、隐私）。里面写了选择器和隐私承诺 |
| `LICENSE` | MIT |
| `.gitignore` | 忽略 `*.zip`、`.DS_Store`、`Thumbs.db` |

## 常用命令

| 用途 | 命令 |
|---|---|
| 安装依赖 / 构建 / 测试 / lint | 无，没有这些工具链。不要为了它们引入 npm |
| 语法检查 | `node --check content.js && node --check popup.js && node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"` |
| 打包（macOS） | `zip -X -j ustc-auto-login-v$(node -p "require('./manifest.json').version").zip manifest.json content.js popup.html popup.js popup.css README.md LICENSE` |

- 打出来的是扁平 ZIP，所有文件都在根目录，`manifest.json` 也在根目录。生成在仓库根目录，已被 `.gitignore` 的 `*.zip` 忽略
- v1.2.0 的正式发布包是同样的扁平结构，只是多带了一个 `.gitignore`。`AGENTS.md` / `CLAUDE.md` 不要打进包；新增运行时文件时，要同步加进上面的文件清单

## 本地调试

1. `chrome://extensions`（或 `edge://extensions`）里打开开发者模式 → "加载已解压的扩展程序" → 选择仓库根目录。改完代码先在扩展页点"重新加载"，**再刷新认证页**，已经打开的页面不会重新注入新代码
2. 查看运行状态：在认证页的 DevTools Console 里执行 `document.documentElement.dataset.ustcAutoLogin`。脚本带 `all_frames`，每个 frame 有自己的标记，要在 Console 的 frame 下拉框里切换。断点在 Sources → Content scripts → `content.js` 里打
3. 在真实认证页上测试，但不真正提交凭据：
   - **不配置账号**（在弹窗里点"清除"）：登录页只会标记 `account-not-configured`，不填也不点。**但 CARSI 两步确认不看账号配置，照样会自动点击**
   - **只验证填账号**：新建一个没有为该来源保存过密码的浏览器配置文件（Profile），在里面加载扩展。账号会被填进去，状态停在 `waiting-password`；密码框为空时永远不会提交
   - **看完整流程但不提交**：在 `content.js` 的 `currentButton.click()`（登录）或 `submitButton.click()`（CARSI）这一行打断点，停住以后直接关掉标签页
   - **注意**：扩展启用并且配置了账号时，**不要手动往密码框里打字**。只要密码框非空，约 400 ms 后就会自动点击登录，输入一个字符就会拿错误的密码去提交（可能导致账号被锁）。账号框也会被每 250 ms 改回配置的值
   - CARSI 的"全局同意"会被 IdP 记成长期授权，测试的时候要心里有数
4. 用 curl 看不到表单：`id.ustc.edu.cn/cas/login` 的静态 HTML 里只有 `<app-root>`，表单是前端渲染出来的，选择器只能在浏览器 DevTools 的 Elements 面板里核对
5. `matches` 只有 4 个 HTTPS 的 USTC 域名，本地 HTML 不会被注入。如果想离线做个模拟页，只能临时往 `matches` 里加本地地址，**这种改动不要提交** ❓（这条路没有实际试过）

## 架构要点

- **注入范围**：在 `https://id.ustc.edu.cn/*`、`https://idp.ustc.edu.cn/*`、`https://passport.ustc.edu.cn/*`、`https://wvpn.ustc.edu.cn/*` 上，以 `document_start` + `all_frames: true` 注入。所有域名跑同一套逻辑，代码不区分域名和路径。2026-10 实测：`passport.ustc.edu.cn` 会 302 跳到 `id.ustc.edu.cn/cas/login`，`idp.ustc.edu.cn` 跳到 `/idp/`，`wvpn.ustc.edu.cn` 跳到 `/login`。CARSI 确认页应该在 `idp.ustc.edu.cn` 上 ❓
- **驱动方式**：`MutationObserver` 观察整个 `document`（`childList` + `subtree`；属性只看 `disabled`、`aria-disabled`、`class`、`autocomplete`），同时每 250 ms 用 `setInterval` 轮询一次，因为密码管理器回填不一定会产生 DOM 变更。两者都调用 `tryAutoLogin()`；读完 storage、以及 storage 发生变更时，也各调一次
- **优先级**：每次都先执行 `tryCarsiConsent()`，命中了就不再走登录逻辑。CARSI 确认不依赖账号配置
- **CARSI 第一步（使用条款）**：勾选 `#accept[name="_shib_idp_consentIds"][value="my-tou"]`，然后点同一表单里的 `input[type="submit"][name="_eventId_proceed"][value="Submit"]`
- **CARSI 第二步（全局同意）**：选中 `#_shib_idp_globalConsent[type="radio"][name="_shib_idp_consentOptions"][value="_shib_idp_globalConsent"]`，然后点 `input[type="submit"][name="_eventId_proceed"][value="Accept"]`
- **CARSI 点击流程**（`scheduleConsentSubmit`）：控件没选中就 `click()` 一次，点了仍然没选中就标记 `<步骤>-control-failed` 并放弃。300 ms 后再确认一遍：控件和按钮都还在 DOM 里、控件仍然选中、按钮可用，才点击按钮。点击前会断开 observer 并停掉轮询
- **登录选择器**：账号框 `#nameInput`；密码框是 `input[type="password"], input[autocomplete="current-password"]` 匹配到的第一个；登录按钮 `#submitBtn`
- **autocomplete 纠正**：密码框的 `autocomplete` 不是 `current-password` 时，改成 `current-password`。根据代码注释，认证页原本标成了 `new-password`，会让密码管理器不回填已保存的密码
- **填账号**：用 `HTMLInputElement.prototype` 上原生的 `value` setter 写入，然后派发 `input`（`InputEvent`，`insertText`）和 `change` 事件，让 Angular 表单感知到。值已经一样时不重复写
- **等待密码回填**：只有 `passwordInput.value` 真的非空才算就绪，浏览器显示的 autofill 伪状态不算。按钮"可用"的条件是：不是 `disabled`，`aria-disabled` 不为 `"true"`，并且 `offsetParent !== null`
- **提交**：就绪以后等 400 ms 再核对一遍（账号值等于配置值、密码非空、按钮可用），再给两个输入框补发 `input` / `change`，设置 `submitted = true`，然后点击按钮。点击 3 s 后如果按钮还在 DOM 里：密码框已经被清空，就复位重试；密码仍然非空，就标记 `submit-no-navigation`，**不再重复提交**
- **账号存储**：存在 `chrome.storage.local` 的 `username` 键（字符串，先 trim 再保存，弹窗输入框 `maxlength="200"`）。"清除"就是 `remove("username")`。`content.js` 读取时默认值是 `""`，并监听 `chrome.storage.onChanged`（只看 `local` 区），账号一变就立即生效，同时复位 `submitted`
- **注入标记**：在每个 frame 的 `<html>` 上写 `data-ustc-auto-login="<状态>"` 和 `data-ustc-auto-login-version`。版本号是**写死在 `content.js` 里的**，现在是 `1.2.0`。状态值有：`loaded`、`loading-settings`、`account-not-configured`、`waiting-password`、`submitting`、`submit-no-navigation`、`carsi-terms-{ready,submitting,control-failed}`、`carsi-global-consent-{ready,submitting,control-failed}`
  - 每次调用 `tryAutoLogin()` 都会先写 `loaded`。登录提交以后轮询不会停，所以 `submitting` / `submit-no-navigation` 最多只停留 250 ms 左右，就会被 `loaded` 覆盖；CARSI 提交前已经停掉了轮询，所以 `carsi-*-submitting` 会一直留着
  - `attributeFilter` 里故意没有 `data-*`。不要加进去，否则 `markState` 写标记会反过来触发 observer，形成自循环

## 脆弱点（USTC 改版就会坏）

- `#nameInput`、`#submitBtn` 都是 id 选择器，改版改了 id 就会失效。找不到账号框时，状态停在 `loaded`；找不到按钮时，状态停在 `waiting-password`
- 密码框取页面上第一个匹配的，如果页面同时有多个密码框，可能会选错
- 按钮可见性靠 `offsetParent` 判断：按钮如果放在 `position: fixed` 的容器里，`offsetParent` 是 `null`，就永远不会提交
- 让 Angular 拿到值，靠的是 `input` / `change` 事件；页面换了前端框架，可能就不够了
- CARSI 依赖 Shibboleth IdP 模板里的 `name` / `value`（`_shib_idp_consentIds`、`my-tou`、`_shib_idp_consentOptions`、`_eventId_proceed`）。按钮是按 `value` 文案（`Submit` / `Accept`）匹配的，IdP 改了文案或者按语言做了本地化，就不会再自动确认 ❓
- 认证页换了域名，就要把新的 HTTPS 域名加进 `matches`（README 里也写了）
- WebVPN 页面的来源是 `wvpn.ustc.edu.cn`，跟 `id.ustc.edu.cn` 不是同一个来源，密码管理器可能不回填，状态就会停在 `waiting-password`（README 里写了处理办法）
- 判断"点了登录但页面没跳走"，依据是 3 s 后按钮还在 DOM 里

## 安全与隐私约束（不要放宽）

- **绝不保存、记录（包括 `console.*`）、写入或发送密码**。密码只能由浏览器密码管理器回填，并由页面自己提交；`content.js` 对密码框只做两件事：检查是否非空、补发 `input` / `change` 事件
- 账号**只存在 `chrome.storage.local`**。不要改成 `storage.sync`，也不要把任何真实账号写进源码、默认值、示例、Release 说明或本文件；源码和发布包里都不能带用户账号
- **只有在 DOM 里真的读到非空的密码值时才提交**。不要把 autofill 伪状态或者"等待超时"当成已就绪，也不要加"超时以后强行提交"
- 提交以后，密码仍然非空也**不自动重复提交**（防止连续用错误密码尝试导致锁号）。不要加重试循环
- 没有配置账号时，登录页不填也不点
- 注入标记里不能放账号或密码
- 权限保持只有 `storage`；不加 `host_permissions`、`scripting`、`tabs` 之类的权限；不发网络请求，不加遥测，不加远程代码
- CARSI 第二步选的是"全局同意"（长期授权）。要改授权范围，得同步改 README 里的说明

## 开发流程

- 目前 Git 历史只有 1 个提交，直接提交在 `main` 上；没有 PR，没有其它分支，也还没有定下分支命名约定 ❓
- 发布（照 v1.2.0 的做法）：同时更新 `manifest.json` 的 `version` 和 `content.js` 里 `ustcAutoLoginVersion` 写死的版本号 → 跑语法检查，并在真实认证页上手动验证 → 打包 → 创建 GitHub Release：tag 用 `v<版本>`（目标分支 `main`），标题写 `v<版本> - <中文简述>`，附件上传 `ustc-auto-login-v<版本>.zip`，说明用中文
- 改了行为或选择器，要同步更新 `README.md`（README 里列了选择器、等待逻辑和隐私承诺）

## 编码风格

- 每个脚本都用 IIFE 包裹，加 `"use strict"`；不用模块，不引入依赖、框架或构建
- 选择器常量放在文件顶部（`USERNAME_SELECTOR` 等）；2 空格缩进，字符串用双引号（选择器里本身有双引号时用单引号），语句末尾加分号
- 注释用中文，写清楚"为什么"（比如为什么纠正 autocomplete、为什么不重复提交）；用户能看到的文字都用中文
