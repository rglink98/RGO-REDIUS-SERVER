import React, { useState } from 'react';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  DollarSign, 
  BarChart3, 
  TrendingUp, 
  Wallet, 
  ChevronDown,
  Activity,
  Filter,
  Download,
  FileText,
  User,
  Home,
  Zap,
  Wifi,
  Cpu,
  Rocket,
  MoreVertical,
  RefreshCw,
  Clock,
  Trash2,
  CalendarDays,
  X
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line
} from 'recharts';
import { motion } from 'motion/react';
import { collection, addDoc, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Transaction, FinanceRecord } from './types';
import { cn } from './utils';

export function FinanceView({ 
  transactions, 
  financeRecords,
  hasPermission = () => true
}: { 
  transactions: Transaction[], 
  financeRecords: FinanceRecord[],
  hasPermission?: (module: string, action: 'read' | 'create' | 'edit' | 'delete') => boolean
}) {
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [financeData, setFinanceData] = useState({ 
    category: '', 
    amount: '', 
    description: '', 
    date: new Date().toISOString().split('T')[0],
    isRecurring: false,
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly'
  });
  const [activeTab, setActiveTab] = useState<'ledger' | 'recurring'>('ledger');
  const [loading, setLoading] = useState(false);

  // Month filtering state
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const getRecordMonthKey = (record: any) => {
    try {
      if (!record || !record.date) return '';
      const d = record.date?.toDate ? record.date.toDate() : new Date(record.date);
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`; // e.g. "2026-06"
    } catch {
      return '';
    }
  };

  const translateDigitsToBengali = (num: string | number) => {
    const eng = ['0','1','2','3','4','5','6','7','8','9'];
    const ben = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(num).split('').map(char => {
      const idx = eng.indexOf(char);
      return idx !== -1 ? ben[idx] : char;
    }).join('');
  };

  const getAvailableMonths = () => {
    const monthsSet = new Set<string>();
    
    // Add current month by default so it's always accessible
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentMonthKey);

    transactions.forEach(t => {
      const key = getRecordMonthKey(t);
      if (key) monthsSet.add(key);
    });

    financeRecords.forEach(f => {
      const key = getRecordMonthKey(f);
      if (key) monthsSet.add(key);
    });

    return Array.from(monthsSet).sort().reverse(); // Sort descending
  };

  const formatMonthLabel = (monthKey: string) => {
    if (monthKey === 'all') return 'সকল সময় (All Time)';
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const englishLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const bengaliMonthNames = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const bengaliLabel = `${bengaliMonthNames[parseInt(month) - 1]} ${translateDigitsToBengali(year)}`;
    return `${bengaliLabel} (${englishLabel})`;
  };

  const getDaysInMonthList = (monthKey: string) => {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1; // 0-indexed
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date).toISOString().split('T')[0]);
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  // Filter transactions and finance records by selected month path
  const monthFilteredTransactions = transactions.filter(t => {
    if (selectedMonth === 'all') return true;
    return getRecordMonthKey(t) === selectedMonth;
  });

  const monthFilteredFinanceRecords = financeRecords.filter(f => {
    if (selectedMonth === 'all') return true;
    return getRecordMonthKey(f) === selectedMonth;
  });

  const totalIncome = monthFilteredTransactions.filter(t => t.status === 'paid').reduce((acc, t) => acc + (t.amount || 0), 0) + 
                  monthFilteredFinanceRecords.filter(f => f.type === 'income').reduce((acc, f) => acc + (f.amount || 0), 0);
  
  const totalExpense = monthFilteredFinanceRecords.filter(f => f.type === 'expense').reduce((acc, f) => acc + (f.amount || 0), 0);
  const netProfit = totalIncome - totalExpense;

  const getChartDays = () => {
    if (selectedMonth === 'all') {
      const days = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
      }
      return days;
    } else {
      return getDaysInMonthList(selectedMonth);
    }
  };

  const chartDays = getChartDays();
  const chartData = chartDays.map(date => {
    const incomeOnDay = transactions
      .filter(t => t.status === 'paid' && (t.date?.toDate ? t.date.toDate().toISOString().split('T')[0] === date : new Date(t.date).toISOString().split('T')[0] === date))
      .reduce((acc, t) => acc + (t.amount || 0), 0) +
      financeRecords
      .filter(f => f.type === 'income' && (f.date?.toDate ? f.date.toDate().toISOString().split('T')[0] === date : new Date(f.date).toISOString().split('T')[0] === date))
      .reduce((acc, f) => acc + (f.amount || 0), 0);

    const expenseOnDay = financeRecords
      .filter(f => f.type === 'expense' && (f.date?.toDate ? f.date.toDate().toISOString().split('T')[0] === date : new Date(f.date).toISOString().split('T')[0] === date))
      .reduce((acc, f) => acc + (f.amount || 0), 0);

    const dayName = selectedMonth === 'all' 
      ? new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : new Date(date).getDate();

    return {
      name: String(dayName),
      income: incomeOnDay,
      expense: expenseOnDay,
      profit: incomeOnDay - expenseOnDay
    };
  });

  const [customCategory, setCustomCategory] = useState('');

  const expenseCategories = ['Salary', 'Rent', 'Electricity', 'Internet Bandwidth', 'Equipment', 'Marketing', 'Office Supplies', 'Utilities', 'Taxes', 'Others'];
  const incomeCategories = ['Connection Fee', 'Equipment Sale', 'Maintenance Fee', 'Strategic Partnership', 'Misc Service', 'Others'];

  const calculateNextDueDate = (date: string, frequency: string) => {
    const d = new Date(date);
    if (frequency === 'daily') d.setDate(d.getDate() + 1);
    else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
    return Timestamp.fromDate(d);
  };

  const handleAddRecord = async (e: React.FormEvent, type: 'income' | 'expense') => {
    e.preventDefault();
    setLoading(true);
    try {
      const finalCategory = (financeData.category === 'Others' || !financeData.category) && customCategory ? customCategory : (financeData.category || 'General');
      
      const recordData: any = {
        ...financeData,
        category: finalCategory,
        type,
        amount: Number(financeData.amount),
        date: Timestamp.fromDate(new Date(financeData.date))
      };

      if (financeData.isRecurring) {
        recordData.nextDueDate = calculateNextDueDate(financeData.date, financeData.frequency);
      }
      
      await addDoc(collection(db, 'finance'), recordData);

      setShowAddExpense(false);
      setShowAddIncome(false);
      setFinanceData({ 
        category: '', 
        amount: '', 
        description: '', 
        date: new Date().toISOString().split('T')[0],
        isRecurring: false,
        frequency: 'monthly'
      });
      setCustomCategory('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await deleteDoc(doc(db, 'finance', id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getRecordDateString = (record: any) => {
    try {
      const d = record.date?.toDate ? record.date.toDate() : new Date(record.date);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toISOString().split('T')[0];
    } catch {
      return 'N/A';
    }
  };

  const getGroupedDailyInvoices = () => {
    const allRecords = [
      ...monthFilteredTransactions.map(t => ({ ...t, source: 'transaction', type: 'income' })),
      ...monthFilteredFinanceRecords.map(f => ({ ...f, source: 'finance' }))
    ];

    const groupedByDate: Record<string, any[]> = {};
    allRecords.forEach(record => {
      const dateStr = getRecordDateString(record);
      if (dateStr === 'N/A') return;
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = [];
      }
      groupedByDate[dateStr].push(record);
    });

    return Object.keys(groupedByDate).map(dateStr => {
      const records = groupedByDate[dateStr];
      const income = records
        .filter(r => r.type === 'income' || r.status === 'paid')
        .reduce((sum, r) => sum + (r.amount || 0), 0);
      const expense = records
        .filter(r => r.type === 'expense')
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      return {
        dateStr,
        records,
        income,
        expense,
        profit: income - expense,
        invoiceNo: `INV-${dateStr.replace(/-/g, '')}`
      };
    }).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  };

  const dailyInvoices = getGroupedDailyInvoices();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-12">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1 text-emerald-900">Financial Ledger</h1>
            <p className="text-sm text-gray-400">Comprehensive view of business cashflow</p>
          </div>

          {/* Month Selector Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 transition-colors px-4 py-2.5 rounded-2xl border border-gray-150 relative">
            <CalendarDays className="text-emerald-600 w-5 h-5" />
            <select
              id="selected-month-filter"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-sm text-gray-700 cursor-pointer pr-1"
            >
              <option value="all">সকল সময় (All Time)</option>
              {getAvailableMonths().map(monthKey => (
                <option key={monthKey} value={monthKey}>
                  {formatMonthLabel(monthKey)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          {hasPermission('Finance', 'create') && (
            <button 
              onClick={() => {
                setFinanceData({ 
                  category: '', 
                  amount: '', 
                  description: '', 
                  date: new Date().toISOString().split('T')[0],
                  isRecurring: false,
                  frequency: 'monthly'
                });
                setShowAddIncome(true);
              }}
              className="bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg active:scale-95"
            >
              <ArrowUpCircle size={18} /> Record Income
            </button>
          )}
          {hasPermission('Finance', 'create') && (
            <button 
              onClick={() => {
                setFinanceData({ 
                  category: '', 
                  amount: '', 
                  description: '', 
                  date: new Date().toISOString().split('T')[0],
                  isRecurring: false,
                  frequency: 'monthly'
                });
                setShowAddExpense(true);
              }}
              className="bg-red-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-600 transition-all shadow-lg active:scale-95"
            >
              <ArrowDownCircle size={18} /> Record Expense
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
            <DollarSign size={120} className="text-emerald-500" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-5">
              <DollarSign size={24} />
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Total Revenue</p>
            <h3 className="text-3xl font-black text-gray-900">৳{totalIncome.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
            <Wallet size={120} className="text-red-500" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-5">
              <Wallet size={24} />
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Total Expenses</p>
            <h3 className="text-3xl font-black text-gray-900">৳{totalExpense.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
            <TrendingUp size={120} className="text-indigo-500" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-5">
              <BarChart3 size={24} />
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Net Profit</p>
            <h3 className="text-3xl font-black text-indigo-900">৳{netProfit.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 min-h-[400px]">
          <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-500" /> Income vs Expense
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25} />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 min-h-[400px]">
          <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-500" /> Profitability Trend
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('ledger')}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'ledger' ? "bg-[#002d2d] text-white shadow-md" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              <FileText size={18} /> Detailed Ledger
            </button>
            <button 
              onClick={() => setActiveTab('recurring')}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'recurring' ? "bg-[#002d2d] text-white shadow-md" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              <RefreshCw size={18} /> Recurring Entries
            </button>
          </div>
          <p className="text-xs font-bold text-gray-400 mr-4">
            {activeTab === 'ledger' ? `${monthFilteredTransactions.length + monthFilteredFinanceRecords.length} Records` : `${financeRecords.filter(f => f.isRecurring).length} Active Schedules`}
          </p>
        </div>

        {activeTab === 'ledger' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Transaction Info</th>
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Category</th>
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ...monthFilteredTransactions.map(t => ({ ...t, source: 'transaction' })),
                  ...monthFilteredFinanceRecords.map(f => ({ ...f, source: 'finance' }))
                ].sort((a, b) => {
                  const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                  const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                  return dateB.getTime() - dateA.getTime();
                }).map((record: any) => {
                  const isIncome = record.status === 'paid' || record.type === 'income';
                  return (
                    <tr key={record.id} className="hover:bg-gray-50/30 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                              {record.source === 'transaction' ? `Payment from ${record.customerName || 'Customer'}` : record.description}
                              {record.isRecurring && <RefreshCw size={12} className="text-indigo-400" />}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {record.date?.toDate ? record.date.toDate().toLocaleString() : new Date(record.date).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-xs font-bold text-gray-400">
                        {record.category || 'Subscription Balance'}
                      </td>
                      <td className="px-6 py-5">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                          isIncome ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                        )}>
                          {isIncome ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
                          {isIncome ? 'Income' : 'Expense'}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className={cn("font-black text-sm", isIncome ? "text-emerald-600" : "text-red-500")}>
                          {isIncome ? '+' : '-'} ৳{record.amount?.toLocaleString()}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                         {record.source === 'finance' && hasPermission('Finance', 'delete') && (
                           <button 
                            onClick={() => handleDeleteRecord(record.id)}
                            className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                           >
                              <Trash2 size={16} />
                           </button>
                         )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Record Name</th>
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Schedule</th>
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Next Due</th>
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {financeRecords.filter(f => f.isRecurring).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-gray-400">
                       <Clock size={48} className="mx-auto mb-4 opacity-20" />
                       <p>No recurring schedules configured</p>
                    </td>
                  </tr>
                ) : (
                  financeRecords.filter(f => f.isRecurring).map((record) => {
                    const isIncome = record.type === 'income';
                    return (
                      <tr key={record.id} className="hover:bg-gray-50/30 transition-colors group">
                        <td className="px-6 py-5">
                          <p className="font-bold text-gray-900 text-sm">{record.description}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{record.category}</p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                             <RefreshCw size={14} className="text-indigo-400" />
                             <span className="text-xs font-bold text-gray-600 capitalize">{record.frequency}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                             <CalendarDays size={14} className="text-gray-400" />
                             <span className="text-xs text-gray-700">
                               {record.nextDueDate?.toDate ? record.nextDueDate.toDate().toLocaleDateString() : 'N/A'}
                             </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <p className={cn("font-black text-sm", isIncome ? "text-emerald-600" : "text-red-500")}>
                            ৳{record.amount?.toLocaleString()}
                          </p>
                        </td>
                        <td className="px-6 py-5 text-right">
                           {hasPermission('Finance', 'delete') && (
                             <button 
                              onClick={() => handleDeleteRecord(record.id!)}
                              className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                             >
                                <Trash2 size={16} />
                             </button>
                           )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daily Joint Invoices Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-emerald-500" />
            দৈনিক সম্মিলিত ইনভয়েস সিস্টেম (Daily Joint Invoices)
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            প্রতিটি দিনের সকল লেনদেন একত্রিত করে একটি ইনভয়েস জেনারেট করা হয়েছে
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dailyInvoices.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-400 border border-dashed border-gray-200 rounded-2xl">
              কোন দৈনিক লেনদেন পাওয়া যায়নি।
            </div>
          ) : (
            dailyInvoices.slice(0, 9).map((invoice) => (
              <div 
                key={invoice.dateStr}
                className="p-5 border border-gray-100 bg-gray-50/50 rounded-2xl hover:bg-white hover:border-emerald-100 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-black text-[#002d2d] bg-emerald-50 px-2 py-1 rounded">
                      {invoice.invoiceNo}
                    </span>
                    <span className="text-xs text-gray-400 font-bold">
                      {new Date(invoice.dateStr).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  
                  <div className="space-y-2 my-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 font-bold">মোট আয়:</span>
                      <span className="text-emerald-600 font-bold">৳{invoice.income.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 font-bold">মোট ব্যয়:</span>
                      <span className="text-red-500 font-bold">৳{invoice.expense.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-dashed border-gray-200 pt-2 flex justify-between text-xs">
                      <span className="text-gray-900 font-bold">নিট লাভ:</span>
                      <span className={cn(
                        "font-extrabold text-sm",
                        invoice.profit >= 0 ? "text-indigo-600" : "text-red-600"
                      )}>
                        ৳{invoice.profit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedInvoice(invoice)}
                  className="mt-2 w-full py-2.5 bg-[#002d2d] hover:bg-[#003d3d] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <FileText size={14} /> ইনভয়েস দেখুন (View Invoice)
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #daily-invoice-sheet, #daily-invoice-sheet * {
            visibility: visible;
          }
          #daily-invoice-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Daily Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-8"
          >
            {/* Modal Header */}
            <div className="p-6 bg-[#002d2d] text-white flex justify-between items-center no-print">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-emerald-400" />
                <h3 className="font-bold text-lg">দৈনিক সম্মিলিত ইনভয়েস</h3>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)} 
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Printable Invoice Sheet */}
            <div id="daily-invoice-sheet" className="p-8 space-y-6 bg-white text-gray-800">
              {/* Invoice top branding */}
              <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                <div>
                  <h1 className="text-3xl font-black text-gray-900 tracking-tighter">ISP RADIAL</h1>
                  <p className="text-xs text-gray-400 font-bold mt-1">INTERNET SERVICE PROVIDER SYSTEM</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Daily Transaction Reconciliation Summary</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg inline-block uppercase tracking-wider mb-2">
                    {selectedInvoice.invoiceNo}
                  </div>
                  <p className="text-xs font-bold text-gray-400">তারিখ / DATE:</p>
                  <p className="text-sm font-black text-gray-900">
                    {new Date(selectedInvoice.dateStr).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Financial summary breakdown widget */}
              <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="text-center p-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">মোট আয় (INFLOW)</p>
                  <p className="text-lg font-extrabold text-emerald-600 mt-1">৳{selectedInvoice.income.toLocaleString()}</p>
                </div>
                <div className="text-center p-2 border-x border-gray-200">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">মোট ব্যয় (OUTFLOW)</p>
                  <p className="text-lg font-extrabold text-red-500 mt-1">৳{selectedInvoice.expense.toLocaleString()}</p>
                </div>
                <div className="text-center p-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">নিট লাভ (SURPLUS)</p>
                  <p className={cn(
                    "text-lg font-extrabold mt-1",
                    selectedInvoice.profit >= 0 ? "text-indigo-600" : "text-red-500"
                  )}>
                    ৳{selectedInvoice.profit.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Details transactions list table */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-2">
                  লেনদেনের বিবরণী / DAILY TRANSACTIONS DETAIL
                </h4>
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                        <th className="p-3 font-bold">বিবরণ / ITEM DESCRIPTION</th>
                        <th className="p-3 font-bold">ক্যাটাগরি / CATEGORY</th>
                        <th className="p-3 font-bold text-center">টাইপ / TYPE</th>
                        <th className="p-3 font-bold text-right">পরিমাণ / AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedInvoice.records.map((rec: any, idx: number) => {
                        const isInc = rec.type === 'income' || rec.status === 'paid';
                        return (
                          <tr key={rec.id || idx} className="hover:bg-gray-50/50">
                            <td className="p-3">
                              <p className="font-bold text-gray-800">
                                {rec.source === 'transaction' ? `Payment from ${rec.customerName || 'Customer'}` : rec.description}
                              </p>
                              {rec.source === 'transaction' && rec.customerId && (
                                <p className="text-[9px] text-gray-400">Client ID: {rec.customerId}</p>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="text-gray-500 font-semibold text-[11px]">
                                {rec.category || 'Subscription Balance'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className={cn(
                                "inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase",
                                isInc ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                              )}>
                                {isInc ? 'আয় (IN)' : 'ব্যয় (OUT)'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <span className={cn(
                                "font-bold",
                                isInc ? "text-emerald-600" : "text-red-500"
                              )}>
                                ৳{rec.amount?.toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Invoice footer terms */}
              <div className="border-t border-gray-100 pt-6 flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-gray-400">Generated automatically by system on {new Date().toLocaleDateString()}</p>
                  <p className="text-[11px] text-[#002d2d] font-bold mt-1">ISP RADIAL - Connecting Your World</p>
                </div>
                <div className="text-right w-36 border-t border-gray-300 pt-1 text-[10px] font-bold text-gray-400">
                  কর্তৃপক্ষের স্বাক্ষর / Authorized Sign
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end no-print">
              <button 
                type="button" 
                onClick={() => setSelectedInvoice(null)} 
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-colors text-xs"
              >
                বন্ধ করুন / Close
              </button>
              <button 
                type="button" 
                onClick={() => window.print()} 
                className="px-5 py-2.5 bg-[#002d2d] hover:bg-[#003d3d] text-white rounded-xl font-bold shadow-md transition-colors text-xs flex items-center gap-1.5"
              >
                <Download size={14} /> মুদ্রণ / Print Report
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 bg-red-500 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg">Record Expense</h3>
              <button onClick={() => setShowAddExpense(false)} className="p-1 hover:bg-white/20 rounded-lg">
                <ChevronDown size={24} className="rotate-90" />
              </button>
            </div>
            <form onSubmit={(e) => handleAddRecord(e, 'expense')} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Category</label>
                <select required value={financeData.category} onChange={e => setFinanceData({...financeData, category: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none">
                  <option value="">Select Category</option>
                  {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {financeData.category === 'Others' && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Custom Category Name</label>
                  <input 
                    required 
                    value={customCategory} 
                    onChange={e => setCustomCategory(e.target.value)} 
                    placeholder="Enter category name..." 
                    className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Amount (৳)</label>
                <input type="number" required value={financeData.amount} onChange={e => setFinanceData({...financeData, amount: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                <input required value={financeData.description} onChange={e => setFinanceData({...financeData, description: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
                <input type="date" required value={financeData.date} onChange={e => setFinanceData({...financeData, date: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" />
              </div>
              
              <div className="pt-2 border-t border-gray-50">
                <label className="flex items-center gap-3 cursor-pointer group">
                   <div className={cn(
                     "w-10 h-6 rounded-full transition-all relative",
                     financeData.isRecurring ? "bg-red-500" : "bg-gray-200"
                   )}>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={financeData.isRecurring} 
                        onChange={e => setFinanceData({...financeData, isRecurring: e.target.checked})}
                      />
                      <div className={cn(
                        "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-all",
                        financeData.isRecurring ? "translate-x-4" : ""
                      )} />
                   </div>
                   <span className="text-sm font-bold text-gray-700">Set as Recurring Expense</span>
                </label>
              </div>

              {financeData.isRecurring && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Repeat Every</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['daily', 'weekly', 'monthly', 'yearly'].map((freq) => (
                      <button 
                        key={freq}
                        type="button"
                        onClick={() => setFinanceData({...financeData, frequency: freq as any})}
                        className={cn(
                          "py-2 rounded-lg text-xs font-bold border transition-all",
                          financeData.frequency === freq ? "bg-red-50 border-red-200 text-red-600" : "bg-white border-gray-100 text-gray-400"
                        )}
                      >
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddExpense(false)} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-3.5 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-100">Record</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showAddIncome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 bg-emerald-500 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg">Record Misc Income</h3>
              <button onClick={() => setShowAddIncome(false)} className="p-1 hover:bg-white/20 rounded-lg">
                <ChevronDown size={24} className="rotate-90" />
              </button>
            </div>
            <form onSubmit={(e) => handleAddRecord(e, 'income')} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Income Source / Category</label>
                <select required value={financeData.category} onChange={e => setFinanceData({...financeData, category: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none">
                  <option value="">Select Category</option>
                  {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {financeData.category === 'Others' && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Custom Income Category</label>
                  <input 
                    required 
                    value={customCategory} 
                    onChange={e => setCustomCategory(e.target.value)} 
                    placeholder="e.g. Donation, Refund, Sale" 
                    className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Amount (৳)</label>
                <input type="number" required value={financeData.amount} onChange={e => setFinanceData({...financeData, amount: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                <input required value={financeData.description} onChange={e => setFinanceData({...financeData, description: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
                <input type="date" required value={financeData.date} onChange={e => setFinanceData({...financeData, date: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" />
              </div>

              <div className="pt-2 border-t border-gray-50">
                <label className="flex items-center gap-3 cursor-pointer group">
                   <div className={cn(
                     "w-10 h-6 rounded-full transition-all relative",
                     financeData.isRecurring ? "bg-emerald-500" : "bg-gray-200"
                   )}>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={financeData.isRecurring} 
                        onChange={e => setFinanceData({...financeData, isRecurring: e.target.checked})}
                      />
                      <div className={cn(
                        "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-all",
                        financeData.isRecurring ? "translate-x-4" : ""
                      )} />
                   </div>
                   <span className="text-sm font-bold text-gray-700">Set as Recurring Income</span>
                </label>
              </div>

              {financeData.isRecurring && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Repeat Every</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['daily', 'weekly', 'monthly', 'yearly'].map((freq) => (
                      <button 
                        key={freq}
                        type="button"
                        onClick={() => setFinanceData({...financeData, frequency: freq as any})}
                        className={cn(
                          "py-2 rounded-lg text-xs font-bold border transition-all",
                          financeData.frequency === freq ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-gray-100 text-gray-400"
                        )}
                      >
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddIncome(false)} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-3.5 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-100">Record</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
