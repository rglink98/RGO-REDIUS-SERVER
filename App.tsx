import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Package as PackageIcon, 
  CreditCard, 
  TrendingUp, 
  Settings as SettingsIcon,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  MoreVertical,
  Activity,
  UserX,
  UserPlus,
  Pencil,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  Eye,
  MapPin,
  Phone,
  User,
  Zap,
  Rocket,
  Wifi,
  Globe,
  Cpu,
  ChevronDown,
  ShieldAlert,
  Trash2,
  Home,
  ChevronRight,
  Smartphone,
  Calendar,
  ShieldCheck,
  Lock,
  BarChart3,
  PieChart,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  FileText,
  Wallet,
  Filter,
  Upload,
  X,
  Star,
  Copy,
  ExternalLink
} from 'lucide-react';
import Papa from 'papaparse';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  Legend, 
  Cell, 
  PieChart as RePieChart, 
  Pie 
} from 'recharts';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, orderBy, limit, where, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import { Customer, Package, Transaction, FinanceRecord } from './types';
import { cn } from './utils';
import { motion, AnimatePresence } from 'motion/react';

import { seedData } from './seed';
import { FinanceView } from './FinanceView';
import { sendSMSNotification } from './smsService';
import { SMSConfigPanel } from './SMSConfigPanel';
import { LogoConfigPanel } from './LogoConfigPanel';
import { getLogoConfig, DEFAULT_LOGO_CONFIG } from './logoService';
import { LogoConfig } from './types';


