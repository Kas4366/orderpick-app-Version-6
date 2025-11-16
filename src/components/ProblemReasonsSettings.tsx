import React, { useState, useEffect } from 'react';
import { Plus, X, Save, Trash2, AlertCircle } from 'lucide-react';
import { orderProblemsService } from '../services/orderProblemsService';
import { ProblemReason } from '../types/OrderProblem';

export const ProblemReasonsSettings: React.FC = () => {
  const [reasons, setReasons] = useState<ProblemReason[]>([]);
  const [newReason, setNewReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadReasons();
  }, []);

  const loadReasons = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await orderProblemsService.getProblemReasons();
      setReasons(data);
    } catch (err) {
      setError('Failed to load problem reasons');
      console.error('Error loading reasons:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddReason = async () => {
    if (!newReason.trim()) {
      setError('Please enter a reason');
      return;
    }

    if (reasons.some(r => r.reason.toLowerCase() === newReason.trim().toLowerCase())) {
      setError('This reason already exists');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const created = await orderProblemsService.createProblemReason(newReason.trim());
      setReasons([...reasons, created]);
      setNewReason('');
      setSuccessMessage('Reason added successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Failed to add reason');
      console.error('Error adding reason:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReason = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reason?')) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await orderProblemsService.deleteProblemReason(id);
      setReasons(reasons.filter(r => r.id !== id));
      setSuccessMessage('Reason deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Failed to delete reason');
      console.error('Error deleting reason:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Problem Reasons</h3>
        <p className="text-sm text-gray-600 mb-4">
          Manage the list of reasons that packers can select when reporting order problems.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <Save className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add New Reason
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddReason();
              }
            }}
            placeholder="Enter a new problem reason..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSaving}
          />
          <button
            onClick={handleAddReason}
            disabled={isSaving || !newReason.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading reasons...</p>
        </div>
      ) : reasons.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-gray-600">No problem reasons configured yet.</p>
          <p className="text-sm text-gray-500 mt-1">Add your first reason above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Current Reasons ({reasons.length})
          </h4>
          {reasons.map((reason, index) => (
            <div
              key={reason.id}
              className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-500 w-6">
                  {index + 1}.
                </span>
                <span className="text-sm text-gray-800">{reason.reason}</span>
              </div>
              <button
                onClick={() => handleDeleteReason(reason.id)}
                disabled={isSaving}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                title="Delete reason"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Note: Deleted reasons will no longer appear in the problem reporting form, but existing problems
          that used those reasons will retain them for historical records.
        </p>
      </div>
    </div>
  );
};
