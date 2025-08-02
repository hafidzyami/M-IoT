#!/bin/bash

# Skrip untuk memulai streaming video dari kamera Pi ke RTSP
# Pengguna: Jalankan skrip ini dari terminal dengan ./stream.sh

echo "Memulai streaming video RTSP..."
echo "Akses stream di: rtsp://<IP_RASPBERRY_PI>:8554/stream1"
echo "Tekan Ctrl+C untuk menghentikan."

rpicam-vid -t 0 -n --width 1920 --height 1080 --framerate 30 --bitrate 4000000 \
--codec libav --libav-format mpegts -o - \
| cvlc stream:///dev/stdin --sout '#rtp{sdp=rtsp://:8554/stream1}'