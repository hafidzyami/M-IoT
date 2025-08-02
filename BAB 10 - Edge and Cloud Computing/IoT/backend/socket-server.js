const { Server } = require('socket.io');

class SocketServer {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
      }
    });
    
    this.clients = new Set();
    this.ledCommandCallback = null; // Callback for LED commands
    this.servoCommandCallback = null; // Callback for Servo commands
    
    this.io.on('connection', (socket) => {
      console.log('New Socket.IO client connected:', socket.id);
      this.clients.add(socket);
      
      // Send welcome message
      socket.emit('connection', {
        type: 'connection',
        message: 'Connected to IoT Socket.IO server'
      });
      
      // Handle client messages
      socket.on('message', (data) => {
        try {
          console.log('Received from client:', data);
          
          // Handle different message types if needed
          if (data.type === 'ping') {
            socket.emit('message', { type: 'pong' });
          }
        } catch (error) {
          console.error('Error processing client message:', error);
        }
      });
      
      // Handle LED control
      socket.on('led_control', (data) => {
        try {
          console.log('LED control command received:', data);
          
          // Call the MQTT publish callback if set
          if (this.ledCommandCallback) {
            this.ledCommandCallback(data);
          }
          
          // Send confirmation back to client
          socket.emit('led_control_ack', {
            success: true,
            state: data.state
          });
        } catch (error) {
          console.error('Error processing LED control:', error);
          socket.emit('led_control_ack', {
            success: false,
            error: error.message
          });
        }
      });

      // Handle Servo control
      socket.on('servo_control', (data) => {
        try {
          console.log('Servo control command received:', data);
          
          // Call the MQTT publish callback if set
          if (this.servoCommandCallback) {
            this.servoCommandCallback(data);
          }
          
          // Send confirmation back to client
          socket.emit('servo_control_ack', {
            success: true,
            angle: data.angle
          });
        } catch (error) {
          console.error('Error processing Servo control:', error);
          socket.emit('servo_control_ack', {
            success: false,
            error: error.message
          });
        }
      });
      
      // Handle client disconnect
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        this.clients.delete(socket);
      });
      
      // Handle errors
      socket.on('error', (error) => {
        console.error('Socket.IO error:', error);
        this.clients.delete(socket);
      });
    });
  }
  
  // Broadcast to all connected clients
  broadcast(data) {
    this.io.emit('iot_data', data);
  }
  
  // Send to specific client
  sendToClient(socketId, data) {
    this.io.to(socketId).emit('iot_data', data);
  }
  
  // Get number of connected clients
  getClientCount() {
    return this.clients.size;
  }
  
  // Set LED command callback
  setLedCommandCallback(callback) {
    this.ledCommandCallback = callback;
  }
  
  // Set Servo command callback
  setServoCommandCallback(callback) {
    this.servoCommandCallback = callback;
  }
}

module.exports = SocketServer;
