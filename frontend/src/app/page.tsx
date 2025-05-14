// pages/index.tsx
"use client"
import { useState } from 'react';
import Head from 'next/head';
import { Camera, Wifi, Menu, X, RefreshCw, Download, Maximize2, Minimize2 } from 'lucide-react';

// Protocol options
type Protocol = 'HTTP' | 'CoAP' | 'MQTT' | 'WebSocket' | 'WebRTC';

// Device types
type DeviceType = 'raspberry-pi' | 'esp32-cam';

// Device interface
interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: 'online' | 'offline';
  protocol: Protocol;
  streamUrl: string;
  lastCapture?: string;
}

// Sample devices data
const sampleDevices: Device[] = [
  {
    id: '1',
    name: 'Raspberry Pi - Server 1',
    type: 'raspberry-pi',
    status: 'online',
    protocol: 'HTTP',
    streamUrl: '/api/stream/1',
    lastCapture: '/images/sample-pi-1.jpg',
  },
  {
    id: '2',
    name: 'ESP32 Cam - Server 1',
    type: 'esp32-cam',
    status: 'online',
    protocol: 'MQTT',
    streamUrl: '/api/stream/2',
    lastCapture: '/images/sample-esp32-1.jpg',
  },
  {
    id: '3',
    name: 'Raspberry Pi - Server 2',
    type: 'raspberry-pi',
    status: 'offline',
    protocol: 'WebSocket',
    streamUrl: '/api/stream/3',
  },
  {
    id: '4',
    name: 'ESP32 Cam - Server 2',
    type: 'esp32-cam',
    status: 'online',
    protocol: 'WebRTC',
    streamUrl: '/api/stream/4',
    lastCapture: '/images/sample-esp32-2.jpg',
  },
];

// Placeholder images for sample devices
const placeholderImages = {
  'raspberry-pi': {
    stream: '/api/placeholder/640/360',
    capture: '/api/placeholder/640/360',
  },
  'esp32-cam': {
    stream: '/api/placeholder/640/360',
    capture: '/api/placeholder/640/360',
  },
};

