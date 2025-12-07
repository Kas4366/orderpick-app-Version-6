import React from 'react';
import { ArrowLeft, Calendar, Package } from 'lucide-react';

interface OldOrderBannerProps {
  orderDate: string | null;
  orderNumber: string;
  itemCount: number;
  onReturnToCurrent: () => void;
}

export const OldOrderBanner: React.FC<OldOrderBannerProps> = ({
  orderDate,
  orderNumber,
  itemCount,
  onReturnToCurrent,
}) => {
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Unknown date';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (error) {
      return 'Unknown date';
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 rounded-lg p-4 mb-4 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-amber-900">Old Order from {formatDate(orderDate)}</h3>
            </div>
            <div className="flex items-center gap-4 text-sm text-amber-800">
              <div className="flex items-center gap-1">
                <Package className="h-4 w-4" />
                <span className="font-medium">Order #{orderNumber}</span>
              </div>
              <span className="text-amber-600">•</span>
              <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onReturnToCurrent}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Current Orders
        </button>
      </div>
      <div className="mt-3 text-sm text-amber-700 bg-amber-100 rounded p-2">
        <strong>Note:</strong> You are viewing an old order. Click 'Return to Current Orders' when ready to go back to today's orders.
      </div>
    </div>
  );
};
