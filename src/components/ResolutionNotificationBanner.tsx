import React, { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { orderProblemsService } from '../services/orderProblemsService';
import { OrderProblem } from '../types/OrderProblem';

interface ResolutionNotificationBannerProps {
  employeeName: string;
}

interface ResolutionNotification {
  id: string;
  problem: OrderProblem;
  timestamp: string;
}

export const ResolutionNotificationBanner: React.FC<ResolutionNotificationBannerProps> = ({ employeeName }) => {
  const [notifications, setNotifications] = useState<ResolutionNotification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = orderProblemsService.subscribeToProblems((updatedProblem) => {
      if (updatedProblem.status === 'resolved' && updatedProblem.resolved_at) {
        const notification: ResolutionNotification = {
          id: updatedProblem.id,
          problem: updatedProblem,
          timestamp: updatedProblem.resolved_at,
        };

        setNotifications(prev => {
          const exists = prev.find(n => n.id === notification.id);
          if (exists) {
            return prev.map(n => n.id === notification.id ? notification : n);
          }
          return [notification, ...prev];
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleDismiss = (notificationId: string) => {
    setDismissedIds(prev => new Set([...prev, notificationId]));
  };

  const visibleNotifications = notifications.filter(n => !dismissedIds.has(n.id));

  if (visibleNotifications.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="fixed top-16 left-0 right-0 z-40 px-4 py-2 space-y-2">
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className="max-w-4xl mx-auto bg-green-600 border border-green-700 rounded-lg shadow-lg p-4 animate-slide-down"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <CheckCircle className="w-6 h-6 text-white flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-white">Problem Resolved</h3>
                  <span className="text-green-200 text-sm">
                    {formatDate(notification.timestamp)}
                  </span>
                </div>
                <div className="space-y-1 text-white">
                  <p className="text-sm">
                    <span className="font-semibold">Order #:</span> {notification.problem.order_number}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Customer:</span> {notification.problem.customer_name}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">SKU:</span> {notification.problem.sku}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Problem:</span> {notification.problem.problem_reason}
                  </p>
                  {notification.problem.resolution_description && (
                    <div className="mt-2 bg-green-500 bg-opacity-50 rounded p-2">
                      <p className="text-sm">
                        <span className="font-semibold">Resolution:</span> {notification.problem.resolution_description}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-green-200 mt-2">
                    <span className="font-semibold">Resolved by:</span> {notification.problem.resolved_by}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(notification.id)}
              className="text-white hover:text-green-200 transition-colors flex-shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
