let worker = null;
let isRunning = false;

let crashBtn = null;
let stopBtn = null;
let statusEl = null;
let timeEl = null;

let gl = null;
let program = null;
let canvas = null;
let startTime = 0;
let animFrameId = null;
let frameCount = 0;
let lastFrameTime = 0;

// ─── HARDWARE DETECTION ──────────────────────────────────
function isLowEndDevice() {
  const isSE = /iPhone13,2|iPhone14,6/.test(navigator.userAgent);
  const isOlder = /iPhone8|iPhone9|iPhone10|iPhone11|iPhone12/.test(navigator.userAgent);
  const isLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
  return isSE || isOlder || isLowMemory;
}

const isLowEnd = isLowEndDevice();

// ─── CONFIG ──────────────────────────────────────────────
const CONFIG = {
  // SE gets LESS complexity but MORE passes to compensate
  shaderLoops: isLowEnd ? 50 : 110,        // SE: 50 loops (was 110)
  raymarchSteps: isLowEnd ? 200 : 420,     // SE: 200 steps (was 420)
  renderPasses: isLowEnd ? 15 : 1,         // SE: 15 passes (MORE torture!)
  resolutionScale: isLowEnd ? 3.0 : 4.0,   // SE: 3x resolution (less pixels)
  memoryChunks: isLowEnd ? 200 : 0         // SE: 200MB memory bomb
};

let memoryBomb = [];

// ──────────────────────────────────────────────
function ensureStatusTimer() {
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'status';
    Object.assign(statusEl.style, {
      position: 'fixed', top: '18px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.7)', color: '#dbeafe', padding: '10px 16px',
      borderRadius: '10px', fontSize: '14px', fontFamily: 'monospace',
      zIndex: '9999', pointerEvents: 'none', backdropFilter: 'blur(6px)'
    });
    document.body.appendChild(statusEl);
  }
  if (!timeEl) {
    timeEl = document.createElement('div');
    timeEl.id = 'time';
    Object.assign(timeEl.style, {
      position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.65)', color: '#d1fae5', padding: '8px 14px',
      borderRadius: '10px', fontSize: '14px', fontFamily: 'monospace',
      zIndex: '9999', pointerEvents: 'none', backdropFilter: 'blur(6px)'
    });
    document.body.appendChild(timeEl);
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
    crashBtn.textContent = "CRASH GPU NOW";
  }
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  memoryBomb = [];
  ensureStatusTimer();
  if (statusEl) statusEl.textContent = "Idle – ready to burn";
  if (timeEl) timeEl.textContent = formatTime(0);
}

function createWebGLContext() {
  if (canvas) return true;

  canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.zIndex = '-999';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  const scale = CONFIG.resolutionScale;
  canvas.width = window.innerWidth * scale;
  canvas.height = window.innerHeight * scale;

  gl = canvas.getContext('webgl2', {
    antialias: false,
    powerPreference: 'high-performance',
    desynchronized: true,
    preserveDrawingBuffer: false
  }) || canvas.getContext('webgl');

  if (!gl) {
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = "No WebGL — your GPU is pussy";
    return false;
  }

  const vsSource = `#version 300 es
    in vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

  // ─── SHADER WITH DYNAMIC LOOPS ──────────────────────────
  const fsSource = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform vec2 u_resolution;
    uniform float u_time;

    float trigHell(vec3 p) {
      float v = 0.0;
      float amp = 1.0;
      // SE uses 50 loops, iPhone 16 uses 110
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

      // SE uses 200 steps, iPhone 16 uses 420
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

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSource);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSource);
  gl.compileShader(fs);

  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS) || !gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(vs) || gl.getShaderInfoLog(fs));
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = "Shader died – GPU said fuck off";
    return false;
  }

  program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = "Link failed – program invalid";
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

  // ─── MEMORY BOMB (SE only) ──────────────────────────────
  if (isLowEnd && CONFIG.memoryChunks > 0) {
    try {
      for (let i = 0; i < CONFIG.memoryChunks; i++) {
        const size = 1024 * 1024;
        const chunk = new Uint8Array(size);
        for (let j = 0; j < size; j += 4096) {
          chunk[j] = Math.random() * 255;
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
  const heat = Math.min(100, (elapsed / 8) * 40 + 20 + Math.random() * 10);

  // ─── MULTIPLE PASSES (SE gets 15 passes!) ──────────────
  for (let pass = 0; pass < CONFIG.renderPasses; pass++) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(program, 'u_time'), elapsed + pass * 0.05);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  frameCount++;
  if (frameCount % 10 === 0) {
    const fps = Math.round(1000 / (now - lastFrameTime));
    ensureStatusTimer();
    if (statusEl) {
      if (isLowEnd) {
        statusEl.textContent = `🔥 SE MELTING - ${fps} FPS (15 passes)`;
      } else {
        statusEl.textContent = `Nuking... ~${fps} FPS (pray)`;
      }
    }
    lastFrameTime = now;
  }

  ensureStatusTimer();
  if (timeEl) timeEl.textContent = formatTime(now - startTime);

  animFrameId = requestAnimationFrame(render);
}

function startNuke() {
  if (isRunning) {
    setIdle();
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = "Stopped – you survived... this time";
    if (timeEl) timeEl.textContent = '--:--.---';
    if (stopBtn) stopBtn.style.display = 'none';
    return;
  }

  isRunning = true;
  if (crashBtn) {
    crashBtn.disabled = false;
    crashBtn.textContent = "Stop Crashing";
  }
  if (stopBtn) stopBtn.style.display = 'inline-block';

  ensureStatusTimer();
  if (statusEl) {
    if (isLowEnd) {
      statusEl.textContent = "🔥 SE TORTURE MODE (15 passes)";
    } else {
      statusEl.textContent = "Nuking GPU – hold on tight";
    }
  }
  if (timeEl) timeEl.textContent = formatTime(0);

  if (!createWebGLContext()) {
    setIdle();
    return;
  }

  startTime = performance.now();
  frameCount = 0;
  lastFrameTime = startTime;
  requestAnimationFrame(render);
}

// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  crashBtn = document.getElementById('crashBtn');
  stopBtn  = document.getElementById('stopBtn');
  statusEl = document.getElementById('status');
  timeEl   = document.getElementById('time');

  if (!crashBtn) {
    console.error("No #crashBtn element found");
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = "Missing crash button – add it to HTML";
    return;
  }

  crashBtn.onclick = startNuke;

  if (stopBtn) {
    stopBtn.onclick = () => {
      setIdle();
      ensureStatusTimer();
      if (statusEl) statusEl.textContent = "Stopped – you survived... this time";
      if (timeEl) timeEl.textContent = '--:--.---';
      if (stopBtn) stopBtn.style.display = 'none';
      if (crashBtn) crashBtn.textContent = "CRASH GPU NOW";
    };
  }

  try {
    if (worker) worker.terminate();
    worker = new Worker(URL.createObjectURL(new Blob([`
      onmessage = function(e) {
        if (e.data[0] === "ping") postMessage(["pong"]);
      };
    `], {type: 'text/javascript'})));
  } catch (e) {}

  window.addEventListener('resize', () => {
    if (canvas) {
      const scale = CONFIG.resolutionScale;
      canvas.width = window.innerWidth * scale;
      canvas.height = window.innerHeight * scale;
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    }
  });

  setIdle();
});