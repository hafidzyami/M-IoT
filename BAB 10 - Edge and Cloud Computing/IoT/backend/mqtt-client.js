const mqtt = require('mqtt');
const axios = require('axios');
require('dotenv').config();

// MQTT Configuration
const MQTT_BROKER = 'mqtt://iot.profybandung.cloud';
const MQTT_TOPIC = 'miotybhs/data';
const API_URL = `http://localhost:${process.env.PORT || 8000}/api/iot`;

// WebSocket server reference (will be set from index.js)
let wsServer = null;

// Function to set WebSocket server
function setWebSocketServer(server) {
  wsServer = server;
  
  // Set up LED command callback
  if (wsServer && wsServer.setLedCommandCallback) {
    wsServer.setLedCommandCallback((data) => {
      console.log('Publishing LED command to MQTT:', data);
      
      // Publish to MQTT topic
      client.publish('miotybhs/led', data.state.toString(), (err) => {
        if (err) {
          console.error('Failed to publish LED command:', err);
        } else {
          console.log('LED command published successfully to miotybhs/led');
        }
      });
    });
  }
  
  // Set up Servo command callback
  if (wsServer && wsServer.setServoCommandCallback) {
    wsServer.setServoCommandCallback((data) => {
      console.log('Publishing Servo command to MQTT:', data);
      
      // Publish to MQTT topic
      client.publish('miotybhs/servo', data.angle.toString(), (err) => {
        if (err) {
          console.error('Failed to publish Servo command:', err);
        } else {
          console.log('Servo command published successfully to miotybhs/servo with angle:', data.angle);
        }
      });
    });
  }
}

// Connect to MQTT broker
const client = mqtt.connect(MQTT_BROKER, {
  clientId: `iot_client_${Math.random().toString(16).slice(3)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
});

// Connection event handlers
client.on('connect', () => {
  console.log('Connected to MQTT broker:', MQTT_BROKER);
  
  // Subscribe to topic
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error('Subscribe error:', err);
    } else {
      console.log(`Subscribed to topic: ${MQTT_TOPIC}`);
    }
  });
  
  // Also subscribe to LED feedback topic if needed
  client.subscribe('miotybhs/led/feedback', (err) => {
    if (err) {
      console.error('Subscribe to LED feedback error:', err);
    } else {
      console.log('Subscribed to topic: miotybhs/led/feedback');
    }
  });
});

client.on('error', (err) => {
  console.error('MQTT Client Error:', err);
});

client.on('offline', () => {
  console.log('MQTT Client is offline');
});

client.on('reconnect', () => {
  console.log('MQTT Client is reconnecting');
});

// Message handler
client.on('message', async (topic, message) => {
  try {
    console.log(`Received message on topic ${topic}:`, message.toString());
    
    // Parse the message
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (e) {
      console.error('Failed to parse message as JSON:', e);
      return;
    }
    
    // Validate the data
    if (!data.altitude || !data.pressure || !data.temperature) {
      console.error('Invalid message format. Required fields: altitude, pressure, temperature');
      return;
    }
    
    // Post to API
    try {
      const response = await axios.post(API_URL, {
        altitude: data.altitude,
        pressure: data.pressure,
        temperature: data.temperature
      });
      
      console.log('Data posted to API successfully:', response.data);
      
      // Broadcast to Socket.IO clients
      if (wsServer) {
        wsServer.broadcast({
          type: 'iot_data',
          data: response.data.data // Send the saved data with ID and timestamp
        });
      }
      
    } catch (apiError) {
      console.error('Failed to post data to API:', apiError.message);
      if (apiError.response) {
        console.error('API Response:', apiError.response.data);
      }
    }
    
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

// Export the client and setter function
module.exports = {
  client,
  setWebSocketServer
};