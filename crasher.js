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
let visualCanvas = null;
let visualCtx = null;

// ─── HARDWARE DETECTION ──────────────────────────────────
function isLowEndDevice() {
  const isSE = /iPhone13,2|iPhone14,6/.test(navigator.userAgent);
  const isOlder = /iPhone8|iPhone9|iPhone10|iPhone11|iPhone12/.test(navigator.userAgent);
  const isLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
  return isSE || isOlder || isLowMemory;
}

const isLowEnd = isLowEndDevice();

// ─── DYNAMIC CONFIG ──────────────────────────────────────
let CONFIG = {
  shaderLoops: isLowEnd ? 80 : 150,
  raymarchSteps: isLowEnd ? 300 : 500,
  renderPasses: isLowEnd ? 20 : 10,
  resolutionScale: isLowEnd ? 4.0 : 5.0,
  memoryChunks: isLowEnd ? 300 : 100,
  escalationLevel: 0,
  maxEscalation: 20
};

let memoryBomb = [];
let lastFps = 60;
let consecutiveLowFps = 0;
let escalationTimer = 0;

// ─── UI HELPERS ──────────────────────────────────────────
function formatTime(ms) {
  if (!isFinite(ms)) return '--:--.---';
  const total = Math.max(0, Math.floor(ms));
  const minutes = String(Math.floor(total / 60000)).padStart(2, '0');
  const seconds = String(Math.floor((total % 60000) / 1000)).padStart(2, '0');
  const millis = String(total % 1000).padStart(3, '0');
  return `${minutes}:${seconds}.${millis}`;
}

// ─── CZNULL-STYLE VISUAL CHAOS ──────────────────────────
function startVisualChaos() {
  // Create the visual canvas overlay
  visualCanvas = document.createElement('canvas');
  visualCanvas.style.position = 'fixed';
  visualCanvas.style.inset = '0';
  visualCanvas.style.zIndex = '10';
  visualCanvas.style.pointerEvents = 'none';
  visualCanvas.style.opacity = '0.85';
  visualCanvas.style.mixBlendMode = 'screen';
  document.body.appendChild(visualCanvas);
  
  visualCtx = visualCanvas.getContext('2d');
  
  // Resize the canvas
  function resizeVisual() {
    visualCanvas.width = window.innerWidth;
    visualCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeVisual);
  resizeVisual();
  
  // Start the visual chaos animation
  renderVisualChaos();
}

