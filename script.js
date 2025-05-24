// Helper to format numbers nicely
function fmt(n, d = 2) { return (+n).toFixed(d); }
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }
    const cloned = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}


// ----------- DOM Helper ---------------
const dom = id => document.getElementById(id);

// ----------- Global Parameters and State ---------------
let W = window.innerWidth, H = window.innerHeight;
let DPR = window.devicePixelRatio || 1;
const canvas = dom('orb-canvas');
const ctx = canvas.getContext('2d');

// Global View parameters
let cameraZoom = 1.0;
let rotY = 0, rotX = 0; // Main camera rotation
let globalAutoRotate = false;
let globalAutoRotateSpeed = 0.02;

// For drag rotation and pinch zoom
let isDragging = false, lastX, lastY, lastZoom = null, pinchStartDist = null, pinchMode = false;

// Orb data
let orbs = []; // Array to hold multiple orb objects
let currentOrbIndex = 0;
let nextOrbId = 1; // For unique IDs for evolution phases

// Default single orb parameters structure
const defaultOrbParamsTemplate = {
  id: 0, // Unique ID for each orb
  perspective: 0.5,
  dotCount: 2000,
  dotSize: 1,
  dotAlpha: 0.82,
  freqX: 4, freqY: 5, freqZ: 6,
  phaseX: 0, phaseY: 1, phaseZ: 2.6,
  amplX: 1, amplY: 1, amplZ: 1,
  patternSpeed: 0.2,
  trail: false,
  trailAlpha: 0.3,
  colorMode: 'rainbow',
  dotColor1: '#2cffba',
  dotColor2: '#22a7f7',
  // Orb-specific dot data, will be populated by buildDotsForOrb
  dotTheta: [],
  dotPhi: [],
  // Generative evolution params
  isEvolving: false,
  evolutionSpeed: 0.01,
  evolutionInitialPhaseSeed: 0, // Seed for evolution patterns
  evolveAmplitudes: false,
  evolveAppearance: false,
  evolveColors: false,
  evolvePerspective: false,
  // Add position properties to the default orb parameters
  positionX: 0,
  positionY: 0,
  // Coxeter pattern parameters
  patternType: 'lissajous', // 'lissajous', 'coxeter', 'weyl'
  coxeterGroup: 'A3',  // 'A3', 'B3', 'D4', 'F4', 'H3'
  coxeterSpeed: 0.2,
  coxeterAmplitude: 1.0,
  rootRotation: 0,
  // B3 (Cubic) parameters
  cubicVertexWeight: 0.5,
  cubicEdgeFlow: 1.0,
  // H3 (Icosahedral) parameters
  goldenRatioWeight: 1.618,
  icoVertexFlow: 1.0,
  icoFaceWeight: 0.5,
  // Bezier curve control points (Option B - global controls)
  bezierPathLength: 0.5,
  bezierCtrlOffsetScale: 0.5,
  bezierPathTwist: 0,
  bezierAnimSpeedScale: 1.0,
};

// List of all range/number input pairs for orb parameters
const orbPairedControls = [
  { base: 'perspective', digits: 2, type: 'number' },
  { base: 'dotCount', digits: 0, type: 'number' },
  { base: 'dotSize', digits: 0, type: 'number' },
  { base: 'dotAlpha', digits: 2, type: 'number' },
  { base: 'trailAlpha', digits: 2, type: 'number' },
  { base: 'freqX', digits: 1, type: 'number' },
  { base: 'freqY', digits: 1, type: 'number' },
  { base: 'freqZ', digits: 1, type: 'number' },
  { base: 'phaseX', digits: 2, type: 'number' },
  { base: 'phaseY', digits: 2, type: 'number' },
  { base: 'phaseZ', digits: 2, type: 'number' },
  { base: 'amplX', digits: 2, type: 'number' },
  { base: 'amplY', digits: 2, type: 'number' },
  { base: 'amplZ', digits: 2, type: 'number' },
  { base: 'patternSpeed', digits: 2, type: 'number' },
  // Evolution controls
  { base: 'orbEvolutionSpeed', digits: 3, type: 'number'},
  // Coxeter controls
  { base: 'coxeterSpeed', digits: 2, type: 'number' },
  { base: 'coxeterAmplitude', digits: 1, type: 'number' },
  { base: 'rootRotation', digits: 2, type: 'number' },
  // B3 (Cubic) controls
  { base: 'cubicVertexWeight', digits: 2, type: 'number' },
  { base: 'cubicEdgeFlow', digits: 2, type: 'number' },
  // H3 (Icosahedral) controls
  { base: 'goldenRatioWeight', digits: 2, type: 'number' },
  { base: 'icoVertexFlow', digits: 2, type: 'number' },
  { base: 'icoFaceWeight', digits: 2, type: 'number' },
  // Bezier controls (Option B - global controls)
  { base: 'bezierPathLength', digits: 2, type: 'number' },
  { base: 'bezierCtrlOffsetScale', digits: 2, type: 'number' },
  { base: 'bezierPathTwist', digits: 2, type: 'number' },
  { base: 'bezierAnimSpeedScale', digits: 1, type: 'number' }
];

const orbSingleControls = [ // For checkboxes, selects, colors for orbs
    { id: 'trailEffect', paramKey: 'trail', type: 'checkbox'},
    { id: 'colorMode', paramKey: 'colorMode', type: 'select'},
    { id: 'dotColor1', paramKey: 'dotColor1', type: 'color'},
    { id: 'dotColor2', paramKey: 'dotColor2', type: 'color'},
    { id: 'orbIsEvolving', paramKey: 'isEvolving', type: 'checkbox'},
    { id: 'evolveAmplitudes', paramKey: 'evolveAmplitudes', type: 'checkbox'},
    { id: 'evolveAppearance', paramKey: 'evolveAppearance', type: 'checkbox'},
    { id: 'evolveColors', paramKey: 'evolveColors', type: 'checkbox'},
    { id: 'evolvePerspective', paramKey: 'evolvePerspective', type: 'checkbox'},
    { id: 'patternType', paramKey: 'patternType', type: 'select'},
    { id: 'coxeterGroup', paramKey: 'coxeterGroup', type: 'select'},
];


// ----------- Sidebar logic and slider synchronization ---------------
function updateSliderDisplay(id, value, digits = 2) {
  const displayEl = dom(id + "Value");
  if (!displayEl) return; // For global controls that might not have a value display

  const numVal = parseFloat(value);
  if (isNaN(numVal)) {
    displayEl.textContent = value; // Should not happen for numeric sliders
    return;
  }

  // Specific formatting for certain controls
  if (id.endsWith("Speed") || id.startsWith("phase") || id.startsWith("ampl") || id === "perspective" || id === "dotAlpha" || id === "trailAlpha" || id === "orbEvolutionSpeed")
    displayEl.textContent = fmt(numVal, digits);
  else
    displayEl.textContent = Math.round(numVal); // Default to integer for others like dotCount
}


function setupGlobalControls() {
    dom('globalAutoRotate').checked = globalAutoRotate;
    dom('globalAutoRotateSpeed').value = globalAutoRotateSpeed;
    dom('globalAutoRotateSpeedNum').value = globalAutoRotateSpeed;
    updateSliderDisplay('globalAutoRotateSpeed', globalAutoRotateSpeed, 3);

    dom('globalAutoRotate').addEventListener('input', function() {
        globalAutoRotate = this.checked;
    });
    dom('globalAutoRotateSpeed').addEventListener('input', function() {
        globalAutoRotateSpeed = parseFloat(this.value);
        dom('globalAutoRotateSpeedNum').value = this.value;
        updateSliderDisplay('globalAutoRotateSpeed', this.value, 3);
    });
    dom('globalAutoRotateSpeedNum').addEventListener('input', function() {
        let val = parseFloat(this.value);
        if (isNaN(val)) val = parseFloat(dom('globalAutoRotateSpeed').min);
        val = Math.max(parseFloat(dom('globalAutoRotateSpeed').min), Math.min(parseFloat(dom('globalAutoRotateSpeed').max), val));
        dom('globalAutoRotateSpeed').value = val;
        this.value = val;
        globalAutoRotateSpeed = val;
        updateSliderDisplay('globalAutoRotateSpeed', val, 3);
    });
     dom('globalAutoRotateSpeedNum').addEventListener('blur', function() {
        let val = parseFloat(this.value);
        if (isNaN(val) || val < parseFloat(dom('globalAutoRotateSpeed').min)) val = parseFloat(dom('globalAutoRotateSpeed').min);
        if (val > parseFloat(dom('globalAutoRotateSpeed').max)) val = parseFloat(dom('globalAutoRotateSpeed').max);
        this.value = val;
        dom('globalAutoRotateSpeed').value = val;
        globalAutoRotateSpeed = val;
        updateSliderDisplay('globalAutoRotateSpeed', val, 3);
    });
}


