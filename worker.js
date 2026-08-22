// ─── GPU.JS WORKER - CRANKED UP ──────────────────────────
importScripts('https://unpkg.com/gpu.js@latest/dist/gpu-browser.min.js');

// ─── IPHONE DETECTION IN WORKER ──────────────────────────
const isIPhone = navigator.userAgent.includes('iPhone') || 
                 navigator.userAgent.includes('iPad') ||
                 navigator.userAgent.includes('iPod');

// ─── CONFIG ──────────────────────────────────────────────
const CONFIG = {
  // iPhone gets EXTREME torture through different means
  size: isIPhone ? 5000 : 3000,        // MORE operations on iPhone
  outputSize: isIPhone ? 4 : 1,        // BIGGER output on iPhone (more VRAM)
  memoryMultiplier: isIPhone ? 2 : 1,  // DOUBLE memory on iPhone
  torturePasses: isIPhone ? 10 : 5     // 10 passes on iPhone!
};

// ─── MEMORY BOMB ──────────────────────────────────────────
// Fill up memory on iPhone
let memoryBomb = [];
if (isIPhone) {
  try {
    for (let i = 0; i < 50; i++) {
      const chunk = new Float32Array(1000000);
      for (let j = 0; j < chunk.length; j++) {
        chunk[j] = Math.random() * 999999;
      }
      memoryBomb.push(chunk);
    }
  } catch(e) {}
}

// ─── MAIN KERNEL (ULTRA TORTURE) ─────────────────────────
const kernel = gpu.createKernel(function() {
  let t = 0;
  const size = this.constants.size;
  const threadX = this.thread.x;
  
  // ULTRA HEAVY math torture - 5000 iterations
  for (let i = 0; i < size; i++) {
    // Multiple math operations per iteration
    let val = threadX % 5466587 * (threadX % 6847648) - threadX % 51374684;
    val = val / (threadX % 9769864 + 1) * 6541;
    val = Math.exp(Math.abs(val) / 1000);
    val = Math.sqrt(Math.abs(val) + 1);
    val = Math.sin(val) * Math.cos(val) * Math.tan(val);
    val = Math.pow(Math.abs(val), 1.3);
    val = val * 1.6180339887 + 0.5;
    t += val;
    
    // Extra torture on iPhone
    if (this.constants.isIPhone) {
      t += Math.log(Math.abs(val) + 1);
      t += Math.atan(val) * 1.7;
      t = t * 0.999 + 0.001;
    }
  }
  
  // Multiple outputs for iPhone (more VRAM usage)
  if (this.constants.outputSize > 1) {
    return [t, t * 1.1, t * 0.9, t * 1.05];
  }
  
  return t;
})
.setOptimizeFloatMemory(true)
.setImmutable(true)
.setConstants({ 
  size: CONFIG.size,
  isIPhone: isIPhone,
  outputSize: CONFIG.outputSize
})
.setLoopMaxIterations(CONFIG.size + 100)
.setOutput([CONFIG.outputSize, 1]);  // Bigger output on iPhone

// ─── WARM UP ──────────────────────────────────────────────
kernel();

let timeoutId;
let runCount = 0;

onmessage = function(e) {
  if (e.data[0] === "Run") {
    runCount++;
    
    // ─── MULTIPLE PASSES ON IPHONE ──────────────────────
    const passes = CONFIG.torturePasses;
    let totalTime = 0;
    
    timeoutId = setTimeout(() => {
      postMessage(["BenchResult", 999999, runCount]);
      close();
    }, 30000); // Longer timeout for iPhone
    
    const start = performance.now();
    
    // Run multiple passes
    for (let p = 0; p < passes; p++) {
      const result = kernel();
      // Force garbage collection on iPhone
      if (isIPhone && p % 2 === 0) {
        try {
          if (typeof gc !== 'undefined') gc();
        } catch(e) {}
      }
    }
    
    const end = performance.now();
    clearTimeout(timeoutId);
    
    const duration = end - start;
    const opsPerPass = CONFIG.size * passes;
    
    // ─── METRICS ──────────────────────────────────────────
    const metrics = {
      duration: duration,
      passes: passes,
      opsPerPass: opsPerPass,
      totalOps: opsPerPass * passes,
      isIPhone: isIPhone,
      memorySize: memoryBomb.length,
      runCount: runCount
    };
    
    postMessage(["BenchResult", duration, metrics]);
  }
  
  // ─── MEMORY CLEAR COMMAND ──────────────────────────────
  if (e.data[0] === "ClearMemory") {
    memoryBomb = [];
    if (typeof gc !== 'undefined') gc();
    postMessage(["MemoryCleared"]);
  }
};