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
  CalendarDays
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

  const totalIncome = transactions.filter(t => t.status === 'paid').reduce((acc, t) => acc + (t.amount || 0), 0) + 
                  financeRecords.filter(f => f.type === 'income').reduce((acc, f) => acc + (f.amount || 0), 0);
  
  const totalExpense = financeRecords.filter(f => f.type === 'expense').reduce((acc, f) => acc + (f.amount || 0), 0);
  const netProfit = totalIncome - totalExpense;

  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  };

  const chartData = getLast7Days().map(date => {
    const incomeOnDay = transactions
      .filter(t => t.status === 'paid' && (t.date?.toDate ? t.date.toDate().toISOString().split('T')[0] === date : new Date(t.date).toISOString().split('T')[0] === date))
      .reduce((acc, t) => acc + (t.amount || 0), 0) +
      financeRecords
      .filter(f => f.type === 'income' && (f.date?.toDate ? f.date.toDate().toISOString().split('T')[0] === date : new Date(f.date).toISOString().split('T')[0] === date))
      .reduce((acc, f) => acc + (f.amount || 0), 0);

    const expenseOnDay = financeRecords
      .filter(f => f.type === 'expense' && (f.date?.toDate ? f.date.toDate().toISOString().split('T')[0] === date : new Date(f.date).toISOString().split('T')[0] === date))
      .reduce((acc, f) => acc + (f.amount || 0), 0);

    return {
      name: new Date(date).toLocaleDateString(undefined, { weekday: 'short' }),
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

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-12">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 text-emerald-900">Financial Ledger</h1>
          <p className="text-sm text-gray-400">Comprehensive view of business cashflow</p>
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
            {activeTab === 'ledger' ? `${transactions.length + financeRecords.length} Records` : `${financeRecords.filter(f => f.isRecurring).length} Active Schedules`}
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
                  ...transactions.map(t => ({ ...t, source: 'transaction' })),
                  ...financeRecords.map(f => ({ ...f, source: 'finance' }))
                ].sort((a, b) => {
                  const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                  const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                  return dateB.getTime() - dateA.getTime();
                }).slice(0, 30).map((record: any) => {
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