function setupOrbControlsListeners() {
  orbPairedControls.forEach(({ base, digits }) => {
    const slider = dom(base);
    const numInput = dom(base + 'Num');

    if (!slider || !numInput) { // Not all paired controls have both (e.g. orbEvolutionSpeed might only have slider + num)
        if (slider) { // Slider only
            slider.addEventListener('input', function() {
                syncCurrentOrbParamsFromUI();
                if (base === 'dotCount') buildDotsForOrb(orbs[currentOrbIndex]);
                updateSliderDisplay(base, this.value, digits);
            });
        }
        return;
    }
    
    slider.addEventListener('input', function () {
      numInput.value = this.value;
      updateSliderDisplay(base, this.value, digits);
      syncCurrentOrbParamsFromUI();
      if (base === 'dotCount') {
        buildDotsForOrb(orbs[currentOrbIndex]);
      }
      // For other params like bezier, no need to call buildDotsForOrb on each change here
    });

    numInput.addEventListener('input', function () {
      let val = this.value;
      const min = parseFloat(slider.min);
      const max = parseFloat(slider.max);
      // Allow empty input temporarily for better UX, but cap at min/max on blur
      if (val !== "" && !isNaN(parseFloat(val))) {
        if (parseFloat(val) < min) val = min;
        if (parseFloat(val) > max) val = max;
      }
      slider.value = val; // Sync slider even if input is temporarily empty or out of bounds
      // this.value will be corrected on blur or if it becomes a valid number
      updateSliderDisplay(base, val, digits); // Display the current input value
      syncCurrentOrbParamsFromUI(); // Syncs the potentially temporary value
      if (base === 'dotCount' && val !== "" && !isNaN(parseFloat(val))) {
        buildDotsForOrb(orbs[currentOrbIndex], parseFloat(val));
      }
      // For other params like bezier, no need to call buildDotsForOrb on each change here
    });
    numInput.addEventListener('blur', function () {
        let val = this.value;
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        if (val === "" || isNaN(parseFloat(val)) || parseFloat(val) < min) val = min;
        if (parseFloat(val) > max) val = max;
        slider.value = val;
        this.value = val; // Correct the input field value
        updateSliderDisplay(base, val, digits);
        syncCurrentOrbParamsFromUI(); // Sync the corrected value
        if (base === 'dotCount') {
          buildDotsForOrb(orbs[currentOrbIndex], parseFloat(val));
        }
        // For other params like bezier, no need to call buildDotsForOrb on each change here
    });
  });

  orbSingleControls.forEach(({id}) => {
      if (dom(id)) {
          dom(id).addEventListener('input', syncCurrentOrbParamsFromUI);
      }
  });
   // Special listeners for orb controls
  dom("colorMode").addEventListener("change", function() { // This is an orbSingleControl, already handled
      dom("dotColor2").style.display = (this.value === "gradient") ? "" : "none";
      syncCurrentOrbParamsFromUI();
  });
  dom("trailEffect").addEventListener("change", function() { // This is an orbSingleControl, already handled
      dom("trailAlphaContainer").style.display = this.checked ? "" : "none";
      dom("trailIcon").className = this.checked ? "fas fa-wind" : "fas fa-slash";
      syncCurrentOrbParamsFromUI();
  });

  // Add event listeners for position sliders
  dom('positionX').addEventListener('input', function () {
    dom('positionXNum').value = this.value;
    orbs[currentOrbIndex].positionX = parseFloat(this.value);
    renderOrbs(); // Ensure the visualization updates
  });

  dom('positionXNum').addEventListener('input', function () {
    dom('positionX').value = this.value;
    orbs[currentOrbIndex].positionX = parseFloat(this.value);
    renderOrbs(); // Ensure the visualization updates
  });

  dom('positionY').addEventListener('input', function () {
    dom('positionYNum').value = this.value;
    orbs[currentOrbIndex].positionY = parseFloat(this.value);
    renderOrbs(); // Ensure the visualization updates
  });

  dom('positionYNum').addEventListener('input', function () {
    dom('positionY').value = this.value;
    orbs[currentOrbIndex].positionY = parseFloat(this.value);
    renderOrbs(); // Ensure the visualization updates
  });

  // Add Coxeter group control listeners
  dom('coxeterGroup').addEventListener('change', function() {
    orbs[currentOrbIndex].coxeterGroup = this.value;
    // Show/hide group-specific controls
    dom('b3Controls').style.display = this.value === 'B3' ? 'block' : 'none';
    dom('h3Controls').style.display = this.value === 'H3' ? 'block' : 'none';
    buildDotsForOrb(orbs[currentOrbIndex]);
  });

  // Add B3 (Cubic) control listeners
  ['cubicVertexWeight', 'cubicEdgeFlow'].forEach(param => {
    const slider = dom(param);
    const numInput = dom(param + 'Num');

    slider.addEventListener('input', function() {
      numInput.value = this.value;
      orbs[currentOrbIndex][param] = parseFloat(this.value);
      buildDotsForOrb(orbs[currentOrbIndex]);
    });

    numInput.addEventListener('input', function() {
      slider.value = this.value;
      orbs[currentOrbIndex][param] = parseFloat(this.value);
      buildDotsForOrb(orbs[currentOrbIndex]);
    });
  });

  // Add H3 (Icosahedral) control listeners
  ['goldenRatioWeight', 'icoVertexFlow', 'icoFaceWeight'].forEach(param => {
    const slider = dom(param);
    const numInput = dom(param + 'Num');

    slider.addEventListener('input', function() {
      numInput.value = this.value;
      orbs[currentOrbIndex][param] = parseFloat(this.value);
      buildDotsForOrb(orbs[currentOrbIndex]);
    });

    numInput.addEventListener('input', function() {
      slider.value = this.value;
      orbs[currentOrbIndex][param] = parseFloat(this.value);
      buildDotsForOrb(orbs[currentOrbIndex]);
    });
  });

  // Add pattern type control listener
  dom('patternType').addEventListener('change', function() {
    const newPatternType = this.value;

    if (newPatternType === 'bezier') {
        // Set pattern type on orb object *before* setTimeout, so updateUIForOrb (called later) knows about it.
        orbs[currentOrbIndex].patternType = newPatternType;

        ctx.save();
        ctx.clearRect(0, 0, W, H); // Clear canvas
        ctx.font = "bold 24px Roboto, sans-serif";
        ctx.fillStyle = "#FFFFFF"; // White text for visibility
        ctx.textAlign = "center";
        ctx.globalAlpha = 1.0; // Ensure full opacity
        ctx.fillText("Generating Bezier paths, please wait...", W / 2, H / 2);
        ctx.restore();

        setTimeout(() => {
            buildDotsForOrb(orbs[currentOrbIndex]);
            // updateUIForOrb will be called after this if/else block anyway,
            // ensuring the UI (sidebar) correctly reflects the state after build.
        }, 50); // 50ms delay to allow message to render
    } else {
        orbs[currentOrbIndex].patternType = newPatternType;
        // For Lissajous and Coxeter, buildDotsForOrb is relatively fast
        // and doesn't require a loading message with setTimeout.
        buildDotsForOrb(orbs[currentOrbIndex]);
    }
    
    // Update the sidebar controls to show/hide the correct sections for the new pattern type.
    // This also handles setting specific control values like coxeterGroup if applicable.
    updateUIForOrb(orbs[currentOrbIndex]);
  });

  // Add Coxeter group control listeners
  dom('coxeterGroup').addEventListener('change', function() {
    orbs[currentOrbIndex].coxeterGroup = this.value;
    // Show/hide group-specific controls
    dom('b3Controls').style.display = this.value === 'B3' ? 'block' : 'none';
    dom('h3Controls').style.display = this.value === 'H3' ? 'block' : 'none';
    buildDotsForOrb(orbs[currentOrbIndex]);
  });

  // Add B3 (Cubic) control listeners
  ['cubicVertexWeight', 'cubicEdgeFlow'].forEach(param => {
    const slider = dom(param);
    const numInput = dom(param + 'Num');

    slider.addEventListener('input', function() {
      numInput.value = this.value;
      orbs[currentOrbIndex][param] = parseFloat(this.value);
      buildDotsForOrb(orbs[currentOrbIndex]);
    });

    numInput.addEventListener('input', function() {
      slider.value = this.value;
      orbs[currentOrbIndex][param] = parseFloat(this.value);
      buildDotsForOrb(orbs[currentOrbIndex]);
    });
  });

  // Add H3 (Icosahedral) control listeners
  ['goldenRatioWeight', 'icoVertexFlow', 'icoFaceWeight'].forEach(param => {
    const slider = dom(param);
    const numInput = dom(param + 'Num');

    slider.addEventListener('input', function() {
      numInput.value = this.value;
      orbs[currentOrbIndex][param] = parseFloat(this.value);
      buildDotsForOrb(orbs[currentOrbIndex]);
    });

    numInput.addEventListener('input', function() {
      slider.value = this.value;
      orbs[currentOrbIndex][param] = parseFloat(this.value);
      buildDotsForOrb(orbs[currentOrbIndex]);
    });
  });
}

