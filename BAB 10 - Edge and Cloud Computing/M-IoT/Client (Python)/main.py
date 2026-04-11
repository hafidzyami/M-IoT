import cv2
import subprocess
import threading
import queue

# --- CONFIGURATION ---
FFMPEG_PATH = r"C:\Users\hafid\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"

# Replace with your VM's public IP
SRT_URL = "srt://miot.profybandung.cloud:8890?mode=caller&latency=200000&streamid=publish:miotybhs"
WIDTH = 1280
HEIGHT = 720
FPS = 30

# FFmpeg Command
# we use 'mpegts' format because SRT requires it.
command = [
    FFMPEG_PATH,
    '-y',
    '-f', 'rawvideo',
    '-vcodec', 'rawvideo',
    '-pix_fmt', 'bgr24',
    '-s', f"{WIDTH}x{HEIGHT}",
    '-r', str(FPS),
    '-thread_queue_size', '1024',
    '-i', '-',  # Read from stdin
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-g', str(FPS * 2),
    '-f', 'mpegts',
    SRT_URL
]

# Start FFmpeg process
process = subprocess.Popen(command, stdin=subprocess.PIPE)

# Bounded queue decouples the webcam read loop from FFmpeg's stdin.
# If the downstream SRT/MediaMTX pipeline backpressures (e.g. a WebRTC
# subscriber attaches), the writer thread blocks on process.stdin.write()
# instead of the capture loop — so the webcam keeps being serviced and
# Windows Media Foundation doesn't time out the device.
frame_q: "queue.Queue[bytes]" = queue.Queue(maxsize=4)
stop_flag = threading.Event()


def writer():
    while not stop_flag.is_set():
        try:
            buf = frame_q.get(timeout=0.5)
        except queue.Empty:
            continue
        try:
            process.stdin.write(buf)
        except (BrokenPipeError, OSError):
            stop_flag.set()
            return


writer_thread = threading.Thread(target=writer, daemon=True)
writer_thread.start()

# Use DirectShow backend explicitly — more reliable than the default
# Media Foundation backend on Windows for long-running webcam sessions.
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)
cap.set(cv2.CAP_PROP_FPS, FPS)

print(f"Streaming to {SRT_URL}...")
print("Press 'q' to stop.")

try:
    while cap.isOpened() and not stop_flag.is_set():
        ret, frame = cap.read()
        if not ret:
            # Transient grab failure — don't exit, just wait briefly and retry.
            cv2.waitKey(10)
            continue

        # --- AI / COMPUTER VISION SPACE ---
        # Since you're an AI Engineer, this is where you'd put:
        # results = model(frame)
        # cv2.putText(frame, "Object Detected", (50, 50), ...)

        cv2.putText(frame, "M-IoT Live Stream", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        # Show local preview
        cv2.imshow('Local Preview', frame)

        # Hand the frame off to the writer thread. If the queue is full
        # (downstream is slow), drop the oldest frame and insert the newest
        # so latency stays bounded.
        buf = frame.tobytes()
        try:
            frame_q.put_nowait(buf)
        except queue.Full:
            try:
                frame_q.get_nowait()
            except queue.Empty:
                pass
            try:
                frame_q.put_nowait(buf)
            except queue.Full:
                pass

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
finally:
    stop_flag.set()
    cap.release()
    try:
        process.stdin.close()
    except Exception:
        pass
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
    writer_thread.join(timeout=2)
    cv2.destroyAllWindows()
