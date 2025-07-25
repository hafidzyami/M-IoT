#include "esp_camera.h"
#include <WiFi.h>
#include "esp_timer.h"
#include "img_converters.h"
#include "fb_gfx.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "esp_http_server.h"

const char* ssid = "YB Camera 1";
const char* password = "Password123-";

#define USE_AP_MODE
#define PART_BOUNDARY "123456789000000000000987654321"

//#define CAMERA_MODEL_AI_THINKER
#define CAMERA_MODEL_WROVER_KIT

#if defined(CAMERA_MODEL_WROVER_KIT)
  #define PWDN_GPIO_NUM    -1
  #define RESET_GPIO_NUM   -1
  #define XCLK_GPIO_NUM    21
  #define SIOD_GPIO_NUM    26
  #define SIOC_GPIO_NUM    27
  #define Y9_GPIO_NUM      35
  #define Y8_GPIO_NUM      34
  #define Y7_GPIO_NUM      39
  #define Y6_GPIO_NUM      36
  #define Y5_GPIO_NUM      19
  #define Y4_GPIO_NUM      18
  #define Y3_GPIO_NUM       5
  #define Y2_GPIO_NUM       4
  #define VSYNC_GPIO_NUM   25
  #define HREF_GPIO_NUM    23
  #define PCLK_GPIO_NUM    22

#elif defined(CAMERA_MODEL_AI_THINKER)
  #define PWDN_GPIO_NUM     32
  #define RESET_GPIO_NUM    -1
  #define XCLK_GPIO_NUM      0
  #define SIOD_GPIO_NUM     26
  #define SIOC_GPIO_NUM     27
  #define Y9_GPIO_NUM       35
  #define Y8_GPIO_NUM       34
  #define Y7_GPIO_NUM       39
  #define Y6_GPIO_NUM       36
  #define Y5_GPIO_NUM       21
  #define Y4_GPIO_NUM       19
  #define Y3_GPIO_NUM       18
  #define Y2_GPIO_NUM        5
  #define VSYNC_GPIO_NUM    25
  #define HREF_GPIO_NUM     23
  #define PCLK_GPIO_NUM     22
#else
  #error "Camera model not selected"
#endif

httpd_handle_t camera_httpd = NULL;

