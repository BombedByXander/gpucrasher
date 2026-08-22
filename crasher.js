// ─── GPU CRASHER - FULLY WORKING ──────────────────────────
let worker = null;
let isRunning = false;

// DOM Elements (will be set in DOMContentLoaded)
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
let deviceBadge = null;

let gl = null;
let program = null;
let canvas = null;
let startTime = 0;
let animFrameId = null;
let frameCount = 0;
let lastFpsUpdate = 0;

// ─── TORTURE CONFIG ──────────────────────────────────────
const CONFIG = {
  shaderLoops: 110,
  raymarchSteps: 420,
  renderPasses: 6,     // CRANKED UP: 6 passes instead of 1
  resolutionScale: 5.0 // CRANKED UP: 5x instead of 4x
};

// ─── UI HELPERS ──────────────────────────────────────────
function formatTime(ms) {
  if (!isFinite(ms)) return '--:--.---';
  const total = Math.max(0, Math.floor(ms));
  const minutes = String(Math.floor(total / 60000)).padStart(2, '0');
  const seconds = String(Math.floor((total % 60000) / 1000)).padStart(2, '0');
  const millis = String(total % 1000).padStart(3, '0');
  return `${minutes}:${seconds}.${millis}`;
}

function setIdle() {
  isRunning = false;
  if (crashBtn) {
    crashBtn.disabled = false;
    crashBtn.className = 'crash-btn';
    const icon = document.querySelector('.crash-btn .icon');
    if (icon) icon.textContent = '⚡';
    const label = document.getElementById('btnLabel');
    if (label) label.textContent = 'Crash GPU';
    if (btnSub) btnSub.textContent = 'Click to initiate meltdown';
  }
  if (stopBtn) stopBtn.style.display = 'none';
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
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

  // Try WebGL2 first, fallback to WebGL1
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

  if (isWebGL2) {
    vsSource = `#version 300 es
      in vec2 a_position;
      void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

    fsSource = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      uniform vec2 u_resolution;
      uniform float u_time;

      float trigHell(vec3 p) {
        float v = 0.0;
        float amp = 1.0;
        for (int i = 0; i < ${CONFIG.shaderLoops}; i++) {
          v += amp * sin(p.x * 13.7 + u_time * 2.4);
          v += amp * cos(p.y * 16.9 + u_time * 2.8);
          v += amp * sin(p.z * 10.3 + u_time * 1.6) * cos(p.z * 5.3);
          v = v * 0.5 + 0.5;
          amp *= 0.39;
          p += vec3(sin(u_time * 0.9), cos(u_time * 1.3), sin(u_time * 0.7));
        }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        vec3 ro = vec3(sin(u_time * 0.8) * 5.0, cos(u_time * 1.0) * 4.0, -10.0);
        vec3 rd = normalize(vec3(uv * 2.2, 1.9 + sin(u_time * 0.5) * 0.5));

        float dist = 0.0;
        float accum = 0.0;

        for (int i = 0; i < ${CONFIG.raymarchSteps}; i++) {
          vec3 p = ro + rd * dist;
          float density = abs(trigHell(p * 3.8 + u_time * 1.6)) * 0.12;
          accum += density * exp(-dist * 0.018);
          accum += sin(dist * 22.0 + u_time * 7.0) * cos(dist * 15.0) * 0.035;
          dist += max(0.05, density * 0.42);
          if (dist > 80.0 || accum > 10.0) break;
        }

        vec3 col = 0.5 + 0.5 * vec3(
          sin(accum * 5.1 + u_time * 2.4),
          cos(accum * 6.8 + u_time * 2.1),
          sin(accum * 4.7 + u_time * 1.2)
        );

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

      float trigHell(vec3 p) {
        float v = 0.0;
        float amp = 1.0;
        for (int i = 0; i < ${CONFIG.shaderLoops}; i++) {
          v += amp * sin(p.x * 13.7 + u_time * 2.4);
          v += amp * cos(p.y * 16.9 + u_time * 2.8);
          v += amp * sin(p.z * 10.3 + u_time * 1.6) * cos(p.z * 5.3);
          v = v * 0.5 + 0.5;
          amp *= 0.39;
          p += vec3(sin(u_time * 0.9), cos(u_time * 1.3), sin(u_time * 0.7));
        }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        vec3 ro = vec3(sin(u_time * 0.8) * 5.0, cos(u_time * 1.0) * 4.0, -10.0);
        vec3 rd = normalize(vec3(uv * 2.2, 1.9 + sin(u_time * 0.5) * 0.5));

        float dist = 0.0;
        float accum = 0.0;

        for (int i = 0; i < ${CONFIG.raymarchSteps}; i++) {
          vec3 p = ro + rd * dist;
          float density = abs(trigHell(p * 3.8 + u_time * 1.6)) * 0.12;
          accum += density * exp(-dist * 0.018);
          accum += sin(dist * 22.0 + u_time * 7.0) * cos(dist * 15.0) * 0.035;
          dist += max(0.05, density * 0.42);
          if (dist > 80.0 || accum > 10.0) break;
        }

        vec3 col = 0.5 + 0.5 * vec3(
          sin(accum * 5.1 + u_time * 2.4),
          cos(accum * 6.8 + u_time * 2.1),
          sin(accum * 4.7 + u_time * 1.2)
        );

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

function render(now) {
  if (!isRunning || !gl || !program) return;

  const elapsed = (now - startTime) / 1000;
  const heat = Math.min(100, (elapsed / 8) * 40 + 20 + Math.random() * 10);

  // ─── MULTIPLE PASSES ──────────────────────────────────
  for (let pass = 0; pass < CONFIG.renderPasses; pass++) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    
    if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height);
    if (timeLoc) gl.uniform1f(timeLoc, elapsed + pass * 0.05);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  frameCount++;

  if (now - lastFpsUpdate > 200) {
    const fps = Math.round(frameCount / ((now - lastFpsUpdate) / 1000));
    const load = Math.min(100, Math.round((1 - fps / 60) * 100 + 20));
    
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
      if (fps < 5) {
        statusEl.textContent = `💀 MELTING - ${fps} FPS`;
        statusEl.style.color = '#ef4444';
        if (statusBadge) statusBadge.className = 'status-badge active';
      } else if (fps < 10) {
        statusEl.textContent = `☠️ DYING - ${fps} FPS`;
        statusEl.style.color = '#ef4444';
        if (statusBadge) statusBadge.className = 'status-badge active';
      } else if (fps < 20) {
        statusEl.textContent = `🔥 KILLING - ${fps} FPS`;
        statusEl.style.color = '#f59e0b';
        if (statusBadge) statusBadge.className = 'status-badge crashed';
      } else {
        statusEl.textContent = `⚡ DESTROYING - ${fps} FPS`;
        statusEl.style.color = '#8b9bb5';
        if (statusBadge) statusBadge.className = 'status-badge active';
      }
    }

    if (btnSub) {
      btnSub.textContent = fps < 10 ? '⚠️ System under extreme load' : '🔥 Pushing limits';
    }

    frameCount = 0;
    lastFpsUpdate = now;
  }

  animFrameId = requestAnimationFrame(render);
}

function startNuke() {
  if (isRunning) {
    setIdle();
    if (statusEl) statusEl.textContent = 'Stopped - You survived';
    if (timeEl) timeEl.textContent = '00:00.000';
    if (stopBtn) stopBtn.style.display = 'none';
    return;
  }

  isRunning = true;
  if (crashBtn) {
    crashBtn.className = 'crash-btn running';
    const icon = document.querySelector('.crash-btn .icon');
    if (icon) icon.textContent = '☠️';
    const label = document.getElementById('btnLabel');
    if (label) label.textContent = 'KILLING...';
    if (btnSub) btnSub.textContent = '💀 Hold tight';
  }
  if (stopBtn) stopBtn.style.display = 'flex';

  if (statusEl) {
    statusEl.textContent = '☠️ GPU MURDER INITIATED';
    statusEl.style.color = '#f59e0b';
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

  if (!createWebGLContext()) {
    setIdle();
    return;
  }

  startTime = performance.now();
  frameCount = 0;
  lastFpsUpdate = startTime;
  requestAnimationFrame(render);
}

// ─── EVENT LISTENERS ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Get all DOM elements
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
  deviceBadge = document.getElementById('deviceBadge');

  // ─── DEVICE BADGE ──────────────────────────────────────
  if (deviceBadge) {
    const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
    deviceBadge.textContent = isIPhone ? '📱 IPHONE MODE' : '💻 DESKTOP MODE';
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
        if (icon) icon.textContent = '⚡';
        const label = document.getElementById('btnLabel');
        if (label) label.textContent = 'Crash GPU';
        if (btnSub) btnSub.textContent = 'Click to initiate meltdown';
      }
    };
  }

  // ─── KEYBOARD SHORTCUTS ──────────────────────────────
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
          if (icon) icon.textContent = '⚡';
          const label = document.getElementById('btnLabel');
          if (label) label.textContent = 'Crash GPU';
          if (btnSub) btnSub.textContent = 'Click to initiate meltdown';
        }
      }
    }
  });

  // ─── RESIZE ──────────────────────────────────────────────
  window.addEventListener('resize', function() {
    if (canvas && gl) {
      const scale = CONFIG.resolutionScale;
      canvas.width = window.innerWidth * scale;
      canvas.height = window.innerHeight * scale;
      gl.viewport(0, 0, canvas.width, canvas.height);
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