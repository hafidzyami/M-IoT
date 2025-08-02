#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_BMP280.h>
#include <ESP32Servo.h>

// WiFi credentials
const char* ssid = "hafidzyami";
const char* password = "hafidz";

// MQTT Broker settings
const char* mqtt_server = "reksti.profybandung.cloud";
const int mqtt_port = 1883;

// MQTT Topics
const char* led_topic = "reksti-yb/led";
const char* servo_topic = "reksti-yb/servo";
const char* sensor_topic = "reksti-yb/sensor";

// Pin definitions - Using available pins
const int LED_PIN = 25;      // Using GPIO 25 for LED
const int SERVO_PIN = 26;    // Using GPIO 26 for Servo
// I2C pins for BMP280
const int SDA_PIN = 32;      // Using GPIO 32 for SDA
const int SCL_PIN = 33;      // Using GPIO 33 for SCL

// Objects
WiFiClient espClient;
PubSubClient client(espClient);
Adafruit_BMP280 bmp;
Servo myServo;

// Variables
unsigned long lastSensorPublish = 0;
bool autoServoMode = false;
int servoPosition = 0;
bool servoDirection = true; // true = increasing, false = decreasing
unsigned long lastServoMove = 0;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
      // Subscribe to topics
      client.subscribe(led_topic);
      client.subscribe(servo_topic);
      Serial.println("Subscribed to topics");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  Serial.println(message);
  
  // Handle LED topic
  if (String(topic) == led_topic) {
    if (message == "0") {
      digitalWrite(LED_PIN, LOW);
    } else if (message == "1") {
      digitalWrite(LED_PIN, HIGH);
    }
  }
  
  // Handle Servo topic
  if (String(topic) == servo_topic) {
    int angle = message.toInt();
    
    if (angle >= 0 && angle <= 180) {
      autoServoMode = false;
      myServo.write(angle);
      Serial.print("Servo moved to: ");
      Serial.println(angle);
    } else if (angle == 181) {
      autoServoMode = true;
      servoPosition = 0;
      servoDirection = true;
      Serial.println("Servo auto mode activated");
    }
  }
}

void publishSensorData() {
  float temperature = bmp.readTemperature();
  float pressure = bmp.readPressure() / 100.0F; // Convert to hPa
  
  // BMP280 doesn't have humidity sensor, so we'll send 0
  // If you have BME280, you can read humidity here
  float humidity = 0.0;
  
  String jsonData = "{";
  jsonData += "\"temperature\":" + String(temperature, 2) + ",";
  jsonData += "\"pressure\":" + String(pressure, 2) + ",";
  jsonData += "\"humidity\":" + String(humidity, 2);
  jsonData += "}";
  
  client.publish(sensor_topic, jsonData.c_str());
  
  Serial.print("Published sensor data: ");
  Serial.println(jsonData);
}

void handleAutoServo() {
  if (millis() - lastServoMove >= 15) {
    lastServoMove = millis();
    
    if (servoDirection) {
      servoPosition++;
      if (servoPosition >= 180) {
        servoDirection = false;
      }
    } else {
      servoPosition--;
      if (servoPosition <= 0) {
        servoDirection = true;
      }
    }
    
    myServo.write(servoPosition);
  }
}

void setup() {
  Serial.begin(115200);
  
  // Initialize LED pin
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  
  // Initialize servo
  myServo.attach(SERVO_PIN);
  myServo.write(0);
  
  // Initialize I2C with custom pins - This must be done before initializing BMP280
  Wire.begin(SDA_PIN, SCL_PIN);
  
  // Initialize BMP280
  if (!bmp.begin(0x76)) {  // Try address 0x76 first
    Serial.println("Could not find BMP280 sensor at 0x76, trying 0x77...");
    if (!bmp.begin(0x77)) {  // Try address 0x77
      Serial.println("Could not find BMP280 sensor!");
      Serial.println("Check wiring!");
      while (1) {
        delay(1000);
      }
    }
  }
  
  Serial.println("BMP280 sensor found!");
  
  // Configure BMP280
  bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                  Adafruit_BMP280::SAMPLING_X2,
                  Adafruit_BMP280::SAMPLING_X16,
                  Adafruit_BMP280::FILTER_X16,
                  Adafruit_BMP280::STANDBY_MS_500);
  
  // Connect to WiFi
  setup_wifi();
  
  // Setup MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  // Maintain MQTT connection
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Publish sensor data every 1 second
  if (millis() - lastSensorPublish >= 1000) {
    lastSensorPublish = millis();
    publishSensorData();
  }
  
  // Handle auto servo mode
  if (autoServoMode) {
    handleAutoServo();
  }
}