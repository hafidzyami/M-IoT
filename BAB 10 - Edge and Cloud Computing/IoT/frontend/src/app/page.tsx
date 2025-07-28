// pages/index.tsx
"use client"
import { useState } from 'react';
import Head from 'next/head';
import { Camera, Wifi, Menu, X, RefreshCw, Download, Maximize2, Minimize2 } from 'lucide-react';

// Protocol options
type Protocol = 'HTTP' | 'CoAP' | 'MQTT' | 'WebSocket' | 'WebRTC' | 'HLS' | 'DASH';

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
const initialDevices: Device[] = [
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
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(devices[0]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol>(selectedDevice?.protocol || 'HTTP');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastImageCapture, setLastImageCapture] = useState<string | null>(null);

  // Function to handle protocol change
  const handleProtocolChange = (protocol: Protocol) => {
    setIsLoading(true);
    setSelectedProtocol(protocol);
    
    // Update the selected device's protocol
    if (selectedDevice) {
      const updatedDevice = { ...selectedDevice, protocol };
      const updatedDevices = devices.map(device => 
        device.id === selectedDevice.id ? updatedDevice : device
      );
      
      setSelectedDevice(updatedDevice);
      setDevices(updatedDevices);
    }
    
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false);
    }, 800);
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
    }, 700);
  };

  // Protocol colors - soft pastel palette
  const protocolColors = {
    'HTTP': 'bg-sky-400 hover:bg-sky-500',
    'CoAP': 'bg-teal-400 hover:bg-teal-500',
    'MQTT': 'bg-violet-400 hover:bg-violet-500',
    'WebSocket': 'bg-amber-400 hover:bg-amber-500',
    'WebRTC': 'bg-pink-400 hover:bg-pink-500',
    'HLS': 'bg-emerald-400 hover:bg-emerald-500',
    'DASH': 'bg-orange-400 hover:bg-orange-500'
  };

  // Protocol badge colors - softer shades
  const protocolBadgeColors = {
    'HTTP': 'bg-sky-100 text-sky-700',
    'CoAP': 'bg-teal-100 text-teal-700',
    'MQTT': 'bg-violet-100 text-violet-700',
    'WebSocket': 'bg-amber-100 text-amber-700',
    'WebRTC': 'bg-pink-100 text-pink-700',
    'HLS': 'bg-emerald-100 text-emerald-700',
    'DASH': 'bg-orange-100 text-orange-700'
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700">
      <Head>
        <title>IoT Multimedia Dashboard</title>
        <meta name="description" content="IoT Multimedia monitoring system" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex flex-col h-screen">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-400 to-indigo-400 text-white shadow-sm">
          <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-md hover:bg-white/20 transition-colors"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <h1 className="text-xl font-bold">IoT Multimedia Dashboard</h1>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-white flex items-center bg-green-400 px-2 py-1 rounded-full text-sm shadow-sm">
                <Wifi size={16} className="mr-1" />
                Connected
              </span>
              <button className="bg-white text-blue-500 hover:bg-blue-50 px-3 py-1 rounded-md text-sm transition-colors shadow-sm font-medium">
                Settings
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          {sidebarOpen && (
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
              <div className="p-4 border-b border-slate-200 bg-blue-50">
                <h2 className="font-medium text-lg text-slate-700">Devices</h2>
              </div>
              <div className="overflow-y-auto flex-1">
                <ul>
                  {devices.map((device) => (
                    <li 
                      key={device.id} 
                      className={`border-b border-slate-200 cursor-pointer hover:bg-blue-50 transition-colors ${selectedDevice?.id === device.id ? 'bg-blue-50' : ''}`}
                      onClick={() => {
                        setSelectedDevice(device);
                        setSelectedProtocol(device.protocol);
                        setLastImageCapture(null);
                      }}
                    >
                      <div className="p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-slate-700">{device.name}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${device.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {device.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-500">
                          <span>{device.type === 'raspberry-pi' ? 'Raspberry Pi' : 'ESP32 Cam'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${protocolBadgeColors[device.protocol]}`}>
                            {device.protocol}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto bg-slate-50">
            {selectedDevice ? (
              <div className="p-6">
                <div className="mb-6 flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-700">{selectedDevice.name}</h2>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${selectedDevice.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} shadow-sm`}>
                      <span className={`w-2 h-2 rounded-full mr-2 ${selectedDevice.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      {selectedDevice.status}
                    </span>
                  </div>
                </div>

                {/* Protocol selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-slate-600">Connection Protocol</label>
                  <div className="flex flex-wrap gap-2">
                    {(['HTTP', 'CoAP', 'MQTT', 'WebSocket', 'WebRTC', 'HLS', 'DASH'] as Protocol[]).map((protocol) => (
                      <button
                        key={protocol}
                        onClick={() => handleProtocolChange(protocol)}
                        className={`px-4 py-2 rounded-md text-sm transition-colors shadow-sm ${
                          selectedProtocol === protocol
                            ? `${protocolColors[protocol]} text-white font-medium`
                            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
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
                  <div className="lg:col-span-2 bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center p-3 border-b border-slate-200 bg-blue-50">
                      <h3 className="font-medium flex items-center text-slate-700">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-2 animate-pulse"></span>
                        Live Stream
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${protocolBadgeColors[selectedDevice.protocol]}`}>
                          {selectedDevice.protocol}
                        </span>
                      </h3>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => setIsFullscreen(!isFullscreen)}
                          className="p-1 rounded hover:bg-blue-100 text-slate-600"
                        >
                          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                        <button 
                          onClick={() => {
                            setIsLoading(true);
                            setTimeout(() => setIsLoading(false), 800);
                          }} 
                          className="p-1 rounded hover:bg-blue-100 text-slate-600"
                        >
                          <RefreshCw size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      {isLoading && (
                        <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10">
                          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
                        </div>
                      )}
                      <div className={`aspect-video relative ${isFullscreen ? 'h-[calc(100vh-12rem)]' : ''}`}>
                        <img
                          src={placeholderImages[selectedDevice.type].stream}
                          alt="Live stream"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-1 rounded-md text-sm flex items-center text-white">
                          <span className="w-2 h-2 bg-red-400 rounded-full mr-2 animate-pulse"></span>
                          Live • {selectedDevice.protocol}
                        </div>
                      </div>
                    </div>
                    <div className="p-3 flex justify-between text-slate-600 bg-blue-50">
                      <div>
                        <span className="text-sm">Resolution: 1280x720</span>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={handleCapture}
                          className={`${protocolColors[selectedDevice.protocol]} px-3 py-1 rounded-md flex items-center text-sm transition-colors text-white shadow-sm`}
                        >
                          <Camera size={16} className="mr-1" />
                          Capture
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Captured Images */}
                  <div className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center p-3 border-b border-slate-200 bg-blue-50">
                      <h3 className="font-medium text-slate-700">Latest Captures</h3>
                      <button className="p-1 rounded hover:bg-blue-100 text-slate-600">
                        <RefreshCw size={18} />
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Last captured image */}
                      {lastImageCapture && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                          <div className="aspect-video relative">
                            <img 
                              src={lastImageCapture} 
                              alt="Latest capture" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-2 bg-blue-50 flex justify-between items-center">
                            <span className="text-xs text-slate-600">Just now</span>
                            <button className="p-1 rounded hover:bg-blue-100 text-slate-600">
                              <Download size={16} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Previous captures */}
                      {selectedDevice.lastCapture && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                          <div className="aspect-video relative">
                            <img 
                              src={selectedDevice.lastCapture} 
                              alt="Previous capture" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-2 bg-blue-50 flex justify-between items-center">
                            <span className="text-xs text-slate-600">10 minutes ago</span>
                            <button className="p-1 rounded hover:bg-blue-100 text-slate-600">
                              <Download size={16} />
                            </button>
                          </div>
                        </div>
                      )}

                      {!lastImageCapture && !selectedDevice.lastCapture && (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                          <Camera size={40} className="mb-2" />
                          <p>No captures available</p>
                          <button 
                            onClick={handleCapture}
                            className={`mt-2 ${protocolColors[selectedDevice.protocol]} px-3 py-1 rounded-md text-sm text-white transition-colors shadow-sm`}
                          >
                            Take a Capture
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Device Info Section */}
                <div className="mt-6 bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                  <h3 className="font-medium mb-3 text-slate-700">Device Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-500">Device Type</div>
                      <div className="font-medium text-slate-700">
                        {selectedDevice.type === 'raspberry-pi' ? 'Raspberry Pi' : 'ESP32 Cam'}
                      </div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-500">Current Protocol</div>
                      <div className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${protocolBadgeColors[selectedDevice.protocol]}`}>
                        {selectedDevice.protocol}
                      </div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-500">IP Address</div>
                      <div className="font-medium text-slate-700">192.168.1.{Math.floor(Math.random() * 255)}</div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-500">Last Activity</div>
                      <div className="font-medium text-slate-700">Just now</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-6">
                  <Camera size={48} className="mx-auto text-blue-300 mb-4" />
                  <h2 className="text-xl font-medium mb-2 text-slate-700">No Device Selected</h2>
                  <p className="text-slate-500">Select a device from the sidebar to view its stream</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}