const mqtt = require('mqtt');

// MQTT Configuration
const MQTT_BROKER = 'mqtt://mqtt.eclipseprojects.io';
const LED_TOPIC = 'reksti-yb/led';

// Connect to MQTT broker
const client = mqtt.connect(MQTT_BROKER, {
  clientId: `led_test_${Math.random().toString(16).slice(3)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
});

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  console.log('Testing LED control...');
  
  // Test turning LED ON
  console.log('Sending LED ON command...');
  client.publish(LED_TOPIC, '1', (err) => {
    if (err) {
      console.error('Error publishing LED ON:', err);
    } else {
      console.log('LED ON command sent successfully');
    }
  });
  
  // Test turning LED OFF after 3 seconds
  setTimeout(() => {
    console.log('Sending LED OFF command...');
    client.publish(LED_TOPIC, '0', (err) => {
      if (err) {
        console.error('Error publishing LED OFF:', err);
      } else {
        console.log('LED OFF command sent successfully');
      }
      
      // Disconnect after test
      setTimeout(() => {
        client.end();
        console.log('Test completed');
      }, 1000);
    });
  }, 3000);
});

client.on('error', (err) => {
  console.error('MQTT Error:', err);
});
