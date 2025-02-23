var gateway = `ws://${window.location.hostname}/ws`;
var websocket;
window.addEventListener("load", onload);
var direction;

function onload(event) {
  initWebSocket();
  setupModeSelection();
  setupControlButtons();
}

function initWebSocket() {
  console.log("Trying to open a WebSocket connection…");
  websocket = new WebSocket(gateway);
  websocket.onopen = onOpen;
  websocket.onclose = onClose;
  websocket.onmessage = onMessage;
}

function onOpen(event) {
  console.log("Connection opened");
}

function onClose(event) {
  console.log("Connection closed");
  setTimeout(initWebSocket, 2000);
}

function submitForm(mode, value) {
  console.log("submitting form");
  console.log(mode + "&" + value);
  websocket.send(mode + "&" + value);
}

function onMessage(event) {
  console.log(event.data);
  const degree = document.getElementById("servo-degree");
  if (degree) {
    degree.textContent = event.data + "°";
    degree.style.color = "#007bff"
  }
}

function setupModeSelection() {
  const modeSelect = document.getElementById("mode");
  const manualControls = document.getElementById("manual-controls");
  const automaticControls = document.getElementById("automatic-controls");

  modeSelect.addEventListener("change", function () {
    if (modeSelect.value === "automatic") {
      manualControls.style.display = "none";
      automaticControls.style.display = "block";
    } else {
      manualControls.style.display = "block";
      automaticControls.style.display = "none";
    }
  });
}

function setupControlButtons() {
  document.getElementById("setServo").addEventListener("click", function () {
    const degree = document.getElementById("degree").value;
    submitForm("manual", degree);
  });

  document.getElementById("startAuto").addEventListener("click", function () {
    const delay = document.getElementById("delay").value;
    const degree = document.getElementById("servo-degree");
    if (degree) {
      degree.textContent = "Servo rotasi otomatis dengan delay " + delay + "ms";
      degree.style.color = "red";
    }
    submitForm("automatic", delay);
  });
}
