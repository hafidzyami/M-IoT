"use client";

import React, { useState, useEffect, useCallback } from "react";
import { IoTData } from "../types/iot";
import { fetchPaginatedData, fetchDataByRange } from "../services/api";

type Mode = "paginated" | "range";

const LIMIT = 20;

const HistoricalData: React.FC = () => {
  const [mode, setMode] = useState<Mode>("paginated");

  // Paginated state
  const [page, setPage] = useState(1);
  const [paginatedData, setPaginatedData] = useState<IoTData[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingPage, setLoadingPage] = useState(false);

  // Range state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rangeData, setRangeData] = useState<IoTData[]>([]);
  const [loadingRange, setLoadingRange] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [rangeSearched, setRangeSearched] = useState(false);

  const loadPage = useCallback(async (p: number) => {
    setLoadingPage(true);
    const result = await fetchPaginatedData(p, LIMIT);
    setPaginatedData(result.data);
    setTotalPages(result.pagination.totalPages);
    setTotal(result.pagination.total);
    setLoadingPage(false);
  }, []);

  useEffect(() => {
    if (mode === "paginated") {
      loadPage(page);
    }
  }, [mode, page, loadPage]);

  const handleRangeSearch = async () => {
    if (!startDate || !endDate) {
      setRangeError("Please select both start and end dates.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setRangeError("Start date must be before end date.");
      return;
    }
    setRangeError(null);
    setLoadingRange(true);
    setRangeSearched(true);
    const data = await fetchDataByRange(
      new Date(startDate).toISOString(),
      new Date(endDate).toISOString()
    );
    setRangeData(data);
    setLoadingRange(false);
  };

  const displayData = mode === "paginated" ? paginatedData : rangeData;
  const loading = mode === "paginated" ? loadingPage : loadingRange;

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-shadow duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <h2 className="text-base sm:text-lg font-semibold text-gray-800">
          Historical Data
        </h2>
        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200 w-fit">
          <button
            onClick={() => { setMode("paginated"); setPage(1); }}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors duration-150 ${
              mode === "paginated"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Browse Pages
          </button>
          <button
            onClick={() => setMode("range")}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors duration-150 ${
              mode === "range"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Date Range
          </button>
        </div>
      </div>

      {/* Range filter controls */}
      {mode === "range" && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-gray-500">Start</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-gray-500">End</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleRangeSearch}
              disabled={loadingRange}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-150"
            >
              {loadingRange ? "Searching..." : "Search"}
            </button>
          </div>
        </div>
      )}

      {rangeError && (
        <p className="text-red-500 text-xs mb-3">{rangeError}</p>
      )}

      {/* Paginated info */}
      {mode === "paginated" && total > 0 && (
        <p className="text-xs text-gray-400 mb-3">
          Showing page {page} of {totalPages} &mdash; {total} total records
        </p>
      )}

      {/* Range info */}
      {mode === "range" && rangeSearched && !loadingRange && (
        <p className="text-xs text-gray-400 mb-3">
          {rangeData.length} record{rangeData.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayData.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {mode === "range" && !rangeSearched
            ? "Select a date range and press Search."
            : "No data found."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-2 text-xs text-gray-400 font-medium">ID</th>
                <th className="text-left py-2 px-2 text-xs text-gray-400 font-medium">Timestamp</th>
                <th className="text-right py-2 px-2 text-xs text-blue-400 font-medium">Temp (°C)</th>
                <th className="text-right py-2 px-2 text-xs text-green-400 font-medium">Altitude (m)</th>
                <th className="text-right py-2 px-2 text-xs text-purple-400 font-medium">Pressure (hPa)</th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((row) => (
                <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors duration-100">
                  <td className="py-2 px-2 text-gray-400 text-xs">{row.id}</td>
                  <td className="py-2 px-2 text-gray-600 text-xs whitespace-nowrap">
                    {new Date(row.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-blue-600">
                    {row.temperature.toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-green-600">
                    {row.altitude.toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-purple-600">
                    {row.pressure.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination controls */}
      {mode === "paginated" && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loadingPage}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors duration-150"
          >
            ← Previous
          </button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Show pages around current
              let p: number;
              if (totalPages <= 5) {
                p = i + 1;
              } else if (page <= 3) {
                p = i + 1;
              } else if (page >= totalPages - 2) {
                p = totalPages - 4 + i;
              } else {
                p = page - 2 + i;
              }
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 text-xs rounded-md font-medium transition-colors duration-150 ${
                    p === page
                      ? "bg-blue-600 text-white"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loadingPage}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors duration-150"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default HistoricalData;
