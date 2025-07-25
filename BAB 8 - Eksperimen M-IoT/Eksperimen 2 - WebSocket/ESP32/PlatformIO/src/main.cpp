#include "esp_camera.h"
#include <WiFi.h>
#include "esp_timer.h"
#include "img_converters.h"
#include "Arduino.h"
#include "fb_gfx.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "esp_http_server.h"

const char *ssid = "YB Camera 1";
const char *password = "Password123-";

// Uncomment to use AP mode, comment to use STA mode
#define USE_AP_MODE

// #define CAMERA_MODEL_AI_THINKER
#define CAMERA_MODEL_WROVER_KIT

#if defined(CAMERA_MODEL_WROVER_KIT)
#define PWDN_GPIO_NUM -1
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 21
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 19
#define Y4_GPIO_NUM 18
#define Y3_GPIO_NUM 5
#define Y2_GPIO_NUM 4
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22

#elif defined(CAMERA_MODEL_AI_THINKER)
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22
#else
#error "Camera model not selected"
#endif

// --- VARIABEL GLOBAL ---
httpd_handle_t camera_httpd = NULL;
#define MAX_CLIENTS 4
static bool stream_active = false;
static TaskHandle_t camera_stream_task_handle = NULL;
static SemaphoreHandle_t clients_mutex = NULL; // Mutex untuk melindungi akses ke daftar client
static int clients_fds[MAX_CLIENTS] = {0};     // Daftar client yang terhubung (disimpan berdasarkan file descriptor)

