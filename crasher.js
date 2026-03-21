let worker = null;
let isRunning = false;

const crashBtn = document.getElementById('crashBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const timeEl = document.getElementById('time');

function setIdle() {
  isRunning = false;
  if (crashBtn) crashBtn.disabled = false;
}

function initWorker() {
  try {
    if (worker) {
      try { worker.terminate(); } catch (e) {}
      worker = null;
    }

    worker = new Worker('worker.js');

    worker.onmessage = function(e) {
      const [type, value] = e.data;
      if (type === "BenchResult") {
        timeEl.textContent = value >= 999999 ? "TIMEOUT/HUNG - GPU probably died" : `${Math.round(value)} ms`;
        statusEl.textContent = value >= 999999 ? "GPU resisted... or crashed silently. Try again" : "GPU survived (for now)";
        setIdle();
      }
    };

    worker.onerror = function(err) {
      console.error(err);
      statusEl.textContent = "Worker died: " + (err.message || "GPU driver reset?");
      setIdle();
    };
  } catch (err) {
    console.error('Failed to create worker', err);
    statusEl.textContent = 'Unable to start worker: ' + (err.message || 'unknown');
    setIdle();
  }
}

crashBtn.onclick = function() {
  if (isRunning) return;
  isRunning = true;
  crashBtn.disabled = true;
  statusEl.textContent = "Nuking GPU... hold on (15s timeout if hung)";
  timeEl.textContent = "-- ms";

  if (!worker) initWorker();
  try {
    worker.postMessage(["Run"]);
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Failed to post message to worker';
    setIdle();
  }
};

if (stopBtn) {
  stopBtn.onclick = function() {
    if (worker) {
      try { worker.terminate(); } catch (e) { console.error(e); }
      worker = null;
    }
    statusEl.textContent = 'Stopped by user';
    timeEl.textContent = '-- ms';
    setIdle();
    // recreate a fresh worker so user can run again
    initWorker();
  };
}

// Preload worker
initWorker();
