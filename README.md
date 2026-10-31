# 问答跳转 · dsh-qa-jump

给 **DeepSeek Harness（DSH）Web GUI** 加一行对话导航，解决“长回答翻页找不到位置”：

```
[提问][回答]  [↑] 3/12 [↓]  [▭/▬]
```

- **提问 / 回答双轴**：在「提问」和「回答」之间切换，用上一/下一个按钮跳到对应条目的**开头**。
- **回答按轮次归位**：一条回答 = 这条提问之后的模型输出起点（不是回答末尾的“已编辑 N 个文件”区域）。
- **边界不空转**：只剩一条回答时，点按钮会先把该回答滚到顶部；真的已经在开头才提示“已经是最后一条回答”。
- **代码块折叠**：一键折叠/展开回答里的代码块（折叠后点单个代码块可单独展开），图标用“完整长框 ↔ 压扁短框”区分状态。
- **一行显示、移动端友好**：`flex-wrap: nowrap` + 窄屏/粗指针断点，320px 宽也能放下；按钮 `touch-action: manipulation`。

## 安装

```bash
# 按你的运行方式选 profile（web / desktop）
dsh plugin --profile web add github:zhangjietest666/dsh-qa-jump
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
- 未提供截图：视觉验证需在已登录的 Web GUI 中进行，仓库内不放置未经核实的截图。

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

## License

MIT