// Ensure position properties are part of the default orb parameters
defaultOrbParamsTemplate.positionX = 0;
defaultOrbParamsTemplate.positionY = 0;

// Sync current orb's params from UI
function syncCurrentOrbParamsFromUI() {
  if (!orbs[currentOrbIndex]) return;
  const currentOrb = orbs[currentOrbIndex];

  orbPairedControls.forEach(({ base, type }) => {
    const el = dom(base);
    if(el) { // Check if element exists (orbEvolutionSpeed doesn't have a Value display)
        const value = el.value;
        if (currentOrb.hasOwnProperty(base)) { // Make sure param exists on orb object
            currentOrb[base] = (type === 'number' || el.type === 'range' || el.type === 'number') ? parseFloat(value) : value;
        } else if (base === 'orbEvolutionSpeed' ) { // Special case for evolution speed
            currentOrb.evolutionSpeed = parseFloat(value);
        }
    }
  });
  orbSingleControls.forEach(({id, paramKey, type}) => {
    const el = dom(id);
    if (el) {
        if (type === 'checkbox') {
            currentOrb[paramKey] = el.checked;
        } else {
            currentOrb[paramKey] = el.value;
        }
    }
  });
  // Specific handling for evolution params not directly in orbPairedControls
  currentOrb.isEvolving = dom('orbIsEvolving').checked;
  currentOrb.evolutionSpeed = parseFloat(dom('orbEvolutionSpeed').value);

  // Update header for current orb
  updateSidebarOrbHeaders();
}

// Update UI controls to match the current orb's parameters
function updateUIForOrb(orbInstance) {
    if (!orbInstance) return;

    // Update all paired controls
    orbPairedControls.forEach(({ base, digits }) => {
        const elSlider = dom(base);
        const elNum = dom(base + 'Num');
        let valueToSet;

        if (orbInstance.hasOwnProperty(base)) {
            valueToSet = orbInstance[base];
        } else if (base === 'orbEvolutionSpeed' && orbInstance.hasOwnProperty('evolutionSpeed')) {
            valueToSet = orbInstance.evolutionSpeed;
        } else {
            return; // Parameter not found in orbInstance
        }
        
        if (elSlider) elSlider.value = valueToSet;
        if (elNum) elNum.value = valueToSet;
        updateSliderDisplay(base, valueToSet, digits);
    });

    // Update single controls
    orbSingleControls.forEach(({ id, paramKey, type }) => {
        const el = dom(id);
        if (el && orbInstance.hasOwnProperty(paramKey)) {
            if (type === 'checkbox') {
                el.checked = orbInstance[paramKey];
            } else {
                el.value = orbInstance[paramKey];
            }
        }
    });
    
    // Specific UI updates based on loaded orb params
    dom("dotColor2").style.display = (orbInstance.colorMode === "gradient") ? "" : "none";
    dom("trailAlphaContainer").style.display = orbInstance.trail ? "" : "none";
    dom("trailIcon").className = orbInstance.trail ? "fas fa-wind" : "fas fa-slash";
    
    // Update evolution controls
    dom('orbIsEvolving').checked = orbInstance.isEvolving;
    dom('orbEvolutionSpeed').value = orbInstance.evolutionSpeed;
    dom('orbEvolutionSpeedNum').value = orbInstance.evolutionSpeed;
    updateSliderDisplay('orbEvolutionSpeed', orbInstance.evolutionSpeed, 3);

    // Update position controls
    dom('positionX').value = orbInstance.positionX;
    dom('positionXNum').value = orbInstance.positionX;
    dom('positionY').value = orbInstance.positionY;
    dom('positionYNum').value = orbInstance.positionY;

    // Update pattern type and related controls
    if (orbInstance.patternType) {
        dom('patternType').value = orbInstance.patternType;
        const patternType = orbInstance.patternType;

        dom('lissajousControls').style.display = patternType === 'lissajous' ? 'block' : 'none';
        dom('coxeterControls').style.display = patternType === 'coxeter' ? 'block' : 'none';
        dom('bezierControls').style.display = patternType === 'bezier' ? 'block' : 'none';

        if (patternType === 'coxeter') {
            const group = orbInstance.coxeterGroup || 'A3';
            dom('coxeterGroup').value = group;
            dom('b3Controls').style.display = group === 'B3' ? 'block' : 'none';
            dom('h3Controls').style.display = group === 'H3' ? 'block' : 'none';

            // Set Coxeter control values if they exist
            const coxeterControls = [
                { key: 'coxeterSpeed', default: 0.2 },
                { key: 'coxeterAmplitude', default: 1.0 },
                { key: 'rootRotation', default: 0 },
                { key: 'cubicVertexWeight', default: 0.5 },
                { key: 'cubicEdgeFlow', default: 1.0 },
                { key: 'goldenRatioWeight', default: 1.618 },
                { key: 'icoVertexFlow', default: 1.0 },
                { key: 'icoFaceWeight', default: 0.5 }
            ];

            coxeterControls.forEach(({ key, default: defaultValue }) => {
                const value = orbInstance[key] || defaultValue;
                const slider = dom(key);
                const numInput = dom(key + 'Num');
                if (slider) slider.value = value;
                if (numInput) numInput.value = value;
            });
        }
    }
    
    // Update header for current orb
    updateSidebarOrbHeaders();
}


// Sidebar show/hide
const sidebar = dom('sidebar');
dom('toggleSidebarBtn').addEventListener('click', () => {
  sidebar.style.display = (sidebar.style.display === "none" || sidebar.classList.contains("hidden")) ? "" : "none";
  sidebar.classList.toggle("hidden");
});
if (window.innerWidth < 700 || (window.matchMedia && window.matchMedia("(pointer:coarse)").matches)) {
  sidebar.style.display = "none";
  sidebar.classList.add('hidden');
}

// ------------ ORB VISUALIZATION -----------------------------
function resizeCanvas() {
  W = window.innerWidth; H = window.innerHeight;
  DPR = window.devicePixelRatio || 1;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(DPR, DPR);
}
window.addEventListener('resize', resizeCanvas, { passive: true });

function resetView() {
  rotX = 0; rotY = 0; cameraZoom = 1.0;
  // Reset only the rotation speed, maintain current auto-rotate state
  globalAutoRotateSpeed = 0.027;
  dom('globalAutoRotateSpeed').value = globalAutoRotateSpeed;
  dom('globalAutoRotateSpeedNum').value = globalAutoRotateSpeed;
  updateSliderDisplay('globalAutoRotateSpeed', globalAutoRotateSpeed, 3);
}
dom('resetView').addEventListener('click', resetView);

