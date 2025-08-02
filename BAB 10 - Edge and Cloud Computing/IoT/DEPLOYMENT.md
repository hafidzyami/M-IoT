# Deployment Guide untuk IoT Dashboard

## Deployment ke EC2 menggunakan Docker Compose

### Prerequisites

1. Instance EC2 (Ubuntu recommended)
2. Docker dan Docker Compose terinstall
3. Port berikut terbuka di Security Group:
   - 3000 (Frontend)
   - 8000 (Backend API)
   - 1883 (MQTT Broker)
   - 9001 (MQTT WebSockets)

### Langkah-langkah Deployment

1. **Clone repository ke EC2**
   ```bash
   git clone <your-repository>
   cd <your-project-directory>
   ```

2. **Setup environment variables untuk Backend**
   ```bash
   cp backend/.env.example backend/.env
   nano backend/.env
   ```
   
   Sesuaikan nilai-nilai berikut:
   ```
   MQTT_BROKER_URL=mqtt://mqtt-broker:1883
   DATABASE_URL=postgresql://user:password@postgres:5432/iot_db
   ```

3. **Setup environment variables untuk Frontend**
   ```bash
   cp frontend/.env.example frontend/.env
   nano frontend/.env
   ```
   
   Untuk deployment di EC2, Anda punya beberapa opsi:
   
   **Opsi 1: Menggunakan domain/IP public EC2**
   ```
   NEXT_PUBLIC_API_URL=http://ec2-xx-xxx-xxx-xxx.compute-1.amazonaws.com:8000
   NEXT_PUBLIC_SOCKET_URL=http://ec2-xx-xxx-xxx-xxx.compute-1.amazonaws.com:8000
   ```
   
   **Opsi 2: Biarkan kosong untuk menggunakan domain dinamis**
   ```
   NEXT_PUBLIC_API_URL=
   NEXT_PUBLIC_SOCKET_URL=
   ```

4. **Deploy menggunakan Docker Compose**
   ```bash
   docker-compose up -d --build
   ```

5. **Verifikasi deployment**
   ```bash
   # Cek status containers
   docker-compose ps
   
   # Cek logs
   docker-compose logs -f
   ```

6. **Akses aplikasi**
   - Frontend: http://ec2-public-ip:3000
   - Backend API: http://ec2-public-ip:8000
   - MQTT Broker: ec2-public-ip:1883

### Troubleshooting

1. **Jika frontend tidak dapat terhubung ke backend:**
   - Pastikan security group mengizinkan port 8000
   - Cek environment variables di frontend
   - Pastikan backend container running dengan baik

2. **Jika MQTT tidak berfungsi:**
   - Pastikan security group mengizinkan port 1883 dan 9001
   - Cek koneksi dari ESP32 ke EC2 public IP

3. **Untuk melihat logs:**
   ```bash
   docker-compose logs frontend
   docker-compose logs backend
   docker-compose logs mqtt-broker
   ```

### Production Considerations

1. **Menggunakan HTTPS:**
   - Pertimbangkan menggunakan reverse proxy (Nginx) dengan SSL
   - Update environment variables untuk menggunakan https://

2. **Domain Name:**
   - Gunakan domain name alih-alih IP untuk production
   - Update environment variables sesuai domain

3. **Monitoring:**
   - Setup monitoring untuk containers
   - Configure alerts untuk service failures

4. **Backup:**
   - Regular backup untuk database
   - Backup konfigurasi environment
