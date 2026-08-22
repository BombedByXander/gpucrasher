// ─── MAIN APP ──────────────────────────────────────────
let worker = null;
let isRunning = false;

let crashBtn = document.getElementById('crashBtn');
let stopBtn = document.getElementById('stopBtn');
let statusText = document.getElementById('statusText');
let statusDot = document.getElementById('statusDot');
let statusBadge = document.getElementById('statusBadge');
let btnLabel = document.getElementById('btnLabel');
let fpsValue = document.getElementById('fpsValue');
let timeValue = document.getElementById('timeValue');
let loadValue = document.getElementById('loadValue');

let gl = null;
let program = null;
let canvas = null;
let startTime = 0;
let animFrameId = null;
let frameCount = 0;
let lastFrameTime = 0;
let lastFpsUpdate = 0;
let currentFps = 0;
let totalFrames = 0;
let frameTimes = [];

// ─── TORTURE CONFIG ──────────────────────────────────
const TORTURE = {
  shaderLoops: 250,
  raymarchSteps: 600,
  renderPasses: 6,
  memoryChunks: 300,
  workerSpam: true,
  extraGeometry: true,
  textureBomb: true
};

let memoryBomb = [];
let textureBombs = [];
let extraBuffers = [];
let tortureWorkers = [];

// ─── UI HELPERS ──────────────────────────────────────
function setStatus(text, type = 'idle') {
  statusText.textContent = text;
  statusBadge.className = 'status-badge';
  if (type === 'running') {
    statusBadge.classList.add('active');
    statusDot.style.background = '#ef4444';
  } else if (type === 'crashed') {
    statusBadge.classList.add('crashed');
    statusDot.style.background = '#f59e0b';
  } else {
    statusDot.style.background = '#22c55e';
  }
}

function setMetrics(fps, elapsed, load) {
  if (fps !== undefined && fps > 0) {
    currentFps = fps;
    fpsValue.textContent = fps;
    fpsValue.className = 'value' + (fps < 10 ? ' danger' : fps < 25 ? ' warning' : '');
  } else if (fps === 0) {
    fpsValue.textContent = '--';
    fpsValue.className = 'value';
  }
  
  if (elapsed !== undefined) {
    const total = Math.max(0, Math.floor(elapsed));
    const minutes = String(Math.floor(total / 60000)).padStart(2, '0');
    const seconds = String(Math.floor((total % 60000) / 1000)).padStart(2, '0');
    const millis = String(total % 1000).padStart(3, '0');
    timeValue.textContent = `${minutes}:${seconds}.${millis}`;
  }
  
  if (load !== undefined) {
    const l = Math.min(100, Math.round(load));
    loadValue.textContent = l + '%';
    loadValue.className = 'value' + (l > 80 ? ' danger' : l > 50 ? ' warning' : '');
  }
}

function setIdle() {
  isRunning = false;
  if (crashBtn) {
    crashBtn.disabled = false;
    crashBtn.className = 'crash-btn';
    btnLabel.textContent = 'Crash GPU';
    document.querySelector('.crash-btn .icon').textContent = '⚡';
  }
  if (stopBtn) stopBtn.style.display = 'none';
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

  setStatus('Ready', 'idle');
  setMetrics(0, 0, 0);
}

