import { db } from './firebase';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';

export async function seedData() {
  const customerSnap = await getDocs(collection(db, 'customers'));
  if (!customerSnap.empty) return;

  console.log("Seeding initial data...");

  // Seed Roles
  const roles = [
    { 
      name: 'Super Admin', 
      description: 'Full access to all system features.', 
      level: 100, 
      status: 'active',
      members: 1,
      permissions: [
        { module: 'Customers', read: true, create: true, edit: true, delete: true },
        { module: 'Billing', read: true, create: true, edit: true, delete: true },
        { module: 'Finance', read: true, create: true, edit: true, delete: true },
        { module: 'Network', read: true, create: true, edit: true, delete: true },
        { module: 'HR Admin', read: true, create: true, edit: true, delete: true },
        { module: 'Settings', read: true, create: true, edit: true, delete: true },
      ]
    },
    { 
      name: 'Manager', 
      description: 'Operational management of customers and billing.', 
      level: 80, 
      status: 'active',
      members: 0,
      permissions: [
        { module: 'Customers', read: true, create: true, edit: true, delete: false },
        { module: 'Billing', read: true, create: true, edit: true, delete: false },
        { module: 'Finance', read: true, create: true, edit: true, delete: false },
        { module: 'Network', read: true, create: false, edit: false, delete: false },
        { module: 'HR Admin', read: false, create: false, edit: false, delete: false },
        { module: 'Settings', read: false, create: false, edit: false, delete: false },
      ]
    },
    { 
      name: 'Collector', 
      description: 'Field staff responsible for payment collection.', 
      level: 30, 
      status: 'active',
      members: 0,
      permissions: [
        { module: 'Customers', read: true, create: false, edit: false, delete: false },
        { module: 'Billing', read: true, create: true, edit: true, delete: false },
        { module: 'Finance', read: false, create: false, edit: false, delete: false },
        { module: 'Network', read: false, create: false, edit: false, delete: false },
        { module: 'HR Admin', read: false, create: false, edit: false, delete: false },
        { module: 'Settings', read: false, create: false, edit: false, delete: false },
      ]
    }
  ];

  for (const role of roles) {
    await addDoc(collection(db, 'roles'), { ...role, createdAt: Timestamp.now() });
  }

  // Seed Packages
  const p1 = await addDoc(collection(db, 'packages'), {
    name: 'Home Basic',
    speed: '10 Mbps',
    price: 500,
    description: 'Perfect for light browsing'
  });

  const p2 = await addDoc(collection(db, 'packages'), {
    name: 'Home Standard',
    speed: '20 Mbps',
    price: 800,
    description: 'Best for small families'
  });

  const p3 = await addDoc(collection(db, 'packages'), {
    name: 'Home Premium',
    speed: '50 Mbps',
    price: 1200,
    description: 'Gamers and heavy users'
  });

  // Seed Customers
  const c1 = await addDoc(collection(db, 'customers'), {
    name: 'Rahim Ahmed',
    username: 'rahim01',
    phone: '01711223344',
    address: 'Gulshan 2, Dhaka',
    status: 'active',
    packageId: p1.id,
    packageName: 'Home Basic',
    monthlyBill: 500,
    expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: Timestamp.now()
  });

  const c2 = await addDoc(collection(db, 'customers'), {
    name: 'Karim Ullah',
    username: 'karim_u',
    phone: '01911887766',
    address: 'Banani, Dhaka',
    status: 'active',
    packageId: p3.id,
    packageName: 'Home Premium',
    monthlyBill: 1200,
    expiryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: Timestamp.now()
  });

  const c3 = await addDoc(collection(db, 'customers'), {
    name: 'Sumon Khan',
    username: 'sumonk',
    phone: '01811554433',
    address: 'Uttara Sector 7, Dhaka',
    status: 'expired',
    packageId: p2.id,
    packageName: 'Home Standard',
    monthlyBill: 800,
    expiryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: Timestamp.now()
  });

  // Seed Transactions
  await addDoc(collection(db, 'transactions'), {
    customerId: c1.id,
    customerName: 'Rahim Ahmed',
    amount: 500,
    type: 'monthly_bill',
    method: 'bKash',
    date: Timestamp.now(),
    status: 'paid'
  });

  await addDoc(collection(db, 'transactions'), {
    customerId: c2.id,
    customerName: 'Karim Ullah',
    amount: 1200,
    type: 'recharge',
    method: 'Cash',
    date: Timestamp.now(),
    status: 'paid'
  });

  console.log("Seeding complete!");
}