// Touch/mouse handlers (remain the same)
canvas.addEventListener('pointerdown', function (e) {
  if (e.pointerType === "touch") {
    if (e.touches && e.touches.length === 2) {
      pinchMode = true; pinchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); lastZoom = cameraZoom;
    } else { isDragging = true; lastX = (e.touches ? e.touches[0].clientX : e.clientX); lastY = (e.touches ? e.touches[0].clientY : e.clientY); }
  } else { isDragging = true; lastX = e.clientX; lastY = e.clientY; }
}, { passive: false });
canvas.addEventListener('pointermove', function (e) {
  if (pinchMode && e.touches && e.touches.length === 2) {
    let dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    cameraZoom = Math.max(0.35, Math.min(3.5, lastZoom * dist / pinchStartDist)); return;
  }
  if (!isDragging) return;
  const x = e.touches ? e.touches[0].clientX : e.clientX; const y = e.touches ? e.touches[0].clientY : e.clientY;
  let dx = (x - lastX) / W * 2, dy = (y - lastY) / H * 2;
  rotY += dx * Math.PI * 1.06; rotX += dy * Math.PI * 0.9;
  rotX = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, rotX));
  lastX = x; lastY = y;
}, { passive: false });
canvas.addEventListener('pointerup', function () { isDragging = false; pinchMode = false; }, { passive: false });
canvas.addEventListener('pointercancel', function () { isDragging = false; pinchMode = false; }, { passive: false });
canvas.addEventListener('wheel', function (e) {
  cameraZoom -= 0.17 * e.deltaY / Math.max(W, H); cameraZoom = Math.max(0.35, Math.min(3.5, cameraZoom)); e.preventDefault();
}, { passive: false });
window.addEventListener('touchstart', function (e) {
  if (e.targetTouches[0].clientX < 28 && (sidebar.style.display === "none" || sidebar.classList.contains("hidden"))) {
    sidebar.style.display = ""; sidebar.classList.remove("hidden");
  }
}, { passive: true });

