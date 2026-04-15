export interface StockTrackingItem {
  sku: string;
  markedDate: string;
  orderNumber: string;
  customerName: string;
  currentStock: number;
  location: string;
  imageUrl?: string;
  weight?: number;
  newLocation?: string;
  localImageSource?: {
    sku: string;
    folderName: string;
  };
  rowIndex?: number;
  orderValue?: number;
}

export interface LowStockItem {
  sku: string;
  orderNumber: string;
  markedDate: string;
  markedTime: string;
  location: string;
}