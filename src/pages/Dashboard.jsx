import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import ConversationList from '../components/ConversationList'
import PublicReviews from '../components/PublicReviews'
import NotificationCenter from '../components/NotificationCenter'
import ReviewSystem from '../components/ReviewSystem'

// ----- PRODUCTS (static metadata, stock comes from DB) -----
const PRODUCTS = [
  { id: "classic", name: "Classic Spam Musubi", desc: "Premium spam glazed with our signature teriyaki sauce.", price: 35, tag: "Best Seller", image: "/musubi.png" },
  { id: "kimchi",  name: "Kimchi Musubi",       desc: "Spam musubi with a spicy kimchi twist.", price: 45, tag: "New", image: "/musubi.png" },
  { id: "cheesy",  name: "Cheesy Musubi",        desc: "Classic spam musubi topped with melted cheese.", price: 50, tag: "Fan Favorite", image: "/musubi.png" },
  { id: "katsubi", name: "Katsubi",              desc: "Crispy katsu-style musubi with tonkatsu sauce.", price: 40, tag: "New", image: "/musubi.png" },
  { id: "ricebowl", name: "🍚 Rice Bowl Musubi",  desc: "Deconstructed musubi in a bowl – spam, rice, egg, and nori flakes.", price: 65, tag: "New", image: "/musubi.png" },
];

const SAUCES = [
  { value: "none",         label: "No sauce" },
  { value: "cheese sauce",   label: "🧄 Cheese Sauce" },
  { value: "japanesemayo", label: "🍶 Japanese Mayo" },
  { value: "gochujang",    label: "🔥 Gochujang" },
];

const DEPARTMENT_OPTIONS = [
  { value: "faculty", label: "👨‍🏫 Faculty" },
  { value: "admin", label: "📋 Admin Staff" },
  { value: "library", label: "📚 Library Staff" },
  { value: "security", label: "🛡️ Security" },
  { value: "maintenance", label: "🔧 Maintenance" },
  { value: "canteen", label: "🍽️ Canteen Staff" },
  { value: "guidance", label: "💬 Guidance Office" },
  { value: "registrar", label: "📝 Registrar" },
  { value: "it", label: "💻 IT Department" },
  { value: "others", label: "✨ Others" },
];

const generateTimeOptions = (slot) => {
  if (!slot) return [];
  const options = [];
  const startH = Math.floor(slot.start);
  const endH = Math.floor(slot.end);
  for (let h = startH; h <= endH; h++) {
    const minutes = h === endH ? [0] : [0, 15, 30, 45];
    for (let m of minutes) {
      if (h + m / 60 > slot.end) break;
      if (h + m / 60 < slot.start) continue;
      const period = h >= 12 ? "PM" : "AM";
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const displayM = m.toString().padStart(2, "0");
      options.push(`${displayH}:${displayM} ${period}`);
    }
  }
  return options;
};

// ----- STEP INDICATOR (from original) -----
const StepIndicator = ({ current, total, labels }) => (
  <div className="mb-8">
    <div className="flex items-center justify-between gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex-1">
          <div className={`h-1 rounded-full transition-all ${i + 1 <= current ? "bg-amber-400" : "bg-white/10"}`} />
          <p className={`text-[10px] mt-2 text-center hidden sm:block ${i + 1 <= current ? "text-amber-400" : "text-white/30"}`}>
            {labels[i]}
          </p>
        </div>
      ))}
    </div>
    <p className="text-white/40 text-xs text-center mt-4">Step {current} of {total}</p>
  </div>
);

// ----- TOAST -----
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = "success", icon = "✅") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, icon }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));
  return { toasts, addToast, removeToast };
};

