import { useState, useEffect, useCallback } from 'react';
import { Order } from '../types/Order';
import { ArchivedOrder } from '../types/Archive';
import { simulatePdfParsing } from '../utils/pdfUtils';
import { FileWithImages } from '../types/Settings';
import { archiveService } from '../services/archiveService';
import { CsvColumnMapping, defaultCsvColumnMapping, LocalImagesFolderInfo } from '../types/Csv';
import { VoiceSettings, defaultVoiceSettings } from '../types/VoiceSettings';
import { StockTrackingItem } from '../types/StockTracking';
import { CustomTag } from '../types/CustomTags';
import { PackagingRule, defaultPackagingRules, defaultPackagingTypes, defaultBoxRules, defaultBoxNames } from '../types/Packaging';
import { evaluatePackagingRules } from '../utils/packagingRules';
import { parseCsvFile } from '../utils/csvUtils';
import { fileHandlePersistenceService } from '../services/fileHandlePersistenceService';
import { findImageFile } from '../utils/imageUtils';
import { packingInstructionService } from '../services/packingInstructionService';
import { PackingInstruction } from '../types/PackingInstructions';
import { googleSheetsService } from '../services/googleSheetsService';
import { webhookService } from '../services/webhookService';
import { orderProblemsService } from '../services/orderProblemsService';

