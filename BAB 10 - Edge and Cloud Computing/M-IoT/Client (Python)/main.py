import cv2
import subprocess
import threading
import queue
import sys
import time
import re

# --- CONFIGURATION ---
FFMPEG_PATH = r"C:\Users\hafid\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"

# Replace with your VM's public IP
SRT_URL = "srt://miot.profybandung.cloud:8890?mode=caller&latency=200000&streamid=publish:miotybhs"
WIDTH = 1280
HEIGHT = 720
FPS = 30

CAMERA_INDEX = 0
WARMUP_TIMEOUT_S = 8.0          # max time to wait for the first frame
NO_FRAMES_STALL_S = 5.0         # if main loop sees no frames for this long, bail

# Set to a specific device name (as listed by FFmpeg's -list_devices) to
# override auto-detection. Leave as None to auto-pick the first DirectShow
# audio device. Set to "" (empty string) to publish video only.
AUDIO_DEVICE_OVERRIDE = None

# --- AUDIO DEVICE DETECTION ---
# FFmpeg's dshow backend captures Windows audio. We enumerate available
# DirectShow audio devices via `ffmpeg -list_devices true -f dshow -i dummy`
# (which prints the device list to stderr), then pick the first one.
def find_audio_device():
    if AUDIO_DEVICE_OVERRIDE is not None:
        return AUDIO_DEVICE_OVERRIDE or None
    try:
        result = subprocess.run(
            [FFMPEG_PATH, "-hide_banner", "-list_devices", "true",
             "-f", "dshow", "-i", "dummy"],
            capture_output=True, text=True, timeout=10
        )
    except Exception as e:
        print(f"[audio] failed to enumerate dshow devices: {e}", flush=True)
        return None

    output = (result.stderr or "") + "\n" + (result.stdout or "")
    in_audio_section = False
    audio_devices = []
    for line in output.splitlines():
        if "DirectShow audio devices" in line:
            in_audio_section = True
            continue
        if "DirectShow video devices" in line:
            in_audio_section = False
            continue
        if not in_audio_section:
            continue
        # FFmpeg prints two lines per device:
        #   [dshow @ 0x..] "Microphone (Realtek Audio)"
        #   [dshow @ 0x..]   Alternative name "@device_cm_..."
        # We want the human-readable first form.
        if "Alternative name" in line:
            continue
        m = re.search(r'"([^"]+)"', line)
        if m:
            audio_devices.append(m.group(1))

    if not audio_devices:
        print("[audio] no DirectShow audio devices found", flush=True)
        return None
    print(f"[audio] available devices: {audio_devices}", flush=True)
    print(f"[audio] using: {audio_devices[0]}", flush=True)
    return audio_devices[0]


# --- WEBCAM OPEN HELPER ---
# DSHOW is usually more reliable on Windows for long sessions, but it can be
# strict about format negotiation. MSMF works on machines where DSHOW won't
# enumerate the device. Try both, and force MJPG which essentially every
# webcam supports natively at 720p30 (much better than the default which can
# fall back to uncompressed YUY2 capped at 5–10 fps).
def open_camera():
    backends = [
        ("CAP_DSHOW", cv2.CAP_DSHOW),
        ("CAP_MSMF", cv2.CAP_MSMF),
        ("CAP_ANY", cv2.CAP_ANY),
    ]
    for name, backend in backends:
        print(f"[camera] trying {name}...", flush=True)
        cap = cv2.VideoCapture(CAMERA_INDEX, backend)
        if not cap.isOpened():
            print(f"[camera] {name} could not open device {CAMERA_INDEX}", flush=True)
            cap.release()
            continue

        # Force MJPG before setting size/fps — DSHOW negotiates the mode at
        # the time FOURCC is set, so doing it first is critical.
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)
        cap.set(cv2.CAP_PROP_FPS, FPS)

        actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_fps = cap.get(cv2.CAP_PROP_FPS)
        print(f"[camera] {name} opened: {actual_w}x{actual_h} @ {actual_fps:.1f}fps",
              flush=True)

        # Warmup: try to grab the first frame within WARMUP_TIMEOUT_S.
        deadline = time.monotonic() + WARMUP_TIMEOUT_S
        first_frame = None
        while time.monotonic() < deadline:
            ret, frame = cap.read()
            if ret and frame is not None and frame.size > 0:
                first_frame = frame
                break
            time.sleep(0.05)

        if first_frame is None:
            print(f"[camera] {name} opened but produced no frames within "
                  f"{WARMUP_TIMEOUT_S:.0f}s — releasing and trying next backend",
                  flush=True)
            cap.release()
            continue

        h, w = first_frame.shape[:2]
        if (w, h) != (WIDTH, HEIGHT):
            print(f"[camera] WARNING: requested {WIDTH}x{HEIGHT} but got {w}x{h} — "
                  f"FFmpeg expects exactly {WIDTH}x{HEIGHT} bgr24, output may break",
                  flush=True)

        print(f"[camera] {name} delivered first frame OK", flush=True)
        return cap, name

    return None, None


