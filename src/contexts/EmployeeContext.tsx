import React, { createContext, useContext, useState, useCallback } from 'react';
import { Employee, EmployeeSession } from '../types/Employee';
import { googleSheetsService } from '../services/googleSheetsService';

interface EmployeeContextType {
  employees: Employee[];
  currentSession: EmployeeSession | null;
  lastSyncTime: Date | null;
  isLoading: boolean;
  error: string | null;
  loadEmployees: () => Promise<void>;
  login: (pin: string) => boolean;
  logout: () => void;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentSession, setCurrentSession] = useState<EmployeeSession | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const settings = await googleSheetsService.getSettings();
      if (!settings?.google_sheets_id) {
        throw new Error('Google Sheets not connected');
      }

      const fetchedEmployees = await googleSheetsService.fetchEmployees(settings.google_sheets_id);
      setEmployees(fetchedEmployees);
      setLastSyncTime(new Date());

      await googleSheetsService.saveSettings({
        last_employee_sync_time: new Date().toISOString(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load employees';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    (pin: string): boolean => {
      const employee = employees.find(emp => emp.pin === pin);
      if (employee) {
        setCurrentSession({
          employee,
          loginTime: new Date(),
        });
        return true;
      }
      return false;
    },
    [employees]
  );

  const logout = useCallback(() => {
    setCurrentSession(null);
  }, []);

  const value: EmployeeContextType = {
    employees,
    currentSession,
    lastSyncTime,
    isLoading,
    error,
    loadEmployees,
    login,
    logout,
  };

  return <EmployeeContext.Provider value={value}>{children}</EmployeeContext.Provider>;
};

export const useEmployee = (): EmployeeContextType => {
  const context = useContext(EmployeeContext);
  if (!context) {
    throw new Error('useEmployee must be used within an EmployeeProvider');
  }
  return context;
};