export const useOrderData = () => {
  const [pdfUploaded, setPdfUploaded] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [selectedSelroFolderId, setSelectedSelroFolderId] = useState<string>('');
  const [selectedSelroFolderName, setSelectedSelroFolderName] = useState<string>('');
  const [selectedVeeqoStatus, setSelectedVeeqoStatus] = useState<string>('');
  const [selectedVeeqoWarehouseId, setSelectedVeeqoWarehouseId] = useState<number | undefined>(undefined);
  const [isUsingSelroApi, setIsUsingSelroApi] = useState(false);
  const [isUsingVeeqoApi, setIsUsingVeeqoApi] = useState(false);
  const [currentOrderIndex, setCurrentOrderIndex] = useState<number>(-1);
  const [csvColumnMappings, setCsvColumnMappings] = useState<CsvColumnMapping>(defaultCsvColumnMapping);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(defaultVoiceSettings);
  const [stockTrackingItems, setStockTrackingItems] = useState<StockTrackingItem[]>([]);
  
  // Custom tags state
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [selectedSelroTag, setSelectedSelroTag] = useState<string>('all');
  const [selectedVeeqoTag, setSelectedVeeqoTag] = useState<string>('all');
  
  // Packaging rules state
  const [packagingRules, setPackagingRules] = useState<PackagingRule[]>(defaultPackagingRules);
  const [customPackagingTypes, setCustomPackagingTypes] = useState<string[]>(defaultPackagingTypes);
  const [currentOrderPackagingType, setCurrentOrderPackagingType] = useState<string | null>(null);
  const [boxRules, setBoxRules] = useState<PackagingRule[]>(defaultBoxRules);
  const [customBoxNames, setCustomBoxNames] = useState<string[]>(defaultBoxNames);
  const [currentOrderBoxName, setCurrentOrderBoxName] = useState<string | null>(null);
  const [currentOrderBoxColor, setCurrentOrderBoxColor] = useState<string | null>(null);

  // Packing instruction state
  const [packingInstruction, setPackingInstruction] = useState<PackingInstruction | null>(null);
  const [isPackingInstructionModalOpen, setIsPackingInstructionModalOpen] = useState(false);

  // Queue for sequential packing instruction display
  interface PackingInstructionQueueItem {
    sku: string;
    orderNumber: string;
    instruction: PackingInstruction | null;
    note: string;
  }
  const [packingInstructionQueue, setPackingInstructionQueue] = useState<PackingInstructionQueueItem[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);

  // Local images folder state
  const [csvImagesFolderHandle, setCsvImagesFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [csvImagesFolderInfo, setCsvImagesFolderInfo] = useState<LocalImagesFolderInfo | null>(null);

  // Archive state
  const [isArchiveInitialized, setIsArchiveInitialized] = useState(false);

  // Other settings state
  const [autoCompleteEnabled, setAutoCompleteEnabled] = useState(false);
  const [lastScannedData, setLastScannedData] = useState<string>('');
  const [searchMessage, setSearchMessage] = useState<string>('');

  // Image preview modal state
  const [imagePreviewModal, setImagePreviewModal] = useState({
    isOpen: false,
    imageUrl: '',
    sku: '',
    message: '',
    isLoading: false
  });

  // Google Sheets order loading state
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [isNewOrdersPopupOpen, setIsNewOrdersPopupOpen] = useState(false);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [autoRefreshTimerId, setAutoRefreshTimerId] = useState<NodeJS.Timeout | null>(null);

  // Function to restore CSV images folder handle from persistence
  const restoreCsvImagesFolderHandle = async () => {
    try {
      console.log('🔄 useOrderData: Attempting to restore CSV images folder handle...');
      
      const savedHandle = await fileHandlePersistenceService.getHandle('csvImagesFolder');
      
      if (savedHandle) {
        console.log(`🔍 useOrderData: Found saved handle for folder: ${savedHandle.name}`);
        
        // Validate and request permission
        const hasPermission = await fileHandlePersistenceService.validateAndRequestPermission(savedHandle);
        
        console.log(`🔐 useOrderData: Permission validation result: ${hasPermission}`);
        
        if (hasPermission) {
          setCsvImagesFolderHandle(savedHandle);
          console.log(`✅ useOrderData: Successfully restored access to images folder: ${savedHandle.name}`);
        } else {
          console.log('❌ useOrderData: Permission denied for saved folder handle');
          setCsvImagesFolderHandle(null);
        }
      } else {
        console.log('⚠️ useOrderData: No saved folder handle found in IndexedDB');
        setCsvImagesFolderHandle(null);
      }
    } catch (error) {
      console.error('❌ useOrderData: Error restoring CSV images folder handle:', error);
      setCsvImagesFolderHandle(null);
    }
  };

  // Initialize archive system on component mount
  useEffect(() => {
    const initializeArchive = async () => {
      try {
        await archiveService.init();
        await archiveService.initAutoCleanup(); // Run auto-cleanup check
        setIsArchiveInitialized(true);
        console.log('✅ Archive system initialized');
        
        // Initialize file handle persistence service
        await fileHandlePersistenceService.init();
        console.log('✅ File handle persistence service initialized');
        
        // Always try to restore CSV images folder handle from IndexedDB
        console.log('🔄 useOrderData: Attempting to restore CSV images folder handle unconditionally...');
        await restoreCsvImagesFolderHandle();
      } catch (error) {
        console.error('❌ Failed to initialize archive system:', error);
      }
    };

    initializeArchive();
  }, []); // Load saved settings on component mount
  useEffect(() => {
    const savedSelroFolderId = localStorage.getItem('selectedSelroFolderId');
    const savedSelroFolderName = localStorage.getItem('selectedSelroFolderName');
    const savedVeeqoStatus = localStorage.getItem('selectedVeeqoStatus');
    const savedVeeqoWarehouseId = localStorage.getItem('selectedVeeqoWarehouseId');
    
    if (savedSelroFolderId && savedSelroFolderName) {
      setSelectedSelroFolderId(savedSelroFolderId);
      setSelectedSelroFolderName(savedSelroFolderName);
    }

    if (savedVeeqoStatus) {
      setSelectedVeeqoStatus(savedVeeqoStatus);
    }

    if (savedVeeqoWarehouseId && savedVeeqoWarehouseId !== 'undefined') {
      setSelectedVeeqoWarehouseId(parseInt(savedVeeqoWarehouseId, 10));
    }

    // Load saved CSV mappings
    const savedCsvMappings = localStorage.getItem('csvColumnMappings');
    if (savedCsvMappings) {
      try {
        const parsedMappings = JSON.parse(savedCsvMappings);
        console.log('📋 Loaded saved CSV mappings from localStorage:', parsedMappings);
        setCsvColumnMappings(parsedMappings);
      } catch (e) {
        console.error('Failed to parse saved CSV mappings, using default:', e);
        setCsvColumnMappings(defaultCsvColumnMapping);
      }
    } else {
      console.log('📋 No saved CSV mappings found, using default');
      setCsvColumnMappings(defaultCsvColumnMapping);
    }

    // Load saved voice settings
    const savedVoiceSettings = localStorage.getItem('voiceSettings');
    if (savedVoiceSettings) {
      try {
        const parsedVoiceSettings = JSON.parse(savedVoiceSettings);
        console.log('🔊 Loaded saved voice settings from localStorage:', parsedVoiceSettings);
        setVoiceSettings(parsedVoiceSettings);
      } catch (e) {
        console.error('Failed to parse saved voice settings, using default:', e);
        setVoiceSettings(defaultVoiceSettings);
      }
    } else {
      console.log('🔊 No saved voice settings found, using default');
      setVoiceSettings(defaultVoiceSettings);
    }

    // Load saved stock tracking items
    const savedStockItems = localStorage.getItem('stockTrackingItems');
    if (savedStockItems) {
      try {
        const parsedStockItems = JSON.parse(savedStockItems);
        console.log('📦 Loaded saved stock tracking items from localStorage:', parsedStockItems);
        setStockTrackingItems(parsedStockItems);
      } catch (e) {
        console.error('Failed to parse saved stock tracking items, using empty array:', e);
        setStockTrackingItems([]);
      }
    }

    // Load saved custom tags
    const savedCustomTags = localStorage.getItem('customTags');
    if (savedCustomTags) {
      try {
        const parsedCustomTags = JSON.parse(savedCustomTags);
        console.log('🏷️ Loaded saved custom tags from localStorage:', parsedCustomTags);
        setCustomTags(parsedCustomTags);
      } catch (e) {
        console.error('Failed to parse saved custom tags, using default:', e);
        setCustomTags([]);
      }
    }

    // Load saved tag selections
    const savedSelroTag = localStorage.getItem('selectedSelroTag');
    const savedVeeqoTag = localStorage.getItem('selectedVeeqoTag');
    
    if (savedSelroTag) {
      setSelectedSelroTag(savedSelroTag);
    }
    
    if (savedVeeqoTag) {
      setSelectedVeeqoTag(savedVeeqoTag);
    }
    
    // Load saved packaging rules
    const savedPackagingRules = localStorage.getItem('packagingRules');
    if (savedPackagingRules) {
      try {
        const parsedPackagingRules = JSON.parse(savedPackagingRules);
        console.log('📦 Loaded saved packaging rules from localStorage:', parsedPackagingRules);
        setPackagingRules(parsedPackagingRules);
      } catch (e) {
        console.error('Failed to parse saved packaging rules, using default:', e);
        setPackagingRules(defaultPackagingRules);
      }
    }

    // Load saved custom packaging types
    const savedPackagingTypes = localStorage.getItem('customPackagingTypes');
    if (savedPackagingTypes) {
      try {
        const parsedPackagingTypes = JSON.parse(savedPackagingTypes);
        console.log('📦 Loaded saved packaging types from localStorage:', parsedPackagingTypes);
        setCustomPackagingTypes(parsedPackagingTypes);
      } catch (e) {
        console.error('Failed to parse saved packaging types, using default:', e);
        setCustomPackagingTypes(defaultPackagingTypes);
      }
    }

    // Load saved box rules
    const savedBoxRules = localStorage.getItem('boxRules');
    if (savedBoxRules) {
      try {
        const parsedBoxRules = JSON.parse(savedBoxRules);
        console.log('📦 Loaded saved box rules from localStorage:', parsedBoxRules);
        setBoxRules(parsedBoxRules);
      } catch (e) {
        console.error('Failed to parse saved box rules, using default:', e);
        setBoxRules(defaultBoxRules);
      }
    }

    // Load saved custom box names
    const savedBoxNames = localStorage.getItem('customBoxNames');
    if (savedBoxNames) {
      try {
        const parsedBoxNames = JSON.parse(savedBoxNames);
        console.log('📦 Loaded saved box names from localStorage:', parsedBoxNames);
        setCustomBoxNames(parsedBoxNames);
      } catch (e) {
        console.error('Failed to parse saved box names, using default:', e);
        setCustomBoxNames(defaultBoxNames);
      }
    }
    // Load other settings
    const savedAutoComplete = localStorage.getItem('autoCompleteEnabled');
    if (savedAutoComplete) {
      setAutoCompleteEnabled(JSON.parse(savedAutoComplete));
    }

    // Load saved CSV images folder info
    const savedCsvImagesFolderInfo = localStorage.getItem('csvImagesFolderInfo');
    
    if (savedCsvImagesFolderInfo) {
      try {
        const parsedCsvImagesFolderInfo = JSON.parse(savedCsvImagesFolderInfo);
        console.log('🖼️ Loaded saved CSV images folder info from localStorage:', parsedCsvImagesFolderInfo);
        setCsvImagesFolderInfo(parsedCsvImagesFolderInfo);
      } catch (e) {
        console.error('Failed to parse saved CSV images folder info, using null:', e);
        setCsvImagesFolderInfo(null);
      }
    }

  }, []);

  // Update current order index when current order changes
  useEffect(() => {
    if (currentOrder && orders.length > 0) {
      const index = orders.findIndex(order => 
        order.orderNumber === currentOrder.orderNumber && order.sku === currentOrder.sku
      );
      setCurrentOrderIndex(index);
    } else {
      setCurrentOrderIndex(-1);
    }
  }, [currentOrder, orders]);

  // Evaluate packaging rules when current order changes
  useEffect(() => {
    if (currentOrder) {
      // Evaluate packaging rules
      const packagingType = evaluatePackagingRules(currentOrder, packagingRules, 'packaging');
      setCurrentOrderPackagingType(packagingType);
      console.log('📦 Determined packaging type for current order:', packagingType);

      // Evaluate box rules
      const boxName = evaluatePackagingRules(currentOrder, boxRules, 'box');
      setCurrentOrderBoxName(boxName);
      console.log('📦 Determined box name for current order:', boxName);
      
      // Find the matching box rule to get its color
      if (boxName) {
        const matchingBoxRule = boxRules.find(rule => 
          rule.enabled && 
          rule.ruleType === 'box' && 
          rule.resultValue === boxName
        );
        const boxColor = matchingBoxRule?.color || '#3B82F6'; // Default to blue
        setCurrentOrderBoxColor(boxColor);
        console.log('🎨 Determined box color for current order:', boxColor);
      } else {
        setCurrentOrderBoxColor(null);
      }
    } else {
      setCurrentOrderPackagingType(null);
      setCurrentOrderBoxName(null);
      setCurrentOrderBoxColor(null);
    }
  }, [currentOrder, packagingRules, boxRules]);

  // Check for packing instructions when current order changes
  useEffect(() => {
    const checkPackingInstructions = async () => {
      if (currentOrder && currentOrder.sku) {
        try {
          console.log(`🔍 Checking for packing instructions for current order: ${currentOrder.orderNumber}, SKU: ${currentOrder.sku}`);

          // Initialize the service if needed
          await packingInstructionService.init();

          // Get all items for this order (handles merged and multiple item orders)
          const groupedItems = getGroupedOrderItems(currentOrder, orders);
          console.log(`📦 Found ${groupedItems.length} item(s) in this order group`);

          // Build queue of items that need modal display (have instructions or notes)
          const queue: PackingInstructionQueueItem[] = [];

          for (const item of groupedItems) {
            const instruction = await packingInstructionService.getInstruction(item.sku);
            const hasNote = item.notes && item.notes.trim() !== '';

            if (instruction || hasNote) {
              queue.push({
                sku: item.sku,
                orderNumber: item.orderNumber,
                instruction: instruction,
                note: item.notes || ''
              });
              console.log(`📋 Added to queue: SKU ${item.sku}, Order ${item.orderNumber}, Has instruction: ${!!instruction}, Has note: ${hasNote}`);
            }
          }

          // Sort queue by SKU for consistent ordering
          queue.sort((a, b) => a.sku.localeCompare(b.sku));

          if (queue.length > 0) {
            console.log(`✅ Built packing instruction queue with ${queue.length} item(s)`);
            setPackingInstructionQueue(queue);
            setCurrentQueueIndex(0);

            // Set the first item in the queue and open modal
            setPackingInstruction(queue[0].instruction);
            setIsPackingInstructionModalOpen(true);
          } else {
            console.log(`⚠️ No packing instructions or notes found for any items`);
            setPackingInstructionQueue([]);
            setCurrentQueueIndex(0);
            setPackingInstruction(null);
            setIsPackingInstructionModalOpen(false);
          }
        } catch (error) {
          console.error('❌ Error checking for packing instructions:', error);
          setPackingInstructionQueue([]);
          setCurrentQueueIndex(0);
          setPackingInstruction(null);
          setIsPackingInstructionModalOpen(false);
        }
      } else {
        setPackingInstructionQueue([]);
        setCurrentQueueIndex(0);
        setPackingInstruction(null);
        setIsPackingInstructionModalOpen(false);
      }
    };

    checkPackingInstructions();
  }, [currentOrder, orders]);

  // Helper function to get grouped order items (same logic as OrderDisplay component)
  const getGroupedOrderItems = (order: Order, allOrders: Order[]): Order[] => {
    if (!allOrders || allOrders.length === 0) return [order];

    // Check if this is a merged order (same customer + same postcode, different order numbers)
    const hasMergedOrders = allOrders.some(o =>
      o.customerName === order.customerName &&
      o.buyerPostcode === order.buyerPostcode &&
      o.orderNumber !== order.orderNumber &&
      o.buyerPostcode && o.buyerPostcode.trim() !== ''
    );

    if (hasMergedOrders) {
      // Find all items with same customer and postcode (merged orders)
      const mergedItems = allOrders.filter(o =>
        o.customerName === order.customerName &&
        o.buyerPostcode === order.buyerPostcode
      );
      return mergedItems;
    } else {
      // Find all items with the same order number and customer name (multiple items)
      const sameOrderItems = allOrders.filter(o =>
        o.orderNumber === order.orderNumber &&
        o.customerName === order.customerName
      );
      return sameOrderItems.length > 1 ? sameOrderItems : [order];
    }
  };

  // Handle packing instruction completion
  const handlePackingInstructionComplete = () => {
    console.log('✅ Packing instruction acknowledged by user');

    // Check if there are more items in the queue
    if (currentQueueIndex < packingInstructionQueue.length - 1) {
      const nextIndex = currentQueueIndex + 1;
      const nextItem = packingInstructionQueue[nextIndex];

      console.log(`➡️ Moving to next item in queue: ${nextIndex + 1}/${packingInstructionQueue.length}, SKU: ${nextItem.sku}`);

      setCurrentQueueIndex(nextIndex);
      setPackingInstruction(nextItem.instruction);
      // Modal stays open for next item
    } else {
      console.log('✅ All packing instructions acknowledged, closing modal');
      setIsPackingInstructionModalOpen(false);
      setPackingInstruction(null);
      setPackingInstructionQueue([]);
      setCurrentQueueIndex(0);
    }
  };

  // Archive orders when they are loaded (with file name extraction)
  const archiveOrdersWithFileName = async (ordersToArchive: Order[], sourceFile?: File) => {
    if (!isArchiveInitialized || ordersToArchive.length === 0) return;

    try {
      // Extract file name from the source file or generate a default name
      let fileName = 'Unknown File';
      
      if (sourceFile) {
        fileName = sourceFile.name;
      } else if (ordersToArchive[0]?._sourceFileName) {
        fileName = ordersToArchive[0]._sourceFileName;
      } else if (isUsingSelroApi && selectedSelroFolderName) {
        fileName = `Selro-${selectedSelroFolderName}-${new Date().toISOString().split('T')[0]}`;
      } else if (isUsingVeeqoApi && selectedVeeqoStatus) {
        fileName = `Veeqo-${selectedVeeqoStatus}-${new Date().toISOString().split('T')[0]}`;
      } else {
        fileName = `Orders-${new Date().toISOString().split('T')[0]}`;
      }

      console.log(`🗄️ Archiving ${ordersToArchive.length} orders from: ${fileName}`);
      
      // Convert orders to archived orders with local image source info
      const ordersWithImageSource = ordersToArchive.map(order => {
        const archivedOrder = { ...order };
        
        // Add local image source info if this was a local image
        if (order._isLocalImage && order._originalSkuForLocalImage && csvImagesFolderInfo) {
          archivedOrder.localImageSource = {
            sku: order._originalSkuForLocalImage,
            folderName: csvImagesFolderInfo.folderName
          };
        }
        
        return archivedOrder;
      });
      
      const archivedCount = await archiveService.archiveOrders(ordersWithImageSource, fileName);
      console.log(`✅ Successfully archived ${archivedCount} orders`);
    } catch (error) {
      console.error('❌ Failed to archive orders:', error);
      // Don't throw error - archiving failure shouldn't break the main flow
    }
  };

  // Custom tags management
  const saveCustomTags = (tags: CustomTag[]) => {
    console.log('🏷️ Saving custom tags to localStorage:', tags);
    setCustomTags(tags);
    localStorage.setItem('customTags', JSON.stringify(tags));
  };

  const handleSelectSelroTag = (tagName: string) => {
    console.log('🏷️ Selected Selro tag:', tagName);
    setSelectedSelroTag(tagName);
    localStorage.setItem('selectedSelroTag', tagName);
    
    // Auto-load orders if Selro is connected and a folder is selected
    if (isUsingSelroApi && selectedSelroFolderId) {
      loadOrdersFromSelro(tagName === 'all' ? undefined : tagName);
    }
  };

  const handleSelectVeeqoTag = (tagName: string) => {
    console.log('🏷️ Selected Veeqo tag:', tagName);
    setSelectedVeeqoTag(tagName);
    localStorage.setItem('selectedVeeqoTag', tagName);
    
    // Auto-load orders if Veeqo is connected and a status is selected
    if (isUsingVeeqoApi && selectedVeeqoStatus) {
      loadOrdersFromVeeqo(selectedVeeqoStatus, selectedVeeqoWarehouseId, tagName === 'all' ? undefined : tagName);
    }
  };
  
  // Packaging rules management
  const savePackagingRules = (rules: PackagingRule[]) => {
    console.log('📦 Saving packaging rules to localStorage:', rules);
    setPackagingRules(rules);
    localStorage.setItem('packagingRules', JSON.stringify(rules));
  };

  // Custom packaging types management
  const saveCustomPackagingTypes = (types: string[]) => {
    console.log('📦 Saving custom packaging types to localStorage:', types);
    setCustomPackagingTypes(types);
    localStorage.setItem('customPackagingTypes', JSON.stringify(types));
  };

  // Box rules management
  const saveBoxRules = (rules: PackagingRule[]) => {
    console.log('📦 Saving box rules to localStorage:', rules);
    setBoxRules(rules);
    localStorage.setItem('boxRules', JSON.stringify(rules));
  };

  // Custom box names management
  const saveCustomBoxNames = (names: string[]) => {
    console.log('📦 Saving custom box names to localStorage:', names);
    setCustomBoxNames(names);
    localStorage.setItem('customBoxNames', JSON.stringify(names));
  };
  // CSV Images Folder management
  const setCsvImagesFolder = async () => {
    try {
      console.log('🖼️ Selecting CSV images folder...');
      
      const folderHandle = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'documents'
      });
      
      const newFolderInfo: LocalImagesFolderInfo = {
        folderName: folderHandle.name,
        selectedAt: new Date().toISOString()
      };

      setCsvImagesFolderHandle(folderHandle);
      setCsvImagesFolderInfo(newFolderInfo);

      // Save the handle for persistence
      try {
        await fileHandlePersistenceService.saveHandle('csvImagesFolder', folderHandle);
        console.log('💾 Saved folder handle for persistence');
      } catch (error) {
        console.error('⚠️ Failed to save folder handle for persistence:', error);
        // Don't throw error - the folder selection still works, just won't persist
      }

      // Save to localStorage
      localStorage.setItem('csvImagesFolderInfo', JSON.stringify(newFolderInfo));

      console.log(`✅ Successfully selected images folder: ${folderHandle.name}`);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('❌ Error selecting images folder:', error);
        throw error;
      }
    }
  };

  // Handle Selro folder selection
  const handleSelroFolderSelect = async (folderId: string, folderName: string) => {
    try {
      setSelectedSelroFolderId(folderId);
      setSelectedSelroFolderName(folderName);
      
      // Save to localStorage
      localStorage.setItem('selectedSelroFolderId', folderId);
      localStorage.setItem('selectedSelroFolderName', folderName);
      
      console.log(`Selected Selro folder: ${folderName} (${folderId})`);
      
      // Automatically load orders from the selected folder using tag filtering
      const tagToUse = selectedSelroTag === 'all' ? undefined : selectedSelroTag;
      await loadOrdersFromSelro(tagToUse);
    } catch (error) {
      console.error('Error selecting Selro folder:', error);
      alert('Failed to load orders from the selected folder. Please try again.');
    }
  };

  // Handle Veeqo status selection
  const handleVeeqoStatusSelect = async (status: string, warehouseId?: number) => {
    try {
      setSelectedVeeqoStatus(status);
      setSelectedVeeqoWarehouseId(warehouseId);
      
      // Save to localStorage
      localStorage.setItem('selectedVeeqoStatus', status);
      localStorage.setItem('selectedVeeqoWarehouseId', warehouseId ? warehouseId.toString() : '');
      
      console.log(`Selected Veeqo status: ${status}, warehouse: ${warehouseId || 'all'}`);
      
      // Automatically load orders from Veeqo
      const tagToUse = selectedVeeqoTag === 'all' ? undefined : selectedVeeqoTag;
      await loadOrdersFromVeeqo(status, warehouseId, tagToUse);
    } catch (error) {
      console.error('Error selecting Veeqo status:', error);
      alert('Failed to load orders from Veeqo. Please try again.');
    }
  };

  // Load orders from Selro API with tag filtering
  const loadOrdersFromSelro = async (tag?: string) => {
    console.warn('Selro API is not configured');
    throw new Error('Selro API is not configured');
  };

  // Load orders from Veeqo API with tag filtering
  const loadOrdersFromVeeqo = async (status?: string, warehouseId?: number, tag?: string) => {
    console.warn('Veeqo API is not configured');
    throw new Error('Veeqo API is not configured');
  };

  // Handle file upload (for HTML files)
  const handleFileUpload = async (file: File | FileWithImages) => {
    try {
      let actualFile: File;
      let imagesFolderHandle: FileSystemDirectoryHandle | undefined;

      if (file instanceof File) {
        actualFile = file;
      } else {
        if (!file.fileHandle) {
          throw new Error('No file handle available');
        }
        actualFile = file.fileHandle;
        imagesFolderHandle = file.imagesFolderHandle;
      }

      // Extract file date from the file's last modified timestamp
      const fileDate = new Date(actualFile.lastModified).toISOString();
      console.log('📅 File date extracted:', fileDate);

      const parsedOrders = await simulatePdfParsing(actualFile, imagesFolderHandle, fileDate);
      
      if (parsedOrders.length === 0) {
        throw new Error('No orders found in the uploaded file');
      }
      
      setOrders(parsedOrders);
      setPdfUploaded(true);
      setCurrentOrder(null);
      setCurrentOrderIndex(-1);
      setIsUsingSelroApi(false);
      setIsUsingVeeqoApi(false);

      // Archive the loaded orders
      await archiveOrdersWithFileName(parsedOrders, actualFile);
    } catch (error) {
      console.error('Error processing file:', error);
      throw error;
    }
  };

  // Handle CSV file upload with SKU-Image fallback
  const handleCsvFileUpload = async (file: File, mappings: CsvColumnMapping) => {
    try {
      console.log('🚀 Processing CSV file:', file.name, 'with mappings:', mappings);
      console.log('🖼️ Using images folder:', csvImagesFolderHandle?.name || 'None selected');
      
      // Ensure mappings are saved before processing
      saveCsvMappings(mappings);
      
      // Extract file date from the file's last modified timestamp
      const fileDate = new Date(file.lastModified).toISOString();
      console.log('📅 File date extracted:', fileDate);
      
      // Pass the images folder handle and file date to the CSV parser
      const parsedOrders = await parseCsvFile(file, mappings, csvImagesFolderHandle || undefined, fileDate);

      if (parsedOrders.length === 0) {
        throw new Error('No orders found in the uploaded CSV file. Please check your column mappings and ensure the CSV has data rows.');
      }

      console.log(`✅ Successfully loaded ${parsedOrders.length} orders from CSV`);
      
      setOrders(parsedOrders);
      setPdfUploaded(true);
      setCurrentOrder(null);
      setCurrentOrderIndex(-1);
      setIsUsingSelroApi(false);
      setIsUsingVeeqoApi(false);

      // Archive the loaded orders
      await archiveOrdersWithFileName(parsedOrders, file);
      
    } catch (error) {
      console.error('❌ Error processing CSV file:', error);
      throw error;
    }
  };

  // Save CSV column mappings to localStorage
  const saveCsvMappings = (mappings: CsvColumnMapping) => {
    console.log('💾 Saving CSV column mappings to localStorage:', mappings);
    setCsvColumnMappings(mappings);
    localStorage.setItem('csvColumnMappings', JSON.stringify(mappings));
  };

  // Save voice settings to localStorage
  const saveVoiceSettings = (settings: VoiceSettings) => {
    console.log('💾 Saving voice settings to localStorage:', settings);
    setVoiceSettings(settings);
    localStorage.setItem('voiceSettings', JSON.stringify(settings));
  };

  const handleMarkForReorder = async (order: Order) => {
    if (order.remainingStock === undefined) return;
    
    console.log('📦 useOrderData: Marking item for reorder:', {
      sku: order.sku,
      orderNumber: order.orderNumber,
      rowIndex: order.rowIndex,
      hasImageUrl: !!order.imageUrl,
      isLocalImage: order._isLocalImage,
      originalSkuForLocalImage: order._originalSkuForLocalImage,
      csvImagesFolderInfo: csvImagesFolderInfo
    });

    const markedDate = new Date().toISOString();
    const reorderTime = new Date().toLocaleString();

    const newItem: StockTrackingItem = {
      sku: order.sku,
      markedDate: markedDate,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      currentStock: order.remainingStock,
      location: order.location,
      imageUrl: order.imageUrl,
      rowIndex: order.rowIndex,
      orderValue: order.orderValue,
      localImageSource: order._isLocalImage && order._originalSkuForLocalImage && csvImagesFolderInfo ? {
        sku: order._originalSkuForLocalImage,
        folderName: csvImagesFolderInfo.folderName
      } : undefined,
    };
    
    console.log('📦 useOrderData: Created new stock tracking item:', {
      sku: newItem.sku,
      rowIndex: newItem.rowIndex,
      hasImageUrl: !!newItem.imageUrl,
      hasLocalImageSource: !!newItem.localImageSource,
      localImageSourceDetails: newItem.localImageSource
    });

    // Check if item is already tracked
    const existingItem = stockTrackingItems.find(item => 
      item.sku === order.sku && 
      item.orderNumber === order.orderNumber
    );

    if (!existingItem) {
      const updatedItems = [...stockTrackingItems, newItem];
      setStockTrackingItems(updatedItems);
      localStorage.setItem('stockTrackingItems', JSON.stringify(updatedItems));
      console.log('📦 useOrderData: Added item to stock tracking and saved to localStorage:', {
        sku: newItem.sku,
        totalItems: updatedItems.length,
        hasImageUrl: !!newItem.imageUrl,
        hasLocalImageSource: !!newItem.localImageSource
      });

      if (order.rowIndex) {
        try {
          console.log(`📤 Sending reorder info to Google Sheets for row ${order.rowIndex}`);
          const result = await webhookService.sendReorderInfo(order.rowIndex, reorderTime);

          if (result.success) {
            console.log(`✅ Updated reorder timestamp for row ${order.rowIndex} in Google Sheets`);
          } else {
            console.warn(`⚠️ Failed to update reorder timestamp for row ${order.rowIndex}: ${result.message}`);
          }
        } catch (error) {
          console.error(`❌ Error sending reorder info for row ${order.rowIndex}:`, error);
        }
      }
    } else {
      console.log('📦 useOrderData: Item already exists in stock tracking:', order.sku);
    }
  };

  const removeStockTrackingItem = async (sku: string, markedDate: string, orderNumber: string) => {
    const itemToRemove = stockTrackingItems.find(item =>
      item.sku === sku && item.markedDate === markedDate && item.orderNumber === orderNumber
    );

    const updatedItems = stockTrackingItems.filter(item =>
      !(item.sku === sku && item.markedDate === markedDate && item.orderNumber === orderNumber)
    );
    setStockTrackingItems(updatedItems);
    localStorage.setItem('stockTrackingItems', JSON.stringify(updatedItems));
    console.log('📦 Removed item from stock tracking:', sku, markedDate, orderNumber);

    if (itemToRemove?.rowIndex) {
      try {
        console.log(`📤 Clearing reorder info in Google Sheets for row ${itemToRemove.rowIndex}`);
        const result = await webhookService.sendReorderInfo(itemToRemove.rowIndex, '');

        if (result.success) {
          console.log(`✅ Cleared reorder timestamp for row ${itemToRemove.rowIndex} in Google Sheets`);
        } else {
          console.warn(`⚠️ Failed to clear reorder timestamp for row ${itemToRemove.rowIndex}: ${result.message}`);
        }
      } catch (error) {
        console.error(`❌ Error clearing reorder info for row ${itemToRemove.rowIndex}:`, error);
      }
    }
  };

  // Clear all stock tracking items
  const clearAllStockTrackingItems = () => {
    setStockTrackingItems([]);
    localStorage.removeItem('stockTrackingItems');
    console.log('📦 Cleared all stock tracking items');
  };

  // Normalize postcode for comparison (remove spaces and convert to uppercase)
  const normalizePostcode = (postcode: string): string => {
    return postcode.replace(/\s/g, '').toUpperCase();
  };

  // Handle QR code scanning - ENHANCED WITH ARCHIVE SEARCH
  const handleQRCodeScan = (qrData: string, employeeName?: string) => {
    // Block QR scanning if packing instruction modal is open
    if (isPackingInstructionModalOpen) {
      console.log('🚫 QR scan blocked - packing instruction modal is open');
      return;
    }

    console.log('📱 Processing QR code scan:', qrData);

    try {
      // Extract postcodes from QR data
      const postcodeRegex = /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})\b/g;
      const matches = qrData.match(postcodeRegex) || [];

      // Known sender postcodes to filter out
      const KNOWN_SENDER_POSTCODES = ['LU56RT', 'LU33RZ'];

      const postcodes = matches
        .map(match => normalizePostcode(match)) // Normalize postcodes
        .filter(postcode =>
          !KNOWN_SENDER_POSTCODES.some(sender =>
            postcode.startsWith(sender) || sender.startsWith(postcode.substring(0, 4))
          )
        );

      if (postcodes.length === 0) {
        console.log('⚠️ No buyer postcodes found in QR data');
        return;
      }

      // Use the first valid postcode for search
      const postcodeToSearch = postcodes[0];
      console.log('🔍 Using postcode for search:', postcodeToSearch);

      // Let the customer search handle the actual order finding (which now includes archive search and auto-complete)
      handleCustomerSearch(postcodeToSearch, employeeName);

    } catch (error) {
      console.error('Error processing QR code:', error);
    }
  };

  // Handle customer search - ENHANCED WITH ARCHIVE SEARCH
  const handleCustomerSearch = async (searchTerm: string, employeeName?: string) => {
    // Block search if packing instruction modal is open
    if (isPackingInstructionModalOpen) {
      console.log('🚫 Search blocked - packing instruction modal is open');
      return;
    }

    if (!searchTerm) return;

    setSearchMessage(''); // Clear previous message

    try {
      let foundOrder: Order | null = null;

      if (isUsingSelroApi && selectedSelroFolderName) {
        console.warn('Selro API is not configured - skipping API search');
      } else if (isUsingVeeqoApi && selectedVeeqoStatus) {
        console.warn('Veeqo API is not configured - skipping API search');
      } else {
        // Search in loaded orders (file-based) - enhanced search with postcode normalization
        const searchTermLower = searchTerm.toLowerCase();
        const normalizedSearchTerm = normalizePostcode(searchTerm);

        foundOrder = orders.find(order => {
          // Search by customer name
          if (order.customerName.toLowerCase().includes(searchTermLower)) {
            return true;
          }

          // Search by order number/ID
          if (order.orderNumber.toLowerCase().includes(searchTermLower)) {
            return true;
          }

          // Search by buyer postcode (normalized comparison)
          if (order.buyerPostcode && normalizePostcode(order.buyerPostcode).includes(normalizedSearchTerm)) {
            return true;
          }

          // Search by SKU
          if (order.sku.toLowerCase().includes(searchTermLower)) {
            return true;
          }

          return false;
        });
      }

      if (foundOrder) {
        setCurrentOrder(foundOrder);
        setSearchMessage(''); // Clear message on success

        const groupedItems = getGroupedItems(foundOrder, orders);

        if (groupedItems.length > 1) {
          const uniqueOrderNumbers = new Set(groupedItems.map(item => item.orderNumber));
          if (uniqueOrderNumbers.size > 1) {
            console.log(`Found merged order with ${groupedItems.length} items across ${uniqueOrderNumbers.size} order numbers:`, Array.from(uniqueOrderNumbers).join(', '));
          } else {
            console.log(`Found multiple items order with ${groupedItems.length} items for order:`, foundOrder.orderNumber);
          }
        } else {
          console.log('Found order for search term:', searchTerm, 'Order:', foundOrder.orderNumber);
        }

        // If auto-complete is enabled and employee name is provided, trigger completion
        if (autoCompleteEnabled && employeeName) {
          console.log('🔄 Auto-completing searched order with employee:', employeeName);
          await handleOrderComplete(foundOrder, employeeName);
        }
      } else {
        // If not found in current orders, search the archive
        console.log('🗄️ Order not found in current data, searching archive...');
        
        if (isArchiveInitialized) {
          try {
            const archiveResult = await archiveService.searchArchive(searchTerm);
            
            if (archiveResult.foundInArchive && archiveResult.orders.length > 0) {
              const archivedOrder = archiveResult.orders[0];
              console.log('✅ Found order in archive:', archivedOrder.orderNumber, 'from file:', archivedOrder.fileName);
              
              // Convert archived order to regular order and set as current
              const orderFromArchive: Order = {
                orderNumber: archivedOrder.orderNumber,
                customerName: archivedOrder.customerName,
                sku: archivedOrder.sku,
                quantity: archivedOrder.quantity,
                location: archivedOrder.location,
                imageUrl: archivedOrder.imageUrl,
                itemName: archivedOrder.itemName,
                buyerPostcode: archivedOrder.buyerPostcode,
                remainingStock: archivedOrder.remainingStock,
                orderValue: archivedOrder.orderValue,
                fileDate: archivedOrder.fileDate,
                channelType: archivedOrder.channelType,
                channel: archivedOrder.channel,
                width: archivedOrder.width,
                weight: archivedOrder.weight,
                shipFromLocation: archivedOrder.shipFromLocation,
                packageDimension: archivedOrder.packageDimension,
                packagingType: archivedOrder.packagingType,
                completed: archivedOrder.completed || false,
                selroOrderId: archivedOrder.selroOrderId,
                selroItemId: archivedOrder.selroItemId,
                veeqoOrderId: archivedOrder.veeqoOrderId,
                veeqoItemId: archivedOrder.veeqoItemId,
              };
              
              setCurrentOrder(orderFromArchive);
              
              setSearchMessage(''); // Clear message on success
              // Show a notification that this order was found in archive
              const fileDate = archivedOrder.fileDate ? new Date(archivedOrder.fileDate).toLocaleDateString('en-GB') : 'Unknown date';
              console.log(`📋 Loaded archived order from ${archivedOrder.fileName} (${fileDate})`);
              
              // Optionally show a visual indicator that this is from archive
              // You could add a toast notification here if you implement one
              
            } else {
             // Clear current order when no match is found
             setCurrentOrder(null);
              setSearchMessage(`No order found for "${searchTerm}"`);
              console.log('No order found for search term:', searchTerm);
            }
          } catch (error) {
           // Clear current order when search fails
           setCurrentOrder(null);
            setSearchMessage(`No order found for "${searchTerm}"`);
            console.error('Error searching archive:', error);
          }
        } else {
         // Clear current order when archive not available
         setCurrentOrder(null);
          setSearchMessage(`No order found for "${searchTerm}"`);
          console.log('Archive not initialized, cannot search');
        }
      }
    } catch (error) {
     // Clear current order when search encounters an error
     setCurrentOrder(null);
      setSearchMessage(`Error searching for "${searchTerm}"`);
      console.error('Error searching:', error);
    }
  };

  // Handle arrow key navigation
  const handleArrowNavigation = (direction: 'up' | 'down') => {
    // Block navigation if packing instruction modal is open
    if (isPackingInstructionModalOpen) {
      console.log('🚫 Navigation blocked - packing instruction modal is open');
      return;
    }

    if (orders.length === 0) return;
    
    let newIndex = currentOrderIndex;
    
    if (direction === 'up') {
      newIndex = currentOrderIndex <= 0 ? orders.length - 1 : currentOrderIndex - 1;
    } else {
      newIndex = currentOrderIndex >= orders.length - 1 ? 0 : currentOrderIndex + 1;
    }
    
    setCurrentOrderIndex(newIndex);
    setCurrentOrder(orders[newIndex]);
    console.log(`🔄 Arrow navigation: ${direction}, new index: ${newIndex}, order: ${orders[newIndex].orderNumber}`);
  };

  // Save other settings
  const saveOtherSettings = (settings: { autoCompleteEnabled: boolean }) => {
    setAutoCompleteEnabled(settings.autoCompleteEnabled);
    localStorage.setItem('autoCompleteEnabled', JSON.stringify(settings.autoCompleteEnabled));
    console.log('💾 Saved other settings:', settings);
  };

  // Update stock tracking item
  const updateStockTrackingItem = (sku: string, markedDate: string, updates: Partial<StockTrackingItem>) => {
    console.log('📦 useOrderData: Updating stock tracking item:', {
      sku,
      markedDate,
      updates,
      hasImageUrlUpdate: !!updates.imageUrl
    });
    
    const updatedItems = stockTrackingItems.map(item => {
      if (item.sku === sku && item.markedDate === markedDate) {
        const updatedItem = { ...item, ...updates };
        console.log('📦 useOrderData: Item updated:', {
          sku: updatedItem.sku,
          hasImageUrl: !!updatedItem.imageUrl,
          hasLocalImageSource: !!updatedItem.localImageSource
        });
        return updatedItem;
      }
      return item;
    });
    setStockTrackingItems(updatedItems);
    localStorage.setItem('stockTrackingItems', JSON.stringify(updatedItems));
    console.log('📦 useOrderData: Updated stock tracking item and saved to localStorage:', {
      sku,
      updates,
      totalItems: updatedItems.length
    });
  };

  // Helper function to get all items in a group (merged orders or multiple items)
  const getGroupedItems = (order: Order, allOrders: Order[]): Order[] => {
    // Check if this is a merged order (same customer + same postcode, different order numbers)
    const hasMergedOrders = allOrders.some(o =>
      o.customerName === order.customerName &&
      o.buyerPostcode === order.buyerPostcode &&
      o.orderNumber !== order.orderNumber &&
      o.buyerPostcode && o.buyerPostcode.trim() !== ''
    );

    if (hasMergedOrders) {
      // Return all items with same customer and postcode (merged orders)
      return allOrders.filter(o =>
        o.customerName === order.customerName &&
        o.buyerPostcode === order.buyerPostcode
      );
    } else {
      // Return all items with same customer and order number (multiple items)
      const sameOrderItems = allOrders.filter(o =>
        o.orderNumber === order.orderNumber &&
        o.customerName === order.customerName
      );
      return sameOrderItems.length > 1 ? sameOrderItems : [order];
    }
  };

  // Handle order completion
  const handleOrderComplete = async (order: Order, employeeName?: string) => {
    try {
      // Get all items in the group (merged orders or multiple items)
      const groupedItems = getGroupedItems(order, orders);

      console.log(`📦 Completing ${groupedItems.length} items in group for order ${order.orderNumber}`);

      // Mark all items in the group as completed
      groupedItems.forEach(item => {
        item.completed = true;
      });

      // Update local state
      setOrders(prevOrders =>
        prevOrders.map(o => {
          const isInGroup = groupedItems.some(gi =>
            gi.orderNumber === o.orderNumber &&
            gi.sku === o.sku &&
            gi.customerName === o.customerName
          );
          return isInGroup ? { ...o, completed: true } : o;
        })
      );

      // If using Selro API, update the order status in Selro
      if (isUsingSelroApi && order.selroOrderId && order.selroItemId) {
        console.warn('Selro API is not configured - cannot update order status');
      }

      // If using Veeqo API, update the order status in Veeqo
      if (isUsingVeeqoApi && order.veeqoOrderId) {
        console.warn('Veeqo API is not configured - cannot update order status');
      }

      // Write packer info to Google Sheets via webhook for ALL grouped items with rowIndex
      if (employeeName) {
        const packedTime = new Date().toLocaleString();
        const itemsWithRowIndex = groupedItems.filter(item => item.rowIndex);

        if (itemsWithRowIndex.length > 0) {
          console.log(`📤 Sending packer info for ${itemsWithRowIndex.length} order rows to Google Sheets`);

          // Send packer info for each row sequentially
          for (const item of itemsWithRowIndex) {
            try {
              const result = await webhookService.sendPackerInfo(
                item.rowIndex!,
                employeeName,
                packedTime
              );

              if (result.success) {
                console.log(`✅ Updated packer info for order ${item.orderNumber} (row ${item.rowIndex}) in Google Sheets`);
              } else {
                console.warn(`⚠️ Failed to update packer info for order ${item.orderNumber} (row ${item.rowIndex}): ${result.message}`);
              }

              // Small delay to avoid overwhelming the webhook
              if (itemsWithRowIndex.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            } catch (error) {
              console.error(`❌ Error sending packer info for order ${item.orderNumber} (row ${item.rowIndex}):`, error);
              // Continue with next item even if this one fails
            }
          }

          console.log(`✅ Completed packer info updates for ${itemsWithRowIndex.length} rows`);
        } else {
          console.log('ℹ️ No orders with rowIndex found - skipping Google Sheets update');
        }
      }
    } catch (error) {
      console.error('Error marking order as complete:', error);
      // Revert local state if API update failed
      order.completed = false;
      setOrders(prevOrders =>
        prevOrders.map(o =>
          o.orderNumber === order.orderNumber && o.sku === order.sku ? order : o
        )
      );
      alert('Failed to update order status. Please try again.');
    }
  };

  // Handle loading archived order
  const handleLoadArchivedOrder = async (archivedOrder: ArchivedOrder) => {
    console.log('📋 Loading archived order:', archivedOrder.orderNumber, 'from file:', archivedOrder.fileName);
    
    // Convert archived order to regular order
    const orderFromArchive: Order = {
      orderNumber: archivedOrder.orderNumber,
      customerName: archivedOrder.customerName,
      sku: archivedOrder.sku,
      quantity: archivedOrder.quantity,
      location: archivedOrder.location,
      imageUrl: archivedOrder.imageUrl, // This will be updated below if local image exists
      itemName: archivedOrder.itemName,
      buyerPostcode: archivedOrder.buyerPostcode,
      remainingStock: archivedOrder.remainingStock,
      orderValue: archivedOrder.orderValue,
      fileDate: archivedOrder.fileDate,
      channelType: archivedOrder.channelType,
      channel: archivedOrder.channel,
      width: archivedOrder.width,
      weight: archivedOrder.weight,
      shipFromLocation: archivedOrder.shipFromLocation,
      packageDimension: archivedOrder.packageDimension,
      notes: archivedOrder.notes,
      packagingType: archivedOrder.packagingType,
      completed: archivedOrder.completed || false,
      selroOrderId: archivedOrder.selroOrderId,
      selroItemId: archivedOrder.selroItemId,
      veeqoOrderId: archivedOrder.veeqoOrderId,
      veeqoItemId: archivedOrder.veeqoItemId,
      _sourceFileName: archivedOrder.fileName,
    };
    
    // Try to restore local image if it was originally from a local folder
    if (archivedOrder.localImageSource) {
      try {
        console.log('🖼️ Attempting to restore local image for archived order...');
        
        // Try to get the saved folder handle
        const savedHandle = await fileHandlePersistenceService.getHandle('csvImagesFolder');
        
        if (savedHandle && savedHandle.name === archivedOrder.localImageSource.folderName) {
          // Validate and request permission
          const hasPermission = await fileHandlePersistenceService.validateAndRequestPermission(savedHandle);
          
          if (hasPermission) {
            // Try to find the image using the original SKU
            const restoredImageUrl = await findImageFile(savedHandle, archivedOrder.localImageSource.sku);
            
            if (restoredImageUrl) {
              orderFromArchive.imageUrl = restoredImageUrl;
              orderFromArchive._isLocalImage = true;
              orderFromArchive._originalSkuForLocalImage = archivedOrder.localImageSource.sku;
              console.log(`✅ Successfully restored local image for SKU: ${archivedOrder.localImageSource.sku}`);
            } else {
              console.log(`⚠️ Could not find image file for SKU: ${archivedOrder.localImageSource.sku}`);
            }
          } else {
            console.log('❌ Permission denied for images folder');
          }
        } else {
          console.log('⚠️ Images folder handle not available or folder name mismatch');
        }
      } catch (error) {
        console.error('❌ Error restoring local image:', error);
      }
    }
    
    setCurrentOrder(orderFromArchive);
    
    // Show file date info
    const fileDate = archivedOrder.fileDate ? new Date(archivedOrder.fileDate).toLocaleDateString('en-GB') : 'Unknown date';
    console.log(`✅ Loaded archived order from ${archivedOrder.fileName} (${fileDate})`);
  };

  // Handle image preview by SKU
  const handlePreviewImageBySku = async (sku: string) => {
    console.log(`🔍 Preview image requested for SKU: ${sku}`);
    
    // Open modal in loading state
    setImagePreviewModal({
      isOpen: true,
      sku: sku,
      imageUrl: '',
      message: '',
      isLoading: true
    });
    
    try {
      // Check if local images folder is available
      if (!csvImagesFolderHandle) {
        setImagePreviewModal(prev => ({
          ...prev,
          isLoading: false,
          message: 'No local images folder selected. Please select a local images folder in the CSV Upload settings.'
        }));
        return;
      }
      
      console.log(`🖼️ Searching for image in folder: ${csvImagesFolderHandle.name}`);
      
      // Search for image using the SKU
      const imageUrl = await findImageFile(csvImagesFolderHandle, sku);
      
      if (imageUrl) {
        console.log(`✅ Found image for SKU: ${sku}`);
        setImagePreviewModal(prev => ({
          ...prev,
          isLoading: false,
          imageUrl: imageUrl,
          message: ''
        }));
      } else {
        console.log(`❌ No image found for SKU: ${sku}`);
        setImagePreviewModal(prev => ({
          ...prev,
          isLoading: false,
          imageUrl: '',
          message: `No image found for SKU "${sku}" in the local images folder "${csvImagesFolderHandle.name}".`
        }));
      }
    } catch (error) {
      console.error(`❌ Error searching for image for SKU ${sku}:`, error);
      setImagePreviewModal(prev => ({
        ...prev,
        isLoading: false,
        imageUrl: '',
        message: `Error searching for image: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  };

  // Close image preview modal
  const closeImagePreviewModal = () => {
    setImagePreviewModal({
      isOpen: false,
      sku: '',
      imageUrl: '',
      message: '',
      isLoading: false
    });
  };

  // Load orders from Google Sheets
  const loadOrdersFromGoogleSheets = useCallback(async (selectedDate: string, shouldShowDialog: boolean = true) => {
    try {
      const settings = await googleSheetsService.getSettings();
      if (!settings?.google_sheets_id) {
        throw new Error('Google Sheets not connected');
      }

      const columnMapping = await googleSheetsService.getColumnMapping();
      console.log('📋 Using column mapping for Google Sheets:', columnMapping);

      // Auto-sync packing instructions from Google Sheets
      try {
        console.log('📦 Auto-syncing packing instructions from Google Sheets...');
        const instructions = await googleSheetsService.fetchPackingInstructions(settings.google_sheets_id, 'Packing Instructions');

        if (instructions.length > 0) {
          await packingInstructionService.init();
          await packingInstructionService.syncFromGoogleSheets(instructions);
          console.log(`✅ Auto-synced ${instructions.length} packing instructions`);

          await googleSheetsService.saveSettings({
            packing_instructions_last_sync: new Date().toISOString(),
            packing_instructions_sync_status: 'success',
            packing_instructions_error_message: null,
          });
        } else {
          console.log('⚠️ No packing instructions found in Google Sheets');
        }
      } catch (instructionError) {
        console.warn('⚠️ Failed to auto-sync packing instructions:', instructionError);
        // Don't fail the entire order load if instructions sync fails
        await googleSheetsService.saveSettings({
          packing_instructions_sync_status: 'error',
          packing_instructions_error_message: instructionError instanceof Error ? instructionError.message : 'Unknown error',
        });
      }

      const fetchedOrders = await googleSheetsService.fetchOrders(
        settings.google_sheets_id,
        selectedDate,
        columnMapping
      );

      if (fetchedOrders.length === 0 && selectedDate) {
        console.warn(`⚠️ No orders loaded for date: ${selectedDate}`);
        console.warn('💡 Possible reasons:');
        console.warn('   1. No orders exist for this date in Google Sheets');
        console.warn('   2. Date column (fileDate/orderDate) may not be properly mapped');
        console.warn('   3. Date format mismatch between sheet and selected date');
        console.warn('💡 Check Settings > Google Sheets > Column Mapping to verify date fields are mapped correctly');
      }

      // Load images from local folder if available
      if (csvImagesFolderHandle && fetchedOrders.length > 0) {
        console.log(`🖼️ Loading images from folder for ${fetchedOrders.length} Google Sheets orders...`);
        for (const order of fetchedOrders) {
          if (order.sku) {
            try {
              const imageUrl = await findImageFile(csvImagesFolderHandle, order.sku);
              if (imageUrl) {
                order.imageUrl = imageUrl;
                console.log(`🖼️ Found image for SKU "${order.sku}"`);
              } else {
                console.log(`🖼️ No image available in folder for SKU "${order.sku}"`);
              }
            } catch (error) {
              console.log(`🖼️ Error loading image for SKU "${order.sku}":`, error);
            }
          }
        }
      } else if (!csvImagesFolderHandle) {
        console.log('🖼️ No images folder selected, images will not be available');
      }

      if (orders.length > 0 && shouldShowDialog) {
        setPendingOrders(fetchedOrders);
        setIsMergeDialogOpen(true);
      } else {
        setOrders(fetchedOrders);
        setPdfUploaded(true);
        setCurrentOrder(null);
        setIsUsingSelroApi(false);
        setIsUsingVeeqoApi(false);
        await archiveOrdersWithFileName(fetchedOrders);
      }
    } catch (error) {
      console.error('Failed to load orders from Google Sheets:', error);
      throw error;
    }
  }, [orders, csvImagesFolderHandle]);

  // Handle merge orders
  const handleMergeOrders = useCallback(() => {
    const newOrders = googleSheetsService.compareOrders(orders, pendingOrders);
    const mergedOrders = [...orders, ...newOrders];
    setOrders(mergedOrders);
    setIsMergeDialogOpen(false);
    setPendingOrders([]);
    archiveOrdersWithFileName(newOrders);
  }, [orders, pendingOrders]);

  // Handle replace orders
  const handleReplaceOrders = useCallback(() => {
    setOrders(pendingOrders);
    setPdfUploaded(true);
    setCurrentOrder(null);
    setIsMergeDialogOpen(false);
    archiveOrdersWithFileName(pendingOrders);
    setPendingOrders([]);
  }, [pendingOrders]);

  // Handle cancel merge dialog
  const handleCancelMerge = useCallback(() => {
    setIsMergeDialogOpen(false);
    setPendingOrders([]);
  }, []);

  // Auto-refresh functionality
  const startAutoRefresh = useCallback(async () => {
    const settings = await googleSheetsService.getSettings();
    if (!settings?.auto_refresh_enabled || !settings.selected_date || !settings.google_sheets_id) {
      return;
    }

    if (autoRefreshTimerId) {
      clearInterval(autoRefreshTimerId);
    }

    const timerId = setInterval(async () => {
      try {
        const currentSettings = await googleSheetsService.getSettings();
        if (!currentSettings?.auto_refresh_enabled || !currentSettings.selected_date) {
          return;
        }

        const columnMapping = await googleSheetsService.getColumnMapping();

        const fetchedOrders = await googleSheetsService.fetchOrders(
          currentSettings.google_sheets_id!,
          currentSettings.selected_date,
          columnMapping
        );

        // Load images from local folder if available
        if (csvImagesFolderHandle && fetchedOrders.length > 0) {
          console.log(`🖼️ Auto-refresh: Loading images from folder for ${fetchedOrders.length} orders...`);
          for (const order of fetchedOrders) {
            if (order.sku) {
              try {
                const imageUrl = await findImageFile(csvImagesFolderHandle, order.sku);
                if (imageUrl) {
                  order.imageUrl = imageUrl;
                }
              } catch (error) {
                console.log(`🖼️ Auto-refresh: Error loading image for SKU "${order.sku}":`, error);
              }
            }
          }
        }

        const newOrders = googleSheetsService.compareOrders(orders, fetchedOrders);

        if (newOrders.length > 0) {
          setNewOrdersCount(newOrders.length);
          setPendingOrders(fetchedOrders);
          setIsNewOrdersPopupOpen(true);
        }
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }, 15 * 60 * 1000);

    setAutoRefreshTimerId(timerId);
  }, [orders, autoRefreshTimerId, csvImagesFolderHandle]);

  // Stop auto-refresh
  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshTimerId) {
      clearInterval(autoRefreshTimerId);
      setAutoRefreshTimerId(null);
    }
  }, [autoRefreshTimerId]);

  // Handle add new orders from popup
  const handleAddNewOrders = useCallback(() => {
    const newOrders = googleSheetsService.compareOrders(orders, pendingOrders);
    const mergedOrders = [...orders, ...newOrders];
    setOrders(mergedOrders);
    setIsNewOrdersPopupOpen(false);
    setPendingOrders([]);
    setNewOrdersCount(0);
    archiveOrdersWithFileName(newOrders);
  }, [orders, pendingOrders]);

  // Handle dismiss new orders popup
  const handleDismissNewOrders = useCallback(() => {
    setIsNewOrdersPopupOpen(false);
    setPendingOrders([]);
    setNewOrdersCount(0);
  }, []);

  // Sync problem status from Supabase for loaded orders
  const syncProblemStatus = useCallback(async (ordersToSync: Order[]) => {
    if (ordersToSync.length === 0) return;

    try {
      console.log(`🔄 Syncing problem status for ${ordersToSync.length} orders`);

      const orderNumbers = [...new Set(ordersToSync.map(o => o.orderNumber))];
      const skus = [...new Set(ordersToSync.map(o => o.sku))];

      const problemsMap = await orderProblemsService.getProblemsForOrders(orderNumbers, skus);

      if (problemsMap.size > 0) {
        console.log(`✅ Found ${problemsMap.size} problems to sync`);

        const updatedOrders = ordersToSync.map(order => {
          const problemKey = `${order.orderNumber}-${order.sku}`;
          const problem = problemsMap.get(problemKey);

          if (problem) {
            return {
              ...order,
              problemStatus: problem.status,
              problemId: problem.id,
              problemReportedAt: problem.reported_at
            };
          }
          return order;
        });

        setOrders(updatedOrders);
        console.log('✅ Problem status sync complete');
      } else {
        console.log('ℹ️ No problems found for current orders');
      }
    } catch (error) {
      console.error('❌ Error syncing problem status:', error);
    }
  }, []);

  // Sync problem status when orders change
  useEffect(() => {
    if (orders.length > 0) {
      syncProblemStatus(orders);
    }
  }, [orders.length]);

  // Subscribe to real-time problem updates
  useEffect(() => {
    if (orders.length === 0) return;

    console.log('📡 Subscribing to order problems updates');

    const subscription = orderProblemsService.subscribeToProblems((updatedProblem) => {
      console.log('🔔 Received problem update:', updatedProblem);

      setOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.orderNumber === updatedProblem.order_number && order.sku === updatedProblem.sku) {
            console.log(`✅ Updating order ${order.orderNumber} with problem status: ${updatedProblem.status}`);
            return {
              ...order,
              problemStatus: updatedProblem.status,
              problemId: updatedProblem.id,
              problemReportedAt: updatedProblem.reported_at
            };
          }
          return order;
        });
      });
    });

    return () => {
      console.log('📡 Unsubscribing from order problems updates');
      subscription();
    };
  }, [orders.length]);

  // Start auto-refresh when orders are loaded from Google Sheets
  useEffect(() => {
    const checkAutoRefresh = async () => {
      const settings = await googleSheetsService.getSettings();
      if (settings?.auto_refresh_enabled && settings.selected_date && orders.length > 0) {
        startAutoRefresh();
      }
    };

    checkAutoRefresh();

    return () => {
      stopAutoRefresh();
    };
  }, [orders.length]);

  return {
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
    handleSelroFolderSelect,
    selectedSelroFolderId,
    selectedSelroFolderName,
    handleVeeqoStatusSelect,
    selectedVeeqoStatus,
    selectedVeeqoWarehouseId,
    isUsingSelroApi,
    isUsingVeeqoApi,
    loadOrdersFromSelro,
    loadOrdersFromVeeqo,
    handleOrderComplete,
    // Custom tags functionality
    customTags,
    saveCustomTags,
    selectedSelroTag,
    selectedVeeqoTag,
    handleSelectSelroTag,
    handleSelectVeeqoTag,
    // CSV Images Folder functionality
    csvImagesFolderHandle,
    csvImagesFolderInfo,
    setCsvImagesFolder,
    // Archive functionality
    handleLoadArchivedOrder,
    isArchiveInitialized,
    // Packaging rules
    packagingRules,
    savePackagingRules,
    customPackagingTypes,
    saveCustomPackagingTypes,
    currentOrderPackagingType,
    boxRules,
    saveBoxRules,
    customBoxNames,
    saveCustomBoxNames,
    currentOrderBoxName,
    currentOrderBoxColor,
    // Other settings
    autoCompleteEnabled,
    saveOtherSettings,
    searchMessage,
    setSearchMessage,
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
  };
};