const char PROGMEM index_html[] = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<title>ESP32-CAM</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { 
  font-family: Arial, sans-serif; 
  margin: 20px; 
  background: #f5f5f5; 
}
.container { 
  max-width: 1200px; 
  margin: 0 auto; 
  background: white;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
.header {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background: #2c3e50;
  color: white;
  border-radius: 8px;
}
.content { 
  display: grid; 
  grid-template-columns: 1fr 1fr; 
  gap: 30px; 
}
.column {
  background: #fafafa;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #ddd;
}
.column h2 {
  color: #2c3e50;
  margin-bottom: 20px;
  border-bottom: 2px solid #3498db;
  padding-bottom: 10px;
}
.stream-container {
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 15px;
  position: relative;
}
.stream-img {
  width: 100%;
  height: auto;
  display: block;
}
.fps-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.8);
  color: #00ff00;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: bold;
  z-index: 10;
  border: 1px solid #00ff00;
}
.stream-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
  font-size: 12px;
  color: #666;
}
.info-item {
  background: #ecf0f1;
  padding: 5px 10px;
  border-radius: 4px;
}
.photo-container {
  background: #fff;
  border: 2px dashed #ddd;
  border-radius: 8px;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 15px;
  text-align: center;
  color: #666;
}
.photo-container img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}
.btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  margin: 5px;
}
.btn:hover { background: #2980b9; }
.btn:disabled { 
  background: #bdc3c7; 
  cursor: not-allowed; 
}
.btn-success { background: #27ae60; }
.btn-success:hover { background: #229954; }
.controls { text-align: center; }
.status {
  background: #ecf0f1;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
  text-align: center;
  font-weight: 500;
}
@media (max-width: 768px) {
  .content { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Multimedia IoT by YB & HS</h1>
    <p>[HTTP] Live Stream and Photo Capture</p>
  </div>
  
  <div class="content">
    <div class="column">
      <h2>Live Stream</h2>
      <div class="stream-info">
        <div class="info-item">Resolution: <span id="resolution">Loading...</span></div>
        <div class="info-item">Quality: High</div>
        <div class="info-item">Status: <span id="streamStatus">Active</span></div>
      </div>
      <div class="stream-container">
        <div class="fps-overlay" id="fpsDisplay">FPS: --</div>
        <img src="/stream" class="stream-img" id="streamImg">
      </div>
      <div class="controls">
        <button class="btn" onclick="toggleStream()" id="streamToggle">Pause Stream</button>
        <button class="btn" onclick="refreshStream()">Refresh Stream</button>
        <button class="btn" onclick="resetFPS()">Reset FPS</button>
      </div>
    </div>

    <div class="column">
      <h2>Photo Capture</h2>
      <div class="status" id="status">Ready to capture</div>
      <div class="photo-container" id="photoContainer">
        Click Take Photo to capture an image
      </div>
      <div class="controls">
        <button class="btn btn-success" onclick="takePhoto()" id="captureBtn">
          Take Photo
        </button>
        <button class="btn" onclick="downloadPhoto()" id="downloadBtn" disabled>
          Download Photo
        </button>
      </div>
    </div>
  </div>
</div>

<script>
let lastPhotoUrl = '';
let streamPaused = false;

// FPS calculation variables
let frameCount = 0;
let lastTime = Date.now();
let fps = 0;
let fpsHistory = [];
let maxFpsHistory = 10;
let fpsInterval;
let lastImageData = '';

function updateStatus(message) {
  document.getElementById('status').textContent = message;
}

function updateFPS() {
  frameCount++;
  const now = Date.now();
  const deltaTime = now - lastTime;
  
  // Update FPS every 1000ms
  if (deltaTime >= 1000) {
    fps = Math.round((frameCount * 1000) / deltaTime);
    
    // Store FPS history for average calculation
    fpsHistory.push(fps);
    if (fpsHistory.length > maxFpsHistory) {
      fpsHistory.shift();
    }
    
    // Calculate average FPS
    const avgFps = fpsHistory.length > 0 ? 
      Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length) : 0;
    
    // Update display
    document.getElementById('fpsDisplay').innerHTML = 
      `FPS: ${fps}<br>Avg: ${avgFps}`;
    
    frameCount = 0;
    lastTime = now;
  }
}

// Function to detect frame changes for MJPEG stream
function startFPSMonitoring() {
  if (fpsInterval) {
    clearInterval(fpsInterval);
  }
  
  const streamImg = document.getElementById('streamImg');
  let lastFrameTime = Date.now();
  
  // Monitor for frame changes by checking image data periodically
  fpsInterval = setInterval(() => {
    if (streamPaused) return;
    
    try {
      // Create a small canvas to sample the image
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      
      // Draw a small sample of the image
      if (streamImg.naturalWidth > 0 && streamImg.naturalHeight > 0) {
        ctx.drawImage(streamImg, 0, 0, 32, 32);
        const currentImageData = canvas.toDataURL();
        
        // If image data changed, it's a new frame
        if (currentImageData !== lastImageData && lastImageData !== '') {
          updateFPS();
          lastFrameTime = Date.now();
        }
        
        lastImageData = currentImageData;
      }
    } catch (e) {
      // Ignore canvas errors
    }
  }, 50); // Check every 50ms for frame changes
}

function resetFPS() {
  frameCount = 0;
  lastTime = Date.now();
  fps = 0;
  fpsHistory = [];
  lastImageData = '';
  document.getElementById('fpsDisplay').innerHTML = 'FPS: --<br>Avg: --';
  updateStatus('FPS counter reset');
  
  // Restart monitoring
  if (!streamPaused) {
    startFPSMonitoring();
  }
}

function updateResolution() {
  const streamImg = document.getElementById('streamImg');
  if (streamImg.naturalWidth && streamImg.naturalHeight) {
    document.getElementById('resolution').textContent = 
      `${streamImg.naturalWidth}x${streamImg.naturalHeight}`;
  }
}

function toggleStream() {
  const streamImg = document.getElementById('streamImg');
  const toggleBtn = document.getElementById('streamToggle');
  const statusElement = document.getElementById('streamStatus');
  
  if (!streamPaused) {
    streamImg.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlN0cmVhbSBQYXVzZWQ8L3RleHQ+PC9zdmc+';
    toggleBtn.textContent = 'Resume Stream';
    statusElement.textContent = 'Paused';
    streamPaused = true;
    updateStatus('Stream paused - ready for photo capture');
    document.getElementById('fpsDisplay').innerHTML = 'FPS: 0<br>Avg: --';
    
    // Stop FPS monitoring
    if (fpsInterval) {
      clearInterval(fpsInterval);
    }
  } else {
    streamImg.src = '/stream?t=' + Date.now();
    toggleBtn.textContent = 'Pause Stream';
    statusElement.textContent = 'Active';
    streamPaused = false;
    updateStatus('Stream resumed');
    resetFPS();
  }
}

// Capture from ESP32, but issue with iOS devices
// function takePhoto() {
//   const captureBtn = document.getElementById('captureBtn');
//   const photoContainer = document.getElementById('photoContainer');
//   const streamImg = document.getElementById('streamImg');
  
//   captureBtn.disabled = true;
//   captureBtn.textContent = 'Capturing...';
//   updateStatus('Pausing stream for capture...');
  
//   // Stop stream temporarily
//   const originalStreamSrc = streamImg.src;
//   streamImg.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlN0cmVhbSBQYXVzZWQ8L3RleHQ+PC9zdmc+';
  
//   // Wait a bit for stream to stop
//   setTimeout(() => {
//     updateStatus('Taking photo...');
    
//     fetch('/capture?t=' + Date.now())
//       .then(response => {
//         if (!response.ok) throw new Error('Capture failed with status: ' + response.status);
//         return response.blob();
//       })
//       .then(blob => {
//         const url = URL.createObjectURL(blob);
//         const img = new Image();
        
//         img.onload = function() {
//           photoContainer.innerHTML = '';
//           photoContainer.appendChild(img);
//           lastPhotoUrl = url;
//           document.getElementById('downloadBtn').disabled = false;
//           updateStatus('Photo captured successfully!');
          
//           // Resume stream after successful capture
//           setTimeout(() => {
//             streamImg.src = originalStreamSrc + '?resume=' + Date.now();
//             updateStatus('Stream resumed - ready for next capture');
//           }, 1000);
//         };
        
//         img.onerror = function() {
//           updateStatus('Failed to display captured photo');
//           // Still resume stream
//           setTimeout(() => {
//             streamImg.src = originalStreamSrc + '?resume=' + Date.now();
//           }, 1000);
//         };
        
//         img.src = url;
//       })
//       .catch(error => {
//         updateStatus('Capture failed: ' + error.message);
//         // Resume stream even on error
//         setTimeout(() => {
//           streamImg.src = originalStreamSrc + '?resume=' + Date.now();
//         }, 1000);
//       })
//       .finally(() => {
//         captureBtn.disabled = false;
//         captureBtn.textContent = 'Take Photo';
//       });
//   }, 500); // Wait 500ms for stream to properly stop
// }

function takePhoto() {
  const captureBtn = document.getElementById('captureBtn');
  const photoContainer = document.getElementById('photoContainer');
  const streamImg = document.getElementById('streamImg');
  const canvas = document.createElement('canvas');

  updateStatus('Capturing frame from stream...');
  captureBtn.disabled = true;
  captureBtn.textContent = 'Capturing...';

  // Sesuaikan ukuran canvas dengan ukuran gambar stream
  canvas.width = streamImg.naturalWidth;
  canvas.height = streamImg.naturalHeight;

  // Gambar frame saat ini dari <img> ke <canvas>
  const ctx = canvas.getContext('2d');
  ctx.drawImage(streamImg, 0, 0, canvas.width, canvas.height);

  // Dapatkan URL data dari canvas
  canvas.toBlob(function(blob) {
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = function() {
      photoContainer.innerHTML = '';
      photoContainer.appendChild(img);
      lastPhotoUrl = url;
      document.getElementById('downloadBtn').disabled = false;
      updateStatus('Photo captured successfully!');
    };
    img.onerror = function() {
      updateStatus('Failed to display captured photo.');
    };
    img.src = url;

    // Aktifkan kembali tombol
    captureBtn.disabled = false;
    captureBtn.textContent = 'Take Photo';

  }, 'image/jpeg', 0.9); // Kualitas 90%
}

function downloadPhoto() {
  if (lastPhotoUrl) {
    const link = document.createElement('a');
    link.href = lastPhotoUrl;
    link.download = 'esp32cam_photo_' + Date.now() + '.jpg';
    link.click();
    updateStatus('Photo download started');
  }
}

function refreshStream() {
  const streamImg = document.getElementById('streamImg');
  streamImg.src = '/stream?t=' + Date.now();
  updateStatus('Stream refreshed');
  resetFPS();
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
  const streamImg = document.getElementById('streamImg');
  
  streamImg.addEventListener('load', function() {
    updateResolution();
    if (!streamPaused) {
      // Start FPS monitoring after image loads
      setTimeout(startFPSMonitoring, 1000);
    }
  });

  streamImg.addEventListener('error', function() {
    document.getElementById('fpsDisplay').innerHTML = 'FPS: Error<br>Avg: --';
    document.getElementById('streamStatus').textContent = 'Error';
    if (fpsInterval) {
      clearInterval(fpsInterval);
    }
  });
});

// Test capture endpoint on page load
window.onload = function() {
  // Initialize FPS counter
  resetFPS();
  
  fetch('/capture?test=1')
    .then(response => {
      if (response.ok) {
        updateStatus('Capture endpoint is working - ready to take photos');
      } else {
        updateStatus('Warning: Capture endpoint may have issues');
      }
    })
    .catch(error => {
      updateStatus('Error: Cannot reach capture endpoint');
    });
    
  // Update resolution when image loads and start FPS monitoring
  setTimeout(() => {
    updateResolution();
    if (!streamPaused) {
      startFPSMonitoring();
    }
  }, 2000);
};

// Cleanup interval on page unload
window.addEventListener('beforeunload', function() {
  if (fpsInterval) {
    clearInterval(fpsInterval);
  }
});
</script>
</body>
</html>
)rawliteral";

// Very simple capture handler - no fancy features
static esp_err_t capture_handler(httpd_req_t *req) {
  camera_fb_t *fb = NULL;
  esp_err_t res = ESP_OK;

  Serial.println("Capture request received");

  fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  Serial.printf("Photo size: %d bytes\n", fb->len);

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache");
  
  res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  
  Serial.println("Photo sent");
  return res;
}

// Simple stream handler
static esp_err_t stream_handler(httpd_req_t *req){
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  char part_buf[64];
  
  static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
  static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
  static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if(res != ESP_OK) return res;

  while(true){
    fb = esp_camera_fb_get();
    if (!fb) {
      res = ESP_FAIL;
      break;
    }

    if(res == ESP_OK){
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }
    if(res == ESP_OK){
      size_t hlen = snprintf((char *)part_buf, 64, _STREAM_PART, fb->len);
      res = httpd_resp_send_chunk(req, (const char *)part_buf, hlen);
    }
    if(res == ESP_OK){
      res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    }
    
    esp_camera_fb_return(fb);
    
    if(res != ESP_OK) break;
    delay(50); // Target ~ 20 FPS
  }
  
  return res;
}

static esp_err_t index_handler(httpd_req_t *req){
  httpd_resp_set_type(req, "text/html");
  return httpd_resp_send(req, index_html, strlen(index_html));
}

void startCameraServer(){
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  httpd_uri_t index_uri = {
    .uri       = "/",
    .method    = HTTP_GET,
    .handler   = index_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t capture_uri = {
    .uri       = "/capture",
    .method    = HTTP_GET,
    .handler   = capture_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  if (httpd_start(&camera_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(camera_httpd, &index_uri);
    httpd_register_uri_handler(camera_httpd, &capture_uri);
    httpd_register_uri_handler(camera_httpd, &stream_uri);
    Serial.println("Camera server started");
  }
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  
  Serial.begin(115200);
  Serial.println("ESP32-CAM Starting...");
  
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Simple settings
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 10;
  config.fb_count = 2;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);
    return;
  }
  Serial.println("Camera initialized");

  // Test capture immediately
  camera_fb_t * fb = esp_camera_fb_get();
  if (fb) {
    Serial.printf("Camera test OK: %d bytes\n", fb->len);
    esp_camera_fb_return(fb);
  } else {
    Serial.println("Camera test FAILED");
  }

  #if defined(USE_AP_MODE)
    WiFi.softAP(ssid, password);
    Serial.print("AP started. Go to: http://");
    Serial.println(WiFi.softAPIP());
  #else
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
    }
    Serial.print("WiFi connected. Go to: http://");
    Serial.println(WiFi.localIP());
  #endif
  
  startCameraServer();
  Serial.println("Setup complete");
}

void loop() {
  delay(10000);
}