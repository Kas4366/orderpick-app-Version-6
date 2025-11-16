import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { orderProblemsService } from '../services/orderProblemsService';
import { ProblemReason } from '../types/OrderProblem';

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, description: string) => Promise<void>;
  orderNumber: string;
  sku: string;
  customerName: string;
}

export const ReportProblemModal: React.FC<ReportProblemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  orderNumber,
  sku,
  customerName,
}) => {
  const [problemReasons, setProblemReasons] = useState<ProblemReason[]>([]);
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProblemReasons();
    }
  }, [isOpen]);

  const loadProblemReasons = async () => {
    setIsLoading(true);
    try {
      const reasons = await orderProblemsService.getProblemReasons();
      setProblemReasons(reasons);
    } catch (err) {
      console.error('Error loading problem reasons:', err);
      alert('Failed to load problem reasons. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedReason) {
      alert('Please select a problem reason');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(selectedReason, description);
      setSelectedReason('');
      setDescription('');
    } catch (err) {
      console.error('Error submitting problem:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason('');
      setDescription('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold text-gray-800">Report Problem</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">Order Information</h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Order #:</span> {orderNumber}
            </p>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Customer:</span> {customerName}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">SKU:</span> {sku}
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading problem reasons...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Problem Reason <span className="text-red-500">*</span>
                </label>
                <select
                  id="reason"
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={isSubmitting}
                  required
                >
                  <option value="">Select a reason...</option>
                  {problemReasons.map((reason) => (
                    <option key={reason.id} value={reason.reason}>
                      {reason.reason}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Problem Description <span className="text-gray-400">(Optional)</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  placeholder="Provide additional details about the problem (optional)..."
                  disabled={isSubmitting}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Additional details are optional but helpful to resolve this issue quickly.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Reporting...' : 'Report Problem'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
