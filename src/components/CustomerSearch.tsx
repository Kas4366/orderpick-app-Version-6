import React, { useEffect, useState, useRef } from 'react';
import { Search, QrCode, ArrowUp, ArrowDown, Scan, Lock } from 'lucide-react';

interface CustomerSearchProps {
  onCustomerSearch: (customerName: string) => void;
  onArrowNavigation?: (direction: 'up' | 'down') => void;
  searchMessage?: string;
  onClearMessage?: () => void;
  isBlocked?: boolean;
}

export const CustomerSearch: React.FC<CustomerSearchProps> = ({
  onCustomerSearch,
  onArrowNavigation,
  searchMessage,
  onClearMessage,
  isBlocked = false,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [searchMode, setSearchMode] = useState<'manual' | 'scanner' | 'arrows'>('manual');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchMode === 'scanner' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [searchMode]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isBlocked) return;

      if (searchMode === 'arrows') {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          if (onArrowNavigation) {
            onArrowNavigation(e.key === 'ArrowUp' ? 'up' : 'down');
          }
          return;
        }
      }

      if (searchMode === 'scanner' && e.key === 'Enter') {
        e.preventDefault();
        const scannedData = inputRef.current?.value || '';
        if (scannedData.trim()) {
          console.log('📱 QR scan completed:', scannedData);
          if (onClearMessage) onClearMessage();
          processScannedData(scannedData);
          setTimeout(() => {
            if (inputRef.current) inputRef.current.select();
          }, 50);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [searchMode, onArrowNavigation, onCustomerSearch, onClearMessage, isBlocked]);

  const processScannedData = (scannedData: string) => {
    const extractedPostcode = extractPostcodeFromQRData(scannedData);
    if (extractedPostcode) {
      console.log('📮 Extracted postcode from QR scan:', extractedPostcode);
      onCustomerSearch(extractedPostcode);
    } else {
      console.log('🔍 No postcode found, searching with raw scanned data:', scannedData);
      onCustomerSearch(scannedData);
    }
  };

  const extractPostcodeFromQRData = (qrData: string): string => {
    const postcodeRegex = /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})\b/g;
    const matches = qrData.match(postcodeRegex) || [];
    const KNOWN_SENDER_POSTCODES = ['LU56RT', 'LU33RZ'];
    const validPostcodes = matches
      .map(match => match.replace(/\s/g, '').toUpperCase())
      .filter(postcode =>
        !KNOWN_SENDER_POSTCODES.some(sender =>
          postcode.startsWith(sender) || sender.startsWith(postcode.substring(0, 4))
        )
      );
    return validPostcodes[0] || '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) return;
    if (searchInput.trim()) onCustomerSearch(searchInput.trim());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isBlocked) return;
    const value = e.target.value;
    setSearchInput(value);
    if (onClearMessage && searchMessage) onClearMessage();
  };

  const handleModeChange = (newMode: 'manual' | 'scanner' | 'arrows') => {
    if (isBlocked) return;
    setSearchMode(newMode);
    setSearchInput('');
    if (onClearMessage) onClearMessage();
  };

  return (
    <div className="space-y-3">
      {isBlocked && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border-2 border-amber-400 rounded-lg">
          <div className="flex-shrink-0 h-8 w-8 bg-amber-500 rounded-full flex items-center justify-center">
            <Lock className="h-4 w-4 text-white" />
          </div>
          <p className="text-sm font-medium text-amber-900">
            Search and scanning are locked while viewing an old order. Click{' '}
            <strong>Return to Current Orders</strong> to scan or search again.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-700">Search Mode:</span>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => handleModeChange('manual')}
            disabled={isBlocked}
            className={`px-3 py-1 text-sm font-medium transition-colors flex items-center gap-1 ${
              searchMode === 'manual'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            } ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Search className="h-3 w-3" />
            Manual
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('scanner')}
            disabled={isBlocked}
            className={`px-3 py-1 text-sm font-medium transition-colors flex items-center gap-1 border-l border-gray-300 ${
              searchMode === 'scanner'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            } ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <QrCode className="h-3 w-3" />
            Scanner
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('arrows')}
            disabled={isBlocked}
            className={`px-3 py-1 text-sm font-medium transition-colors flex items-center gap-1 border-l border-gray-300 ${
              searchMode === 'arrows'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            } ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ArrowUp className="h-3 w-3" />
            <ArrowDown className="h-3 w-3" />
            Arrows
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            id="customer-search-input"
            value={searchInput}
            onChange={handleInputChange}
            placeholder={
              isBlocked
                ? 'Locked - return to current orders to search...'
                : searchMode === 'manual'
                ? 'Search by customer name, order ID, or postcode...'
                : searchMode === 'scanner'
                ? 'Scan QR code - data will appear here...'
                : 'Use arrow keys to navigate orders...'
            }
            className={`w-full px-4 py-2 pl-10 pr-12 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isBlocked
                ? 'border-amber-300 bg-amber-50 text-amber-700 cursor-not-allowed'
                : 'border-gray-300'
            }`}
            disabled={isBlocked || searchMode === 'arrows'}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />

          {isBlocked && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Lock className="h-5 w-5 text-amber-500" />
            </div>
          )}
          {!isBlocked && searchMode === 'scanner' && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Scan className="h-5 w-5 text-blue-600" />
            </div>
          )}
          {!isBlocked && searchMode === 'arrows' && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              <ArrowUp className="h-4 w-4 text-green-600" />
              <ArrowDown className="h-4 w-4 text-green-600" />
            </div>
          )}
        </div>
      </form>

      {searchMessage && (
        <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-800">{searchMessage}</p>
        </div>
      )}

      {!isBlocked && (
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
          {searchMode === 'manual' && (
            <p>Type customer name, order ID, or postcode to search</p>
          )}
          {searchMode === 'scanner' && (
            <div>
              <p className="font-medium text-green-700">🔍 Scanner Mode Active</p>
              <p>Scan QR codes - each scan will replace the previous data</p>
            </div>
          )}
          {searchMode === 'arrows' && (
            <p>Use ↑ and ↓ arrow keys to navigate through orders</p>
          )}
        </div>
      )}
    </div>
  );
};
