import io
import time
import logging
import threading
from flask import Flask, render_template_string, Response, send_file
from flask_socketio import SocketIO, emit
from picamera2 import Picamera2
from picamera2.encoders import JpegEncoder
from picamera2.outputs import FileOutput
from libcamera import controls
import cv2
import numpy as np

# --- Konfigurasi ---
logging.basicConfig(level=logging.INFO)
logging.getLogger('picamera2').setLevel(logging.CRITICAL)
logging.getLogger('engineio').setLevel(logging.WARNING)
logging.getLogger('socketio').setLevel(logging.WARNING)

# Inisialisasi aplikasi Flask dan SocketIO
app = Flask(__name__)
socketio = SocketIO(app, async_mode='threading')

# --- Inisialisasi Kamera ---
picam2 = Picamera2()
# Gunakan satu konfigurasi untuk video dan capture agar stabil
video_config = picam2.create_video_configuration(main={"size": (640, 480)})
picam2.configure(video_config)
picam2.set_controls({"AfMode": controls.AfModeEnum.Continuous, "AwbEnable": True})

# --- Kelas untuk Streaming Output (Thread-Safe) ---
class StreamingOutput(io.BufferedIOBase):
    def __init__(self):
        self.frame = None
        self.condition = threading.Condition()

    def write(self, buf):
        with self.condition:
            self.frame = buf
            self.condition.notify_all()
        return len(buf)

output = StreamingOutput()
encoder = JpegEncoder(q=75)
picam2.start_recording(encoder, FileOutput(output))
logging.info("Kamera telah memulai rekaman untuk streaming.")

# Variabel global untuk mengelola thread streaming
stream_thread = None
stop_streaming = threading.Event()

def stream_to_clients():
    """
    Thread yang berjalan di latar belakang untuk mengambil frame dari kamera
    dan mengirimkannya ke semua client WebSocket yang terhubung.
    """
    logging.info("Memulai thread streaming WebSocket...")
    while not stop_streaming.is_set():
        with output.condition:
            output.condition.wait()
            frame = output.frame
        # Mengirim frame sebagai pesan biner ke semua client
        socketio.emit('video_frame', frame)
        socketio.sleep(0) # Memberi kesempatan pada task lain
    logging.info("Thread streaming WebSocket dihentikan.")

@app.route('/')
def index():
    """Menyajikan halaman web utama."""
    return render_template_string(HTML_TEMPLATE)

@socketio.on('connect')
def handle_connect():
    """Dipanggil saat client baru terhubung."""
    global stream_thread
    logging.info(f"Client terhubung: {threading.active_count() - 1} client aktif.")
    # Mulai thread streaming jika ini adalah client pertama
    if stream_thread is None or not stream_thread.is_alive():
        stop_streaming.clear()
        stream_thread = socketio.start_background_task(target=stream_to_clients)

@socketio.on('disconnect')
def handle_disconnect():
    logging.info("Client terputus.")

@socketio.on('capture')
def handle_capture_request():
    """
    Menangani permintaan untuk mengambil satu foto.
    Mengambil frame dari stream aktif tanpa beralih mode.
    """
    try:
        logging.info("Perintah capture diterima, mengambil frame dari stream...")
        frame_array_rgb = picam2.capture_array("main")
        frame_bgr = cv2.cvtColor(frame_array_rgb, cv2.COLOR_RGB2BGR)
        ret, buffer = cv2.imencode('.jpg', frame_bgr)
        if ret:
            logging.info("Mengirim foto hasil capture...")
            # Mengirim foto kembali ke client yang memintanya
            emit('capture_response', buffer.tobytes())
    except Exception as e:
        logging.error(f"Error saat capture: {e}")

