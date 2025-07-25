from flask import Flask, render_template_string, Response, send_file
import cv2
import io

# Inisialisasi aplikasi Flask
app = Flask(__name__)

# Inisialisasi kamera
camera = cv2.VideoCapture(0) # Untuk USB webcam pertama.
if not camera.isOpened():
    raise RuntimeError("Tidak dapat memulai kamera. Pastikan terhubung dengan benar.")

def generate_frames():
    """
    Generator yang mengambil frame dari kamera, meng-encode-nya sebagai JPEG,
    dan mengirimkannya dalam format MJPEG.
    """
    while True:
        # Baca satu frame dari kamera
        success, frame = camera.read()
        if not success:
            print("Gagal membaca frame dari kamera. Mencoba lagi...")
            continue
        else:
            # Encode frame ke format JPEG
            ret, buffer = cv2.imencode('.jpg', frame)
            if not ret:
                print("Gagal meng-encode frame. Melewatkan frame ini.")
                continue

            # Konversi buffer ke bytes
            frame_bytes = buffer.tobytes()

            # Kirim frame sebagai bagian dari stream multipart
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/')
def index():
    """Menyajikan halaman web utama."""
    # HTML dan JavaScript disematkan langsung di sini untuk kemudahan
    return render_template_string(HTML_TEMPLATE)

@app.route('/video_feed')
def video_feed():
    """Endpoint untuk video stream MJPEG."""
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/capture')
def capture():
    """Endpoint untuk mengambil satu foto."""
    success, frame = camera.read()
    if not success:
        return "Gagal mengambil gambar", 500

    ret, buffer = cv2.imencode('.jpg', frame)
    if not ret:
        return "Gagal meng-encode gambar", 500

    # Kirim gambar sebagai file untuk diunduh atau ditampilkan
    return send_file(
        io.BytesIO(buffer),
        mimetype='image/jpeg',
        as_attachment=True,
        download_name='capture.jpg'
    )

# --- TEMPLATE HTML ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
<title>Raspberry Pi - Camera Server</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f0f0f0; text-align: center; }
    .container { max-width: 800px; margin: auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    #video-stream { width: 100%; max-width: 640px; height: auto; border: 2px solid #ddd; border-radius: 8px; background: #000; }
    .btn-container { margin-top: 20px; }
    .btn { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 5px; font-size: 16px; cursor: pointer; margin: 5px; }
    .btn:hover { background: #0056b3; }
    #capture-container { margin-top: 20px; }
    #captured-image { max-width: 100%; border-radius: 8px; border: 2px solid #28a745; }
</style>
</head>
<body>
<div class="container">
    <h1>Raspberry Pi Camera Server</h1>
    <p>Live stream dari kamera yang terhubung.</p>
    <img id="video-stream" src="{{ url_for('video_feed') }}">
    <div class="btn-container">
        <button class="btn" onclick="capturePhoto()">Ambil Foto</button>
    </div>
    <div id="capture-container"></div>
</div>

<script>
function capturePhoto() {
    const container = document.getElementById('capture-container');
    container.innerHTML = '<p>Mengambil foto...</p>';
    
    #  Panggil endpoint /capture
    fetch('/capture')
        .then(response => {
            if (!response.ok) {
                throw new Error('Gagal mengambil foto. Status: ' + response.status);
            }
            return response.blob();
        })
        .then(blob => {
            const imageUrl = URL.createObjectURL(blob);
            container.innerHTML = '<h2>Foto yang Diambil:</h2>';
            
            const img = document.createElement('img');
            img.id = 'captured-image';
            img.src = imageUrl;
            
            const downloadLink = document.createElement('a');
            downloadLink.href = imageUrl;
            downloadLink.download = 'capture.jpg';
            downloadLink.textContent = 'Unduh Foto';
            downloadLink.className = 'btn';
            
            container.appendChild(img);
            container.appendChild(document.createElement('br'));
            container.appendChild(downloadLink);
        })
        .catch(error => {
            console.error('Error:', error);
            container.innerHTML = `<p style="color: red;">${error.message}</p>`;
        });
}
</script>
</body>
</html>
"""

if __name__ == '__main__':
    # Jalankan server Flask
    # host='0.0.0.0' membuat server dapat diakses dari perangkat lain di jaringan yang sama
    print("Server dimulai. Buka browser dan arahkan ke http://<IP_RASPBERRY_PI>:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)