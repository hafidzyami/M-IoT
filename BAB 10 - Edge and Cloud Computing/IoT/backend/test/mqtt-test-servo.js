const mqtt = require('mqtt');

// MQTT Configuration
const MQTT_BROKER = 'mqtt://mqtt.eclipseprojects.io';
const SERVO_TOPIC = 'reksti-yb/servo';

// Connect to MQTT broker
const client = mqtt.connect(MQTT_BROKER, {
  clientId: `servo_test_${Math.random().toString(16).slice(3)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
});

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  console.log('Testing Servo control...');
  
  // Test sequence: 0° → 90° → 180° → Auto mode
  const angles = [0, 90, 180, 181];
  let index = 0;
  
  const sendNextCommand = () => {
    if (index < angles.length) {
      const angle = angles[index];
      console.log(`Sending servo command: ${angle}° ${angle === 181 ? '(Auto mode)' : ''}`);
      
      client.publish(SERVO_TOPIC, angle.toString(), (err) => {
        if (err) {
          console.error(`Error publishing angle ${angle}:`, err);
        } else {
          console.log(`Servo command sent successfully: ${angle}`);
        }
        
        index++;
        if (index < angles.length) {
          setTimeout(sendNextCommand, 2000); // Wait 2 seconds between commands
        } else {
          console.log('Test sequence completed');
          setTimeout(() => {
            client.end();
            console.log('Disconnected from MQTT broker');
          }, 1000);
        }
      });
    }
  };
  
  // Start the test sequence
  sendNextCommand();
});

client.on('error', (err) => {
  console.error('MQTT Error:', err);
});
