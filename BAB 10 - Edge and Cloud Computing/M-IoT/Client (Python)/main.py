import cv2
import subprocess
import numpy as np

# --- CONFIGURATION ---
FFMPEG_PATH = r"C:\Users\hafid\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"

# Replace with your VM's public IP
SRT_URL = "srt://72.60.78.42:8890?mode=caller&latency=200000&streamid=publish:miotybhs"
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
    '-i', '-',  # Read from stdin
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'ultrafast',
    '-f', 'mpegts',
    SRT_URL
]

# Start FFmpeg process
process = subprocess.Popen(command, stdin=subprocess.PIPE)

# Initialize Webcam
cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)

print(f"Streaming to {SRT_URL}...")
print("Press 'q' to stop.")

try:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # --- AI / COMPUTER VISION SPACE ---
        # Since you're an AI Engineer, this is where you'd put:
        # results = model(frame)
        # cv2.putText(frame, "Object Detected", (50, 50), ...)
        
        cv2.putText(frame, "M-IoT Live Stream", (20, 40), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        # Show local preview
        cv2.imshow('Local Preview', frame)

        # Write the frame to FFmpeg stdin
        process.stdin.write(frame.tobytes())

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
finally:
    cap.release()
    process.stdin.close()
    process.wait()
    cv2.destroyAllWindows()