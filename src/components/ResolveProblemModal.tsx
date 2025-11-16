import React, { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { OrderProblem } from '../types/OrderProblem';

interface ResolveProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (resolutionDescription: string) => Promise<void>;
  problem: OrderProblem;
}

export const ResolveProblemModal: React.FC<ResolveProblemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  problem,
}) => {
  const [resolutionDescription, setResolutionDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resolutionDescription.trim()) {
      alert('Please provide a resolution description');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(resolutionDescription);
      setResolutionDescription('');
    } catch (err) {
      console.error('Error submitting resolution:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setResolutionDescription('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-800">Resolve Problem</h2>
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
            <h3 className="font-semibold text-gray-800 mb-2">Order #{problem.order_number}</h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Customer:</span> {problem.customer_name}
            </p>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">SKU:</span> {problem.sku}
            </p>
            <p className="text-sm text-gray-600 mb-3">
              <span className="font-medium">Problem:</span> {problem.problem_reason}
            </p>
            <p className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200">
              {problem.problem_description}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="resolution" className="block text-sm font-medium text-gray-700 mb-2">
                Resolution Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="resolution"
                value={resolutionDescription}
                onChange={(e) => setResolutionDescription(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                placeholder="Describe how you resolved this problem..."
                disabled={isSubmitting}
                required
              />
              <p className="mt-2 text-sm text-gray-500">
                Provide a detailed explanation of how the problem was resolved. This will be recorded and synced to Google Sheets.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Mark as Resolved'}
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
        </div>
      </div>
    </div>
  );
};
