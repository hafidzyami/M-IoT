// --- Definisi Pin ---
const int potPin = 2; // Pin untuk Potensiometer (ADC1)
const int ledPin = 5; // Pin untuk LED

// --- Pengaturan PWM ---
const int freq = 5000;    // Frekuensi PWM 5000 Hz
const int resolution = 8; // Resolusi PWM 8-bit (nilai 0-255)

void setup() {
  // Inisialisasi Serial Monitor untuk debugging (opsional)
  Serial.begin(115200);

  // Mengkonfigurasi pin LED untuk output PWM menggunakan API baru.
  // Fungsi ini menggantikan ledcSetup() dan ledcAttachPin().
  ledcAttach(ledPin, freq, resolution);
}

void loop() {
  // 1. Baca nilai analog dari potensiometer (0 - 4095)
  int potValue = analogRead(potPin);

  // 2. Konversi (mapping) nilai potensiometer (0-4095) ke rentang PWM (0-255)
  int pwmValue = map(potValue, 0, 4095, 0, 255);

  // 3. Tulis nilai PWM ke pin LED untuk mengatur kecerahan.
  // Perhatikan bahwa kita menggunakan ledPin, bukan channel.
  ledcWrite(ledPin, pwmValue);

  // Menampilkan nilai ke Serial Monitor (opsional)
  Serial.print("Nilai Potensiometer: ");
  Serial.print(potValue);
  Serial.print("  ->  Nilai PWM: ");
  Serial.println(pwmValue);

  // Beri jeda singkat
  delay(50);
}