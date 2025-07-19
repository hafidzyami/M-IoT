#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SEALEVELPRESSURE_HPA (1013.25)

Adafruit_BMP280 bmp; // I2C

Adafruit_SSD1306 display = Adafruit_SSD1306(128, 64,
                           &Wire, -1);
unsigned long delayTime;

void setup() {
  Serial.begin(9600);
  Serial.println(F("BMP280 test"));

  bool status;

  // default settings
  status = bmp.begin(0x76);  
  if (!status) {
    Serial.println("Could not find a valid BMP280 
                    sensor, check wiring!");
    while (1);
  }

  Serial.println("-- Default Test --");
  delayTime = 1000;

  Serial.println();

  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);  
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println(F("SSD1306 allocation failed"));
    for(;;);
  }
  delay(2000);
  display.clearDisplay();
  display.setTextColor(WHITE);
}

void loop() { 
  printValues();
  delay(delayTime);
}

void printValues() {
  Serial.print("Temperature = ");
  Serial.print(bmp.readTemperature());
  Serial.println(" *C");
  
  Serial.print("Pressure = ");
  Serial.print(bmp.readPressure() / 100.0F);
  Serial.println(" hPa");

  Serial.print("Approx. Altitude = ");
  Serial.print(bmp.readAltitude(SEALEVELPRESSURE_HPA));
  Serial.println(" m");

  Serial.println();

  // Membersihkan layar sebelum menulis data baru
  display.clearDisplay();

  // Mengatur ukuran dan warna teks
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // --- Menampilkan Suhu ---
  display.setCursor(0, 5); 
  display.print("Suhu: ");
  display.print(bmp.readTemperature(), 1);
  display.cp437(true);       
  display.write(248);
  display.print("C");
  
  // --- Menampilkan Tekanan ---
  display.setCursor(0, 25);
  display.print("Tekanan: ");
  display.print(bmp.readPressure(), 1);
  display.print(" hPa");

  // --- Menampilkan Ketinggian ---
  display.setCursor(0, 45); 
  display.print("Ketinggian: ");
  display.print(bmp.readAltitude(SEALEVELPRESSURE_HPA), 1);
  display.print(" mdpl");
  
  // Tampilkan data pada OLED
  display.display();
  delay(1000);
}