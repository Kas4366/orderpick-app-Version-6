export interface Employee {
  name: string;
  pin: string;
}

export interface EmployeeSession {
  employee: Employee;
  loginTime: Date;
}