// -------- Orb Data and Animation ----------
function hexToRgbObj(hex) { hex=hex.replace("#",""); if(hex.length==3) hex = hex.split("").map(x=>x+x).join(""); let v = parseInt(hex,16); return {r:(v>>16)&255,g:(v>>8)&255,b:v&255}; }
function rgbToHex(rgb) {
    return "#" + ((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1).padStart(6, '0');
}
function rgbToHsv(rgb) {
    let r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    let d = max - min;
    s = max == 0 ? 0 : d / max;
    if (max == min) {
        h = 0; // achromatic
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h, s: s, v: v };
}
function lerpColor(c1, c2, t) { /* ... (same as before) ... */ return {r:Math.round(c1.r+(c2.r-c1.r)*t),g:Math.round(c1.g+(c2.g-c1.g)*t),b:Math.round(c1.b+(c2.b-c1.b)*t)};}
function rgbObjToString(c, a = 1) { /* ... (same as before) ... */ return `rgba(${c.r},${c.g},${c.b},${+a})`;}
function hsvToRgb(h, s, v) { /* ... (same as before) ... */ let f=(n,k=(n+h*6)%6)=>v-v*s*Math.max(Math.min(k,4-k,1),0);return{r:Math.round(f(5)*255),g:Math.round(f(3)*255),b:Math.round(f(1)*255)};}

// Calculate a point on a cubic Bezier curve
function calculateCubicBezierPoint(p0, p1, p2, p3, t) {
  const omt = 1 - t; // one minus t
  const omt3 = omt * omt * omt;       // (1-t)^3
  const omt2t = omt * omt * t * 3;  // 3*(1-t)^2*t
  const omtt2 = omt * t * t * 3;    // 3*(1-t)*t^2
  const t3 = t * t * t;             // t^3

  const x = omt3 * p0.x + omt2t * p1.x + omtt2 * p2.x + t3 * p3.x;
  const y = omt3 * p0.y + omt2t * p1.y + omtt2 * p2.y + t3 * p3.y;
  const z = omt3 * p0.z + omt2t * p1.z + omtt2 * p2.z + t3 * p3.z;

  return { x: x, y: y, z: z };
}

// --- Vector Helper Functions ---
function vAdd(v1, v2) { return { x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z }; }
function vSub(v1, v2) { return { x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z }; }
function vScale(v, s) { return { x: v.x * s, y: v.y * s, z: v.z * s }; }
function vLength(v) { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
function vNormalize(v) { const l = vLength(v); return l > 0 ? vScale(v, 1 / l) : {x:0,y:0,z:0}; }
function vCross(v1, v2) {
    return {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
    };
}
// Rodrigues' rotation formula: rotates vector v around axis k by angle theta
function vRotate(v, k, theta) {
    k = vNormalize(k);
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const vDotK = v.x * k.x + v.y * k.y + v.z * k.z; // Dot product

    const vRot_x = v.x * cosTheta + (k.y * v.z - k.z * v.y) * sinTheta + k.x * vDotK * (1 - cosTheta);
    const vRot_y = v.y * cosTheta + (k.z * v.x - k.x * v.z) * sinTheta + k.y * vDotK * (1 - cosTheta);
    const vRot_z = v.z * cosTheta + (k.x * v.y - k.y * v.x) * sinTheta + k.z * vDotK * (1 - cosTheta);
    return { x: vRot_x, y: vRot_y, z: vRot_z };
}
// --- End Vector Helper Functions ---

// Root system generators for different Coxeter groups
function generateRootSystem(group, n = 1000) {
    const roots = [];
    
    // Helper function to normalize a point to the unit sphere
    const normalize = (point) => {
        const length = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
        return {
            x: point.x / length,
            y: point.y / length,
            z: point.z / length
        };
    };

    // Helper for spherical fibonacci distribution
    const fibonacciSphere = (samples, jitter = 0) => {
        const points = [];
        const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle in radians
        
        for (let i = 0; i < samples; i++) {
            const y = 1 - (i / (samples - 1)) * 2; // y goes from 1 to -1
            const radius = Math.sqrt(1 - y * y); // radius at y
            const theta = phi * i; // golden angle increment
            
            // Add some controlled randomness if jitter > 0
            const randTheta = theta + (jitter * (Math.random() - 0.5));
            const randY = y + (jitter * (Math.random() - 0.5) * 0.1);
            
            points.push({
                x: Math.cos(randTheta) * radius,
                y: randY,
                z: Math.sin(randTheta) * radius
            });
        }
        return points.map(normalize);
    };

    // Helper for cube face point distribution
    const generateCubeFacePoints = (n, vertexWeight, edgeFlow) => {
        const points = [];
        const faces = [
            { center: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, right: { x: 0, y: 0, z: 1 } },
            { center: { x: -1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, right: { x: 0, y: 0, z: -1 } },
            { center: { x: 0, y: 1, z: 0 }, up: { x: 0, y: 0, z: 1 }, right: { x: 1, y: 0, z: 0 } },
            { center: { x: 0, y: -1, z: 0 }, up: { x: 0, y: 0, z: 1 }, right: { x: -1, y: 0, z: 0 } },
            { center: { x: 0, y: 0, z: 1 }, up: { x: 0, y: 1, z: 0 }, right: { x: -1, y: 0, z: 0 } },
            { center: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 }, right: { x: 1, y: 0, z: 0 } }
        ];

        const pointsPerFace = Math.floor(n / 6);
        const sqrtPoints = Math.ceil(Math.sqrt(pointsPerFace));

        faces.forEach(face => {
            for (let i = 0; i < sqrtPoints; i++) {
                for (let j = 0; j < sqrtPoints; j++) {
                    if (points.length >= n) return;

                    const u = (i + 0.5) / sqrtPoints * 2 - 1;
                    const v = (j + 0.5) / sqrtPoints * 2 - 1;
                    
                    // Add some controlled randomness for better distribution
                    const randU = u + (Math.random() - 0.5) * 0.1;
                    const randV = v + (Math.random() - 0.5) * 0.1;

                    const point = {
                        x: face.center.x + randU * face.right.x + randV * face.up.x,
                        y: face.center.y + randU * face.right.y + randV * face.up.y,
                        z: face.center.z + randU * face.right.z + randV * face.up.z
                    };

                    // Apply vertex weight and edge flow
                    const weightedPoint = normalize(point);
                    const edgeInfluence = Math.pow(Math.max(Math.abs(u), Math.abs(v)), edgeFlow);
                    const finalPoint = {
                        x: weightedPoint.x * (1 - vertexWeight) + point.x * vertexWeight * edgeInfluence,
                        y: weightedPoint.y * (1 - vertexWeight) + point.y * vertexWeight * edgeInfluence,
                        z: weightedPoint.z * (1 - vertexWeight) + point.z * vertexWeight * edgeInfluence
                    };

                    points.push(normalize(finalPoint));
                }
            }
        });
        return points;
    };
    
    switch(group) {
        case 'A3': // A3 group (tetrahedral symmetries)
            // Use fibonacci sphere distribution with slight jitter for more natural look
            return fibonacciSphere(n, 0.1);
            
        case 'B3': // B3 group (cubic symmetries)
            const orbInstance = orbs[currentOrbIndex];
            const vertexWeight = orbInstance.cubicVertexWeight || 0.5;
            const edgeFlow = orbInstance.cubicEdgeFlow || 1.0;
            
            return generateCubeFacePoints(n, vertexWeight, edgeFlow);
            
        case 'H3': // H3 group (icosahedral symmetries)
            const orb = orbs[currentOrbIndex];
            const phi = (1 + Math.sqrt(5)) / 2 * (orb.goldenRatioWeight || 1.618);
            const vertexFlow = orb.icoVertexFlow || 1.0;
            const faceWeight = orb.icoFaceWeight || 0.5;

            // Generate icosahedron vertices
            const vertices = [];
            for (let i = 0; i < 12; i++) {
                const isUpper = i < 6;
                const t = (i % 6) * Math.PI * 2 / 5;
                const r = isUpper ? 1 : phi;
                const y = isUpper ? phi : 1/phi;
                vertices.push(normalize({
                    x: Math.cos(t) * r,
                    y: y,
                    z: Math.sin(t) * r
                }));
            }

            // Use fibonacci sphere as base distribution
            const basePoints = fibonacciSphere(n, 0.05);
            
            // Transform points based on icosahedral symmetry
            return basePoints.map(point => {
                // Find nearest vertices
                const distances = vertices.map(v => 
                    Math.sqrt((v.x - point.x) ** 2 + (v.y - point.y) ** 2 + (v.z - point.z) ** 2)
                );
                const nearest = vertices[distances.indexOf(Math.min(...distances))];
                
                // Apply vertex flow and face weight
                const morphed = {
                    x: point.x * (1 - vertexFlow) + nearest.x * vertexFlow,
                    y: point.y * (1 - vertexFlow) + nearest.y * vertexFlow,
                    z: point.z * (1 - vertexFlow) + nearest.z * vertexFlow
                };
                
                return normalize({
                    x: morphed.x * (1 - faceWeight) + point.x * faceWeight,
                    y: morphed.y * (1 - faceWeight) + point.y * faceWeight,
                    z: morphed.z * (1 - faceWeight) + point.z * faceWeight
                });
            });
            
        default:
            return fibonacciSphere(n, 0.1); // Default to A3 with slight jitter
    }
}

// Modified buildDotsForOrb to support Coxeter patterns
function buildDotsForOrb(orbInstance, numDots) {
  const n = numDots || orbInstance.dotCount;
  orbInstance.dotCount = n;
  orbInstance.dotTheta = [];
  orbInstance.dotPhi = [];
  // Initialize arrays for Bezier control points if they don't exist
  orbInstance.dotP0 = [];
  orbInstance.dotP1 = [];
  orbInstance.dotP2 = [];
  orbInstance.dotP3 = [];
  
  if (orbInstance.patternType === 'coxeter') {
      // Generate root system based on selected Coxeter group
      const roots = generateRootSystem(orbInstance.coxeterGroup, n);
      roots.forEach(root => {
          orbInstance.dotTheta.push(Math.acos(root.z));
          orbInstance.dotPhi.push(Math.atan2(root.y, root.x));
      });
  } else if (orbInstance.patternType === 'bezier') {
      // 1. Populate dotTheta, dotPhi using Fibonacci sphere first
      const ga_bezier = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
          let yPos = 1 - (i / (n - 1)) * 2;
          let radius = Math.sqrt(1 - yPos * yPos);
          let phi_angle = ga_bezier * i;
          orbInstance.dotTheta.push(Math.acos(yPos));
          orbInstance.dotPhi.push(phi_angle % (2 * Math.PI));
      }

      // 2. Loop to calculate P0, P1, P2, P3 for each dot
      for (let j = 0; j < n; j++) {
          const theta = orbInstance.dotTheta[j];
          const phi = orbInstance.dotPhi[j];
          const P0 = { 
              x: Math.sin(theta) * Math.cos(phi), 
              y: Math.cos(theta), 
              z: Math.sin(theta) * Math.sin(phi) 
          };
          orbInstance.dotP0.push(P0);

          const P3 = vScale(P0, 1 + orbInstance.bezierPathLength);
          const pathDir = vNormalize(P0); // P0 is on unit sphere

          let up = { x: 0, y: 1, z: 0 };
          if (Math.abs(pathDir.y) > 0.99) {
              up = { x: 1, y: 0, z: 0 };
          }

          let tangent1 = vNormalize(vCross(pathDir, up));
          if (orbInstance.bezierPathTwist !== 0) {
              tangent1 = vRotate(tangent1, pathDir, orbInstance.bezierPathTwist);
          }
          
          const offsetVector = vScale(tangent1, orbInstance.bezierCtrlOffsetScale);

          const P1_onPath = vAdd(P0, vScale(pathDir, orbInstance.bezierPathLength * 0.33));
          const P1 = vAdd(P1_onPath, offsetVector);

          const P2_onPath = vAdd(P0, vScale(pathDir, orbInstance.bezierPathLength * 0.66));
          const P2 = vAdd(P2_onPath, vScale(offsetVector, -1.0));
          
          orbInstance.dotP1.push(P1);
          orbInstance.dotP2.push(P2);
          orbInstance.dotP3.push(P3);
      }
      // Clear dotTheta and dotPhi as their info is now in P0 (and indirectly P1,P2,P3)
      orbInstance.dotTheta = [];
      orbInstance.dotPhi = [];
  } else {
      // Original Lissajous pattern generation (default)
      const ga = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
          let yPos = 1 - (i / (n - 1)) * 2;
          let radius = Math.sqrt(1 - yPos * yPos);
          let phi = ga * i;
          orbInstance.dotTheta.push(Math.acos(yPos));
          orbInstance.dotPhi.push(phi % (2 * Math.PI));
      }
  }
}

