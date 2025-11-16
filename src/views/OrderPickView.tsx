import React, { useState } from 'react';
import { ImagePreviewModal } from '../components/ImagePreviewModal';
import { PackingInstructionModal } from '../components/PackingInstructionModal';
import { OrderMergeDialog } from '../components/OrderMergeDialog';
import { NewOrdersNotificationPopup } from '../components/NewOrdersNotificationPopup';
import { FileUploadArea } from '../components/FileUploadArea';
import { OrderDisplay } from '../components/OrderDisplay';
import { NoOrdersState } from '../components/NoOrdersState';
import { OrderSidebar, FilterState } from '../components/OrderSidebar';
import { CustomerSearch } from '../components/CustomerSearch';
import { SettingsModal } from '../components/SettingsModal';
import { EmployeeLogin } from '../components/EmployeeLogin';
import { useOrderData } from '../hooks/useOrderData';
import { useEmployee } from '../contexts/EmployeeContext';
import { Settings as SettingsIcon, User, LogOut } from 'lucide-react';
import { FileWithImages } from '../types/Settings';

const defaultFilters: FilterState = {
  showCompleted: true,
  showIncomplete: true,
  showMultipleItems: true,
  showMergedOrders: true,
  showSingleItems: true,
  showWithProblems: true,
  showProblemsPending: true,
  showProblemsInProgress: true,
  showProblemsEscalated: true,
  showProblemsResolved: true,
  showWithoutProblems: true,
};

interface OrderPickViewProps {
  savedOrderPickState?: {
    currentOrderIndex: number;
    orders: any[];
    filters?: FilterState;
  } | null;
  onNavigateToOrderProblems?: (orderPickState: { currentOrderIndex: number; orders: any[]; filters: FilterState }) => void;
}

