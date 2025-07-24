import cv2
import paho.mqtt.client as mqtt
import numpy as np
import time
import sys
from datetime import datetime

# --- KONFIGURASI ---
MQTT_BROKER = "192.168.0.139"  # Ganti dengan IP Broker MQTT Anda
MQTT_PORT = 1883
IMAGE_TOPIC = "esp32/camera/image"
STATUS_TOPIC = "esp32/camera/status"
COMMAND_TOPIC = "esp32/camera/command"

# --- VARIABEL GLOBAL ---
frame_count = 0
start_time = 0
last_frame_time = 0
fps_samples = []
# Variabel untuk menandakan bahwa gambar untuk capture sudah diterima
image_for_capture_received = False 

def calculate_fps():
    """Menghitung FPS rata-rata dari beberapa sampel terakhir."""
    global last_frame_time, fps_samples
    current_time = time.time()
    if last_frame_time > 0:
        frame_interval = current_time - last_frame_time
        if frame_interval > 0:
            fps = 1.0 / frame_interval
            fps_samples.append(fps)
            if len(fps_samples) > 20:
                fps_samples.pop(0)
            last_frame_time = current_time
            return sum(fps_samples) / len(fps_samples)
    last_frame_time = current_time
    return 0.0

def on_connect(client, userdata, flags, rc):
    """Callback yang dipanggil saat berhasil terhubung ke broker."""
    if rc == 0:
        print("Berhasil terhubung ke Broker MQTT!")
        # Berlangganan ke semua topik yang relevan
        client.subscribe(IMAGE_TOPIC)
        client.subscribe(STATUS_TOPIC)
        print(f"Berlangganan ke topik '{IMAGE_TOPIC}' dan '{STATUS_TOPIC}'")
    else:
        print(f"Gagal terhubung, return code {rc}\n")

def on_message_stream(client, userdata, msg):
    """Callback yang dipanggil saat dalam mode streaming."""
    global frame_count, start_time
    if msg.topic == STATUS_TOPIC:
        print(f"[STATUS] {msg.payload.decode()}")
        return
    if msg.topic == IMAGE_TOPIC:
        try:
            nparr = np.frombuffer(msg.payload, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is not None:
                frame_count += 1
                current_fps = calculate_fps()
                elapsed_time = time.time() - start_time
                avg_fps = frame_count / elapsed_time if elapsed_time > 0 else 0
                
                info1 = f"FPS: {current_fps:.1f} (Avg: {avg_fps:.1f})"
                info2 = f"Frame: {frame_count} | Size: {len(msg.payload) / 1024:.1f} KB"
                cv2.putText(img, info1, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                cv2.putText(img, info2, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                
                cv2.imshow("ESP32-CAM MQTT Stream", img)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("Keluar diminta oleh pengguna.")
                    client.disconnect()
            else:
                print("Gagal mendekode gambar JPEG.")
        except Exception as e:
            print(f"Error saat memproses gambar: {e}")

def on_message_capture(client, userdata, msg):
    """Callback yang dipanggil saat dalam mode capture."""
    global image_for_capture_received
    if msg.topic == IMAGE_TOPIC:
        print(f"Menerima gambar untuk disimpan ({len(msg.payload)} bytes)...")
        try:
            # Simpan data gambar mentah ke file
            filename = userdata['filename']
            with open(filename, 'wb') as f:
                f.write(msg.payload)
            print(f"Gambar berhasil disimpan sebagai '{filename}'")
            image_for_capture_received = True
            client.disconnect() # Hentikan loop setelah gambar diterima
        except Exception as e:
            print(f"Gagal menyimpan gambar: {e}")

def run_stream(client):
    """Menjalankan mode streaming."""
    global start_time
    client.on_message = on_message_stream
    print(f"Mengirim perintah 'stream_on'...")
    client.publish(COMMAND_TOPIC, "stream_on")
    start_time = time.time()
    client.loop_forever()

def run_capture(client, filename):
    """Menjalankan mode capture."""
    # Simpan nama file di userdata agar bisa diakses oleh callback
    userdata = {'filename': filename}
    client.user_data_set(userdata)
    client.on_message = on_message_capture
    
    print(f"Mengirim perintah 'capture'...")
    client.publish(COMMAND_TOPIC, "capture")
    
    # Jalankan loop dengan timeout
    timeout = 15 # detik
    client.loop_start()
    start_wait = time.time()
    while not image_for_capture_received and time.time() - start_wait < timeout:
        time.sleep(0.1)
    client.loop_stop()

    if not image_for_capture_received:
        print("Timeout: Tidak menerima gambar dari ESP32.")

def main():
    """Fungsi utama untuk parsing argumen dan menjalankan client."""
    if len(sys.argv) < 2 or sys.argv[1] in ['-h', '--help']:
        print("Penggunaan: python nama_file.py [IP_BROKER] [perintah] [argumen]")
        print("\nPerintah:")
        print("  stream         (default) Memulai video stream.")
        print("  capture        Mengambil satu foto dan menyimpannya.")
        print("                 [argumen]: nama file opsional (misal: fotoku.jpg)")
        return

    # Perbarui MQTT_BROKER jika diberikan sebagai argumen pertama
    global MQTT_BROKER
    MQTT_BROKER = sys.argv[1]

    command = "stream" # Perintah default
    if len(sys.argv) > 2:
        command = sys.argv[2].lower()

    client = mqtt.Client()
    client.on_connect = on_connect

    try:
        print(f"Menghubungkan ke broker MQTT di {MQTT_BROKER}...")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)

        if command == "stream":
            run_stream(client)
        elif command == "capture":
            filename = "capture.jpg" # Nama file default
            if len(sys.argv) > 3:
                filename = sys.argv[3]
            run_capture(client, filename)
        else:
            print(f"Perintah tidak dikenal: {command}")

    except KeyboardInterrupt:
        print("\nProgram dihentikan oleh pengguna.")
    except Exception as e:
        print(f"\nError: {e}")
    finally:
        print(f"Mengirim perintah 'stream_off' untuk memastikan kamera mati...")
        if client.is_connected():
            client.publish(COMMAND_TOPIC, "stream_off")
            time.sleep(1)
        
        cv2.destroyAllWindows()
        print("Program ditutup.")

if __name__ == '__main__':
    main()