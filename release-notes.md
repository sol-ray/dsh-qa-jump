提问/回答双轴跳转 + 代码块折叠（DSH Web GUI 插件）。

### 本版要点
- 回答跳转的落点改为该轮输出的第一行，`已完成，用时 N 秒` 不再被顶出视口。
- 回答轴按轮次计数：每条提问之后的输出算一条，正好一跳一条。
- 代码块一键折叠/展开；图标用「完整长框 / 压扁短框 + 折角」区分状态。
- 导航按钮改为图标，整行不换行，窄屏与触屏断点下仍可用。
- 边界归位：只剩一条回答时，点箭头会先把它滚到顶部，真在顶部才提示。

### Install
```bash
dsh plugin --profile web add github:zhangjietest666/dsh-qa-jump
# or from this tarball
dsh plugin --profile web add https://github.com/zhangjietest666/dsh-qa-jump/releases/download/v1.6.4/dsh-qa-jump-1.6.4.tgz
```
