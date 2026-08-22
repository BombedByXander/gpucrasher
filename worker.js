importScripts('https://unpkg.com/gpu.js@latest/dist/gpu-browser.min.js');

const gpu = new GPU({ mode: "gpu" });

const kernel = gpu.createKernel(function() {
  let t = 0;
  for (let i = 0; i < this.constants.size; i++) {
    t += this.thread.x % 5466587 * (this.thread.x % 6847648) - this.thread.x % 51374684;
    t = t / (this.thread.x % 9769864) * 6541;
    t = Math.exp(t);
    t = Math.sqrt(t);  // keep it lean but evil
  }
  return t;
})
.setOptimizeFloatMemory(true)
.setImmutable(true)
.setConstants({ size: 3000 })           // tune this up/down
.setLoopMaxIterations(3000)
.setOutput([1, 1]);                     // tiny output = no VRAM bomb

kernel(); // warm-up

let timeoutId;

onmessage = function(e) {
  if (e.data[0] === "Run") {
    timeoutId = setTimeout(() => {
      postMessage(["BenchResult", 999999]);
      close();
    }, 15000);

    const start = performance.now();
    kernel();
    const end = performance.now();
    clearTimeout(timeoutId);

    postMessage(["BenchResult", end - start]);
  }
};