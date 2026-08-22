// ─── DUMMY WORKER - KEPT FOR COMPATIBILITY ──────────────
// This file exists for legacy reasons. The main logic is in crasher.js.
// You can delete this file if you want, but keeping it won't hurt.

onmessage = function(e) {
  if (e.data[0] === "ping") {
    postMessage(["pong"]);
  }
};