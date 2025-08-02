'use client';

import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { IoTData } from '../types/iot';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface RealtimeChartProps {
  data: IoTData[];
  dataKey: keyof Pick<IoTData, 'temperature' | 'altitude' | 'pressure'>;
  label: string;
  borderColor: string;
  backgroundColor: string;
}

const RealtimeChart: React.FC<RealtimeChartProps> = ({
  data,
  dataKey,
  label,
  borderColor,
  backgroundColor,
}) => {
  const chartData = {
    datasets: [
      {
        label: label,
        data: data.map(item => ({
          x: new Date(item.timestamp),
          y: item[dataKey],
        })),
        borderColor: borderColor,
        backgroundColor: backgroundColor,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: label,
        font: {
          size: 16,
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
          },
        },
        title: {
          display: true,
          text: 'Time',
        },
      },
      y: {
        title: {
          display: true,
          text: label,
        },
        beginAtZero: false,
      },
    },
    animation: {
      duration: 0, // Disable animation for real-time data
    },
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md" style={{ height: '300px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default RealtimeChart;