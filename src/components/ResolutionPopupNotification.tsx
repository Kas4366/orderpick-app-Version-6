import React, { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { orderProblemsService } from '../services/orderProblemsService';
import { OrderProblemNotification } from '../types/OrderProblem';

interface ResolutionPopupNotificationProps {
  employeeName: string;
}

export const ResolutionPopupNotification: React.FC<ResolutionPopupNotificationProps> = ({ employeeName }) => {
  const [activeNotifications, setActiveNotifications] = useState<OrderProblemNotification[]>([]);

  useEffect(() => {
    const unsubscribe = orderProblemsService.subscribeToNotifications(
      employeeName,
      (notification) => {
        if (notification.notification_type === 'resolved' && notification.problem) {
          console.log('Resolution notification received for packer:', notification);

          setActiveNotifications(prev => [...prev, notification]);

          playNotificationSound();

          setTimeout(() => {
            setActiveNotifications(prev => prev.filter(n => n.id !== notification.id));
            orderProblemsService.markNotificationAsRead(notification.id);
          }, 15000);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [employeeName]);

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  const handleDismiss = (notificationId: string) => {
    setActiveNotifications(prev => prev.filter(n => n.id !== notificationId));
    orderProblemsService.markNotificationAsRead(notificationId);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (activeNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3 max-w-md">
      {activeNotifications.map((notification) => {
        const problem = notification.problem;
        if (!problem) return null;

        return (
          <div
            key={notification.id}
            className="bg-green-600 border-2 border-green-700 rounded-lg shadow-2xl p-5 animate-slide-in-right"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-white flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-bold text-white">Problem Resolved!</h3>
                  <p className="text-green-100 text-sm">Your reported issue has been fixed</p>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(notification.id)}
                className="text-white hover:text-green-200 transition-colors flex-shrink-0 p-1"
                aria-label="Dismiss notification"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 bg-green-500 bg-opacity-50 rounded-lg p-4">
              <div className="text-white">
                <p className="text-sm mb-1">
                  <span className="font-semibold">Order:</span> #{problem.order_number}
                </p>
                <p className="text-sm mb-1">
                  <span className="font-semibold">Customer:</span> {problem.customer_name}
                </p>
                <p className="text-sm mb-1">
                  <span className="font-semibold">SKU:</span> {problem.sku}
                </p>
                <p className="text-sm mb-3">
                  <span className="font-semibold">Problem:</span> {problem.problem_reason}
                </p>
              </div>

              {problem.resolution_description && (
                <div className="bg-white bg-opacity-20 rounded p-3 border border-white border-opacity-30">
                  <p className="text-xs font-semibold text-white mb-1">Resolution:</p>
                  <p className="text-sm text-white">{problem.resolution_description}</p>
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white border-opacity-30">
                <p className="text-xs text-green-100">
                  Resolved by {problem.resolved_by}
                </p>
                <p className="text-xs text-green-100">
                  {formatDate(problem.resolved_at)}
                </p>
              </div>
            </div>

            <div className="mt-3 text-center">
              <p className="text-xs text-green-200">Auto-dismissing in 15 seconds...</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