// Animation
let t = 0, FPS = 60;
function animate(timestamp) {
  // Clear background or apply trail effect globally
  const globalTrailOrb = orbs.find(orb => orb.trail); // Simplistic: if any orb has trail, apply global trail
  if (globalTrailOrb) {
    ctx.globalAlpha = globalTrailOrb.trailAlpha; // Use the first found trail alpha
    ctx.fillStyle = "#181c25";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1.0;
  } else {
    ctx.clearRect(0, 0, W, H);
  }

  orbs.forEach((orb, index) => {
    if (orb.isEvolving) {
        const speed = orb.evolutionSpeed;
        const timeScaled = t * speed * 10; // Scale time for more noticeable changes
        const seed = orb.evolutionInitialPhaseSeed || orb.id;

        // Always evolve frequencies (example: sinusoidal)
        orb.freqX = 50 + Math.sin(timeScaled * 0.3 + seed) * 49;
        orb.freqY = 50 + Math.cos(timeScaled * 0.35 + seed * 1.2) * 49;
        orb.freqZ = 50 + Math.sin(timeScaled * 0.4 + seed * 1.5) * 49;
        orb.freqX = Math.max(parseFloat(dom('freqX').min), Math.min(parseFloat(dom('freqX').max), orb.freqX));
        orb.freqY = Math.max(parseFloat(dom('freqY').min), Math.min(parseFloat(dom('freqY').max), orb.freqY));
        orb.freqZ = Math.max(parseFloat(dom('freqZ').min), Math.min(parseFloat(dom('freqZ').max), orb.freqZ));
        
        // Always evolve phases
        orb.phaseX = (orb.phaseX + speed * 0.5 + Math.sin(timeScaled * 0.1 + seed) * speed * 0.2) % (2 * Math.PI);
        orb.phaseY = (orb.phaseY + speed * 0.6 + Math.cos(timeScaled * 0.12 + seed * 1.1) * speed * 0.2) % (2 * Math.PI);
        orb.phaseZ = (orb.phaseZ + speed * 0.7 + Math.sin(timeScaled * 0.15 + seed * 1.3) * speed * 0.2) % (2 * Math.PI);

        if (orb.evolveAmplitudes) {
            orb.amplX = 1.0 + Math.sin(timeScaled * 0.2 + seed * 2.0) * 0.45;
            orb.amplY = 1.0 + Math.cos(timeScaled * 0.22 + seed * 2.2) * 0.45;
            orb.amplZ = 1.0 + Math.sin(timeScaled * 0.25 + seed * 2.5) * 0.45;
            orb.amplX = Math.max(parseFloat(dom('amplX').min), Math.min(parseFloat(dom('amplX').max), orb.amplX));
            orb.amplY = Math.max(parseFloat(dom('amplY').min), Math.min(parseFloat(dom('amplY').max), orb.amplY));
            orb.amplZ = Math.max(parseFloat(dom('amplZ').min), Math.min(parseFloat(dom('amplZ').max), orb.amplZ));
        }

        if (orb.evolveAppearance) {
            orb.dotSize = 10 + Math.sin(timeScaled * 0.15 + seed * 3.0) * 9;
            orb.dotAlpha = 0.5 + Math.cos(timeScaled * 0.18 + seed * 3.3) * 0.49;
            orb.dotSize = Math.max(parseFloat(dom('dotSize').min), Math.min(parseFloat(dom('dotSize').max), Math.round(orb.dotSize)));
            orb.dotAlpha = Math.max(parseFloat(dom('dotAlpha').min), Math.min(parseFloat(dom('dotAlpha').max), orb.dotAlpha));
        }

        if (orb.evolveColors) {
            // Simple hue shift for dotColor1
            let hsv = rgbToHsv(hexToRgbObj(orb.dotColor1));
            hsv.h = (hsv.h + speed * 0.002) % 1;
            orb.dotColor1 = rgbToHex(hsvToRgb(hsv.h, hsv.s, hsv.v));
            // Could also evolve dotColor2 or colorMode here
        }

        if (orb.evolvePerspective) {
            orb.perspective = 2.65 + Math.sin(timeScaled * 0.1 + seed * 4.0) * 1.55;
            orb.perspective = Math.max(parseFloat(dom('perspective').min), Math.min(parseFloat(dom('perspective').max), orb.perspective));
        }

        if (index === currentOrbIndex) { // Update UI only for the currently selected evolving orb
            updateUIForOrb(orb); // This can be performance heavy, consider targeted updates
        }
    }

    // Per-orb rendering
    let orbR = Math.min(W, H) * 0.35 * cameraZoom / orb.perspective;
    let cx = W / 2, cy = H / 2;
    let cameraDist = orb.perspective * 1.08; // Use orb's perspective
    let perspectiveD = cameraDist / cameraZoom;
    
    let c1 = hexToRgbObj(orb.dotColor1), c2 = hexToRgbObj(orb.dotColor2);

    // Apply position offsets to the orb's center
    let orbCenterX = cx + orb.positionX;
    let orbCenterY = cy + orb.positionY;

    for (let i = 0; i < orb.dotCount; i++) {
      // Updated Safety Check
      if (orb.patternType === 'bezier') {
        if (i >= orb.dotP0.length) break; // Check against dotP0 for Bezier
      } else {
        if (i >= orb.dotTheta.length) break; // Original check for Lissajous/Coxeter
      }

      let currentPatternSpeed = orb.patternType === 'coxeter' ? orb.coxeterSpeed : orb.patternSpeed; // Lissajous and Bezier use orb.patternSpeed
      let phase = t * currentPatternSpeed; // Used by Lissajous and Coxeter, and for Bezier t_dot
      let x, y, z; // These will be the coordinates before global rotation and projection

      if (orb.patternType === 'bezier') {
          const p0 = orb.dotP0[i];
          const p1 = orb.dotP1[i];
          const p2 = orb.dotP2[i];
          const p3 = orb.dotP3[i];

          if (!p0 || !p1 || !p2 || !p3) continue; // Safety check for per-dot control points

          const effectiveSpeed = orb.patternSpeed * orb.bezierAnimSpeedScale;
          const timeParamForDot = ( (t * effectiveSpeed) + ( (i / Math.max(1, orb.dotCount)) * Math.PI * 2 ) ) % 1.0;
          
          
          const currentPos = calculateCubicBezierPoint(p0, p1, p2, p3, timeParamForDot);
          
          x = currentPos.x;
          y = currentPos.y;
          z = currentPos.z;
          // No explicit / 250.0 scaling here, as P0-P3 are already defined in a relative space.
      } else if (orb.patternType === 'coxeter') {
        const baseTheta = orb.dotTheta[i];
        const basePhi = orb.dotPhi[i];
        
        // Convert from spherical to cartesian coordinates
        let cx_ = Math.sin(baseTheta) * Math.cos(basePhi);
        let cy_ = Math.sin(baseTheta) * Math.sin(basePhi);
        let cz_ = Math.cos(baseTheta);
        
        // Apply rotations while maintaining the unit sphere constraint
        const rotX_cox = phase * 0.5; // Renamed to avoid conflict with global rotX
        const rotY_cox = phase * 0.7; // Renamed to avoid conflict with global rotY
        const rotZ_cox = phase * 0.3 + orb.rootRotation;
        
        // Apply rotations in sequence
        let point = rotatePoint(cx_, cy_, cz_, rotX_cox, 'x');
        point = rotatePoint(point.x, point.y, point.z, rotY_cox, 'y');
        point = rotatePoint(point.x, point.y, point.z, rotZ_cox, 'z');
        
        // Scale by amplitude
        x = point.x * orb.coxeterAmplitude;
        y = point.y * orb.coxeterAmplitude;
        z = point.z * orb.coxeterAmplitude;
      } else { // Default to Lissajous
        let theta_liss = (orb.amplX * Math.acos(Math.cos(orb.dotTheta[i] * orb.freqX + orb.phaseX + phase)));
        let phi_liss = (orb.freqY * orb.dotPhi[i] + orb.phaseY + phase + orb.amplY * Math.sin(orb.dotTheta[i] * orb.freqZ + orb.phaseZ + phase));
        
        let sinTh = Math.sin(theta_liss), cosTh = Math.cos(theta_liss);
        let sinPh = Math.sin(phi_liss), cosPh = Math.cos(phi_liss);
        x = sinTh * cosPh;
        y = sinTh * sinPh;
        z = cosTh * orb.amplZ; 
      }
      
      // Apply global camera rotation
      let x1=x, y1=y, z1=z; // x,y,z are now from the correct pattern
      let x2 = Math.cos(rotY)*x1 + Math.sin(rotY)*z1;
      let z2 =-Math.sin(rotY)*x1 + Math.cos(rotY)*z1;
      let y2 = Math.cos(rotX)*y1 - Math.sin(rotX)*z2;
      let z3 = Math.sin(rotX)*y1 + Math.cos(rotX)*z2;
      
      let scale = perspectiveD / (cameraDist - z3 + 1.3);
      let px = orbCenterX + x2 * orbR * scale;
      let py = orbCenterY + y2 * orbR * scale;
      
      let color;
      if(orb.colorMode==="solid") color = rgbObjToString(c1, orb.dotAlpha);
      else if(orb.colorMode==="gradient") {
        let tval = (i/(orb.dotCount-1)); color = rgbObjToString( lerpColor(c1, c2, tval), orb.dotAlpha );
      } else { // Rainbow
        let h = (i/orb.dotCount + t*orb.patternSpeed/33.0)%1; let rgb = hsvToRgb(h,0.70,1.0); color = rgbObjToString(rgb,orb.dotAlpha);
      }
      ctx.beginPath(); ctx.arc(px,py,orb.dotSize,0,2*Math.PI); ctx.fillStyle = color;
      ctx.shadowColor = color; ctx.shadowBlur = (orb.dotSize>6)?2+orb.dotSize*0.35:0;
      ctx.fill(); ctx.shadowBlur = 0;
    }

    // Orb outline (simplified, uses first orb's perspective for now or needs to be drawn per orb)
    if (index === 0 && orb.perspective > 1.25 && cameraZoom < 1.8) { // Example: draw for first orb only
        ctx.save(); ctx.globalAlpha=0.42; ctx.beginPath(); ctx.arc(cx,cy,orbR*0.97,0,2*Math.PI);
        let grad=ctx.createRadialGradient(cx,cy,1, cx,cy, orbR*1.07);
        grad.addColorStop(0,"#34f1b64a"); grad.addColorStop(1,"#191e2f22");
        ctx.strokeStyle=grad; ctx.lineWidth= Math.max(1, orb.dotSize*1.2); ctx.stroke(); ctx.restore();
    }
  }); // End forEach orb

  // Loading message (global, based on total dots perhaps)
  const totalDots = orbs.reduce((sum, orb) => sum + orb.dotCount, 0);
  if (totalDots > 9000 && (timestamp % 3000) < 320) {
    ctx.save(); ctx.globalAlpha=0.88; ctx.fillStyle="#161928cc"; ctx.fillRect(W/2-101,H/2-22,202,44);
    ctx.font="bold 17px Roboto,sans-serif"; ctx.fillStyle = "#a2fbdc"; ctx.textAlign="center";
    ctx.fillText("Rendering thousands of dots...",W/2,H/2+8); ctx.restore();
  }

  if (globalAutoRotate) {
    rotY += globalAutoRotateSpeed;
    if (rotY > Math.PI * 2) rotY -= (Math.PI * 2);
  }
  t += 1 / FPS;
  requestAnimationFrame(animate);
}


