/**
 * Host half of the answer-navigation bundle.
 *
 * The whole feature lives in the Client module (`client.js`): it registers a
 * per-answer anchor into `conversation.chat.assistant-actions` and the control
 * row into `conversation.input.dock`. No Host service, tool, or storage is
 * needed, so this half only exists so the bundle owns a patchable row.
 */
export function apply() {}
