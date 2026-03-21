let worker = null;
let isRunning = false;

const crashBtn = document.getElementById('crashBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const timeEl = document.getElementById('time');

let gl = null;
let program = null;
let canvas = null;
let startTime = 0;
let animFrameId = null;
let frameCount = 0;
let lastFrameTime = 0;

function setIdle() {
  isRunning = false;
  if (crashBtn) crashBtn.disabled = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  statusEl.textContent = "Idle – click to melt";
  timeEl.textContent = "-- ms";
}

function createAndSetupWebGL() {
  if (canvas) return true; // already created

  canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '-999';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  // Oversize resolution to force massive fragment work
  const scale = 3.5; // tune higher (4–6) for more pain on strong GPUs
  canvas.width = window.innerWidth * scale;
  canvas.height = window.innerHeight * scale;

  gl = canvas.getContext('webgl2', {
    antialias: false,
    powerPreference: 'high-performance',
    desynchronized: true,
    preserveDrawingBuffer: false
  }) || canvas.getContext('webgl');

  if (!gl) {
    statusEl.textContent = "WebGL failed – your GPU already gave up";
    return false;
  }

  // Vertex shader – fullscreen quad
  const vsSource = `#version 300 es
    in vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`;

  // Fragment shader – trigonometry + high iteration count
  const fsSource = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform vec2 u_resolution;
    uniform float u_time;

    float trigHell(vec3 p) {
      float v = 0.0;
      float amp = 1.0;
      for (int i = 0; i < 120; i++) {           // 120 octaves of trig spam
        v += amp * sin(p.x * 14.1 + u_time * 2.3);
        v += amp * cos(p.y * 17.4 + u_time * 1.9);
        v += amp * tan(atan(p.z * 11.8 + u_time * 1.4) * 1.2);
        v += amp * sin(cos(v * 5.67) * tan(u_time * 0.8));
        v = fract(v * 1.618);                   // golden ratio chaos
        amp *= 0.42;
        p += vec3(sin(u_time * 0.7), cos(u_time * 1.1), tan(u_time * 0.5));
      }
      return v;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
      vec3 ro = vec3(sin(u_time * 0.6) * 4.0, cos(u_time * 0.8) * 3.0, -8.0);
      vec3 rd = normalize(vec3(uv * 1.8, 1.6 + sin(u_time * 0.4) * 0.3));

      float dist = 0.0;
      float accum = 0.0;

      for (int i = 0; i < 350; i++) {           // 350+ steps per pixel = GPU killer
        vec3 p = ro + rd * dist;
        float density = abs(trigHell(p * 3.0 + u_time * 1.2)) * 0.08;
        accum += density * exp(-dist * 0.015);
        accum += sin(dist * 18.0 + u_time * 6.0) * cos(dist * 13.0) * 0.03;
        dist += max(0.04, density * 0.35);
        if (dist > 60.0 || accum > 8.0) break;
      }

      vec3 col = 0.5 + 0.5 * vec3(
        sin(accum * 4.2 + u_time * 2.1),
        cos(accum * 5.6 + u_time * 1.8),
        tan(accum * 3.9 + u_time * 0.9)
      );

      fragColor = vec4(col, 1.0);
    }`;

  // Compile & link
  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  const vertexShader = compileShader(gl.VERTEX_SHADER, vsSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fsSource);

  if (!vertexShader || !fragmentShader) return false;

  program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return false;
  }

  gl.useProgram(program);

  // Quad buffer
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1, 1,-1, -1,1,
    1,-1, 1,1, -1,1
  ]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  return true;
}

function render(now) {
  if (!isRunning || !gl) return;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height);
  gl.uniform1f(gl.getUniformLocation(program, 'u_time'), (now - startTime) / 1000);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  frameCount++;
  if (frameCount % 8 === 0) {
    const fps = Math.round(1000 / (now - lastFrameTime));
    statusEl.textContent = `Nuking... ~${fps} FPS (GPU dying)`;
    lastFrameTime = now;
  }

  animFrameId = requestAnimationFrame(render);
}

function startCrash() {
  if (isRunning) return;
  isRunning = true;
  if (crashBtn) crashBtn.disabled = true;
  if (stopBtn) stopBtn.style.display = 'inline-block';

  statusEl.textContent = "Nuking GPU – hold tight";
  timeEl.textContent = "∞ ms (no mercy)";

  if (!createAndSetupWebGL()) {
    setIdle();
    return;
  }

  startTime = performance.now();
  frameCount = 0;
  lastFrameTime = startTime;
  requestAnimationFrame(render);
}

crashBtn.onclick = function() {
  startCrash();
};

if (stopBtn) {
  stopBtn.onclick = function() {
    setIdle();
    statusEl.textContent = "Stopped – you cheated death";
    timeEl.textContent = '-- ms';
    if (stopBtn) stopBtn.style.display = 'none';
  };
}

// Dummy worker (your original structure preserved)
function initWorker() {
  try {
    if (worker) worker.terminate();
    worker = new Worker(URL.createObjectURL(new Blob([`
      onmessage = e => {
        if (e.data[0] === "ping") postMessage(["pong"]);
      };
    `], {type: 'text/javascript'})));
  } catch (e) {
    console.warn("Worker init failed – no big deal for crash");
  }
}

initWorker();
