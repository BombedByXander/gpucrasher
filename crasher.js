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
  document.exitFullscreen?.().catch(() => {});
  document.exitPointerLock?.();
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

  const scale = 4.5; // cranked up a bit more
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

  const fsSource = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform vec2 u_resolution;
    uniform float u_time;

    float trigHell(vec3 p) {
      float v = 0.0;
      float amp = 1.0;
      for (int i = 0; i < 130; i++) { // increased to 130 layers
        v += amp * sin(p.x * 14.2 + u_time * 2.6);
        v += amp * cos(p.y * 18.1 + u_time * 3.0);
        v += amp * tan(atan(p.z * 11.5 + u_time * 1.8) * 1.5);
        v += amp * sin(cos(tan(v * 4.5)) * 5.8);
        v = fract(v * 1.6180339887);
        amp *= 0.37;
        p += vec3(sin(u_time * 1.0), cos(u_time * 1.5), tan(u_time * 0.9));
      }
      return v;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
      vec3 ro = vec3(sin(u_time * 0.9) * 5.5, cos(u_time * 1.1) * 4.5, -11.0);
      vec3 rd = normalize(vec3(uv * 2.4, 2.0 + sin(u_time * 0.6) * 0.6));

      float dist = 0.0;
      float accum = 0.0;

      for (int i = 0; i < 500; i++) { // 500 steps now
        vec3 p = ro + rd * dist;
        float density = abs(trigHell(p * 4.2 + u_time * 1.8)) * 0.14;
        accum += density * exp(-dist * 0.02);
        accum += sin(dist * 25.0 + u_time * 8.0) * cos(dist * 18.0) * 0.04;
        dist += max(0.06, density * 0.48);
        if (dist > 90.0 || accum > 12.0) break;
      }

      vec3 col = 0.5 + 0.5 * vec3(
        sin(accum * 5.5 + u_time * 2.7),
        cos(accum * 7.2 + u_time * 2.4),
        tan(accum * 5.1 + u_time * 1.4)
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

  return true;
}

function render(now) {
  if (!isRunning || !gl || !program) return;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height);
  gl.uniform1f(gl.getUniformLocation(program, 'u_time'), (now - startTime) / 1000);

  // Draw multiple times per frame to force more work before throttle
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  frameCount++;
  if (frameCount % 10 === 0) {
    const fps = Math.round(1000 / (now - lastFrameTime));
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = `Nuking... ~${fps} FPS (pray)`;
    lastFrameTime = now;
  }

  ensureStatusTimer();
  if (timeEl) timeEl.textContent = formatTime(now - startTime);

  animFrameId = requestAnimationFrame(render);
}

function startNuke() {
  if (isRunning) {
    // Toggle stop
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
  if (statusEl) statusEl.textContent = "Nuking GPU – hold on tight";
  if (timeEl) timeEl.textContent = formatTime(0);

  // Anti-throttle tricks
  canvas.requestFullscreen?.().catch(() => {});
  canvas.requestPointerLock?.().catch(() => {});

  if (!createWebGLContext()) {
    setIdle();
    return;
  }

  startTime = performance.now();  // timer starts HERE on click
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

  // Dummy worker
  try {
    if (worker) worker.terminate();
    worker = new Worker(URL.createObjectURL(new Blob([`
      onmessage = function(e) {
        if (e.data[0] === "ping") postMessage(["pong"]);
      };
    `], {type: 'text/javascript'})));
  } catch (e) {}

  // Resize handling
  window.addEventListener('resize', () => {
    if (canvas) {
      const scale = 4.5;
      canvas.width = window.innerWidth * scale;
      canvas.height = window.innerHeight * scale;
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    }
  });

  setIdle();
});
