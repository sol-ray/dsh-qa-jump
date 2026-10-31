# Q&A Jump · dsh-qa-jump

A one-row navigation bar for the **DeepSeek Harness (DSH) Web GUI**, built for long replies:

```
[Question][Answer]  [↑] 3/12 [↓]  [▭/▬]
```

- **Two axes**: switch between *Question* and *Answer*, then jump to the **start** of the previous/next one.
- **Answers start at the reply**: the landing point is the turn's first output row, so the “已完成，用时 N 秒” summary line stays visible — not the turn tail where the “edited N files” summary lives.
- **Boundaries still act**: with a single answer, the button parks that answer at the top; the “already at the last answer” hint only appears once it really is there.
- **Code folding**: fold/unfold code blocks in replies (click one block to reopen it while folded). The icon shows the state: a full-height frame when open, a squashed frame when folded.
- **One row, mobile friendly**: `nowrap` layout plus narrow-screen and coarse-pointer breakpoints, fits 320px; `touch-action: manipulation` on buttons.

## Screenshots

The control row (Question / Answer axes; `17/17` means the last item is at the top):

![control row](https://raw.githubusercontent.com/sol-ray/dsh-qa-jump/main/docs/control-row.png)

With code folded (the icon becomes a squashed frame and the hint appears):

![code folded](https://raw.githubusercontent.com/sol-ray/dsh-qa-jump/main/docs/code-folded.png)

## Install

```bash
dsh plugin --profile web add github:sol-ray/dsh-qa-jump

# or the prebuilt tarball (current version 1.6.4, no build step)
dsh plugin --profile web add https://github.com/sol-ray/dsh-qa-jump/releases/download/v1.6.4/dsh-qa-jump-1.6.4.tgz
```

Restart DSH (or reload the Web GUI); the row appears above the composer.

Local checkout:

```bash
dsh plugin --profile desktop add /path/to/dsh-qa-jump
```

Uninstall:

```bash
dsh plugin --profile web remove dsh-qa-jump
```

## Usage

| Action | Result |
|---|---|
| Click `Question` / `Answer` | Switch the navigation axis; the counter follows |
| `↑` / `↓` | Jump to the start of the previous/next item on that axis (12px gap) |
| `3/12` | Position of the item at the top of the viewport / total |
| `▭` full frame | Fold every code block; click again (`▬` squashed frame) to unfold |
| Click a block while folded | Open just that block; click again to fold it back |
| Drag-select text, or click the block’s copy button | Does not toggle folding |

## How it works

- Injected through **Cordis Slots**: `conversation.input.dock` (the control row) and `conversation.chat.assistant-actions` (an invisible per-answer anchor, fallback only).
- Positioning uses the shell’s stable DOM hooks: `[data-conversation-scroll]` (scrollport) and `[data-chat-flow-kind]` (row kind: `user` / `steering` / `assistant-step` / `turn-tail` …).
- The answer axis is “the first `assistant-step` row after each user row”, so it lands on the reply’s start instead of the turn tail; the question axis uses `user` / `steering` rows.
- Code folding is **pure CSS**: one plugin-owned attribute on `<html>` clamps `[data-conversation-scroll] pre` to 156px, and `data-daj-code-open` lifts the clamp for one block. The message renderer is never rewritten.

## Compatibility and limitations

- Developed against **DSH 0.2.1-rc.5** (Windows Desktop / Web GUI).
- Depends on the DOM hooks above. If upstream renames the kinds, the answer axis falls back to the anchor mapping (coarser, still functional).
- Folding targets the `<pre>` inside fenced blocks (`md-code-block`), keeping the language label and copy button.
- Screenshots come from a real local run (DSH 0.2.1-rc.5, Windows desktop, dark theme) and cover the control row only; the effect of folding on long code blocks is not shown.

## License

MIT