function renderVisualChaos() {
  if (!isRunning || !visualCtx) return;
  
  const w = visualCanvas.width;
  const h = visualCanvas.height;
  const ctx = visualCtx;
  
  // Clear with slight trail effect for motion blur
  ctx.fillStyle = 'rgba(5, 6, 10, 0.15)';
  ctx.fillRect(0, 0, w, h);
  
  const time = (Date.now() - startTime) / 1000;
  const escalationFactor = 1 + CONFIG.escalationLevel * 0.1;
  
  // ─── CZNULL-STYLE POISON MUSHROOM VISUAL ──────────────
  // Using WebGL-like math in 2D canvas for maximum chaos
  
  const centerX = w / 2;
  const centerY = h / 2;
  const scale = Math.min(w, h) * 0.3 * escalationFactor;
  
  // Draw the "poison mushroom" with trig chaos
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      
      // Normalize coordinates
      const nx = (x - centerX) / scale;
      const ny = (y - centerY) / scale;
      const nz = 0.5 + 0.5 * Math.sin(time * 0.3);
      
      // ─── CZNULL-STYLE TRIG CHAOS ──────────────────────
      // Massive trig function - this is what makes it "poison mushroom"
      let v = 0.0;
      let amp = 1.0;
      
      // Dynamic loop count based on escalation
      const loops = Math.min(80 + CONFIG.escalationLevel * 5, 200);
      
      for (let i = 0; i < loops; i++) {
        const fi = i * 0.01;
        v += amp * Math.sin(nx * 13.7 + time * 2.4 + fi);
        v += amp * Math.cos(ny * 16.9 + time * 2.8 + fi * 0.7);
        v += amp * Math.sin(nz * 10.3 + time * 1.6 + fi * 1.3) * Math.cos(nx * 5.3 + ny * 3.7 + time);
        v = Math.abs(v) * 0.5 + 0.5;
        amp *= 0.39;
      }
      
      // Color from chaos - the "poison" colors
      const r = 0.5 + 0.5 * Math.sin(v * 5.1 + time * 2.4 + nx * 2.0);
      const g = 0.5 + 0.5 * Math.cos(v * 6.8 + time * 2.1 + ny * 1.5);
      const b = 0.5 + 0.5 * Math.sin(v * 4.7 + time * 1.2 + nz * 3.0);
      
      // ─── ADD MORE CHAOS ──────────────────────────────────
      // Scanline distortion
      const scanline = Math.sin(y * 0.5 + time * 20.0) * 0.05;
      // RGB split effect
      const split = Math.sin(y * 0.1 + time * 5.0) * 0.02;
      // VHS noise
      const noise = Math.random() * 0.05;
      
      data[i] = Math.min(1, Math.max(0, r + scanline + split + noise)) * 255;
      data[i+1] = Math.min(1, Math.max(0, g + scanline - split + noise * 0.8)) * 255;
      data[i+2] = Math.min(1, Math.max(0, b + scanline + split * 0.5 + noise * 1.2)) * 255;
      data[i+3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  // ─── ADD GLITCHY TEXT OVERLAY ──────────────────────────
  if (Math.random() < 0.05) {
    ctx.fillStyle = 'rgba(255, 0, 255, 0.05)';
    ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 200 + 50, 2 + Math.random() * 8);
  }
  
  // ─── FPS AND STATUS OVERLAY ────────────────────────────
  if (fpsEl) {
    const fps = parseInt(fpsEl.textContent) || 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, 10, 200, 60);
    ctx.fillStyle = fps < 10 ? '#ef4444' : fps < 25 ? '#f59e0b' : '#22c55e';
    ctx.font = '12px monospace';
    ctx.fillText(`⚡ Level ${CONFIG.escalationLevel}`, 20, 30);
    ctx.fillText(`🔥 ${CONFIG.renderPasses}x passes`, 20, 50);
  }
  
  requestAnimationFrame(renderVisualChaos);
}

function stopVisualChaos() {
  if (visualCanvas) {
    visualCanvas.remove();
    visualCanvas = null;
    visualCtx = null;
  }
}

