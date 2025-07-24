import cv2
import time
import sys

def main():
    """
    Fungsi utama untuk terhubung ke stream RTSP dari ESP32-CAM dan menampilkannya.
    """
    # --- KONFIGURASI ---
    # Ambil alamat IP ESP32 dari argumen baris perintah
    if len(sys.argv) < 2:
        print("Kesalahan: Alamat IP ESP32 tidak diberikan.")
        print("Penggunaan: python rtsp_camera_viewer.py [IP_ESP32_ANDA]")
        return
    
    esp32_ip = sys.argv[1]
    rtsp_url = f"rtsp://{esp32_ip}:554/mjpeg/1"

    print(f"\nKlien Stream RTSP untuk ESP32-CAM")
    print(f"Mencoba terhubung ke: {rtsp_url}")
    print("   Tekan 'q' di jendela video untuk keluar.")
    print("-" * 50)

    # Variabel untuk perhitungan FPS
    frame_count = 0
    start_time = time.time()
    fps = 0

    # Loop utama untuk mencoba kembali koneksi jika terputus
    while True:
        try:
            # Buat objek VideoCapture untuk terhubung ke stream RTSP
            cap = cv2.VideoCapture(rtsp_url)

            if not cap.isOpened():
                print("Gagal membuka stream RTSP. Memeriksa kembali dalam 5 detik...")
                time.sleep(5)
                continue

            print("Berhasil terhubung ke stream! Menampilkan video...")
            start_time = time.time() # Reset timer saat koneksi berhasil
            frame_count = 0

            while True:
                # Baca satu frame dari stream
                ret, frame = cap.read()

                # Jika frame tidak berhasil dibaca, berarti koneksi terputus
                if not ret:
                    print("Koneksi stream terputus. Mencoba menyambung kembali...")
                    break # Keluar dari loop dalam untuk mencoba koneksi ulang

                frame_count += 1

                # Hitung FPS setiap 10 frame untuk stabilitas
                if frame_count % 10 == 0:
                    elapsed_time = time.time() - start_time
                    fps = frame_count / elapsed_time if elapsed_time > 0 else 0

                # Tambahkan teks FPS ke frame
                info_text = f"FPS: {fps:.2f}"
                cv2.putText(frame, info_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

                # Tampilkan frame di jendela
                cv2.imshow("ESP32-CAM RTSP Stream", frame)

                # Tunggu tombol 'q' ditekan untuk keluar
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("Keluar diminta oleh pengguna.")
                    cap.release()
                    cv2.destroyAllWindows()
                    return # Keluar dari program sepenuhnya

        except KeyboardInterrupt:
            print("\nProgram dihentikan oleh pengguna (Ctrl+C).")
            break
        except Exception as e:
            print(f"\nTerjadi error: {e}. Mencoba lagi...")
            time.sleep(5)

    # Pembersihan akhir
    if 'cap' in locals() and cap.isOpened():
        cap.release()
    cv2.destroyAllWindows()
    print("Program ditutup.")

if __name__ == '__main__':
    main()