const Toast = ({ toasts, removeToast }) => (
  <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
    {toasts.map((t) => (
      <div key={t.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-bold max-w-xs ${
          t.type === "success" ? "bg-green-400/10 border-green-400/30 text-green-400" :
          t.type === "error"   ? "bg-red-400/10 border-red-400/30 text-red-400" :
          "bg-amber-400/10 border-amber-400/30 text-amber-400"
        }`}>
        <span>{t.icon}</span>
        <span>{t.message}</span>
        <button onClick={() => removeToast(t.id)} className="ml-auto opacity-50 hover:opacity-100">✕</button>
      </div>
    ))}
  </div>
);

// ----- ONBOARDING TOUR (simplified for brevity, but you can keep original) -----
const OnboardingTour = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const steps = [
    { target: ".step1-target", title: "🎓 Who Are You?", content: "First, tell us if you're a USTP student or staff member.", icon: "👤", color: "from-amber-400 to-orange-500" },
    { target: ".step2-target", title: "⏰ When to Pick Up?", content: "Choose a time window, then select your exact pickup time.", icon: "📅", color: "from-blue-400 to-cyan-500" },
    { target: ".step3-target", title: "🍱 Build Your Order", content: "Tap any musubi to customize it. Add sauce, egg, or adjust quantity.", icon: "🍽️", color: "from-green-400 to-emerald-500" },
    { target: ".step4-target", title: "✅ Confirm & Submit", content: "Review your order before placing it.", icon: "📋", color: "from-purple-400 to-pink-500" },
  ];
  const nextStep = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else { setShowConfetti(true); setTimeout(onComplete, 1500); }
  };
  if (showConfetti) return <div className="fixed inset-0 z-[300] pointer-events-none flex items-center justify-center"><div className="text-8xl animate-bounce">🎉✨🎊</div></div>;
  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      <div className="absolute inset-0 bg-black/80 pointer-events-auto" />
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[201]">
        <div className="w-[90%] max-w-md bg-gradient-to-br from-[#111] to-[#1a1a1a] border-2 border-amber-400/50 rounded-2xl p-6 pointer-events-auto shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-14 h-14 rounded-full bg-gradient-to-r ${steps[step].color} flex items-center justify-center text-2xl shadow-lg flex-shrink-0`}>{steps[step].icon}</div>
            <div><h3 className="text-xl font-black text-amber-400">{steps[step].title}</h3><div className="flex items-center gap-2 mt-1"><p className="text-white/40 text-xs">Step {step+1} of {steps.length}</p><div className="flex gap-1">{steps.map((_,i) => <div key={i} className={`h-1.5 rounded-full transition-all ${i===step ? "w-4 bg-amber-400" : "w-1.5 bg-white/30"}`} />)}</div></div></div>
          </div>
          <p className="text-white/80 text-base mb-6 leading-relaxed">{steps[step].content}</p>
          <div className="flex justify-between items-center mt-2">
            <button onClick={onSkip} className="text-white/40 text-sm hover:text-white/60 transition-all px-4 py-2 rounded-lg hover:bg-white/5">Skip tutorial</button>
            <button onClick={nextStep} className={`px-6 py-2.5 rounded-xl bg-gradient-to-r ${steps[step].color} text-black font-bold hover:scale-105 transition-all transform shadow-lg`}>{step < steps.length-1 ? "Next →" : "Let's Go! 🎉"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ----- QR MODAL (simplified) -----
const QRModal = ({ onClose }) => {
  const APP_URL = "https://spam-musubi.vercel.app";
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-6">
      <div className="bg-[#111] border border-amber-400/30 rounded-2xl w-full max-w-sm p-6 text-center">
        <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-black text-amber-400">🍱 Share & Reserve</h2><button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button></div>
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 mb-4"><p className="text-amber-400 text-sm font-mono">{APP_URL}</p></div>
        <div className="flex gap-2 mb-4"><button onClick={() => navigator.clipboard.writeText(APP_URL)} className="flex-1 bg-amber-400/20 border border-amber-400/50 text-amber-400 py-2 rounded-lg text-sm">Copy Link</button></div>
        <button onClick={onClose} className="w-full bg-white/10 text-white py-2 rounded-lg">Close</button>
      </div>
    </div>
  );
};

// ----- PROFILE MODAL (adapted to Supabase) -----
const ProfileModal = ({ onClose, onProfileUpdate, userSession }) => {
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [formData, setFormData] = useState({ contactNumber: "", studentId: "", department: "", customDepartment: "" });
  const CLOUD_NAME = "dvbbusgra";
  const UPLOAD_PRESET = "spam_musubi_preset";

  const loadSavedFormData = () => {
    const saved = localStorage.getItem(`spamMusubi_user_${userSession.user.id}`);
    if (saved) { try { return JSON.parse(saved); } catch(e) { return null; } }
    return null;
  };

  const updateSavedFormData = (updates) => {
    const saved = loadSavedFormData() || {};
    const newSaved = { ...saved, ...updates };
    localStorage.setItem(`spamMusubi_user_${userSession.user.id}`, JSON.stringify(newSaved));
  };

  const savedUserData = loadSavedFormData();
  const userType = savedUserData?.userType || userProfile?.user_type || 'student';

  useEffect(() => {
    const fetchData = async () => {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userSession.user.id).single();
      if (profile) {
        setUserProfile(profile);
        setFormData({
          contactNumber: profile.contact_number || "",
          studentId: profile.student_id || "",
          department: profile.department || "",
          customDepartment: profile.custom_department || "",
        });
      }
      const saved = loadSavedFormData();
      if (saved) setFormData(prev => ({ ...prev, ...saved }));
      const { data: loyalty } = await supabase.from('loyalty').select('*').eq('user_id', userSession.user.id).single();
      if (loyalty) setLoyaltyData(loyalty);
      const { data: orders } = await supabase.from('reservations').select('*').eq('user_id', userSession.user.id).eq('status', 'pending').order('created_at', { ascending: false });
      setPendingOrders(orders || []);
      setLoadingPending(false);
    };
    fetchData();
  }, [userSession]);

  const openCloudinaryWidget = () => {
    if (!window.cloudinary) { alert("Cloudinary widget not loaded."); return; }
    setUploading(true);
    window.cloudinary.openUploadWidget(
      { cloudName: CLOUD_NAME, uploadPreset: UPLOAD_PRESET, sources: ["local","camera"], cropping: true, multiple: false, maxFileSize: 5000000 },
      async (error, result) => {
        setUploading(false);
        if (error || result.event !== "success") return;
        const imageUrl = result.info.secure_url;
        await supabase.from('profiles').upsert({ id: userSession.user.id, avatar_url: imageUrl });
        setUserProfile(prev => ({ ...prev, avatar_url: imageUrl }));
        if (onProfileUpdate) onProfileUpdate();
        alert("Avatar updated!");
      }
    );
  };

  const updateContactInfo = async () => {
    const updateData = { contact_number: formData.contactNumber };
    if (userType === 'student') updateData.student_id = formData.studentId;
    else {
      updateData.department = formData.department;
      if (formData.department === 'others') updateData.custom_department = formData.customDepartment;
    }
    await supabase.from('profiles').upsert({ id: userSession.user.id, ...updateData });
    updateSavedFormData(updateData);
    if (onProfileUpdate) onProfileUpdate();
    alert("Contact info saved!");
  };

  const clearSavedData = () => {
    localStorage.removeItem(`spamMusubi_user_${userSession.user.id}`);
    alert("Saved form data cleared.");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const getOrderAge = (createdAt) => {
    if (!createdAt) return 0;
    const created = new Date(createdAt);
    const now = new Date();
    return (now - created) / (1000 * 60 * 60);
  };

  const canCancelOrder = (order) => {
    if (order.status !== "pending") return false;
    const [year, month, day] = order.pickup_date.split("-").map(Number);
    const cutoff = new Date(year, month-1, day, 12, 0, 0);
    return new Date() < cutoff;
  };

  const cancelOrder = async (orderId) => {
    if (!window.confirm("Cancel this order?")) return;
    await supabase.from('reservations').update({ status: "cancelled" }).eq('id', orderId);
    const { data: orders } = await supabase.from('reservations').select('*').eq('user_id', userSession.user.id).eq('status', 'pending').order('created_at', { ascending: false });
    setPendingOrders(orders || []);
    alert("Order cancelled.");
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-6">
      <div className="bg-[#111] border border-amber-400/30 rounded-2xl w-full max-w-sm p-6 text-center max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-black text-amber-400">👤 Profile</h2><button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button></div>
        <div className="flex flex-col items-center mb-4">
          <div className="w-24 h-24 rounded-full bg-amber-400/20 flex items-center justify-center text-4xl overflow-hidden">
            {userProfile?.avatar_url ? <img src={userProfile.avatar_url} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-amber-400">{userSession.user.email?.[0].toUpperCase() || "👤"}</span>}
          </div>
          <button onClick={openCloudinaryWidget} disabled={uploading} className="mt-2 text-xs bg-amber-400/20 border border-amber-400/50 text-amber-400 px-3 py-1 rounded-lg">Change picture</button>
        </div>
        <div className="bg-white/5 rounded-xl p-3 mb-4 text-left"><p className="text-white/70 text-sm font-medium">Account</p><p className="text-white text-sm">{userSession.user.user_metadata?.full_name || "User"}</p><p className="text-white/40 text-xs">{userSession.user.email}</p></div>
        <div className="bg-white/5 rounded-xl p-3 mb-4 text-left">
          <p className="text-white/70 text-sm font-medium mb-2">Contact Info</p>
          <input type="text" placeholder="Contact Number" value={formData.contactNumber} onChange={(e) => setFormData({...formData, contactNumber: e.target.value})} className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-white text-sm mb-2" />
          {userType === 'student' ? (
            <input type="text" placeholder="Student ID" value={formData.studentId} onChange={(e) => setFormData({...formData, studentId: e.target.value})} className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-white text-sm mb-2" />
          ) : (
            <>
              <select value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-white text-sm mb-2">
                <option value="" disabled>Select department</option>
                {DEPARTMENT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              {formData.department === 'others' && <input type="text" placeholder="Please specify" value={formData.customDepartment} onChange={(e) => setFormData({...formData, customDepartment: e.target.value})} className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-white text-sm mb-2" />}
            </>
          )}
          <button onClick={updateContactInfo} className="w-full bg-amber-400/20 text-amber-400 py-1 rounded text-sm">Save</button>
        </div>
        {loyaltyData && (
          <div className="bg-white/5 rounded-xl p-3 mb-4 text-left">
            <p className="text-white/70 text-sm font-medium mb-1">⭐ Loyalty</p>
            <div className="flex justify-between text-xs"><span>Total Musubi</span><span className="text-amber-400">{loyaltyData.total_purchased || 0}</span></div>
            <div className="flex justify-between text-xs"><span>Rewards Earned</span><span className="text-green-400">{loyaltyData.rewards_earned || 0}</span></div>
            <div className="flex justify-between text-xs"><span>Available</span><span className="text-amber-400">{(loyaltyData.rewards_earned || 0) - (loyaltyData.rewards_redeemed || 0)}</span></div>
          </div>
        )}
        <div className="bg-white/5 rounded-xl p-3 mb-4 text-left">
          <div className="flex justify-between items-center mb-2"><p className="text-white/70 text-sm font-medium">⏳ Pending Orders</p><button onClick={() => window.location.reload()} className="text-xs text-amber-400">Refresh</button></div>
          {loadingPending ? <p className="text-white/40 text-xs">Loading...</p> : pendingOrders.length === 0 ? <p className="text-white/40 text-xs">No pending orders.</p> : (
            <div className="space-y-2">
              {pendingOrders.map(order => {
                const age = getOrderAge(order.created_at);
                const isExpired = age > 22;
                const canCancel = canCancelOrder(order);
                return (
                  <div key={order.id} className="border-b border-white/10 pb-2">
                    <div className="flex justify-between items-start">
                      <div><p className="text-white/80 text-xs">{order.pickup_date} • {order.pickup_slot}</p><p className="text-white/60 text-xs mt-0.5">{order.items?.[0]?.productName} x{order.items?.[0]?.quantity}</p></div>
                      <div className="text-right"><p className="text-amber-400 text-xs font-bold">₱{order.total_price}</p>{canCancel && <button onClick={() => cancelOrder(order.id)} className="mt-1 text-xs bg-red-400/20 text-red-400 px-2 py-0.5 rounded">Cancel</button>}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <button onClick={clearSavedData} className="w-full bg-red-400/10 border border-red-400/30 text-red-400 py-2 rounded-lg text-sm mb-2">Clear Saved Info</button>
        <button onClick={signOut} className="w-full bg-white/10 text-white py-2 rounded-lg text-sm">Sign Out</button>
      </div>
    </div>
  );
};

// ----- ORDER CONFIRMATION DIALOG -----
const ConfirmationDialog = ({ isOpen, onClose, onConfirm, orderDetails }) => {
  if (!isOpen) return null;
  const total = orderDetails?.total || orderDetails?.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-amber-400/30 rounded-2xl w-full max-w-md p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">🍱</div>
          <h2 className="text-xl font-black text-amber-400 mb-3">Confirm Your Order</h2>
          <p className="text-white/70 mb-4">Are you sure you want to place this order?</p>
          <div className="bg-white/5 rounded-xl p-4 mb-6 text-left max-h-60 overflow-y-auto">
            <p className="text-white/60 text-sm mb-2">Order Summary:</p>
            {orderDetails?.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between text-white text-sm mt-1"><span>{item.productName} x{item.quantity}</span><span className="text-amber-400">₱{item.price * item.quantity}</span></div>
            ))}
            <div className="border-t border-white/10 mt-2 pt-2 flex justify-between font-bold"><span className="text-white">Total</span><span className="text-amber-400">₱{total}</span></div>
          </div>
          <div className="flex gap-3"><button onClick={onClose} className="flex-1 bg-white/10 text-white font-bold py-2 rounded-xl">No, Cancel</button><button onClick={onConfirm} className="flex-1 bg-amber-400 text-black font-bold py-2 rounded-xl">Yes, Place Order</button></div>
        </div>
      </div>
    </div>
  );
};

// ----- NOTIFICATION GUIDE -----
const NotificationGuide = () => {
  const [showGuide, setShowGuide] = useState(false);
  const [browser, setBrowser] = useState('chrome');
  useEffect(() => {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) setBrowser('firefox');
    else if (ua.includes('Safari') && !ua.includes('Chrome')) setBrowser('safari');
    else if (ua.includes('Edg')) setBrowser('edge');
    else setBrowser('chrome');
  }, []);
  if (Notification.permission === 'granted') return null;
  return (
    <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-2xl p-4 mb-6">
      <div className="flex items-start gap-3"><span className="text-2xl">🔔</span><div className="flex-1"><p className="text-yellow-400 font-bold text-sm">Get instant notifications!</p><p className="text-white/60 text-xs mt-1">Enable notifications to receive messages from the owner instantly.</p><button onClick={() => setShowGuide(true)} className="text-amber-400 text-xs underline mt-2">Enable notifications →</button></div></div>
      {showGuide && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-yellow-400/30 rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-black text-amber-400">🔔 Enable Notifications</h3><button onClick={() => setShowGuide(false)} className="text-white/40 text-xl">✕</button></div>
            {browser === 'chrome' && <><p className="text-white/70 text-sm mb-4">Click the button below to open Chrome settings:</p><a href={`chrome://settings/content/siteDetails?site=${encodeURIComponent(window.location.origin)}`} target="_blank" rel="noopener noreferrer" className="block w-full bg-amber-400 text-black text-center font-bold py-3 rounded-xl mb-4">Open Notification Settings →</a><p className="text-white/50 text-xs">Then allow notifications for this site.</p></>}
            {browser === 'firefox' && <div className="space-y-3"><div className="bg-white/5 rounded-xl p-3"><p className="text-white font-bold text-sm">Step 1:</p><p className="text-white/60 text-xs">Click the lock icon 🔒 in the address bar</p></div><div className="bg-white/5 rounded-xl p-3"><p className="text-white font-bold text-sm">Step 2:</p><p className="text-white/60 text-xs">Click "Connection Secure" → "More Information"</p></div><div className="bg-white/5 rounded-xl p-3"><p className="text-white font-bold text-sm">Step 3:</p><p className="text-white/60 text-xs">Go to "Permissions" → Find "Notifications" → Set to "Allow"</p></div><button onClick={() => window.location.reload()} className="w-full bg-amber-400 text-black font-bold py-2 rounded-xl mt-2">I've enabled it, refresh →</button></div>}
            {browser === 'safari' && <div className="space-y-3"><div className="bg-white/5 rounded-xl p-3"><p className="text-white font-bold text-sm">Step 1:</p><p className="text-white/60 text-xs">Click "Safari" in the menu bar → "Settings"</p></div><div className="bg-white/5 rounded-xl p-3"><p className="text-white font-bold text-sm">Step 2:</p><p className="text-white/60 text-xs">Click "Websites" → "Notifications"</p></div><div className="bg-white/5 rounded-xl p-3"><p className="text-white font-bold text-sm">Step 3:</p><p className="text-white/60 text-xs">Find this site and set to "Allow"</p></div><button onClick={() => window.location.reload()} className="w-full bg-amber-400 text-black font-bold py-2 rounded-xl mt-2">I've enabled it, refresh →</button></div>}
            <button onClick={() => { if (Notification.permission !== 'denied') Notification.requestPermission().then(() => window.location.reload()); }} className="w-full bg-white/10 text-white py-2 rounded-xl mt-3 text-sm">Try requesting permission again</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ----- MAIN DASHBOARD COMPONENT -----
export default function Dashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentItem, setCurrentItem] = useState({ sauce: "none", egg: false, quantity: 1 });
  const [popularProducts, setPopularProducts] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCustomDepartment, setShowCustomDepartment] = useState(false);
  const [isSoldOut, setIsSoldOut] = useState(false);
  const [isStockLimit, setIsStockLimit] = useState(false);
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [redeemingReward, setRedeemingReward] = useState(false);
  const [form, setForm] = useState({
    userType: "student",
    fullName: "",
    studentId: "",
    department: "",
    customDepartment: "",
    contactNumber: "",
    pickupSlot: "",
    pickupTime: "",
  });
  const [errors, setErrors] = useState({});
  const [showQR, setShowQR] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [processingPayment, setProcessingPayment] = useState(false);
  const stepContainerRef = useRef(null);
  const { toasts, addToast, removeToast } = useToast();
  const [showChatList, setShowChatList] = useState(false);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [selectedOrderForReview, setSelectedOrderForReview] = useState(null);
  const [productStock, setProductStock] = useState({});
  const [stockLoading, setStockLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [gcashAvailable, setGcashAvailable] = useState(false);
  const [pendingOrdersMain, setPendingOrdersMain] = useState([]);
  const [loadingPendingMain, setLoadingPendingMain] = useState(false);
  const [openChatUserId, setOpenChatUserId] = useState(null);
  const [unreadCustomerCount, setUnreadCustomerCount] = useState(0);

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user);
        fetchLoyalty(session.user.id);
        fetchProductStock();
        fetchSoldOutStatus();
        fetchStockLimitStatus();
        fetchCompletedOrders(session.user.id);
        fetchPendingOrdersMain(session.user.id);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user);
        fetchLoyalty(session.user.id);
        fetchProductStock();
        fetchCompletedOrders(session.user.id);
        fetchPendingOrdersMain(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (user) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) setUserProfile(data);
    const saved = localStorage.getItem(`spamMusubi_user_${user.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setForm(prev => ({ ...prev, ...parsed }));
        if (parsed.department === 'others') setShowCustomDepartment(true);
      } catch(e) {}
    }
    setForm(prev => ({ ...prev, fullName: user.user_metadata?.full_name || "" }));
  };

  const fetchLoyalty = async (userId) => {
    const { data } = await supabase.from('loyalty').select('*').eq('user_id', userId).single();
    if (data) setLoyaltyData(data);
    else setLoyaltyData({ total_purchased: 0, rewards_earned: 0, rewards_redeemed: 0 });
  };

  const fetchProductStock = async () => {
    setStockLoading(true);
    const { data } = await supabase.from('products').select('id, stock');
    if (data) {
      const stockMap = {};
      data.forEach(p => { stockMap[p.id] = p.stock; });
      setProductStock(stockMap);
    }
    setStockLoading(false);
  };

  const fetchSoldOutStatus = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'soldOut').single();
    if (data) setIsSoldOut(data.value);
  };

  const fetchStockLimitStatus = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'stockLimit').single();
    if (data) setIsStockLimit(data.value);
  };

  const fetchCompletedOrders = async (userId) => {
    const { data } = await supabase.from('reservations').select('*').eq('user_id', userId).eq('status', 'completed');
    setCompletedOrders(data || []);
  };

  const fetchPendingOrdersMain = async (userId) => {
    setLoadingPendingMain(true);
    const { data } = await supabase.from('reservations').select('*').eq('user_id', userId).eq('status', 'pending').order('created_at', { ascending: false });
    setPendingOrdersMain(data || []);
    setLoadingPendingMain(false);
  };

  // Real‑time unread count for chat badge
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('unread-count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_uid=eq.${user.id} AND read=eq.false AND sender=eq.admin` }, () => setUnreadCustomerCount(prev => prev + 1))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `to_uid=eq.${user.id} AND read=eq.true` }, () => {
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('to_uid', user.id).eq('read', false).eq('sender', 'admin').then(({ count }) => setUnreadCustomerCount(count || 0));
      })
      .subscribe();
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('to_uid', user.id).eq('read', false).eq('sender', 'admin').then(({ count }) => setUnreadCustomerCount(count || 0));
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAllAdminMessagesAsRead = async () => {
    if (!user || user.email === "monsanto.bryann@gmail.com") return;
    setUnreadCustomerCount(0);
    const { data: convs } = await supabase.from('conversations_meta').select('id').contains('participants', [user.id]);
    if (!convs) return;
    for (const conv of convs) {
      await supabase.from('messages').update({ read: true }).eq('conversation_id', conv.id).eq('sender', 'admin').eq('read', false);
    }
  };

  const saveFormData = () => {
    if (!user) return;
    const dataToSave = {
      userType: form.userType,
      fullName: form.fullName,
      studentId: form.studentId,
      department: form.department,
      customDepartment: form.customDepartment,
      contactNumber: form.contactNumber,
    };
    localStorage.setItem(`spamMusubi_user_${user.id}`, JSON.stringify(dataToSave));
  };

  const loadSavedFormData = () => {
    if (!user) return null;
    const saved = localStorage.getItem(`spamMusubi_user_${user.id}`);
    if (saved) { try { return JSON.parse(saved); } catch(e) { return null; } }
    return null;
  };

  const applySavedData = (savedData) => {
    setForm(prev => ({ ...prev, ...savedData }));
    if (savedData.department === 'others') setShowCustomDepartment(true);
    addToast("Previous info loaded!", "success", "📋");
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split("T")[0];
  const dayOfWeek = tomorrow.toLocaleDateString("en-US", { weekday: "long" });
  const tomorrowDisplay = tomorrow.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const getTimeSlots = () => {
    switch (dayOfWeek) {
      case "Monday":    return [{ label: "🌅 Morning", range: "8:00 AM – 1:00 PM", start: 8, end: 13 }, { label: "🌇 Afternoon", range: "2:30 PM – 3:45 PM", start: 14.5, end: 15.75 }];
      case "Tuesday":   return [{ label: "🌅 Morning", range: "8:00 AM – 12:00 PM", start: 8, end: 12 }, { label: "🌇 Afternoon", range: "3:00 PM – 3:45 PM", start: 15, end: 15.75 }];
      case "Wednesday": return [{ label: "🌇 Afternoon", range: "1:00 PM – 6:00 PM", start: 13, end: 18 }];
      case "Thursday":  return [{ label: "🌅 Morning", range: "8:00 AM – 9:00 AM", start: 8, end: 9 }, { label: "🌇 Afternoon", range: "2:30 PM – 6:30 PM", start: 14.5, end: 18.5 }];
      case "Friday":    return [{ label: "🌅 Morning", range: "8:00 AM – 12:00 PM", start: 8, end: 12 }, { label: "🌇 Afternoon", range: "12:00 PM – 7:00 PM", start: 12, end: 19 }];
      case "Saturday":  return [{ label: "🌇 Afternoon", range: "1:00 PM – 6:00 PM", start: 13, end: 18 }];
      default:          return [];
    }
  };
  const timeSlots = getTimeSlots();
  const isClosed = timeSlots.length === 0;
  const selectedSlot = timeSlots.find(s => s.label === form.pickupSlot);
  const timeOptions = generateTimeOptions(selectedSlot);

  const calcItemTotal = (item) => {
    if (item.isFree) return 0;
    const product = PRODUCTS.find(p => p.id === item.productId);
    const base = product?.price || 0;
    const sauce = item.sauce !== "none" ? 10 : 0;
    const egg = item.egg ? 10 : 0;
    return (base + sauce + egg) * item.quantity;
  };
  const grandTotal = orderItems.reduce((sum, item) => sum + calcItemTotal(item), 0);
  const calculateServiceFee = (total) => {
    if (paymentMethod !== 'gcash') return 0;
    return total <= 100 ? 5 : 10;
  };
  const finalTotal = grandTotal + calculateServiceFee(grandTotal);

  const getProgress = () => {
    if (!loyaltyData) return { purchased: 0, remaining: 10, progressPercent: 0 };
    const purchased = loyaltyData.total_purchased % 10;
    const remaining = 10 - purchased;
    return { purchased, remaining, progressPercent: (purchased / 10) * 100 };
  };
  const hasAvailableReward = () => {
    if (!loyaltyData) return false;
    return (loyaltyData.rewards_earned - (loyaltyData.rewards_redeemed || 0)) > 0;
  };

  const handleRedeemReward = () => {
    if (!hasAvailableReward()) { addToast("No free musubi available yet!", "info", "🎁"); return; }
    setRedeemingReward(true);
  };

  const handleAddFreeItem = async (product) => {
    const freeItem = { id: Date.now(), productId: product.id, productName: product.name, productPrice: 0, sauce: "none", egg: false, quantity: 1, isFree: true };
    setOrderItems([...orderItems, freeItem]);
    setRedeemingReward(false);
    addToast(`🎉 ${product.name} added to your order for FREE!`, "success", "🎁");
    await supabase.from('loyalty').update({ rewards_redeemed: (loyaltyData.rewards_redeemed || 0) + 1 }).eq('user_id', user.id);
    setLoyaltyData({ ...loyaltyData, rewards_redeemed: (loyaltyData.rewards_redeemed || 0) + 1 });
  };

  const handleAddToOrder = () => {
    if (!selectedProduct) return;
    if ((productStock[selectedProduct.id] || 0) <= 0) { addToast(`Sorry, ${selectedProduct.name} is sold out!`, "error", "🚫"); return; }
    const newItem = { id: Date.now(), productId: selectedProduct.id, productName: selectedProduct.name, productPrice: selectedProduct.price, sauce: currentItem.sauce, egg: currentItem.egg, quantity: currentItem.quantity, isFree: false };
    setOrderItems([...orderItems, newItem]);
    setSelectedProduct(null);
    setCurrentItem({ sauce: "none", egg: false, quantity: 1 });
  };

  const removeItem = (id) => setOrderItems(orderItems.filter(item => item.id !== id));

  const validateStep1 = () => {
    const newErrors = {};
    if (!form.fullName.trim()) newErrors.fullName = "Full name is required";
    if (form.userType === "student") {
      if (!form.studentId) newErrors.studentId = "Student ID is required";
      else if (!/^\d{10}$/.test(form.studentId)) newErrors.studentId = "Must be exactly 10 digits";
    } else {
      if (!form.department) newErrors.department = "Please select a department/role";
      else if (form.department === "others" && !form.customDepartment.trim()) newErrors.customDepartment = "Please enter your department/role";
    }
    if (!form.contactNumber) newErrors.contactNumber = "Contact number is required";
    else if (!/^09\d{9}$/.test(form.contactNumber)) newErrors.contactNumber = "Must be 11 digits starting with 09";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const validateStep2 = () => {
    const newErrors = {};
    if (!form.pickupSlot) newErrors.pickupSlot = "Please select a time window";
    if (!form.pickupTime) newErrors.pickupTime = "Please select your preferred pickup time";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const validateStep3 = () => {
    const newErrors = {};
    if (orderItems.length === 0) newErrors.order = "Please add at least one product";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) setStep(4);
  };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleSubmit = () => {
    if (!validateStep3()) return;
    const orderSummary = { items: orderItems.map(item => ({ productName: item.productName, quantity: item.quantity, price: calcItemTotal(item) / item.quantity })), total: finalTotal };
    setPendingOrderData(orderSummary);
    setShowConfirmDialog(true);
  };

  const submitOrder = async () => {
    setShowConfirmDialog(false);
    setLoading(true);
    try {
      let finalDepartment = form.department;
      if (form.department === "others") finalDepartment = form.customDepartment;

      const orderData = {
        user_id: user.id,
        user_email: user.email,
        user_name: user.user_metadata?.full_name || null,
        full_name: form.fullName,
        user_type: form.userType,
        student_id: form.userType === "student" ? form.studentId : null,
        department: form.userType === "staff" ? finalDepartment : null,
        contact_number: form.contactNumber,
        items: orderItems.map(({ id, ...rest }) => rest),
        total_price: grandTotal,
        final_total: finalTotal,
        pickup_date: tomorrowDate,
        pickup_slot: form.pickupSlot,
        pickup_time: form.pickupTime,
        status: "pending",
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'cash' ? 'pending_cash' : 'pending_payment',
        created_at: new Date().toISOString(),
      };

      const { data: reservation, error } = await supabase.from('reservations').insert(orderData).select().single();
      if (error) throw error;
      const orderId = reservation.id;

      await supabase.from('notifications').insert({
        user_id: user.id,
        message: "🍱 Your order has been placed. Please wait for admin confirmation.",
        read: false,
        type: "order_placed",
        order_id: orderId,
      });

      if (paymentMethod === 'gcash') {
        if (!gcashAvailable) {
          addToast("💳 GCash is temporarily unavailable. Please select Cash on Pickup.", "error", "⚠️");
          setLoading(false);
          setProcessingPayment(false);
          return;
        }
        setProcessingPayment(true);
        const response = await fetch('/api/create-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: finalTotal, orderId, description: `Spam Musubi Order #${orderId}` }) });
        const data = await response.json();
        if (response.ok) window.location.href = data.checkoutUrl;
        else throw new Error(data.error || 'Payment creation failed');
      } else {
        saveFormData();
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: form.fullName,
          contact_number: form.contactNumber,
          student_id: form.userType === "student" ? form.studentId : null,
          department: form.userType === "staff" ? finalDepartment : null,
          user_type: form.userType,
        });
        addToast("Reservation submitted! We'll notify you by email. 🍱", "success", "🎉");
        setSubmitted(true);
      }
    } catch (error) {
      console.error("Error:", error);
      addToast("Something went wrong. Please try again.", "error", "❌");
    } finally {
      setLoading(false);
      setProcessingPayment(false);
    }
  };

  const cancelOrderMain = async (orderId) => {
    if (!window.confirm("Cancel this order?")) return;
    await supabase.from('reservations').update({ status: "cancelled" }).eq('id', orderId);
    if (user) fetchPendingOrdersMain(user.id);
    addToast("Order cancelled.", "success", "✅");
  };

  const refreshUserProfile = async () => {
    if (user) loadUserProfile(user);
  };

  if (!user) return <div className="text-white p-8">Loading...</div>;

  if (submitted) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center bg-black/60 border border-amber-400/30 rounded-3xl p-10">
        <div className="text-7xl mb-6 animate-bounce">🎉</div>
        <h2 className="text-3xl font-black text-amber-400 mb-3">You're all set!</h2>
        <p className="text-white/70 mb-2">Your reservation has been received!</p>
        <p className="text-white/50 text-sm mb-8">Wait for the business owner's confirmation.<br />We will do our best to accommodate your order. 🍱</p>
        <div className="bg-amber-400/5 border border-amber-400/20 rounded-2xl p-5 text-left mb-6">
          <p className="text-xs text-amber-400 mb-3 font-semibold">Reservation Summary</p>
          <div className="flex items-center gap-2 text-sm mb-2 text-white"><span>📅</span><span>{tomorrowDisplay}</span></div>
          <div className="flex items-center gap-2 text-sm mb-2 text-white"><span>⏰</span><span>{form.pickupSlot} — {form.pickupTime}</span></div>
          <div className="border-t border-white/10 pt-2 mt-2">
            {orderItems.map(item => (<div key={item.id} className="flex justify-between text-sm text-white/80"><span>{item.productName} x{item.quantity}{item.sauce !== "none" ? " + sauce" : ""}{item.egg ? " + egg" : ""}{item.isFree ? " 🎁 FREE" : ""}</span><span className="text-amber-400 font-bold">{item.isFree ? "FREE" : `₱${calcItemTotal(item)}`}</span></div>))}
          </div>
          <div className="border-t border-white/10 pt-2 mt-2 flex justify-between font-black"><span className="text-white">Total</span><span className="text-amber-400 text-xl font-bold">₱{finalTotal}</span></div>
          {orderItems.some(item => item.isFree) && <div className="mt-3 p-2 bg-green-400/10 border border-green-400/30 rounded-lg"><p className="text-xs text-green-400 text-center">🎉 You redeemed a FREE musubi! 🎉</p></div>}
        </div>
        <button onClick={() => { setSubmitted(false); setOrderItems([]); setStep(1); setForm({ userType: "student", fullName: "", studentId: "", department: "", customDepartment: "", contactNumber: "", pickupSlot: "", pickupTime: "" }); }} className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black py-3 rounded-xl">Make Another Reservation</button>
      </div>
    </div>
  );

  const stepLabels = ["About You", "Pickup Time", "Your Order", "Confirm"];
  const progress = getProgress();
  const availableRewards = loyaltyData ? (loyaltyData.rewards_earned - (loyaltyData.rewards_redeemed || 0)) : 0;
  const savedData = user ? loadSavedFormData() : null;

  const scrollToForm = () => {
    if (stepContainerRef.current) stepContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      <div className="fixed inset-0 z-0">
        <img src="/musubi.png" alt="Spam Musubi" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#0a0a0a]" />
      </div>
      <div className="relative z-10">
        <Toast toasts={toasts} removeToast={removeToast} />
        {showOnboarding && <OnboardingTour onComplete={() => { localStorage.setItem("spamMusubiTutorial", "completed"); setShowOnboarding(false); }} onSkip={() => { localStorage.setItem("spamMusubiTutorial", "skipped"); setShowOnboarding(false); }} />}
        <div className="bg-black/80 border-b border-amber-400/20 px-6 py-4 sticky top-0 z-50 backdrop-blur">
          <div className="max-w-2xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🍱</span>
              <div className="relative">
                <button onClick={async () => { await markAllAdminMessagesAsRead(); setShowChatList(true); }} className="text-xs border border-amber-400/40 text-amber-400 px-3 py-1.5 rounded-lg">💬</button>
                {unreadCustomerCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{unreadCustomerCount > 9 ? "9+" : unreadCustomerCount}</span>}
              </div>
              <div><p className="font-black text-amber-400 leading-none">Spam Musubi</p><p className="text-white/40 text-xs">Reserve for tomorrow</p></div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <button onClick={() => setShowQR(true)} className="text-xs border border-amber-400/40 text-amber-400 px-3 py-1.5 rounded-lg">🔗 Share</button>
              <button onClick={() => supabase.auth.signOut()} className="text-xs border border-white/20 px-3 py-1.5 rounded-lg hover:border-red-400/50 hover:text-red-400">Sign out</button>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-10" ref={stepContainerRef}>
          <div className="mb-6"><h1 className="text-2xl font-black">Hello, <span className="text-amber-400">{user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0]}!</span> 👋</h1><p className="text-white/50 text-sm">Reserve your Spam Musubi for tomorrow</p></div>

          <NotificationGuide />

          <div className="bg-black/40 border border-white/10 rounded-2xl p-5 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-amber-400/20 flex items-center justify-center overflow-hidden">
                {userProfile?.avatar_url ? <img src={userProfile.avatar_url} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-2xl text-amber-400">{user.user_metadata?.full_name?.[0] || "👤"}</span>}
              </div>
              <div><p className="font-bold text-white text-lg">{form.fullName || user.user_metadata?.full_name}</p><p className="text-white/50 text-sm">{user.email}</p><p className="text-white/40 text-xs mt-1">{form.contactNumber || "No contact number"}</p></div>
            </div>
          </div>

          <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl px-6 py-4 mb-8 flex items-center justify-between">
            <div><p className="text-xs text-amber-400/70 uppercase">Pickup Date</p><p className="text-white font-black">{tomorrowDisplay}</p></div><span className="text-3xl">📅</span>
          </div>

          {loyaltyData && (
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-400/30 rounded-2xl p-5 mb-8">
              <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><span className="text-2xl">⭐</span><h3 className="font-black text-amber-400">Loyalty Rewards</h3></div><div className="text-right"><p className="text-xs text-white/40">Buy 10 Get 1 Free</p></div></div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center"><p className="text-2xl font-black text-white">{loyaltyData.total_purchased || 0}</p><p className="text-xs text-white/40">Total Musubi</p><span className="text-sm">🍱</span></div>
                <div className="text-center"><p className="text-2xl font-black text-amber-400">{availableRewards}</p><p className="text-xs text-white/40">Free Musubi</p><span className="text-sm">🎁</span></div>
                <div className="text-center"><p className="text-2xl font-black text-green-400">{loyaltyData.rewards_earned || 0}</p><p className="text-xs text-white/40">Rewards Earned</p><span className="text-sm">⭐</span></div>
              </div>
              <div className="mb-3"><div className="flex justify-between text-xs mb-1"><span className="text-white/60">Next Free Musubi</span><span className="text-amber-400 font-bold">{progress.remaining} more to go</span></div><div className="w-full bg-white/10 rounded-full h-3"><div className="bg-gradient-to-r from-amber-400 to-orange-500 h-3 rounded-full transition-all" style={{ width: `${progress.progressPercent}%` }} /></div></div>
              {availableRewards > 0 && <div className="mt-3 p-3 bg-amber-400/20 border border-amber-400/50 rounded-xl animate-pulse"><p className="text-sm text-amber-400 text-center font-bold">🎉 You have {availableRewards} FREE musubi waiting! 🎉</p><button onClick={handleRedeemReward} className="mt-2 w-full bg-amber-400 text-black font-bold py-2 rounded-lg">Redeem Free Musubi 🎁</button></div>}
            </div>
          )}

          {/* Pending Orders Card */}
          {pendingOrdersMain.length > 0 && (
            <div className="bg-black/40 border border-amber-400/30 rounded-2xl p-5 mb-8">
              <div className="flex justify-between items-center mb-3"><h3 className="text-lg font-black text-amber-400">⏳ Your Pending Orders</h3><button onClick={() => fetchPendingOrdersMain(user.id)} className="text-xs text-amber-400 hover:text-amber-300">🔄 Refresh</button></div>
              <div className="space-y-3">
                {pendingOrdersMain.map(order => {
                  const [year, month, day] = order.pickup_date.split("-").map(Number);
                  const cutoff = new Date(year, month-1, day, 12, 0, 0);
                  const canCancel = new Date() < cutoff;
                  return (
                    <div key={order.id} className="bg-white/5 rounded-xl p-3 flex justify-between items-center">
                      <div><p className="text-white text-sm font-bold">{order.items?.[0]?.productName || "Classic Spam Musubi"} x{order.items?.[0]?.quantity || 1}</p><p className="text-white/40 text-xs">{order.pickup_date} • {order.pickup_slot} — {order.pickup_time}</p>{!canCancel && order.status === "pending" && <span className="text-amber-400/70 text-[10px]">cannot cancel after 12PM on pickup day</span>}{canCancel && <span className="text-green-400/70 text-[10px]">cancel available until 12PM</span>}</div>
                      <div className="text-right"><p className="text-amber-400 font-bold">₱{order.total_price}</p>{canCancel && <button onClick={() => cancelOrderMain(order.id)} className="mt-1 text-xs bg-red-400/20 text-red-400 px-3 py-1 rounded hover:bg-red-400/30">Cancel</button>}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <PublicReviews addToast={addToast} />

          {/* Completed Orders - Write Review */}
          {completedOrders.length > 0 && (
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 mb-8">
              <h3 className="text-lg font-black text-amber-400 mb-4">📦 Your Completed Orders</h3>
              <div className="space-y-3">
                {completedOrders.map((order) => {
                  let items = order.items;
                  if (!Array.isArray(items) && items && typeof items === 'object') items = [items];
                  const firstItem = items?.[0] || { productName: "Classic Spam Musubi", productId: "classic", quantity: 1 };
                  return (
                    <div key={order.id} className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
                      <div><p className="text-white font-bold text-sm">{firstItem.productName} x{firstItem.quantity || 1}</p><p className="text-white/40 text-xs">{order.pickup_date ? new Date(order.pickup_date).toLocaleDateString() : "Date not available"}</p></div>
                      <button onClick={() => setSelectedOrderForReview({ productId: firstItem.productId || "classic", productName: firstItem.productName || "Classic Spam Musubi", orderId: order.id })} className="px-4 py-2 rounded-xl bg-amber-400/20 border border-amber-400/50 text-amber-400 text-sm font-medium hover:bg-amber-400/30">Write a Review ✍️</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Redeem Reward Modal */}
          {redeemingReward && (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center px-4">
              <div className="bg-gradient-to-br from-[#111] to-[#1a1a1a] border border-amber-400/30 rounded-2xl w-full max-w-md p-6">
                <div className="text-center"><div className="text-5xl mb-4">🎁</div><h2 className="text-xl font-black text-amber-400 mb-3">Redeem Free Musubi!</h2><p className="text-white/60 mb-4">Choose your free musubi:</p><div className="space-y-2 mb-6">{PRODUCTS.map(product => (<button key={product.id} onClick={() => handleAddFreeItem(product)} className="w-full flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/10 hover:border-amber-400/50 transition-all"><span className="font-bold text-white">{product.name}</span><span className="text-amber-400 font-bold">FREE</span></button>))}</div><button onClick={() => setRedeemingReward(false)} className="w-full bg-white/10 text-white font-bold py-2 rounded-xl hover:bg-white/20">Cancel</button></div>
              </div>
            </div>
          )}

          <StepIndicator current={step} total={4} labels={stepLabels} />

          {isSoldOut ? (
            <div className="bg-black/40 border border-red-400/30 rounded-2xl p-8 text-center my-8"><div className="text-6xl mb-4 animate-pulse">🚫</div><h2 className="text-2xl font-black text-red-400 mb-3">Sold Out Today!</h2><p className="text-white/70 mb-4">We've reached our capacity for today. Please check back tomorrow for reservations!</p></div>
          ) : isStockLimit ? (
            <div className="bg-black/40 border border-orange-400/30 rounded-2xl p-8 text-center my-8"><div className="text-6xl mb-4">⚠️</div><h2 className="text-2xl font-black text-orange-400 mb-3">Stock Limit Reached</h2><p className="text-white/70 mb-4">We've hit our ingredient limit for today. Reservations will reopen after we restock.</p></div>
          ) : (
            <>
              {isClosed ? (
                <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10"><div className="text-5xl mb-4">😴</div><h2 className="text-xl font-bold text-white/70">We're closed tomorrow</h2><p className="text-white/40 mt-2">Check back tomorrow for the next available slot!</p></div>
              ) : (
                <>
                  {/* STEP 1 - About You */}
                  {step === 1 && (
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-7 space-y-6 step1-target">
                      <div className="flex justify-between items-center"><h2 className="text-lg font-black text-amber-400">About You</h2>{savedData && <button onClick={() => applySavedData(savedData)} className="text-xs bg-amber-400/20 border border-amber-400/50 text-amber-400 px-3 py-1 rounded-lg">📋 Use saved info</button>}</div>
                      <div className="flex gap-3">{["student","staff"].map(type => (<button key={type} onClick={() => setForm({...form, userType: type, department: "", customDepartment: ""})} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${form.userType === type ? "bg-amber-400 text-black border-amber-400" : "bg-white/10 text-white/80 border-white/20"}`}>{type === "student" ? "🎓 USTP Student" : "🏫 Staff / Faculty / Other"}</button>))}</div>
                      <div><label className="text-xs text-white/50 uppercase mb-1.5 block">Full Name</label><input type="text" value={form.fullName} onChange={(e) => setForm({...form, fullName: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/20 text-white" />{errors.fullName && <p className="text-red-400 text-xs mt-1">{errors.fullName}</p>}</div>
                      {form.userType === "student" ? (
                        <div><label className="text-xs text-white/50 uppercase mb-1.5 block">Student ID (10 digits)</label><input type="text" value={form.studentId} onChange={(e) => setForm({...form, studentId: e.target.value})} placeholder="e.g. 2023306520" maxLength={10} className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/20 text-white" />{errors.studentId && <p className="text-red-400 text-xs mt-1">{errors.studentId}</p>}</div>
                      ) : (
                        <>
                          <div><label className="text-xs text-amber-400/80 uppercase mb-1.5 block">Select your department/role</label><select value={form.department} onChange={(e) => { const val = e.target.value; setForm({...form, department: val}); setShowCustomDepartment(val === "others"); }} className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/20 text-white"><option value="" disabled>Choose your department</option>{DEPARTMENT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>{errors.department && <p className="text-red-400 text-xs mt-1">{errors.department}</p>}</div>
                          {showCustomDepartment && (<div><label className="text-xs text-amber-400/80 uppercase mb-1.5 block">Please specify</label><input type="text" value={form.customDepartment} onChange={(e) => setForm({...form, customDepartment: e.target.value})} placeholder="e.g. Research Office" className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/20 text-white" />{errors.customDepartment && <p className="text-red-400 text-xs mt-1">{errors.customDepartment}</p>}</div>)}
                        </>
                      )}
                      <div><label className="text-xs text-white/50 uppercase mb-1.5 block">Contact Number</label><input type="tel" value={form.contactNumber} onChange={(e) => setForm({...form, contactNumber: e.target.value})} placeholder="09xxxxxxxxx" maxLength={11} className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/20 text-white" />{errors.contactNumber && <p className="text-red-400 text-xs mt-1">{errors.contactNumber}</p>}</div>
                    </div>
                  )}

                  {/* STEP 2 - Pickup Time */}
                  {step === 2 && (
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-7 space-y-6 step2-target">
                      <h2 className="text-lg font-black text-amber-400">Pickup Time</h2>
                      <div><label className="text-xs text-white/50 uppercase mb-3 block">Available windows tomorrow</label><div className="grid grid-cols-1 gap-3">{timeSlots.map(slot => (<button key={slot.label} onClick={() => setForm({...form, pickupSlot: slot.label, pickupTime: ""})} className={`w-full flex items-center justify-between px-5 py-5 rounded-xl border transition-all ${form.pickupSlot === slot.label ? "bg-amber-400/10 border-amber-400 text-white" : "bg-white/5 border-white/10 text-white/60"}`}><span className="font-bold">{slot.label}</span><span className={`text-sm ${form.pickupSlot === slot.label ? "text-amber-400" : "text-white/40"}`}>{slot.range}</span></button>))}</div>{errors.pickupSlot && <p className="text-red-400 text-xs mt-2">{errors.pickupSlot}</p>}</div>
                      {form.pickupSlot && selectedSlot && (<div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-4"><label className="text-xs text-amber-400/80 uppercase mb-1.5 block">Pick your exact time 🕐</label><p className="text-white/40 text-xs mb-3">Within {selectedSlot.range}</p><select value={form.pickupTime} onChange={(e) => setForm({...form, pickupTime: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-black/40 border border-amber-400/30 text-white"><option value="" disabled>Select a time</option>{timeOptions.map(time => <option key={time} value={time}>{time}</option>)}</select>{errors.pickupTime && <p className="text-red-400 text-xs mt-2">{errors.pickupTime}</p>}</div>)}
                    </div>
                  )}

                  {/* STEP 3 - Build Your Order (full with customization) */}
                  {step === 3 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-6 step3-target">
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-7 space-y-5">
                          <h2 className="text-lg font-black text-amber-400">Build Your Order</h2>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {PRODUCTS.map((product) => (
                              <button key={product.id} onClick={() => { if ((productStock[product.id] || 0) <= 0) addToast(`Sorry, ${product.name} is sold out!`, "error", "🚫"); else setSelectedProduct(product); }} className={`relative overflow-hidden rounded-xl border transition-all ${selectedProduct?.id === product.id ? "border-amber-400 ring-2 ring-amber-400/50 scale-[1.02]" : "border-white/10 hover:border-amber-400/30"}`}>
                                <img src={product.image} alt={product.name} className="w-full h-36 object-cover" />
                                <div className="absolute top-2 left-2 bg-amber-400 text-black text-xs font-bold px-2 py-0.5 rounded-full">{product.tag}</div>
                                <div className="p-3 bg-black/60"><p className="font-bold text-white text-sm">{product.name}</p><div className="flex justify-between items-center"><p className="text-amber-400 font-black">₱{product.price}</p><p className={`text-xs ${(productStock[product.id] || 0) <= 0 ? 'text-red-400' : (productStock[product.id] || 0) <= 5 ? 'text-orange-400' : 'text-white/60'}`}>📦 {productStock[product.id] !== undefined ? productStock[product.id] : '0'} left</p></div></div>
                              </button>
                            ))}
                          </div>
                          {selectedProduct && (
                            <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-5 space-y-4">
                              <p className="font-black text-amber-400">Customize: {selectedProduct.name}</p>
                              <div><label className="text-xs text-white/50 uppercase mb-2 block">Sauce (optional)</label><div className="grid grid-cols-2 gap-2">{SAUCES.map(sauce => (<button key={sauce.value} onClick={() => setCurrentItem({...currentItem, sauce: sauce.value})} className={`flex justify-between px-3 py-2 rounded-xl border text-sm ${currentItem.sauce === sauce.value ? "bg-amber-400/10 border-amber-400 text-white" : "bg-white/5 border-white/10 text-white/80"}`}><span>{sauce.label}</span>{sauce.value !== "none" && <span className="text-amber-400">+₱10</span>}</button>))}</div></div>
                              <button onClick={() => setCurrentItem({...currentItem, egg: !currentItem.egg})} className={`w-full flex justify-between px-4 py-3 rounded-xl border ${currentItem.egg ? "bg-amber-400/10 border-amber-400 text-white" : "bg-white/5 border-white/10 text-white/80"}`}><span>🍳 Add Egg</span><span className="text-amber-400">+₱10</span></button>
                              <div><label className="text-xs text-white/50 uppercase mb-2 block">Quantity</label><div className="flex items-center gap-4"><button onClick={() => setCurrentItem({...currentItem, quantity: Math.max(1, currentItem.quantity-1)})} className="w-10 h-10 rounded-xl bg-white/10 text-white text-xl">−</button><span className="text-2xl font-black w-8 text-center text-white">{currentItem.quantity}</span><button onClick={() => setCurrentItem({...currentItem, quantity: Math.min(20, currentItem.quantity+1)})} className="w-10 h-10 rounded-xl bg-white/10 text-white text-xl">+</button></div></div>
                              <div className="flex justify-between pt-2 border-t border-white/10"><span className="text-white/60">Item Total</span><span className="text-amber-400 font-black">₱{(selectedProduct.price + (currentItem.sauce !== "none" ? 10 : 0) + (currentItem.egg ? 10 : 0)) * currentItem.quantity}</span></div>
                              <button onClick={handleAddToOrder} disabled={(productStock[selectedProduct.id] || 0) <= 0} className={`w-full font-black py-3 rounded-xl transition-all ${(productStock[selectedProduct.id] || 0) <= 0 ? "bg-gray-500 text-black cursor-not-allowed" : "bg-amber-400 text-black hover:bg-amber-300"}`}>{(productStock[selectedProduct.id] || 0) <= 0 ? "❌ Sold Out" : "✅ Add to Order"}</button>
                            </div>
                          )}
                          {orderItems.length > 0 && (
                            <div className="mt-4"><p className="text-xs text-white/50 uppercase mb-2">Current Order</p><div className="space-y-2">{orderItems.map(item => (<div key={item.id} className="flex justify-between items-center bg-white/5 rounded-xl px-4 py-3"><div><p className="font-bold text-sm text-white">{item.productName} x{item.quantity}{item.isFree && <span className="ml-2 text-xs text-green-400">🎁 FREE</span>}</p><p className="text-white/40 text-xs">{item.sauce !== "none" ? `Sauce` : ""}{item.egg ? " + Egg" : ""}</p></div><div className="flex items-center gap-3"><span className="text-amber-400 font-black">{item.isFree ? "FREE" : `₱${calcItemTotal(item)}`}</span><button onClick={() => removeItem(item.id)} className="text-white/30 hover:text-red-400">✕</button></div></div>))}</div></div>
                          )}
                          {errors.order && <p className="text-red-400 text-xs">{errors.order}</p>}
                        </div>
                      </div>
                      <div className="lg:col-span-1 space-y-6">
                        {popularProducts.length > 0 && (<div className="bg-black/40 border border-white/10 rounded-2xl p-5 sticky top-24"><h3 className="text-amber-400 font-black mb-3">🏆 Customer Favorites</h3><div className="space-y-2">{popularProducts.slice(0,3).map((product,idx) => (<div key={product.name} className="flex items-center gap-2"><span className="text-lg">{idx===0?'🥇':idx===1?'🥈':'🥉'}</span><span className="text-white/80 text-sm">{product.name}</span></div>))}</div><p className="text-white/30 text-xs mt-3 text-center">Most ordered by our customers</p></div>)}
                        {orderItems.length > 0 && (<div className="bg-black/40 border border-white/10 rounded-2xl p-5"><h3 className="text-amber-400 font-black mb-3">🧾 Your Receipt</h3><div className="space-y-2 mb-3">{orderItems.map(item => (<div key={item.id} className="flex justify-between text-sm"><span className="text-white/80">{item.productName} x{item.quantity}{item.sauce !== "none" ? " + sauce" : ""}{item.egg ? " + egg" : ""}{item.isFree && " 🎁 FREE"}</span><span className="text-amber-400">{item.isFree ? "FREE" : `₱${calcItemTotal(item)}`}</span></div>))}</div><div className="border-t border-white/10 pt-2 flex justify-between font-black"><span className="text-white">Total</span><span className="text-amber-400 text-xl">₱{grandTotal}</span></div></div>)}
                      </div>
                    </div>
                  )}

                  {/* STEP 4 - Confirm */}
                  {step === 4 && (
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-7 space-y-6 step4-target">
                      <h2 className="text-lg font-black text-amber-400">Confirm Your Order</h2>
                      <div className="space-y-4">
                        <div className="bg-white/5 rounded-xl p-4"><p className="text-white/50 text-xs uppercase mb-2">Customer Details</p><p className="text-white"><span className="text-white/70">Name:</span> {form.fullName}</p><p className="text-white"><span className="text-white/70">Contact:</span> {form.contactNumber}</p>{form.userType === "student" ? <p className="text-white"><span className="text-white/70">Student ID:</span> {form.studentId}</p> : <p className="text-white"><span className="text-white/70">Department:</span> {form.department === "others" ? form.customDepartment : DEPARTMENT_OPTIONS.find(opt => opt.value === form.department)?.label || form.department}</p>}</div>
                        <div className="bg-white/5 rounded-xl p-4"><p className="text-white/50 text-xs uppercase mb-2">Pickup Details</p><p className="text-white"><span className="text-white/70">Date:</span> {tomorrowDisplay}</p><p className="text-white"><span className="text-white/70">Time:</span> {form.pickupSlot} — {form.pickupTime}</p></div>
                        <div className="bg-white/5 rounded-xl p-4"><p className="text-white/50 text-xs uppercase mb-2">Order Summary</p>{orderItems.map((item) => (<div key={item.id} className="flex justify-between text-sm"><span className="text-white/80">{item.productName} x{item.quantity}{item.sauce !== "none" ? " + sauce" : ""}{item.egg ? " + egg" : ""}{item.isFree && " 🎁 FREE"}</span><span className="text-amber-400">{item.isFree ? "FREE" : `₱${calcItemTotal(item)}`}</span></div>))}<div className="border-t border-white/10 pt-2 mt-2"><div className="flex justify-between text-sm"><span>Subtotal</span><span>₱{grandTotal}</span></div>{paymentMethod === 'gcash' && (<div className="flex justify-between text-sm text-amber-400"><span>Service Fee (GCash)</span><span>₱{calculateServiceFee(grandTotal)}</span></div>)}<div className="flex justify-between font-black mt-1"><span>Total</span><span className="text-amber-400 text-xl">₱{finalTotal}</span></div></div></div>
                        <div className="bg-white/5 rounded-xl p-4"><p className="text-white/50 text-xs uppercase mb-2">Payment Method</p><div className="flex gap-4"><label className="flex items-center gap-2"><input type="radio" name="paymentMethod" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} /><span>Cash on Pickup</span></label><label className="flex items-center gap-2"><input type="radio" name="paymentMethod" value="gcash" checked={paymentMethod === 'gcash'} onChange={() => setPaymentMethod('gcash')} /><span>GCash (service fee applies)</span></label></div></div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between mt-8 gap-4">
                    {step > 1 && <button onClick={handleBack} className="px-6 py-3 rounded-xl border border-white/20 text-white/70 hover:border-amber-400/50 hover:text-amber-400">← Back</button>}
                    {step < 4 ? <button onClick={handleNext} className="ml-auto px-8 py-3 rounded-xl bg-amber-400 text-black font-bold hover:bg-amber-300 transition-all next-button">Next →</button> : <button onClick={handleSubmit} disabled={loading || processingPayment} className="ml-auto px-8 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold hover:shadow-lg transition-all disabled:opacity-50 next-button">{loading || processingPayment ? (processingPayment ? "Redirecting to payment..." : "Placing Order...") : "🍱 Place Order"}</button>}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Bottom navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-amber-400/30 py-2 px-4 z-50">
          <div className="max-w-2xl mx-auto flex justify-around items-center">
            <button onClick={() => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg ${activeTab === 'home' ? 'text-amber-400' : 'text-white/60'}`}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9L12 3L21 9L19 12M3 9V19H9V13H15V19H21V9"/></svg><span className="text-[10px]">Home</span></button>
            <button onClick={() => { setActiveTab('orders'); scrollToForm(); }} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg ${activeTab === 'orders' ? 'text-amber-400' : 'text-white/60'}`}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4H20V20H4V4Z"/><path d="M8 8H16"/><path d="M8 12H16"/><path d="M8 16H12"/></svg><span className="text-[10px]">My Orders</span></button>
            <button onClick={() => { setActiveTab('share'); setShowQR(true); }} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg ${activeTab === 'share' ? 'text-amber-400' : 'text-white/60'}`}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 12V20H20V12"/><path d="M12 2V14M12 14L9 11M12 14L15 11"/></svg><span className="text-[10px]">Share</span></button>
            <button onClick={() => { setActiveTab('profile'); setShowProfile(true); }} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg ${activeTab === 'profile' ? 'text-amber-400' : 'text-white/60'}`}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21V19C20 16.8 18.2 15 16 15H8C5.8 15 4 16.8 4 19V21"/><circle cx="12" cy="7" r="4"/></svg><span className="text-[10px]">Profile</span></button>
          </div>
        </div>

        {showQR && <QRModal onClose={() => setShowQR(false)} />}
        {showProfile && <ProfileModal onClose={() => setShowProfile(false)} onProfileUpdate={refreshUserProfile} userSession={session} />}
        {showChatList && <ConversationList onClose={() => { setShowChatList(false); setOpenChatUserId(null); }} preselectedUserId={openChatUserId} />}
        {selectedOrderForReview && <ReviewSystem productId={selectedOrderForReview.productId} productName={selectedOrderForReview.productName} orderId={selectedOrderForReview.orderId} onClose={() => setSelectedOrderForReview(null)} />}
        {showConfirmDialog && <ConfirmationDialog isOpen={showConfirmDialog} onClose={() => setShowConfirmDialog(false)} onConfirm={submitOrder} orderDetails={pendingOrderData} />}
      </div>
    </div>
  );
}