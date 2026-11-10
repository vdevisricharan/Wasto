import React, { useState, useEffect } from 'react';
import { History, Download, Filter, Search, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchHistory } from '../api/client';
import { PredictionResult, RoutingCategory } from '../types';

export const HistoryView: React.FC = () => {
  const [items, setItems] = useState<PredictionResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [selectedRouting, setSelectedRouting] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchHistory(page, pageSize, selectedMaterial || undefined, selectedRouting || undefined);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      // client fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, selectedMaterial, selectedRouting]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const downloadCsv = () => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    window.open(`${apiBase}/api/export/predictions.csv`, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-wasto-400" />
            Classification History & Audit Log
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Auditable record of all edge inference decisions with confidence scores and routing categories.
          </p>
        </div>

        <button
          onClick={downloadCsv}
          className="px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 border border-gray-700 text-xs font-semibold text-white flex items-center space-x-1.5 transition-all shadow-md active:scale-95"
        >
          <Download className="w-4 h-4 text-wasto-400" />
          <span>Export Full CSV</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 rounded-xl border border-gray-800 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center space-x-1.5 text-gray-400 font-semibold">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter By:</span>
        </div>

        <select
          value={selectedMaterial}
          onChange={(e) => {
            setSelectedMaterial(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 rounded-lg bg-surface-800 border border-gray-700 text-gray-200"
        >
          <option value="">All Material Classes</option>
          <option value="Glass">Glass</option>
          <option value="Plastic">Plastic</option>
          <option value="Paper and Cardboard">Paper and Cardboard</option>
          <option value="Organic Waste">Organic Waste</option>
          <option value="Aluminium">Aluminium</option>
          <option value="Carton">Carton</option>
          <option value="Other Plastics">Other Plastics</option>
          <option value="Textiles">Textiles</option>
          <option value="Wood">Wood</option>
        </select>

        <select
          value={selectedRouting}
          onChange={(e) => {
            setSelectedRouting(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 rounded-lg bg-surface-800 border border-gray-700 text-gray-200"
        >
          <option value="">All Operational Chutes</option>
          <option value="Recyclable">Chute 2: Recyclable</option>
          <option value="Organic">Chute 1: Organic</option>
          <option value="Residual">Chute 3: Residual</option>
          <option value="Unknown / Manual Review">Manual Review Required</option>
        </select>

        <div className="ml-auto text-gray-400 font-mono text-[11px]">
          Showing {items.length} of {total} records
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-800/80 text-gray-400 border-b border-gray-700 font-medium">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Prediction ID</th>
                <th className="py-3 px-4">Image Filename</th>
                <th className="py-3 px-4">Material Class</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Operational Routing</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-mono">
              {items.map((row) => (
                <tr key={row.prediction_id} className="hover:bg-surface-800/40 transition-colors">
                  <td className="py-3 px-4 text-gray-400">
                    {new Date(row.timestamp * 1000).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4 font-bold text-gray-300 truncate max-w-[120px]">
                    {row.prediction_id}
                  </td>
                  <td className="py-3 px-4 font-sans text-gray-200 truncate max-w-[150px]">
                    {row.filename}
                  </td>
                  <td className="py-3 px-4 font-sans font-semibold text-white">
                    {row.material_label}
                  </td>
                  <td className="py-3 px-4 text-wasto-400 font-bold">
                    {(row.confidence * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 font-sans">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        row.routing_category === 'Organic'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : row.routing_category === 'Recyclable'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : row.routing_category === 'Residual'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {row.routing_category}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {row.is_uncertain ? (
                      <span className="text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Flagged
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Normal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No classification records matching active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <span>Page {page} of {totalPages}</span>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed border border-gray-700 text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed border border-gray-700 text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
