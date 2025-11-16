import React from 'react';
import { X, Package, User, Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { OrderProblem } from '../types/OrderProblem';

interface ProblemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  problem: OrderProblem;
}

export const ProblemDetailsModal: React.FC<ProblemDetailsModalProps> = ({
  isOpen,
  onClose,
  problem,
}) => {
  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'escalated':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Problem Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-gray-800">Order #{problem.order_number}</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(problem.status)}`}>
              {problem.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-600">Customer</p>
                <p className="text-base text-gray-800">{problem.customer_name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-600">SKU</p>
                <p className="text-base text-gray-800 font-mono">{problem.sku}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-600">Reported By</p>
                <p className="text-base text-gray-800">{problem.reported_by}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-600">Reported At</p>
                <p className="text-base text-gray-800">{formatDate(problem.reported_at)}</p>
              </div>
            </div>

            {problem.assigned_to && (
              <>
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Assigned To</p>
                    <p className="text-base text-blue-800 font-medium">{problem.assigned_to}</p>
                  </div>
                </div>

                {problem.picked_up_at && (
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Picked Up At</p>
                      <p className="text-base text-gray-800">{formatDate(problem.picked_up_at)}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {problem.resolved_by && (
              <>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Resolved By</p>
                    <p className="text-base text-green-800 font-medium">{problem.resolved_by}</p>
                  </div>
                </div>

                {problem.resolved_at && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Resolved At</p>
                      <p className="text-base text-gray-800">{formatDate(problem.resolved_at)}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-800 mb-2">Problem Reason</h4>
            <p className="text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">
              {problem.problem_reason}
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Problem Description</h4>
            <p className="text-gray-800 bg-gray-50 p-4 rounded-lg border border-gray-200 whitespace-pre-wrap">
              {problem.problem_description}
            </p>
          </div>

          {problem.resolution_description && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-green-800">Resolution</h4>
              </div>
              <p className="text-green-900 whitespace-pre-wrap">
                {problem.resolution_description}
              </p>
            </div>
          )}

          {problem.escalated_at && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h4 className="font-semibold text-red-800">Escalation Information</h4>
              </div>
              <p className="text-sm text-red-700 mb-1">
                <span className="font-medium">Escalated at:</span> {formatDate(problem.escalated_at)}
              </p>
              {problem.escalation_reason && (
                <p className="text-sm text-red-700">
                  <span className="font-medium">Reason:</span> {problem.escalation_reason}
                </p>
              )}
            </div>
          )}

          {problem.google_sheet_synced_at && (
            <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-200">
              Last synced to Google Sheets: {formatDate(problem.google_sheet_synced_at)}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