cap, backend_name = open_camera()
if cap is None:
    print("[fatal] no working webcam backend — is the camera in use by another app?",
          flush=True)
    sys.exit(1)

# --- FFMPEG ---
# We use 'mpegts' format because SRT requires it. Two inputs are muxed into
# one output stream:
#   Input #0 : rawvideo on stdin (fed by Python / OpenCV)
#   Input #1 : DirectShow microphone capture (if a device is available)
# The audio track is encoded as AAC, which is what MPEG-TS/HLS expect.
#
# Codec tradeoff to be aware of:
#   - LL-HLS subscribers WILL hear audio (HLS carries AAC natively).
#   - WebRTC subscribers will NOT hear audio because the WebRTC stack
#     requires Opus and MediaMTX does not transcode. This is a limitation
#     of the SRT+AAC publishing path, not of this script.
audio_device = find_audio_device()

command = [
    FFMPEG_PATH,
    '-y',
    # --- Video input: raw frames on stdin ---
    '-f', 'rawvideo',
    '-vcodec', 'rawvideo',
    '-pix_fmt', 'bgr24',
    '-s', f"{WIDTH}x{HEIGHT}",
    '-r', str(FPS),
    '-thread_queue_size', '1024',
    '-i', '-',
]

if audio_device:
    command += [
        # --- Audio input: DirectShow microphone ---
        '-f', 'dshow',
        '-thread_queue_size', '1024',
        '-i', f'audio={audio_device}',
        # Explicitly map the video from input 0 and audio from input 1.
        '-map', '0:v',
        '-map', '1:a',
    ]

command += [
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-g', str(FPS * 2),
]

if audio_device:
    command += [
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '48000',
        '-ac', '2',
    ]

command += [
    '-f', 'mpegts',
    SRT_URL,
]

# Start FFmpeg process AFTER the camera warmup succeeds, so we don't leave
# a dangling FFmpeg waiting on an empty pipe if camera init fails.
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

print(f"Streaming to {SRT_URL}...", flush=True)
print(f"Using camera backend: {backend_name}", flush=True)
if audio_device:
    print(f"Publishing audio from: {audio_device} (AAC 128k)", flush=True)
else:
    print("Publishing video only (no audio device detected)", flush=True)
print("Press 'q' to stop.", flush=True)

last_good_frame_t = time.monotonic()
frame_count = 0

try:
    while cap.isOpened() and not stop_flag.is_set():
        ret, frame = cap.read()
        if not ret or frame is None:
            # Transient grab failure — don't exit, but bail if we never
            # recover (so the user gets a clear error instead of a silent hang).
            if time.monotonic() - last_good_frame_t > NO_FRAMES_STALL_S:
                print(f"[fatal] no frames from camera for {NO_FRAMES_STALL_S:.0f}s "
                      f"— exiting", flush=True)
                break
            cv2.waitKey(10)
            continue

        # If the camera is producing a different size than configured (some
        # drivers silently downgrade), force-resize so FFmpeg's rawvideo
        # input stays consistent.
        h, w = frame.shape[:2]
        if (w, h) != (WIDTH, HEIGHT):
            frame = cv2.resize(frame, (WIDTH, HEIGHT))

        last_good_frame_t = time.monotonic()
        frame_count += 1

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
    print(f"[shutdown] streamed {frame_count} frames", flush=True)
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
