#include <Arduino.h>
#include <WiFi.h>
#include "esp_camera.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "ESP32-RTSPServer.h"

// --- KONFIGURASI PENGGUNA ---
const char *ssid = "Bandung";
const char *password = "ybandung";

// --- KONFIGURASI PIN KAMERA (Pilih salah satu) ---
#define CAMERA_MODEL_WROVER_KIT
// #define CAMERA_MODEL_AI_THINKER

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
#endif

// --- VARIABEL GLOBAL ---
RTSPServer rtspServer;               // Objek server RTSP
TaskHandle_t videoTaskHandle = NULL; // Handle untuk task video
int quality;                         // Variable to hold quality for RTSP frame

// --- FUNGSI-FUNGSI ---

void setup_wifi()
{
  delay(10);
  Serial.print("\nMenyambung ke ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi tersambung");
  Serial.print("Alamat IP: ");
  Serial.println(WiFi.localIP());
}

esp_err_t camera_init()
{
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

  config.frame_size = FRAMESIZE_VGA; // Resolusi VGA (640x480)
  config.jpeg_quality = 10;
  config.fb_count = 2; // Gunakan 2 buffer untuk stabilitas
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK)
  {
    Serial.printf("Inisialisasi kamera gagal dengan error 0x%x\n", err);
    return err;
  }
  Serial.println("Kamera berhasil diinisialisasi");
  return ESP_OK;
}

// Fungsi untuk mendapatkan kualitas frame
void getFrameQuality()
{
  sensor_t *s = esp_camera_sensor_get();
  quality = s->status.quality;
  Serial.printf("Camera Quality is: %d\n", quality);
}

// Task FreeRTOS yang didedikasikan untuk mengambil frame dan mengirimkannya
void sendVideo(void *pvParameters)
{
  Serial.println("Task video dimulai.");
  while (true)
  {
    // Cek apakah ada client yang terhubung dan siap menerima frame
    if (rtspServer.readyToSendFrame())
    {
      camera_fb_t *fb = esp_camera_fb_get();
      if (!fb)
      {
        Serial.println("Gagal mengambil frame dari kamera");
        continue; // Coba lagi
      }

      // Kirim frame melalui RTP (Real-time Transport Protocol)
      // Library akan menangani semua kerumitan RTSP dan RTP
      rtspServer.sendRTSPFrame(fb->buf, fb->len, quality, fb->width, fb->height);

      // Kembalikan buffer agar bisa digunakan lagi
      esp_camera_fb_return(fb);
    }

    // Beri jeda singkat agar task lain (seperti WiFi) bisa berjalan
    vTaskDelay(pdMS_TO_TICKS(1));
  }
}

void setup()
{
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout detector
  Serial.begin(115200);
  Serial.println("ESP32-CAM RTSP Server Starting...");

  // Inisialisasi kamera
  if (camera_init() != ESP_OK)
  {
    Serial.println("Menghentikan program karena kamera gagal.");
    while (1)
      ;
  }

  // Inisialisasi WiFi
  setup_wifi();

  // Atur jumlah maksimum client yang bisa terhubung
  rtspServer.maxRTSPClients = 2;

  getFrameQuality(); // Dapatkan kualitas frame kamera

  // Mulai server RTSP pada port default 554
  if (rtspServer.init())
  {
    Serial.println("Server RTSP berhasil dimulai.");
    Serial.printf("\n>>> Buka stream ini di VLC atau media player lain:\n");
    Serial.printf("rtsp://%s:554/mjpeg/1\n", WiFi.localIP().toString().c_str());
  }
  else
  {
    Serial.println("Gagal memulai server RTSP.");
  }

  // Buat task untuk mengirim video.
  xTaskCreate(
      sendVideo,       // Fungsi yang akan dijalankan
      "Video Task",    // Nama task
      1024 * 8,        // Ukuran stack (8KB)
      NULL,            // Parameter untuk task
      9,               // Prioritas (lebih tinggi dari loop)
      &videoTaskHandle // Handle untuk task ini
  );
}

void loop()
{
  delay(1000);
}