// --- KODE HTML & JAVASCRIPT UNTUK CLIENT ---
const char PROGMEM INDEX_HTML[] = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<title>ESP32-CAM WebSocket</title>
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
    <p>[WebSocket] Live Stream and Photo Capture</p>
  </div>
  
  <div class="content">
    <div class="column">
      <h2>Live Stream</h2>
      <div class="stream-info">
        <div class="info-item">Resolution: <span id="resolution">Loading...</span></div>
        <div class="info-item">Quality: High</div>
        <div class="info-item">Status: <span id="streamStatus">Connecting...</span></div>
      </div>
      <div class="stream-container">
        <div class="fps-overlay" id="fpsDisplay">FPS: --</div>
        <img src="" class="stream-img" id="streamImg">
      </div>
      <div class="controls">
        <button class="btn" onclick="toggleStream()" id="streamToggle">Pause Stream</button>
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
    const statusEl = document.getElementById('status');
    const streamImg = document.getElementById('streamImg');
    const toggleStreamBtn = document.getElementById('streamToggle');
    const captureBtn = document.getElementById('captureBtn');
    const photoContainer = document.getElementById('photoContainer');
    const downloadBtn = document.getElementById('downloadBtn');
    const resolutionEl = document.getElementById('resolution');
    const streamStatusEl = document.getElementById('streamStatus');
    const fpsDisplayEl = document.getElementById('fpsDisplay');

    let ws;
    let lastPhotoUrl = '';
    let streamActive = true;

    let frameCount = 0;
    let lastFPSTime = Date.now();

    function connectWebSocket() {
        const wsUrl = `ws://${window.location.hostname}/ws`;
        console.log(`Menyambung ke ${wsUrl}`);
        streamStatusEl.textContent = 'Connecting...';
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Koneksi WebSocket terbuka.');
            streamStatusEl.textContent = 'Active';
            ws.send('STREAM_ON');
            streamActive = true;
            toggleStreamBtn.textContent = 'Pause Stream';
            // Reset FPS counter saat koneksi baru
            frameCount = 0;
            lastFPSTime = Date.now();
        };

        ws.onmessage = (event) => {
            // Data yang diterima adalah frame gambar dalam format Blob
            const url = URL.createObjectURL(event.data);
            streamImg.src = url;

            // Setiap pesan masuk adalah satu frame
            frameCount++;
            const now = Date.now();
            const delta = now - lastFPSTime;
            // Perbarui tampilan FPS setiap 1 detik
            if (delta >= 1000) {
                const fps = (frameCount * 1000) / delta;
                fpsDisplayEl.textContent = `FPS: ${fps.toFixed(1)}`;
                // Reset counter untuk detik berikutnya
                frameCount = 0;
                lastFPSTime = now;
            }

            streamImg.onload = () => {
                URL.revokeObjectURL(url);
                resolutionEl.textContent = `${streamImg.naturalWidth}x${streamImg.naturalHeight}`;
            };
        };

        ws.onclose = () => {
            console.log('Koneksi WebSocket ditutup.');
            streamStatusEl.textContent = 'Disconnected';
            setTimeout(connectWebSocket, 2000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            streamStatusEl.textContent = 'Error';
            ws.close();
        };
    }

    function toggleStream() {
        if (ws.readyState !== WebSocket.OPEN) return;
        
        if (streamActive) {
            ws.send('STREAM_OFF');
            streamActive = false;
            toggleStreamBtn.textContent = 'Resume Stream';
            streamStatusEl.textContent = 'Paused';
            fpsDisplayEl.textContent = 'FPS: 0.0';
        } else {
            ws.send('STREAM_ON');
            streamActive = true;
            toggleStreamBtn.textContent = 'Pause Stream';
            streamStatusEl.textContent = 'Active';
            lastFPSTime = Date.now(); // Reset timer saat stream dilanjutkan
            frameCount = 0;
        }
    }

    function takePhoto() {
        if (ws.readyState !== WebSocket.OPEN) {
            updateStatus('Not connected.');
            return;
        }
        
        updateStatus('Capturing...');
        captureBtn.disabled = true;
        photoContainer.innerHTML = 'Waiting for image...';
        
        ws.send('CAPTURE');
        
        const captureListener = (event) => {
            if (lastPhotoUrl) {
                URL.revokeObjectURL(lastPhotoUrl);
            }
            lastPhotoUrl = URL.createObjectURL(event.data);
            
            const img = new Image();
            img.onload = () => {
                photoContainer.innerHTML = '';
                photoContainer.appendChild(img);
                updateStatus('Photo captured successfully!');
                downloadBtn.disabled = false;
                captureBtn.disabled = false;
            };
            img.onerror = () => {
                updateStatus('Failed to display captured photo.');
                captureBtn.disabled = false;
            };
            img.src = lastPhotoUrl;
            
            ws.removeEventListener('message', captureListener);
        };
        
        ws.addEventListener('message', captureListener);
    }

    function downloadPhoto() {
        if (lastPhotoUrl) {
            const link = document.createElement('a');
            link.href = lastPhotoUrl;
            link.download = `esp32cam_photo_${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            updateStatus('Photo download started');
        }
    }

    window.onload = connectWebSocket;
</script>
</body>
</html>
)rawliteral";

// --- FUNGSI-FUNGSI SERVER ---

// Mengirim frame ke semua client WebSocket yang terhubung
static void send_frame_to_clients(camera_fb_t *fb)
{
    if (xSemaphoreTake(clients_mutex, portMAX_DELAY))
    {
        for (int i = 0; i < MAX_CLIENTS; i++)
        {
            if (clients_fds[i] != 0)
            {
                httpd_ws_frame_t ws_pkt;
                memset(&ws_pkt, 0, sizeof(httpd_ws_frame_t));
                ws_pkt.payload = (uint8_t *)fb->buf;
                ws_pkt.len = fb->len;
                ws_pkt.type = HTTPD_WS_TYPE_BINARY;
                httpd_ws_send_frame_async(camera_httpd, clients_fds[i], &ws_pkt);
            }
        }
        xSemaphoreGive(clients_mutex);
    }
}

// Task FreeRTOS untuk mengambil dan mengirim stream video
static void camera_stream_task(void *arg)
{
    camera_fb_t *fb = NULL;
    while (stream_active)
    {
        fb = esp_camera_fb_get();
        if (!fb)
        {
            Serial.println("Gagal mengambil frame");
            continue;
        }
        send_frame_to_clients(fb);
        esp_camera_fb_return(fb);
        vTaskDelay(pdMS_TO_TICKS(50)); // Target ~20 FPS
    }
    // Hapus task saat loop berakhir
    camera_stream_task_handle = NULL;
    vTaskDelete(NULL);
}

// Handler untuk koneksi WebSocket
static esp_err_t ws_handler(httpd_req_t *req)
{
    if (req->method == HTTP_GET)
    {
        Serial.printf("Client terhubung dengan fd=%d\n", httpd_req_to_sockfd(req));
        return ESP_OK;
    }

    httpd_ws_frame_t ws_pkt;
    memset(&ws_pkt, 0, sizeof(httpd_ws_frame_t));
    ws_pkt.type = HTTPD_WS_TYPE_TEXT;

    // Dapatkan frame dari client
    esp_err_t ret = httpd_ws_recv_frame(req, &ws_pkt, 0);
    if (ret != ESP_OK)
    {
        return ret;
    }

    // Alokasikan buffer untuk payload
    if (ws_pkt.len)
    {
        uint8_t *buf = (uint8_t *)calloc(1, ws_pkt.len + 1);
        if (buf)
        {
            ws_pkt.payload = buf;
            ret = httpd_ws_recv_frame(req, &ws_pkt, ws_pkt.len);
            if (ret == ESP_OK)
            {
                // Konversi payload ke string
                std::string cmd = std::string((char *)ws_pkt.payload, ws_pkt.len);
                Serial.printf("Menerima perintah: %s\n", cmd.c_str());

                if (cmd == "STREAM_ON")
                {
                    if (xSemaphoreTake(clients_mutex, portMAX_DELAY))
                    {
                        for (int i = 0; i < MAX_CLIENTS; i++)
                        {
                            if (clients_fds[i] == 0)
                            {
                                clients_fds[i] = httpd_req_to_sockfd(req);
                                break;
                            }
                        }
                        xSemaphoreGive(clients_mutex);
                    }
                    if (!stream_active)
                    {
                        stream_active = true;
                        xTaskCreate(camera_stream_task, "cam_stream_task", 4096, NULL, 5, &camera_stream_task_handle);
                    }
                }
                else if (cmd == "STREAM_OFF")
                {
                    stream_active = false;
                }
                else if (cmd == "CAPTURE")
                {
                    camera_fb_t *fb = esp_camera_fb_get();
                    if (fb)
                    {
                        httpd_ws_frame_t resp_pkt;
                        memset(&resp_pkt, 0, sizeof(httpd_ws_frame_t));
                        resp_pkt.payload = (uint8_t *)fb->buf;
                        resp_pkt.len = fb->len;
                        resp_pkt.type = HTTPD_WS_TYPE_BINARY;
                        httpd_ws_send_frame_async(req->handle, httpd_req_to_sockfd(req), &resp_pkt);
                        esp_camera_fb_return(fb);
                    }
                }
            }
            free(buf);
        }
    }
    return ret;
}

// Handler untuk halaman utama
static esp_err_t index_handler(httpd_req_t *req)
{
    httpd_resp_set_type(req, "text/html");
    return httpd_resp_send(req, INDEX_HTML, strlen(INDEX_HTML));
}

// Memulai server web
void startCameraServer()
{
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = 80;
    config.ctrl_port = 32768; // Port kontrol default

    httpd_uri_t index_uri = {"/", HTTP_GET, index_handler, NULL};
    httpd_uri_t ws_uri = {"/ws", HTTP_GET, ws_handler, NULL, true};

    if (httpd_start(&camera_httpd, &config) == ESP_OK)
    {
        httpd_register_uri_handler(camera_httpd, &index_uri);
        httpd_register_uri_handler(camera_httpd, &ws_uri);
        Serial.println("Server HTTP/WebSocket berhasil dimulai");
    }
}

void setup()
{
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
    if (err != ESP_OK)
    {
        Serial.printf("Camera init failed with error 0x%x\n", err);
        return;
    }
    Serial.println("Camera initialized");

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

    clients_mutex = xSemaphoreCreateMutex();
    startCameraServer();
}

void loop()
{
    // Loop utama bisa kosong karena semua pekerjaan ditangani oleh task
    vTaskDelay(portMAX_DELAY);
}