export default function Home() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(sampleDevices[0]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol>(selectedDevice?.protocol || 'HTTP');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastImageCapture, setLastImageCapture] = useState<string | null>(null);

  // Function to handle protocol change
  const handleProtocolChange = (protocol: Protocol) => {
    setIsLoading(true);
    setSelectedProtocol(protocol);
    
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  // Function to handle image capture
  const handleCapture = () => {
    setIsLoading(true);
    
    // Simulate capture delay
    setTimeout(() => {
      setIsLoading(false);
      if (selectedDevice) {
        setLastImageCapture(placeholderImages[selectedDevice.type].capture);
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <title>IoT Multimedia Dashboard</title>
        <meta name="description" content="IoT Multimedia monitoring system" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex flex-col h-screen">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <h1 className="text-xl font-bold">IoT Multimedia Dashboard</h1>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-green-400 flex items-center">
                <Wifi size={16} className="mr-1" />
                Connected
              </span>
              <button className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md text-sm transition-colors">
                Settings
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          {sidebarOpen && (
            <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-700">
                <h2 className="font-medium text-lg">Devices</h2>
              </div>
              <div className="overflow-y-auto flex-1">
                <ul>
                  {sampleDevices.map((device) => (
                    <li 
                      key={device.id} 
                      className={`border-b border-gray-700 cursor-pointer hover:bg-gray-700 transition-colors ${selectedDevice?.id === device.id ? 'bg-gray-700' : ''}`}
                      onClick={() => {
                        setSelectedDevice(device);
                        setSelectedProtocol(device.protocol);
                        setLastImageCapture(null);
                      }}
                    >
                      <div className="p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">{device.name}</span>
                          <span className={`text-xs px-2 py-1 rounded ${device.status === 'online' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                            {device.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-400">
                          <span>{device.type === 'raspberry-pi' ? 'Raspberry Pi' : 'ESP32 Cam'}</span>
                          <span>{device.protocol}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto bg-gray-900">
            {selectedDevice ? (
              <div className="p-6">
                <div className="mb-6 flex justify-between items-center">
                  <h2 className="text-2xl font-bold">{selectedDevice.name}</h2>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${selectedDevice.status === 'online' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                      <span className={`w-2 h-2 rounded-full mr-2 ${selectedDevice.status === 'online' ? 'bg-green-400' : 'bg-red-400'}`}></span>
                      {selectedDevice.status}
                    </span>
                  </div>
                </div>

                {/* Protocol selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Connection Protocol</label>
                  <div className="flex flex-wrap gap-2">
                    {(['HTTP', 'CoAP', 'MQTT', 'WebSocket', 'WebRTC'] as Protocol[]).map((protocol) => (
                      <button
                        key={protocol}
                        onClick={() => handleProtocolChange(protocol)}
                        className={`px-4 py-2 rounded-md text-sm transition-colors ${
                          selectedProtocol === protocol
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                        }`}
                      >
                        {protocol}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video streams section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Live Stream */}
                  <div className="lg:col-span-2 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                    <div className="flex justify-between items-center p-3 border-b border-gray-700">
                      <h3 className="font-medium flex items-center">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                        Live Stream
                      </h3>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => setIsFullscreen(!isFullscreen)}
                          className="p-1 rounded hover:bg-gray-700"
                        >
                          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                        <button 
                          onClick={() => {
                            setIsLoading(true);
                            setTimeout(() => setIsLoading(false), 1000);
                          }} 
                          className="p-1 rounded hover:bg-gray-700"
                        >
                          <RefreshCw size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      {isLoading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
                          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                        </div>
                      )}
                      <div className={`aspect-video relative ${isFullscreen ? 'h-[calc(100vh-12rem)]' : ''}`}>
                        <img
                          src={placeholderImages[selectedDevice.type].stream}
                          alt="Live stream"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-3 py-1 rounded-md text-sm flex items-center">
                          <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                          Live • {selectedProtocol}
                        </div>
                      </div>
                    </div>
                    <div className="p-3 flex justify-between">
                      <div>
                        <span className="text-sm text-gray-400">Resolution: 1280x720</span>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={handleCapture}
                          className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded flex items-center text-sm transition-colors"
                        >
                          <Camera size={16} className="mr-1" />
                          Capture
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Captured Images */}
                  <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                    <div className="flex justify-between items-center p-3 border-b border-gray-700">
                      <h3 className="font-medium">Latest Captures</h3>
                      <button className="p-1 rounded hover:bg-gray-700">
                        <RefreshCw size={18} />
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Last captured image */}
                      {lastImageCapture && (
                        <div className="border border-gray-700 rounded-lg overflow-hidden">
                          <div className="aspect-video relative">
                            <img 
                              src={lastImageCapture} 
                              alt="Latest capture" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-2 bg-gray-800 flex justify-between items-center">
                            <span className="text-xs text-gray-400">Just now</span>
                            <button className="p-1 rounded hover:bg-gray-700">
                              <Download size={16} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Previous captures */}
                      {selectedDevice.lastCapture && (
                        <div className="border border-gray-700 rounded-lg overflow-hidden">
                          <div className="aspect-video relative">
                            <img 
                              src={selectedDevice.lastCapture} 
                              alt="Previous capture" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-2 bg-gray-800 flex justify-between items-center">
                            <span className="text-xs text-gray-400">10 minutes ago</span>
                            <button className="p-1 rounded hover:bg-gray-700">
                              <Download size={16} />
                            </button>
                          </div>
                        </div>
                      )}

                      {!lastImageCapture && !selectedDevice.lastCapture && (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                          <Camera size={40} className="mb-2" />
                          <p>No captures available</p>
                          <button 
                            onClick={handleCapture}
                            className="mt-2 bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm text-white transition-colors"
                          >
                            Take a Capture
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Device Info Section */}
                <div className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="font-medium mb-3">Device Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-700 p-3 rounded-lg">
                      <div className="text-sm text-gray-400">Device Type</div>
                      <div className="font-medium">
                        {selectedDevice.type === 'raspberry-pi' ? 'Raspberry Pi' : 'ESP32 Cam'}
                      </div>
                    </div>
                    <div className="bg-gray-700 p-3 rounded-lg">
                      <div className="text-sm text-gray-400">Current Protocol</div>
                      <div className="font-medium">{selectedProtocol}</div>
                    </div>
                    <div className="bg-gray-700 p-3 rounded-lg">
                      <div className="text-sm text-gray-400">IP Address</div>
                      <div className="font-medium">192.168.1.{Math.floor(Math.random() * 255)}</div>
                    </div>
                    <div className="bg-gray-700 p-3 rounded-lg">
                      <div className="text-sm text-gray-400">Last Activity</div>
                      <div className="font-medium">Just now</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-6">
                  <Camera size={48} className="mx-auto text-gray-600 mb-4" />
                  <h2 className="text-xl font-medium mb-2">No Device Selected</h2>
                  <p className="text-gray-500">Select a device from the sidebar to view its stream</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}