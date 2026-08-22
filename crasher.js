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

// ─── NEW: TORTURE CONFIG ──────────────────────────────
const TORTURE = {
  shaderLoops: 250,        // was 110 → now 250
  raymarchSteps: 600,      // was 420 → now 600
  renderPasses: 6,         // NEW: multiple passes per frame
  memoryChunks: 300,       // NEW: memory bomb
  workerSpam: true,        // NEW: worker torture
  extraGeometry: true,     // NEW: more vertices
  textureBomb: true,       // NEW: texture allocation spam
  computeWarp: true        // NEW: extra compute shader work
};

let memoryBomb = [];
let textureBombs = [];
let extraBuffers = [];
let tortureWorkers = [];

// ──────────────────────────────────────────────
function ensureStatusTimer() {
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'status';
    Object.assign(statusEl.style, {
      position: 'fixed', top: '18px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.7)', color: '#ff0044', padding: '10px 16px',
      borderRadius: '10px', fontSize: '14px', fontFamily: 'monospace',
      zIndex: '9999', pointerEvents: 'none', backdropFilter: 'blur(6px)',
      border: '1px solid #ff0044', fontWeight: 'bold'
    });
    document.body.appendChild(statusEl);
  }
  if (!timeEl) {
    timeEl = document.createElement('div');
    timeEl.id = 'time';
    Object.assign(timeEl.style, {
      position: 'fixed', top: '65px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.65)', color: '#ff8800', padding: '8px 14px',
      borderRadius: '10px', fontSize: '14px', fontFamily: 'monospace',
      zIndex: '9999', pointerEvents: 'none', backdropFilter: 'blur(6px)',
      border: '1px solid #ff8800'
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
    crashBtn.textContent = "💀 CRASH GPU NOW";
  }
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  
  // Clean up torture resources
  memoryBomb = [];
  textureBombs = [];
  extraBuffers = [];
  tortureWorkers.forEach(w => { try { w.terminate(); } catch(e) {} });
  tortureWorkers = [];
  
  if (gl) {
    try {
      // Force GPU reset by creating and deleting massive resources
      for (let i = 0; i < 50; i++) {
        const trash = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, trash);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(1000000), gl.STATIC_DRAW);
        gl.deleteBuffer(trash);
      }
    } catch(e) {}
  }
  
  ensureStatusTimer();
  if (statusEl) {
    statusEl.textContent = "💀 GPU SURVIVED (barely)";
    statusEl.style.border = '1px solid #00ff88';
    statusEl.style.color = '#00ff88';
  }
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

  // ULTRA resolution (was 4.0 → now 6.0)
  const scale = 6.0;
  canvas.width = window.innerWidth * scale;
  canvas.height = window.innerHeight * scale;

  gl = canvas.getContext('webgl2', {
    antialias: false,
    powerPreference: 'high-performance',
    desynchronized: true,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false
  }) || canvas.getContext('webgl');

  if (!gl) {
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = "NO WEBGL - YOUR GPU IS PUSSY";
    return false;
  }

  // ─── VERTEX SHADER ──────────────────────────────────
  const vsSource = `#version 300 es
    in vec2 a_position;
    in vec3 a_color;
    out vec3 v_color;
    uniform float u_time;
    void main() {
      // Warp geometry with trig insanity
      vec2 pos = a_position;
      float wave = sin(pos.x * 30.0 + u_time * 5.0) * 0.1;
      wave += cos(pos.y * 25.0 + u_time * 4.0) * 0.1;
      wave += sin((pos.x + pos.y) * 40.0 + u_time * 7.0) * 0.05;
      pos += wave;
      gl_Position = vec4(pos, 0.0, 1.0);
      v_color = a_color + vec3(sin(u_time + pos.x * 50.0), cos(u_time + pos.y * 50.0), 0.0) * 0.3;
    }`;

  // ─── FRAGMENT SHADER (EVEN MORE BRUTAL) ─────────────
  const fsSource = `#version 300 es
    precision highp float;
    precision highp int;
    out vec4 fragColor;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform int u_pass;

    // ── EXTREME NOISE ──────────────────────────────────
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    
    float noise3D(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z
      );
    }
    
    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.5;
      // INCREASED LOOPS: 18 → 25
      for (int i = 0; i < 25; i++) {
        v += a * noise3D(p);
        p *= 2.7;
        a *= 0.38;
      }
      return v;
    }

    float trigHell(vec3 p, float t) {
      float v = 0.0;
      float amp = 1.0;
      // INCREASED: 110 → 250
      for (int i = 0; i < 250; i++) {
        float fi = float(i);
        // More trig operations
        v += amp * sin(p.x * 13.7 + t * 2.4 + fi * 0.1);
        v += amp * cos(p.y * 16.9 + t * 2.8 + fi * 0.13);
        v += amp * tan(atan(p.z * 10.3 + t * 1.6 + fi * 0.07) * 1.4);
        v += amp * sin(cos(tan(v * 4.1 + fi * 0.05)) * 5.3);
        v += amp * cos(sin(v * 3.7 + fi * 0.03) * 4.9);
        v += amp * atan(sin(v * 6.3 + t * 2.1) * 1.7);
        v = fract(v * 1.6180339887);
        amp *= 0.37;
        p += vec3(sin(t * 0.9 + fi * 0.02), cos(t * 1.3 + fi * 0.025), tan(t * 0.7 + fi * 0.015));
        // Extra chaos
        p = abs(p) - 0.5;
        p = vec3(sin(p.x + t), cos(p.y + t), tan(p.z + t));
      }
      return v;
    }

    float raymarch(vec3 ro, vec3 rd, float t) {
      float dist = 0.0;
      float accum = 0.0;
      // INCREASED: 420 → 600
      for (int i = 0; i < 600; i++) {
        vec3 p = ro + rd * dist;
        float density = abs(trigHell(p * 3.8 + t * 1.6, t)) * 0.12;
        // More operations per step
        density += abs(sin(p.x * 50.0 + t * 20.0) * cos(p.y * 50.0 + t * 15.0)) * 0.02;
        density += abs(cos(p.z * 45.0 + t * 18.0) * sin(p.x * 55.0 + t * 22.0)) * 0.02;
        accum += density * exp(-dist * 0.018);
        accum += sin(dist * 22.0 + t * 7.0) * cos(dist * 15.0) * 0.035;
        accum += cos(dist * 33.0 + t * 9.0) * sin(dist * 27.0) * 0.025;
        dist += max(0.02, density * 0.38);
        if (dist > 100.0 || accum > 15.0) break;
      }
      return accum;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
      float t = u_time * 0.5 + float(u_pass) * 0.15;
      
      // Crazy camera path
      vec3 ro = vec3(
        sin(t * 0.8) * 8.0 * cos(t * 0.3),
        cos(t * 0.6) * 5.0 + sin(t * 0.4) * 2.0,
        -12.0 + sin(t * 0.7) * 4.0
      );
      vec3 rd = normalize(vec3(
        uv * 2.2 + sin(t * 0.5 + uv.y * 3.0) * 0.3,
        1.9 + sin(t * 0.5) * 0.8 + cos(uv.x * 5.0 + t) * 0.2
      ));

      // Multiple ray samples per pixel (anti-aliasing torture)
      float total = 0.0;
      for (int s = 0; s < 4; s++) {
        float fi = float(s);
        vec2 offset = vec2(sin(fi * 1.7 + t * 2.0), cos(fi * 1.3 + t * 1.5)) * 0.003;
        vec3 rd2 = normalize(rd + vec3(offset, 0.0));
        total += raymarch(ro, rd2, t + fi * 0.02);
      }
      total /= 4.0;

      // Extreme color processing
      vec3 col = 0.5 + 0.5 * vec3(
        sin(total * 5.1 + t * 2.4 + total * 2.0),
        cos(total * 6.8 + t * 2.1 + total * 1.5),
        sin(total * 4.7 + t * 1.2 + total * 3.0)
      );
      
      // Additional color torture
      col += vec3(
        sin(total * 50.0 + t * 30.0) * 0.05,
        cos(total * 45.0 + t * 25.0) * 0.05,
        sin(total * 55.0 + t * 35.0) * 0.05
      );
      
      // VHS-like distortion
      float scanline = sin(uv.y * 1200.0 + t * 200.0) * 0.03;
      col += scanline;
      
      // Bloom torture
      float bloom = exp(-total * 0.5) * 0.1;
      col += bloom;

      // Tone mapping with extreme curves
      col = pow(col, vec3(0.8 + 0.3 * sin(t * 0.1)));
      col = col / (col + 0.8);
      
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
    if (statusEl) statusEl.textContent = "SHADER FAILED - GPU SAID FUCK OFF";
    return false;
  }

  program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = "LINK FAILED - PROGRAM INVALID";
    return false;
  }

  gl.useProgram(program);

  // ─── EXTREME GEOMETRY ──────────────────────────────
  // Generate super dense grid (100x100 = 10,000 vertices)
  const gridSize = 80;
  const vertices = [];
  const colors = [];
  for (let y = 0; y <= gridSize; y++) {
    for (let x = 0; x <= gridSize; x++) {
      const u = (x / gridSize) * 2 - 1;
      const v = (y / gridSize) * 2 - 1;
      vertices.push(u, v);
      colors.push(Math.random(), Math.random(), Math.random());
    }
  }
  
  const indexData = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const i = y * (gridSize + 1) + x;
      indexData.push(i, i + 1, i + gridSize + 1);
      indexData.push(i + 1, i + gridSize + 2, i + gridSize + 1);
    }
  }

  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

  const colorLoc = gl.getAttribLocation(program, 'a_color');
  if (colorLoc !== -1) {
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);
  }

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexData), gl.STATIC_DRAW);

  // ─── TEXTURE BOMB ────────────────────────────────────
  try {
    for (let i = 0; i < 30; i++) {
      const size = 2048;
      const data = new Uint8Array(size * size * 4);
      for (let j = 0; j < data.length; j += 4) {
        data[j] = Math.random() * 255;
        data[j+1] = Math.random() * 255;
        data[j+2] = Math.random() * 255;
        data[j+3] = 255;
      }
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      textureBombs.push(tex);
    }
  } catch(e) {}

  // ─── MEMORY BOMB ─────────────────────────────────────
  try {
    for (let i = 0; i < TORTURE.memoryChunks; i++) {
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

  // ─── EXTRA BUFFERS ────────────────────────────────────
  try {
    for (let i = 0; i < 20; i++) {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(1000000), gl.DYNAMIC_DRAW);
      extraBuffers.push(buf);
    }
  } catch(e) {}

  // ─── WORKER TORTURE ──────────────────────────────────
  if (TORTURE.workerSpam) {
    try {
      const workerCode = `
        let data = new Float64Array(2000000);
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
              }
              counter += 0.01;
              self.postMessage({ done: true });
            }, 2);
          }
        };
      `;
      for (let i = 0; i < 12; i++) {
        const blob = new Blob([workerCode], { type: 'text/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        worker.postMessage('start');
        tortureWorkers.push(worker);
      }
    } catch(e) {}
  }

  return true;
}

function render(now) {
  if (!isRunning || !gl || !program) return;

  // ─── MULTIPLE RENDER PASSES ──────────────────────────
  for (let pass = 0; pass < TORTURE.renderPasses; pass++) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const passLoc = gl.getUniformLocation(program, 'u_pass');
    
    if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height);
    if (timeLoc) gl.uniform1f(timeLoc, (now - startTime) / 1000 + pass * 0.1);
    if (passLoc) gl.uniform1i(passLoc, pass);
    
    // Draw with indexed geometry (more vertices = more torture)
    const indexCount = 80 * 80 * 6;
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
  }

  frameCount++;
  if (frameCount % 5 === 0) {
    const fps = Math.round(1000 / (now - lastFrameTime));
    ensureStatusTimer();
    const passInfo = TORTURE.renderPasses > 1 ? ` (${TORTURE.renderPasses}x passes)` : '';
    if (statusEl) {
      statusEl.textContent = `☠️ MURDERING GPU... ${fps} FPS${passInfo}`;
      statusEl.style.border = fps < 10 ? '1px solid #ff0044' : '1px solid #ff8800';
      statusEl.style.color = fps < 10 ? '#ff0044' : '#ff8800';
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
    if (statusEl) statusEl.textContent = "🛑 STOPPED - YOU SURVIVED... THIS TIME";
    if (timeEl) timeEl.textContent = '--:--.---';
    if (stopBtn) stopBtn.style.display = 'none';
    return;
  }

  isRunning = true;
  if (crashBtn) {
    crashBtn.disabled = false;
    crashBtn.textContent = "⛔ STOP MURDER";
  }
  if (stopBtn) stopBtn.style.display = 'inline-block';

  ensureStatusTimer();
  if (statusEl) {
    statusEl.textContent = "☠️ GPU MURDER INITIATED - HOLD TIGHT";
    statusEl.style.border = '1px solid #ff0044';
    statusEl.style.color = '#ff0044';
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
    if (statusEl) statusEl.textContent = "MISSING CRASH BUTTON - ADD TO HTML";
    return;
  }

  crashBtn.onclick = startNuke;

  if (stopBtn) {
    stopBtn.onclick = () => {
      setIdle();
      ensureStatusTimer();
      if (statusEl) statusEl.textContent = "🛑 STOPPED - YOU SURVIVED... THIS TIME";
      if (timeEl) timeEl.textContent = '--:--.---';
      if (stopBtn) stopBtn.style.display = 'none';
      if (crashBtn) crashBtn.textContent = "💀 CRASH GPU NOW";
    };
  }

  // Dummy worker (kept for compatibility)
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
      const scale = 6.0;
      canvas.width = window.innerWidth * scale;
      canvas.height = window.innerHeight * scale;
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    }
  });

  setIdle();
});