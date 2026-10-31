# 问答跳转 · dsh-qa-jump

给 **DeepSeek Harness（DSH）Web GUI** 加一行对话导航，解决“长回答翻页找不到位置”：

```
[提问][回答]  [↑] 3/12 [↓]  [▭/▬]
```

- **提问 / 回答双轴**：在「提问」和「回答」之间切换，用上一/下一个按钮跳到对应条目的**开头**。
- **回答按轮次归位**：一条回答 = 这条提问之后的模型输出起点，落点**包含「已完成，用时 N 秒」那一行**（不是回答末尾的“已编辑 N 个文件”区域）。
- **边界不空转**：只剩一条回答时，点按钮会先把该回答滚到顶部；真的已经在开头才提示“已经是最后一条回答”。
- **代码块折叠**：一键折叠/展开回答里的代码块（折叠后点单个代码块可单独展开），图标用“完整长框 ↔ 压扁短框”区分状态。
- **一行显示、移动端友好**：`flex-wrap: nowrap` + 窄屏/粗指针断点，320px 宽也能放下；按钮 `touch-action: manipulation`。

## 截图

控件行（「提问 / 回答」双轴，`17/17` 表示当前在最后一条）：

![控件行](https://raw.githubusercontent.com/sol-ray/dsh-qa-jump/main/docs/control-row.png)

折叠代码后的状态（图标变成压扁的短框，并给出“点击代码块可单独展开”的提示）：

![折叠代码](https://raw.githubusercontent.com/sol-ray/dsh-qa-jump/main/docs/code-folded.png)

## 安装

```bash
# 按你的运行方式选 profile（web / desktop）
dsh plugin --profile web add github:sol-ray/dsh-qa-jump

# 或直接用预构建 tarball（免构建，当前版本 1.6.4）
dsh plugin --profile web add https://github.com/sol-ray/dsh-qa-jump/releases/download/v1.6.4/dsh-qa-jump-1.6.4.tgz
```

装完重启 DSH（或刷新 Web GUI），输入框上方出现那行按钮。

本地开发目录安装：

```bash
dsh plugin --profile desktop add E:\path\to\dsh-qa-jump
```

卸载：

```bash
dsh plugin --profile web remove dsh-qa-jump
```

## 使用

| 操作 | 结果 |
|---|---|
| 点 `提问` / `回答` | 切换导航轴，计数器随之切换 |
| `↑` / `↓` | 跳到当前轴的上一条 / 下一条的**开头**（12px 留白） |
| 中间 `3/12` | 当前视口顶部所在的条目序号 / 总数 |
| `▭`（完整长框） | 折叠全部代码块；再点切到 `▬`（压扁短框）即展开 |
| 折叠状态下点某个代码块 | 只展开这一块；再点收回 |
| 拖拽选字 / 点代码块右上角复制按钮 | 不会误触折叠 |

## 工作原理（简要）

- 通过 **Cordis Slot** 注入两处：`conversation.input.dock`（控制行，加性槽位）与 `conversation.chat.assistant-actions`（每条已完成回答的隐形锚点，仅作兜底）。
- 定位基于会话外壳的稳定 DOM 钩子：`[data-conversation-scroll]`（滚动口）、`[data-chat-flow-kind]`（每条 Chat 行的 kind：`user` / `steering` / `assistant-step` / `turn-tail` …）。
- 回答轴取“每条用户行之后的第一条 `assistant-step` 行”，因此落到回答开头，而不是 turn 尾部；提问轴取 `user` / `steering` 行。
- 代码折叠是**纯 CSS**：`<html>` 上一个插件自有属性把 `[data-conversation-scroll] pre` 压到 156px，单块用 `data-daj-code-open` 抬起；不改消息渲染器、不插入节点。

## 兼容性与已知限制

- 在 **DSH 0.2.1-rc.5（Windows Desktop / Web GUI）** 上开发。
- 依赖上述 DOM 钩子；上游若重命名 kind，回答轴会退回锚点映射（仍可用，但粒度变粗），其余功能不受影响。
- 代码折叠作用于围栏代码块内部的 `<pre>`（`md-code-block` 内），语言标签与复制按钮保留。
- 流式输出期间新回答尚未产生 `assistant-step` 末尾动作行也不影响提问轴；回答轴按 flow 行即时计算，流式中即可跳。
- 截图取自本机实际运行（DSH 0.2.1-rc.5 / Windows 桌面端、深色主题），只覆盖控件行本身；代码块折叠对正文的效果未截图。

## 开发

```bash
node --check client.js      # 纯 JS，无需构建
```

目录：

```
index.js           # Host 半边（空实现，仅占位）
client.js          # 全部逻辑：锚点槽位 + 控制行 + 滚动定位 + 代码折叠
cordis.patch.yml   # 插入 answer-jump 行
dsh.plugin.json    # 市场清单
locale/            # 插件页标题/描述（zh / en）
icon.svg           # 图标
```

## 发布 / Release

发版走 GitHub Actions + **npm Trusted Publisher（OIDC）**，不需要 OTP，也不需要长期 token。

**触发方式**：推一个 `v*` 形式的 tag（打在 main 上），或者到 Actions 页面手动 `Run workflow`。

```bash
git tag v1.6.5
git push origin v1.6.5
```

workflow 在 `.github/workflows/publish.yml`：`permissions` 为 `contents: read` + `id-token: write`，Node 22，`npm publish --provenance --access public`。**不设置 `NODE_AUTH_TOKEN`**——认证完全来自 OIDC 身份。

**一次性配置**（在 npmjs.com 上做一次即可）：

1. **先让包在 registry 上存在。** npm 目前**不支持**给「还没发布过的包」预配 Trusted Publisher（依据见下），所以第一个版本必须手动发或用 token 发：
   - 2FA 开着：`npm publish --otp=<6 位动态码>`；
   - 或者临时建一个带 **bypass 2FA** 的 granular token，发一次后立刻撤销。
2. 打开 `https://www.npmjs.com/package/dsh-qa-jump` → **Settings** → **Trusted publishing** → **Add trusted publisher** → **GitHub Actions**，填：

   | 字段 | 值 |
   |---|---|
   | Organization or user | `sol-ray` |
   | Repository | `dsh-qa-jump` |
   | Workflow filename | `publish.yml`（只写文件名、不要路径，必须带 `.yml`） |
   | Environment name | 留空 |
   | Allowed actions | **勾选 `npm publish`** |

3. 两个容易踩的坑：
   - **Allowed actions 必须勾 `npm publish`**。2026-09-03 之后新建的配置默认只允许 `npm stage publish`，不勾这项 workflow 会被拒。
   - 新建的 Trusted Publisher 配置必须**在 48 小时内完成首次发布**才算校验通过并绑定，否则过期作废（只能删掉重建）。配完尽快推 tag。

> **关于「包还没发布过时，能不能先配 Trusted Publisher」**
> 结论：**不能**，首个版本必须先在 npm 上发布一次（手动或用 token），之后才能配 OIDC。理由和来源：
> 配置入口挂在包自己的 Settings 页上，包在 registry 上不存在就没有那个页面。npm CLI 仓库的 issue [npm/cli#8544 "Allow publishing initial version with OIDC"](https://github.com/npm/cli/issues/8544) 至今仍是 **open**，npm 维护者在 2025-09-05 的评论里明确说 MVP 阶段**故意不做** first publish over OIDC、正在评估后续支持；到 2026-08-05 仍有用户在追问进展，说明尚未实现。官方文档 [Trusted publishing](https://docs.npmjs.com/trusted-publishers) 的 Step 1 也是从「Navigate to your package settings」讲起，同样预设包已存在。若 npm 之后补上这个能力，以 npmjs.com 界面为准。

## License

MIT
