import { RefreshCw, Trash2 } from 'lucide-react';

interface OrderMergeDialogProps {
  isOpen: boolean;
  existingOrderCount: number;
  newOrderCount: number;
  onMerge: () => void;
  onReplace: () => void;
  onCancel: () => void;
}

export function OrderMergeDialog({
  isOpen,
  existingOrderCount,
  newOrderCount,
  onMerge,
  onReplace,
  onCancel,
}: OrderMergeDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Orders Already Loaded
        </h3>

        <p className="text-gray-600 mb-6">
          You currently have <span className="font-semibold">{existingOrderCount} orders</span> loaded.
          How would you like to handle the <span className="font-semibold">{newOrderCount} new orders</span>?
        </p>

        <div className="space-y-3">
          <button
            onClick={onMerge}
            className="w-full flex items-center gap-3 p-4 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-gray-900">Merge with Existing Orders</div>
              <div className="text-sm text-gray-600">
                Add new orders while keeping completed orders
              </div>
            </div>
          </button>

          <button
            onClick={onReplace}
            className="w-full flex items-center gap-3 p-4 border-2 border-red-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-all group"
          >
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-gray-900">Replace All Orders</div>
              <div className="text-sm text-gray-600">
                Clear existing orders and load only new ones
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={onCancel}
          className="w-full mt-4 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