// ─── WEBGL CONTEXT ──────────────────────────────────
function createWebGLContext() {
  if (canvas) return true;
  
  canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.zIndex = '-1';
  canvas.style.pointerEvents = 'none';
  canvas.style.opacity = '0.7';
  document.body.prepend(canvas);

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
    setStatus('No WebGL!', 'idle');
    return false;
  }

  // ─── Shaders ──────────────────────────────────────
  const vsSource = `#version 300 es
    in vec2 a_position;
    in vec3 a_color;
    out vec3 v_color;
    uniform float u_time;
    void main() {
      vec2 pos = a_position;
      float wave = sin(pos.x * 30.0 + u_time * 5.0) * 0.1;
      wave += cos(pos.y * 25.0 + u_time * 4.0) * 0.1;
      wave += sin((pos.x + pos.y) * 40.0 + u_time * 7.0) * 0.05;
      pos += wave;
      gl_Position = vec4(pos, 0.0, 1.0);
      v_color = a_color + vec3(sin(u_time + pos.x * 50.0), cos(u_time + pos.y * 50.0), 0.0) * 0.3;
    }`;

  const fsSource = `#version 300 es
    precision highp float;
    precision highp int;
    out vec4 fragColor;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform int u_pass;

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
      for (int i = 0; i < 250; i++) {
        float fi = float(i);
        v += amp * sin(p.x * 13.7 + t * 2.4 + fi * 0.1);
        v += amp * cos(p.y * 16.9 + t * 2.8 + fi * 0.13);
        v += amp * tan(atan(p.z * 10.3 + t * 1.6 + fi * 0.07) * 1.4);
        v += amp * sin(cos(tan(v * 4.1 + fi * 0.05)) * 5.3);
        v += amp * cos(sin(v * 3.7 + fi * 0.03) * 4.9);
        v += amp * atan(sin(v * 6.3 + t * 2.1) * 1.7);
        v = fract(v * 1.6180339887);
        amp *= 0.37;
        p += vec3(sin(t * 0.9 + fi * 0.02), cos(t * 1.3 + fi * 0.025), tan(t * 0.7 + fi * 0.015));
        p = abs(p) - 0.5;
        p = vec3(sin(p.x + t), cos(p.y + t), tan(p.z + t));
      }
      return v;
    }

    float raymarch(vec3 ro, vec3 rd, float t) {
      float dist = 0.0;
      float accum = 0.0;
      for (int i = 0; i < 600; i++) {
        vec3 p = ro + rd * dist;
        float density = abs(trigHell(p * 3.8 + t * 1.6, t)) * 0.12;
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
      
      vec3 ro = vec3(
        sin(t * 0.8) * 8.0 * cos(t * 0.3),
        cos(t * 0.6) * 5.0 + sin(t * 0.4) * 2.0,
        -12.0 + sin(t * 0.7) * 4.0
      );
      vec3 rd = normalize(vec3(
        uv * 2.2 + sin(t * 0.5 + uv.y * 3.0) * 0.3,
        1.9 + sin(t * 0.5) * 0.8 + cos(uv.x * 5.0 + t) * 0.2
      ));

      float total = 0.0;
      for (int s = 0; s < 4; s++) {
        float fi = float(s);
        vec2 offset = vec2(sin(fi * 1.7 + t * 2.0), cos(fi * 1.3 + t * 1.5)) * 0.003;
        vec3 rd2 = normalize(rd + vec3(offset, 0.0));
        total += raymarch(ro, rd2, t + fi * 0.02);
      }
      total /= 4.0;

      vec3 col = 0.5 + 0.5 * vec3(
        sin(total * 5.1 + t * 2.4 + total * 2.0),
        cos(total * 6.8 + t * 2.1 + total * 1.5),
        sin(total * 4.7 + t * 1.2 + total * 3.0)
      );
      
      col += vec3(
        sin(total * 50.0 + t * 30.0) * 0.05,
        cos(total * 45.0 + t * 25.0) * 0.05,
        sin(total * 55.0 + t * 35.0) * 0.05
      );
      
      float scanline = sin(uv.y * 1200.0 + t * 200.0) * 0.03;
      col += scanline;
      float bloom = exp(-total * 0.5) * 0.1;
      col += bloom;
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
    setStatus('Shader failed!', 'idle');
    return false;
  }

  program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    setStatus('Link failed!', 'idle');
    return false;
  }

  gl.useProgram(program);

  // ─── Geometry ─────────────────────────────────────
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

  // ─── Texture Bomb ─────────────────────────────────
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

  // ─── Memory Bomb ──────────────────────────────────
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

  // ─── Extra Buffers ────────────────────────────────
  try {
    for (let i = 0; i < 20; i++) {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(1000000), gl.DYNAMIC_DRAW);
      extraBuffers.push(buf);
    }
  } catch(e) {}

  // ─── Worker Torture ──────────────────────────────
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

// ─── RENDER LOOP ──────────────────────────────────
function render(now) {
  if (!isRunning || !gl || !program) return;

  const elapsed = (now - startTime) / 1000;
  const heat = Math.min(100, (elapsed / 10) * 40 + 20 + Math.random() * 10);

  // ─── Multiple Render Passes ──────────────────────
  for (let pass = 0; pass < TORTURE.renderPasses; pass++) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const passLoc = gl.getUniformLocation(program, 'u_pass');
    
    if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height);
    if (timeLoc) gl.uniform1f(timeLoc, elapsed + pass * 0.1);
    if (passLoc) gl.uniform1i(passLoc, pass);
    
    const indexCount = 80 * 80 * 6;
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
  }

  frameCount++;
  totalFrames++;

  // ─── Update Metrics ──────────────────────────────
  if (now - lastFpsUpdate > 200) {
    const fps = Math.round(frameCount / ((now - lastFpsUpdate) / 1000));
    setMetrics(fps, now - startTime, heat);
    
    // Update status
    if (fps < 10) {
      setStatus(`☠️ MURDERING GPU - ${fps} FPS`, 'running');
    } else if (fps < 25) {
      setStatus(`🔥 KILLING GPU - ${fps} FPS`, 'running');
    } else {
      setStatus(`⚡ DESTROYING GPU - ${fps} FPS`, 'running');
    }
    
    frameCount = 0;
    lastFpsUpdate = now;
  }

  animFrameId = requestAnimationFrame(render);
}

// ─── START / STOP ──────────────────────────────────
function startNuke() {
  if (isRunning) {
    setIdle();
    setStatus('Stopped - You survived... this time', 'idle');
    return;
  }

  isRunning = true;
  if (crashBtn) {
    crashBtn.className = 'crash-btn running';
    btnLabel.textContent = 'KILLING...';
    document.querySelector('.crash-btn .icon').textContent = '☠️';
  }
  if (stopBtn) stopBtn.style.display = 'flex';
  
  setStatus('☠️ GPU MURDER INITIATED', 'crashed');
  setMetrics(0, 0, 0);

  if (!createWebGLContext()) {
    setIdle();
    return;
  }

  startTime = performance.now();
  frameCount = 0;
  totalFrames = 0;
  lastFpsUpdate = startTime;
  requestAnimationFrame(render);
}

function stopNuke() {
  setIdle();
  setStatus('Stopped - You survived... this time', 'idle');
  if (stopBtn) stopBtn.style.display = 'none';
  if (crashBtn) {
    crashBtn.className = 'crash-btn';
    btnLabel.textContent = 'Crash GPU';
    document.querySelector('.crash-btn .icon').textContent = '⚡';
  }
}

// ─── EVENT LISTENERS ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Button events
  if (crashBtn) {
    crashBtn.addEventListener('click', startNuke);
  }
  
  if (stopBtn) {
    stopBtn.addEventListener('click', stopNuke);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      startNuke();
    }
    if (e.key === 'Escape' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      stopNuke();
    }
  });

  // Resize handler
  window.addEventListener('resize', () => {
    if (canvas && gl) {
      const scale = 6.0;
      canvas.width = window.innerWidth * scale;
      canvas.height = window.innerHeight * scale;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  });

  // Initialize
  setIdle();
});

// ─── DUMMY WORKER (for compatibility) ──────────────
try {
  if (worker) worker.terminate();
  worker = new Worker(URL.createObjectURL(new Blob([`
    onmessage = function(e) {
      if (e.data[0] === "ping") postMessage(["pong"]);
    };
  `], {type: 'text/javascript'})));
} catch (e) {}