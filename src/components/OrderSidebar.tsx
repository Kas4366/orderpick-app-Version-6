import React from 'react';
import { CheckCircle2, ArrowRight, Package, Filter, ChevronDown } from 'lucide-react';
import { Order } from '../types/Order';

interface OrderSidebarProps {
  orders: Order[];
  currentOrder: Order | null;
  currentOrderIndex: number;
  onOrderSelect: (order: Order) => void;
  onFilterChange?: (filters: FilterState) => void;
  initialFilters?: FilterState;
}

export interface FilterState {
  showCompleted: boolean;
  showIncomplete: boolean;
  showMultipleItems: boolean;
  showMergedOrders: boolean;
  showSingleItems: boolean;
  showWithProblems: boolean;
  showProblemsPending: boolean;
  showProblemsInProgress: boolean;
  showProblemsEscalated: boolean;
  showProblemsResolved: boolean;
  showWithoutProblems: boolean;
}

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

interface GroupedOrder {
  customerName: string;
  orderNumber: string;
  orderNumbers?: string[]; // For merged orders with different order numbers
  items: Order[];
  totalItems: number;
  completedItems: number;
  buyerPostcode?: string;
  originalIndex: number; // Track original position in CSV
  isMergedOrder: boolean; // True if multiple order numbers for same customer+postcode
  isMultipleItems: boolean; // True if multiple items with same order number
}

