#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <ESP32Servo.h>

// Websocket Message
String message = "";

// WiFi or AP ssid and password
const char *ssid = "yBandung";
const char *password = "ybandung";

// Create AsyncWebServer object on port 80
AsyncWebServer server(80);

// Create a WebSocket object
AsyncWebSocket ws("/ws");

// Servo and its Pin
Servo servo1;
#define servoPin 13

// Mode (Manual or Automatic) and its Value (Degree or Delay) for Servo
String mode = "manual";
String value;

// Initialize LittleFS
void initFS() {
  if (!LittleFS.begin()) {
    Serial.println("An error has occurred while mounting LittleFS");
  } else {
    Serial.println("LittleFS mounted successfully");
  }
}

// Initialize WiFi (ESP32 Connect to WiFi)
void initWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi ..");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print('.');
    delay(1000);
  }
  Serial.println(WiFi.localIP());
}

// Initialize AP (ESP32 as Access Point)
void initAP() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid, password);
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);
}

void notifyClients(String state) {
  ws.textAll(state);
}

void handleWebSocketMessage(void *arg, uint8_t *data, size_t len) {
  AwsFrameInfo *info = (AwsFrameInfo *)arg;
  if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
    data[len] = 0;
    message = (char *)data;
    mode = message.substring(0, message.indexOf("&"));
    value = message.substring(message.indexOf("&") + 1, message.length());
    Serial.print("mode");
    Serial.println(mode);
    Serial.print("value");
    Serial.println(value);
    if (mode == "manual") {
      servo1.write(value.toInt());
      notifyClients(value);
    }
  }
}

void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
  switch (type) {
    case WS_EVT_CONNECT:
      Serial.printf("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
      break;
    case WS_EVT_DISCONNECT:
      Serial.printf("WebSocket client #%u disconnected\n", client->id());
      break;
    case WS_EVT_DATA:
      handleWebSocketMessage(arg, data, len);
      break;
    case WS_EVT_PONG:
    case WS_EVT_ERROR:
      break;
  }
}

void initWebSocket() {
  ws.onEvent(onEvent);
  server.addHandler(&ws);
}

void setup() {
  Serial.begin(115200);

  // Choose 1 (Connect to WiFi or As AP)
  // initWiFi();
  // OR
  initAP();

  initWebSocket();
  initFS();

  servo1.attach(servoPin);

  // Web Server Root URL
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/index.html", "text/html");
  });
  server.serveStatic("/", LittleFS, "/");
  server.begin();
}

void loop() {
  if (mode == "automatic") {
    for (int posDegrees = 0; posDegrees <= 180; posDegrees++) {
      servo1.write(posDegrees);
      delay(value.toInt());
    }

    for (int posDegrees = 180; posDegrees >= 0; posDegrees--) {
      servo1.write(posDegrees);d
      delay(value.toInt());
    }
  }
  ws.cleanupClients();
}