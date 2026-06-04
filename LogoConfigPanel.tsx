import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Building, 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Activity, 
  UploadCloud, 
  Sparkles,
  Info
} from 'lucide-react';
import { LogoConfig } from './types';
import { getLogoConfig, saveLogoConfig, DEFAULT_LOGO_CONFIG } from './logoService';
import { cn } from './utils';

type LogoConfigPanelProps = {
  onBrandingChange?: () => void;
};

export function LogoConfigPanel({ onBrandingChange }: LogoConfigPanelProps) {
  const [config, setConfig] = useState<LogoConfig>(DEFAULT_LOGO_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load configuration
  const loadConfig = async () => {
    setLoading(true);
    try {
      const conf = await getLogoConfig();
      setConfig(conf);
    } catch (err) {
      console.error("Failed to load branding settings", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Handle Drag-and-Drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Convert File to Base64
  const processFile = (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate type
    if (!file.type.startsWith('image/')) {
      setErrorMessage("শুধুমাত্র ইমেজ ফাইল (PNG, JPG, JPEG, SVG) আপলোড করতে পারবেন।");
      return;
    }

    // Validate size (limit to 250KB to prevent Firestore bloated text document lag)
    if (file.size > 250 * 1024) {
      setErrorMessage("ফাইলের সাইজ অনেক বড় (সর্বোচ্চ ২৫০ কেবি)। ডাটাবেজের পারফরম্যান্স সচল রাখতে ছোট ইমেজ বা লোগো আপলোড করুন।");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setConfig(prev => ({
        ...prev,
        logoUrl: base64String,
        useCustomLogo: true
      }));
      setSuccessMessage("লোগোটি সফলভাবে আপলোড করা হয়েছে! পরিবর্তনগুলো স্থায়ী করতে নিচে সেভ করুন।");
    };
    reader.onerror = () => {
      setErrorMessage("ফাইলটি প্রসেস করতে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Save branding parameters
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (config.useCustomLogo && !config.logoUrl) {
      setErrorMessage("দয়া করে লোগো ফাইলটি সিলেক্ট অথবা ড্র্যাগ-ড্রপ করুন অথবা 'ক্ল্যাসিক আইকন' মুড সক্রিয় রাখুন।");
      setSaving(false);
      return;
    }

    try {
      const ok = await saveLogoConfig(config);
      if (ok) {
        setSuccessMessage("অভিনন্দন! আপনার কোম্পানির নতুন লোগো ও ব্র্যান্ড সেটিং সফলভাবে ডাটাবেজে সেভ হয়েছে।");
        if (onBrandingChange) {
          onBrandingChange();
        }
        // Emit custom event so topbars/sidebars update globally
        window.dispatchEvent(new Event('branding-updated'));
      } else {
        setErrorMessage("ব্র্যান্ড সেটিং সেভ করতে ডাটাবেজে ত্রুটি দেখা দিয়েছে।");
      }
    } catch (err: any) {
      setErrorMessage("ত্রুটি: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Reset to factory defaults
  const handleResetDefaults = async () => {
    if (confirm("আপনি কি নিশ্চিতভাবে এই কাস্টম ব্র্যান্ডিং এবং লোগো সরিয়ে ফ্যাক্টরি ডিফল্ট 'ISP RADIAL' থিমে ফিরে যেতে চান?")) {
      setSaving(true);
      try {
        const ok = await saveLogoConfig(DEFAULT_LOGO_CONFIG);
        if (ok) {
          setConfig(DEFAULT_LOGO_CONFIG);
          setSuccessMessage("ব্র্যান্ড সেটিংস ডিফল্ট মোডে রিসেট করা হয়েছে!");
          if (onBrandingChange) {
            onBrandingChange();
          }
          window.dispatchEvent(new Event('branding-updated'));
        }
      } catch (err: any) {
        setErrorMessage("রিসেট ব্যর্থ হয়েছে: " + err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden text-left">
      {/* Panel Header */}
      <div className="bg-[#002d2d] p-6 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl">
            <Building size={22} className="text-emerald-400" />
          </div>
          <div>
            <h4 className="font-bold text-lg">কোম্পানি লোগো ও ব্র্যান্ড সেটিংস</h4>
            <p className="text-xs text-white/70">আপনার কোম্পানির লোগো আপলোড করুন এবং ব্র্যান্ডের নাম সাদা সিলমোহর (White-label) করুন</p>
          </div>
        </div>
        
        <button 
          onClick={loadConfig} 
          disabled={loading}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer"
          title="রিফ্রেশ করুন"
        >
          <RefreshCw size={16} className={cn(loading && "animate-spin")} />
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 italic flex flex-col items-center justify-center gap-2">
          <RefreshCw size={32} className="text-[#002d2d] animate-spin" />
          <span>ব্র্যান্ড সেটিংস লোড হচ্ছে...</span>
        </div>
      ) : (
        <div className="p-8 space-y-8">
          <form onSubmit={handleSaveBranding} className="space-y-6">
            
            {/* Input fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Branding Info Column */}
              <div className="space-y-6">
                
                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">কোম্পানি / আইএসপির নাম (Company Brand Name)</label>
                  <input 
                    type="text" 
                    required
                    value={config.companyName}
                    onChange={e => setConfig({ ...config, companyName: e.target.value })}
                    placeholder="যেমনঃ ISP RADIAL, SpeedNet Ltd"
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-[#002d2d]/15 focus:bg-white transition-all outline-none"
                  />
                  <p className="text-[10px] text-gray-400">এই নামটি ড্যাশবোর্ড, কাস্টমার পোর্টাল এবং সিস্টেমের সব জায়গায় স্বয়ংক্রিয়ভাবে আপডেট হবে।</p>
                </div>

                {/* Logo Show Switch */}
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-gray-900 text-sm">কাস্টম ইমেজ লোগো প্রদর্শন</h5>
                    <p className="text-xs text-gray-400 mt-1">পছন্দসই আইকনের পরিবর্তে আপনার নিজস্ব আপলোডকৃত লোগো সচল করুন</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={config.useCustomLogo}
                      onChange={e => setConfig({ ...config, useCustomLogo: e.target.checked })}
                      className="sr-only peer cursor-pointer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {/* Performance Info Box */}
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-150 flex gap-2.5 items-start text-xs text-amber-800 leading-normal">
                  <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">লোগো অপটিমাইজেশন গাইড:</span>
                    ১. আমরা <b>PNG (Transparent)</b> অথবা <b>SVG</b> ফরম্যাট এবং স্কয়ার (1:1 ratio) ইমেজ ব্যবহার করতে সুপারিশ করছি।<br/>
                    ২. সর্বোচ্চ রিসোলিউশন ৫০০x৫০০ পিক্সেল এবং সাইজ <b>২৫০ কেবি</b> এর নিচে রাখলে ডাটা লোডিং দ্রুত হবে।
                  </div>
                </div>

              </div>

              {/* Upload Column */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">ইমেজ লোগো আপলোড জোন (Upload Logo Image)</label>
                
                {/* Drag Drop Area */}
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                  className={cn(
                    "relative border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer h-60",
                    dragActive ? "border-emerald-500 bg-emerald-50/20" : "border-gray-200 bg-gray-50/50 hover:bg-gray-55",
                    config.logoUrl && "border-solid border-emerald-400 bg-emerald-50/5"
                  )}
                >
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden" 
                  />

                  {config.logoUrl ? (
                    <div className="space-y-4">
                      <div className="relative w-28 h-28 bg-white border border-gray-100 rounded-2xl mx-auto flex items-center justify-center p-3 shadow-md">
                        <img 
                          src={config.logoUrl} 
                          alt="Company Uploaded Logo Preview" 
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfig(prev => ({ ...prev, logoUrl: '', useCustomLogo: false }));
                          }}
                          className="absolute -top-2 -right-2 p-1.5 bg-red-100 text-red-650 hover:bg-red-200 rounded-full transition-all border border-red-200"
                          title="সরিয়ে ফেলুন"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-600">রেডি টু সেভ: কাস্টম ব্যান্ডিং লোড সফল</p>
                        <p className="text-[10px] text-gray-400 mt-1">ইমেজটি পরিবর্তন করতে এখানে নতুন ফাইল ড্র্যাগ করুন বা ক্লিক করুন</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 bg-white rounded-2xl shadow-sm text-gray-400 inline-block mx-auto border border-gray-100">
                        <UploadCloud size={32} className="text-[#002d2d]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-700">ক্লিক করে অথবা ড্র্যাগ করে লোগো আপলোড করুন</p>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG ফাইলের সর্বোচ্চ সাইজ ২৫০ কেবি</p>
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Live Layout Mimic Previews */}
            <div className="pt-6 border-t border-gray-100">
              <h5 className="text-xs font-extrabold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" /> লাইভ ব্র্যান্ডিং লেআউট প্রিভিউ (Live Layout Preview Mimics)
              </h5>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Mimic Sidebar Logo */}
                <div className="p-5 bg-slate-900 text-white rounded-2xl border border-slate-850 flex flex-col justify-between h-40">
                  <span className="text-[9px] uppercase tracking-widest text-[#00ddc1] font-bold">১। এডমিন সাইডবার (Sidebar UI)</span>
                  <div className="flex items-center gap-3 bg-[#0a2323] p-3 rounded-xl border border-emerald-555/20 my-auto">
                    {config.useCustomLogo && config.logoUrl ? (
                      <div className="w-9 h-9 bg-white border border-[#0f3030]/10 rounded-lg flex items-center justify-center p-1 overflow-hidden">
                        <img src={config.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                    ) : (
                      <div className="p-1.5 bg-emerald-400/20 rounded-lg border border-emerald-400/30">
                        <Activity className="w-5 h-5 text-emerald-400" />
                      </div>
                    )}
                    <span className="font-extrabold text-md tracking-tighter truncate">{config.companyName || 'ISP RADIAL'}</span>
                  </div>
                </div>

                {/* Mimic Login Header */}
                <div className="p-5 bg-white rounded-2xl border border-gray-200 flex flex-col justify-between h-40 text-center shadow-sm">
                  <span className="text-[9px] uppercase tracking-widest text-indigo-600 font-bold block text-left">২। এডমিন লগইন গেট (Login Gateway)</span>
                  <div className="my-auto space-y-2">
                    {config.useCustomLogo && config.logoUrl ? (
                      <div className="w-14 h-14 bg-white border border-gray-100 rounded-xl flex items-center justify-center p-1.5 mx-auto shadow-sm">
                        <img src={config.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-tr from-[#002d2d] to-emerald-800 rounded-xl flex items-center justify-center mx-auto shadow">
                        <Activity className="text-emerald-400 w-6 h-6" />
                      </div>
                    )}
                    <h1 className="text-sm font-black text-slate-800 tracking-tight uppercase truncate">{config.companyName || 'ISP RADIAL'}</h1>
                  </div>
                </div>

                {/* Mimic Mobile Portals */}
                <div className="p-5 bg-slate-50 rounded-2xl border border-gray-200 flex flex-col justify-between h-40">
                  <span className="text-[9px] uppercase tracking-widest text-emerald-600 font-bold">৩। গ্রাহক সেলফ-সার্ভিস (Customer Portal)</span>
                  <div className="flex items-center justify-between bg-[#002d2d] text-white p-3 rounded-xl shadow-sm my-auto">
                    <div className="flex items-center gap-2">
                      {config.useCustomLogo && config.logoUrl ? (
                        <div className="w-7 h-7 bg-white border border-gray-200 rounded-md flex items-center justify-center p-0.5 overflow-hidden">
                          <img src={config.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="p-1 bg-emerald-400/20 rounded-md">
                          <Activity className="w-4 h-4 text-emerald-400" />
                        </div>
                      )}
                      <span className="font-extrabold text-xs tracking-tight truncate max-w-[100px]">{config.companyName || 'ISP RADIAL'}</span>
                    </div>
                    <span className="bg-emerald-500 text-white text-[7px] px-1.5 py-0.5 rounded-full font-bold">সচল</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Messages Area */}
            {errorMessage && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-semibold flex items-center gap-2.5 text-red-800">
                <XCircle size={18} className="text-red-500 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs font-semibold flex items-center gap-2.5 text-emerald-800">
                <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Buttons UI actions */}
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={saving}
                className="px-5 py-3 hover:bg-red-50 text-red-650 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-dashed border-red-200"
              >
                ডিফল্ট থিমে রিসেট করুন
              </button>
              
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-[#002d2d] hover:bg-[#003d3d] text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {saving ? 'ব্র্যান্ডিং সেভ হচ্ছে...' : 'পরিবর্তনগুলো সেভ করুন'}
              </button>
            </div>

          </form>
        </div>
      )}
    </div>
  );
}