export const OrderSidebar: React.FC<OrderSidebarProps> = ({
  orders,
  currentOrder,
  currentOrderIndex,
  onOrderSelect,
  onFilterChange,
  initialFilters
}) => {
  const [filters, setFilters] = React.useState<FilterState>(initialFilters || defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };
  // Group orders by:
  // 1. Same customer + same postcode (merged orders - different order numbers)
  // 2. Same customer + same order number (multiple items - same order number)
  const groupedOrders = React.useMemo(() => {
    const groups = new Map<string, GroupedOrder>();

    orders.forEach((order, index) => {
      // Only group if customer name is meaningful (not defaults)
      const hasRealCustomerName = order.customerName && !order.customerName.startsWith('Customer-');
      const hasRealOrderNumber = order.orderNumber && !order.orderNumber.startsWith('Row-');
      const hasRealPostcode = order.buyerPostcode && order.buyerPostcode.trim() !== '';

      // Create grouping key based on customer name and postcode (for merged orders)
      const groupKey = hasRealCustomerName && hasRealPostcode
        ? `${order.customerName.trim()}_${order.buyerPostcode.trim()}`
        : hasRealCustomerName && hasRealOrderNumber
        ? `${order.customerName.trim()}_${order.orderNumber.trim()}`
        : `unique_${index}`; // Make each order unique if no real customer/order data

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          orderNumbers: [order.orderNumber],
          items: [],
          totalItems: 0,
          completedItems: 0,
          buyerPostcode: order.buyerPostcode,
          originalIndex: index,
          isMergedOrder: false,
          isMultipleItems: false,
        });
      }

      const group = groups.get(groupKey)!;

      // Track unique order numbers for merged orders
      if (!group.orderNumbers!.includes(order.orderNumber)) {
        group.orderNumbers!.push(order.orderNumber);
      }

      group.items.push(order);
      group.totalItems += order.quantity;
      if (order.completed) {
        group.completedItems += order.quantity;
      }
    });

    // Determine if each group is merged or multiple items
    groups.forEach((group) => {
      const uniqueOrderNumbers = new Set(group.items.map(item => item.orderNumber));
      if (uniqueOrderNumbers.size > 1) {
        group.isMergedOrder = true;
        group.isMultipleItems = false;
      } else if (group.items.length > 1) {
        group.isMergedOrder = false;
        group.isMultipleItems = true;
      }
    });

    // Sort by original index to preserve CSV order
    const sortedGroups = Array.from(groups.values()).sort((a, b) => a.originalIndex - b.originalIndex);

    console.log(`📋 Grouped ${orders.length} orders into ${sortedGroups.length} display groups`);

    // Log grouping details
    sortedGroups.forEach((group, index) => {
      if (group.isMergedOrder) {
        console.log(`  🔀 Group ${index + 1}: ${group.customerName} (Merged Orders: ${group.orderNumbers!.join(', ')}) - ${group.items.length} items`);
      } else if (group.isMultipleItems) {
        console.log(`  👥 Group ${index + 1}: ${group.customerName} (Order: ${group.orderNumber}) - ${group.items.length} items`);
      } else {
        console.log(`  👤 Group ${index + 1}: ${group.customerName} (Order: ${group.orderNumber}) - single item`);
      }
    });
    
    return sortedGroups;
  }, [orders]);

  // Filter grouped orders based on selected filters
  const filteredGroups = React.useMemo(() => {
    return groupedOrders.filter(group => {
      const isCompleted = group.completedItems === group.totalItems && group.totalItems > 0;
      const isIncomplete = !isCompleted;
      const isSingleItem = !group.isMergedOrder && !group.isMultipleItems;

      if (isCompleted && !filters.showCompleted) return false;
      if (isIncomplete && !filters.showIncomplete) return false;
      if (group.isMergedOrder && !filters.showMergedOrders) return false;
      if (group.isMultipleItems && !filters.showMultipleItems) return false;
      if (isSingleItem && !filters.showSingleItems) return false;

      // Problem status filtering
      const hasProblem = group.items.some(item => item.problemStatus);
      const hasPending = group.items.some(item => item.problemStatus === 'pending');
      const hasInProgress = group.items.some(item => item.problemStatus === 'in_progress');
      const hasEscalated = group.items.some(item => item.problemStatus === 'escalated');
      const hasResolved = group.items.some(item => item.problemStatus === 'resolved');

      if (hasProblem && !filters.showWithProblems) return false;
      if (!hasProblem && !filters.showWithoutProblems) return false;
      if (hasPending && !filters.showProblemsPending) return false;
      if (hasInProgress && !filters.showProblemsInProgress) return false;
      if (hasEscalated && !filters.showProblemsEscalated) return false;
      if (hasResolved && !filters.showProblemsResolved) return false;

      return true;
    });
  }, [groupedOrders, filters]);

  // Calculate filter counts
  const filterCounts = React.useMemo(() => {
    const completed = groupedOrders.filter(g => g.completedItems === g.totalItems && g.totalItems > 0).length;
    const incomplete = groupedOrders.filter(g => !(g.completedItems === g.totalItems && g.totalItems > 0)).length;
    const multipleItems = groupedOrders.filter(g => g.isMultipleItems).length;
    const mergedOrders = groupedOrders.filter(g => g.isMergedOrder).length;
    const singleItems = groupedOrders.filter(g => !g.isMergedOrder && !g.isMultipleItems).length;
    const withProblems = groupedOrders.filter(g => g.items.some(item => item.problemStatus)).length;
    const withoutProblems = groupedOrders.filter(g => !g.items.some(item => item.problemStatus)).length;
    const pending = groupedOrders.filter(g => g.items.some(item => item.problemStatus === 'pending')).length;
    const inProgress = groupedOrders.filter(g => g.items.some(item => item.problemStatus === 'in_progress')).length;
    const escalated = groupedOrders.filter(g => g.items.some(item => item.problemStatus === 'escalated')).length;
    const resolved = groupedOrders.filter(g => g.items.some(item => item.problemStatus === 'resolved')).length;

    return {
      completed,
      incomplete,
      multipleItems,
      mergedOrders,
      singleItems,
      withProblems,
      withoutProblems,
      pending,
      inProgress,
      escalated,
      resolved,
      all: groupedOrders.length
    };
  }, [groupedOrders]);

  const getCurrentGroup = () => {
    if (!currentOrder) return null;
    return filteredGroups.find(group => 
      group.items.some(item => 
        item.orderNumber === currentOrder.orderNumber && 
        item.sku === currentOrder.sku &&
        item.customerName === currentOrder.customerName
      )
    );
  };

  const currentGroup = getCurrentGroup();

  // Scroll to current order in sidebar
  React.useEffect(() => {
    if (currentOrder && currentOrderIndex >= 0) {
      const currentGroupIndex = filteredGroups.findIndex(group => 
        group.items.some(item => 
          item.orderNumber === currentOrder.orderNumber && 
          item.sku === currentOrder.sku &&
          item.customerName === currentOrder.customerName
        )
      );
      
      if (currentGroupIndex >= 0) {
        const groupElement = document.querySelector(`[data-group-index="${currentGroupIndex}"]`);
        if (groupElement) {
          groupElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }
    }
  }, [currentOrder, currentOrderIndex, filteredGroups]);

  return (
    <div className="w-80 shrink-0 bg-white rounded-lg shadow-md border border-gray-200 h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Orders List</h3>
        <div className="text-sm text-gray-600 mt-1">
          <p>{filteredGroups.length} of {groupedOrders.length} orders • {orders.length} items total</p>
          {currentOrderIndex >= 0 && (
            <p className="text-blue-600">
              Item {currentOrderIndex + 1} of {orders.length}
            </p>
          )}
        </div>

        {/* Filter Dropdown */}
        <div className="mt-3 relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Filter Orders</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-gray-600 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>

          {isFilterOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={filters.showCompleted}
                  onChange={(e) => handleFilterChange({ ...filters, showCompleted: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 flex-1">Completed Orders</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                  {filterCounts.completed}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={filters.showIncomplete}
                  onChange={(e) => handleFilterChange({ ...filters, showIncomplete: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 flex-1">Incomplete Orders</span>
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                  {filterCounts.incomplete}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={filters.showMergedOrders}
                  onChange={(e) => handleFilterChange({ ...filters, showMergedOrders: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 flex-1">Merged Orders</span>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                  {filterCounts.mergedOrders}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={filters.showMultipleItems}
                  onChange={(e) => handleFilterChange({ ...filters, showMultipleItems: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 flex-1">Multiple Items Orders</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                  {filterCounts.multipleItems}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={filters.showSingleItems}
                  onChange={(e) => handleFilterChange({ ...filters, showSingleItems: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 flex-1">Single Item Orders</span>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full font-medium">
                  {filterCounts.singleItems}
                </span>
              </label>

              <div className="pt-2 border-t border-gray-200 mt-2 mb-2">
                <p className="text-xs font-semibold text-gray-600 mb-2 px-2">Problem Status</p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={filters.showWithProblems}
                  onChange={(e) => handleFilterChange({ ...filters, showWithProblems: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 flex-1">With Problems</span>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                  {filterCounts.withProblems}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={filters.showWithoutProblems}
                  onChange={(e) => handleFilterChange({ ...filters, showWithoutProblems: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 flex-1">Without Problems</span>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full font-medium">
                  {filterCounts.withoutProblems}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded ml-4">
                <input
                  type="checkbox"
                  checked={filters.showProblemsPending}
                  onChange={(e) => handleFilterChange({ ...filters, showProblemsPending: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 flex-1">Pending</span>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                  {filterCounts.pending}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded ml-4">
                <input
                  type="checkbox"
                  checked={filters.showProblemsInProgress}
                  onChange={(e) => handleFilterChange({ ...filters, showProblemsInProgress: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 flex-1">In Progress</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                  {filterCounts.inProgress}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded ml-4">
                <input
                  type="checkbox"
                  checked={filters.showProblemsEscalated}
                  onChange={(e) => handleFilterChange({ ...filters, showProblemsEscalated: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 flex-1">Escalated</span>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                  {filterCounts.escalated}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded ml-4">
                <input
                  type="checkbox"
                  checked={filters.showProblemsResolved}
                  onChange={(e) => handleFilterChange({ ...filters, showProblemsResolved: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 flex-1">Resolved</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                  {filterCounts.resolved}
                </span>
              </label>

              <div className="pt-2 border-t border-gray-200">
                <button
                  onClick={() => handleFilterChange(defaultFilters)}
                  className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors font-medium"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Filter className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium">No orders match the selected filters</p>
            <button
              onClick={() => handleFilterChange(defaultFilters)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredGroups.map((group, groupIndex) => {
          const isCurrentGroup = currentGroup === group;
          const isCompleted = group.completedItems === group.totalItems && group.totalItems > 0;
          
          return (
            <div 
              key={`${group.customerName}-${group.orderNumber}-${groupIndex}`} 
              className="border-b border-gray-100"
              data-group-index={groupIndex}
            >
              {/* Group Header - Clickable for single items or group selection */}
              <button
                onClick={() => {
                  // If single item, select it directly
                  if (group.items.length === 1) {
                    onOrderSelect(group.items[0]);
                  } else {
                    // If multiple items, select the first uncompleted item or first item
                    const nextItem = group.items.find(item => !item.completed) || group.items[0];
                    onOrderSelect(nextItem);
                  }
                }}
                className={`w-full text-left p-4 ${isCurrentGroup ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'} transition-colors`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{group.customerName}</p>
                      {isCurrentGroup && (
                        <ArrowRight className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    {group.isMergedOrder ? (
                      <p className="text-sm text-purple-600 font-medium">Orders #{group.orderNumbers!.join(', #')}</p>
                    ) : (
                      <p className="text-sm text-gray-500">Order #{group.orderNumber}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {group.isMergedOrder && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                          Merged Orders
                        </span>
                      )}
                      {group.isMultipleItems && !group.isMergedOrder && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                          Multiple Items
                        </span>
                      )}
                      <span className="text-sm text-gray-500">
                        {group.items.length} SKU{group.items.length !== 1 ? 's' : ''} • {group.totalItems} item{group.totalItems !== 1 ? 's' : ''}
                      </span>
                      {group.completedItems > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          {group.completedItems}/{group.totalItems} done
                        </span>
                      )}
                    </div>
                    {group.buyerPostcode && (
                      <p className="text-xs text-blue-600 mt-1">
                        📮 {group.buyerPostcode}
                      </p>
                    )}
                  </div>
                  
                  {isCompleted && (
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  )}
                </div>
              </button>

              {/* Individual Items (shown when this is the current group and has multiple items) */}
              {isCurrentGroup && group.items.length > 1 && (
                <div className="bg-blue-25 border-l-4 border-l-blue-500">
                  {group.items.map((item, itemIndex) => {
                    const isCurrentItem = currentOrder?.sku === item.sku && 
                                         currentOrder?.orderNumber === item.orderNumber &&
                                         currentOrder?.customerName === item.customerName;
                    
                    return (
                      <button
                        key={`${item.orderNumber}-${item.sku}-${itemIndex}`}
                        onClick={() => onOrderSelect(item)}
                        className={`w-full text-left px-6 py-3 border-b border-blue-100 hover:bg-blue-100 transition-colors ${
                          isCurrentItem ? 'bg-blue-100' : 'bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-3 w-3 text-blue-600" />
                            <div>
                              <p className="text-sm font-medium text-gray-800">{item.sku}</p>
                              <p className="text-xs text-gray-600">
                                Qty: {item.quantity} • Location: {item.location}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {isCurrentItem && (
                              <ArrowRight className="h-3 w-3 text-blue-600" />
                            )}
                            {item.completed && (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
        )}
      </div>
    </div>
  );
};