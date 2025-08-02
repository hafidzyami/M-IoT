const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const http = require('http');
require('dotenv').config();

// Import MQTT client
const { client: mqttClient, setWebSocketServer } = require('./mqtt-client');
const SocketServer = require('./socket-server');

const app = express();
const port = process.env.PORT || 8000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO server
const socketServer = new SocketServer(server);

// Set Socket.IO server reference in MQTT client
setWebSocketServer(socketServer);

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use(express.json());

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IoT Backend API',
      version: '1.0.0',
      description: 'API for managing IoT sensor data with Supabase',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: 'Development server'
      },
      {
        url: 'https://api.profybandung.cloud',
        description: 'Production server'
      }
    ],
    components: {
      schemas: {
        IoTData: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              format: 'int64',
              description: 'Unique identifier'
            },
            altitude: {
              type: 'number',
              format: 'float',
              description: 'altitude percentage'
            },
            pressure: {
              type: 'number',
              format: 'float',
              description: 'Atmospheric pressure'
            },
            temperature: {
              type: 'number',
              format: 'float',
              description: 'Temperature in Celsius'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp of the reading'
            }
          }
        },
        IoTDataInput: {
          type: 'object',
          required: ['altitude', 'pressure', 'temperature'],
          properties: {
            altitude: {
              type: 'number',
              format: 'float',
              description: 'altitude percentage'
            },
            pressure: {
              type: 'number',
              format: 'float',
              description: 'Atmospheric pressure'
            },
            temperature: {
              type: 'number',
              format: 'float',
              description: 'Temperature in Celsius'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/IoTData'
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'integer',
                  description: 'Current page number'
                },
                limit: {
                  type: 'integer',
                  description: 'Items per page'
                },
                total: {
                  type: 'integer',
                  description: 'Total number of items'
                },
                totalPages: {
                  type: 'integer',
                  description: 'Total number of pages'
                }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            }
          }
        }
      }
    }
  },
  apis: ['./index.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Add WebSocket status endpoint
/**
 * @swagger
 * /ws/status:
 *   get:
 *     summary: Get WebSocket server status
 *     description: Check the current status of the WebSocket server
 *     tags: [WebSocket]
 *     responses:
 *       200:
 *         description: WebSocket server status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 connectedClients:
 *                   type: integer
 *                 wsUrl:
 *                   type: string
 */
app.get('/ws/status', (req, res) => {
    res.json({
      status: 'active',
      connectedClients: socketServer.getClientCount(),
      socketUrl: `http://localhost:${port}`
    });
  });

/**
 * @swagger
 * /api/iot:
 *   post:
 *     summary: Create new IoT data
 *     description: Add new sensor data to the database
 *     tags: [IoT]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IoTDataInput'
 *     responses:
 *       201:
 *         description: Data created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/IoTData'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/iot', async (req, res) => {
  try {
    const { altitude, pressure, temperature } = req.body;

    if (!altitude || !pressure || !temperature) {
      return res.status(400).json({ 
        error: 'Missing required fields: altitude, pressure, or temperature' 
      });
    }

    const { data, error } = await supabase
      .from('iot')
      .insert([
        {
          altitude: parseFloat(altitude),
          pressure: parseFloat(pressure),
          temperature: parseFloat(temperature),
          timestamp: new Date().toISOString()
        }
      ])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: 'Data inserted successfully',
      data: data[0]
    });
  } catch (error) {
    console.error('Error inserting data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/iot:
 *   get:
 *     summary: Get all IoT data
 *     description: Retrieve all sensor data ordered by timestamp (newest first)
 *     tags: [IoT]
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/IoTData'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api/iot', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('iot')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/iot/{id}:
 *   get:
 *     summary: Get IoT data by ID
 *     description: Retrieve specific sensor data by its ID
 *     tags: [IoT]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: IoT data ID
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IoTData'
 *       404:
 *         description: Data not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api/iot/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('iot')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Data not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/iot/page/{page}:
 *   get:
 *     summary: Get paginated IoT data
 *     description: Retrieve sensor data with pagination
 *     tags: [IoT]
 *     parameters:
 *       - in: path
 *         name: page
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api/iot/page/:page', async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('iot')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/iot/range:
 *   get:
 *     summary: Get IoT data by date range
 *     description: Retrieve sensor data within a specific date range
 *     tags: [IoT]
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date (ISO 8601 format)
 *       - in: query
 *         name: end
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date (ISO 8601 format)
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/IoTData'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api/iot/range', async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ 
        error: 'Missing required query parameters: start and end dates' 
      });
    }

    const { data, error } = await supabase
      .from('iot')
      .select('*')
      .gte('timestamp', start)
      .lte('timestamp', end)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add MQTT status endpoint
/**
 * @swagger
 * /mqtt/status:
 *   get:
 *     summary: Get MQTT client status
 *     description: Check the current status of the MQTT client
 *     tags: [MQTT]
 *     responses:
 *       200:
 *         description: MQTT client status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connected:
 *                   type: boolean
 *                 broker:
 *                   type: string
 *                 topic:
 *                   type: string
 */
app.get('/mqtt/status', (req, res) => {
    res.json({
      connected: mqttClient.connected,
      broker: 'mqtt://iot.profybandung.cloud',
      topic: 'miotybhs/data'
    });
  });

/**
 * @swagger
 * /api/led/control:
 *   post:
 *     summary: Control LED state
 *     description: Turn LED on or off
 *     tags: [IoT]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               state:
 *                 type: integer
 *                 enum: [0, 1]
 *                 description: LED state (0 for off, 1 for on)
 *     responses:
 *       200:
 *         description: LED control command sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 state:
 *                   type: integer
 *       400:
 *         description: Invalid state value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/led/control', (req, res) => {
  try {
    const { state } = req.body;
    
    if (state !== 0 && state !== 1) {
      return res.status(400).json({ error: 'Invalid state value. Must be 0 or 1.' });
    }
    
    // Publish to MQTT
    mqttClient.publish('miotybhs/led', state.toString(), (err) => {
      if (err) {
        console.error('Failed to publish LED command:', err);
        return res.status(500).json({ error: 'Failed to publish LED command' });
      }
      
      res.json({ 
        success: true, 
        message: `LED turned ${state === 1 ? 'on' : 'off'}`,
        state: state 
      });
    });
  } catch (error) {
    console.error('Error controlling LED:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check if the API is running
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Redirect root to API docs
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// Start server
server.listen(port, () => {
  console.log(`IoT Backend API running on port ${port}`);
  console.log(`API Documentation available at http://localhost:${port}/api-docs`);
  console.log(`Socket.IO server running on http://localhost:${port}`);
  console.log(`MQTT client connected to topic: miotybhs`);
});