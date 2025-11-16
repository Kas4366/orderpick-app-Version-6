import { X, Package } from 'lucide-react';

interface NewOrdersNotificationPopupProps {
  isOpen: boolean;
  newOrderCount: number;
  onAddOrders: () => void;
  onDismiss: () => void;
}

export function NewOrdersNotificationPopup({
  isOpen,
  newOrderCount,
  onAddOrders,
  onDismiss,
}: NewOrdersNotificationPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 relative">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">New Orders Available</h3>
            <p className="text-sm text-gray-600">
              {newOrderCount} new {newOrderCount === 1 ? 'order' : 'orders'} found
            </p>
          </div>
        </div>

        <p className="text-gray-700 mb-6">
          Would you like to add these new orders to your current list?
        </p>

        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={onAddOrders}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Add New Orders
          </button>
        </div>
      </div>
    </div>
  );
}
