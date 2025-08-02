import paho.mqtt.client as mqtt
import time
import logging
import threading
import cv2
import numpy as np
from picamera2 import Picamera2
from libcamera import controls

# --- KONFIGURASI ---
MQTT_BROKER = "172.20.10.5"  # Ganti dengan IP Broker MQTT Anda
MQTT_PORT = 1883
IMAGE_TOPIC = "camera/image"
STATUS_TOPIC = "camera/status"
COMMAND_TOPIC = "camera/command"
FRAME_INTERVAL = 0.05 # Detik (0.05 = target 20 FPS)

# --- Inisialisasi Kamera ---
picam2 = Picamera2()
video_config = picam2.create_video_configuration(main={"size": (640, 480)})
picam2.configure(video_config)
picam2.set_controls({"AfMode": controls.AfModeEnum.Continuous, "AwbEnable": True})
picam2.start()
logging.info("Kamera Picamera2 berhasil diinisialisasi.")

# --- Variabel Global & Kontrol Thread ---
# Gunakan threading.Event untuk kontrol yang aman antar thread
stream_active = threading.Event()
client = mqtt.Client()

def publish_single_image():
    """Mengambil satu frame, meng-encode, dan mempublikasikannya."""
    try:
        # Ambil frame sebagai array NumPy (format RGB)
        frame_rgb = picam2.capture_array("main")
        # Konversi ke BGR untuk OpenCV
        frame_bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)

        # Encode frame ke format JPEG dengan kualitas 85
        ret, buffer = cv2.imencode('.jpg', frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if not ret:
            logging.warning("Gagal meng-encode frame.")
            return

        # Publikasikan frame ke topik MQTT
        client.publish(IMAGE_TOPIC, buffer.tobytes())
        logging.info(f"Frame terkirim ({len(buffer)} bytes)")

    except Exception as e:
        logging.error(f"Error saat mengambil/mengirim gambar: {e}")

def on_connect(client, userdata, flags, rc, properties=None):
    """Callback yang dipanggil saat berhasil terhubung ke broker."""
    if rc == 0:
        logging.info("Berhasil terhubung ke Broker MQTT!")
        # Berlangganan ke topik perintah
        client.subscribe(COMMAND_TOPIC)
        logging.info(f"Berlangganan ke topik: '{COMMAND_TOPIC}'")
        client.publish(STATUS_TOPIC, "Raspberry Pi Camera online")
    else:
        logging.error(f"Gagal terhubung, return code {rc}")

def on_message(client, userdata, msg):
    """Callback yang dipanggil setiap kali ada perintah masuk."""
    command = msg.payload.decode('utf-8')
    logging.info(f"Perintah diterima: '{command}'")

    if command == "stream_on":
        if not stream_active.is_set():
            stream_active.set() # Aktifkan flag streaming
            logging.info("Streaming diaktifkan.")
            client.publish(STATUS_TOPIC, "Streaming ON")
    elif command == "stream_off":
        if stream_active.is_set():
            stream_active.clear() # Nonaktifkan flag streaming
            logging.info("⏹️  Streaming dinonaktifkan.")
            client.publish(STATUS_TOPIC, "Streaming OFF")
    elif command == "capture":
        logging.info("📸 Perintah capture diterima, mengambil gambar di thread terpisah...")
        client.publish(STATUS_TOPIC, "Capture requested")
        # Jalankan publish_single_image di thread terpisah untuk menghindari deadlock
        capture_thread = threading.Thread(target=publish_single_image)
        capture_thread.start()

def stream_video():
    """
    Fungsi yang berjalan di thread terpisah untuk mengirim stream video
    secara terus-menerus jika streaming aktif.
    """
    while True:
        try:
            # Tunggu sampai flag stream_active diaktifkan
            stream_active.wait() 
            
            # Selama flag aktif, terus kirim frame
            while stream_active.is_set():
                publish_single_image()
                time.sleep(FRAME_INTERVAL) # Kontrol FPS
        except Exception as e:
            logging.error(f"Error di dalam thread streaming: {e}")
            time.sleep(2) # Jeda sebelum mencoba lagi

def main():
    """Fungsi utama untuk menjalankan publisher."""
    global client
    
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # Menggunakan Client v2 untuk menghindari DeprecationWarning
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        logging.info(f"Menghubungkan ke broker MQTT di {MQTT_BROKER}...")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        
        # Mulai thread untuk streaming di latar belakang
        streaming_thread = threading.Thread(target=stream_video, daemon=True)
        streaming_thread.start()
        
        # Jalankan loop MQTT di thread utama (blocking)
        client.loop_forever()

    except KeyboardInterrupt:
        logging.info("\nProgram dihentikan oleh pengguna.")
    except Exception as e:
        logging.error(f"\nError: {e}")
    finally:
        logging.info("Membersihkan sumber daya...")
        stream_active.set() # Pastikan thread tidak terjebak di wait()
        picam2.stop()
        if client and client.is_connected():
            client.publish(STATUS_TOPIC, "Raspberry Pi Camera offline")
            client.disconnect()
        logging.info("Program ditutup.")

if __name__ == '__main__':
    main()
