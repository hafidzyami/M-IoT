import asyncio
import logging
import cv2
import numpy as np
import aiocoap
import aiocoap.resource as resource
from picamera2 import Picamera2
from libcamera import controls

# --- Konfigurasi ---
logging.basicConfig(level=logging.INFO)
logging.getLogger("coap-server").setLevel(logging.INFO)

# --- Inisialisasi Kamera ---
picam2 = Picamera2()
video_config = picam2.create_video_configuration(main={"size": (640, 480)})
picam2.configure(video_config)
picam2.set_controls({"AfMode": controls.AfModeEnum.Continuous, "AwbEnable": True})
picam2.start()
logging.info("✅ Kamera Picamera2 berhasil diinisialisasi.")

# --- Variabel Global untuk Kontrol Stream ---
streaming_active = False
# Buat instance resource di scope global agar bisa diakses oleh task kamera
stream_resource = None 

async def camera_and_notification_task():
    """
    Satu task latar belakang yang menangani pengambilan gambar dan pengiriman notifikasi.
    """
    logging.info("📸 Task kamera dan notifikasi dimulai.")
    while True:
        try:
            # Periksa langsung daftar observer (_observations) untuk keandalan
            if streaming_active and stream_resource is not None and stream_resource._observations:
                frame_rgb = picam2.capture_array("main")
                frame_bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
                ret, buffer = cv2.imencode('.jpg', frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
                
                if ret:
                    # Perbarui frame terbaru di resource
                    stream_resource.latest_frame = buffer.tobytes()
                    # Picu pengiriman notifikasi ke semua observer
                    stream_resource.updated_state()
                    logging.info(f"📤 Mengirim notifikasi frame ({len(stream_resource.latest_frame)} bytes)")
                
                # Atur FPS dengan memberi jeda singkat
                await asyncio.sleep(0.05) # Target ~20 FPS
            else:
                # Jika tidak ada yang perlu dilakukan, istirahat sejenak untuk menghemat CPU
                await asyncio.sleep(0.5)
        except Exception as e:
            logging.error(f"❌ Error di dalam task kamera: {e}")
            await asyncio.sleep(1)

class StreamResource(resource.ObservableResource):
    """
    Resource CoAP yang dapat diobservasi untuk streaming video.
    """
    def __init__(self):
        super().__init__()
        self.latest_frame = None

    async def render_get(self, request):
        """Menangani permintaan GET (termasuk permintaan Observe awal)."""
        if self.latest_frame is None:
            return aiocoap.Message(payload=b'Stream not started or no frame yet', code=aiocoap.CONTENT)
        return aiocoap.Message(payload=self.latest_frame, content_format=60) # 60 = image/jpeg

    async def render_put(self, request):
        """Menangani permintaan PUT untuk start/stop stream."""
        global streaming_active
        payload = request.payload.decode('utf-8').lower()
        logging.info(f"🕹️ Menerima perintah PUT: {payload}")

        if payload == 'start':
            if not streaming_active:
                streaming_active = True
                logging.info("▶️ Streaming diaktifkan.")
            return aiocoap.Message(code=aiocoap.CHANGED, payload=b'Stream started')
        elif payload == 'stop':
            if streaming_active:
                streaming_active = False
                logging.info("⏹️ Streaming dihentikan.")
            return aiocoap.Message(code=aiocoap.CHANGED, payload=b'Stream stopped')
        else:
            return aiocoap.Message(code=aiocoap.BAD_REQUEST, payload=b'Invalid command')
            
    # Ubah menjadi fungsi biasa (def) untuk menghilangkan RuntimeWarning
    def update_observation_count(self, count):
        """Dipanggil saat jumlah observer berubah."""
        logging.info(f"👀 Jumlah observer sekarang: {count}")

class CaptureResource(resource.Resource):
    """Resource CoAP untuk mengambil satu foto."""
    async def render_get(self, request):
        """Menangani permintaan GET untuk capture."""
        logging.info("📸 Perintah capture diterima.")
        try:
            frame_rgb = picam2.capture_array("main")
            frame_bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
            ret, buffer = cv2.imencode('.jpg', frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
            
            if ret:
                logging.info(f"🖼️ Foto berhasil diambil ({len(buffer)} bytes). Mengirim...")
                return aiocoap.Message(payload=buffer.tobytes(), content_format=60)
            else:
                return aiocoap.Message(code=aiocoap.INTERNAL_SERVER_ERROR, payload=b'Failed to encode image')
        except Exception as e:
            logging.error(f"❌ Error saat capture: {e}")
            return aiocoap.Message(code=aiocoap.INTERNAL_SERVER_ERROR)

async def main():
    """Fungsi utama untuk menjalankan server CoAP."""
    global stream_resource
    
    root = resource.Site()
    
    # Buat instance resource dan simpan di variabel global
    stream_resource = StreamResource()
    root.add_resource(['stream'], stream_resource)
    root.add_resource(['capture'], CaptureResource())

    # Jalankan task kamera di latar belakang
    asyncio.create_task(camera_and_notification_task())

    # Jalankan server CoAP
    await aiocoap.Context.create_server_context(root)
    logging.info("🚀 Server CoAP berjalan. Tekan Ctrl+C untuk berhenti.")
    await asyncio.get_running_loop().create_future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️ Server dihentikan.")
    finally:
        picam2.stop()
        logging.info(" Kamera dihentikan.")