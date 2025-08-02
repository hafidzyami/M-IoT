"use client";

import React, { useState, useEffect } from "react";
import AnimatedRealtimeChart from "./AnimatedRealtimeChart";
import LedControl from "./LedControl";
import ServoControl from "./ServoControl";
import { IoTData, WebSocketMessage } from "../types/iot";
import { fetchHistoricalData } from "../services/api";
import { io, Socket } from "socket.io-client";

const IoTDashboard: React.FC = () => {
  const [wsStatus, setWsStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [latestData, setLatestData] = useState<IoTData | null>(null);
  const [dataHistory, setDataHistory] = useState<IoTData[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [wsErrorReason, setWsErrorReason] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    const loadHistoricalData = async () => {
      const historicalData = await fetchHistoricalData();
      setDataHistory(historicalData.slice(0, 50)); // Get last 50 records
    };

    loadHistoricalData();
    
    // Update time on client side only
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString());
    };
    updateTime();
    const timeInterval = setInterval(updateTime, 1000);

    return () => {
      if (socket) {
        socket.disconnect();
      }
      clearInterval(timeInterval);
    };
  }, []);

  useEffect(() => {
    if (isMounted) {
      connectSocket();
    }
  }, [isMounted]);



  const connectSocket = () => {
    try {
      // Use environment variable or dynamic host
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 
                       (typeof window !== 'undefined' 
                         ? `${window.location.origin}` 
                         : 'http://localhost:8000');
      
      const newSocket = io(socketUrl, {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on("connect", () => {
        console.log("Connected to Socket.IO server");
        setWsStatus("connected");
      });

      // Listen for connection message
      newSocket.on("connection", (data) => {
        console.log("Server connection message:", data);
      });

      // Listen for IoT data updates
      newSocket.on("iot_data", (data: { type: string; data: IoTData }) => {
        try {
          if (data.type === "iot_data" && data.data) {
            setLatestData(data.data);
            setDataHistory((prev) => {
              const newHistory = [data.data, ...prev];
              return newHistory.slice(0, 50);
            });
          }
        } catch (error) {
          console.error("Error processing IoT data:", error);
        }
      });

      newSocket.on("disconnect", (reason) => {
        console.log("Disconnected from Socket.IO server:", reason);
        setWsStatus("disconnected");
        setWsErrorReason(reason);
      });

      newSocket.on("connect_error", (error) => {
        console.error("Socket.IO connection error:", error);
        setWsStatus("disconnected");
        setWsErrorReason(error.message || "Unknown error");
      });

      newSocket.on("reconnect", (attemptNumber) => {
        console.log("Reconnected after", attemptNumber, "attempts");
        setWsStatus("connected");
      });

      newSocket.on("reconnect_attempt", (attemptNumber) => {
        console.log("Attempting to reconnect, attempt #", attemptNumber);
        setWsStatus("connecting");
      });

      setSocket(newSocket);
    } catch (error) {
      console.error("Error creating Socket.IO connection:", error);
      setWsStatus("disconnected");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-8 gap-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
          IoT Monitoring Dashboard
        </h1>
        <div className="text-xs sm:text-sm text-gray-500">
          {currentTime}
        </div>
      </div>

      {/* Connection Status */}
      <div
        className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg text-sm sm:text-base ${
          wsStatus === "connected"
            ? "bg-green-100 text-green-800"
            : wsStatus === "connecting"
            ? "bg-yellow-100 text-yellow-800"
            : "bg-red-100 text-red-800"
        }`}
      >
        {wsStatus === "connected"
          ? "🟢 Connected to IoT server"
          : wsStatus === "connecting"
          ? "🟡 Connecting to IoT server..."
          : `🔴 Disconnected from IoT server - Reconnecting... (${
              wsErrorReason ?? "No reason provided"
            })`}
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <LedControl socket={socket} />
        <ServoControl socket={socket} />
      </div>

      {/* Latest Reading Card */}
      {latestData && (
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-shadow duration-300 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">
            Latest Readings
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600">
                {latestData.temperature.toFixed(1)}°
              </div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">Temperature</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">
                {latestData.altitude.toFixed(1)}m
              </div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">Altitude</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600">
                {latestData.pressure.toFixed(0)}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">Pressure</div>
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
            <div className="flex items-center text-xs sm:text-sm text-gray-500">
              <svg
                className="w-3 h-3 sm:w-4 sm:h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {isMounted ? new Date(latestData.timestamp).toLocaleString() : ""}
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <AnimatedRealtimeChart
          data={dataHistory}
          dataKey="temperature"
          label="Temperature"
          borderColor="#3b82f6"
          backgroundColor="rgba(59, 130, 246, 0.1)"
          gradientFrom="rgba(59, 130, 246, 0.05)"
          gradientTo="rgba(59, 130, 246, 0.2)"
          unit="°C"
        />
        <AnimatedRealtimeChart
          data={dataHistory}
          dataKey="altitude"
          label="Altitude"
          borderColor="#22c55e"
          backgroundColor="rgba(34, 197, 94, 0.1)"
          gradientFrom="rgba(34, 197, 94, 0.05)"
          gradientTo="rgba(34, 197, 94, 0.2)"
          unit="m"
        />
        <AnimatedRealtimeChart
          data={dataHistory}
          dataKey="pressure"
          label="Atmospheric Pressure"
          borderColor="#a855f7"
          backgroundColor="rgba(168, 85, 247, 0.1)"
          gradientFrom="rgba(168, 85, 247, 0.05)"
          gradientTo="rgba(168, 85, 247, 0.2)"
          unit=" hPa"
        />
      </div>
    </div>
  );
};

export default IoTDashboard;
