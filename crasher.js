let worker = null;
let isRunning = false;
let crashBtn = null;
let statusEl = null;
let timeEl = null;
let gl = null;
let program = null;
let canvas = null;
let startTime = 0;
let animFrameId = null;
let frameCount = 0;
let lastFrameTime = 0;

let textures = [];
let framebuffers = [];
let ramArrays = [];

// Intensity scaling
function getMarchSteps() {
  return Math.floor(50 + (420 - 50) * ((window.intensity || 10) / 10));
}

function getTrigLoops() {
  return Math.floor(20 + (110 - 20) * ((window.intensity || 10) / 10));
}

function getBombCount() {
  return 4 + Math.floor(12 * ((window.intensity || 10) / 10)); // 4→16 textures
}

// ──────────────────────────────────────────────
function ensureStatusTimer() {
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'status';
    Object.assign(statusEl.style, { position: 'fixed', top: '18px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: '#dbeafe', padding: '10px 16px', borderRadius: '10px', fontSize: '14px', fontFamily: 'monospace', zIndex: '9999', pointerEvents: 'none', backdropFilter: 'blur(6px)' });
    document.body.appendChild(statusEl);
  }
  if (!timeEl) {
    timeEl = document.createElement('div');
    timeEl.id = 'time';
    Object.assign(timeEl.style, { position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.65)', color: '#d1fae5', padding: '8px 14px', borderRadius: '10px', fontSize: '14px', fontFamily: 'monospace', zIndex: '9999', pointerEvents: 'none', backdropFilter: 'blur(6px)' });
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
    crashBtn.textContent = "Crash GPU";
    crashBtn.disabled = false;
  }
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = null;

  // Cleanup bombs
  textures.forEach(t => { if (t) gl.deleteTexture(t); });
  framebuffers.forEach(f => { if (f) gl.deleteFramebuffer(f); });
  textures = []; framebuffers = [];
  ramArrays = []; // let GC eat the JS RAM bomb

  ensureStatusTimer();
  if (statusEl) statusEl.textContent = "Idle – ready to burn";
  if (timeEl) timeEl.textContent = formatTime(0);
}

function createVRAMBomb() {
  const count = getBombCount();
  const size = 8192;

  for (let i = 0; i < count; i++) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, size, size); // immutable + float32
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    textures.push(tex);
    framebuffers.push(fb);
  }

  // Bonus system RAM bomb (Float32Arrays)
  for (let i = 0; i < 8; i++) {
    ramArrays.push(new Float32Array(1024 * 1024 * 64)); // ~256MB each ×8 = 2GB+
  }

  console.log(`💥 VRAM Bomber armed: ${count} × 8192² RGBA32F + JS RAM arrays`);
}

