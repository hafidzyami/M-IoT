const mqtt = require('mqtt');

const MQTT_BROKER = 'mqtt://reksti.profybandung.cloud';
const MQTT_TOPIC = 'reksti-yb/data';

const client = mqtt.connect(MQTT_BROKER);

client.on('connect', () => {
  console.log('Publisher connected to MQTT broker');

  // Publish random data every 1 second
  const interval = setInterval(() => {
    const sensorData = {
      altitude: parseFloat((Math.random() * 100).toFixed(2)),       // 0 - 100%
      pressure: parseFloat((950 + Math.random() * 100).toFixed(2)), // 950 - 1050 hPa
      temperature: parseFloat((20 + Math.random() * 15).toFixed(2)) // 20 - 35 °C
    };

    client.publish(MQTT_TOPIC, JSON.stringify(sensorData), (err) => {
      if (err) {
        console.error('Publish error:', err);
      } else {
        console.log('Data published:', sensorData);
      }
    });
  }, 1000); // every 1 second

  // Optional: Stop after 1 minute
  setTimeout(() => {
    clearInterval(interval);
    client.end();
    console.log('Stopped publishing and disconnected.');
  }, 60000);
});

client.on('error', (err) => {
  console.error('Publisher error:', err);
});
