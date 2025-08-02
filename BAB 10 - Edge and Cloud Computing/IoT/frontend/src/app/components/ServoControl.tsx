"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Socket } from "socket.io-client";

interface ServoControlProps {
  socket: Socket | null;
}

const ServoControl: React.FC<ServoControlProps> = ({ socket }) => {
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [angle, setAngle] = useState<number>(90);
  const [inputAngle, setInputAngle] = useState<string>("90");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceText, setVoiceText] = useState<string>("");
  const [voiceSupported, setVoiceSupported] = useState<boolean>(false);

  const handleModeChange = (newMode: "manual" | "auto") => {
    setMode(newMode);
    setError("");
    
    if (newMode === "auto") {
      // Send auto mode command without throttling
      if (socket && socket.connected) {
        socket.emit("servo_control", { angle: 181 });
      }
    }
  };

  const handleAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputAngle(value);
    
    // Validate input
    const numValue = parseInt(value);
    if (value === "" || (numValue >= 0 && numValue <= 180)) {
      setError("");
    } else {
      setError("Please enter a value between 0 and 180");
    }
  };

  // Move the sendServoCommand definition before handleSliderChange
  // Add refs for throttling
  const lastSentTime = useRef<number>(0);
  const pendingValue = useRef<number | null>(null);
  const throttleTimer = useRef<NodeJS.Timeout | null>(null);

  const sendServoCommand = useCallback((value: number) => {
    if (!socket || !socket.connected) {
      return;
    }

    const now = Date.now();
    const timeSinceLastSend = now - lastSentTime.current;
    const throttleInterval = 50; // Send at most every 50ms

    if (timeSinceLastSend >= throttleInterval) {
      // Send immediately if enough time has passed
      setIsLoading(true);
      socket.emit("servo_control", { angle: value });
      lastSentTime.current = now;
      
      // Reset loading state after short delay
      setTimeout(() => setIsLoading(false), 100);
    } else {
      // Store the pending value and schedule a send
      pendingValue.current = value;
      
      if (!throttleTimer.current) {
        throttleTimer.current = setTimeout(() => {
          if (pendingValue.current !== null) {
            setIsLoading(true);
            socket.emit("servo_control", { angle: pendingValue.current });
            lastSentTime.current = Date.now();
            pendingValue.current = null;
            
            // Reset loading state after short delay
            setTimeout(() => setIsLoading(false), 100);
          }
          throttleTimer.current = null;
        }, throttleInterval - timeSinceLastSend);
      }
    }
  }, [socket]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setAngle(value);
    setInputAngle(value.toString());
    setError("");
    
    // Send command with throttling
    sendServoCommand(value);
  }, [sendServoCommand]);

  // Removed - no longer need this line

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === "manual") {
      const angleValue = parseInt(inputAngle);
      if (isNaN(angleValue) || angleValue < 0 || angleValue > 180) {
        setError("Please enter a valid angle between 0 and 180");
        return;
      }
      setAngle(angleValue);
      sendServoCommand(angleValue);
    }
  };

  // Removed - no longer need handleSliderRelease since we send on change

  // Check if Web Speech API is supported
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setVoiceSupported(true);
    }
  }, []);

  const startVoiceControl = () => {
    if (!voiceSupported) {
      alert("Voice control is not supported in your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    // Detect Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    // Set language based on browser - Safari doesn't support multiple languages
    if (isSafari) {
      // Use single language for Safari
      recognition.lang = navigator.language.startsWith('id') ? 'id-ID' : 'en-US';
    } else {
      recognition.lang = 'id-ID,en-US';
    }
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1; // Safari might work better with fewer alternatives

    // For Safari: set maximum duration
    let timeoutId: NodeJS.Timeout;
    const maxDuration = isSafari ? 8000 : 5000; // Back to original timeout

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceText("Listening...");
      
      // Set timeout for Safari
      timeoutId = setTimeout(() => {
        try {
          recognition.stop();
        } catch (error) {
          console.log("Error stopping recognition:", error);
        }
      }, maxDuration);
    };

    recognition.onresult = (event: any) => {
      try {
        const transcript = event.results[0][0].transcript.toLowerCase();
        const confidence = event.results[0][0].confidence;
        console.log(`Recognized: "${transcript}" (confidence: ${confidence})`);
        
        setVoiceText(`Heard: "${transcript}"`);
        
        // Process voice command (English and Indonesian)
        // Check for auto mode commands with more Indonesian variations
        const autoPatterns = [
          "auto", "automatic", "auto mode", "automatic mode",
          "otomatis", "mode otomatis", "putar otomatis", "otomatis aja",
          "otomatis saja", "mode auto", "auto aja", "auto saja"
        ];
        
        const manualPatterns = [
          "manual", "manual mode", "mode manual"
        ];
        
        let commandFound = false;
        
        // Check for auto mode
        for (const pattern of autoPatterns) {
          if (transcript.includes(pattern)) {
            handleModeChange("auto");
            setVoiceText("Setting servo to auto mode");
            commandFound = true;
            break;
          }
        }
        
        // Check for manual mode
        if (!commandFound) {
          for (const pattern of manualPatterns) {
            if (transcript.includes(pattern)) {
              handleModeChange("manual");
              setVoiceText("Setting servo to manual mode");
              commandFound = true;
              break;
            }
          }
        }
        
        // Try to extract angle if no mode command found
        if (!commandFound) {
          // Try to extract angle from various speech patterns
          let detectedAngle: number | null = null;
          
          // Pattern 1: Direct number patterns - extract any number in the transcript
          const numberPattern = transcript.match(/(\d+)/);
          if (numberPattern) {
            detectedAngle = parseInt(numberPattern[1]);
          }
          
          // Pattern 2: Word to number conversion for common angles
          if (!detectedAngle) {
            const angleWords: { [key: string]: number } = {
              // English words
              'zero': 0, 'ten': 10, 'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
              'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
              'one hundred': 100, 'one twenty': 120, 'one fifty': 150,
              'one eighty': 180, 'half': 90, 'full': 180,
              // Indonesian numbers and variations
              'nol': 0, 'kosong': 0,
              'sepuluh': 10, 'se puluh': 10,
              'dua puluh': 20, 'duapuluh': 20, 'dua belas': 12,
              'tiga puluh': 30, 'tigapuluh': 30, 'tiga lima': 35,
              'empat puluh': 40, 'empatpuluh': 40, 'empat lima': 45,
              'lima puluh': 50, 'limapuluh': 50,
              'enam puluh': 60, 'enampuluh': 60,
              'tujuh puluh': 70, 'tujuhpuluh': 70, 'tujuh lima': 75,
              'delapan puluh': 80, 'delapanpuluh': 80,
              'sembilan puluh': 90, 'sembilanpuluh': 90,
              'seratus': 100, 'se ratus': 100,
              'seratus dua puluh': 120, 'seratus duapuluh': 120,
              'seratus lima puluh': 150, 'seratus limapuluh': 150,
              'seratus delapan puluh': 180, 'seratus delapanpuluh': 180,
              'setengah': 90, 'tengah': 90, 'penuh': 180
            };
            
            for (const [word, angle] of Object.entries(angleWords)) {
              if (transcript.includes(word)) {
                detectedAngle = angle;
                break;
              }
            }
          }
          
          // If angle detected, execute the command
          if (detectedAngle !== null && detectedAngle >= 0 && detectedAngle <= 180) {
            setMode("manual");
            setAngle(detectedAngle);
            setInputAngle(detectedAngle.toString());
            sendServoCommand(detectedAngle);
            setVoiceText(`Setting servo to ${detectedAngle}°`);
          } else if (detectedAngle !== null) {
            setVoiceText(`Invalid angle: ${detectedAngle}°. Please use 0-180.`);
          } else {
            setVoiceText(`Command not recognized: "${transcript}"`);
          }
        }
      } catch (error) {
        console.log("Error processing result:", error);
        setVoiceText("Error processing voice command");
      }
      
      // Stop recognition after processing
      try {
        recognition.stop();
      } catch (error) {
        console.log("Error stopping recognition:", error);
      }
    };

    // Add a slight delay before stopping to ensure complete recognition
    let speechEndTimeout: NodeJS.Timeout;
    
    recognition.onspeechend = () => {
      // Wait a bit before stopping to ensure all speech is captured
      speechEndTimeout = setTimeout(() => {
        recognition.stop();
      }, 500); // 500ms delay after speech ends
    };

    recognition.onerror = (event: any) => {
      console.log("Speech recognition error:", event.error, event);
      
      // Safari might throw 'no-speech' error if it doesn't detect speech
      if (event.error === 'no-speech') {
        setVoiceText("No speech detected. Please try again.");
      } else if (event.error === 'audio-capture') {
        setVoiceText("Microphone access denied. Please enable microphone.");
      } else {
        setVoiceText(`Error: ${event.error}`);
      }
      
      setIsListening(false);
      clearTimeout(timeoutId);
    };

    recognition.onend = () => {
      setIsListening(false);
      clearTimeout(timeoutId);
      clearTimeout(speechEndTimeout);
      // Clear voice text after delay
      setTimeout(() => setVoiceText(""), 3000);
    };

    // Start recognition
    try {
      recognition.start();
    } catch (error) {
      console.log("Error starting recognition:", error);
      setIsListening(false);
      setVoiceText("Error: Could not start voice recognition");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-all duration-300">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">Servo Motor Control</h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Control servo motor angle (0-180°) or set to auto mode - Voice enabled
          </p>
        </div>
        <div className="flex flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => handleModeChange("manual")}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              mode === "manual"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => handleModeChange("auto")}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              mode === "auto"
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Auto
          </button>
        </div>
      </div>

      {mode === "manual" ? (
        <div className="space-y-6">
          {/* Angle Slider */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Angle: {angle}°
            </label>
            <input
              type="range"
              min="0"
              max="180"
              value={angle}
              onChange={handleSliderChange}
              onInput={handleSliderChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 mt-1">
              <span>0°</span>
              <span>90°</span>
              <span>180°</span>
            </div>
          </div>

          {/* Manual Input */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Or enter angle manually:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={inputAngle}
                  onChange={handleAngleChange}
                  className={`w-full sm:flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    error ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Enter angle (0-180)"
                />
                <button
                  type="submit"
                  disabled={isLoading || !socket?.connected || !!error}
                  className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium text-sm text-white transition-all ${
                    isLoading || !socket?.connected || !!error
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-500 hover:bg-blue-600 active:scale-95"
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Setting...
                    </div>
                  ) : (
                    "Set Angle"
                  )}
                </button>
              </div>
              {error && (
                <p className="text-red-500 text-xs sm:text-sm mt-1">{error}</p>
              )}
            </div>
          </form>

          {/* Visual Representation */}
          <div className="mt-4 sm:mt-7 flex justify-center">
            <div className="relative w-32 h-32 sm:w-48 sm:h-48">
              {/* Base circle */}
              <div className="absolute inset-0 border-2 sm:border-4 border-gray-200 rounded-full" />
              
              {/* Servo arm */}
              <div
                className="absolute top-1/2 left-1/2 w-14 sm:w-20 h-0.5 sm:h-1 bg-blue-500 origin-left transform -translate-y-1/2 transition-transform duration-300 mx-7 sm:mx-10"
                style={{ transform: `translate(-50%, -50%) rotate(${angle - 90}deg)` }}
              />
              
              {/* Center point */}
              <div className="absolute top-1/2 left-1/2 w-3 h-3 sm:w-4 sm:h-4 bg-blue-600 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
              
              {/* Angle indicators */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4 sm:-translate-y-6 text-[10px] sm:text-sm text-gray-500">0°</div>
              <div className="absolute top-1/2 right-0 transform translate-x-4 sm:translate-x-6 -translate-y-1/2 text-[10px] sm:text-sm text-gray-500">90°</div>
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-4 sm:translate-y-6 text-[10px] sm:text-sm text-gray-500">180°</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 sm:py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full mb-3 sm:mb-4">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h4 className="text-base sm:text-lg font-medium text-gray-800 mb-1 sm:mb-2">Auto Mode Active</h4>
          <p className="text-sm sm:text-base text-gray-600">
            The servo is running in automatic mode
          </p>
        </div>
      )}

      {/* Voice Control Button */}
      {voiceSupported && (
        <div className="mt-7 flex justify-center">
          <button
            onClick={startVoiceControl}
            disabled={isListening || !socket?.connected}
            className={`
              w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all duration-300 transform
              ${isListening ? "bg-red-500 hover:bg-red-600 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"}
              ${isListening || !socket?.connected ? "opacity-75 cursor-not-allowed" : "hover:scale-105 active:scale-95"}
              shadow-lg hover:shadow-xl
            `}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span>{isListening ? "Listening..." : "Voice Control"}</span>
            </div>
          </button>
        </div>
      )}

      {/* Voice Feedback Text */}
      {voiceText && (
        <div className="mt-3 text-xs sm:text-sm text-gray-600 text-center">
          {voiceText}
        </div>
      )}

      {/* Status Indicator */}
      <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm gap-2">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${socket?.connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-gray-600">
            {socket?.connected ? "Connected to server" : "Disconnected"}
          </span>
        </div>
        <div className="text-gray-500">
          Current: {mode === "auto" ? "Auto" : `${angle}°`}
        </div>
      </div>

      {/* Voice Command Instructions */}
      {voiceSupported && (
        <div className="mt-3 text-center text-xs sm:text-sm text-gray-400">
          🎤 Examples: "Set 90", "Putar 45", "Mode otomatis", "Sembilan puluh derajat"
        </div>
      )}
    </div>
  );
};

export default ServoControl;