function createWebGLContext() {
  if (canvas) return true;
  canvas = document.createElement('canvas');
  canvas.style.position = 'fixed'; canvas.style.inset = '0'; canvas.style.zIndex = '-999'; canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  const scale = 4.0;
  canvas.width = window.innerWidth * scale;
  canvas.height = window.innerHeight * scale;

  gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance', desynchronized: true }) || canvas.getContext('webgl');
  if (!gl) {
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = "No WebGL — your GPU is pussy";
    return false;
  }

  // ───── VRAM BOMBER ─────
  createVRAMBomb();

  const vsSource = `#version 300 es\nin vec2 a_position;\nvoid main(){gl_Position=vec4(a_position,0.0,1.0);}`;

  const marchSteps = getMarchSteps();
  const trigLoops = getTrigLoops();

  const fsSource = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform vec2 u_resolution;
    uniform float u_time;
    float trigHell(vec3 p) {
      float v = 0.0; float amp = 1.0;
      for (int i = 0; i < ${trigLoops}; i++) {
        v += amp * sin(p.x * 13.7 + u_time * 2.4);
        v += amp * cos(p.y * 16.9 + u_time * 2.8);
        v += amp * tan(atan(p.z * 10.3 + u_time * 1.6) * 1.4);
        v += amp * sin(cos(tan(v * 4.1)) * 5.3);
        v = fract(v * 1.6180339887);
        amp *= 0.39;
        p += vec3(sin(u_time * 0.9), cos(u_time * 1.3), tan(u_time * 0.7));
      }
      return v;
    }
    void main() {
      vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
      vec3 ro = vec3(sin(u_time * 0.8) * 5.0, cos(u_time * 1.0) * 4.0, -10.0);
      vec3 rd = normalize(vec3(uv * 2.2, 1.9 + sin(u_time * 0.5) * 0.5));
      float dist = 0.0; float accum = 0.0;
      for (int i = 0; i < ${marchSteps}; i++) {
        vec3 p = ro + rd * dist;
        float density = abs(trigHell(p * 3.8 + u_time * 1.6)) * 0.12;
        accum += density * exp(-dist * 0.018);
        accum += sin(dist * 22.0 + u_time * 7.0) * cos(dist * 15.0) * 0.035;
        dist += max(0.05, density * 0.42);
        if (dist > 80.0 || accum > 10.0) break;
      }
      vec3 col = 0.5 + 0.5 * vec3(sin(accum * 5.1 + u_time * 2.4), cos(accum * 6.8 + u_time * 2.1), tan(accum * 4.7 + u_time * 1.2));
      fragColor = vec4(col, 1.0);
    }`;

  // shader compile + program setup (same as before, skipped for brevity but it's identical)
  const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, vsSource); gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, fsSource); gl.compileShader(fs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS) || !gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(vs) || gl.getShaderInfoLog(fs));
    ensureStatusTimer(); if (statusEl) statusEl.textContent = "Shader died – GPU said fuck off";
    return false;
  }

  program = gl.createProgram();
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    ensureStatusTimer(); if (statusEl) statusEl.textContent = "Link failed";
    return false;
  }

  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]), gl.STATIC_DRAW);
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

  // Main screen render
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // 🔥 VRAM BOMB CYCLE 🔥
  if (frameCount % 3 === 0 && framebuffers.length > 0) {
    const idx = frameCount % framebuffers.length;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[idx]);
    gl.drawArrays(gl.TRIANGLES, 0, 6); // render to huge texture
  }

  frameCount++;
  if (frameCount % 8 === 0) {
    const fps = Math.round(1000 / (now - lastFrameTime)) || 0;
    ensureStatusTimer();
    if (statusEl) statusEl.textContent = `NUKING LVL ${window.intensity || 10} • ${textures.length}×256MB textures • ${fps} FPS`;
    lastFrameTime = now;
  }

  if (timeEl) timeEl.textContent = formatTime(now - startTime);
  animFrameId = requestAnimationFrame(render);
}

function startNuke() {
  if (isRunning) { setIdle(); ensureStatusTimer(); if (statusEl) statusEl.textContent = "Stopped – you survived... this time"; return; }

  isRunning = true;
  if (crashBtn) crashBtn.textContent = "STOP NUKING";

  ensureStatusTimer();
  if (statusEl) statusEl.textContent = `VRAM + Shader nuke @ Level ${window.intensity || 10} — fans about to die`;

  if (!createWebGLContext()) { setIdle(); return; }

  startTime = performance.now();
  frameCount = 0;
  lastFrameTime = startTime;
  requestAnimationFrame(render);
}

// DOM ready
document.addEventListener('DOMContentLoaded', () => {
  crashBtn = document.getElementById('crashBtn');
  if (!crashBtn) return console.error("No crashBtn");

  crashBtn.onclick = startNuke;

  window.addEventListener('resize', () => {
    if (canvas) {
      const scale = 4.0;
      canvas.width = window.innerWidth * scale;
      canvas.height = window.innerHeight * scale;
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    }
  });

  try { worker = new Worker(URL.createObjectURL(new Blob([`onmessage=e=>e.data[0]==="ping"&&postMessage(["pong"])`], {type:'text/javascript'}))); } catch(e){}

  setIdle();
});