export const OrderPickView: React.FC<OrderPickViewProps> = ({ savedOrderPickState, onNavigateToOrderProblems }) => {
  const { currentSession, logout } = useEmployee();
  const { 
    pdfUploaded,
    setPdfUploaded,
    orders,
    setOrders,
    currentOrder,
    setCurrentOrder,
    currentOrderIndex,
    handleFileUpload,
    handleCsvFileUpload,
    saveCsvMappings,
    csvColumnMappings,
    saveVoiceSettings,
    voiceSettings,
    stockTrackingItems,
    handleMarkForReorder,
    removeStockTrackingItem,
    clearAllStockTrackingItems,
    handleCustomerSearch,
    handleQRCodeScan,
    handleArrowNavigation,
    handleOrderComplete,
    // Other settings
    autoCompleteEnabled,
    saveOtherSettings,
    updateStockTrackingItem,
    // Image preview functionality
    imagePreviewModal,
    handlePreviewImageBySku,
    closeImagePreviewModal,
    // Packing instruction functionality
    packingInstruction,
    isPackingInstructionModalOpen,
    handlePackingInstructionComplete,
    packingInstructionQueue,
    currentQueueIndex,
    searchMessage,
    setSearchMessage,
    // Google Sheets order loading
    loadOrdersFromGoogleSheets,
    isMergeDialogOpen,
    pendingOrders,
    handleMergeOrders,
    handleReplaceOrders,
    handleCancelMerge,
    isNewOrdersPopupOpen,
    newOrdersCount,
    handleAddNewOrders,
    handleDismissNewOrders,
    // CSV Images Folder
    csvImagesFolderInfo,
    setCsvImagesFolder,
    csvImagesFolderHandle,
    // Archive
    handleLoadArchivedOrder,
    isArchiveInitialized,
    // Packaging rules
    packagingRules,
    savePackagingRules,
    customPackagingTypes,
    saveCustomPackagingTypes,
    boxRules,
    saveBoxRules,
    customBoxNames,
    saveCustomBoxNames,
    currentOrderPackagingType,
    currentOrderBoxName,
    currentOrderBoxColor,
  } = useOrderData();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [availableFiles, setAvailableFiles] = useState<FileWithImages[]>([]);
  const [filters, setFilters] = useState<FilterState>(savedOrderPickState?.filters || defaultFilters);

  // Restore state when returning from Order Problems View
  React.useEffect(() => {
    if (savedOrderPickState && savedOrderPickState.orders && savedOrderPickState.orders.length > 0) {
      console.log('🔄 Restoring order pick state:', {
        ordersCount: savedOrderPickState.orders.length,
        currentOrderIndex: savedOrderPickState.currentOrderIndex,
        hasFilters: !!savedOrderPickState.filters
      });

      setOrders(savedOrderPickState.orders);

      if (savedOrderPickState.currentOrderIndex >= 0 && savedOrderPickState.currentOrderIndex < savedOrderPickState.orders.length) {
        setCurrentOrder(savedOrderPickState.orders[savedOrderPickState.currentOrderIndex]);
      }

      if (savedOrderPickState.filters) {
        setFilters(savedOrderPickState.filters);
      }

      console.log('✅ State restoration complete');
    }
  }, [savedOrderPickState]);

  const handleFolderSelect = (path: string) => {
    setSelectedFolder(path);
    console.log('Folder selected:', path);
  };

  const handleFileSelect = async (file: FileWithImages) => {
    try {
      console.log('Processing selected file:', file.name, 'with images folder:', file.imagesFolderHandle?.name);
      await handleFileUpload(file);
      setIsSettingsOpen(false);
      // Reset filters to show all orders when new file is uploaded
      setFilters(defaultFilters);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing the selected file');
    }
  };

  const handleCsvUpload = async (file: File, mappings: any) => {
    try {
      console.log('Processing CSV file:', file.name);
      await handleCsvFileUpload(file, mappings);
      setIsSettingsOpen(false);
      // Reset filters to show all orders when new CSV is uploaded
      setFilters(defaultFilters);
    } catch (error) {
      console.error('Error processing CSV file:', error);
      alert('Error processing the CSV file');
    }
  };


  const handleNewUpload = () => {
    setPdfUploaded(false);
    setOrders([]);
    setCurrentOrder(null);
    // Reset filters to show all orders
    setFilters(defaultFilters);
  };

  const handleLogout = () => {
    logout();
    setPdfUploaded(false);
    setOrders([]);
    setCurrentOrder(null);
  };

  if (!currentSession) {
    return <EmployeeLogin onLoginSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-2 shadow-sm">
          <User className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-900">{currentSession.employee.name}</span>
          <button
            onClick={handleLogout}
            className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative bg-white border border-gray-200 shadow-sm"
          title="Settings"
        >
          <SettingsIcon className="h-5 w-5 text-gray-600" />
          {stockTrackingItems.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] h-5 flex items-center justify-center">
              {stockTrackingItems.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 py-2">
        <div className="flex w-full max-w-[1600px] mx-auto px-4 py-2 gap-6">
          <OrderSidebar
            orders={orders}
            currentOrder={currentOrder}
            currentOrderIndex={currentOrderIndex}
            onOrderSelect={setCurrentOrder}
            onFilterChange={setFilters}
            initialFilters={filters}
          />
          
          <div className="flex-1">
            <div className="mb-4">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Order Picking Assistant</h2>
                  <div className="flex items-center gap-4 text-gray-600">
                    <span>
                      {orders.length} orders loaded • {orders.filter(order => order.completed).length} completed
                    </span>
                    {currentOrderIndex >= 0 && (
                      <span className="text-blue-600">
                        Order {currentOrderIndex + 1} of {orders.length}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={handleNewUpload}
                    className="px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition-colors"
                  >
                    Upload New File
                  </button>
                </div>
              </div>
              
              <div className="mt-3">
                <CustomerSearch
                  onCustomerSearch={(searchTerm) => handleCustomerSearch(searchTerm, currentSession?.employee.name)}
                  onQRCodeScan={(qrData) => handleQRCodeScan(qrData, currentSession?.employee.name)}
                  onArrowNavigation={handleArrowNavigation}
                  searchMessage={searchMessage}
                  onClearMessage={() => setSearchMessage('')}
                />
              </div>
            </div>
            
            {currentOrder ? (
              <OrderDisplay
                order={currentOrder}
                orders={orders}
                currentOrderIndex={currentOrderIndex}
                onOrderComplete={(order) => handleOrderComplete(order, currentSession?.employee.name)}
                voiceSettings={voiceSettings}
                onMarkForReorder={handleMarkForReorder}
                stockTrackingItems={stockTrackingItems}
                onUnmarkForReorder={removeStockTrackingItem}
                autoCompleteEnabled={autoCompleteEnabled}
                packagingType={currentOrderPackagingType}
               currentOrderBoxName={currentOrderBoxName}
                currentOrderBoxColor={currentOrderBoxColor}
                onPreviewImageBySku={handlePreviewImageBySku}
                onNavigateToOrderProblems={onNavigateToOrderProblems ? () => onNavigateToOrderProblems({ currentOrderIndex, orders, filters }) : undefined}
              />
            ) : (
              <NoOrdersState 
                onFileUpload={handleFileUpload}
                onOpenSettings={() => setIsSettingsOpen(true)}
                isArchiveInitialized={isArchiveInitialized}
              />
            )}
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentFolder={selectedFolder}
        onFolderSelect={handleFolderSelect}
        availableFiles={availableFiles}
        onFileSelect={handleFileSelect}
        onCsvUpload={handleCsvFileUpload}
        onSaveCsvMappings={saveCsvMappings}
        savedCsvMappings={csvColumnMappings}
        onSaveVoiceSettings={saveVoiceSettings}
        savedVoiceSettings={voiceSettings}
        stockTrackingItems={stockTrackingItems}
        onRemoveStockItem={removeStockTrackingItem}
        onClearAllStockItems={clearAllStockTrackingItems}
        onUpdateStockItem={updateStockTrackingItem}
        csvImagesFolderHandle={csvImagesFolderHandle}
        csvImagesFolderInfo={csvImagesFolderInfo}
        onSetCsvImagesFolder={setCsvImagesFolder}
        onLoadArchivedOrder={handleLoadArchivedOrder}
        packagingRules={packagingRules}
        onSavePackagingRules={savePackagingRules}
        customPackagingTypes={customPackagingTypes}
        onSaveCustomPackagingTypes={saveCustomPackagingTypes}
        boxRules={boxRules}
        onSaveBoxRules={saveBoxRules}
        customBoxNames={customBoxNames}
        onSaveBoxNames={saveCustomBoxNames}
        autoCompleteEnabled={autoCompleteEnabled}
        onSaveOtherSettings={saveOtherSettings}
        onLoadOrdersFromGoogleSheets={loadOrdersFromGoogleSheets}
      />

      <ImagePreviewModal
        isOpen={imagePreviewModal.isOpen}
        onClose={closeImagePreviewModal}
        imageUrl={imagePreviewModal.imageUrl}
        sku={imagePreviewModal.sku}
        message={imagePreviewModal.message}
        isLoading={imagePreviewModal.isLoading}
      />

      <PackingInstructionModal
        isOpen={isPackingInstructionModalOpen}
        instruction={packingInstruction}
        orderNote={packingInstructionQueue[currentQueueIndex]?.note || ''}
        onComplete={handlePackingInstructionComplete}
        currentSku={packingInstructionQueue[currentQueueIndex]?.sku}
        currentOrderNumber={packingInstructionQueue[currentQueueIndex]?.orderNumber}
        currentIndex={currentQueueIndex}
        totalItems={packingInstructionQueue.length}
      />

      <OrderMergeDialog
        isOpen={isMergeDialogOpen}
        existingOrderCount={orders.length}
        newOrderCount={pendingOrders.length}
        onMerge={handleMergeOrders}
        onReplace={handleReplaceOrders}
        onCancel={handleCancelMerge}
      />

      <NewOrdersNotificationPopup
        isOpen={isNewOrdersPopupOpen}
        newOrderCount={newOrdersCount}
        onAddOrders={handleAddNewOrders}
        onDismiss={handleDismissNewOrders}
      />
    </div>
  );
};