#include <WiFi.h>
#include <PubSubClient.h>
#include "esp_camera.h"
#include "fb_gfx.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "sdkconfig.h"

// --- KONFIGURASI ---
// WiFi
const char* ssid = "Ganesha IT"; // Ganti dengan SSID WiFi Anda
const char* password = "ganesha15E"; // Ganti dengan password WiFi Anda

// MQTT
const char* mqtt_server = "192.168.1.25";
const int mqtt_port = 1883;
const char* image_topic = "esp32/camera/image";
const char* status_topic = "esp32/camera/status";
const char* command_topic = "esp32/camera/command";

// --- VARIABEL GLOBAL ---
WiFiClient espClient;
PubSubClient client(espClient);

// Kontrol stream
bool streamActive = false; // Flag untuk mengontrol streaming
bool captureRequested = false;
unsigned long lastFrameTime = 0;
const long frameInterval = 50; // Interval realistis (50ms = target 20 FPS)

// --- KONFIGURASI PIN KAMERA (Pilih salah satu) ---
#define CAMERA_MODEL_WROVER_KIT
// #define CAMERA_MODEL_AI_THINKER

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
#endif

// --- FUNGSI-FUNGSI ---

void publishImage() {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Gagal mengambil gambar dari kamera");
    client.publish(status_topic, "Gagal ambil gambar");
    return;
  }

  Serial.printf("Mengirim gambar, ukuran: %zu bytes\n", fb->len);

  // Kirim data gambar ke topik MQTT
  bool published = client.publish(image_topic, fb->buf, fb->len);

  if (published) {
    Serial.println("Gambar berhasil dikirim.");
  } else {
    Serial.println("Gagal mengirim gambar (terlalu besar atau koneksi buruk).");
    client.publish(status_topic, "Gagal kirim gambar");
  }
  
  esp_camera_fb_return(fb);
}

// Fungsi callback untuk menangani perintah MQTT
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Pesan diterima di topik: ");
  Serial.println(topic);
  
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.print("Pesan: ");
  Serial.println(message);

  if (strcmp(topic, command_topic) == 0) {
    if (message == "stream_on") {
      streamActive = true;
      Serial.println("Streaming diaktifkan.");
      client.publish(status_topic, "Streaming ON");
    } else if (message == "stream_off") {
      streamActive = false;
      Serial.println("Streaming dinonaktifkan.");
      client.publish(status_topic, "Streaming OFF");
    } else if (message == "capture") {
      Serial.println("Perintah capture diterima, mengambil satu gambar...");
      client.publish(status_topic, "Capture requested");
      captureRequested = true;
    }
  }
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Menyambung ke ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi tersambung");
  Serial.print("Alamat IP: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Mencoba koneksi MQTT...");
    String clientId = "ESP32-CAM-Client-" + String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("terhubung!");
      client.publish(status_topic, "ESP32-CAM online");
      // Berlangganan ke topik perintah setelah terhubung
      client.subscribe(command_topic);
      Serial.print("Berlangganan ke topik: ");
      Serial.println(command_topic);
    } else {
      Serial.print("gagal, rc=");
      Serial.print(client.state());
      Serial.println(" coba lagi dalam 5 detik");
      delay(5000);
    }
  }
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout detector
  Serial.begin(115200);
  Serial.println("ESP32-CAM Starting...");

  // Konfigurasi Kamera
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
  
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 10;
  config.fb_count = 2;      // Gunakan 2 buffer untuk stabilitas
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM; // Gunakan PSRAM

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Inisialisasi kamera gagal dengan error 0x%x\n", err);
    return;
  }
  Serial.println("Kamera berhasil diinisialisasi");

  // WiFi & MQTT
  setup_wifi();
  
  // Perbesar buffer MQTT sebelum koneksi
  client.setBufferSize(40000); // 40KB
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop(); // Penting untuk menjaga koneksi dan menerima pesan

  if(captureRequested) {
    publishImage(); // Ambil dan kirim gambar
    captureRequested = false; // Reset flag setelah permintaan diproses
  }

  // Hanya kirim gambar jika streaming aktif
  if (streamActive) {
    unsigned long currentMillis = millis();
    if (currentMillis - lastFrameTime >= frameInterval) {
      lastFrameTime = currentMillis;
      publishImage();
    }
  }
}
