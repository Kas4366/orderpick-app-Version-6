import React, { useState, useEffect } from 'react';
import { LogIn, RefreshCw, AlertCircle } from 'lucide-react';
import { useEmployee } from '../contexts/EmployeeContext';

interface EmployeeLoginProps {
  onLoginSuccess: () => void;
}

export const EmployeeLogin: React.FC<EmployeeLoginProps> = ({ onLoginSuccess }) => {
  const { employees, login, loadEmployees, isLoading, error, lastSyncTime } = useEmployee();
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  useEffect(() => {
    if (employees.length === 0 && !isLoading && !error) {
      handleLoadEmployees();
    }
  }, []);

  const handleLoadEmployees = async () => {
    setIsLoadingEmployees(true);
    setLoginError(null);
    try {
      await loadEmployees();
    } catch (err) {
      setLoginError('Failed to load employees. Please check your Google Sheets connection.');
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!pin.trim()) {
      setLoginError('Please enter your PIN');
      return;
    }

    const success = login(pin.trim());
    if (success) {
      onLoginSuccess();
    } else {
      setLoginError('Invalid PIN. Please try again.');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <LogIn className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Login</h1>
          <p className="text-gray-600 mt-2">Enter your PIN to continue</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {loginError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{loginError}</p>
            </div>
          </div>
        )}

        {employees.length === 0 && !isLoadingEmployees && !error && (
          <div className="mb-6 text-center">
            <p className="text-gray-600 mb-4">No employees loaded yet</p>
            <button
              onClick={handleLoadEmployees}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Load Employees
            </button>
          </div>
        )}

        {employees.length > 0 && (
          <>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                  PIN
                </label>
                <input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg tracking-widest"
                  placeholder="Enter PIN"
                  autoFocus
                  disabled={isLoadingEmployees}
                />
              </div>

              <button
                type="submit"
                disabled={isLoadingEmployees}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoadingEmployees ? 'Loading...' : 'Login'}
              </button>
            </form>

            {lastSyncTime && (
              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500">
                  Employees synced: {lastSyncTime.toLocaleTimeString()}
                </p>
                <button
                  onClick={handleLoadEmployees}
                  disabled={isLoadingEmployees}
                  className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors disabled:text-gray-400"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingEmployees ? 'animate-spin' : ''}`} />
                  Refresh Employees
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