// Views
type View = 'dashboard' | 'create-user' | 'edit-user' | 'all-customers' | 'manage-client' | 'customer-profile' | 'single-recharge' | 'edit-recharge' | 'manage-recharge' | 'packages' | 'create-package' | 'edit-package' | 'finance' | 'settings' | 'role-control' | 'add-admin' | 'manage-admins';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({ customers: true, recharge: true, hr: true });
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedProfileCustomer, setSelectedProfileCustomer] = useState<Customer | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [adminInfo, setAdminInfo] = useState<any>(null);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Custom Login States
  const isCustomerPortalOnly = window.location.search.includes('portal=customer') || 
                               window.location.search.includes('type=customer') || 
                               window.location.search.includes('view=customer');

  const [loginTab, setLoginTab] = useState<'admin' | 'customer'>(() => {
    return isCustomerPortalOnly ? 'customer' : 'admin';
  });
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [branding, setBranding] = useState<LogoConfig>(DEFAULT_LOGO_CONFIG);

  const loadBranding = async () => {
    try {
      const conf = await getLogoConfig();
      setBranding(conf);
    } catch (err) {
      console.error("Failed to load branding settings", err);
    }
  };

  const toggleMenu = (menu: string) => {
    setExpandedMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  useEffect(() => {
    loadBranding();
    const handleBrandingUpdate = () => {
      loadBranding();
    };
    window.addEventListener('branding-updated', handleBrandingUpdate);
    return () => window.removeEventListener('branding-updated', handleBrandingUpdate);
  }, []);


  useEffect(() => {
    const savedSession = localStorage.getItem('isp_session');
    if (savedSession) {
      try {
        const parsedUser = JSON.parse(savedSession);
        if (parsedUser && parsedUser.isCustomAuth) {
          setUser(parsedUser);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Failed to parse saved session', err);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      setLoading(false);
      if (fbUser) seedData();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || user.role === 'customer') return;

    // Listen to customers
    const qCustomers = query(collection(db, 'customers'), orderBy('name'));
    const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
    });

    // Listen to packages
    const qPackages = query(collection(db, 'packages'), orderBy('price', 'desc'));
    const unsubPackages = onSnapshot(qPackages, (snapshot) => {
      setPackages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'packages');
    });

    // Listen to transactions
    const qTransactions = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(50));
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    // Listen to finance records (expenses/misc income)
    const qFinance = query(collection(db, 'finance'), orderBy('date', 'desc'), limit(100));
    const unsubFinance = onSnapshot(qFinance, (snapshot) => {
      setFinanceRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinanceRecord)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'finance');
    });

    // Listen to admin info
    const qAdmin = query(collection(db, 'admins'), where('email', '==', user.email));
    const unsubAdmin = onSnapshot(qAdmin, (snapshot) => {
      if (!snapshot.empty) {
        const adminData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        setAdminInfo(adminData);
        
        // Fetch role permissions
        if (adminData.roleId) {
          const roleDocRef = doc(db, 'roles', adminData.roleId);
          onSnapshot(roleDocRef, (roleSnap) => {
            if (roleSnap.exists()) {
              setPermissions(roleSnap.data().permissions || []);
            }
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `roles/${adminData.roleId}`);
          });
        }
      } else {
        setAdminInfo(null);
        setPermissions([]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'admins');
    });

    // Listen to roles
    const unsubRoles = onSnapshot(collection(db, 'roles'), (snapshot) => {
      setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'roles');
    });

    return () => {
      unsubCustomers();
      unsubPackages();
      unsubTransactions();
      unsubFinance();
      unsubAdmin();
      unsubRoles();
    };
  }, [user]);

  // Auto-repair module to fix customers with 0 monthlyBill from bulk import mismatch
  useEffect(() => {
    if (!customers || !packages || customers.length === 0 || packages.length === 0) return;
    
    const customersWithZeroBill = customers.filter(c => !c.monthlyBill || c.monthlyBill === 0);
    if (customersWithZeroBill.length === 0) return;

    const repairCustomers = async () => {
      // Process maximum 400 at a time to stay safe within batch limit
      const toRepair = customersWithZeroBill.slice(0, 400);
      const batch = writeBatch(db);
      let count = 0;

      for (const c of toRepair) {
        // Find matching package
        const pkg = packages.find(p => 
          p.id === c.packageId || 
          p.name.toLowerCase().replace(/[\s._-]+/g, '') === (c.packageName || '').toLowerCase().replace(/[\s._-]+/g, '')
        );
        const price = pkg?.price || 0;
        if (price > 0) {
          const docRef = doc(db, 'customers', c.id);
          batch.update(docRef, { monthlyBill: price, updatedAt: serverTimestamp() });
          count++;
        }
      }

      if (count > 0) {
        try {
          await batch.commit();
          console.log(`[Auto Repair] Successfully updated ${count} clients to matched package prices.`);
        } catch (e) {
          console.error('[Auto Repair] Failed to update client bills', e);
        }
      }
    };

    repairCustomers();
  }, [customers, packages]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleCustomLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('দয়া করে ইউজারনেম এবং পাসওয়ার্ড প্রদান করুন!');
      return;
    }
    setLoginError('');
    setLoginLoading(true);

    try {
      if (loginTab === 'admin') {
        const adminsRef = collection(db, 'admins');
        const qByUsername = query(adminsRef, where('username', '==', loginUsername.trim()));
        const snapByUsername = await getDocs(qByUsername);
        
        let foundAdminDoc = null;
        if (!snapByUsername.empty) {
          foundAdminDoc = snapByUsername.docs[0];
        } else {
          const qByEmail = query(adminsRef, where('email', '==', loginUsername.trim()));
          const snapByEmail = await getDocs(qByEmail);
          if (!snapByEmail.empty) {
            foundAdminDoc = snapByEmail.docs[0];
          }
        }

        if (foundAdminDoc) {
          const adminData = foundAdminDoc.data();
          if (adminData.password === loginPassword.trim()) {
            if (adminData.status === 'suspended') {
              setLoginError('দুঃখিত, আপনার অ্যাকাউন্টটি স্থগিত (Suspended) করা হয়েছে!');
              setLoginLoading(false);
              return;
            }
            const customUser = {
              uid: foundAdminDoc.id,
              displayName: adminData.name,
              email: adminData.email,
              isCustomAuth: true,
              role: 'admin',
              roleId: adminData.roleId,
              username: adminData.username,
              photoURL: null
            };
            localStorage.setItem('isp_session', JSON.stringify(customUser));
            setUser(customUser);
            setLoginPassword('');
            setLoginUsername('');
          } else {
            setLoginError('ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।');
          }
        } else {
          setLoginError('ইউজারনেম বা ইমেইল পাওয়া যায়নি!');
        }
      } else {
        const customersRef = collection(db, 'customers');
        const qByUsername = query(customersRef, where('username', '==', loginUsername.trim()));
        const snapByUsername = await getDocs(qByUsername);

        if (!snapByUsername.empty) {
          const customerDoc = snapByUsername.docs[0];
          const customerData = customerDoc.data();
          const expectedPassword = customerData.password || customerData.username || '123456';
          
          if (expectedPassword === loginPassword.trim()) {
            if (customerData.status === 'suspended' || customerData.status === 'disabled') {
              setLoginError('দুঃখিত, আপনার ইন্টারনেট সংযোগটি স্থগিত করা হয়েছে!');
              setLoginLoading(false);
              return;
            }
            const customUser = {
              uid: customerDoc.id,
              displayName: customerData.name,
              email: customerData.phone || '',
              isCustomAuth: true,
              role: 'customer',
              username: customerData.username,
              photoURL: null,
              customerId: customerDoc.id
            };
            localStorage.setItem('isp_session', JSON.stringify(customUser));
            setUser(customUser);
            setLoginPassword('');
            setLoginUsername('');
          } else {
            setLoginError('ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।');
          }
        } else {
          setLoginError('এই ইউজার আইডি (User ID) টি পাওয়া যায়নি!');
        }
      }
    } catch (err: any) {
      console.error(err);
      setLoginError('লগইন করতে ব্যর্থ হয়েছে: ' + err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isp_session');
    setUser(null);
    signOut(auth);
  };

  const hasPermission = (module: string, action: 'read' | 'create' | 'edit' | 'delete') => {
    if (user?.email === 'rglink98@gmail.com') return true;
    const perm = permissions.find(p => p.module.toLowerCase() === module.toLowerCase());
    if (!perm) return false;
    return perm[action];
  };

  const getRoleName = (id: string) => {
    const role = roles.find(r => r.id === id);
    return role ? role.name : 'Staff';
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#002d2d]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#001717] via-[#002d2d] to-[#001717] p-4 md:p-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full p-8 md:p-10 border border-gray-100 flex flex-col justify-between"
        >
          <div>
            {branding.useCustomLogo && branding.logoUrl ? (
              <div className="w-24 h-24 bg-white border border-gray-150 rounded-2xl flex items-center justify-center mx-auto mb-6 p-2 shadow-md">
                <img src={branding.logoUrl} alt="Company Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div className="w-20 h-20 bg-gradient-to-tr from-[#002d2d] to-emerald-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-950/20">
                <Activity className="text-emerald-400 w-10 h-10 animate-pulse" />
              </div>
            )}
            
            <h1 className="text-3xl font-black text-gray-900 text-center mb-1 tracking-tight uppercase truncate px-2">{branding.companyName || 'RGO ISP RESIUS'}</h1>
            <p className="text-gray-500 text-center text-sm mb-8">নিরাপদ ড্যাশবোর্ড ও সংযোগ নিয়ন্ত্রণ পোর্টাল</p>
            
            {/* Login Tab Selection */}
            {!isCustomerPortalOnly && (
              <div className="bg-gray-100 p-1.5 rounded-2xl flex items-center justify-between mb-6 border border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab('admin');
                    setLoginError('');
                  }}
                  className={cn(
                    "flex-1 py-3 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2",
                    loginTab === 'admin' 
                      ? "bg-[#002d2d] text-white shadow-md shadow-[#002d2d]/20 scale-[1.02]" 
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-200"
                  )}
                >
                  <ShieldCheck size={16} />
                  <span>স্টাফ/এডমিন লগইন</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab('customer');
                    setLoginError('');
                  }}
                  className={cn(
                    "flex-1 py-3 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2",
                    loginTab === 'customer' 
                      ? "bg-[#002d2d] text-white shadow-md shadow-[#002d2d]/20 scale-[1.02]" 
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-200"
                  )}
                >
                  <User size={16} />
                  <span>গ্রাহক/ইউজার লগইন</span>
                </button>
              </div>
            )}
            
            {isCustomerPortalOnly && (
              <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-2xl text-center text-xs font-bold leading-relaxed">
                🔐 কাস্টমার সেলফ-সার্ভিস পোর্টাল: অনুগ্রহ করে আপনার ইউজার আইডি এবং পাসওয়ার্ড দিয়ে লগইন করুন।
              </div>
            )}
            
            {loginError && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 text-red-700 p-4 rounded-xl text-xs md:text-sm font-bold mb-6 flex items-center gap-2 border border-red-100 text-left"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{loginError}</span>
              </motion.div>
            )}

            {/* Custom Login Form */}
            <form onSubmit={handleCustomLoginSubmit} className="space-y-4">
              <div className="text-left">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                  {loginTab === 'admin' ? 'ইউজারনেম বা ইমেইল (Username / Email)' : 'গ্রাহক আইডি (User ID / Username)'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder={loginTab === 'admin' ? 'Enter admin username or email' : 'e.g., rahim01'}
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-[#002d2d]/10 focus:bg-white transition-all text-gray-900 font-medium"
                  />
                </div>
              </div>

              <div className="text-left">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                  পাসওয়ার্ড (Password)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock size={18} />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-[#002d2d]/10 focus:bg-white transition-all text-gray-900 font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-[#002d2d] text-white py-4 rounded-2xl font-bold text-sm tracking-wide hover:bg-[#003d3d] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-[#002d2d]/10 mt-6 active:scale-[0.98]"
              >
                {loginLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span>প্রবেশ করুন (Secure Login)</span>
                    <Rocket size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Google Login as fallback for admin only */}
            {loginTab === 'admin' && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-gray-400 font-bold tracking-wider">অথবা গুগল দিয়ে লগইন</span>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={handleLogin}
                  className="w-full bg-white text-gray-700 border border-gray-200 py-3 rounded-2xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="google" />
                  <span>Google Account দিয়ে প্রবেশ</span>
                </button>
              </div>
            )}
          </div>
          
          <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black flex items-center justify-center gap-1">
              <ShieldAlert size={10} className="text-emerald-500" />
              <span>আইটি সহায়তা সেল: +৮৮০১৭০০০০০০০০</span>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (user && user.role === 'customer') {
    return <CustomerPortalView customerId={user.customerId} onLogout={handleLogout} />;
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden relative">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-[#002d2d] text-white flex flex-col shadow-2xl z-40 transition-transform duration-300 lg:relative lg:translate-x-0",
        !isSidebarOpen && "-translate-x-full"
      )}>
        <div className="p-8 flex items-center gap-4">
          {branding.useCustomLogo && branding.logoUrl ? (
            <div className="w-11 h-11 bg-white border border-[#002d2d]/20 rounded-xl flex items-center justify-center p-1 shrink-0 overflow-hidden">
              <img src={branding.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-400/20 rounded-xl border border-emerald-400/30 shrink-0">
              <Activity className="w-7 h-7 text-emerald-400" />
            </div>
          )}
          <h1 className="font-extrabold text-2xl tracking-tighter truncate">{branding.companyName || 'ISP RADIAL'}</h1>
        </div>

        <nav className="flex-1 overflow-y-auto px-6 py-6 space-y-1.5 custom-scrollbar">
          <NavItem 
            active={view === 'dashboard'} 
            onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }} 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
          />
          
          {/* Customers Menu */}
          {hasPermission('Customers', 'read') && (
            <div className="space-y-1">
              <button 
                onClick={() => toggleMenu('customers')}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all text-sm font-semibold"
              >
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-emerald-400/60" />
                  <span>Customers</span>
                </div>
                <ChevronDown size={16} className={cn("transition-transform duration-300", expandedMenus.customers && "rotate-180")} />
              </button>
              {expandedMenus.customers && (
                <div className="ml-4 space-y-1 border-l-2 border-white/5 pl-4 mt-1">
                  <SubNavItem active={view === 'create-user'} onClick={() => { setView('create-user'); setIsSidebarOpen(false); }} label="Create User" />
                  <SubNavItem active={view === 'all-customers'} onClick={() => { setView('all-customers'); setIsSidebarOpen(false); }} label="All Customers" />
                  <SubNavItem active={view === 'manage-client'} onClick={() => { setView('manage-client'); setIsSidebarOpen(false); }} label="Manage Client" />
                  <SubNavItem active={false} onClick={() => {}} label="Packages" onClickOverride={() => { setView('packages'); setIsSidebarOpen(false); }} />
                </div>
              )}
            </div>
          )}

          {/* Recharge Menu */}
          {hasPermission('Billing', 'read') && (
            <div className="space-y-1">
              <button 
                onClick={() => toggleMenu('recharge')}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all text-sm font-semibold"
              >
                <div className="flex items-center gap-3">
                  <CreditCard size={20} className="text-emerald-400/60" />
                  <span>Billing</span>
                </div>
                <ChevronDown size={16} className={cn("transition-transform duration-300", expandedMenus.recharge && "rotate-180")} />
              </button>
              {expandedMenus.recharge && (
                <div className="ml-4 space-y-1 border-l-2 border-white/5 pl-4 mt-1">
                  <SubNavItem active={view === 'single-recharge'} onClick={() => { setView('single-recharge'); setIsSidebarOpen(false); }} label="Quick Recharge" />
                  <SubNavItem active={view === 'manage-recharge'} onClick={() => { setView('manage-recharge'); setIsSidebarOpen(false); }} label="Recharge List" />
                </div>
              )}
            </div>
          )}

          {hasPermission('Finance', 'read') && (
            <NavItem 
              active={view === 'finance'} 
              onClick={() => { setView('finance'); setIsSidebarOpen(false); }} 
              icon={<TrendingUp size={20} />} 
              label="Finance" 
            />
          )}

          {hasPermission('Settings', 'read') && (
            <NavItem 
              active={view === 'settings'} 
              onClick={() => { setView('settings'); setIsSidebarOpen(false); }} 
              icon={<SettingsIcon size={20} />} 
              label="Settings" 
            />
          )}
        </nav>

        <div className="p-6 border-t border-white/5">
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl mb-4 border border-white/5">
            <img src={user.photoURL || 'https://ui-avatars.com/api/?name=Admin'} className="w-11 h-11 rounded-full border-2 border-emerald-400/30 object-cover" alt="avatar" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-white">{user.displayName || user.email}</p>
              <p className="text-[10px] text-emerald-400 font-black uppercase tracking-tighter">{adminInfo ? getRoleName(adminInfo.roleId) : 'System User'}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 p-4 text-xs font-bold text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all uppercase tracking-widest"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative flex flex-col bg-[#f8fafc]">
        {/* Top Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-xl z-20 px-4 lg:px-10 py-5 flex items-center justify-between border-b border-gray-100 shadow-sm shadow-black/5">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Plus size={24} />
            </button>
            <div>
              <h2 className="text-xl lg:text-2xl font-black text-gray-900 capitalize tracking-tight">{view.replace('-', ' ')}</h2>
              <div className="hidden md:flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                 <Home size={10} /> Home <ChevronRight size={10} /> {view.replace('-', ' ')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 lg:gap-6">
            <div className="hidden sm:relative sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Global Search..." 
                className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-[#002d2d]/5 transition-all w-48 xl:w-80"
              />
            </div>
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 animate-pulse">
              <Zap size={20} />
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-10 flex-1">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && <DashboardView key="dashboard" customers={customers} transactions={transactions} packages={packages} />}
            {view === 'all-customers' && (
              <CustomersView 
                key="all-customers"
                customers={customers} 
                packages={packages} 
                onCreateUser={() => {
                  setEditingCustomer(null);
                  setView('create-user');
                }}
                onEditUser={(customer) => {
                  setEditingCustomer(customer);
                  setView('edit-user');
                }}
                onViewProfile={(customer) => {
                  setSelectedProfileCustomer(customer);
                  setView('customer-profile');
                }}
              />
            )}
            {view === 'manage-client' && (
              <CustomersView 
                key="manage-client"
                customers={customers} 
                packages={packages} 
                onCreateUser={() => {
                  setEditingCustomer(null);
                  setView('create-user');
                }}
                onEditUser={(customer) => {
                  setEditingCustomer(customer);
                  setView('edit-user');
                }}
                onViewProfile={(customer) => {
                  setSelectedProfileCustomer(customer);
                  setView('customer-profile');
                }}
              />
            )}
            {view === 'customer-profile' && (
              <CustomerProfileView 
                key="customer-profile"
                customer={selectedProfileCustomer}
                transactions={transactions}
                packages={packages}
                onBack={() => setView('all-customers')}
              />
            )}
            {view === 'create-user' && <UserFormView key="create-user" packages={packages} onComplete={() => setView('all-customers')} />}
            {view === 'edit-user' && <UserFormView key="edit-user" packages={packages} initialData={editingCustomer} onComplete={() => setView('all-customers')} />}
            {view === 'single-recharge' && <SingleRechargeView key="single-recharge" customers={customers} packages={packages} onComplete={() => setView('manage-recharge')} />}
            {view === 'edit-recharge' && (
              <EditRechargeView 
                key="edit-recharge" 
                transaction={editingTransaction} 
                customers={customers} 
                onComplete={() => setView('manage-recharge')} 
              />
            )}
            {view === 'manage-recharge' && (
              <BillingView 
                key="manage-recharge" 
                transactions={transactions} 
                customers={customers} 
                onEdit={(tx) => {
                  setEditingTransaction(tx);
                  setView('edit-recharge');
                }}
              />
            )}
            {view === 'packages' && (
              <PackagesView 
                key="packages" 
                packages={packages} 
                onAdd={() => {
                  setEditingPackage(null);
                  setView('create-package');
                }}
                onEdit={(pkg) => {
                  setEditingPackage(pkg);
                  setView('edit-package');
                }}
              />
            )}
            {view === 'create-package' && <PackageFormView key="create-package" onComplete={() => setView('packages')} />}
            {view === 'edit-package' && <PackageFormView key="edit-package" initialData={editingPackage} onComplete={() => setView('packages')} />}
            {view === 'role-control' && <RoleControlView key="role-control" />}
            {view === 'add-admin' && <AdminFormView key="add-admin" onComplete={() => setView('manage-admins')} />}
            {view === 'manage-admins' && <AdminListView key="manage-admins" onAdd={() => setView('add-admin')} />}
            {view === 'finance' && <FinanceView key="finance" transactions={transactions} financeRecords={financeRecords} hasPermission={hasPermission} />}
            {view === 'settings' && <SettingsView key="settings" user={user} hasPermission={hasPermission} branding={branding} />}
            
            {!['dashboard', 'all-customers', 'manage-client', 'customer-profile', 'create-user', 'edit-user', 'single-recharge', 'edit-recharge', 'manage-recharge', 'packages', 'create-package', 'edit-package', 'settings', 'role-control', 'add-admin', 'manage-admins', 'finance'].includes(view) && (
              <div className="h-[60vh] flex flex-col items-center justify-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                <SettingsIcon size={48} className="mb-4 opacity-20" />
                <p>Module Under Development</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
        active 
          ? "bg-emerald-400 text-[#002d2d] shadow-lg shadow-emerald-400/20" 
          : "text-white/60 hover:text-white hover:bg-white/5"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SubNavItem({ active, onClick, label, disabled, onClickOverride }: { active: boolean; onClick: () => void; label: string; disabled?: boolean; onClickOverride?: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClickOverride || onClick}
      className={cn(
        "w-full text-left px-3 py-2 rounded-lg transition-all text-xs font-medium",
        active 
          ? "text-emerald-400 bg-white/5" 
          : "text-white/40 hover:text-white/70 hover:bg-white/5",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      {label}
    </button>
  );
}

// Sub-views
function DashboardView({ customers, transactions, packages }: { customers: Customer[]; transactions: Transaction[]; packages: Package[] }) {
  const monthlyExpected = customers.reduce((acc, c) => {
    let bill = c.monthlyBill || 0;
    if (bill === 0) {
      const pkg = packages.find(p => 
        p.id === c.packageId || 
        p.name.toLowerCase().replace(/[\s._-]+/g, '') === (c.packageName || '').toLowerCase().replace(/[\s._-]+/g, '')
      );
      bill = pkg?.price || 0;
    }
    return acc + bill;
  }, 0);
  const totalPaid = transactions.filter(tx => tx.status === 'paid').reduce((acc, tx) => acc + (tx.amount || 0), 0);
  const totalDue = Math.max(0, monthlyExpected - totalPaid);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCollection = transactions
    .filter(tx => {
      const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
      txDate.setHours(0, 0, 0, 0);
      return txDate.getTime() === today.getTime() && tx.status === 'paid';
    })
    .reduce((acc, tx) => acc + (tx.amount || 0), 0);

  const stats = [
    { label: 'Total Users', value: customers.length, icon: <Users />, color: 'bg-blue-500' },
    { label: 'Active Users', value: customers.filter(c => c.status === 'active').length, icon: <CheckCircle />, color: 'bg-emerald-500' },
    { label: 'Expired Users', value: customers.filter(c => c.status === 'expired').length, icon: <Clock />, color: 'bg-orange-500' },
    { label: 'Billing Users', value: new Set(transactions.map(tx => tx.customerId)).size, icon: <User />, color: 'bg-purple-500' },
  ];

  const chartData = [
    { name: 'Jan', amount: 305700 },
    { name: 'Feb', amount: 313000 },
    { name: 'Mar', amount: 327800 },
    { name: 'Apr', amount: 317200 },
    { name: 'May', amount: 262200 },
  ];

  const getTxDate = (tx: Transaction) => {
    if (!tx.date) return 'N/A';
    if (tx.date.toDate) return tx.date.toDate().toLocaleString();
    return new Date(tx.date).toLocaleString();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-shadow">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
              <h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3>
            </div>
            <div className={cn("p-4 rounded-2xl text-white shadow-lg", stat.color)}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-lg text-gray-900">Monthly Collection Status</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} barSize={40}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.name === 'May' ? '#10b981' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Stats sidebar */}
        <div className="space-y-6">
          <div className="bg-[#3b82f6] text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-white/80 text-sm font-medium mb-1">Monthly Expected</p>
              <h3 className="text-4xl font-bold">৳{monthlyExpected.toLocaleString()}</h3>
            </div>
            <CreditCard className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 rotate-12" />
          </div>
          <div className="bg-[#10b981] text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-white/80 text-sm font-medium mb-1">Total Paid</p>
              <h3 className="text-4xl font-bold">৳{totalPaid.toLocaleString()}</h3>
            </div>
            <CheckCircle className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 rotate-12" />
          </div>
          <div className="bg-[#ef4444] text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-white/80 text-sm font-medium mb-1">Total Due</p>
              <h3 className="text-4xl font-bold">৳{totalDue.toLocaleString()}</h3>
            </div>
            <AlertCircle className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 rotate-12" />
          </div>

          <div className="bg-[#6366f1] text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-white/80 text-sm font-medium mb-1">Today's Collection</p>
              <h3 className="text-4xl font-bold">৳{todayCollection.toLocaleString()}</h3>
            </div>
            <Zap className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 rotate-12" />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg text-gray-900">Recent Transactions</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {transactions.length > 0 ? transactions.slice(0, 5).map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-500">
                  <UserPlus size={18} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{tx.customerName || 'Customer'}</p>
                  <p className="text-xs text-gray-500">{getTxDate(tx)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">৳{tx.amount}</p>
                <p className={cn("text-[10px] font-bold uppercase", tx.status === 'paid' ? 'text-emerald-500' : 'text-orange-500')}>
                  {tx.status}
                </p>
              </div>
            </div>
          )) : (
            <p className="text-center py-10 text-gray-400 italic">No recent transactions</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function UserFormView({ packages, initialData, onComplete }: { packages: Package[]; initialData?: Customer | null; onComplete: () => void }) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    username: initialData?.username || '',
    password: initialData?.password || '',
    phone: initialData?.phone || '',
    address: initialData?.address || '',
    flatNo: initialData?.flatNo || '',
    area: initialData?.area || '',
    macAddress: initialData?.macAddress || '',
    ipAddress: initialData?.ipAddress || '',
    alternateNumber: initialData?.alternateNumber || '',
    registrationDate: initialData?.registrationDate || '',
    packageId: initialData?.packageId || '',
    status: (initialData?.status as any) || 'active',
    notes: initialData?.notes || ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length >= 6) strength += 1;
    if (/[A-Z]/.test(pass)) strength += 1;
    if (/[0-9]/.test(pass)) strength += 1;
    if (/[^A-Za-z0-9]/.test(pass)) strength += 1;
    return strength;
  };

  const validate = (data: typeof formData) => {
    const newErrors: Record<string, string> = {};
    if (!data.username.trim()) newErrors.username = 'User ID is required';
    else if (data.username.length < 3) newErrors.username = 'User ID must be at least 3 characters';
    
    if (!data.name.trim()) newErrors.name = 'Customer name is required';
    
    if (!initialData && !data.password) newErrors.password = 'Password is required for new users';
    else if (data.password && data.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    
    if (!data.phone.trim()) newErrors.phone = 'Phone number is required';
    else if (!/^01\d{9}$/.test(data.phone.trim())) newErrors.phone = 'Valid 11-digit mobile number required (01XXXXXXXXX)';
    
    if (!data.packageId) newErrors.packageId = 'Please select a package';
    
    return newErrors;
  };

  const handleChange = (field: string, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    if (touched[field]) {
      setErrors(validate(newData));
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setErrors(validate(formData));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setTouched({
        name: true,
        username: true,
        password: true,
        phone: true,
        packageId: true
      });
      return;
    }

    setLoading(true);
    try {
      const pkg = packages.find(p => p.id === formData.packageId);
      const payload = {
        ...formData,
        packageName: pkg?.name || 'Default',
        monthlyBill: pkg?.price || 0,
        updatedAt: Timestamp.now(),
      };

      if (initialData?.id) {
        await updateDoc(doc(db, 'customers', initialData.id), payload);
      } else {
        await addDoc(collection(db, 'customers'), {
          ...payload,
          createdAt: Timestamp.now(),
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });
      }
      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength(formData.password);
  const strengthColor = strength === 0 ? 'bg-gray-200' : strength === 1 ? 'bg-red-400' : strength === 2 ? 'bg-orange-400' : strength === 3 ? 'bg-yellow-400' : 'bg-emerald-400';
  const strengthLabel = strength === 0 ? '' : strength === 1 ? 'Weak' : strength === 2 ? 'Fair' : strength === 3 ? 'Good' : 'Strong';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{initialData ? 'Update Home User' : 'Register Home User'}</h1>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Home size={14} /> Home <ChevronRight size={14} /> <span className="text-blue-500">{initialData ? 'Update Home User' : 'Register Home User'}</span>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-50">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            {initialData ? <Pencil size={24} /> : <UserPlus size={24} />}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{initialData ? 'Update Customer Profile' : 'Create New Customer'}</h3>
            <p className="text-sm text-gray-400">{initialData ? `Editing: ${initialData.name}` : 'Register a new customer for ISP services'}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
            User ID/Username *
            {touched.username && errors.username && <span className="text-red-500 normal-case font-medium">{errors.username}</span>}
          </label>
          <input 
            value={formData.username}
            onChange={e => handleChange('username', e.target.value)}
            onBlur={() => handleBlur('username')}
            className={cn(
              "w-full p-3 bg-gray-50 rounded-xl border transition-all text-sm outline-none",
              touched.username && errors.username ? "border-red-300 focus:ring-red-500/10" : "border-gray-200 focus:ring-[#002d2d]/20"
            )}
            placeholder="e.g. ncr9_mihir"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
            Customer Name *
            {touched.name && errors.name && <span className="text-red-500 normal-case font-medium">{errors.name}</span>}
          </label>
          <input 
            value={formData.name}
            onChange={e => handleChange('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            className={cn(
              "w-full p-3 bg-gray-50 rounded-xl border transition-all text-sm outline-none",
              touched.name && errors.name ? "border-red-300 focus:ring-red-500/10" : "border-gray-200 focus:ring-[#002d2d]/20"
            )}
            placeholder="Full Name"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
            Password {initialData ? '' : '*'}
            {touched.password && errors.password && <span className="text-red-500 normal-case font-medium">{errors.password}</span>}
          </label>
          <input 
            type="password"
            value={formData.password}
            onChange={e => handleChange('password', e.target.value)}
            onBlur={() => handleBlur('password')}
            className={cn(
              "w-full p-3 bg-gray-50 rounded-xl border transition-all text-sm outline-none",
              touched.password && errors.password ? "border-red-300 focus:ring-red-500/10" : "border-gray-200 focus:ring-[#002d2d]/20"
            )}
            placeholder="Min 6 characters"
          />
          {formData.password && (
            <div className="pt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Strength: {strengthLabel}</span>
              </div>
              <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden flex gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <div 
                    key={step} 
                    className={cn(
                      "h-full flex-1 transition-all duration-500",
                      strength >= step ? strengthColor : "bg-gray-200"
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
            Mobile Number *
            {touched.phone && errors.phone && <span className="text-red-500 normal-case font-medium">{errors.phone}</span>}
          </label>
          <input 
            value={formData.phone}
            onChange={e => handleChange('phone', e.target.value)}
            onBlur={() => handleBlur('phone')}
            className={cn(
              "w-full p-3 bg-gray-50 rounded-xl border transition-all text-sm outline-none",
              touched.phone && errors.phone ? "border-red-300 focus:ring-red-500/10" : "border-gray-200 focus:ring-[#002d2d]/20"
            )}
            placeholder="017XXXXXXXX"
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Address</label>
          <textarea 
            rows={2} value={formData.address}
            onChange={e => handleChange('address', e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/20 transition-all text-sm resize-none"
            placeholder="Full physical address"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Flat No / House No</label>
          <input 
            value={formData.flatNo}
            onChange={e => handleChange('flatNo', e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/20 text-sm"
            placeholder="e.g. H-9 F-4 WEST"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Area</label>
          <input 
            value={formData.area}
            onChange={e => handleChange('area', e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/20 text-sm"
            placeholder="e.g. North Circuler Road"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Mac Address</label>
          <input 
            value={formData.macAddress}
            onChange={e => handleChange('macAddress', e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/20 text-sm"
            placeholder="98:BA:5F:XX:XX:XX"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">IP Address</label>
          <input 
            value={formData.ipAddress}
            onChange={e => handleChange('ipAddress', e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/20 text-sm"
            placeholder="10.10.XX.XX"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Alternate Number</label>
          <input 
            value={formData.alternateNumber}
            onChange={e => handleChange('alternateNumber', e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/20 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Registration Date</label>
          <input 
            type="date"
            value={formData.registrationDate}
            onChange={e => handleChange('registrationDate', e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/20 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
            Package Selection *
            {touched.packageId && errors.packageId && <span className="text-red-500 normal-case font-medium">{errors.packageId}</span>}
          </label>
          <select 
            value={formData.packageId}
            onChange={e => handleChange('packageId', e.target.value)}
            onBlur={() => handleBlur('packageId')}
            className={cn(
              "w-full p-3 bg-gray-50 rounded-xl border transition-all text-sm outline-none",
              touched.packageId && errors.packageId ? "border-red-300 focus:ring-red-500/10" : "border-gray-200 focus:ring-[#002d2d]/20"
            )}
          >
            <option value="">Select Package</option>
            {packages.map(pkg => (
              <option key={pkg.id} value={pkg.id}>{pkg.name} ({pkg.speed}) - ৳{pkg.price}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
          <select 
            value={formData.status}
            onChange={e => handleChange('status', e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/20 transition-all text-sm"
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Internal Notes</label>
          <textarea 
            rows={3} 
            value={formData.notes}
            onChange={e => handleChange('notes', e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/20 transition-all text-sm resize-none"
            placeholder="Add internal notes about payment habits, billing cycles, or support history..."
          />
        </div>
        
        <div className="md:col-span-2 flex justify-end gap-3 mt-4">
          <button type="button" onClick={onComplete} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all text-sm">Cancel</button>
          <button type="submit" disabled={loading} className="px-8 py-3 bg-[#002d2d] text-white rounded-xl font-bold hover:bg-[#003d3d] transition-all shadow-lg active:scale-95 disabled:opacity-50 text-sm">
            {loading ? (initialData ? 'Updating...' : 'Creating...') : (initialData ? 'Update User' : 'Register User')}
          </button>
        </div>
      </form>
      </div>
    </motion.div>
  );
}

function SingleRechargeView({ customers, packages, onComplete }: { customers: Customer[]; packages: Package[]; onComplete: () => void }) {
  const [formData, setFormData] = useState({
    customerId: '',
    amount: 0,
    method: 'Cash',
    discount: 0,
    remarks: '',
    rechargeDate: new Date().toISOString().split('T')[0]
  });
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Sync searchQuery when selectedCustomer updates
  useEffect(() => {
    if (selectedCustomer) {
      setSearchQuery(`${selectedCustomer.username} (${selectedCustomer.name})`);
    } else {
      setSearchQuery('');
    }
  }, [selectedCustomer]);

  useEffect(() => {
    const cust = customers.find(c => c.id === formData.customerId);
    if (cust) {
      setSelectedCustomer(cust);
      setFormData(prev => ({ ...prev, amount: cust.monthlyBill || packages.find(p => p.id === cust.packageId || p.name.toLowerCase().replace(/[\s._-]+/g, '') === (cust.packageName || '').toLowerCase().replace(/[\s._-]+/g, ''))?.price || 0 }));
    } else {
      setSelectedCustomer(null);
    }
  }, [formData.customerId, customers]);

  const validate = (data: typeof formData) => {
    const newErrors: Record<string, string> = {};
    if (!data.customerId) newErrors.customerId = 'Please select a customer';
    if (!data.amount || data.amount <= 0) newErrors.amount = 'Rent amount must be greater than 0';
    if (data.discount < 0) newErrors.discount = 'Discount cannot be negative';
    return newErrors;
  };

  const handleChange = (field: string, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    if (touched[field]) {
      setErrors(validate(newData));
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setErrors(validate(formData));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setTouched({ customerId: true, amount: true, discount: true });
      return;
    }

    if (!selectedCustomer) return;
    setLoading(true);
    try {
      const rDate = formData.rechargeDate ? new Date(formData.rechargeDate) : new Date();
      // Keep current hour, minute, second so chronological ordering remains perfect
      const now = new Date();
      rDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

      await addDoc(collection(db, 'transactions'), {
        customerId: selectedCustomer.username, // Using username as ID in table for consistency
        customerName: selectedCustomer.name,
        amount: Number(formData.amount) - Number(formData.discount),
        type: 'recharge',
        method: formData.method,
        date: Timestamp.fromDate(rDate),
        status: 'paid',
        recordedBy: 'Admin' // Should ideally be current user
      });
      // Update customer expiry date (add 30 days)
      const currentExpiry = selectedCustomer.expiryDate ? new Date(selectedCustomer.expiryDate) : new Date();
      const newExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
      await updateDoc(doc(db, 'customers', selectedCustomer.id!), {
        expiryDate: newExpiry.toISOString(),
        status: 'active',
        updatedAt: Timestamp.now()
      });

      // Send automatic payment receipt SMS notification
      try {
        const finalAmt = Number(formData.amount) - Number(formData.discount);
        const smsResult = await sendSMSNotification(selectedCustomer.username, finalAmt, formData.method);
        console.log("Automatic receipts SMS send result: ", smsResult);
      } catch (smsErr) {
        console.error("Failed to dispatch automated SMS receipt:", smsErr);
      }

      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.username || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto space-y-6 text-left"
    >
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Collection (Home User)</h1>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Home size={14} /> Home <ChevronRight size={14} /> <span className="text-blue-500">Collection (Home User)</span>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-50">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <CreditCard size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Create Private User Invoice</h3>
            <p className="text-sm text-gray-400">Process payment and extend subscription instantly</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-1 relative">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex justify-between">
                User ID / Username *
                {touched.customerId && errors.customerId && <span className="text-red-500 normal-case font-medium">{errors.customerId}</span>}
              </label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Type User ID, Name or Phone to search..."
                  value={searchQuery}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={e => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    setIsDropdownOpen(true);
                    if (formData.customerId) {
                      setFormData(prev => ({ ...prev, customerId: '' }));
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setIsDropdownOpen(false);
                      if (!formData.customerId) {
                        setSearchQuery('');
                      } else {
                        const activeCust = customers.find(c => c.id === formData.customerId);
                        if (activeCust) {
                          setSearchQuery(`${activeCust.username} (${activeCust.name})`);
                        }
                      }
                    }, 250);
                    handleBlur('customerId');
                  }}
                  className={cn(
                    "w-full p-3.5 bg-gray-50 rounded-xl border transition-all text-sm outline-none pr-10",
                    touched.customerId && errors.customerId ? "border-red-300 focus:ring-red-500/10" : "border-gray-100 focus:ring-blue-500/10"
                  )}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-450 pointer-events-none">
                  <Search size={16} />
                </span>
              </div>

              {isDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl divide-y divide-gray-50">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-3 text-xs text-gray-400 text-center">No customers found</div>
                  ) : (
                    filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => {
                          handleChange('customerId', c.id);
                          setSearchQuery(`${c.username} (${c.name})`);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-xs md:text-sm hover:bg-[#002d2d]/5 transition-all flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <span className="font-extrabold text-[#002d2d] block">{c.username}</span>
                          <span className="text-xs text-gray-550 block">{c.name}</span>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-[#002d2d] px-2.5 py-1 rounded-full font-bold">
                          {c.phone}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer Name</label>
              <input 
                readOnly 
                value={selectedCustomer?.name || ''}
                className="w-full p-3.5 bg-gray-100/50 rounded-xl border border-gray-100 text-sm text-gray-500 font-medium"
                placeholder="Auto-filled"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mobile Number</label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  readOnly 
                  value={selectedCustomer?.phone || ''}
                  className="w-full pl-10 pr-4 py-3.5 bg-gray-100/50 rounded-xl border border-gray-100 text-sm text-gray-500 font-medium"
                  placeholder="Auto-filled"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Expiry</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  readOnly 
                  value={selectedCustomer?.expiryDate ? new Date(selectedCustomer.expiryDate).toLocaleDateString('en-GB') : 'N/A'}
                  className="w-full pl-10 pr-4 py-3.5 bg-gray-100/50 rounded-xl border border-gray-100 text-sm text-gray-500 font-medium"
                  placeholder="Auto-filled"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 p-6 bg-gray-50/50 rounded-3xl border border-gray-100">
             <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase flex justify-between">
                Monthly Rent *
                {touched.amount && errors.amount && <span className="text-red-500 normal-case font-medium">{errors.amount}</span>}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">৳</span>
                <input 
                  type="number" 
                  value={formData.amount}
                  onChange={e => handleChange('amount', Number(e.target.value))}
                  onBlur={() => handleBlur('amount')}
                  className={cn(
                    "w-full pl-8 pr-4 py-3 bg-white rounded-xl border transition-all text-sm font-bold outline-none",
                    touched.amount && errors.amount ? "border-red-300 focus:ring-red-500/10" : "border-gray-200 focus:ring-emerald-500/10"
                  )}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Payment Method</label>
              <select 
                value={formData.method}
                onChange={e => handleChange('method', e.target.value)}
                className="w-full p-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/10 transition-all text-sm outline-none cursor-pointer"
              >
                <option value="Cash">Cash</option>
                <option value="Bkash">Bkash</option>
                <option value="Nagad">Nagad</option>
                <option value="Rocket">Rocket</option>
                <option value="Bank">Bank Transfer</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Recharge Date *</label>
              <input 
                type="date"
                value={formData.rechargeDate}
                onChange={e => handleChange('rechargeDate', e.target.value)}
                className="w-full p-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/10 transition-all text-sm outline-none font-bold text-gray-700"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase flex justify-between">
                Discount
                {touched.discount && errors.discount && <span className="text-red-500 normal-case font-medium">{errors.discount}</span>}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">৳</span>
                <input 
                  type="number" 
                  value={formData.discount}
                  onChange={e => handleChange('discount', Number(e.target.value))}
                  onBlur={() => handleBlur('discount')}
                  className={cn(
                    "w-full pl-8 pr-4 py-3 bg-white rounded-xl border transition-all text-sm outline-none",
                    touched.discount && errors.discount ? "border-red-300 focus:ring-red-500/10" : "border-gray-200 focus:ring-[#002d2d]/20"
                  )}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Grand Total</label>
              <div className="w-full p-3 bg-white rounded-xl border border-emerald-500/30 text-lg font-black text-emerald-600 flex items-center justify-center">
                ৳{(formData.amount - formData.discount).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4">
             <button 
              type="submit" 
              disabled={loading || !selectedCustomer} 
              className="flex-1 py-4 bg-[#2ecc71] text-white rounded-2xl font-bold hover:bg-[#27ae60] transition-all shadow-xl shadow-emerald-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  Create Invoice & Active User
                </>
              )}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setFormData({customerId: '', amount: 0, method: 'Cash', discount: 0, remarks: ''});
                setSelectedCustomer(null);
                setErrors({});
                setTouched({});
              }} 
              className="px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

function PackageFormView({ onComplete, initialData }: { onComplete: () => void; initialData?: Package | null }) {
  const [formData, setFormData] = useState<Partial<Package>>(initialData || {
    name: '',
    speed: '',
    price: 0,
    description: '',
    isPopular: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validate = (data: Partial<Package>) => {
    const newErrors: Record<string, string> = {};
    if (!data.name?.trim()) newErrors.name = 'Package name is required';
    if (!data.speed?.trim()) newErrors.speed = 'Speed tag is required (e.g. 10 Mbps)';
    if (!data.price || data.price <= 0) newErrors.price = 'Price must be greater than 0';
    return newErrors;
  };

  const handleChange = (field: keyof Package, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    if (touched[field]) {
      setErrors(validate(newData));
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setErrors(validate(formData));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setTouched({ name: true, speed: true, price: true });
      return;
    }

    setLoading(true);
    try {
      if (initialData?.id) {
        await updateDoc(doc(db, 'packages', initialData.id), formData);
      } else {
        await addDoc(collection(db, 'packages'), {
          ...formData,
          createdAt: Timestamp.now()
        });
      }
      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-2xl mx-auto"
    >
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
          <PackageIcon size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">{initialData ? 'Edit Package' : 'Create New Package'}</h3>
          <p className="text-sm text-gray-400">Configure your ISP service offerings</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
            Package Name *
            {touched.name && errors.name && <span className="text-red-500 normal-case font-medium">{errors.name}</span>}
          </label>
          <input 
            placeholder="e.g. Home Basic, Gamer Pro, Enterprise"
            value={formData.name}
            onChange={e => handleChange('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            className={cn(
              "w-full p-3 bg-gray-50 rounded-xl border transition-all text-sm outline-none",
              touched.name && errors.name ? "border-red-300 focus:ring-red-500/10" : "border-gray-200 focus:ring-emerald-500/20"
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
              Speed Tag *
              {touched.speed && errors.speed && <span className="text-red-500 normal-case font-medium">{errors.speed}</span>}
            </label>
            <input 
              placeholder="e.g. 10 Mbps, 50 Mbps"
              value={formData.speed}
              onChange={e => handleChange('speed', e.target.value)}
              onBlur={() => handleBlur('speed')}
              className={cn(
                "w-full p-3 bg-gray-50 rounded-xl border transition-all text-sm outline-none",
                touched.speed && errors.speed ? "border-red-300 focus:ring-red-500/10" : "border-gray-200 focus:ring-emerald-500/20"
              )}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
              Monthly Price (৳) *
              {touched.price && errors.price && <span className="text-red-500 normal-case font-medium">{errors.price}</span>}
            </label>
            <input 
              type="number"
              value={formData.price}
              onChange={e => handleChange('price', Number(e.target.value))}
              onBlur={() => handleBlur('price')}
              className={cn(
                "w-full p-3 bg-gray-50 rounded-xl border transition-all text-sm outline-none",
                touched.price && errors.price ? "border-red-300 focus:ring-red-500/10" : "border-gray-200 focus:ring-emerald-500/20"
              )}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
          <textarea 
            rows={3}
            placeholder="Describe the benefits of this package..."
            value={formData.description}
            onChange={e => handleChange('description', e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 text-sm outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-3 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
          <input 
            type="checkbox"
            id="isPopular"
            checked={formData.isPopular}
            onChange={e => handleChange('isPopular', e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <label htmlFor="isPopular" className="text-sm font-medium text-emerald-900 cursor-pointer">
            Mark as Popular (Displays a 'Popular' badge on the card)
          </label>
        </div>

        <div className="flex gap-3 pt-4">
          <button 
            type="submit" 
            disabled={loading}
            className="flex-1 py-3 bg-[#002d2d] text-white rounded-xl font-bold hover:bg-[#003d3d] transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Saving...' : initialData ? 'Update Package' : 'Create Package'}
          </button>
          <button 
            type="button"
            onClick={onComplete}
            className="px-8 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}

function EditRechargeView({ transaction, customers, onComplete }: { transaction: Transaction | null; customers: Customer[]; onComplete: () => void }) {
  const [formData, setFormData] = useState({
    amount: transaction?.amount || 0,
    method: transaction?.method || 'Cash',
    discount: 0,
    remarks: transaction?.remarks || '',
    status: transaction?.status || 'paid'
  });
  const [loading, setLoading] = useState(false);

  if (!transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateDoc(doc(db, 'transactions', transaction.id!), {
        amount: Number(formData.amount) - Number(formData.discount),
        method: formData.method,
        status: formData.status,
        remarks: formData.remarks,
        updatedAt: Timestamp.now()
      });

      // Send automatic payment receipt SMS notification when marked as paid
      if (formData.status === 'paid') {
        try {
          const finalAmt = Number(formData.amount) - Number(formData.discount);
          const smsResult = await sendSMSNotification(transaction.customerId, finalAmt, formData.method);
          console.log("Automatic receipt SMS send result (Edit): ", smsResult);
        } catch (smsErr) {
          console.error("Failed to dispatch automated SMS receipt on update:", smsErr);
        }
      }

      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-4xl mx-auto"
    >
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <Pencil size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Edit Recharge Record</h3>
          <p className="text-sm text-gray-400">Modify transaction details for {transaction.customerName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">User ID</label>
            <input 
              readOnly value={transaction.customerId}
              className="w-full p-3 bg-gray-100 rounded-xl border border-gray-200 text-sm text-gray-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Customer Name</label>
            <input 
              readOnly value={transaction.customerName || ''}
              className="w-full p-3 bg-gray-100 rounded-xl border border-gray-200 text-sm text-gray-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 pt-4 border-t border-gray-100">
           <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Amount *</label>
            <input 
              type="number" required value={formData.amount}
              onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
              className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/20 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Payment Method</label>
            <select 
              value={formData.method}
              onChange={e => setFormData({...formData, method: e.target.value})}
              className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/20 text-sm"
            >
              <option value="Cash">Cash</option>
              <option value="Bkash">Bkash</option>
              <option value="Nagad">Nagad</option>
              <option value="Rocket">Rocket</option>
              <option value="Bank">Bank Transfer</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
            <select 
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value as any})}
              className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/20 text-sm"
            >
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Discount</label>
            <input 
              type="number" value={formData.discount}
              onChange={e => setFormData({...formData, discount: Number(e.target.value)})}
              className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#002d2d]/20 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Grand Total</label>
            <div className="w-full p-3 bg-[#002d2d]/5 rounded-xl border border-dashed border-[#002d2d]/30 text-lg font-bold text-[#002d2d]">
              ৳ {formData.amount - formData.discount}
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-3 mt-8">
           <button type="submit" disabled={loading} className="px-12 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg active:scale-95 disabled:opacity-50">
            {loading ? 'Updating...' : 'Update Record'}
          </button>
          <button type="button" onClick={onComplete} className="px-8 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all">
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}

function CustomerProfileView({ customer, transactions, packages, onBack }: { customer: Customer | null; transactions: Transaction[]; packages: Package[]; onBack: () => void }) {
  if (!customer) return null;

  const customerTransactions = transactions.filter(tx => tx.customerId === customer.id || tx.customerId === customer.username);
  
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto"
    >
      {/* Left Sidebar Profile */}
      <div className="w-full lg:w-96 space-y-6">
        <div className="bg-white rounded-[2rem] shadow-xl shadow-black/5 border border-gray-100 overflow-hidden">
          <div className="p-8 text-center border-b border-gray-50 bg-gradient-to-b from-gray-50/50 to-white">
            <div className="w-32 h-32 bg-[#002d2d] rounded-[2.5rem] flex items-center justify-center text-white mx-auto mb-6 shadow-2xl relative group">
              <span className="text-5xl font-black">{customer.name.charAt(0)}</span>
              <div className="absolute inset-0 bg-emerald-400 opacity-0 group-hover:opacity-10 transition-opacity rounded-[2.5rem]"></div>
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">{customer.name}</h2>
            <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">{customer.username}</p>
          </div>
          
          <div className="p-8 space-y-6">
            <ProfileItem label="Number" value={customer.phone} />
            <ProfileItem label="ISP" value="Red Green Online" />
            <ProfileItem label="Reseller" value="RED GREEN ONLINE" />
            <ProfileItem label="Address" value={customer.address} isAddress />
            <ProfileItem label="Flat No." value={customer.flatNo || ''} />
            <ProfileItem label="Area" value={customer.area || ''} />
            <ProfileItem label="Registration Date" value={customer.registrationDate || (customer.createdAt?.toDate ? customer.createdAt.toDate().toLocaleDateString('en-GB') : '2024-08-01')} />
            <ProfileItem label="Password" value={customer.password || '12345'} />
          </div>

          <div className="p-8 bg-gray-50/50 space-y-3">
            <button className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95">Renewal Now</button>
            <button className="w-full py-4 bg-[#ff4081] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#ff1b71] transition-all shadow-lg shadow-[#ff4081]/20 active:scale-95">Package Change</button>
            <button className="w-full py-4 bg-[#5c6bc0] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#3f51b5] transition-all shadow-lg shadow-[#5c6bc0]/20 active:scale-95">Edit Profile</button>
            <button className="w-full py-4 bg-[#5c6bc0] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#3f51b5] transition-all shadow-lg active:scale-95">Customer Note</button>
            <button className="w-full py-4 bg-[#ffc107] text-gray-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#ffb300] transition-all shadow-lg active:scale-95">Change Password</button>
            <button className="w-full py-4 bg-[#ff4081] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#ff1b71] transition-all shadow-lg active:scale-95">Bill Expire</button>
            <button className="w-full py-4 bg-[#29b6f6] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#039be5] transition-all shadow-lg active:scale-95">Login History</button>
            <button className="w-full py-4 bg-[#ff4081] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#ff1b71] transition-all shadow-lg active:scale-95">Permanent Disabled</button>
          </div>
        </div>
        <button 
          onClick={onBack}
          className="w-full py-4 bg-white text-gray-400 font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl border border-gray-100 shadow-sm hover:text-gray-900 transition-all"
        >
          Close Profile
        </button>
      </div>

      {/* Main Details Area */}
      <div className="flex-1 space-y-8">
        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-black/5 border border-gray-100">
          <h3 className="text-2xl font-black text-gray-900 mb-10 flex items-center gap-4">
            <span className="w-2 h-8 bg-[#002d2d] rounded-full"></span>
            Services Details
          </h3>
          
          <div className="grid grid-cols-1 gap-1">
            <DetailRow 
              icon={<ShieldAlert size={18} className="rotate-180" />} 
              label="Connection Status" 
              value={<span className="bg-emerald-500 text-white px-5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">ONLINE</span>} 
            />
            <DetailRow 
              icon={<User size={18} />} 
              label="Profile Status" 
              value={<span className="bg-emerald-500 text-white px-5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">Active</span>} 
            />
            <DetailRow icon={<PackageIcon size={18} />} label="Package" value={customer.packageName} />
            <DetailRow icon={<Calendar size={18} />} label="Last Activated/Renewed Date" value="0000-00-00" />
            <DetailRow icon={<User size={18} />} label="Last Activated/Renewed By" value="" />
            <DetailRow icon={<User size={18} />} label="Alternate Number" value={customer.alternateNumber || ''} />
            <DetailRow icon={<MapPin size={18} />} label="Mac Address" value={customer.macAddress || '98:BA:5F:32:65:21'} />
            <DetailRow icon={<Globe size={18} />} label="IP Address" value={customer.ipAddress || '10.10.15.195'} />
            <DetailRow icon={<Calendar size={18} />} label="Expiration Date" value={customer.expiryDate ? new Date(customer.expiryDate).toLocaleDateString('en-CA') : '2026-05-15'} />
            <DetailRow icon={<DollarSign size={18} />} label="Monthly Rent" value={(customer.monthlyBill || packages.find(p => p.id === customer.packageId || p.name.toLowerCase().replace(/[\s._-]+/g, '') === (customer.packageName || '').toLowerCase().replace(/[\s._-]+/g, ''))?.price || 0).toFixed(2)} />
          </div>
        </div>

        {/* Internal Admin Notes */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-black/5 border border-gray-100">
          <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-4">
            <span className="w-2 h-6 bg-amber-500 rounded-full"></span>
            Internal Admin Notes
          </h3>
          <div className="bg-amber-50/40 border border-amber-150 rounded-2xl p-6 text-gray-700 font-medium text-sm leading-relaxed whitespace-pre-wrap">
            {customer.notes ? customer.notes : (
              <span className="text-gray-400 italic">No custom notes specified for this client. You can edit their profile to append permanent instructions or billing logs.</span>
            )}
          </div>
        </div>

        {/* Recent Transactions Card */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-black/5 border border-gray-100">
          <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-4">
            <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
            Recent Payments
          </h3>
          <div className="space-y-4">
            {customerTransactions.slice(0, 5).map(tx => (
               <div key={tx.id} className="flex items-center justify-between p-5 bg-gray-50/50 rounded-2xl border border-gray-50">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                        <CreditCard size={20} />
                     </div>
                     <div>
                        <p className="text-sm font-black text-gray-900">৳{tx.amount}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{tx.method} • {new Date(tx.date?.toDate ? tx.date.toDate() : tx.date).toLocaleDateString()}</p>
                     </div>
                  </div>
                  <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-50 px-3 py-1 rounded-lg">PAID</span>
               </div>
            ))}
            {customerTransactions.length === 0 && (
              <p className="text-center py-10 text-gray-400 font-bold text-xs uppercase tracking-widest">No payment records yet.</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ProfileItem({ label, value, isAddress }: { label: string; value: any; isAddress?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-3 border-b border-gray-50 last:border-0 items-start">
      <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{label}</span>
      <span className={cn(
        "text-xs font-semibold text-gray-500 text-right leading-relaxed",
        isAddress ? "max-w-[180px] uppercase font-black tracking-tight" : ""
      )}>
        {value || ''}
      </span>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="flex items-center justify-between py-6 border-b border-gray-50 last:border-0 px-2 group hover:bg-gray-50/30 transition-colors rounded-xl mx-[-8px]">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 group-hover:scale-110 transition-transform group-hover:text-gray-900 group-hover:bg-white group-hover:shadow-md">
          {icon}
        </div>
        <span className="text-sm font-bold text-gray-900">{label}</span>
      </div>
      <div className="text-sm font-bold text-gray-600">
        {value}
      </div>
    </div>
  );
}

function BulkImportModal({ 
  packages, 
  onClose, 
  onComplete 
}: { 
  packages: Package[]; 
  onClose: () => void; 
  onComplete: () => void; 
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processImport = async () => {
    if (!file) return;
    setLoading(true);
    setLogs(['Reading file...']);
    setProgress(0);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().replace(/^[\uFEFF\u200B\u00A0]+|[\uFEFF\u200B\u00A0]+$/g, ''), // Strip BOM and weird spaces
      complete: async (results) => {
        const data = results.data as any[];
        const headers = results.meta.fields || [];
        
        setLogs(prev => [
          ...prev, 
          `Found ${data.length} records. Starting import...`,
          `Detected headers: ${headers.join(' | ')}`
        ]);

        if (results.errors.length > 0) {
          setLogs(prev => [...prev, `Note: Found ${results.errors.length} parsing issues.`]);
        }
        
        let successCount = 0;
        let failedCount = 0;

        // Helper to find value by checking common variations of keys
        const findVal = (row: any, targetKey: string) => {
          const keys = Object.keys(row);
          const normalizedTarget = targetKey.toLowerCase().replace(/[\s._-]+/g, '');
          
          for (const k of keys) {
            const normalizedK = k.toLowerCase().replace(/[\s._-]+/g, '');
            if (normalizedK === normalizedTarget) {
              const val = row[k];
              if (val !== undefined && val !== null) {
                const trimmed = val.toString().trim();
                if (trimmed !== '') return trimmed;
              }
            }
          }
          return '';
        };

        const BATCH_SIZE = 400; // Firestore batch limit is 500
        for (let i = 0; i < data.length; i += BATCH_SIZE) {
          const chunk = data.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          
          for (let j = 0; j < chunk.length; j++) {
            const row = chunk[j];
            const rowIndex = i + j + 1;
            
            try {
              // Flexible mapping with comprehensive fallback checks for all potential headers
              const username = 
                findVal(row, 'userid') || 
                findVal(row, 'username') || 
                findVal(row, 'idno') || 
                findVal(row, 'id_no') || 
                findVal(row, 'clientid') || 
                findVal(row, 'customerid') || 
                findVal(row, 'loginid') || 
                findVal(row, 'login') || 
                findVal(row, 'user') || 
                `user_${Date.now()}_${i + j}`;

              const name = 
                findVal(row, 'customername') || 
                findVal(row, 'name') || 
                findVal(row, 'clientname') || 
                findVal(row, 'fullname') || 
                findVal(row, 'customer') || 
                findVal(row, 'client') || 
                username || 
                'Unknown';

              const phone = 
                findVal(row, 'mobile') || 
                findVal(row, 'phone') || 
                findVal(row, 'contact') || 
                findVal(row, 'mobilenumber') || 
                findVal(row, 'phonenumber') || 
                findVal(row, 'contactnumber') || 
                findVal(row, 'cell') || 
                '';

              const address = 
                findVal(row, 'address') || 
                findVal(row, 'location') || 
                findVal(row, 'zone') || 
                findVal(row, 'area') || 
                '';

              const packageName = 
                findVal(row, 'pkg') || 
                findVal(row, 'package') || 
                findVal(row, 'packagename') || 
                findVal(row, 'plan') || 
                findVal(row, 'speed') || 
                '';

              const rentStr = 
                findVal(row, 'rent') || 
                findVal(row, 'bill') || 
                findVal(row, 'monthlybill') || 
                findVal(row, 'monthly_bill') ||
                findVal(row, 'price') || 
                findVal(row, 'pkgprice') || 
                findVal(row, 'packageprice') || 
                findVal(row, 'charge') || 
                findVal(row, 'rate') || 
                findVal(row, 'amount') || 
                '0';

              let rent = parseFloat(rentStr.replace(/[^0-9.]/g, '')) || 0;

              const statusStr = (
                findVal(row, 'status') || 
                findVal(row, 'state') || 
                findVal(row, 'condition') || 
                'active'
              ).toLowerCase();

              const expireDateStr = 
                findVal(row, 'expdate') || 
                findVal(row, 'expire') || 
                findVal(row, 'expiry') || 
                findVal(row, 'expirydate') || 
                '';
              
              let formattedExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
              if (expireDateStr) {
                const parts = expireDateStr.split(/[/-]/);
                if (parts.length === 3) {
                  let dateObj: Date;
                  if (parts[0].length === 4) { // YYYY-MM-DD
                    dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                  } else { // DD/MM/YYYY
                    dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                  }
                  if (!isNaN(dateObj.getTime())) {
                    formattedExpiryDate = dateObj.toISOString();
                  }
                }
              }
              
              // Normalize and try alternate patterns to find a matching package plan
              const cleanPackageName = packageName.toLowerCase().replace(/[\s._-]+/g, '');
              const pkg = packages.find(p => {
                const cleanPName = p.name.toLowerCase().replace(/[\s._-]+/g, '');
                return cleanPName === cleanPackageName || 
                       cleanPackageName.includes(cleanPName) || 
                       cleanPName.includes(cleanPackageName);
              });

              // Fallback: If parsed rent/monthly bill is 0, auto-derive it from matched package plan's standard price!
              if (rent === 0 && pkg) {
                rent = pkg.price || 0;
              }
              
              const docRef = doc(collection(db, 'customers'));
              batch.set(docRef, {
                name: name.substring(0, 199),
                username: username.substring(0, 99),
                password: '123-password',
                phone,
                address,
                packageId: pkg?.id || (packages.length > 0 ? packages[0].id : 'default-pkg'),
                packageName: pkg?.name || packageName || 'Default',
                monthlyBill: isNaN(rent) ? 0 : rent,
                status: statusStr.includes('active') ? 'active' : 'expired',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                expiryDate: formattedExpiryDate
              });
              
              successCount++;
            } catch (err: any) {
              console.error(`Row ${rowIndex} mapping error:`, err);
              failedCount++;
            }
          }

          try {
            await batch.commit();
            const currentProgress = Math.min(100, Math.round(((i + chunk.length) / data.length) * 100));
            setProgress(currentProgress);
            setLogs(prev => [...prev, `Uploaded batch... (${Math.min(i + chunk.length, data.length)} / ${data.length})`]);
          } catch (err: any) {
            console.error('Batch commit error:', err);
            setLogs(prev => [...prev, `❌ Batch Error: ${err.message}`]);
            failedCount += chunk.length;
          }
        }

        setProgress(100);
        setLogs(prev => [...prev, `Import complete! Successful: ${successCount}, Failed: ${failedCount}`]);
        setLoading(false);
        if (successCount > 0) {
          setTimeout(onComplete, 3000);
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden"
      >
        <div className="p-6 bg-[#002d2d] text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-xl">Bulk Import Clients</h3>
            <p className="text-xs text-white/60">Upload CSV file to add multiple customers</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
            <h4 className="text-emerald-800 font-bold text-sm mb-2 flex items-center gap-2">
              <FileText size={16} /> CSV Format Guide
            </h4>
            <p className="text-emerald-600 text-xs leading-relaxed">
              Required columns (matching your Excel): <strong>User ID, Customer Name, Mobile, Address, Pkg, Rent, Exp.Date, Status</strong>.<br/>
              Ensure you save your Excel as <strong>CSV (Comma Delimited)</strong>.
            </p>
            <button 
              onClick={() => {
                const csv = 'User ID,Customer Name,Mobile,Address,Pkg,Rent,Exp.Date,Status\nncr9_mihir,mihir,01700000000,"Dhaka, Bangladesh",ROSE-700,700,15/05/2026,Active';
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.setAttribute('href', url);
                a.setAttribute('download', 'sample_clients.csv');
                a.click();
              }}
              className="mt-3 text-emerald-700 font-bold text-xs flex items-center gap-1 hover:underline"
            >
              <Download size={14} /> Download Sample CSV
            </button>
          </div>

          {!loading && !progress && (
            <div 
              className="border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center hover:border-emerald-300 transition-colors cursor-pointer group"
              onClick={() => document.getElementById('csvInput')?.click()}
            >
              <input 
                id="csvInput" 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileChange} 
              />
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-50 transition-colors">
                <Upload size={32} className="text-gray-400 group-hover:text-emerald-500 transition-colors" />
              </div>
              <p className="text-gray-900 font-bold text-sm mb-1">
                {file ? file.name : 'Click to upload CSV file'}
              </p>
              <p className="text-gray-400 text-xs">Max file size: 5MB</p>
            </div>
          )}

          {(loading || progress > 0) && (
            <div className="space-y-4">
              <div className="flex justify-between items-end mb-1">
                <span className="text-xs font-bold text-gray-500">IMPORT PROGRESS</span>
                <span className="text-sm font-black text-[#002d2d]">{progress}%</span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-emerald-500"
                />
              </div>
              <div className="bg-gray-50 p-4 rounded-xl max-h-32 overflow-y-auto text-[10px] font-mono text-gray-500 space-y-1 border border-gray-100">
                {logs.map((log, i) => <div key={i}>{log}</div>)}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button 
              onClick={onClose} 
              disabled={loading}
              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={processImport}
              disabled={!file || loading}
              className="flex-1 py-4 bg-[#002d2d] text-white rounded-2xl font-bold shadow-lg shadow-[#002d2d]/20 hover:bg-[#003d3d] transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Start Import'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function CustomersView({ customers, packages, onCreateUser, onEditUser, onViewProfile }: { customers: Customer[]; packages: Package[]; onCreateUser: () => void; onEditUser: (c: Customer) => void; onViewProfile: (c: Customer) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'disabled' | 'suspended'>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [packageFilter, setPackageFilter] = useState<string>('all');
  const [duesFilter, setDuesFilter] = useState<'all' | 'has-dues' | 'no-dues'>('all');
  
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'bulk';
    id?: string;
    name?: string;
    ids?: string[];
  }>({ isOpen: false, type: 'single' });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleDelete = (id: string, name: string) => {
    setDeleteModal({
      isOpen: true,
      type: 'single',
      id,
      name
    });
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      await updateDoc(doc(db, 'customers', id), {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      console.error("Failed to toggle status", err);
    }
  };

  const filteredCustomers = customers.filter((c, idx) => {
    const term = searchTerm.toLowerCase().trim();

    // 1. Search Query Handling (Searches ID NO, USER ID, CUSTOMER NAME, MOBILE, ADDRESS, ALTERNATIVE PHONE, IP ADDRESS, MAC ADDRESS, PACKAGE NAME)
    const matchesBasic = 
      c.name.toLowerCase().includes(term) || 
      c.username.toLowerCase().includes(term) ||
      c.phone.includes(term);

    const matchesNetwork = 
      (c.ipAddress && c.ipAddress.toLowerCase().includes(term)) ||
      (c.macAddress && c.macAddress.toLowerCase().includes(term));

    const matchesLocation = 
      (c.area && c.area.toLowerCase().includes(term)) ||
      (c.flatNo && c.flatNo.toLowerCase().includes(term)) ||
      (c.address && c.address.toLowerCase().includes(term));

    const matchesMisc = 
      (c.packageName && c.packageName.toLowerCase().includes(term)) ||
      (c.alternateNumber && c.alternateNumber.toLowerCase().includes(term)) ||
      (c.expiryDate && new Date(c.expiryDate).toLocaleDateString('en-GB').includes(term)) ||
      ((1200 + idx).toString().includes(term)); // Match sequential ID e.g. 1205

    const matchesSearch = !term || (matchesBasic || matchesNetwork || matchesLocation || matchesMisc);

    // 2. Status Filter
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

    // 3. Area/Zone Filter
    const cArea = c.area || c.address?.split(',')[0] || 'Main Area';
    const matchesArea = areaFilter === 'all' || cArea.toLowerCase() === areaFilter.toLowerCase();

    // 4. Package Filter
    const matchesPackage = packageFilter === 'all' || 
      c.packageId === packageFilter || 
      (c.packageName && c.packageName.toLowerCase().includes(packageFilter.toLowerCase()));

    // 5. Billing Dues Filter (mocked condition index % 3 === 0 simulates having mock dues of ৳700 in table render)
    const hasDues = idx % 3 === 0;
    const matchesDues = duesFilter === 'all' || (duesFilter === 'has-dues' ? hasDues : !hasDues);

    return matchesSearch && matchesStatus && matchesArea && matchesPackage && matchesDues;
  });

  const isAllSelected = filteredCustomers.length > 0 && filteredCustomers.every(c => c.id && selectedIds.includes(c.id));

  const toggleSelectAll = () => {
    const filteredIds = filteredCustomers.map(c => c.id).filter((id): id is string => !!id);
    if (isAllSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const union = new Set([...prev, ...filteredIds]);
        return Array.from(union);
      });
    }
  };

  const toggleSelectOne = (id: string | undefined) => {
    if (!id) return;
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    const validIds = selectedIds.filter(Boolean);
    if (validIds.length === 0) return;
    setDeleteModal({
      isOpen: true,
      type: 'bulk',
      ids: validIds
    });
  };

  const confirmDelete = async () => {
    if (deleteModal.type === 'single' && deleteModal.id) {
      const { id } = deleteModal;
      try {
        await deleteDoc(doc(db, 'customers', id));
        setSelectedIds(prev => prev.filter(item => item !== id));
        setToast({ message: "কাস্টমার সফলভাবে ডিলিট করা হয়েছে।", type: "success" });
      } catch (err) {
        console.error("Failed to delete customer", err);
        setToast({ message: "কাস্টমার ডিলিট করতে সমস্যা হয়েছে। দয়া করে আপনার পারমিশন চেক করুন।", type: "error" });
        handleFirestoreError(err, 'delete', 'customers');
      }
    } else if (deleteModal.type === 'bulk' && deleteModal.ids) {
      const { ids } = deleteModal;
      try {
        await Promise.all(
          ids.map(id => deleteDoc(doc(db, 'customers', id)))
        );
        setSelectedIds([]);
        setToast({ message: "কাস্টমারগুলো সফলভাবে ডিলিট করা হয়েছে।", type: "success" });
      } catch (err) {
        console.error("Bulk deletion failed", err);
        setToast({ message: "কাস্টমার ডিলিট করতে সমস্যা হয়েছে। দয়া করে আপনার পারমিশন চেক করুন।", type: "error" });
        handleFirestoreError(err, 'delete', 'customers');
      }
    }
    setDeleteModal({ isOpen: false, type: 'single' });
  };

  const areas = Array.from(new Set(customers.map(c => c.area || c.address?.split(',')[0] || 'Main Area').filter(Boolean)));
  const packageOptions = Array.from(new Set([
    ...packages.map(p => p.name),
    ...customers.map(c => c.packageName).filter(Boolean)
  ]));

  return (
    <div className="space-y-6">
      {showBulkImport && (
        <BulkImportModal 
          packages={packages} 
          onClose={() => setShowBulkImport(false)} 
          onComplete={() => setShowBulkImport(false)}
        />
      )}
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            Show 
            <select className="border border-gray-200 rounded-lg p-1 outline-none">
              <option>10</option>
              <option>25</option>
              <option>50</option>
              <option>100</option>
            </select>
            entries
          </div>
          <div className="flex gap-1">
            <button className="px-4 py-1.5 bg-[#e91e63] text-white rounded-lg text-sm font-bold shadow-sm hover:opacity-90">Excel</button>
            <button className="px-4 py-1.5 bg-[#8e24aa] text-white rounded-lg text-sm font-bold shadow-sm hover:opacity-90">PDF</button>
            <button className="px-4 py-1.5 bg-[#d81b60] text-white rounded-lg text-sm font-bold shadow-sm hover:opacity-90">Print</button>
            <button 
              onClick={() => setShowBulkImport(true)}
              className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-600 flex items-center gap-1 mx-2"
            >
              <Upload size={14} /> Bulk Import
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-[#002d2d]/5 text-[#002d2d] px-4 py-2 rounded-2xl text-xs font-bold border border-[#002d2d]/10">
            Filtered Client: <span className="text-emerald-600 font-extrabold">{filteredCustomers.length}</span> / {customers.length} Total
          </div>
          {selectedIds.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 animate-pulse"
            >
              <Trash2 size={16} /> একসাথে মুছুন ({selectedIds.length})
            </button>
          )}
          <button 
            onClick={onCreateUser}
            className="bg-[#002d2d] text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#003d3d] shadow-lg transition-all active:scale-95"
          >
            <Plus size={18} /> New Customer
          </button>
        </div>
      </div>

      {/* Advance Search Filters Panel */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Search size={10} className="text-emerald-500" /> Search Client Network
          </label>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Name, User ID, Mobile, Alternative Phone, IP / MAC Address..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-[#002d2d]/10 transition-all placeholder:text-gray-400 placeholder:font-normal"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          </div>
        </div>

        <div className="space-y-1.5 w-full sm:w-auto min-w-[130px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</label>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer text-xs font-bold text-gray-700 transition-all focus:ring-2 focus:ring-[#002d2d]/10"
          >
            <option value="all">ALL Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="disabled">Disabled</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div className="space-y-1.5 w-full sm:w-auto min-w-[150px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Zone / Area</label>
          <select 
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer text-xs font-bold text-gray-700 transition-all focus:ring-2 focus:ring-[#002d2d]/10"
          >
            <option value="all">ALL Areas</option>
            {areas.map(area => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 w-full sm:w-auto min-w-[150px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Package Plan</label>
          <select 
            value={packageFilter}
            onChange={(e) => setPackageFilter(e.target.value)}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer text-xs font-bold text-gray-700 transition-all focus:ring-2 focus:ring-[#002d2d]/10"
          >
            <option value="all">ALL Packages</option>
            {packageOptions.map(pkgOpt => (
              <option key={pkgOpt} value={pkgOpt}>{pkgOpt}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 w-full sm:w-auto min-w-[130px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dues Balance</label>
          <select 
            value={duesFilter}
            onChange={(e) => setDuesFilter(e.target.value as any)}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer text-xs font-bold text-gray-700 transition-all focus:ring-2 focus:ring-[#002d2d]/10"
          >
            <option value="all">ALL Balance</option>
            <option value="has-dues">Has Dues Dues</option>
            <option value="no-dues">Clear / Zero Balance</option>
          </select>
        </div>

        {/* Clear Filter button if active */}
        {(searchTerm || statusFilter !== 'all' || areaFilter !== 'all' || packageFilter !== 'all' || duesFilter !== 'all') && (
          <button 
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setAreaFilter('all');
              setPackageFilter('all');
              setDuesFilter('all');
            }}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95 border border-gray-200 shadow-sm"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-[#2d3436] rounded-3xl shadow-sm overflow-hidden border border-gray-800">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <table className="w-full text-left min-w-[1200px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th 
                  className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center cursor-pointer select-none"
                  onClick={() => toggleSelectAll()}
                >
                  <div className="flex flex-col items-center justify-center gap-1">
                    <input 
                      type="checkbox" 
                      className="rounded cursor-pointer" 
                      checked={isAllSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelectAll();
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span>ALL</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">ID NO</th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">USER ID</th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">AREA</th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">CUSTOMER NAME</th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">MOBILE</th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">ADDRESS</th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">PKG</th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">RENT</th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">DUES</th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">ON/OFF</th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">LAST LOGOUT</th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">EXP.DATE</th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">STATUS</th>
                <th className="px-4 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 bg-white">
              {filteredCustomers.map((customer, index) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <td 
                    className="px-4 py-3 text-center cursor-pointer select-none"
                    onClick={() => toggleSelectOne(customer.id)}
                  >
                    <input 
                      type="checkbox" 
                      className="rounded cursor-pointer" 
                      checked={!!customer.id && selectedIds.includes(customer.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelectOne(customer.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{1200 + index}</td>
                  <td className="px-4 py-3">
                    <span 
                      onClick={() => onViewProfile(customer)}
                      className="bg-[#10b981] text-white px-3 py-1 rounded-full text-xs font-bold cursor-pointer hover:bg-[#059669] transition-colors shadow-sm"
                    >
                      {customer.username}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-gray-500 w-32 leading-tight">
                    {customer.area || customer.address?.split(',')[0] || 'Main Area'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-medium">{customer.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{customer.phone}</td>
                  <td className="px-4 py-3 text-[11px] text-gray-400 w-48 leading-tight">
                    {customer.address || '--'}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">{customer.packageName?.split('-')[0]}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-medium">
                    ৳{(customer.monthlyBill || packages.find(p => p.id === customer.packageId || p.name.toLowerCase().replace(/[\s._-]+/g,'') === (customer.packageName || '').toLowerCase().replace(/[\s._-]+/g,''))?.price || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-[#b3e5fc] text-[#0288d1] px-2 py-0.5 rounded text-[11px] font-bold">
                      {index % 3 === 0 ? '700' : '0'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => customer.id && toggleStatus(customer.id, customer.status)}
                      className={cn(
                        "relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none",
                        customer.status === 'active' ? "bg-emerald-500" : "bg-gray-300"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                          customer.status === 'active' ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                    <span className={cn(
                      "ml-2 text-[10px] font-bold uppercase",
                      customer.status === 'active' ? "text-emerald-600" : "text-gray-400"
                    )}>
                      {customer.status === 'active' ? 'On' : 'Off'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-gray-500 leading-tight">
                    18/05/26<br/>10:32
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold text-white block text-center",
                      index % 2 === 0 ? "bg-[#f44336]" : "bg-[#2e7d32]"
                    )}>
                      {customer.expiryDate ? new Date(customer.expiryDate).toLocaleDateString('en-GB') : 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase text-white inline-block min-w-[70px]",
                      customer.status === 'active' ? "bg-[#2e7d32]" : 
                      customer.status === 'disabled' ? "bg-[#e91e63]" : "bg-[#fbc02d]"
                    )}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right relative">
                    <button 
                      onClick={() => setActiveDropdown(activeDropdown === customer.id ? null : (customer.id || null))}
                      className="bg-[#29b6f6] text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 ml-auto shadow-sm"
                    >
                      Action <ChevronDown size={14} />
                    </button>
                    
                    {activeDropdown === customer.id && (
                      <div className="absolute right-4 top-full mt-1 z-50 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden text-left flex flex-col scale-in-center">
                        <button className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-xs font-bold text-gray-700 bg-[#10b981]/10 text-[#10b981]">
                           <span className="bg-[#10b981] p-1 rounded-lg text-white"><CheckCircle size={12} /></span> Active
                        </button>
                        <button className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-xs font-bold text-gray-700">
                           <span className="bg-[#fbc02d] p-1 rounded-lg text-white"><Clock size={12} /></span> Expire
                        </button>
                        <button className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-xs font-bold text-gray-700">
                           <span className="bg-[#e91e63] p-1 rounded-lg text-white"><UserX size={12} /></span> Permanent Disable
                        </button>
                        <button className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-xs font-bold text-gray-700">
                           <span className="bg-[#ab47bc] p-1 rounded-lg text-white"><ShieldAlert size={12} /></span> Suspend
                        </button>
                        <div className="h-[1px] bg-gray-100 my-1"></div>
                        <button 
                          onClick={() => {
                            onViewProfile(customer);
                            setActiveDropdown(null);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-xs font-bold text-[#5c6bc0]"
                        >
                           <span className="bg-[#5c6bc0] p-1 rounded-lg text-white"><Eye size={12} /></span> View Profile
                        </button>
                        <button 
                          onClick={() => {
                            onEditUser(customer);
                            setActiveDropdown(null);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-xs font-bold text-[#42a5f5]"
                        >
                           <span className="bg-[#42a5f5] p-1 rounded-lg text-white"><Pencil size={12} /></span> Edit Profile
                        </button>
                        <button className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-xs font-bold text-[#5c6bc0]">
                           <span className="bg-[#5c6bc0] p-1 rounded-lg text-white"><CreditCard size={12} /></span> Change Package
                        </button>
                        <button className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-xs font-bold text-[#5c6bc0]">
                           <span className="bg-[#5c6bc0] p-1 rounded-lg text-white"><Zap size={12} /></span> Send SMS
                        </button>
                        <button 
                          onClick={() => {
                            handleDelete(customer.id!, customer.name);
                            setActiveDropdown(null);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-red-50 text-xs font-bold text-red-500"
                        >
                           <span className="bg-red-500 p-1 rounded-lg text-white"><Trash2 size={12} /></span> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteModal({ isOpen: false, type: 'single' })}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-gray-150 overflow-hidden text-center z-10"
            >
              <div className="absolute top-4 right-4">
                <button 
                  onClick={() => setDeleteModal({ isOpen: false, type: 'single' })}
                  className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Top Warning Icon block */}
              <div className="w-16 h-16 bg-red-550/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 mb-2">আপনি কি নিশ্চিত?</h3>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                {deleteModal.type === 'single' ? (
                  <>কাস্টমার <strong className="text-red-500 font-bold">"{deleteModal.name}"</strong> কে চিরতরে মুছে ফেলা শুরু হবে। এই সিদ্ধান্ত আর ফেরত আনা যাবে না।</>
                ) : (
                  <>আপনি মোট <strong className="text-red-550 font-bold">{deleteModal.ids?.length} জন</strong> কাস্টমার ডিলিট করতে যাচ্ছেন। এই পদক্ষেপ আর ফেরত আনা যাবে না।</>
                )}
              </p>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteModal({ isOpen: false, type: 'single' })}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all active:scale-95 text-sm"
                >
                  না, ফিরে যান
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all active:scale-95 text-sm shadow-lg shadow-red-600/20"
                >
                  হ্যাঁ, ডিলিট করুন
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-xl border text-sm font-bold ${
              toast.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <span>{toast.message}</span>
            <button 
              onClick={() => setToast(null)}
              className="ml-2 hover:opacity-75 transition-opacity"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BillingView({ transactions, customers, onEdit }: { transactions: Transaction[]; customers: Customer[]; onEdit: (tx: Transaction) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });
  const [methodFilter, setMethodFilter] = useState('ALL Method');
  const [statusFilter, setStatusFilter] = useState('ALL Status');
  const [areaFilter, setAreaFilter] = useState('ALL Group');
  const [collectorFilter, setCollectorFilter] = useState('ALL Staff');
  const [selectedInvoiceTx, setSelectedInvoiceTx] = useState<Transaction | null>(null);
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<number>(0);

  const handleClearAllTransactions = async () => {
    if (window.confirm("আপনি কি নিশ্চিতভাবে সকল ট্রানজেকশন/লেনদেন মুছে ফেলতে চান? (Are you sure you want to delete ALL transactions permanentally?)")) {
      try {
        const querySnapshot = await getDocs(collection(db, 'transactions'));
        for (const docSnap of querySnapshot.docs) {
          await deleteDoc(doc(db, 'transactions', docSnap.id));
        }
        alert("সকল ট্রানজেকশন সফলভাবে মুছে ফেলা হয়েছে! (All transactions have been successfully cleared!)");
      } catch (err) {
        console.error("Failed to clear transactions:", err);
      }
    }
  };

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  const handleDelete = (id: string) => {
    setDeleteDialog({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (deleteDialog.id) {
      try {
        await deleteDoc(doc(db, 'transactions', deleteDialog.id));
      } catch (err) {
        console.error("Failed to delete transaction", err);
      }
    }
    setDeleteDialog({ isOpen: false, id: null });
  };

  const filteredTransactions = transactions.filter(tx => {
    const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const matchesDate = txDate >= start && txDate <= end;
    
    const searchStr = searchTerm.toLowerCase();
    const matchesSearch = (
      (tx.customerName?.toLowerCase().includes(searchStr)) ||
      (tx.customerId?.toLowerCase().includes(searchStr)) ||
      (tx.method?.toLowerCase().includes(searchStr))
    );

    const matchesMethod = methodFilter === 'ALL Method' || (
      tx.method?.toLowerCase() === methodFilter.toLowerCase() ||
      (methodFilter === 'Bank' && tx.method?.toLowerCase() === 'bank transfer') ||
      (methodFilter === 'Bank Transfer' && tx.method?.toLowerCase() === 'bank')
    );

    const matchesStatus = statusFilter === 'ALL Status' || (tx.status || 'paid').toLowerCase() === statusFilter.toLowerCase();
    
    // For Area and Collector, we match based on the transaction data or customer data
    const customer = customers.find(c => c.username === tx.customerId);
    const matchesArea = areaFilter === 'ALL Group' || (customer?.address?.includes(areaFilter));
    const matchesCollector = collectorFilter === 'ALL Staff' || tx.recordedBy === collectorFilter;

    return matchesDate && matchesSearch && matchesMethod && matchesStatus && matchesArea && matchesCollector;
  });

  const areas = Array.from(new Set(customers.map(c => c.address?.split(',')[0]).filter(Boolean)));
  const collectors = Array.from(new Set(transactions.map(tx => tx.recordedBy).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Title & Breadcrumb */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Collection (Home User)</h1>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Home size={14} /> Home <ChevronRight size={14} /> <span className="text-blue-500">Collection (Home User)</span>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap items-end gap-6">
        <div className="space-y-2 flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-gray-500 uppercase">From</label>
          <input 
            type="date" 
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/10 text-sm"
          />
        </div>
        <div className="space-y-2 flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-gray-500 uppercase">To</label>
          <input 
            type="date" 
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/10 text-sm"
          />
        </div>
        <div className="space-y-2 flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-gray-500 uppercase">Group/Area</label>
          <select 
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer text-sm"
          >
            <option>ALL Group</option>
            {areas.map(area => <option key={area} value={area}>{area}</option>)}
          </select>
        </div>
        <div className="space-y-2 flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-gray-500 uppercase">Method</label>
          <select 
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer text-sm"
          >
            <option>ALL Method</option>
            <option value="Cash">Cash</option>
            <option value="Bkash">Bkash</option>
            <option value="Nagad">Nagad</option>
            <option value="Rocket">Rocket</option>
            <option value="Bank">Bank Transfer</option>
          </select>
        </div>
        <div className="space-y-2 flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer text-sm font-bold text-gray-700"
          >
            <option>ALL Status</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
        <div className="space-y-2 flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-gray-500 uppercase">Staff/Collector</label>
          <select 
            value={collectorFilter}
            onChange={(e) => setCollectorFilter(e.target.value)}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer text-sm"
          >
            <option>ALL Staff</option>
            {collectors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Table Actions Header */}
      <div className="bg-white p-4 rounded-t-3xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4 mt-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            Show 
            <select className="border border-gray-200 rounded-lg p-1 outline-none">
              <option>50</option>
              <option>100</option>
            </select>
            entries
          </div>
          <div className="flex gap-1">
            <button className="px-4 py-1.5 bg-[#e91e63] text-white rounded-lg text-sm font-bold shadow-sm">Excel</button>
            <button className="px-4 py-1.5 bg-[#8e24aa] text-white rounded-lg text-sm font-bold shadow-sm">PDF</button>
            <button className="px-4 py-1.5 bg-[#d81b60] text-white rounded-lg text-sm font-bold shadow-sm">Print</button>
            <button 
              onClick={handleClearAllTransactions} 
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={14} /> Clear All
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Search:</span>
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none w-48 md:w-64"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-b-3xl shadow-sm border border-gray-100 overflow-hidden border-t-0">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
          <table className="w-full text-left min-w-[1400px]">
            <thead>
              <tr className="bg-[#2d3436] border-b border-gray-700">
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">SL</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">C.DATE</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-blue-400">INVID</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">ID</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">C.NAME</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">MOBILE</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">RENT</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">DIS</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">PAID</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">COMM</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">REC BY</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">METHOD</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">STATUS</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">EXPIRE</th>
                <th className="px-3 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.map((tx, index) => {
                const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
                const expiryDate = new Date(txDate);
                expiryDate.setMonth(expiryDate.getMonth() + 1);
                const txCustomer = customers.find(c => c.username === tx.customerId);
                const phone = txCustomer?.phone || 'N/A';
                const invNo = 9575 - index;
                const statusValue = tx.status || 'paid';
                
                return (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors text-sm text-gray-600">
                    <td className="px-3 py-3 text-center text-xs">{index + 1}</td>
                    <td className="px-3 py-3 text-xs">{txDate.toLocaleDateString('en-GB')}</td>
                    <td 
                      onClick={() => {
                        setSelectedInvoiceTx(tx);
                        setSelectedInvoiceNumber(invNo);
                      }}
                      className="px-3 py-3 text-xs font-bold text-blue-500 underline cursor-pointer hover:text-blue-700 transition-colors"
                    >
                      {invNo}
                    </td>
                    <td className="px-3 py-3 text-xs font-medium">{tx.customerId || 'ID-00'}</td>
                    <td className="px-3 py-3 text-xs uppercase font-bold">{tx.customerName || 'N/A'}</td>
                    <td className="px-3 py-3 text-xs">{phone}</td>
                    <td className="px-3 py-3 text-xs">৳{tx.amount + (tx.discount || 0)}</td>
                    <td className="px-3 py-3 text-xs">৳{tx.discount || 0}</td>
                    <td className="px-3 py-3 text-xs font-bold">৳{tx.amount}</td>
                    <td className="px-3 py-3 text-xs">৳{tx.amount}</td>
                    <td className="px-3 py-3 text-xs italic">{tx.recordedBy || 'rubel'}</td>
                    <td className="px-3 py-3 text-xs">{tx.method}</td>
                    <td className="px-3 py-3 text-xs">
                      <span className={cn(
                        "px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg shadow-sm border",
                        statusValue === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                        statusValue === 'pending' ? "bg-amber-50 text-amber-600 border-amber-200" :
                        "bg-rose-50 text-rose-600 border-rose-200"
                      )}>
                        {statusValue}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs">{expiryDate.toLocaleDateString('en-GB')}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => onEdit(tx)}
                          className="bg-blue-500 p-2 text-white rounded-lg flex items-center justify-center hover:bg-blue-600 transition-all shadow-md active:scale-90"
                          title="Edit Transaction"
                        >
                          <Pencil size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(tx.id!)}
                          className="bg-red-500 p-2 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all shadow-md active:scale-90"
                          title="Delete Transaction"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-6 py-12 text-center text-gray-400 italic">No collection records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Modal Overlay */}
      <AnimatePresence>
        {selectedInvoiceTx && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col relative text-gray-800"
            >
              {/* Green/Red accent top line */}
              <div className="h-2 bg-gradient-to-r from-red-500 to-emerald-500"></div>
              
              <div className="p-8 flex-1 overflow-y-auto">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    {/* Brand header */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#002d2d] rounded-xl flex items-center justify-center text-white font-black shadow-lg">
                        <Activity className="text-emerald-400 w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-gray-950 tracking-tight">RED GREEN ONLINE</h2>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Reseller ISP Network</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Stamp Badge */}
                  <div className="text-right border-2 border-emerald-500 bg-emerald-50/20 rounded-2xl p-3 inline-block rotate-6">
                    <span className="text-emerald-500 font-black text-lg tracking-widest uppercase">PAID STATUS</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 border-y border-gray-100 py-6 mb-8 text-sm">
                  <div>
                    <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-2">Invoice To</h4>
                    <p className="font-extrabold text-gray-900 text-base">{selectedInvoiceTx.customerName || 'N/A'}</p>
                    <p className="text-gray-500 font-medium font-mono">User: @{selectedInvoiceTx.customerId || 'N/A'}</p>
                    <p className="text-gray-500 font-medium">Phone: {(() => {
                      const cust = customers.find(c => c.username === selectedInvoiceTx.customerId);
                      return cust?.phone || 'N/A';
                    })()}</p>
                    <p className="text-gray-500 font-medium truncate max-w-[280px]">Address: {(() => {
                      const cust = customers.find(c => c.username === selectedInvoiceTx.customerId);
                      return cust?.address || 'N/A';
                    })()}</p>
                  </div>
                  <div className="text-right">
                    <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-2">Invoice Details</h4>
                    <p className="font-bold text-gray-800">Invoice ID: <span className="font-mono text-emerald-600 font-extrabold">INV-{selectedInvoiceNumber}</span></p>
                    <p className="text-gray-500">Date: {(() => {
                      const d = selectedInvoiceTx.date?.toDate ? selectedInvoiceTx.date.toDate() : new Date(selectedInvoiceTx.date);
                      return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'});
                    })()}</p>
                    <p className="text-gray-500">Collector: {selectedInvoiceTx.recordedBy || 'Admin'}</p>
                    <p className="text-gray-500">Method: <span className="font-bold text-blue-600">{selectedInvoiceTx.method}</span></p>
                  </div>
                </div>

                {/* Items list */}
                <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-3">Billing itemized receipt</h4>
                <div className="border border-gray-100 rounded-2xl overflow-hidden mb-8">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100">
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Rent</th>
                        <th className="px-4 py-3 text-right">Discount</th>
                        <th className="px-4 py-3 text-right">Total Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <tr className="font-medium text-gray-700">
                        <td className="px-4 py-4">
                          <p className="font-bold text-gray-900">ISP Broadband Service Renewal</p>
                          <p className="text-xs text-gray-400">Monthly subscription extension for package: {(() => {
                            const cust = customers.find(c => c.username === selectedInvoiceTx.customerId);
                            return cust?.packageName || 'Default Package';
                          })()}</p>
                        </td>
                        <td className="px-4 py-4 text-right">৳{selectedInvoiceTx.amount + (selectedInvoiceTx.discount || 0)}</td>
                        <td className="px-4 py-4 text-right">৳{selectedInvoiceTx.discount || 0}</td>
                        <td className="px-4 py-4 text-right font-bold text-emerald-600">৳{selectedInvoiceTx.amount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end mb-6">
                  <div className="w-72 space-y-2 text-sm">
                    <div className="flex justify-between font-medium text-gray-500">
                      <span>Subtotal amount</span>
                      <span>৳{selectedInvoiceTx.amount + (selectedInvoiceTx.discount || 0)}</span>
                    </div>
                    <div className="flex justify-between font-medium text-gray-500">
                      <span>Discount deduction</span>
                      <span className="text-red-500 font-bold">-৳{selectedInvoiceTx.discount || 0}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-base text-gray-950 border-t border-gray-100 pt-2">
                      <span>Grand Paid Amount</span>
                      <span className="text-emerald-600 text-lg">৳{selectedInvoiceTx.amount}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50 text-emerald-800 rounded-2xl p-4 text-center text-xs font-bold leading-relaxed border border-emerald-100/30">
                  Subscription successfully extended for 30 Days. Next renewal date set to {(() => {
                    const txDate = selectedInvoiceTx.date?.toDate ? selectedInvoiceTx.date.toDate() : new Date(selectedInvoiceTx.date);
                    const expiryDate = new Date(txDate);
                    expiryDate.setMonth(expiryDate.getMonth() + 1);
                    return expiryDate.toLocaleDateString('en-GB');
                  })()}.
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-4">
                <button 
                  onClick={() => {
                    window.print();
                  }}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 transition-colors text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 active:scale-95"
                >
                  <FileText size={18} /> Print Invoice
                </button>
                <button 
                  onClick={() => setSelectedInvoiceTx(null)}
                  className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors font-bold text-sm rounded-xl active:scale-95"
                >
                  Close Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal for Billing Record */}
      <AnimatePresence>
        {deleteDialog.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteDialog({ isOpen: false, id: null })}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-gray-150 overflow-hidden text-center z-10"
            >
              <div className="absolute top-4 right-4">
                <button 
                  onClick={() => setDeleteDialog({ isOpen: false, id: null })}
                  className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Top Warning Icon block */}
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 mb-2">Are you sure?</h3>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                Are you sure you want to remove this recharge record? This action cannot be undone.
              </p>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteDialog({ isOpen: false, id: null })}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all active:scale-95 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all active:scale-95 text-sm shadow-lg shadow-red-600/20"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PackagesView({ packages, onAdd, onEdit }: { packages: Package[]; onAdd: () => void; onEdit: (pkg: Package) => void }) {
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null; name: string | null }>({ isOpen: false, id: null, name: null });

  const handleDelete = (id: string, name: string) => {
    setDeleteDialog({ isOpen: true, id, name });
  };

  const confirmDelete = async () => {
    if (deleteDialog.id) {
      try {
        await deleteDoc(doc(db, 'packages', deleteDialog.id));
      } catch (err) {
        console.error(err);
      }
    }
    setDeleteDialog({ isOpen: false, id: null, name: null });
  };

  const getPackageIcon = (speed: string) => {
    const s = speed.toLowerCase();
    if (s.includes('100') || s.includes('high')) return <Rocket size={24} className="text-emerald-500" />;
    if (s.includes('50') || s.includes('fast')) return <Zap size={24} className="text-amber-500" />;
    if (s.includes('30') || s.includes('basic')) return <Wifi size={24} className="text-blue-500" />;
    if (s.includes('fiber')) return <Cpu size={24} className="text-purple-500" />;
    return <Globe size={24} className="text-gray-400" />;
  };

  const getPackageTheme = (speed: string) => {
    const s = speed.toLowerCase();
    if (s.includes('100') || s.includes('high')) return 'border-emerald-500 bg-emerald-50/10';
    if (s.includes('50') || s.includes('fast')) return 'border-amber-500 bg-amber-50/10';
    if (s.includes('30') || s.includes('basic')) return 'border-blue-500 bg-blue-50/10';
    if (s.includes('fiber')) return 'border-purple-500 bg-purple-50/10';
    return 'border-gray-200 bg-gray-50/10';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Service Packages</h2>
          <p className="text-sm text-gray-400">Manage your internet service plans</p>
        </div>
        <button 
          onClick={onAdd}
          className="bg-[#002d2d] text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#003d3d] shadow-lg transition-all active:scale-95"
        >
          <Plus size={18} /> New Package
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {packages.map((pkg) => (
          <div 
            key={pkg.id} 
            className={cn(
              "bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-lg transition-all border-t-4 group relative",
              getPackageTheme(pkg.speed)
            )}
          >
            {pkg.isPopular && (
              <div className="absolute -top-3 left-6 px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-lg flex items-center gap-1 z-10">
                <Star size={10} fill="currentColor" />
                Popular
              </div>
            )}
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => onEdit(pkg)}
                className="p-2 bg-white/90 shadow-sm border border-gray-100 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                title="Edit Package"
              >
                <Pencil size={14} />
              </button>
              <button 
                onClick={() => handleDelete(pkg.id!, pkg.name)}
                className="p-2 bg-white/90 shadow-sm border border-gray-100 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                title="Delete Package"
              >
                <UserX size={14} />
              </button>
            </div>

            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{pkg.name}</h3>
                <p className="text-gray-500 font-medium text-xs mt-1 uppercase tracking-widest">{pkg.speed}</p>
              </div>
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-50">
                {getPackageIcon(pkg.speed)}
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-6 h-12 overflow-hidden line-clamp-2">
              {pkg.description || 'Enterprise-grade stable connection for all your devices.'}
            </p>
            <div className="flex items-center justify-between pt-6 border-t border-gray-50">
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Starting from</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold text-gray-900">৳{pkg.price}</p>
                  <span className="text-xs text-gray-400">/mo</span>
                </div>
              </div>
              <button className="px-4 py-2 bg-[#002d2d] text-white rounded-xl text-xs font-bold hover:bg-[#003d3d] transition-all active:scale-95">
                Select Plan
              </button>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Custom Confirmation Modal for Package Record */}
      <AnimatePresence>
        {deleteDialog.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteDialog({ isOpen: false, id: null, name: null })}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-gray-150 overflow-hidden text-center z-10"
            >
              <div className="absolute top-4 right-4">
                <button 
                  onClick={() => setDeleteDialog({ isOpen: false, id: null, name: null })}
                  className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Top Warning Icon block */}
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 mb-2">Are you sure?</h3>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                Are you sure you want to delete the package <strong className="text-red-650 font-bold">"{deleteDialog.name}"</strong>? This will not affect existing customers but they will be linked to a missing package.
              </p>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteDialog({ isOpen: false, id: null, name: null })}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all active:scale-95 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all active:scale-95 text-sm shadow-lg shadow-red-600/20"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsView({ user, hasPermission, branding }: { user: any; hasPermission: (module: string, action: 'read' | 'create' | 'edit' | 'delete') => boolean; branding: LogoConfig }) {
  const [activeTab, setActiveTab] = useState<'system' | 'permissions' | 'admins' | 'sms' | 'logo'>('system');
  const [showAddAdmin, setShowAddAdmin] = useState(false);

  const canAccessHR = hasPermission('HR Admin', 'read');

  const [copied, setCopied] = useState(false);
  const portalUrl = `${window.location.origin}${window.location.pathname}?portal=customer`;

  const copyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* settings tab navigation */}
      <div className="bg-white p-2 rounded-2xl flex flex-wrap border border-gray-100 shadow-sm gap-1">
        <button
          onClick={() => setActiveTab('system')}
          className={cn(
            "flex-1 min-w-[120px] py-3 text-xs md:text-sm font-bold rounded-xl transition-all",
            activeTab === 'system' ? "bg-[#002d2d] text-white" : "text-gray-500 hover:text-[#002d2d] hover:bg-gray-50"
          )}
        >
          General Settings
        </button>
        <button
          onClick={() => setActiveTab('logo')}
          className={cn(
            "flex-1 min-w-[120px] py-3 text-xs md:text-sm font-bold rounded-xl transition-all",
            activeTab === 'logo' ? "bg-[#002d2d] text-white" : "text-gray-500 hover:text-[#002d2d] hover:bg-gray-50"
          )}
        >
          ব্র্যান্ড ও লোগো (Branding)
        </button>
        <button
          onClick={() => setActiveTab('sms')}
          className={cn(
            "flex-1 min-w-[120px] py-3 text-xs md:text-sm font-bold rounded-xl transition-all",
            activeTab === 'sms' ? "bg-[#002d2d] text-white" : "text-gray-500 hover:text-[#002d2d] hover:bg-gray-50"
          )}
        >
          SMS Gateway & Receipts
        </button>
        {canAccessHR && (
          <>
            <button
              onClick={() => setActiveTab('permissions')}
              className={cn(
                "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                activeTab === 'permissions' ? "bg-[#002d2d] text-white" : "text-gray-500 hover:text-[#002d2d] hover:bg-gray-50"
              )}
            >
              Role & Permissions
            </button>
            <button
              onClick={() => {
                setActiveTab('admins');
                setShowAddAdmin(false);
              }}
              className={cn(
                "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                activeTab === 'admins' ? "bg-[#002d2d] text-white" : "text-gray-500 hover:text-[#002d2d] hover:bg-gray-50"
              )}
            >
              Admin List
            </button>
          </>
        )}
      </div>

      {activeTab === 'system' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">System Settings</h3>
          
          <div className="space-y-8">
            {/* Shareable Client Link */}
            <section className="bg-gradient-to-r from-[#002d2d] to-[#014141] text-white p-6 rounded-3xl border border-emerald-950 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500 text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Secure Client Portal URL</span>
                  <h4 className="font-bold text-base flex items-center gap-1">🔗 শেয়ারযোগ্য গ্রাহক বিলিং পোর্টাল লিঙ্ক</h4>
                </div>
                <p className="text-xs text-teal-100 leading-relaxed max-w-2xl">
                  এই লিংকটি কাস্টমারদের এসএমএস বা ওয়াটসঅ্যাপে পাঠালে তারা সরাসরি নিজের বিলিং হিস্ট্রি ও পেমেন্ট রকেস্ট পোর্টাল পাবেন। এই পোর্টালে আপনার স্টাফ/এডমিন লগইন সম্পূর্ণভাবে <b>আড়ালে (Hidden)</b> থাকবে।
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-[#001717]/60 border border-white/10 px-4 py-2.5 rounded-xl font-mono text-xs select-all text-emerald-300 truncate max-w-[180px] md:max-w-xs">
                  {portalUrl}
                </div>
                <button 
                  type="button"
                  onClick={copyLink}
                  className="p-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-xl transition-all cursor-pointer flex items-center gap-1.5 font-bold text-xs shrink-0 shadow-sm"
                >
                  {copied ? (
                    <>
                      <CheckCircle size={14} className="text-white" />
                      কপি হয়েছে
                    </>
                  ) : (
                    <>
                      <Copy size={14} className="text-white" />
                      কপি করুন
                    </>
                  )}
                </button>
                <a 
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer shrink-0 border border-white/5"
                  title="লিংকটি পরখ করুন"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </section>

            <section>
              <h4 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
                <Activity className="text-[#002d2d]" size={18} />
                ISP Configuration
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between gap-3 text-left">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Company Name</p>
                    <p className="font-bold text-gray-900">{branding?.companyName || 'ISP RADIAL'}</p>
                  </div>
                  {branding?.useCustomLogo && branding?.logoUrl && (
                    <div className="w-10 h-10 bg-white border border-gray-150 rounded-xl flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-sm">
                      <img src={branding.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Contact Email</p>
                  <p className="font-bold text-gray-900">{user?.email}</p>
                </div>
              </div>
            </section>

            <section className="pt-6 border-t border-gray-100">
              <h4 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
                <ShieldCheck className="text-[#002d2d]" size={18} />
                নিরাপত্তা ও লগইন সিস্টেম নিয়ন্ত্রণ (Login & Access Systems)
              </h4>
              <p className="text-gray-500 text-sm mb-4 leading-relaxed">
                এই সিস্টেমে দুই স্তরের অ্যাক্সেস কন্ট্রোল বলবৎ রয়েছে। স্টাফ/এডমিনরা সম্পূর্ণ ড্যাশবোর্ড এবং সংযোগ নিয়ন্ত্রণ করতে পারেন, এবং সাধারণ গ্রাহকরা তাদের বিল ও মেয়াদ দেখতে পারেন।
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-3 text-left">
                  <ShieldCheck size={24} className="text-emerald-600 mt-1" />
                  <div>
                    <h5 className="font-bold text-emerald-800 text-sm">সিস্টেম ইউজার ও এডমিন</h5>
                    <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                      অনুমোদিত স্টাফ/এডমিনরা সম্পূর্ণ সিস্টেমের টোটাল কন্ট্রোল পাবেন। তাঁরা গ্রাহক ডাটাবেজ, বিলিং, ফিন্যান্স লেজার ও রিচার্জ নিয়ন্ত্রণ করতে পারেন।
                    </p>
                  </div>
                </div>
                
                <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-3 text-left">
                  <User size={24} className="text-indigo-600 mt-1" />
                  <div>
                    <h5 className="font-bold text-indigo-800 text-sm">সাধারণ গ্রাহক / ইউজার পোর্টাল</h5>
                    <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                      গ্রাহকরা তাদের নির্দিষ্ট <b>User ID / Username</b> ও পাসওয়ার্ড দিয়ে গ্রাহক পোর্টালে লগইন করতে পারবেন। তাঁরা শুধু নিজ একাউন্ট ব্যবহার করতে পারবেন এবং রিচার্জ রিকোয়েস্ট দিতে পারবেন।
                    </p>
                  </div>
                </div>
              </div>

              {/* Dummy logins checklist for testing */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-left">
                <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3">লগইন টেস্ট করার ক্রেডেনশিয়াল গাইড (Demo Credentials)</h5>
                <p className="text-xs text-slate-500 mb-3">গ্রাহকরা পাসওয়ার্ড নিজে সেট করতে পারেন গ্রাহক ফর্ম থেকে। বাই-ডিফল্ট তাদের ইউজারনেম-ই তাদের পাসওয়ার্ড হিসেবে সেট থাকে:</p>
                <div className="space-y-2 text-xs text-slate-600 font-mono">
                  <div className="flex justify-between p-2.5 bg-white rounded-lg border border-slate-150">
                    <span>স্টাফ অ্যাডমিন (Google Auth Account):</span>
                    <span className="font-bold text-slate-800">Email: Google Sign In</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-white rounded-lg border border-slate-150">
                    <span>গ্রাহক ১ (User Rahim):</span>
                    <span className="font-bold text-indigo-800">User ID: rahim01 | Pass: rahim01</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-white rounded-lg border border-slate-150">
                    <span>গ্রাহক ২ (User Karim):</span>
                    <span className="font-bold text-indigo-800">User ID: karim_u | Pass: karim_u</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="p-6 bg-[#002d2d] rounded-3xl text-white text-left">
              <h4 className="text-lg font-bold mb-2">Need help?</h4>
              <p className="text-white/70 text-sm mb-4">
                Contact support for dedicated MikroTik integration or custom features for your ISP business.
              </p>
              <button className="px-6 py-2 bg-emerald-400 text-[#002d2d] rounded-xl font-bold hover:bg-emerald-300 transition-colors">
                Contact Support
              </button>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'permissions' && canAccessHR && (
        <RoleControlView />
      )}

      {activeTab === 'logo' && (
        <LogoConfigPanel />
      )}

      {activeTab === 'sms' && (
        <SMSConfigPanel />
      )}

      {activeTab === 'admins' && canAccessHR && (
        <>
          {showAddAdmin ? (
            <AdminFormView onComplete={() => setShowAddAdmin(false)} />
          ) : (
            <AdminListView onAdd={() => setShowAddAdmin(true)} />
          )}
        </>
      )}
    </motion.div>
  );
}

function RoleControlView() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions'>('roles');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [matrix, setMatrix] = useState<Record<string, any[]>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [newRole, setNewRole] = useState({ name: '', description: '', level: 50 });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'roles'), (snapshot) => {
      const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRoles(rolesData);
      
      // Initialize matrix state
      const newMatrix: Record<string, any[]> = {};
      rolesData.forEach(role => {
        newMatrix[role.id] = role.permissions || [
          { module: 'Customers', read: false, create: false, edit: false, delete: false },
          { module: 'Billing', read: false, create: false, edit: false, delete: false },
          { module: 'Finance', read: false, create: false, edit: false, delete: false },
          { module: 'Network', read: false, create: false, edit: false, delete: false },
          { module: 'HR Admin', read: false, create: false, edit: false, delete: false },
          { module: 'Settings', read: false, create: false, edit: false, delete: false },
        ];
      });
      setMatrix(newMatrix);
      
      if (!selectedRoleId && rolesData.length > 0) {
        setSelectedRoleId(rolesData[0].id);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'roles');
    });
    return () => unsub();
  }, []);

  const togglePermission = (roleId: string, moduleName: string, field: 'read' | 'create' | 'edit' | 'delete') => {
    setMatrix(prev => {
      const newMatrix = { ...prev };
      const rolePerms = [...(newMatrix[roleId] || [])];
      const index = rolePerms.findIndex(p => p.module === moduleName);
      if (index !== -1) {
        rolePerms[index] = { ...rolePerms[index], [field]: !rolePerms[index][field] };
        newMatrix[roleId] = rolePerms;
      }
      return newMatrix;
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedRoleId) return;
    try {
      await updateDoc(doc(db, 'roles', selectedRoleId), {
        permissions: matrix[selectedRoleId]
      });
      alert('Permissions updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save permissions');
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await updateDoc(doc(db, 'roles', editingRole.id), {
          ...newRole
        });
        setEditingRole(null);
      } else {
        await addDoc(collection(db, 'roles'), {
          ...newRole,
          status: 'active',
          members: 0,
          createdAt: Timestamp.now(),
          permissions: [
            { module: 'Customers', read: false, create: false, edit: false, delete: false },
            { module: 'Billing', read: false, create: false, edit: false, delete: false },
            { module: 'Finance', read: false, create: false, edit: false, delete: false },
            { module: 'Network', read: false, create: false, edit: false, delete: false },
            { module: 'HR Admin', read: false, create: false, edit: false, delete: false },
            { module: 'Settings', read: false, create: false, edit: false, delete: false },
          ]
        });
      }
      setIsCreating(false);
      setNewRole({ name: '', description: '', level: 50 });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-20 text-center text-gray-400">Loading roles...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Role Based Controlling</h1>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Home size={14} /> Home <ChevronRight size={14} /> <span className="text-blue-500">Role & Permissions</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button 
            onClick={() => setActiveTab('roles')}
            className={cn(
              "px-8 py-4 text-sm font-bold transition-all",
              activeTab === 'roles' ? "text-[#002d2d] border-b-2 border-[#002d2d]" : "text-gray-400 hover:text-gray-600"
            )}
          >
            Manage Roles
          </button>
          <button 
            onClick={() => setActiveTab('permissions')}
            className={cn(
              "px-8 py-4 text-sm font-bold transition-all",
              activeTab === 'permissions' ? "text-[#002d2d] border-b-2 border-[#002d2d]" : "text-gray-400 hover:text-gray-600"
            )}
          >
            Permission Matrix
          </button>
        </div>

        <div className="p-8">
          {activeTab === 'roles' ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">System Roles</h3>
                <button 
                  onClick={() => {
                    setIsCreating(true);
                    setEditingRole(null);
                    setNewRole({ name: '', description: '', level: 50 });
                  }}
                  className="bg-[#002d2d] text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#003d3d] transition-all shadow-lg active:scale-95"
                >
                  <Plus size={18} /> Create New Role
                </button>
              </div>

              {(isCreating || editingRole) && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-300"
                >
                  <form onSubmit={handleSaveRole} className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                    <div className="md:col-span-3 mb-2 flex items-center gap-2">
                       <h4 className="text-sm font-bold text-gray-900">{editingRole ? 'Edit Role Details' : 'New Role Details'}</h4>
                    </div>
                    <input 
                      required placeholder="Role Name (e.g. Sales)" 
                      value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})}
                      className="p-3 bg-white border border-gray-200 rounded-xl text-sm"
                    />
                    <input 
                      required placeholder="Description" 
                      value={newRole.description} onChange={e => setNewRole({...newRole, description: e.target.value})}
                      className="p-3 bg-white border border-gray-200 rounded-xl text-sm"
                    />
                    <div className="flex gap-2">
                       <input 
                        type="number" placeholder="Level (1-100)" 
                        value={newRole.level} onChange={e => setNewRole({...newRole, level: Number(e.target.value)})}
                        className="w-24 p-3 bg-white border border-gray-200 rounded-xl text-sm"
                      />
                      <button type="submit" className="flex-1 bg-emerald-500 text-white rounded-xl font-bold text-sm">
                        {editingRole ? 'Update Role' : 'Save Role'}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsCreating(false);
                          setEditingRole(null);
                        }} 
                        className="bg-gray-200 text-gray-600 px-4 rounded-xl font-bold text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.length === 0 ? (
                   <div className="col-span-full py-10 text-center text-gray-400 italic">No roles defined. Create your first role above.</div>
                ) : roles.map(role => (
                  <div key={role.id} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-emerald-500/30 hover:shadow-md transition-all group relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                          <Lock size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-900">{role.name}</h4>
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                              Lvl {role.level}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                          onClick={() => {
                            setEditingRole(role);
                            setNewRole({ name: role.name, description: role.description || '', level: role.level });
                            setIsCreating(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="p-2 text-gray-400 hover:text-emerald-600"
                         >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={async () => {
                            if (confirm('Delete this role?')) await deleteDoc(doc(db, 'roles', role.id));
                          }}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mb-6 line-clamp-2 h-10">
                      {role.description || 'No description provided.'}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Users size={14} />
                        <span className="text-xs font-medium">{role.members || 0} Members</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Active</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Define Module Access</h3>
                  <p className="text-xs text-gray-400">Configure what this role can see and do</p>
                </div>
                <select 
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="p-2.5 bg-gray-50 rounded-xl text-sm font-bold outline-none border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>Role: {r.name}</option>
                  ))}
                </select>
              </div>

              <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Module Name</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Read</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Create</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Update</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(matrix[selectedRoleId] || []).map(perm => (
                      <tr key={perm.module} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-700 text-sm">{perm.module}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <label className="inline-flex items-center cursor-pointer justify-center">
                            <input 
                              type="checkbox" 
                              checked={perm.read} 
                              onChange={() => togglePermission(selectedRoleId, perm.module, 'read')}
                              className="w-5 h-5 rounded border-gray-300 text-[#002d2d] focus:ring-[#002d2d]/20 cursor-pointer" 
                            />
                          </label>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <label className="inline-flex items-center cursor-pointer justify-center">
                            <input 
                              type="checkbox" 
                              checked={perm.create} 
                              onChange={() => togglePermission(selectedRoleId, perm.module, 'create')}
                              className="w-5 h-5 rounded border-gray-300 text-[#002d2d] focus:ring-[#002d2d]/20 cursor-pointer" 
                            />
                          </label>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <label className="inline-flex items-center cursor-pointer justify-center">
                            <input 
                              type="checkbox" 
                              checked={perm.edit} 
                              onChange={() => togglePermission(selectedRoleId, perm.module, 'edit')}
                              className="w-5 h-5 rounded border-gray-300 text-[#002d2d] focus:ring-[#002d2d]/20 cursor-pointer" 
                            />
                          </label>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <label className="inline-flex items-center cursor-pointer justify-center">
                            <input 
                              type="checkbox" 
                              checked={perm.delete} 
                              onChange={() => togglePermission(selectedRoleId, perm.module, 'delete')}
                              className="w-5 h-5 rounded border-gray-300 text-[#002d2d] focus:ring-[#002d2d]/20 cursor-pointer" 
                            />
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end pt-4">
                <button 
                  onClick={handleSavePermissions}
                  className="bg-[#2ecc71] text-white px-10 py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle size={18} />
                  Save Permission Matrix
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminFormView({ onComplete }: { onComplete: () => void }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    roleId: '',
    status: 'active'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'roles'), (snapshot) => {
      const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRoles(rolesData);
      if (rolesData.length > 0 && !formData.roleId) {
        setFormData(prev => ({ ...prev, roleId: rolesData[0].id }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'roles');
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.roleId) return alert('Please select a role');
    setLoading(true);
    try {
      await addDoc(collection(db, 'admins'), {
        ...formData,
        createdAt: Timestamp.now(),
        lastActive: Timestamp.now()
      });
      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Register New Admin</h1>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Home size={14} /> HR Admin <ChevronRight size={14} /> <span className="text-blue-500">Add New Admin</span>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-50">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <UserPlus size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Admin Staff Registration</h3>
            <p className="text-sm text-gray-400">Create login credentials for system administrators</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <User size={12} /> Staff Full Name
            </label>
            <input 
              required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-3.5 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white transition-all"
              placeholder="e.g. John Doe"
            />
          </div>
          <div className="space-y-1">
             <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <LogOut size={12} className="rotate-180" /> System Username
            </label>
            <input 
              required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
              className="w-full p-3.5 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white transition-all"
              placeholder="e.g. john_staff"
            />
          </div>
          <div className="space-y-1">
             <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <Globe size={12} /> Email Address
            </label>
            <input 
              type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full p-3.5 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white transition-all"
              placeholder="john@example.com"
            />
          </div>
          <div className="space-y-1">
             <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <ShieldCheck size={12} /> Assigned Role
            </label>
            <select 
              value={formData.roleId} onChange={e => setFormData({ ...formData, roleId: e.target.value })}
              className="w-full p-3.5 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">Select Role</option>
              {roles.map(role => (
                <option key={role.id} value={role.id}>{role.name} (Level {role.level})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
             <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <Lock size={12} /> Password
            </label>
            <input 
              type="password" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="w-full p-3.5 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white transition-all"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1">
             <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <Activity size={12} /> Account Status
            </label>
            <select 
              value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
              className="w-full p-3.5 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white transition-all cursor-pointer"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 mt-6 border-t border-gray-50 pt-8">
            <button type="button" onClick={onComplete} className="px-8 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-95">Cancel</button>
            <button type="submit" disabled={loading} className="px-10 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50">
              {loading ? 'Creating staff...' : 'Save Staff Account'}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

function AdminListView({ onAdd }: { onAdd: () => void }) {
  const [admins, setAdmins] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch roles first for lookup
    const unsubRoles = onSnapshot(collection(db, 'roles'), (snapshot) => {
      setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'roles');
    });

    const q = query(collection(db, 'admins'), orderBy('createdAt', 'desc'));
    const unsubAdmins = onSnapshot(q, (snapshot) => {
      setAdmins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'admins');
    });

    return () => {
      unsubRoles();
      unsubAdmins();
    };
  }, []);

  const getRoleName = (id: string) => {
    const role = roles.find(r => r.id === id);
    return role ? role.name : 'Unknown';
  };

  const getRoleColor = (id: string) => {
    const role = roles.find(r => r.id === id);
    if (!role) return 'bg-gray-100 text-gray-500';
    if (role.level >= 90) return 'bg-purple-50 text-purple-600 border border-purple-100';
    if (role.level >= 70) return 'bg-blue-50 text-blue-600 border border-blue-100';
    return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Management</h1>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Home size={14} /> HR Admin <ChevronRight size={14} /> <span className="text-blue-500">Staff List</span>
          </div>
        </div>
        <button onClick={onAdd} className="bg-[#002d2d] text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 shadow-xl shadow-emerald-100 transition-all hover:scale-105 active:scale-95">
          <UserPlus size={20} /> Add New Staff
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Staff Member</th>
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Username</th>
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Last Active</th>
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span className="font-medium animate-pulse">Loading staff data...</span>
                  </div>
                </td></tr>
              ) : admins.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400 italic">
                   <div className="flex flex-col items-center gap-2">
                    <UserX size={48} className="opacity-10 mb-2" />
                    <p className="font-medium">No admin staff registered yet</p>
                    <button onClick={onAdd} className="text-[#002d2d] font-bold text-sm underline">Register first staff</button>
                  </div>
                </td></tr>
              ) : admins.map(admin => (
                <tr key={admin.id} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg shadow-inner">
                        {admin.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{admin.name}</p>
                        <p className="text-xs text-gray-400">{admin.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm", getRoleColor(admin.roleId))}>
                      {getRoleName(admin.roleId)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono font-medium">{admin.username}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", admin.status === 'active' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500")} />
                      <span className={cn("text-[10px] font-bold uppercase", admin.status === 'active' ? "text-emerald-600" : "text-red-600")}>
                        {admin.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400 font-medium">
                    {admin.lastActive?.toDate ? admin.lastActive.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={async () => {
                         if (confirm('Delete this user?')) await deleteDoc(doc(db, 'admins', admin.id));
                      }}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button className="p-2 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all ml-1">
                      <Pencil size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CustomerPortalView({ customerId, onLogout }: { customerId: string; onLogout: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<LogoConfig>(DEFAULT_LOGO_CONFIG);

  useEffect(() => {
    getLogoConfig().then(setBranding).catch(err => console.error("Customer portal logos failed to load", err));
  }, []);
  
  // Custom states for recharge request
  const [rechargeMethod, setRechargeMethod] = useState('bKash');
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeTrxId, setRechargeTrxId] = useState('');
  const [rechargeNote, setRechargeNote] = useState('');
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [rechargeSuccess, setRechargeSuccess] = useState('');
  const [rechargeError, setRechargeError] = useState('');

  // Setup speed mock test state
  const [speedVal, setSpeedVal] = useState(0);
  const [testingSpeed, setTestingSpeed] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    
    // Live subscriber profile
    const unsubCust = onSnapshot(doc(db, 'customers', customerId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCustomer({ id: docSnap.id, ...data } as Customer);
        if (data.monthlyBill) {
          setRechargeAmount(String(data.monthlyBill));
        }
      }
      setLoading(false);
    });

    // Subscribed packages (for reference)
    const unsubPack = onSnapshot(collection(db, 'packages'), (snap) => {
      setPackages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Package)));
    });

    // User's own payment transactions
    const qTrx = query(collection(db, 'transactions'), where('customerId', '==', customerId), orderBy('date', 'desc'));
    const unsubTrx = onSnapshot(qTrx, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });

    return () => {
      unsubCust();
      unsubPack();
      unsubTrx();
    };
  }, [customerId]);

  const handleRequestRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargeAmount || Number(rechargeAmount) <= 0) {
      setRechargeError('সটীক রিচার্জ পরিমাণ উল্লেখ করুন!');
      return;
    }
    setRechargeError('');
    setRechargeSuccess('');
    setRechargeLoading(true);

    try {
      await addDoc(collection(db, 'transactions'), {
        customerId: customerId,
        customerName: customer?.name || 'Unknown',
        amount: Number(rechargeAmount),
        type: 'recharge',
        method: rechargeMethod,
        date: Timestamp.now(),
        status: 'pending',
        notes: rechargeTrxId ? `TrxID: ${rechargeTrxId}. ${rechargeNote}` : rechargeNote
      });

      setRechargeSuccess('আপনার পেমেন্ট রিকোয়েস্টটি সফলভাবে জমা হয়েছে এবং এটি পেন্ডিং অবস্থায় রয়েছে! এডমিন অনুমোদন করলে সংযোগ চালু হবে ক্যেটেগরিতে।');
      setRechargeTrxId('');
      setRechargeNote('');
    } catch (err: any) {
      console.error(err);
      setRechargeError('অনুরোধ পাঠাতে ব্যর্থ হয়েছে: ' + err.message);
    } finally {
      setRechargeLoading(false);
    }
  };

  const handleSpeedTest = () => {
    if (testingSpeed) return;
    setTestingSpeed(true);
    setSpeedVal(1);
    
    let currentSpeed = 1;
    const maxSpeed = customer?.packageName?.includes('Premium') ? 50 : customer?.packageName?.includes('Standard') ? 20 : 10;
    
    const interval = setInterval(() => {
      const increment = Math.random() * 8;
      currentSpeed += increment;
      if (currentSpeed >= maxSpeed) {
        currentSpeed = maxSpeed + (Math.random() * 2 - 1);
        clearInterval(interval);
        setTestingSpeed(false);
      }
      setSpeedVal(Math.round(currentSpeed * 10) / 10);
    }, 150);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm font-bold text-gray-500">গ্রাহক পোর্টাল লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  // Calculate days remaining
  let daysRemaining = 0;
  let isExpired = true;
  if (customer?.expiryDate) {
    const expDate = new Date(customer.expiryDate);
    const diff = expDate.getTime() - Date.now();
    daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
    isExpired = daysRemaining <= 0;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Top Client Navbar */}
      <nav className="sticky top-0 bg-[#002d2d] text-white py-4 px-6 md:px-12 flex items-center justify-between z-30 shadow-md">
        <div className="flex items-center gap-3">
          {branding.useCustomLogo && branding.logoUrl ? (
            <div className="w-10 h-10 bg-white border border-[#002d2d]/10 rounded-xl flex items-center justify-center p-1 shrink-0 overflow-hidden">
              <img src={branding.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="p-2 bg-emerald-400/20 rounded-xl">
              <Activity className="w-6 h-6 text-emerald-400" />
            </div>
          )}
          <div>
            <h1 className="font-extrabold text-lg md:text-xl tracking-tight truncate max-w-[150px] md:max-w-[250px]">{branding.companyName || 'ISP RADIAL'}</h1>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide">Client Portal / গ্রাহক সেলফ-সার্ভিস</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:block text-right">
            <p className="text-sm font-bold">{customer?.name}</p>
            <p className="text-[10px] text-white/50 uppercase font-black">User ID: {customer?.username}</p>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 bg-[#001717] hover:bg-red-950/80 hover:text-red-200 text-white/80 px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer border border-white/5"
          >
            <LogOut size={16} />
            <span>লগ আউট</span>
          </button>
        </div>
      </nav>

      <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-teal-900 via-[#002d2d] to-emerald-950 text-white rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-left">
            <h2 className="text-xl md:text-3xl font-extrabold tracking-tight">আসসালামু আলাইকুম, {customer?.name}! 🙋‍♂️</h2>
            <p className="text-teal-200 mt-2 text-sm md:text-base">{branding.companyName || 'আইএসপি রেডিয়াল'} গ্রাহক পোর্টালে আপনাকে স্বাগতম। এখান থেকে আপনার বিল পরিশোধ করুন ও সংযোগের বিবরণ দেখুন।</p>
          </div>
          
          <div className="flex items-center gap-3 bg-white/10 px-5 py-4 rounded-2xl border border-white/15">
            <div className={cn(
              "w-4 h-4 rounded-full animate-ping",
              customer?.status === 'active' ? "bg-emerald-400" : "bg-red-400"
            )} />
            <div className="text-left">
              <span className="text-[10px] font-bold text-teal-300 block">কানেকশন স্ট্যাটাস</span>
              <span className="text-sm md:text-base font-black uppercase tracking-wider">{customer?.status === 'active' ? 'চালু আছে (Active)' : 'বন্ধ আছে (Expired)'}</span>
            </div>
          </div>
        </div>

        {/* Info Cards Row (Bento Style) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: My internet Package details */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="space-y-4 text-left">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Wifi size={24} />
                </div>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-black px-3 py-1 rounded-full uppercase">আমার প্যাকেজ</span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">{customer?.packageName}</h3>
                <p className="text-indigo-600 font-extrabold text-sm mt-1">ইন্টারনেট গতি: {
                  packages.find(p => p.id === customer?.packageId)?.speed || '10 Mbps'
                }</p>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-400 font-bold">মাসিক বিল</span>
              <span className="font-black text-lg text-indigo-700">৳{customer?.monthlyBill}/-</span>
            </div>
          </div>

          {/* Card 2: Expiration timer */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="space-y-4 text-left">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                  <Clock size={24} />
                </div>
                <span className="bg-rose-50 text-rose-700 text-xs font-black px-3 py-1 rounded-full uppercase">বিল ও মেয়াদ</span>
              </div>
              
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {isExpired ? 'মেয়াদ শেষ!' : `${daysRemaining} দিন অবশিষ্ট`}
                </h3>
                <p className="text-rose-600 font-bold text-xs mt-1">
                  মেয়াদ পার হওয়ার তারিখ: {customer?.expiryDate ? new Date(customer.expiryDate).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
                </p>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-400 font-bold">শেষ চার্জিং তারিখ</span>
              <span className="font-bold text-slate-700">{
                customer?.expiryDate ? new Date(new Date(customer.expiryDate).getTime() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('bn-BD') : 'N/A'
              }</span>
            </div>
          </div>

          {/* Card 3: Connection IP Information and Profile details */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="space-y-4 text-left">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <Globe size={24} />
                </div>
                <span className="bg-emerald-50 text-emerald-700 text-xs font-black px-3 py-1 rounded-full uppercase">সংযোগ বিবরণী</span>
              </div>
              
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold text-xs">আইপি এড্রেস (IP):</span>
                  <span className="font-mono text-emerald-750 font-bold">{customer?.ipAddress || '192.168.10.22 (DHCP)'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold text-xs">ম্যাক এড্রেস (MAC):</span>
                  <span className="font-mono text-emerald-750 font-bold">{customer?.macAddress || 'A4:1F:D5:78:B2:91'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold text-xs">রিসেন্ট এরিয়া (Area):</span>
                  <span className="font-bold text-slate-700">{customer?.area || 'বনানী কমার্শিয়ার এরিয়া'}</span>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-400 font-bold">মোবাইল নম্বর</span>
              <span className="font-bold text-slate-700">{customer?.phone}</span>
            </div>
          </div>
        </div>

        {/* Speed Diagnostics & Recharge Requests (Interactive Panel) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Quick Recharge Request Form (Client Side Entry) */}
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 text-left">
            <h3 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 mb-2">
              <CreditCard size={20} className="text-[#002d2d]" />
              <span>সহজ রিচার্জ রিকোয়েস্ট (Quick Bill Payment)</span>
            </h3>
            <p className="text-slate-400 text-xs md:text-sm mb-6">নীচে উল্লেখিত পেমেন্ট নম্বরে সেন্ড মানি বা ক্যাশ পেমেন্ট করে ফর্মটি পূরণ করুন:</p>

            {rechargeSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800 font-bold text-xs md:text-sm mb-4 leading-relaxed">
                {rechargeSuccess}
              </div>
            )}

            {rechargeError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 font-bold text-xs md:text-sm mb-4">
                {rechargeError}
              </div>
            )}

            <form onSubmit={handleRequestRecharge} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">পেমেন্ট মেথড (Method)</label>
                  <select
                    value={rechargeMethod}
                    onChange={(e) => setRechargeMethod(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="bKash">bKash (বিকাশ) - ০১৭XXXXXXXX</option>
                    <option value="Nagad">Nagad (নগদ) - ০১৯XXXXXXXX</option>
                    <option value="Rocket">Rocket (রকেট) - ০১৮XXXXXXXX</option>
                    <option value="Cash">Cash Handover (ক্যাশ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">রিচার্জের পরিমাণ (Amount)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 500"
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">গ্রাহক ট্রানজেকশন আইডি (bKash/Nagad TrxID)</label>
                <input
                  type="text"
                  placeholder="e.g. 9KDLSD09K"
                  value={rechargeTrxId}
                  onChange={(e) => setRechargeTrxId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-[#002d2d]/10 font-mono font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">মন্তব্য বা বিবরণ (Comments/Notes)</label>
                <textarea
                  placeholder="কোনো অতিরিক্ত নির্দেশিকা থাকলে এখানে টাইপ করুন..."
                  value={rechargeNote}
                  rows={2}
                  onChange={(e) => setRechargeNote(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={rechargeLoading}
                className="w-full bg-[#002d2d] hover:bg-[#003d3d] text-white py-4 rounded-xl font-bold text-sm select-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-6 shadow-lg shadow-[#002d2d]/10"
              >
                {rechargeLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span>রিচার্জ অনুরোধ জমা দিন (Submit Request)</span>
                    <Rocket size={16} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Speed test meter mock */}
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col justify-between text-left">
            <div>
              <h3 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 mb-2">
                <Zap size={20} className="text-amber-550 animate-pulse" />
                <span>আইএসপি ব্যান্ডউইথ সেলফ-টেস্ট (Speed Diagnostics)</span>
              </h3>
              <p className="text-slate-400 text-xs md:text-sm mb-6">আপনার ইন্টারনেট গতির রিয়েল-টাইম পারফরম্যান্স ও ট্রাফিকের লাইভ ক্যালিব্রেশন মেজারমেন্ট টেস্ট করুন:</p>
            </div>

            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="relative w-40 h-40 rounded-full border-8 border-slate-100 flex items-center justify-center bg-gradient-to-tr from-slate-50 to-slate-100 shadow-inner">
                <div className="text-center">
                  <span className="text-4xl font-black text-slate-800 tracking-tight block">
                    {speedVal > 0 ? speedVal : '0.0'}
                  </span>
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#002d2d] block mt-1">Mbps</span>
                </div>
                
                {/* Visual needle rotation for fun */}
                <div 
                  className="absolute w-1 h-14 bg-[#002d2d] rounded-full origin-bottom bottom-1/2 left-1/2 -ml-0.5 transition-transform duration-500" 
                  style={{ transform: `rotate(${Math.min(180, (speedVal / 60) * 180 - 90)}deg)` }}
                />
              </div>

              <button
                type="button"
                onClick={handleSpeedTest}
                disabled={testingSpeed}
                className="bg--200 bg-[#002d2d]/5 hover:bg-[#002d2d]/10 text-[#002d2d] font-black text-xs px-6 py-3 rounded-xl transition-all cursor-pointer select-none active:scale-95 uppercase tracking-wider"
              >
                {testingSpeed ? 'গতি পরিমাপ হচ্ছে...' : 'স্পিড টেস্ট শুরু করুন (Run Diagnostics)'}
              </button>
            </div>

            <p className="text-[10px] text-center text-slate-400 mt-4">Note: This is a fast, ping diagnostics based utility connecting directly to {branding.companyName || 'ISP RADIAL'} local edge caching node.</p>
          </div>
        </div>

        {/* Transactions list Table */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 text-left">
          <h3 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 mb-6">
            <TrendingUp size={20} className="text-teal-600" />
            <span>আমার রিচার্জ / বিল পেমেন্ট ইতিহাস (Payment Invoices)</span>
          </h3>

          {transactions.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
              <CreditCard size={48} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">আপনার কোনো লেনদেন রেকর্ড পাওয়া যায়নি!</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-extrabold text-xs uppercase border-b border-slate-100">
                    <th className="px-6 py-4">রিচার্জের তারিখ</th>
                    <th className="px-6 py-4">পেমেন্ট মেথড</th>
                    <th className="px-6 py-4">ধরণ ও রেফারেন্স</th>
                    <th className="px-6 py-4 text-center">পরিমাণ</th>
                    <th className="px-6 py-4 text-center">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {transactions.map((trx) => (
                    <tr key={trx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-600">
                        {trx.date ? new Date(trx.date.seconds ? trx.date.seconds * 1000 : trx.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-black text-slate-800">
                        {trx.method}
                      </td>
                      <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                        <span className="font-semibold block text-slate-700 capitalize">{trx.type === 'monthly_bill' ? 'মাসিক বিল পেমেন্ট' : 'অফলাইন রিচার্জ'}</span>
                        <span className="text-[10px] block font-mono">{trx.notes || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 text-center font-black text-slate-800">
                        ৳{trx.amount}/-
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-black inline-block uppercase",
                          trx.status === 'paid' && "bg-emerald-50 text-emerald-700",
                          trx.status === 'pending' && "bg-amber-50 text-amber-700",
                          trx.status === 'overdue' && "bg-rose-50 text-rose-700"
                        )}>
                          {trx.status === 'paid' ? 'সফল (Paid)' : trx.status === 'pending' ? 'পেন্ডিং (Pending)' : 'বকেয়া'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

