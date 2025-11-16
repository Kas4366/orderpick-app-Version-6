import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CheckCircle, AlertCircle, User, Calendar, Package, ArrowLeft } from 'lucide-react';
import { useEmployee } from '../contexts/EmployeeContext';
import { orderProblemsService } from '../services/orderProblemsService';
import { OrderProblem, ProblemStatus } from '../types/OrderProblem';
import { ResolveProblemModal } from '../components/ResolveProblemModal';
import { ProblemDetailsModal } from '../components/ProblemDetailsModal';

type FilterTab = 'all' | 'pending' | 'in_progress' | 'escalated' | 'resolved';

interface OrderProblemsViewProps {
  onBackToOrders?: () => void;
}

export const OrderProblemsView: React.FC<OrderProblemsViewProps> = ({ onBackToOrders }) => {
  const { currentSession } = useEmployee();
  const [problems, setProblems] = useState<OrderProblem[]>([]);
  const [filteredProblems, setFilteredProblems] = useState<OrderProblem[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<OrderProblem | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    loadProblems();
    checkEscalations();

    const unsubscribe = orderProblemsService.subscribeToProblems((updatedProblem) => {
      setProblems(prev => {
        const index = prev.findIndex(p => p.id === updatedProblem.id);
        if (index >= 0) {
          const newProblems = [...prev];
          newProblems[index] = updatedProblem;
          return newProblems;
        } else {
          return [updatedProblem, ...prev];
        }
      });
    });

    const escalationInterval = setInterval(checkEscalations, 60000);

    return () => {
      unsubscribe();
      clearInterval(escalationInterval);
    };
  }, []);

  useEffect(() => {
    filterProblems();
  }, [problems, activeFilter]);

  const loadProblems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await orderProblemsService.getAllProblems();
      setProblems(data);
    } catch (err) {
      setError('Failed to load problems. Please try again.');
      console.error('Error loading problems:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const checkEscalations = async () => {
    try {
      await orderProblemsService.checkAndEscalateOverdueProblems();
    } catch (err) {
      console.error('Error checking escalations:', err);
    }
  };

  const filterProblems = () => {
    if (activeFilter === 'all') {
      setFilteredProblems(problems);
    } else {
      setFilteredProblems(problems.filter(p => p.status === activeFilter));
    }
  };

  const handlePickUp = async (problem: OrderProblem) => {
    if (!currentSession) return;

    try {
      await orderProblemsService.pickUpProblem(problem.id, currentSession.employee.name);
    } catch (err) {
      console.error('Error picking up problem:', err);
      alert('Failed to pick up problem. Please try again.');
    }
  };

  const handleResolve = (problem: OrderProblem) => {
    setSelectedProblem(problem);
    setIsResolveModalOpen(true);
  };

  const handleViewDetails = (problem: OrderProblem) => {
    setSelectedProblem(problem);
    setIsDetailsModalOpen(true);
  };

  const handleResolveSubmit = async (resolutionDescription: string) => {
    if (!currentSession || !selectedProblem) return;

    try {
      await orderProblemsService.resolveProblem(
        selectedProblem.id,
        currentSession.employee.name,
        { resolution_description: resolutionDescription }
      );
      setIsResolveModalOpen(false);
      setSelectedProblem(null);
    } catch (err) {
      console.error('Error resolving problem:', err);
      alert('Failed to resolve problem. Please try again.');
    }
  };

  const getStatusIcon = (status: ProblemStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'in_progress':
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
      case 'escalated':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'resolved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
  };

  const getStatusColor = (status: ProblemStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'escalated':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getTimeSinceReported = (reportedAt: string) => {
    const now = new Date();
    const reported = new Date(reportedAt);
    const diffMs = now.getTime() - reported.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ago`;
    }
  };

  const counts = {
    all: problems.length,
    pending: problems.filter(p => p.status === 'pending').length,
    in_progress: problems.filter(p => p.status === 'in_progress').length,
    escalated: problems.filter(p => p.status === 'escalated').length,
    resolved: problems.filter(p => p.status === 'resolved').length,
  };

  if (!currentSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Not Logged In</h2>
          <p className="text-gray-600">Please log in to access Order Problems.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Order Problems</h1>
              <p className="text-gray-600">Review and resolve order issues reported by packers</p>
            </div>
            {onBackToOrders && (
              <button
                onClick={onBackToOrders}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Orders
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeFilter === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            onClick={() => setActiveFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeFilter === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Pending ({counts.pending})
          </button>
          <button
            onClick={() => setActiveFilter('in_progress')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeFilter === 'in_progress'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            In Progress ({counts.in_progress})
          </button>
          <button
            onClick={() => setActiveFilter('escalated')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeFilter === 'escalated'
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Escalated ({counts.escalated})
          </button>
          <button
            onClick={() => setActiveFilter('resolved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeFilter === 'resolved'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Resolved ({counts.resolved})
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading problems...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
            <p className="text-red-800">{error}</p>
            <button
              onClick={loadProblems}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No problems found</h3>
            <p className="text-gray-600">
              {activeFilter === 'all'
                ? 'No order problems have been reported yet.'
                : `No ${activeFilter.replace('_', ' ')} problems at the moment.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProblems.map(problem => (
              <div
                key={problem.id}
                className={`bg-white border-2 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow ${
                  problem.status === 'escalated' ? 'border-red-300' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(problem.status)}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        Order #{problem.order_number}
                      </h3>
                      <p className="text-sm text-gray-600">{problem.customer_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(problem.status)}`}>
                      {problem.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">{getTimeSinceReported(problem.reported_at)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">SKU:</span>
                    <span className="font-medium text-gray-800">{problem.sku}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Reported by:</span>
                    <span className="font-medium text-gray-800">{problem.reported_by}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Reported:</span>
                    <span className="font-medium text-gray-800">{formatDate(problem.reported_at)}</span>
                  </div>
                  {problem.assigned_to && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-600">Assigned to:</span>
                      <span className="font-medium text-blue-800">{problem.assigned_to}</span>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-1">Problem Reason:</p>
                  <p className="text-sm text-gray-800">{problem.problem_reason}</p>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-1">Description:</p>
                  <p className="text-sm text-gray-800">{problem.problem_description}</p>
                </div>

                {problem.resolution_description && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-semibold text-green-800 mb-1">Resolution:</p>
                    <p className="text-sm text-green-900">{problem.resolution_description}</p>
                    {problem.resolved_by && (
                      <p className="text-xs text-green-700 mt-2">
                        Resolved by {problem.resolved_by} on {formatDate(problem.resolved_at!)}
                      </p>
                    )}
                  </div>
                )}

                {problem.escalated_at && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-800 mb-1">
                      <AlertTriangle className="w-4 h-4 inline mr-1" />
                      Escalated
                    </p>
                    <p className="text-xs text-red-700">
                      {problem.escalation_reason} - {formatDate(problem.escalated_at)}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  {problem.status === 'pending' && (
                    <button
                      onClick={() => handlePickUp(problem)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Pick Up
                    </button>
                  )}
                  {problem.status === 'in_progress' && problem.assigned_to === currentSession.employee.name && (
                    <button
                      onClick={() => handleResolve(problem)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      Mark as Resolved
                    </button>
                  )}
                  {problem.status === 'escalated' && !problem.assigned_to && (
                    <button
                      onClick={() => handlePickUp(problem)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      Pick Up (Escalated)
                    </button>
                  )}
                  {problem.status === 'escalated' && problem.assigned_to === currentSession.employee.name && (
                    <button
                      onClick={() => handleResolve(problem)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      Mark as Resolved
                    </button>
                  )}
                  <button
                    onClick={() => handleViewDetails(problem)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedProblem && (
        <>
          <ResolveProblemModal
            isOpen={isResolveModalOpen}
            onClose={() => {
              setIsResolveModalOpen(false);
              setSelectedProblem(null);
            }}
            onSubmit={handleResolveSubmit}
            problem={selectedProblem}
          />
          <ProblemDetailsModal
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false);
              setSelectedProblem(null);
            }}
            problem={selectedProblem}
          />
        </>
      )}
    </div>
  );
};
