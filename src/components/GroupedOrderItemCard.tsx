import React, { useEffect, useState } from 'react';
import { Box, Package, CheckCircle, AlertTriangle, DollarSign, Image as ImageIcon } from 'lucide-react';
import { Order } from '../types/Order';
import { StockTrackingItem, LowStockItem } from '../types/StockTracking';
import { findCustomDesignImages, CustomDesignFile } from '../utils/imageUtils';

interface GroupedOrderItemCardProps {
  item: Order;
  index: number;
  customDesignFolderHandle?: FileSystemDirectoryHandle | null;
  stockTrackingItems: StockTrackingItem[];
  lowStockItems: LowStockItem[];
  onMarkForReorder: (order: Order) => void;
  onUnmarkForReorder: (sku: string, markedDate: string, orderNumber: string) => void;
  onMarkLowStock: (order: Order) => void;
  onUnmarkLowStock: (sku: string, markedDate: string, orderNumber: string) => void;
  onPreviewImageBySku?: (sku: string) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

export const GroupedOrderItemCard: React.FC<GroupedOrderItemCardProps> = ({
  item,
  index,
  customDesignFolderHandle = null,
  stockTrackingItems,
  lowStockItems,
  onMarkForReorder,
  onUnmarkForReorder,
  onMarkLowStock,
  onUnmarkLowStock,
  onPreviewImageBySku,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [customDesigns, setCustomDesigns] = useState<CustomDesignFile[]>([]);
  const [customDesignLoading, setCustomDesignLoading] = useState(false);

  useEffect(() => {
    setImageError(false);
    setImageLoading(true);
    setCustomDesigns([]);
  }, [item]);

  useEffect(() => {
    const lookupDesigns = async () => {
      if (!customDesignFolderHandle || !item.veeqoOrderId) {
        setCustomDesigns([]);
        return;
      }
      setCustomDesignLoading(true);
      try {
        const images = await findCustomDesignImages(
          customDesignFolderHandle,
          item.veeqoOrderId,
          index + 1,
          item.quantity
        );
        setCustomDesigns(images);
      } catch {
        setCustomDesigns([]);
      } finally {
        setCustomDesignLoading(false);
      }
    };
    lookupDesigns();
  }, [item, customDesignFolderHandle, index]);

  const trackedItem = stockTrackingItems.find(
    t => t.sku === item.sku && t.orderNumber === item.orderNumber
  );
  const lowStockItem = lowStockItems.find(
    ls => ls.sku === item.sku && ls.orderNumber === item.orderNumber
  );

  const handleImageLoad = () => setImageLoading(false);
  const handleImageError = () => { setImageLoading(false); setImageError(true); };

  const getStockStatus = () => {
    if (item.remainingStock === undefined) return null;
    if (item.remainingStock < item.quantity)
      return { color: 'text-red-600', message: 'Insufficient stock!', bgColor: 'bg-red-50' };
    if (item.remainingStock <= 5)
      return { color: 'text-orange-600', message: 'Low stock', bgColor: 'bg-orange-50' };
    if (item.remainingStock <= 10)
      return { color: 'text-yellow-600', message: 'Medium stock', bgColor: 'bg-yellow-50' };
    return { color: 'text-green-600', message: 'Good stock', bgColor: 'bg-green-50' };
  };
  const stockStatus = getStockStatus();

  const handleReorderToggle = () => {
    if (trackedItem) {
      onUnmarkForReorder(trackedItem.sku, trackedItem.markedDate, trackedItem.orderNumber);
    } else {
      onMarkForReorder(item);
    }
  };

  const handleLowStockToggle = () => {
    if (lowStockItem) {
      onUnmarkLowStock(lowStockItem.sku, lowStockItem.markedDate, lowStockItem.orderNumber);
    } else {
      onMarkLowStock(item);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Image section */}
        <div className="md:col-span-1">
          {customDesigns.length > 0 ? (
            <div className="space-y-2">
              {/* Custom Design Images */}
              <div className="bg-emerald-50 rounded-lg overflow-hidden relative border-2 border-emerald-300" style={{ minHeight: '200px' }}>
                <div className="absolute top-1 left-1 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded z-10">
                  Custom Design
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 p-2">
                  {customDesigns.map((designFile, idx) => (
                    designFile.isPdf ? (
                      <div key={idx} className="flex flex-col items-center gap-1">
                        <embed
                          src={designFile.url}
                          type="application/pdf"
                          className="max-w-full max-h-[180px] rounded border border-emerald-200"
                          style={{ width: '200px', minHeight: '150px' }}
                        />
                        <a
                          href={designFile.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-700 hover:text-emerald-900 underline"
                        >
                          Open PDF
                        </a>
                      </div>
                    ) : (
                      <img
                        key={idx}
                        src={designFile.url}
                        alt={`Custom design ${idx + 1} for ${item.sku}`}
                        className="max-w-full max-h-[180px] object-contain"
                      />
                    )
                  ))}
                </div>
              </div>
              {/* Original SKU Image */}
              <div className="bg-gray-100 rounded-lg overflow-hidden relative flex items-center justify-center border border-gray-300" style={{ height: '100px' }}>
                <div className="absolute top-1 left-1 bg-gray-700 text-white text-xs font-bold px-1 py-0.5 rounded z-10">
                  Original
                </div>
                {item.imageUrl && !imageError ? (
                  <img
                    src={item.imageUrl}
                    alt={`Product image for ${item.sku}`}
                    className="w-full h-full object-contain"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400 p-2">
                    <Box className="h-8 w-8 mb-1" />
                    <p className="text-xs text-center">SKU: {item.sku}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full bg-gray-100 rounded-lg overflow-hidden relative flex items-center justify-center" style={{ height: '250px' }}>
              {customDesignLoading && (
                <div className="absolute top-1 right-1 flex items-center gap-1 text-xs text-gray-500 bg-white bg-opacity-80 px-2 py-1 rounded z-10">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-600"></div>
                  <span>Searching...</span>
                </div>
              )}
              {item.imageUrl && !imageError ? (
                <>
                  {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  <img
                    src={item.imageUrl}
                    alt={`Product image for ${item.sku}`}
                    className={`w-full h-full object-contain transition-opacity duration-300 ${
                      imageLoading ? 'opacity-0' : 'opacity-100'
                    }`}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 p-4">
                  <Box className="h-16 w-16 mb-2" />
                  <p className="text-sm text-center font-medium">
                    Image not available in folder
                  </p>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    SKU: {item.sku}
                  </p>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Save image as "{item.sku}.jpg" in images folder
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Item Details */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-5 w-5 text-blue-600" />
              <h4 className="text-sm font-medium text-blue-800">Item {index + 1} Details</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h5 className="text-xs font-medium text-blue-700 mb-1">SKU</h5>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-blue-900">{item.sku}</p>
                  {onPreviewImageBySku && (
                    <button
                      onClick={() => onPreviewImageBySku(item.sku)}
                      className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                      title={`Preview image for ${item.sku}`}
                    >
                      <ImageIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h5 className="text-xs font-medium text-blue-700 mb-1">Quantity</h5>
                <p className={`text-4xl font-black text-red-600 ${item.quantity > 1 ? 'animate-pulse' : ''}`}>
                  {item.quantity}
                </p>
              </div>

              <div>
                <h5 className="text-xs font-medium text-blue-700 mb-1">Location</h5>
                <div className="inline-block bg-green-200 text-green-900 px-3 py-1 rounded-lg text-lg font-bold">
                  {item.location}
                </div>
              </div>
            </div>

            {/* Order Value */}
            {item.orderValue !== undefined && (
              <div className="mt-4">
                <h5 className="text-xs font-medium text-blue-700 mb-1">Order Value</h5>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <p className="text-lg font-bold text-green-900">
                    {formatCurrency(item.orderValue)}
                  </p>
                </div>
              </div>
            )}

            {/* Stock Information */}
            {item.remainingStock !== undefined && (
              <div className="mt-4">
                <h5 className="text-xs font-medium text-blue-700 mb-1">Stock Info</h5>
                <div className="space-y-1">
                  <p className="text-sm text-blue-900">
                    <span className="font-medium">Available:</span> {item.remainingStock}
                  </p>
                  {stockStatus && (
                    <div className={`p-2 rounded ${stockStatus.bgColor}`}>
                      <p className={`text-xs font-medium ${stockStatus.color}`}>
                        {stockStatus.message}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {item.itemName && (
              <div className="mt-4">
                <h5 className="text-xs font-medium text-blue-700 mb-1">Product Details</h5>
                <p className="text-sm text-blue-900">{item.itemName}</p>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!trackedItem}
                    onChange={handleReorderToggle}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                  />
                  <label
                    className="text-sm font-medium text-gray-800 cursor-pointer"
                    onClick={handleReorderToggle}
                  >
                    {trackedItem ? 'Marked for reorder ✓' : 'Mark for reorder'}
                  </label>
                </div>
                {trackedItem && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>Added to reorder list</span>
                  </div>
                )}
              </div>

              <div
                className={`border-2 rounded-lg p-3 transition-colors ${
                  lowStockItem
                    ? 'bg-red-50 border-red-500'
                    : 'bg-red-50 border-red-300 hover:border-red-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!lowStockItem}
                    onChange={handleLowStockToggle}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-red-400 rounded cursor-pointer accent-red-600"
                  />
                  <label
                    className="text-sm font-semibold text-red-700 cursor-pointer"
                    onClick={handleLowStockToggle}
                  >
                    {lowStockItem ? 'Marked as low in stock ✓' : 'Low in stock'}
                  </label>
                </div>
                {lowStockItem && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{lowStockItem.markedDate} at {lowStockItem.markedTime}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
