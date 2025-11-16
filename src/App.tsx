import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { HomeView } from './views/HomeView';
import { OrderPickView } from './views/OrderPickView';
import { OrderProblemsView } from './views/OrderProblemsView';
import { EmployeeProvider, useEmployee } from './contexts/EmployeeContext';
import { Home, AlertTriangle } from 'lucide-react';
import { ProblemNotificationBadge } from './components/ProblemNotificationBadge';
import { ResolutionNotificationBanner } from './components/ResolutionNotificationBanner';

type ActiveView = 'home' | 'orderPick' | 'orderProblems';

function AppContent() {
  const { currentSession } = useEmployee();
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [savedOrderPickState, setSavedOrderPickState] = useState<{
    currentOrderIndex: number;
    orders: any[];
    filters?: any;
  } | null>(null);

  const handleNavigateToOrderPick = () => {
    setActiveView('orderPick');
  };

  const handleNavigateToOrderProblems = (orderPickState?: { currentOrderIndex: number; orders: any[]; filters?: any }) => {
    if (orderPickState) {
      console.log('💾 Saving order pick state before navigation:', {
        ordersCount: orderPickState.orders.length,
        currentOrderIndex: orderPickState.currentOrderIndex,
        hasFilters: !!orderPickState.filters
      });
      setSavedOrderPickState(orderPickState);
    }
    setActiveView('orderProblems');
  };

  const handleNavigateToHome = () => {
    setActiveView('home');
  };

  const handleBackToOrders = () => {
    setActiveView('orderPick');
  };

  const navigationTabs = (
    <nav className="flex items-center space-x-1">
      <button
        onClick={handleNavigateToHome}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          activeView === 'home'
            ? 'bg-blue-100 text-blue-700 border border-blue-200'
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
        }`}
      >
        <Home className="h-4 w-4" />
        Home
      </button>

      {currentSession && (
        <>
          <button
            onClick={handleNavigateToOrderProblems}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === 'orderProblems'
                ? 'bg-red-100 text-red-700 border border-red-200'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Order Problems
          </button>
          <ProblemNotificationBadge
            employeeName={currentSession.employee.name}
            onNotificationClick={handleNavigateToOrderProblems}
          />
        </>
      )}
    </nav>
  );

  return (
    <Layout headerContent={navigationTabs}>
      {currentSession && (
        <ResolutionNotificationBanner employeeName={currentSession.employee.name} />
      )}
      {activeView === 'home' && (
        <HomeView onNavigateToOrderPick={handleNavigateToOrderPick} />
      )}
      {activeView === 'orderPick' && (
        <OrderPickView
          savedOrderPickState={savedOrderPickState}
          onNavigateToOrderProblems={handleNavigateToOrderProblems}
        />
      )}
      {activeView === 'orderProblems' && (
        <OrderProblemsView onBackToOrders={handleBackToOrders} />
      )}
    </Layout>
  );
}

function App() {
  return (
    <EmployeeProvider>
      <AppContent />
    </EmployeeProvider>
  );
}

export default App;