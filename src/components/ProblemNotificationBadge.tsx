import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { orderProblemsService } from '../services/orderProblemsService';
import { OrderProblemNotification } from '../types/OrderProblem';

interface ProblemNotificationBadgeProps {
  employeeName: string;
  onNotificationClick?: () => void;
}

export const ProblemNotificationBadge: React.FC<ProblemNotificationBadgeProps> = ({
  employeeName,
  onNotificationClick,
}) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNewNotification, setHasNewNotification] = useState(false);

  useEffect(() => {
    loadUnreadCount();

    const unsubscribe = orderProblemsService.subscribeToNotifications(
      employeeName,
      (notification) => {
        console.log('New notification received:', notification);
        setUnreadCount(prev => prev + 1);
        setHasNewNotification(true);

        setTimeout(() => setHasNewNotification(false), 3000);

        if (notification.notification_type === 'new_problem' && notification.problem) {
          showBrowserNotification(
            'New Order Problem Reported',
            `Order #${notification.problem.order_number} - ${notification.problem.problem_reason}`
          );
        } else if (notification.notification_type === 'escalated' && notification.problem) {
          showBrowserNotification(
            'Order Problem Escalated',
            `Order #${notification.problem.order_number} needs urgent attention`
          );
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [employeeName]);

  const loadUnreadCount = async () => {
    try {
      const count = await orderProblemsService.getUnreadNotificationCount(employeeName);
      setUnreadCount(count);
    } catch (err) {
      console.error('Error loading unread count:', err);
    }
  };

  const showBrowserNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'order-problem',
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
            tag: 'order-problem',
          });
        }
      });
    }
  };

  const handleClick = async () => {
    if (onNotificationClick) {
      onNotificationClick();
    }

    await orderProblemsService.markAllNotificationsAsRead(employeeName);
    setUnreadCount(0);
  };

  if (unreadCount === 0) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      className={`relative p-2 rounded-lg transition-all ${
        hasNewNotification
          ? 'bg-red-100 animate-pulse'
          : 'bg-white hover:bg-gray-50'
      } border border-gray-200 shadow-sm`}
      title={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
    >
      <Bell className={`w-5 h-5 ${hasNewNotification ? 'text-red-600' : 'text-gray-600'}`} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] h-5 flex items-center justify-center font-medium">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};