function escalateTorture() {
  CONFIG.escalationLevel++;
  
  CONFIG.shaderLoops = Math.min(200, CONFIG.shaderLoops + 15);
  CONFIG.raymarchSteps = Math.min(700, CONFIG.raymarchSteps + 30);
  CONFIG.renderPasses = Math.min(40, CONFIG.renderPasses + 3);
  CONFIG.resolutionScale = Math.min(8.0, CONFIG.resolutionScale + 0.3);
  CONFIG.memoryChunks = Math.min(600, CONFIG.memoryChunks + 30);
  
  try {
    for (let i = 0; i < 20; i++) {
      const size = 1024 * 1024;
      const chunk = new Uint8Array(size);
      for (let j = 0; j < size; j += 4096) {
        chunk[j] = Math.random() * 255;
      }
      memoryBomb.push(chunk);
    }
  } catch(e) {}
  
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
    statusEl.textContent = `🔥 ESCALATION ${CONFIG.escalationLevel} - ${CONFIG.renderPasses}x passes`;
    statusEl.style.color = '#ef4444';
  }
  
  // ─── TRIGGER GLITCH ON ESCALATION ──────────────────────
  if (window.glitchSystem && window.glitchSystem.isRunning) {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        window.glitchSystem.randomGlitch();
      }, i * 100);
    }
  }
  
  console.log(`🔥 ESCALATED to Level ${CONFIG.escalationLevel}: ${CONFIG.renderPasses} passes, ${CONFIG.shaderLoops} loops`);
  
  setTimeout(() => {
    if (isRunning) {
      createWebGLContext();
    }
  }, 100);
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

  // ─── STOP GLITCHES ──────────────────────────────────────
  if (window.glitchSystem) {
    window.glitchSystem.stop();
  }
  
  // ─── STOP VISUAL CHAOS ──────────────────────────────────
  stopVisualChaos();

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

      float trigHell(vec3 p) {
        float v = 0.0;
        float amp = 1.0;
        for (int i = 0; i < ${currentLoops}; i++) {
          float fi = float(i);
          v += amp * sin(p.x * 13.7 + u_time * 2.4 + fi * 0.01);
          v += amp * cos(p.y * 16.9 + u_time * 2.8 + fi * 0.01);
          v += amp * sin(p.z * 10.3 + u_time * 1.6 + fi * 0.01) * cos(p.z * 5.3 + u_time * 1.2);
          v = v * 0.5 + 0.5;
          amp *= 0.39;
          p += vec3(sin(u_time * 0.9 + fi * 0.001), cos(u_time * 1.3 + fi * 0.001), sin(u_time * 0.7 + fi * 0.001));
          p = p * 1.001 + 0.001;
        }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        vec3 ro = vec3(sin(u_time * 0.8) * 5.0, cos(u_time * 1.0) * 4.0, -10.0);
        vec3 rd = normalize(vec3(uv * 2.2, 1.9 + sin(u_time * 0.5) * 0.5));

        float dist = 0.0;
        float accum = 0.0;

        for (int i = 0; i < ${currentSteps}; i++) {
          vec3 p = ro + rd * dist;
          float density = abs(trigHell(p * 3.8 + u_time * 1.6)) * 0.12;
          accum += density * exp(-dist * 0.018);
          accum += sin(dist * 22.0 + u_time * 7.0) * cos(dist * 15.0) * 0.035;
          accum += cos(dist * 33.0 + u_time * 9.0) * sin(dist * 27.0) * 0.025;
          dist += max(0.02, density * 0.38);
          if (dist > 100.0 || accum > 15.0) break;
        }

        vec3 col = 0.5 + 0.5 * vec3(
          sin(accum * 5.1 + u_time * 2.4 + accum * 2.0),
          cos(accum * 6.8 + u_time * 2.1 + accum * 1.5),
          sin(accum * 4.7 + u_time * 1.2 + accum * 3.0)
        );
        
        col += vec3(sin(accum * 50.0 + u_time * 30.0) * 0.05);
        float scanline = sin(uv.y * 1200.0 + u_time * 200.0) * 0.03;
        col += scanline;
        col = pow(col, vec3(0.8 + 0.3 * sin(u_time * 0.1)));

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
        for (int i = 0; i < ${currentLoops}; i++) {
          float fi = float(i);
          v += amp * sin(p.x * 13.7 + u_time * 2.4 + fi * 0.01);
          v += amp * cos(p.y * 16.9 + u_time * 2.8 + fi * 0.01);
          v += amp * sin(p.z * 10.3 + u_time * 1.6 + fi * 0.01) * cos(p.z * 5.3 + u_time * 1.2);
          v = v * 0.5 + 0.5;
          amp *= 0.39;
          p += vec3(sin(u_time * 0.9 + fi * 0.001), cos(u_time * 1.3 + fi * 0.001), sin(u_time * 0.7 + fi * 0.001));
          p = p * 1.001 + 0.001;
        }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
        vec3 ro = vec3(sin(u_time * 0.8) * 5.0, cos(u_time * 1.0) * 4.0, -10.0);
        vec3 rd = normalize(vec3(uv * 2.2, 1.9 + sin(u_time * 0.5) * 0.5));

        float dist = 0.0;
        float accum = 0.0;

        for (int i = 0; i < ${currentSteps}; i++) {
          vec3 p = ro + rd * dist;
          float density = abs(trigHell(p * 3.8 + u_time * 1.6)) * 0.12;
          accum += density * exp(-dist * 0.018);
          accum += sin(dist * 22.0 + u_time * 7.0) * cos(dist * 15.0) * 0.035;
          accum += cos(dist * 33.0 + u_time * 9.0) * sin(dist * 27.0) * 0.025;
          dist += max(0.02, density * 0.38);
          if (dist > 100.0 || accum > 15.0) break;
        }

        vec3 col = 0.5 + 0.5 * vec3(
          sin(accum * 5.1 + u_time * 2.4 + accum * 2.0),
          cos(accum * 6.8 + u_time * 2.1 + accum * 1.5),
          sin(accum * 4.7 + u_time * 1.2 + accum * 3.0)
        );
        
        col += vec3(sin(accum * 50.0 + u_time * 30.0) * 0.05);
        float scanline = sin(uv.y * 1200.0 + u_time * 200.0) * 0.03;
        col += scanline;
        col = pow(col, vec3(0.8 + 0.3 * sin(u_time * 0.1)));

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

  if (CONFIG.memoryChunks > 0) {
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
    
    if (fps < 10 && lastFps < 10) {
      consecutiveLowFps++;
    } else {
      consecutiveLowFps = 0;
    }
    
    if (consecutiveLowFps > 5 && CONFIG.escalationLevel < CONFIG.maxEscalation) {
      escalateTorture();
      consecutiveLowFps = 0;
    }
    
    escalationTimer += 0.2;
    if (escalationTimer > 30 && CONFIG.escalationLevel < CONFIG.maxEscalation) {
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
      const escText = CONFIG.escalationLevel > 0 ? ` ⚡Lv${CONFIG.escalationLevel}` : '';
      if (fps < 5) {
        statusEl.textContent = `💀 MELTING - ${fps} FPS${escText} (${CONFIG.renderPasses}x passes)`;
        statusEl.style.color = '#ef4444';
        if (statusBadge) statusBadge.className = 'status-badge active';
      } else if (fps < 10) {
        statusEl.textContent = `☠️ DYING - ${fps} FPS${escText} (${CONFIG.renderPasses}x passes)`;
        statusEl.style.color = '#ef4444';
        if (statusBadge) statusBadge.className = 'status-badge active';
      } else if (fps < 20) {
        statusEl.textContent = `🔥 KILLING - ${fps} FPS${escText} (${CONFIG.renderPasses}x passes)`;
        statusEl.style.color = '#f59e0b';
        if (statusBadge) statusBadge.className = 'status-badge crashed';
      } else {
        statusEl.textContent = `⚡ DESTROYING - ${fps} FPS${escText} (${CONFIG.renderPasses}x passes)`;
        statusEl.style.color = '#8b9bb5';
        if (statusBadge) statusBadge.className = 'status-badge active';
      }
    }

    if (btnSub) {
      btnSub.textContent = CONFIG.escalationLevel > 5 ? '🔥 UNSTOPPABLE MODE' : 
                           CONFIG.escalationLevel > 0 ? '⚡ Escalating...' : 
                           '🔥 Pushing limits';
    }

    if (window.gc) {
      try { window.gc(); } catch(e) {}
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
  CONFIG.escalationLevel = 0;
  consecutiveLowFps = 0;
  escalationTimer = 0;
  
  if (crashBtn) {
    crashBtn.className = 'crash-btn running';
    const icon = document.querySelector('.crash-btn .icon');
    if (icon) icon.textContent = '☠️';
    const label = document.getElementById('btnLabel');
    if (label) label.textContent = isLowEnd ? '🔥 MELTING SE...' : '💀 KILLING...';
    if (btnSub) btnSub.textContent = isLowEnd ? '🔥 20 passes torture' : '💀 Hold tight';
  }
  if (stopBtn) stopBtn.style.display = 'flex';

  if (statusEl) {
    statusEl.textContent = isLowEnd ? '🔥 SE TORTURE MODE (20 passes)' : '☠️ GPU MURDER INITIATED';
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

  // ─── START VISUAL CHAOS ──────────────────────────────────
  startVisualChaos();

  // ─── START GLITCHES ──────────────────────────────────────
  if (window.glitchSystem) {
    setTimeout(() => {
      window.glitchSystem.start();
    }, 1500);
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
    if (isLowEnd) {
      deviceBadge.textContent = '📱 SE MODE - UNSTOPPABLE';
    } else {
      const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
      deviceBadge.textContent = isIPhone ? '📱 IPHONE MODE - UNSTOPPABLE' : '💻 DESKTOP MODE';
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
        if (icon) icon.textContent = '⚡';
        const label = document.getElementById('btnLabel');
        if (label) label.textContent = 'Crash GPU';
        if (btnSub) btnSub.textContent = 'Click to initiate meltdown';
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
          if (icon) icon.textContent = '⚡';
          const label = document.getElementById('btnLabel');
          if (label) label.textContent = 'Crash GPU';
          if (btnSub) btnSub.textContent = 'Click to initiate meltdown';
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
    if (visualCanvas) {
      visualCanvas.width = window.innerWidth;
      visualCanvas.height = window.innerHeight;
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