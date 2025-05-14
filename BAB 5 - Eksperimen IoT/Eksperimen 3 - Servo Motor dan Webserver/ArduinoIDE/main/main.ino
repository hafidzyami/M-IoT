/*
 * MAX30102 Pulse Oximeter Sensor dengan ESP32
 * 
 * Kode ini menggunakan library MAX30105 untuk membaca data detak jantung
 * dan saturasi oksigen dari sensor MAX30102.
 * 
 * Koneksi:
 * MAX30102 SDA -> ESP32 GPIO 32
 * MAX30102 SCL -> ESP32 GPIO 33
 * MAX30102 VIN -> ESP32 3.3V
 * MAX30102 GND -> ESP32 GND
 * 
 * Library yang dibutuhkan:
 * - SparkFun MAX3010x Pulse and Proximity Sensor Library (oleh SparkFun)
 * - Arduino DebugUtils (opsional, untuk debugging)
 */

#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"
#include "spo2_algorithm.h"

// Definisi pin I2C kustom
#define SDA_PIN 32
#define SCL_PIN 33

MAX30105 particleSensor;

// Variabel untuk kalkulasi detak jantung
const byte RATE_SIZE = 4; // Jumlah sampel untuk menghitung rata-rata
byte rates[RATE_SIZE];    // Array untuk menyimpan detak jantung yang diukur
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute;
int beatAvg;

// Variabel untuk kalkulasi SpO2
uint32_t irBuffer[100];   // Buffer data infrared
uint32_t redBuffer[100];  // Buffer data merah
int32_t bufferLength = 100; // Ukuran buffer
int32_t spo2;             // Nilai SpO2
int8_t validSPO2;         // Indikator valid (1 jika data valid)
int32_t heartRate;        // Nilai detak jantung dari algoritma SpO2
int8_t validHeartRate;    // Indikator valid (1 jika data valid)

byte pulseLED = 2;        // LED indikator detak jantung (opsional)
byte readLED = 19;        // LED indikator pembacaan sensor (opsional)

void setup() {
  Serial.begin(115200);
  Serial.println("MAX30102 Pulse Oximeter Test");

  // Inisialisasi LED indikator (opsional)
  pinMode(pulseLED, OUTPUT);
  pinMode(readLED, OUTPUT);

  // Inisialisasi Wire dengan pin kustom
  Wire.begin(SDA_PIN, SCL_PIN);
  
  // Inisialisasi sensor MAX30102
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102 tidak terdeteksi. Silakan periksa koneksi/pengkabelan.");
    while (1);
  }

  // Konfigurasi sensor untuk pembacaan SpO2
  byte ledBrightness = 60; // Opsi: 0=Off hingga 255=50mA
  byte sampleAverage = 4;  // Opsi: 1, 2, 4, 8, 16, 32
  byte ledMode = 2;        // Opsi: 1=Red only, 2=Red+IR, 3=Red+IR+Green
  byte sampleRate = 100;   // Opsi: 50, 100, 200, 400, 800, 1000, 1600, 3200
  int pulseWidth = 411;    // Opsi: 69, 118, 215, 411
  int adcRange = 4096;     // Opsi: 2048, 4096, 8192, 16384

  particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  
  // Mulai mengambil data SpO2
  particleSensor.enableDIETEMPRDY(); // Aktifkan interupsi untuk temperatur
}

void loop() {
  // Metode 1: Pengukuran detak jantung sederhana
  digitalWrite(readLED, !digitalRead(readLED)); // Toggle LED

  long irValue = particleSensor.getIR();

  if (irValue > 50000) {
    // Tangan terdeteksi pada sensor
    
    // Periksa untuk detak jantung
    if (checkForBeat(irValue) == true) {
      // Detak terdeteksi
      digitalWrite(pulseLED, HIGH);
      long delta = millis() - lastBeat;
      lastBeat = millis();

      beatsPerMinute = 60 / (delta / 1000.0);

      if (beatsPerMinute < 255 && beatsPerMinute > 20) {
        rates[rateSpot++] = (byte)beatsPerMinute;
        rateSpot %= RATE_SIZE;

        // Hitung rata-rata detak jantung
        beatAvg = 0;
        for (byte x = 0; x < RATE_SIZE; x++)
          beatAvg += rates[x];
        beatAvg /= RATE_SIZE;
      }
    } else {
      digitalWrite(pulseLED, LOW);
    }

    // Metode 2: Pengukuran SpO2 dan detak jantung menggunakan algoritma Maxim
    // Mengambil 100 sampel sekaligus
    for (byte i = 0; i < bufferLength; i++) {
      while (particleSensor.available() == false)
        particleSensor.check(); // Periksa sensor

      redBuffer[i] = particleSensor.getRed();
      irBuffer[i] = particleSensor.getIR();
      particleSensor.nextSample(); // Sampel berikutnya
    }

    // Kalkulasi SpO2 menggunakan algoritma Maxim
    maxim_heart_rate_and_oxygen_saturation(irBuffer, bufferLength, redBuffer, &spo2, &validSPO2, &heartRate, &validHeartRate);

    // Tampilkan hasil
    Serial.print("IR=");
    Serial.print(irValue);
    
    Serial.print(", BPM=");
    Serial.print(beatsPerMinute);
    
    Serial.print(", Avg BPM=");
    Serial.print(beatAvg);

    if (validSPO2) {
      Serial.print(", SpO2=");
      Serial.print(spo2);
      Serial.print("%");
    }

    if (validHeartRate) {
      Serial.print(", HR from SpO2=");
      Serial.print(heartRate);
    }
    
    Serial.println();
  } else {
    // Tangan tidak terdeteksi pada sensor
    Serial.println("Harap letakkan jari Anda pada sensor!");
    
    // Reset nilai detak jantung
    for (byte i = 0; i < RATE_SIZE; i++)
      rates[i] = 0;
    beatAvg = 0;
    rateSpot = 0;
    lastBeat = 0;
  }

  delay(100); // Jeda singkat
}