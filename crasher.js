// ─── ORIGINAL CODE - CRANKED TO 11 (SE 3rd Gen GUARANTEED) ──
let worker = null;
let isRunning = false;

let crashBtn = null;
let stopBtn = null;
let statusEl = null;
let timeEl = null;
let fpsEl = null;
let loadEl = null;
let loadBar = null;
let loadBarContainer = null;
let btnSub = null;

let gl = null;
let program = null;
let canvas = null;
let startTime = 0;
let animFrameId = null;
let frameCount = 0;
let lastFrameTime = 0;
let lastFpsUpdate = 0;

// ─── DETECT IPHONE ──────────────────────────────────────
const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// ─── IPHONE SE 3RD GEN DETECTION ──────────────────────
const isIPhoneSE = /iPhone/.test(navigator.userAgent) && 
                   (navigator.userAgent.includes('iPhone13,2') || 
                    navigator.userAgent.includes('iPhone14,6'));

// ─── TORTURE CONFIG ──────────────────────────────────────
const CONFIG = {
  // SE 3rd Gen gets SIMPLEST shader but MAXIMUM passes
  shaderLoops: isIPhoneSE ? 50 : (isIPhone ? 200 : 110),
  raymarchSteps: isIPhoneSE ? 150 : (isIPhone ? 600 : 420),
  renderPasses: isIPhoneSE ? 30 : (isIPhone ? 12 : 1),  // 30 PASSES on SE!
  resolutionScale: isIPhoneSE ? 10.0 : (isIPhone ? 6.0 : 4.0), // 10x resolution!
  memoryChunks: isIPhoneSE ? 600 : (isIPhone ? 400 : 0)
};

// ─── MEMORY BOMB ──────────────────────────────────────────
let memoryBomb = [];

// ──────────────────────────────────────────────
function ensureStatusTimer() {
  if (!statusEl) {
    statusEl = document.getElementById('statusText');
  }
  if (!timeEl) {
    timeEl = document.getElementById('timeValue');
  }
  if (!fpsEl) {
    fpsEl = document.getElementById('fpsValue');
  }
  if (!loadEl) {
    loadEl = document.getElementById('loadValue');
  }
  if (!loadBar) {
    loadBar = document.getElementById('loadBar');
  }
  if (!loadBarContainer) {
    loadBarContainer = document.getElementById('loadBarContainer');
  }
  if (!btnSub) {
    btnSub = document.getElementById('btnSub');
  }
}

