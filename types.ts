/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Customer {
  id?: string;
  name: string;
  username: string;
  password?: string;
  phone: string;
  address: string;
  flatNo?: string;
  area?: string;
  status: 'active' | 'expired' | 'disabled' | 'suspended';
  packageId: string;
  packageName?: string;
  monthlyBill?: number;
  expiryDate?: string;
  createdAt?: any;
  updatedAt?: any;
  macAddress?: string;
  ipAddress?: string;
  registrationDate?: string;
  alternateNumber?: string;
}

export interface Package {
  id?: string;
  name: string;
  speed: string;
  price: number;
  description?: string;
  isPopular?: boolean;
}

export interface Transaction {
  id?: string;
  customerId: string;
  customerName?: string;
  amount: number;
  type: 'recharge' | 'monthly_bill' | 'activation' | 'other';
  method: string;
  date: any;
  status: 'paid' | 'pending' | 'overdue';
}

export interface FinanceRecord {
  id?: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: any;
  description?: string;
  isRecurring?: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDueDate?: any;
}

export type OperationType = 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}