# --- TEMPLATE HTML (Diadaptasi untuk WebSocket) ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
<title>M-IoT by YB & HS</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
.container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
.header { text-align: center; margin-bottom: 30px; padding: 20px; background: #2c3e50; color: white; border-radius: 8px; }
.content { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
.column { background: #fafafa; border-radius: 8px; padding: 20px; border: 1px solid #ddd; }
h2 { color: #2c3e50; margin-bottom: 20px; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
.stream-container { background: #000; border-radius: 8px; overflow: hidden; margin-bottom: 15px; position: relative; }
.stream-img { width: 100%; height: auto; display: block; }
.photo-container { background: #fff; border: 2px dashed #ddd; border-radius: 8px; min-height: 300px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px; text-align: center; color: #666; }
.photo-container img { max-width: 100%; height: auto; border-radius: 4px; }
.btn { background: #3498db; color: white; border: none; padding: 12px 24px; border-radius: 4px; font-size: 14px; cursor: pointer; margin: 5px; }
.btn:hover { background: #2980b9; }
.btn:disabled { background: #bdc3c7; cursor: not-allowed; }
.btn-success { background: #27ae60; }
.btn-success:hover { background: #229954; }
.controls { text-align: center; }
.status { background: #ecf0f1; padding: 10px; border-radius: 4px; margin-bottom: 15px; text-align: center; font-weight: 500; }
@media (max-width: 768px) { .content { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>M-IoT by YB & HS</h1>
    <p>[WebSocket] Live Stream and Photo Capture</p>
  </div>
  <div class="content">
    <div class="column">
      <h2>Live Stream</h2>
      <div class="stream-container">
        <img src="" class="stream-img" id="streamImg">
      </div>
    </div>
    <div class="column">
      <h2>Photo Capture</h2>
      <div class="status" id="status">Ready to capture</div>
      <div class="photo-container" id="photoContainer">
        Click Take Photo to capture an image
      </div>
      <div class="controls">
        <button class="btn btn-success" onclick="takePhoto()" id="captureBtn">Take Photo</button>
        <button class="btn" onclick="downloadPhoto()" id="downloadBtn" disabled>Download Photo</button>
      </div>
    </div>
  </div>
</div>

<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
<script>
let lastPhotoUrl = '';
const streamImg = document.getElementById('streamImg');

function updateStatus(message) {
  document.getElementById('status').textContent = message;
}

const socket = io();

socket.on('connect', () => {
    console.log('Terhubung ke server WebSocket!');
    updateStatus('Terhubung dan siap.');
});

socket.on('video_frame', (imageBytes) => {
    // Terima data biner, buat Blob, lalu Object URL
    const blob = new Blob([imageBytes], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    streamImg.src = url;
    // Hapus URL lama setelah yang baru dimuat untuk menghemat memori
    streamImg.onload = () => {
        URL.revokeObjectURL(url);
    }
});

socket.on('capture_response', (imageBytes) => {
    const photoContainer = document.getElementById('photoContainer');
    const downloadBtn = document.getElementById('downloadBtn');
    
    const blob = new Blob([imageBytes], { type: 'image/jpeg' });
    if (lastPhotoUrl) URL.revokeObjectURL(lastPhotoUrl);
    lastPhotoUrl = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
        photoContainer.innerHTML = '';
        photoContainer.appendChild(img);
        downloadBtn.disabled = false;
        updateStatus('Foto berhasil diambil!');
    };
    img.src = lastPhotoUrl;
});

function takePhoto() {
  const captureBtn = document.getElementById('captureBtn');
  captureBtn.disabled = true;
  captureBtn.textContent = 'Capturing...';
  updateStatus('Mengirim permintaan capture...');
  
  socket.emit('capture');

  // Set timeout untuk mengaktifkan kembali tombol jika tidak ada respons
  setTimeout(() => {
      captureBtn.disabled = false;
      captureBtn.textContent = 'Take Photo';
  }, 2000); // Timeout 2 detik
}

function downloadPhoto() {
  if (lastPhotoUrl) {
    const link = document.createElement('a');
    link.href = lastPhotoUrl;
    link.download = `raspberrypi_photo_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    updateStatus('Download foto dimulai...');
  }
}
</script>
</body>
</html>
"""

if __name__ == '__main__':
    try:
        logging.info(f"Server WebSocket berjalan. Buka browser ke http://<IP_RASPBERRY_PI>:8000")
        socketio.run(app, host='0.0.0.0', port=8000)
    finally:
        stop_streaming.set()
        if stream_thread:
            stream_thread.join()
        picam2.stop_recording()
        logging.info("Kamera dan server dihentikan.")
