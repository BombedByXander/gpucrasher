let worker = null;
let isRunning = false;

function initWorker() {
  if (worker) worker.terminate();

  worker = new Worker('worker.js');  // points to the separate worker file

  worker.onmessage = function(e) {
    const [type, value] = e.data;
    if (type === "BenchResult") {
      document.getElementById('time').textContent = 
        value >= 999999 ? "TIMEOUT/HUNG - GPU probably died" : `${Math.round(value)} ms`;
      document.getElementById('status').textContent = 
        value >= 999999 ? "GPU resisted... or crashed silently. Try again" : "GPU survived (for now)";
      isRunning = false;
      document.getElementById('crashBtn').disabled = false;
    }
  };

  worker.onerror = function(err) {
    console.error(err);
    document.getElementById('status').textContent = "Worker died: " + (err.message || "GPU driver reset?");
    isRunning = false;
    document.getElementById('crashBtn').disabled = false;
  };
}

document.getElementById('crashBtn').onclick = function() {
  if (isRunning) return;
  isRunning = true;
  this.disabled = true;
  document.getElementById('status').textContent = "Nuking GPU... hold on (15s timeout if hung)";
  document.getElementById('time').textContent = "-- ms";

  if (!worker) initWorker();
  worker.postMessage(["Run"]);
};

// Preload worker
initWorker();
