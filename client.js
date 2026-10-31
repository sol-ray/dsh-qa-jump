/**
 * Client half of the Answer Jump bundle.
 *
 * Two slot entries cooperate:
 *
 *   conversation.chat.assistant-actions  -> one invisible anchor per finalized
 *       assistant message, used only as a fallback row mapping. The action row
 *       is rendered inside the turn-tail row (next to the "已编辑 N 个文件"
 *       summary), so an anchor is NOT a reliable answer-start handle.
 *
 *   conversation.input.dock -> the "上一个/下一个" control row above the
 *       composer, with a 提问/回答 switch.
 *       "回答" = the model output of one turn: the first `assistant-step` row
 *       after each `user`/`steering` row, so the landing point is the start of
 *       the reply rather than the tail where the action row lives.
 *       "提问" = the `user`/`steering` rows themselves.
 *       Either axis orders rows in document order, resolves the current row
 *       from the scroll position of `[data-conversation-scroll]`, and scrolls
 *       the target row's top to the top of the scrollport.
 *
 * Everything is derived at click/scroll time from the live DOM, so streaming
 * output, newly created rows, and session switches need no special case:
 * React mounts/unmounts the anchors and the registry follows.
 */
window.__ModuleLoader__.load({
  id: "dsh-qa-jump",
  factory(require) {
    const React = require("react");
    const h = React.createElement;

    const ACTIONS_SLOT = "conversation.chat.assistant-actions";
    const DOCK_SLOT = "conversation.input.dock";

    /** Session scrollport, per the shell's stable DOM contract. */
    const SCROLL_ATTR = "[data-conversation-scroll]";
    /** One Chat row; the attribute value is the Chat node kind. */
    const ROW_ATTR = "[data-chat-flow-kind]";
    /**
     * Code folding is pure CSS: one attribute on `<html>` clamps every `<pre>`
     * inside the conversation, and one attribute on a block lifts that clamp
     * for that block. The plugin owns both attributes and removes them on
     * teardown, so nothing inside the message renderer is rewritten.
     */
    const CODE_GLOBAL_ATTR = "data-daj-code-collapsed";
    const CODE_BLOCK_ATTR = "data-daj-code-open";

    /** Gap kept above the landing row, in px. */
    const TOP_GAP = 12;
    /**
     * A row counts as "current" when its start is at most this far below the
     * scrollport top. Kept well above TOP_GAP so that a smooth scroll settling a
     * pixel or two off cannot demote the row we just jumped to.
     */
    const TOP_TOLERANCE = 40;
    /** How long a scheduled jump overrides the measured position, in ms. */
    const PENDING_MS = 800;

    const ZH = {
      group: "提问与回答跳转",
      modeQuestion: "提问",
      modeAnswer: "回答",
      prev: "上一个回答",
      next: "下一个回答",
      prevQuestion: "上一个提问",
      nextQuestion: "下一个提问",
      emptyQuestion: "暂无提问",
      emptyAnswer: "暂无回答",
      codeCollapse: "折叠代码",
      codeExpand: "展开代码",
      codeFolded: "已折叠代码，点击代码块可单独展开",
      codeUnfolded: "已展开全部代码",
      first: "已经是第一条回答",
      last: "已经是最后一条回答",
      firstQuestion: "已经是第一个提问",
      lastQuestion: "已经是最后一个提问",
    };
    const EN = {
      group: "Question and answer jump",
      modeQuestion: "Question",
      modeAnswer: "Answer",
      prev: "Previous answer",
      next: "Next answer",
      prevQuestion: "Previous question",
      nextQuestion: "Next question",
      emptyQuestion: "No questions yet",
      emptyAnswer: "No answers yet",
      codeCollapse: "Fold code",
      codeExpand: "Unfold code",
      codeFolded: "Code folded — click a block to open it",
      codeUnfolded: "All code unfolded",
      first: "Already at the first answer",
      last: "Already at the last answer",
      firstQuestion: "Already at the first question",
      lastQuestion: "Already at the last question",
    };

    const CSS = [
      ".daj-root{display:flex;flex-wrap:nowrap;align-items:center;justify-content:center;gap:6px;min-width:0;overflow:hidden;padding:2px 8px 4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);-webkit-tap-highlight-color:transparent;}",
      ".daj-modes{display:inline-flex;flex:none;align-items:center;gap:2px;padding:2px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);}",
      ".daj-mode{height:20px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:1;cursor:pointer;}",
      ".daj-mode:hover{color:var(--dsw-alias-label-primary);}",
      ".daj-mode[aria-pressed=\"true\"]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1);}",
      ".daj-mode:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}",
      ".daj-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:24px;min-width:26px;padding:0 9px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:1;cursor:pointer;touch-action:manipulation;transition:border-color .15s ease,opacity .15s ease;}",
      ".daj-btn:hover{border-color:var(--dsw-alias-border-l2);}",
      ".daj-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}",
      ".daj-btn.is-dim{opacity:.5;}",
      ".daj-btn[aria-pressed=\"true\"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);}",
      ".daj-count{min-width:46px;text-align:center;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);}",
      ".daj-hint{max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);}",
      ".daj-anchor{display:none;}",
      ".daj-sep{flex:none;width:1px;height:16px;background:var(--dsw-alias-border-l1);}",
      ".daj-btn.is-icon{width:26px;padding:0;gap:0;flex:none;}",
      "@media (max-width:520px){.daj-root{gap:4px;padding:2px 6px 4px;font-size:11px;}.daj-mode{padding:0 6px;}.daj-count{min-width:38px;}.daj-btn.is-icon{width:24px;}.daj-hint{max-width:38%;}}",
      "@media (pointer:coarse){.daj-btn{height:30px;}.daj-btn.is-icon{width:30px;}.daj-mode{height:24px;}}",
      "html[data-daj-code-collapsed] [data-conversation-scroll] pre{max-height:156px;overflow:hidden;cursor:zoom-in;-webkit-mask-image:linear-gradient(to bottom,rgba(0,0,0,1) 0,rgba(0,0,0,1) 70%,rgba(0,0,0,0) 100%);mask-image:linear-gradient(to bottom,rgba(0,0,0,1) 0,rgba(0,0,0,1) 70%,rgba(0,0,0,0) 100%);}",
      "html[data-daj-code-collapsed] [data-conversation-scroll] pre[data-daj-code-open=\"true\"]{max-height:none;overflow:visible;cursor:auto;-webkit-mask-image:none;mask-image:none;}",
    ].join("");

    /** { messageId, el } for every mounted finalized answer. */
    const anchors = new Set();
    /** Things that want to re-measure (the control row). */
    const subscribers = new Set();
    /** The jump in flight, so rapid clicks advance instead of re-reading a stale position. */
    let pendingJump = null;
    /** Which axis the control row is on; kept across sessions within the page. */
    let lastMode = "answer";
    /** Whether code blocks are folded; kept across sessions within the page. */
    let codeCollapsed = false;
    let localeService = null;

    function notify() {
      for (const subscriber of Array.from(subscribers)) {
        try {
          subscriber();
        } catch (error) {
          console.error("[answer-jump]", error);
        }
      }
    }

    function isScrollable(el) {
      if (!el) return false;
      if (el.scrollHeight <= el.clientHeight + 4) return false;
      const style = window.getComputedStyle(el);
      return (
        style.overflowY === "auto" ||
        style.overflowY === "scroll" ||
        style.overflowY === "overlay"
      );
    }

    /**
     * The element that actually scrolls the Chat rows. Resolved ancestor-first
     * from the rows, because the nearest scrollable ancestor is by definition
     * what moves them; `data-conversation-scroll` is only a fallback (it may
     * describe a wrapper, or several stacked scrollports).
     */
    function findScroller(rows) {
      const first = rows && rows[0];
      if (first) {
        let el = first.parentElement;
        while (el) {
          if (isScrollable(el)) return el;
          el = el.parentElement;
        }
      }
      const declared = Array.prototype.slice.call(document.querySelectorAll(SCROLL_ATTR));
      const scrollable = declared.find((el) => isScrollable(el));
      if (scrollable) return scrollable;
      if (declared.length) return declared[0];
      return document.scrollingElement || null;
    }

    /**
     * The Chat row an anchor belongs to. Normally the nearest
     * `[data-chat-flow-kind]` ancestor; if the action row is ever rendered
     * outside the message row, fall back to the outermost visible ancestor that
     * is still inside the scrollport, which is the message (or turn) box.
     */
    function rowFor(el) {
      const row = el.closest ? el.closest(ROW_ATTR) : null;
      if (row) return row;

      let best = el;
      let current = el.parentElement;
      let depth = 0;
      while (current && depth < 12) {
        if (current.hasAttribute("data-conversation-scroll")) break;
        if (current.offsetHeight > 0) best = current;
        current = current.parentElement;
        depth += 1;
      }
      return best;
    }

    /** Every Chat row inside the session scrollport, in document order. */
    function flowRows() {
      const scroller = findScroller();
      const scope =
        scroller && typeof scroller.querySelectorAll === "function" ? scroller : document;
      const rows = Array.prototype.slice.call(scope.querySelectorAll(ROW_ATTR));
      if (rows.length) return rows;
      return Array.prototype.slice.call(document.querySelectorAll(ROW_ATTR));
    }

    /**
     * Answer start rows: a "回答" is the output block of one turn, so the target
     * is the FIRST flow row after each user/steering row — deliberately not the
     * assistant message row. In the shell that first row is the turn summary
     * line ("已完成，用时 N 秒"), which sits above the reply body; anchoring on
     * the message row scrolls that line off the top of the viewport.
     */
    function readAnswerRows() {
      const answers = [];
      let armed = true;
      for (const row of flowRows()) {
        const kind = row.getAttribute("data-chat-flow-kind");
        if (kind === "user" || kind === "steering") {
          armed = true;
          continue;
        }
        if (!armed) continue;
        answers.push(row);
        armed = false;
      }
      if (answers.length) return answers;
      // Fallback for a shell that renames the kind: the old anchor mapping.
      return readAnchorRows();
    }

    /** Legacy mapping: one row per mounted assistant-message anchor. */
    function readAnchorRows() {
      const found = [];
      for (const entry of anchors) {
        const el = entry.el;
        if (!el || !el.isConnected) continue;
        found.push(rowFor(el));
      }
      const ordered = found.slice().sort((a, b) => {
        if (a === b) return 0;
        return a.compareDocumentPosition(b) & 4 ? -1 : 1;
      });
      const rows = [];
      for (const row of ordered) {
        if (rows[rows.length - 1] !== row) rows.push(row);
      }
      return rows;
    }

    /**
     * Rows for one navigation axis.
     * - "answer": anchors registered by the assistant-actions slot.
     * - "question": user-side rows, read from the shell's kind attribute
     *   (`user` for a normal message, `steering` for input sent mid-run).
     */
    function collectRows(mode) {
      if (mode !== "question") return readAnswerRows();
      return flowRows().filter((row) => {
        const kind = row.getAttribute("data-chat-flow-kind");
        return kind === "user" || kind === "steering";
      });
    }

    /**
     * The box that stands for a row's start. A Chat row can be a zero-height
     * wrapper (`display: contents`), whose own rect is empty and would poison
     * every measurement, so fall back to the first child that has a real box.
     */
    function startBox(row) {
      if (!row) return null;
      if (row.getBoundingClientRect().height > 0) return row;
      let child = row.firstElementChild;
      let guard = 0;
      while (child && guard < 8) {
        if (child.getBoundingClientRect().height > 0) return child;
        child = child.firstElementChild;
        guard += 1;
      }
      return row;
    }

    /** Offset of a row's start in the scroll content, in px. */
    function contentTop(row, scroller) {
      const box = startBox(row) || row;
      return (
        box.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop
      );
    }

    function computeSnapshot(mode) {
      const rows = collectRows(mode);
      const scroller = findScroller(rows);
      let current = -1;

      if (scroller && rows.length) {
        const scrollTop = scroller.scrollTop;
        const tops = rows.map((row) => contentTop(row, scroller));
        for (let index = 0; index < tops.length; index += 1) {
          if (tops[index] <= scrollTop + TOP_TOLERANCE) current = index;
        }
        // Scrolled to the very bottom: the last answer is the one being read,
        // even though its start cannot reach the top of the scrollport.
        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
          current = rows.length - 1;
        }
        // Never report "unknown" while the reader is somewhere in the middle:
        // if the offset maths found nothing, take the row closest to the top.
        if (current < 0 && scrollTop > TOP_TOLERANCE) {
          let best = 0;
          let bestGap = Infinity;
          for (let index = 0; index < tops.length; index += 1) {
            const gap = Math.abs(tops[index] - scrollTop);
            if (gap < bestGap) {
              bestGap = gap;
              best = index;
            }
          }
          current = best;
          // One quiet line for diagnosis: a real shell should never get here.
          console.log("[answer-jump] no row above the fold", {
            scrollTop: Math.round(scrollTop),
            tops: tops.map((value) => Math.round(value)),
          });
        }
      }

      if (pendingJump) {
        if (Date.now() < pendingJump.until) {
          current = pendingJump.index;
        } else {
          pendingJump = null;
        }
      }

      // Whether a click would actually travel: the boundary row may still need
      // to be parked at the top (one lone answer, or a long final answer).
      let canPrev = false;
      let canNext = false;
      if (rows.length && scroller) {
        const wouldMove = (index) => {
          const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
          if (!row) return false;
          return Math.abs(targetTop(scroller, row) - scroller.scrollTop) > 1;
        };
        canPrev = current < 0 ? false : wouldMove(current - 1);
        canNext = wouldMove(current + 1);
      }

      return { total: rows.length, current, canPrev, canNext };
    }

    /** Final scrollTop that parks a row's start at the top of the scrollport. */
    function targetTop(scroller, row) {
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      return Math.max(0, Math.min(contentTop(row, scroller) - TOP_GAP, max));
    }

    function scrollToTop(scroller, top) {
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      try {
        scroller.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
      } catch (error) {
        scroller.scrollTop = top;
      }
    }

    /**
     * @returns {"moved"|"first"|"last"|"none"}
     *
     * Boundary semantics: when the requested target is out of range, the edge
     * row is used instead and is parked at the top. Only when that row already
     * sits at the top (or the content cannot scroll any further, e.g. a single
     * short reply) is the boundary reported, so one lone answer still answers a
     * click by scrolling to its start rather than by showing a hint.
     */
    function step(direction, mode) {
      const snapshot = computeSnapshot(mode);
      if (!snapshot.total) return "none";
      // Nothing exists above the first row at all.
      if (direction < 0 && snapshot.current < 0) return "first";

      const rows = collectRows(mode);
      const scroller = findScroller(rows);
      if (!rows.length || !scroller) return "none";

      const target = Math.max(
        0,
        Math.min(snapshot.total - 1, snapshot.current + direction),
      );
      const row = rows[target];
      if (!row) return "none";

      const top = targetTop(scroller, row);
      if (Math.abs(top - scroller.scrollTop) <= 1) {
        return direction < 0 ? "first" : "last";
      }

      pendingJump = { index: target, until: Date.now() + PENDING_MS };
      scrollToTop(scroller, top);
      notify();
      return "moved";
    }

    function readLanguage() {
      try {
        if (!localeService || typeof localeService.getSnapshot !== "function") return "";
        const snapshot = localeService.getSnapshot() || {};
        return String(snapshot.locale || snapshot.id || "");
      } catch (error) {
        return "";
      }
    }

    function useText() {
      const [language, setLanguage] = React.useState(readLanguage);
      React.useEffect(() => {
        if (!localeService || typeof localeService.subscribe !== "function") return undefined;
        return localeService.subscribe(() => setLanguage(readLanguage()));
      }, []);
      return /^en/i.test(language) ? EN : ZH;
    }

    function useSnapshot(mode) {
      const [snapshot, setSnapshot] = React.useState(() => ({
        total: 0,
        current: -1,
        canPrev: false,
        canNext: false,
      }));
      React.useEffect(() => {
        let frame = 0;
        const publish = () => {
          frame = 0;
          const next = computeSnapshot(mode);
          setSnapshot((previous) =>
            previous.total === next.total &&
            previous.current === next.current &&
            previous.canPrev === next.canPrev &&
            previous.canNext === next.canNext
              ? previous
              : next,
          );
        };
        const schedule = () => {
          if (!frame) frame = window.requestAnimationFrame(publish);
        };

        subscribers.add(schedule);
        // Capture phase: the conversation scrolls an inner element, not the document.
        document.addEventListener("scroll", schedule, true);
        window.addEventListener("resize", schedule);
        // Safety net for layout shifts that emit neither scroll nor resize.
        const heartbeat = window.setInterval(() => {
          if (!document.hidden) schedule();
        }, 1000);
        schedule();

        return () => {
          subscribers.delete(schedule);
          document.removeEventListener("scroll", schedule, true);
          window.removeEventListener("resize", schedule);
          window.clearInterval(heartbeat);
          if (frame) window.cancelAnimationFrame(frame);
        };
      }, [mode]);
      return snapshot;
    }

    /**
     * Code-fold button glyph, drawn as the block's own shape so the state reads
     * at a glance: a full-height frame while the code is open (13.6 tall), a
     * low frame once it is folded (5.2 tall) with a crease on its left edge.
     * The tooltip carries the action ("折叠代码"/"展开代码").
     */
    function codeFoldIcon(folded) {
      const kids = folded
        ? [
            h("rect", { key: "body", x: 2.6, y: 5.4, width: 10.8, height: 5.2, rx: 2 }),
            // Dog-ear: the chord of the rounded corner reads as a folded edge.
            h("path", { key: "fold", d: "M4.6 5.4 2.6 7.4" }),
          ]
        : [h("rect", { key: "body", x: 2.6, y: 1.2, width: 10.8, height: 13.6, rx: 2 })];
      return h(
        "svg",
        {
          viewBox: "0 0 16 16",
          width: 15,
          height: 15,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.4,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          focusable: "false",
        },
        ...kids,
      );
    }

    function chevron(direction) {
      return h(
        "svg",
        {
          viewBox: "0 0 16 16",
          width: 12,
          height: 12,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.8,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          focusable: "false",
        },
        h("path", { d: direction === "up" ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4" }),
      );
    }

    /**
     * Invisible marker rendered inside one finalized assistant message's action
     * row. Its only job is to be a DOM handle on that answer.
     */
    function AnswerAnchor(props) {
      const ref = React.useRef(null);
      const messageId = props && props.messageId;

      React.useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const entry = { messageId, el };
        anchors.add(entry);
        notify();
        return () => {
          anchors.delete(entry);
          notify();
        };
      }, [messageId]);

      return h("span", {
        ref,
        className: "daj-anchor",
        style: { display: "none" },
        "aria-hidden": "true",
      });
    }

    function AnswerNavDock() {
      const text = useText();
      const [mode, setMode] = React.useState(lastMode);
      const snapshot = useSnapshot(mode);
      const [folded, setFolded] = React.useState(codeCollapsed);
      const [hint, setHint] = React.useState("");
      const hintTimer = React.useRef(0);

      React.useEffect(
        () => () => {
          if (hintTimer.current) window.clearTimeout(hintTimer.current);
        },
        [],
      );

      // Global fold switch: one owned attribute on <html>, reverted on disposal.
      React.useEffect(() => {
        const root = document.documentElement;
        for (const block of document.querySelectorAll(`[${CODE_BLOCK_ATTR}]`)) {
          block.removeAttribute(CODE_BLOCK_ATTR);
        }
        if (folded) root.setAttribute(CODE_GLOBAL_ATTR, "true");
        else root.removeAttribute(CODE_GLOBAL_ATTR);
        return () => {
          root.removeAttribute(CODE_GLOBAL_ATTR);
        };
      }, [folded]);

      // Per-block toggle while folded. A drag (text selection) must not toggle,
      // and clicks on the block's own copy/menu controls stay theirs.
      React.useEffect(() => {
        if (!folded) return undefined;
        let downX = 0;
        let downY = 0;
        const onDown = (event) => {
          downX = event.clientX;
          downY = event.clientY;
        };
        const onClick = (event) => {
          if (Math.abs(event.clientX - downX) + Math.abs(event.clientY - downY) > 4) return;
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (target.closest("button, a, input, textarea, select, [contenteditable='true']")) return;
          const block = target.closest("pre");
          if (!block || !block.closest("[data-conversation-scroll]")) return;
          if (block.hasAttribute(CODE_BLOCK_ATTR)) block.removeAttribute(CODE_BLOCK_ATTR);
          else block.setAttribute(CODE_BLOCK_ATTR, "true");
        };
        document.addEventListener("mousedown", onDown, true);
        document.addEventListener("click", onClick, true);
        return () => {
          document.removeEventListener("mousedown", onDown, true);
          document.removeEventListener("click", onClick, true);
        };
      }, [folded]);

      const flash = (message) => {
        setHint(message);
        if (hintTimer.current) window.clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(() => setHint(""), 1600);
      };

      const toggleCode = () => {
        const next = !folded;
        codeCollapsed = next;
        setFolded(next);
        flash(next ? text.codeFolded : text.codeUnfolded);
      };

      const chooseMode = (next) => {
        lastMode = next;
        // A jump scheduled on the other axis must not colour the new axis' counter.
        pendingJump = null;
        setMode(next);
        setHint("");
      };

      const jump = (direction) => {
        const result = step(direction, mode);
        if (result === "moved") {
          setHint("");
          return;
        }
        const asking = mode === "question";
        const message =
          result === "first"
            ? (asking ? text.firstQuestion : text.first)
            : result === "last"
              ? (asking ? text.lastQuestion : text.last)
              : (asking ? text.emptyQuestion : text.emptyAnswer);
        flash(message);
      };

      const empty = snapshot.total === 0;
      const asking = mode === "question";
      // Dim only when a click would travel nowhere; at a boundary the button
      // still parks the edge row at the top, so it stays lit.
      const dimPrev = empty || !snapshot.canPrev;
      const dimNext = empty || !snapshot.canNext;
      const counter = empty
        ? asking
          ? text.emptyQuestion
          : text.emptyAnswer
        : `${snapshot.current < 0 ? "–" : snapshot.current + 1}/${snapshot.total}`;
      const prevLabel = asking ? text.prevQuestion : text.prev;
      const nextLabel = asking ? text.nextQuestion : text.next;

      return h(
        React.Fragment,
        null,
        h("style", { key: "daj-style" }, CSS),
        h(
          "div",
          {
            key: "daj-root",
            className: "daj-root",
            role: "group",
            "aria-label": text.group,
          },
          h(
            "div",
            { className: "daj-modes" },
            h(
              "button",
              {
                type: "button",
                className: "daj-mode",
                "aria-pressed": asking ? "true" : "false",
                onClick: () => chooseMode("question"),
              },
              text.modeQuestion,
            ),
            h(
              "button",
              {
                type: "button",
                className: "daj-mode",
                "aria-pressed": asking ? "false" : "true",
                onClick: () => chooseMode("answer"),
              },
              text.modeAnswer,
            ),
          ),
          h(
            "button",
            {
              type: "button",
              className: dimPrev ? "daj-btn is-icon is-dim" : "daj-btn is-icon",
              "aria-disabled": dimPrev ? "true" : "false",
              "aria-label": prevLabel,
              title: prevLabel,
              onClick: () => jump(-1),
            },
            chevron("up"),
          ),
          h("span", { className: "daj-count" }, counter),
          h(
            "button",
            {
              type: "button",
              className: dimNext ? "daj-btn is-icon is-dim" : "daj-btn is-icon",
              "aria-disabled": dimNext ? "true" : "false",
              "aria-label": nextLabel,
              title: nextLabel,
              onClick: () => jump(1),
            },
            chevron("down"),
          ),
          h("span", { className: "daj-sep", "aria-hidden": "true" }),
          h(
            "button",
            {
              type: "button",
              className: "daj-btn is-icon",
              "aria-pressed": folded ? "true" : "false",
              "aria-label": folded ? text.codeExpand : text.codeCollapse,
              title: folded ? text.codeExpand : text.codeCollapse,
              onClick: toggleCode,
            },
            codeFoldIcon(folded),
          ),
          hint ? h("span", { className: "daj-hint", role: "status" }, hint) : null,
        ),
      );
    }

    return {
      inject: ["slots"],
      apply(ctx) {
        localeService = typeof ctx.get === "function" ? ctx.get("locale") : undefined;

        ctx.slots.inject(ACTIONS_SLOT, () =>
          ctx.slots.register(
            { name: ACTIONS_SLOT, id: "answer-jump-anchor", order: 90 },
            AnswerAnchor,
          ),
        );

        ctx.slots.inject(DOCK_SLOT, () =>
          ctx.slots.register(
            { name: DOCK_SLOT, id: "answer-jump", order: 20 },
            AnswerNavDock,
          ),
        );
      },
    };
  },
});
