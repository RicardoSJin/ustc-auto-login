# 中科大认证自动登录

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](manifest.json)

适用于 Chrome / Edge（Manifest V3）。插件会在中科大统一身份认证页：

1. 将你在扩展窗口中配置的学工号 / GID 填入 `#nameInput`；
2. 将认证页密码框的自动完成类型纠正为 `current-password`，并等待浏览器密码管理器回填；
3. 点击 `#submitBtn`（“立即登录”）。

在中科大 Shibboleth IdP 的 CARSI 流程中，插件还会：

1. 勾选使用条款 `#accept`，点击值为 `Submit` 的继续按钮；
2. 在下一页选择 `#_shib_idp_globalConsent`，点击值为 `Accept` 的接受按钮。

第二步选择的是“全局同意”，会保存为面向后续 CARSI 服务的长期授权选择。

账号只保存在当前浏览器的扩展本地存储中，不写入源码，也不会同步到 GitHub。插件不会保存或记录密码；密码仅由浏览器密码管理器回填，并由认证页面在登录时正常提交。

插件仅在页面 DOM 确实能读取到非空密码值后提交，不把浏览器短暂显示的 `autofill` 伪状态当作密码已经就绪。提交前会触发表单同步事件，让 Angular 获取浏览器回填的值。

扩展会在页面根元素写入 `data-ustc-auto-login` 和版本标记，用于判断脚本是否已经注入；其中不包含账号或密码。

## 安装

1. Chrome 打开 `chrome://extensions/`；Edge 打开 `edge://extensions/`。
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本文件夹 `ustc-auto-login`。

## 首次使用

1. 点击浏览器工具栏中的“中科大认证自动登录”扩展图标。
2. 在窗口中填写学工号 / GID，点击“保存账号”。
3. 刷新认证页面。

未配置账号时，插件不会填写登录表单或点击登录按钮。可随时在扩展窗口中更换或清除账号。

浏览器必须已经为当前认证页保存该账号的密码。通过 WebVPN 登录时，页面来源是 `wvpn.ustc.edu.cn`，它和 `id.ustc.edu.cn` 是不同来源；只为后者保存的密码不一定会被浏览器用于 WebVPN 页面。

如果 WebVPN 页面仍未自动回填，请先停用插件，在该 WebVPN 认证页手动登录一次并接受浏览器的“保存密码”提示，然后重新启用插件。

如果认证页面实际位于另一个域名，需把该 HTTPS 域名补充到 `manifest.json` 的 `matches` 中。

## 隐私

- GitHub 源码和发布包不包含任何用户账号或密码。
- 账号由用户在扩展窗口中填写，仅保存在 `chrome.storage.local`。
- 密码由浏览器自带的密码管理器处理，本扩展不保存密码。
- 扩展不发送网络请求，也不包含统计、遥测或远程代码。

## 开源许可

[MIT](LICENSE)
