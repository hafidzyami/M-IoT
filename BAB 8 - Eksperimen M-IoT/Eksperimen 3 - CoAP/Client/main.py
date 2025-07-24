import asyncio
import sys
import time
import cv2
import numpy as np
from datetime import datetime
from pathlib import Path
import aiocoap
from aiocoap import Message, GET, PUT
from aiocoap.error import ResourceChanged, LibraryShutdown
from typing import Optional

class CoapCameraClient:
    """Mengelola koneksi dan stream CoAP ke ESP32-CAM."""
    def __init__(self, esp32_ip: str):
        self.esp32_ip = esp32_ip
        self.base_uri = f"coap://{esp32_ip}:5683"
        self.is_streaming = False
        self.frame_count = 0
        self.skipped_sessions = 0
        self.start_time = None
        self.context = None

    async def create_context(self):
        """Membuat dan mengembalikan konteks CoAP baru."""
        return await aiocoap.Context.create_client_context()

    async def control_stream(self, command: str) -> bool:
        """Memulai atau menghentikan stream kamera."""
        context = await self.create_context()
        try:
            uri = f"{self.base_uri}/stream"
            request = Message(code=PUT, uri=uri, payload=command.encode('utf-8'))
            print(f"📡 Mengirim perintah '{command}' ke {uri}...")
            response = await asyncio.wait_for(context.request(request).response, timeout=10.0)
            if response.code.is_successful():
                print(f"Perintah '{command}' berhasil.")
                return True
            else:
                print(f"Perintah '{command}' gagal: {response.code}")
                return False
        except Exception as e:
            print(f"Error saat mengirim perintah '{command}': {e}")
            return False
        finally:
            await context.shutdown()

    async def capture_single_photo(self, save_path: Optional[str] = None) -> bool:
        """Mengambil satu foto dari endpoint /capture."""
        # Pastikan stream berjalan agar ada frame yang bisa diambil
        print("Memastikan stream aktif untuk mengambil frame...")
        if not await self.control_stream("start"):
            print("Tidak dapat memulai stream untuk mengambil foto.")
            return False
        await asyncio.sleep(1) # Beri waktu untuk frame pertama

        context = await self.create_context()
        success = False
        try:
            uri = f"{self.base_uri}/capture"
            request = Message(code=GET, uri=uri)
            
            print(f"Mengambil satu foto dari {uri}...")
            response = await asyncio.wait_for(context.request(request).response, timeout=15.0)
            
            if response.code.is_successful():
                frame_data = response.payload
                
                if len(frame_data) > 1000:
                    nparr = np.frombuffer(frame_data, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    
                    if frame is not None:
                        # Tentukan nama file jika tidak diberikan
                        if not save_path:
                            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                            save_path = f"capture_{timestamp}.jpg"
                        
                        cv2.imwrite(save_path, frame)
                        print(f"Foto berhasil disimpan: {save_path} ({len(frame_data)} bytes)")
                        success = True
                    else:
                        print(f"Gagal mendekode data JPEG.")
                else:
                    print(f"Menerima data gambar yang tidak valid (terlalu kecil).")
            else:
                print(f"Pengambilan foto gagal: {response.code}")
        except Exception as e:
            print(f"Error saat pengambilan foto: {e}")
        finally:
            print("💡 Menghentikan stream setelah pengambilan foto...")
            await self.control_stream("stop")
            await context.shutdown()
        return success

    async def start_observe_stream(self, display: bool = True, auto_start: bool = True) -> None:
        """Memulai pengamatan stream kamera dengan logika coba-lagi otomatis."""
        print(f"\nKlien Stream Kamera CoAP (Versi Paling Tangguh)")
        print(f"Target: {self.esp32_ip}:5683")
        print("Mode: Otomatis menyambung kembali jika terjadi 'ResourceChanged'.")
        print("Tekan Ctrl+C di terminal atau 'q' di jendela video untuk berhenti.")
        print("-" * 60)
        
        if auto_start:
            if not await self.control_stream("start"):
                print("Gagal memulai stream di server. Membatalkan.")
                return
            await asyncio.sleep(1)

        self.is_streaming = True
        self.frame_count = 0
        self.skipped_sessions = 0
        self.start_time = time.time()
        
        if display:
            cv2.namedWindow('ESP32-CAM Stream (Resilient Client)', cv2.WINDOW_AUTOSIZE)
        
        self.context = await self.create_context()
        
        try:
            while self.is_streaming:
                try:
                    print(f"Memulai (atau memulai ulang) sesi Observe...")
                    request = Message(code=GET, uri=f"{self.base_uri}/stream", observe=0)
                    request_handle = self.context.request(request)

                    async for response in request_handle.observation:
                        if not self.is_streaming:
                            request_handle.observation.cancel()
                            break
                        
                        await self._process_frame(response, display)

                    print("Sesi observasi berakhir.")
                    self.is_streaming = False

                except ResourceChanged:
                    self.skipped_sessions += 1
                    print(f"ResourceChanged terdeteksi. Sesi observasi akan dimulai ulang ({self.skipped_sessions} kali)...")
                    await asyncio.sleep(0.5)
                    continue

                except (Exception, LibraryShutdown) as e:
                    if isinstance(e, KeyboardInterrupt):
                        raise
                    print(f"Error fatal dalam observasi: {e}. Menghentikan stream.")
                    self.is_streaming = False
                
                if display and cv2.waitKey(1) & 0xFF == ord('q'):
                    print("Pengguna meminta keluar.")
                    self.is_streaming = False
        
        except KeyboardInterrupt:
            print(f"\nStream diinterupsi oleh pengguna")
        finally:
            await self._cleanup(display, auto_start)

    async def _process_frame(self, response, display: bool):
        """Memproses setiap frame yang diterima."""
        try:
            frame_data = response.payload
            if not frame_data or len(frame_data) < 1000:
                return
            
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                return

            self.frame_count += 1
            
            info_text = f"Frame: {self.frame_count} | Sesi Gagal: {self.skipped_sessions}"
            cv2.putText(frame, info_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            if display:
                cv2.imshow('ESP32-CAM Stream (Resilient Client)', frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    self.is_streaming = False

        except Exception as e:
            print(f"Error pemrosesan frame: {e}")

    async def _cleanup(self, display: bool, auto_start: bool):
        """Membersihkan sumber daya."""
        self.is_streaming = False
        
        if auto_start:
            await self.control_stream("stop")
        
        if display:
            cv2.destroyAllWindows()
        
        if self.context:
            await self.context.shutdown()
        
        print("\n Statistik Stream Akhir:")
        if self.frame_count > 0:
            elapsed = time.time() - self.start_time
            avg_fps = self.frame_count / elapsed
            print(f"   Frame diterima: {self.frame_count}")
            print(f"   Sesi dimulai ulang: {self.skipped_sessions}")
            print(f"   Durasi: {elapsed:.1f}s")
            print(f"   Rata-rata FPS (efektif): {avg_fps:.1f}")
        else:
            print("   Tidak ada frame yang berhasil diterima.")

def print_help():
    """Mencetak informasi penggunaan."""
    print("""
Penggunaan:
    python nama_file.py [IP_ESP32] [perintah] [argumen]

Perintah:
    stream      (default) Memulai video stream.
    capture     Mengambil satu foto dan menyimpannya.
                [argumen]: nama file opsional (misal: fotoku.jpg)

Contoh:
    python nama_file.py 192.168.1.100
    python nama_file.py 192.168.1.100 stream
    python nama_file.py 192.168.1.100 capture
    python nama_file.py 192.168.1.100 capture hasil.jpg
    """)

async def main():
    """Fungsi utama untuk mem-parsing argumen dan menjalankan klien."""
    if len(sys.argv) < 2 or sys.argv[1] in ['-h', '--help']:
        print_help()
        return

    esp32_ip = sys.argv[1]
    command = "stream" # Perintah default
    if len(sys.argv) > 2:
        command = sys.argv[2].lower()

    client = CoapCameraClient(esp32_ip)

    if command == "stream":
        await client.start_observe_stream()
    elif command == "capture":
        filename = None
        if len(sys.argv) > 3:
            filename = sys.argv[3]
        await client.capture_single_photo(filename)
    else:
        print(f"Perintah tidak dikenal: {command}")
        print_help()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nProgram dihentikan.")