// ----------- Orb Management UI and Logic ---------------
const currentOrbSelector = dom('currentOrbSelector');
const orbControlsHeader = dom('orbControlsHeader');
const lissajousPatternHeader = dom('lissajousPatternHeader');
const generativeModeHeader = dom('generativeModeHeader');


function addNewOrb(paramsToClone = null) {
    const newOrb = deepClone(paramsToClone || defaultOrbParamsTemplate);
    newOrb.id = nextOrbId++;
    newOrb.evolutionInitialPhaseSeed = Math.random() * 100; // For varied evolution patterns
    if (!paramsToClone) { // If using default template, ensure colors are distinct if possible or random
        newOrb.dotColor1 = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
    }
    buildDotsForOrb(newOrb);
    orbs.push(newOrb);
    currentOrbIndex = orbs.length - 1;
    updateOrbSelector();
    updateUIForOrb(newOrb);
    updateSidebarOrbHeaders();
}

function duplicateCurrentOrb() {
    if (orbs[currentOrbIndex]) {
        addNewOrb(orbs[currentOrbIndex]);
    }
}

function removeCurrentOrb() {
    if (orbs.length <= 1) {
        alert("Cannot remove the last orb.");
        return;
    }
    orbs.splice(currentOrbIndex, 1);
    if (currentOrbIndex >= orbs.length) {
        currentOrbIndex = orbs.length - 1;
    }
    updateOrbSelector();
    if (orbs.length > 0) {
        updateUIForOrb(orbs[currentOrbIndex]);
    }
    updateSidebarOrbHeaders();
}

function updateOrbSelector() {
    currentOrbSelector.innerHTML = '';
    orbs.forEach((orb, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `Orb ${index + 1}`;
        currentOrbSelector.appendChild(option);
    });
    currentOrbSelector.value = currentOrbIndex;
}
function updateSidebarOrbHeaders() {
    const orbNum = currentOrbIndex + 1;
    orbControlsHeader.innerHTML = `<i class="fas fa-cube"></i> Orb ${orbNum} Controls`;
    lissajousPatternHeader.innerHTML = `<i class="fas fa-wave-square"></i> Orb ${orbNum} Lissajous Pattern`;
    generativeModeHeader.innerHTML = `<i class="fas fa-magic"></i> Orb ${orbNum} Generative Mode`;}

