export interface IoTData {
  id: number;
  altitude : number;
  pressure: number;
  temperature: number;
  timestamp: string;
}

export interface WebSocketMessage {
  type: string;
  data?: IoTData;
  message?: string;
}
