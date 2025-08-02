#!/bin/bash
# Script deployment untuk MQTT broker di EC2
# Digunakan oleh GitHub Actions workflow atau dapat dijalankan secara manual

set -e  # Exit pada error

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== MQTT Broker Deployment Script ===${NC}"
echo "Started at $(date)"

# Buat direktori jika belum ada
mkdir -p ~/mqtt_broker/mqtt/config ~/mqtt_broker/mqtt/data ~/mqtt_broker/mqtt/log

# Navigasi ke direktori proyek
cd ~/mqtt_broker

# Backup konfigurasi yang ada jika perlu
if [ -f ~/mqtt_broker/mqtt/config/mosquitto.conf ]; then
  echo -e "${YELLOW}Backing up existing configuration...${NC}"
  cp ~/mqtt_broker/mqtt/config/mosquitto.conf ~/mqtt_broker/mqtt/config/mosquitto.conf.bak
fi

# Setup permission untuk direktori data dan log
echo "Setting up permissions for data and log directories..."
chmod -R 777 mqtt/data mqtt/log

# Memastikan Docker berjalan
if ! systemctl is-active --quiet docker; then
  echo -e "${YELLOW}Starting Docker service...${NC}"
  sudo systemctl start docker
fi

# Menghentikan container yang sedang berjalan
if docker ps | grep -q mqtt-broker; then
  echo -e "${YELLOW}Stopping existing MQTT broker container...${NC}"
  docker-compose down
fi

# Menjalankan dengan Docker Compose
echo -e "${GREEN}Starting MQTT broker...${NC}"
docker-compose up -d

# Verifikasi broker berjalan
echo "Verifying MQTT broker status..."
if docker ps | grep -q mqtt-broker; then
  echo -e "${GREEN}MQTT broker is running!${NC}"
else
  echo -e "${RED}Failed to start MQTT broker. Check logs with: docker logs mqtt-broker${NC}"
  exit 1
fi

# Membersihkan resource Docker yang tidak digunakan
echo "Cleaning up unused Docker resources..."
docker system prune -f

# Dapatkan IP publik EC2
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo -e "${GREEN}=== Deployment completed at $(date) ===${NC}"
echo -e "${GREEN}MQTT broker is running at:${NC}"
echo "MQTT: $PUBLIC_IP:1883"
echo "WebSocket: $PUBLIC_IP:9001"
echo -e "${YELLOW}Make sure these ports are open in your EC2 security group${NC}"