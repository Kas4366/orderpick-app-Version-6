import { ProblemStatus } from './OrderProblem';

export interface Order {
  orderNumber: string;
  customerName: string;
  sku: string;
  quantity: number;
  location: string;
  imageUrl?: string;
  itemName?: string;
  completed?: boolean;
  // Buyer postcode for QR code matching
  buyerPostcode?: string;
  // Stock information
  remainingStock?: number;
  // File date tracking
  fileDate?: string;
  // Order value
  orderValue?: number;
  // Channel information
  channelType?: string;
  channel?: string;
  // Packaging information
  shipFromLocation?: string;
  packageDimension?: string;
  // Local image metadata
  _isLocalImage?: boolean;
  _originalSkuForLocalImage?: string;
  _sourceFileName?: string;
  // Order notes
  notes?: string;
  // Google Sheets row index for updating packer info
  rowIndex?: number;
  // Selro API IDs
  selroOrderId?: string;
  selroItemId?: string;
  // Veeqo API IDs
  veeqoOrderId?: number;
  veeqoItemId?: number;
  // Packaging metadata
  width?: number;
  weight?: number;
  packagingType?: string;
  // Problem tracking
  problemStatus?: ProblemStatus | null;
  problemId?: string;
  problemReportedAt?: string;
}