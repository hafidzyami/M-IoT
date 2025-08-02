# mqtt_broker/Dockerfile
FROM eclipse-mosquitto:latest

# Salin konfigurasi
COPY ./mqtt/config/mosquitto.conf /mosquitto/config/

# Buat direktori untuk data dan log
RUN mkdir -p /mosquitto/data /mosquitto/log && \
    chmod -R 777 /mosquitto/data /mosquitto/log

# Expose port
EXPOSE 1883
EXPOSE 9001

# Command untuk menjalankan mosquitto
CMD ["mosquitto", "-c", "/mosquitto/config/mosquitto.conf"]