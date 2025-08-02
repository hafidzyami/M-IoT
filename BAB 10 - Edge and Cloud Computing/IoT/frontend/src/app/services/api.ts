import { IoTData } from "../types/iot";

// Get API base URL dynamically
const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Use empty string for relative paths when using proxy
  if (typeof window !== 'undefined') {
    return '';
  }
  
  return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();
const API_ENDPOINT = `${API_BASE_URL}/api`;

export const fetchHistoricalData = async (): Promise<IoTData[]> => {
  try {
    const response = await fetch(`${API_ENDPOINT}/iot`);
    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return [];
  }
};

export const fetchDataByRange = async (start: string, end: string): Promise<IoTData[]> => {
  try {
    const response = await fetch(
      `${API_ENDPOINT}/iot/range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching data by range:', error);
    return [];
  }
};

export const checkSocketStatus = async (): Promise<{ status: string; connectedClients: number; socketUrl: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/ws/status`);
    if (!response.ok) {
      throw new Error('Failed to fetch socket status');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching socket status:', error);
    return { status: 'error', connectedClients: 0, socketUrl: '' };
  }
};