let worker = null;
let isRunning = false;

const crashBtn = document.getElementById('crashBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const timeEl = document.getElementById('time');

let gl = null;
let program = null;
let startTime = 0;
let animFrameId = null;
let frameCount = 0;

function setIdle() {
  isRunning = false;
  if (crashBtn) crashBtn.disabled = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  statusEl.textContent = "Idle – ready to die";
}

function createWebGLContext() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.zIndex = '-1';
  canvas.width = window.innerWidth * 4;   // oversize = more pixels = more pain
  canvas.height = window.innerHeight * 4;
  document.body.appendChild(canvas);

  gl = canvas.getContext('webgl2', {
    antialias: false,
    powerPreference: 'high-performance',
    desynchronized: true,
    preserveDrawingBuffer: false
  }) || canvas.getContext('webgl');

  if (!gl) {
    statusEl.textContent = "No WebGL – your shit is already broken";
    return false;
  }

  // Vertex shader – simple fullscreen quad
  const vsSource = `#version 300 es
    in vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`;

  // Fragment shader – trigonometry + iteration apocalypse
  const fsSource = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_intensity;

    float trigChaos(vec3 p) {
      float v = 0.0;
      float a = 1.0;
      for (int i = 0; i < 80; i++) {  // 80+ nested trig calls per pixel = death
        v += a * sin(p.x * 12.34 + u_time * 1.7) * cos(p.y * 15.67 + u_time * 2.1);
        v += a * tan(atan(p.z * 9.87) + u_time * 0.9);
        v += a * sin(cos(tan(v * 3.14)) * 4.2);
        v = mod(v, 6.283185);  // force periodic chaos
        a *= 0.48;
        p += vec3(sin(u_time * 0.4), cos(u_time * 0.6), tan(u_time * 0.3));
      }
      return v;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
      vec3 dir = normalize(vec3(uv * 2.0, 1.8 + sin(u_time * 0.3) * 0.4));
      vec3 pos = vec3(sin(u_time * 0.7) * 3.0, cos(u_time * 0.9) * 2.5, -6.0);

      float accum = 0.0;
      float steps = 120.0 + u_intensity * 280.0;  // up to ~400 steps per pixel

      for (float i = 0.0; i < steps; i++) {
        pos += dir * 0.08;
        float d = trigChaos(pos * 2.5 + u_time * 0.8);
        accum += abs(d) * 0.04 * exp(-i * 0.008);
        accum += sin(d * 12.0 + u_time * 5.0) * cos(d * 9.0) * 0.02;
        if (accum > 5.0) break;  // early out – but still too late for most GPUs
      }

      fragColor = vec4(
        sin(accum * 3.14 + u_time) * 0.5 + 0.5,
        cos(accum * 4.2 + u_time * 1.3) * 0.5 + 0.5,
        tan(accum * 2.8) * 0.3 + 0.5,
        1.0
      );
    }`;

  // Compile shaders
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSource);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSource);
  gl.compileShader(fs);

  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS) || !gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(vs) || gl.getShaderInfoLog(fs));
    statusEl.textContent = "Shader compilation failed – your GPU said no";
    return false;
  }

  program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    statusEl.textContent = "Program link failed";
    return false;
  }

  // Fullscreen quad
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1,  1,-1,  -1,1,
     1,-1,  1,1,   -1,1
  ]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  gl.useProgram(program);

  return true;
}

function render(now) {
  if (!isRunning || !gl) return;

  const elapsed = now - startTime;

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), gl.canvas.width, gl.canvas.height);
  gl.uniform1f(gl.getUniformLocation(program, 'u_time'), elapsed * 0.001);
  gl.uniform1f(gl.getUniformLocation(program, 'u_intensity'), 10.0); // max pain

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  frameCount++;
  if (frameCount % 10 === 0) {
    statusEl.textContent = `Melting... ${Math.round(1000 / (now - (window.lastFrame || now)))} FPS`;
    window.lastFrame = now;
  }

  animFrameId = requestAnimationFrame(render);
}

function startNuke() {
  if (isRunning) return;
  isRunning = true;
  crashBtn.disabled = true;
  if (stopBtn) stopBtn.style.display = 'inline-block';

  statusEl.textContent = "Nuking GPU & CPU... pray";
  timeEl.textContent = "∞ ms (no escape)";

  if (!gl) {
    if (!createWebGLContext()) {
      setIdle();
      return;
    }
  }

  startTime = performance.now();
  frameCount = 0;
  window.lastFrame = startTime;
  requestAnimationFrame(render);
}

crashBtn.onclick = function() {
  startNuke();
};

if (stopBtn) {
  stopBtn.onclick = function() {
    setIdle();
    statusEl.textContent = "Stopped – you survived... for now";
    timeEl.textContent = '-- ms';
    if (stopBtn) stopBtn.style.display = 'none';
  };
}

// Optional: worker for fake "control" messages (kept as you had it)
function initWorker() {
  try {
    if (worker) worker.terminate();
    worker = new Worker(URL.createObjectURL(new Blob([`
      onmessage = function(e) {
        if (e.data[0] === "ping") postMessage(["pong"]);
      };
    `], {type: 'text/javascript'})));
  } catch (e) {}
}

initWorker();