function randomizeCurrentOrb() {
    if (!orbs[currentOrbIndex]) return;
    const orb = orbs[currentOrbIndex];

    // Helper function to get random float in range
    const getRandomFloat = (min, max, decimals = 2) => {
        const str = (Math.random() * (max - min) + min).toFixed(decimals);
        return parseFloat(str);
    };
    // Helper function to get random int in range
    const getRandomInt = (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };
    // Helper function to get random hex color
    const getRandomHexColor = () => {
        return `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
    };

    // Randomize paired controls
    orbPairedControls.forEach(({ base }) => {
        const slider = dom(base);
        if (slider && orb.hasOwnProperty(base)) {
            const min = parseFloat(slider.min);
            const max = parseFloat(slider.max);
            const step = parseFloat(slider.step) || (base.includes('dot') ? 1 : 0.01); // Infer step if not explicitly set
            let randomValue;
            if (step === 1 || base === 'dotCount' || base === 'dotSize') { // Integer values
                randomValue = getRandomInt(min, max);
            } else { // Float values
                const decimals = (step.toString().split('.')[1] || '').length;
                randomValue = getRandomFloat(min, max, decimals || 2);
            }
            orb[base] = randomValue;
        }
    });

    // Randomize single controls (colors, booleans, selects)
    orb.dotColor1 = getRandomHexColor();
    orb.dotColor2 = getRandomHexColor();
    orb.trail = Math.random() < 0.5;
    
    const colorModes = ['solid', 'gradient', 'rainbow'];
    orb.colorMode = colorModes[Math.floor(Math.random() * colorModes.length)];

    // Ensure dotCount is an integer
    orb.dotCount = Math.round(orb.dotCount);
    if (dom('dotCount')) {
      const minDotCount = parseFloat(dom('dotCount').min);
      const maxDotCount = parseFloat(dom('dotCount').max);
      orb.dotCount = Math.max(minDotCount, Math.min(maxDotCount, orb.dotCount));
    }

    // Rebuild dots if dotCount changed (it likely did)
    buildDotsForOrb(orb);

    // If patternType is Bezier, randomize its Option B global parameters
    if (orb.patternType === 'bezier') {
        orb.bezierPathLength = getRandomFloat(0.1, 2.0, 2);
        orb.bezierCtrlOffsetScale = getRandomFloat(0.1, 1.5, 2);
        orb.bezierPathTwist = getRandomFloat(0, 6.28, 2);
        orb.bezierAnimSpeedScale = getRandomFloat(0.1, 2.0, 1);
        // Note: buildDotsForOrb(orb) is called below, which is crucial as it uses these params.
    }

    // Update UI to reflect changes
    updateUIForOrb(orb);
}

currentOrbSelector.addEventListener('change', function() {
    currentOrbIndex = parseInt(this.value);
    updateUIForOrb(orbs[currentOrbIndex]);
    updateSidebarOrbHeaders();
});

dom('addOrbBtn').addEventListener('click', () => addNewOrb());
dom('duplicateOrbBtn').addEventListener('click', duplicateCurrentOrb);
dom('removeOrbBtn').addEventListener('click', removeCurrentOrb);
dom('randomizeOrbBtn').addEventListener('click', randomizeCurrentOrb);
// ----------- Scene Preset System & URL Sharing (handles entire 'orbs' array and global view) ---------------
const PRESET_PREFIX = 'lissajousMultiOrb_scene_';
const presetNameInput = dom('presetName');
const presetListSelect = dom('presetList');
const shareMessageEl = dom('shareMessage');

function getSceneState() {
    return {
        orbs: orbs,
        view: {
            globalAutoRotate: globalAutoRotate,
            globalAutoRotateSpeed: globalAutoRotateSpeed,
        }
    };
}

function generateShareableURL() {
    const sceneState = getSceneState();
    try {
        const jsonString = JSON.stringify(sceneState);
        const encodedData = btoa(jsonString); // Base64 encode
        
        // For GitHub Pages, construct the URL based on the current location
        // This handles both local development and GitHub Pages deployment
        const baseUrl = window.location.href.split('?')[0]; // Remove any existing query parameters
        return `${baseUrl}?scene=${encodeURIComponent(encodedData)}`;
    } catch (e) {
        console.error("Error generating share URL:", e);
        return window.location.href.split('?')[0]; // Fallback to current URL without query params
    }
}

function applySceneState(sceneState) {
    const loadedOrbsData = deepClone(sceneState.orbs || []);
    orbs = []; // Reset orbs array

    if (loadedOrbsData.length === 0) {
        addNewOrb(); // Ensure at least one orb if loaded state is empty
    } else {
        loadedOrbsData.forEach(loadedOrbData => {
            // Merge loaded orb data with defaults to ensure all params are present
            const mergedOrb = { ...deepClone(defaultOrbParamsTemplate), ...loadedOrbData };
            
            // Assign new ID if missing (though presets should have them)
            // Also, ensure nextOrbId is updated correctly if loading a scene with higher IDs
            if (!mergedOrb.id) {
                mergedOrb.id = nextOrbId++;
            } else {
                // Ensure ID is a number, as JSON stringification might convert numeric keys if not careful
                mergedOrb.id = parseInt(mergedOrb.id, 10); 
                if (mergedOrb.id >= nextOrbId) {
                    nextOrbId = mergedOrb.id + 1;
                }
            }

            if (!mergedOrb.evolutionInitialPhaseSeed) {
                mergedOrb.evolutionInitialPhaseSeed = Math.random() * 100;
            }
            
            buildDotsForOrb(mergedOrb);
            orbs.push(mergedOrb);
        });
    }
    
    const viewSettings = sceneState.view || {};
    globalAutoRotate = viewSettings.globalAutoRotate !== undefined ? viewSettings.globalAutoRotate : true;
    globalAutoRotateSpeed = viewSettings.globalAutoRotateSpeed !== undefined ? viewSettings.globalAutoRotateSpeed : 0.027;

    // Update UI for global settings
    dom('globalAutoRotate').checked = globalAutoRotate;
    dom('globalAutoRotateSpeed').value = globalAutoRotateSpeed;
    dom('globalAutoRotateSpeedNum').value = globalAutoRotateSpeed;
    updateSliderDisplay('globalAutoRotateSpeed', globalAutoRotateSpeed, 3);
    
    currentOrbIndex = 0; // Reset to first orb
    updateOrbSelector();
    if (orbs.length > 0) {
        updateUIForOrb(orbs[currentOrbIndex]);
    }
    updateSidebarOrbHeaders();
}


function savePreset() {
    const name = presetNameInput.value.trim();
    if (!name) { alert("Please enter a name for the preset."); return; }
    localStorage.setItem(PRESET_PREFIX + name, JSON.stringify(getSceneState()));
    populatePresetList();
    presetNameInput.value = '';
    shareMessageEl.textContent = `Scene '${name}' saved.`;
    setTimeout(() => shareMessageEl.textContent = '', 3000);
}

function loadPreset() {
    const name = presetListSelect.value;
    if (!name) { alert("Please select a preset to load."); return; }
    const presetString = localStorage.getItem(PRESET_PREFIX + name);
    if (presetString) {
        try {
            const sceneState = JSON.parse(presetString);
            applySceneState(sceneState);
            shareMessageEl.textContent = `Scene '${name}' loaded.`;
        } catch (e) {
            console.error("Error loading preset:", e);
            alert("Failed to load preset. It might be corrupted.");
            shareMessageEl.textContent = "Error loading preset.";
        }
        setTimeout(() => shareMessageEl.textContent = '', 3000);
    }
}
function deletePreset() { /* ... (same as before, but uses PRESET_PREFIX) ... */ const name = presetListSelect.value; if(!name){alert("Select preset"); return;} if(confirm(`Delete '${name}'?`)){localStorage.removeItem(PRESET_PREFIX + name); populatePresetList(); shareMessageEl.textContent=`'${name}' deleted.`; setTimeout(()=>shareMessageEl.textContent='',3000);}}
function populatePresetList() { /* ... (same as before, uses PRESET_PREFIX) ... */ presetListSelect.innerHTML = ''; let hasPresets = false; for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key.startsWith(PRESET_PREFIX)) { const name = key.substring(PRESET_PREFIX.length); const option = document.createElement('option'); option.value = name; option.textContent = name; presetListSelect.appendChild(option); hasPresets = true;}} if (!hasPresets) {const opt=document.createElement('option'); opt.textContent="No presets"; opt.disabled=true; presetListSelect.appendChild(opt);}}


function generateShareableURL() {
    const sceneState = getSceneState();
    try {
        const jsonString = JSON.stringify(sceneState);
        const encodedData = btoa(jsonString); // Base64 encode
        
        // For GitHub Pages, construct the URL based on the current location
        // This handles both local development and GitHub Pages deployment
        const baseUrl = window.location.href.split('?')[0]; // Remove any existing query parameters
        return `${baseUrl}?scene=${encodeURIComponent(encodedData)}`;
    } catch (e) {
        console.error("Error generating share URL:", e);
        return window.location.href.split('?')[0]; // Fallback to current URL without query params
    }
}

function applyStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    const encodedSceneData = params.get('scene');
    if (encodedSceneData) {
        try {
            const jsonString = atob(decodeURIComponent(encodedSceneData)); // Base64 decode
            const sceneState = JSON.parse(jsonString);
            applySceneState(sceneState);
            return true;
        } catch (e) {
            console.error("Error applying state from URL:", e);
            // Fallback to default if URL params are corrupt
            addNewOrb(); // Ensure at least one orb
            updateOrbSelector();
            updateUIForOrb(orbs[currentOrbIndex]);
            updateSidebarOrbHeaders();
            return false;
        }
    }
    return false;
}

dom('savePresetBtn').addEventListener('click', savePreset);
dom('loadPresetBtn').addEventListener('click', loadPreset);
dom('deletePresetBtn').addEventListener('click', deletePreset);
dom('shareBtn').addEventListener('click', () => {
    const url = generateShareableURL();
    navigator.clipboard.writeText(url).then(() => {
        shareMessageEl.textContent = "Share URL copied!";
    }).catch(err => {
        console.error('Failed to copy URL: ', err);
        shareMessageEl.textContent = "Copy failed.";
    })
    setTimeout(() => shareMessageEl.textContent = '', 3000);
});

dom('exportPngBtn').addEventListener('click', () => {
    try {
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'LissajousOrb.png';
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        shareMessageEl.textContent = 'Image exported as PNG!';
    } catch (e) {
        console.error('Error exporting PNG:', e);
        shareMessageEl.textContent = 'PNG Export failed.';
    }
    setTimeout(() => shareMessageEl.textContent = '', 3000);
});

// ----------- Initialization ---------------
function init() {
    resizeCanvas(); 

    if (!applyStateFromURL()) { // If no valid scene from URL, setup default
        addNewOrb(); // Add initial orb
        // Global controls are set to defaults already
    }
    // Ensure UI reflects the initial state (either from URL or default)
    updateOrbSelector(); // Populates selector and sets its value
    if (orbs.length > 0) {
      updateUIForOrb(orbs[currentOrbIndex]); // Loads UI for the current orb
    }
    updateSidebarOrbHeaders(); // Sets correct orb number in headers
    setupGlobalControls(); // Sets up listeners for global view controls
    setupOrbControlsListeners(); // Sets up listeners for orb-specific controls
    
    // Set max range for position sliders
    dom('positionX').max = "1000";
    dom('positionXNum').max = "1000";
    dom('positionY').max = "1000";
    dom('positionYNum').max = "1000";

    populatePresetList();
    requestAnimationFrame(animate);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Helper function for 3D rotations
function rotatePoint(x, y, z, angle, axis) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    switch(axis) {
        case 'x':
            return {
                x: x,
                y: y * cos - z * sin,
                z: y * sin + z * cos
            };
        case 'y':
            return {
                x: x * cos + z * sin,
                y: y,
                z: -x * sin + z * cos
            };
        case 'z':
            return {
                x: x * cos - y * sin,
                y: x * sin + y * cos,
                z: z
            };
    }
}