function formatTime(ms) {
  if (!isFinite(ms)) return '--:--.---';
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(millis).padStart(3,'0')}`;
}

function setIdle() {
  isRunning = false;
  if (crashBtn) {
    crashBtn.disabled = false;
    crashBtn.className = 'crash-btn';
    document.querySelector('.crash-btn .icon').textContent = '⚡';
    document.getElementById('btnLabel').textContent = 'Crash GPU';
    if (btnSub) btnSub.textContent = 'Click to initiate meltdown';
  }
  if (stopBtn) stopBtn.style.display = 'none';
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  memoryBomb = [];
  if (window.gc) {
    try { window.gc(); } catch(e) {}
  }

  ensureStatusTimer();
  if (statusEl) {
    statusEl.textContent = 'Ready';
    statusEl.style.color = '';
  }
  if (timeEl) timeEl.textContent = '00:00.000';
  if (fpsEl) {
    fpsEl.textContent = '--';
    fpsEl.className = 'value';
  }
  if (loadEl) {
    loadEl.innerHTML = '0<span class="unit">%</span>';
    loadEl.className = 'value';
  }
  if (loadBar) loadBar.style.width = '0%';
  if (loadBarContainer) loadBarContainer.classList.remove('active');
  
  const badge = document.getElementById('statusBadge');
  if (badge) {
    badge.className = 'status-badge';
    const dot = document.getElementById('statusDot');
    if (dot) dot.style.background = '#22c55e';
  }

  if (gl) {
    try {
      if (program) gl.deleteProgram(program);
      program = null;
    } catch(e) {}
  }
}

function createWebGLContext() {
  if (canvas) return true;

  canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.zIndex = '-1';
  canvas.style.pointerEvents = 'none';
  canvas.style.opacity = '0.6';
  document.body.prepend(canvas);

  const scale = CONFIG.resolutionScale;
  canvas.width = window.innerWidth * scale;
  canvas.height = window.innerHeight * scale;

  // Use WebGL1 for ALL iPhones
  let contextOptions = {
    antialias: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false
  };

  gl = canvas.getContext('webgl', contextOptions);

  if (!gl) {
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = 'No WebGL!';
    return false;
  }

  // ─── VERTEX SHADER ──────────────────────────────────
  const vsSource = `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

  // ─── FRAGMENT SHADER (SE 3rd Gen - ULTRA SIMPLE) ──
  // NO pow(), NO atan(), NO fract() - just sin/cos loops
  const fsSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;

    void main() {
      vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
      
      // ULTRA SIMPLE but BRUTAL loop - just sin/cos spam
      float v = 0.0;
      for (int i = 0; i < ${CONFIG.shaderLoops}; i++) {
        float fi = float(i);
        float x = uv.x * 50.0 + u_time * 5.0 + fi * 0.5;
        float y = uv.y * 50.0 + u_time * 4.0 + fi * 0.3;
        v += sin(x) * cos(y);
        v += cos(x * 1.3 + fi) * sin(y * 1.7 + fi);
        v = v * 0.5 + 0.5;
      }
      
      // Color from the chaos
      vec3 col = vec3(
        sin(v * 10.0 + u_time),
        cos(v * 8.0 + u_time * 0.7),
        sin(v * 12.0 + u_time * 1.3)
      ) * 0.5 + 0.5;
      
      // Scanline torture
      float scanline = sin(uv.y * 800.0 + u_time * 100.0) * 0.05;
      col += scanline;
      
      gl_FragColor = vec4(col, 1.0);
    }`;

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSource);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSource);
  gl.compileShader(fs);

  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS) || !gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(vs) || gl.getShaderInfoLog(fs));
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = 'Shader failed!';
    return false;
  }

  program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = 'Link failed!';
    return false;
  }

  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1,  1,-1,  -1,1,
     1,-1,  1,1,   -1,1
  ]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // ─── MEMORY BOMB ──────────────────────────────────────
  if (isIPhone && CONFIG.memoryChunks > 0) {
    try {
      for (let i = 0; i < CONFIG.memoryChunks; i++) {
        const size = 1024 * 1024;
        const chunk = new Uint8Array(size);
        for (let j = 0; j < size; j += 4096) {
          chunk[j] = Math.random() * 255;
          chunk[j+1] = Math.random() * 255;
          chunk[j+2] = Math.random() * 255;
        }
        memoryBomb.push(chunk);
      }
    } catch(e) {}
  }

  return true;
}

function render(now) {
  if (!isRunning || !gl || !program) return;

  const elapsed = (now - startTime) / 1000;
  const heat = Math.min(100, (elapsed / 5) * 50 + 20 + Math.random() * 10);

  // ─── MULTIPLE PASSES ──────────────────────────────
  for (let pass = 0; pass < CONFIG.renderPasses; pass++) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(program, 'u_time'), elapsed + pass * 0.05);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  frameCount++;

  if (now - lastFpsUpdate > 200) {
    const fps = Math.round(frameCount / ((now - lastFpsUpdate) / 1000));
    const load = Math.min(100, Math.round((1 - fps / 60) * 100 + 20));
    
    ensureStatusTimer();
    if (fpsEl) {
      fpsEl.textContent = fps;
      fpsEl.className = 'value' + (fps < 10 ? ' danger' : fps < 25 ? ' warning' : '');
    }
    if (timeEl) timeEl.textContent = formatTime(now - startTime);
    if (loadEl) {
      loadEl.innerHTML = load + '<span class="unit">%</span>';
      loadEl.className = 'value' + (load > 80 ? ' danger' : load > 50 ? ' warning' : '');
    }
    if (loadBar) loadBar.style.width = load + '%';
    if (loadBarContainer) loadBarContainer.classList.add('active');

    // Update status
    if (statusEl) {
      if (fps < 5) {
        statusEl.textContent = `💀 SE MELTING - ${fps} FPS`;
        statusEl.style.color = '#ef4444';
        const badge = document.getElementById('statusBadge');
        if (badge) { badge.className = 'status-badge active'; }
      } else if (fps < 10) {
        statusEl.textContent = `☠️ SE DYING - ${fps} FPS`;
        statusEl.style.color = '#ef4444';
        const badge = document.getElementById('statusBadge');
        if (badge) { badge.className = 'status-badge active'; }
      } else if (fps < 20) {
        statusEl.textContent = `🔥 SE KILLING - ${fps} FPS`;
        statusEl.style.color = '#f59e0b';
        const badge = document.getElementById('statusBadge');
        if (badge) { badge.className = 'status-badge crashed'; }
      } else {
        statusEl.textContent = `⚡ SE DESTROYING - ${fps} FPS`;
        statusEl.style.color = '#8b9bb5';
        const badge = document.getElementById('statusBadge');
        if (badge) { badge.className = 'status-badge active'; }
      }
    }

    if (btnSub) {
      btnSub.textContent = fps < 10 ? '⚠️ SE under extreme load' : '🔥 30 passes torture';
    }

    frameCount = 0;
    lastFpsUpdate = now;
  }

  animFrameId = requestAnimationFrame(render);
}

function startNuke() {
  if (isRunning) {
    setIdle();
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = 'Stopped - You survived';
    if (timeEl) timeEl.textContent = '00:00.000';
    if (stopBtn) stopBtn.style.display = 'none';
    return;
  }

  isRunning = true;
  if (crashBtn) {
    crashBtn.className = 'crash-btn running';
    document.querySelector('.crash-btn .icon').textContent = isIPhoneSE ? '🔥' : (isIPhone ? '🔥' : '☠️');
    document.getElementById('btnLabel').textContent = isIPhoneSE ? '🔥 MELTING SE...' : (isIPhone ? '🔥 MELTING IPHONE...' : '💀 KILLING...');
    if (btnSub) btnSub.textContent = isIPhoneSE ? '🔥 30 passes · 10x resolution' : '🔥 System at critical';
  }
  if (stopBtn) stopBtn.style.display = 'flex';

  ensureStatusTimer();
  if (statusEl) {
    statusEl.textContent = isIPhoneSE ? '🔥 SE TORTURE MODE (30 passes)' : (isIPhone ? '🔥 IPHONE TORTURE MODE' : '☠️ GPU MURDER INITIATED');
    statusEl.style.color = '#f59e0b';
    const badge = document.getElementById('statusBadge');
    if (badge) { badge.className = 'status-badge crashed'; }
  }
  if (timeEl) timeEl.textContent = '00:00.000';
  if (fpsEl) {
    fpsEl.textContent = '0';
    fpsEl.className = 'value';
  }
  if (loadEl) {
    loadEl.innerHTML = '0<span class="unit">%</span>';
    loadEl.className = 'value';
  }
  if (loadBar) loadBar.style.width = '0%';
  if (loadBarContainer) loadBarContainer.classList.add('active');

  if (!createWebGLContext()) {
    setIdle();
    return;
  }

  startTime = performance.now();
  frameCount = 0;
  lastFpsUpdate = startTime;
  requestAnimationFrame(render);
}

// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  crashBtn = document.getElementById('crashBtn');
  stopBtn = document.getElementById('stopBtn');
  statusEl = document.getElementById('statusText');
  timeEl = document.getElementById('timeValue');
  fpsEl = document.getElementById('fpsValue');
  loadEl = document.getElementById('loadValue');
  loadBar = document.getElementById('loadBar');
  loadBarContainer = document.getElementById('loadBarContainer');
  btnSub = document.getElementById('btnSub');

  // ─── DEVICE BADGE ──────────────────────────────────────
  const deviceBadge = document.getElementById('deviceBadge');
  if (deviceBadge) {
    if (isIPhoneSE) {
      deviceBadge.textContent = '📱 SE 3RD GEN - 30 PASSES';
      deviceBadge.classList.add('iphone');
    } else if (isIPhone) {
      deviceBadge.textContent = '📱 IPHONE MODE - EXTREME';
      deviceBadge.classList.add('iphone');
    } else {
      deviceBadge.textContent = '💻 DESKTOP MODE';
    }
  }

  if (!crashBtn) {
    console.error("No #crashBtn element found");
    return;
  }

  crashBtn.onclick = startNuke;

  if (stopBtn) {
    stopBtn.onclick = () => {
      setIdle();
      ensureStatusTimer();
      if (statusEl) statusEl.textContent = 'Stopped - You survived';
      if (timeEl) timeEl.textContent = '00:00.000';
      if (stopBtn) stopBtn.style.display = 'none';
      if (crashBtn) {
        crashBtn.className = 'crash-btn';
        document.querySelector('.crash-btn .icon').textContent = '⚡';
        document.getElementById('btnLabel').textContent = 'Crash GPU';
        if (btnSub) btnSub.textContent = 'Click to initiate meltdown';
      }
    };
  }

  // ─── KEYBOARD SHORTCUTS ──────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      startNuke();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isRunning) {
        setIdle();
        ensureStatusTimer();
        if (statusEl) statusEl.textContent = 'Stopped - You survived';
        if (timeEl) timeEl.textContent = '00:00.000';
        if (stopBtn) stopBtn.style.display = 'none';
        if (crashBtn) {
          crashBtn.className = 'crash-btn';
          document.querySelector('.crash-btn .icon').textContent = '⚡';
          document.getElementById('btnLabel').textContent = 'Crash GPU';
          if (btnSub) btnSub.textContent = 'Click to initiate meltdown';
        }
      }
    }
  });

  // ─── RESIZE ──────────────────────────────────────────────
  window.addEventListener('resize', () => {
    if (canvas) {
      const scale = CONFIG.resolutionScale;
      canvas.width = window.innerWidth * scale;
      canvas.height = window.innerHeight * scale;
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    }
  });

  // ─── DUMMY WORKER ──────────────────────────────────────
  try {
    if (worker) worker.terminate();
    worker = new Worker(URL.createObjectURL(new Blob([`
      onmessage = function(e) {
        if (e.data[0] === "ping") postMessage(["pong"]);
      };
    `], {type: 'text/javascript'})));
  } catch (e) {}

  setIdle();
});