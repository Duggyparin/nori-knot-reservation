import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import emailjs from '@emailjs/browser';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ConversationList from "../components/ConversationList";
import StockManager from "../components/StockManager";

const ADMIN_EMAIL = "monsanto.bryann@gmail.com";
const TODAY = new Date().toISOString().split("T")[0];

const PRODUCTS = [
  { id: "classic", name: "Classic Spam Musubi", price: 35 },
  { id: "kimchi",  name: "Kimchi Musubi",       price: 50 },
  { id: "cheesy",  name: "Cheesy Musubi",        price: 45 },
  { id: "katsubi", name: "Katsubi",              price: 45 },
  { id: "ricebowl", name: "🍚 Rice Bowl Musubi", price: 65 },
];

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

// ----- STATUS HELPER FUNCTIONS -----
const statusColor = (status) => {
  switch (status) {
    case "pending":   return "bg-yellow-400/10 text-yellow-400 border-yellow-400/30";
    case "confirmed": return "bg-green-400/10 text-green-400 border-green-400/30";
    case "declined":  return "bg-red-400/10 text-red-400 border-red-400/30";
    case "completed": return "bg-blue-400/10 text-blue-400 border-blue-400/30";
    case "no-show":   return "bg-gray-400/10 text-gray-400 border-gray-400/30";
    default:          return "bg-white/10 text-white/50 border-white/20";
  }
};

const statusIcon = (status) => {
  switch (status) {
    case "pending":   return "🟡";
    case "confirmed": return "✅";
    case "declined":  return "❌";
    case "completed": return "📦";
    case "no-show":   return "🚫";
    default:          return "⚪";
  }
};

const Avatar = ({ name }) => {
  const initials = name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??";
  const colors = ["bg-amber-400", "bg-green-400", "bg-blue-400", "bg-purple-400", "bg-pink-400"];
  const color = colors[name?.charCodeAt(0) % colors.length] || "bg-amber-400";
  return (
    <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center font-black text-black text-sm flex-shrink-0`}>
      {initials}
    </div>
  );
};

// ----- PREP SUMMARY MODAL -----
const PrepSummaryModal = ({ reservations, onClose }) => {
  const productData = {};
  PRODUCTS.forEach(p => {
    productData[p.id] = {
      name: p.name,
      totalQuantity: 0,
      customers: []
    };
  });

  reservations.forEach(res => {
    if (res.items && res.items.length) {
      res.items.forEach(item => {
        const pid = item.productId;
        if (productData[pid]) {
          productData[pid].totalQuantity += item.quantity;
          productData[pid].customers.push({
            name: res.full_name,
            quantity: item.quantity,
            pickupTime: `${res.pickup_date} | ${res.pickup_slot} — ${res.pickup_time}`,
            contact: res.contact_number,
            orderId: res.id
          });
        }
      });
    } else {
      productData.classic.totalQuantity += (res.quantity || 1);
      productData.classic.customers.push({
        name: res.full_name,
        quantity: (res.quantity || 1),
        pickupTime: `${res.pickup_slot} — ${res.pickup_time}`,
        contact: res.contact_number,
        orderId: res.id
      });
    }
  });

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-start justify-center pt-16 px-4 overflow-y-auto">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-5xl p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-amber-400">📋 Prep Summary</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl">✕</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.values(productData).filter(p => p.totalQuantity > 0).map(product => (
            <div key={product.name} className="bg-black/40 border border-white/10 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-black text-amber-400">{product.name}</h3>
                <span className="text-2xl font-black text-white">{product.totalQuantity}</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {product.customers.map((cust, idx) => (
                  <div key={idx} className="bg-white/5 rounded-lg p-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-white">{cust.name}</span>
                      <span className="text-amber-400">x{cust.quantity}</span>
                    </div>
                    <div className="text-white/40 text-xs flex justify-between mt-1">
                      <span>{cust.pickupTime}</span>
                      <a href={`tel:${cust.contact}`} className="hover:text-amber-400 transition-all">📞 {cust.contact}</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function Admin() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [archives, setArchives] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showArchives, setShowArchives] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isSoldOut, setIsSoldOut] = useState(false);
  const [togglingSoldOut, setTogglingSoldOut] = useState(false);
  const [isStockLimit, setIsStockLimit] = useState(false);
  const [togglingStockLimit, setTogglingStockLimit] = useState(false);
  const [showLoyalty, setShowLoyalty] = useState(false);
  const [loyaltyCustomers, setLoyaltyCustomers] = useState([]);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);
  const [showPrepSummary, setShowPrepSummary] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  const [showStockManager, setShowStockManager] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  const [openChatUserId, setOpenChatUserId] = useState(null);

  // Admin profile state
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const [adminProfile, setAdminProfile] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const CLOUD_NAME = "dvbbusgra";
  const UPLOAD_PRESET = "spam_musubi_preset";
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);

  // ========== AUTH STATE ==========
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && session.user.email === ADMIN_EMAIL) {
        fetchReservations();
        fetchArchives();
        fetchSoldOutStatus();
        fetchStockLimitStatus();
        fetchAdminProfile();
      } else if (session?.user) {
        window.location.href = "/dashboard";
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && session.user.email === ADMIN_EMAIL) {
        fetchReservations();
        fetchArchives();
        fetchSoldOutStatus();
        fetchStockLimitStatus();
        fetchAdminProfile();
      } else if (session?.user) {
        window.location.href = "/dashboard";
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ========== FETCH FUNCTIONS ==========
  const fetchReservations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReservations(data || []);
    } catch (error) {
      console.error("Error fetching:", error);
      addToast("Failed to load reservations", "error", "❌");
    } finally {
      setLoading(false);
    }
  };

  const fetchArchives = async () => {
    try {
      const { data, error } = await supabase
        .from('archives')
        .select('*')
        .order('archived_at', { ascending: false });
      if (error) throw error;
      setArchives(data || []);
    } catch (error) {
      console.error("Error fetching archives:", error);
    }
  };

  const fetchSoldOutStatus = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'soldOut').single();
    setIsSoldOut(data?.value ?? false);
  };

  const fetchStockLimitStatus = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'stockLimit').single();
    setIsStockLimit(data?.value ?? false);
  };

  const toggleSoldOut = async () => {
    setTogglingSoldOut(true);
    try {
      const newStatus = !isSoldOut;
      await supabase.from('settings').upsert({ key: 'soldOut', value: newStatus });
      setIsSoldOut(newStatus);
      addToast(newStatus ? "🔴 SOLD OUT - Customers cannot order" : "🟢 ACCEPTING ORDERS", "success", newStatus ? "🚫" : "✅");
    } catch (error) {
      addToast(`Error: ${error.message}`, "error", "❌");
    } finally {
      setTogglingSoldOut(false);
    }
  };

  const toggleStockLimit = async () => {
    setTogglingStockLimit(true);
    try {
      const newStatus = !isStockLimit;
      await supabase.from('settings').upsert({ key: 'stockLimit', value: newStatus });
      setIsStockLimit(newStatus);
      addToast(newStatus ? "⚠️ Stock limit ENABLED – customers cannot order" : "Stock limit DISABLED", "success", newStatus ? "⚠️" : "✅");
    } catch (error) {
      addToast(`Error: ${error.message}`, "error", "❌");
    } finally {
      setTogglingStockLimit(false);
    }
  };

  const fetchAdminProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) {
      setAdminProfile(data);
    } else {
      await supabase.from('profiles').insert({ id: user.id, full_name: "Admin", email: user.email });
      setAdminProfile({ full_name: "Admin", avatar_url: null });
    }
  };

  const uploadAdminAvatar = () => {
    if (!window.cloudinary) {
      alert("Cloudinary widget not loaded. Refresh the page.");
      return;
    }
    setUploadingAvatar(true);
    window.cloudinary.openUploadWidget(
      {
        cloudName: CLOUD_NAME,
        uploadPreset: UPLOAD_PRESET,
        sources: ["local", "camera"],
        cropping: true,
        multiple: false,
        maxFileSize: 5000000,
      },
      async (error, result) => {
        setUploadingAvatar(false);
        if (error || result.event !== "success") return;
        const imageUrl = result.info.secure_url;
        await supabase.from('profiles').update({ avatar_url: imageUrl }).eq('id', user.id);
        setAdminProfile(prev => ({ ...prev, avatar_url: imageUrl }));
        addToast("Avatar updated!", "success", "🖼️");
      }
    );
  };

  // ========== REAL‑TIME UNREAD COUNT (ADMIN) ==========
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('admin-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_uid=eq.${user.id} AND read=eq.false AND sender=eq.customer` }, () => {
        setAdminUnreadCount(prev => prev + 1);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `to_uid=eq.${user.id} AND read=eq.true` }, () => {
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('to_uid', user.id).eq('read', false).eq('sender', 'customer').then(({ count }) => setAdminUnreadCount(count || 0));
      })
      .subscribe();
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('to_uid', user.id).eq('read', false).eq('sender', 'customer').then(({ count }) => setAdminUnreadCount(count || 0));
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAllCustomerMessagesAsRead = async () => {
    if (!user) return;
    const { data: convs } = await supabase.from('conversations_meta').select('id').contains('participants', [user.id]);
    if (!convs) return;
    for (const conv of convs) {
      await supabase.from('messages').update({ read: true }).eq('conversation_id', conv.id).eq('sender', 'customer').eq('read', false);
    }
    setAdminUnreadCount(0);
  };

  // ========== ANALYTICS ==========
  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const { data: completedOrders } = await supabase.from('reservations').select('*').eq('status', 'completed');
      const totalOrders = completedOrders?.length || 0;
      const totalEarnings = completedOrders?.reduce((sum, r) => sum + (r.total_price || 0), 0) || 0;
      const { count: archivedCount } = await supabase.from('archives').select('*', { count: 'exact', head: true }).eq('status', 'completed');
      const productCount = {};
      completedOrders?.forEach(order => {
        const items = order.items || [];
        items.forEach(item => {
          const name = item.productName;
          productCount[name] = (productCount[name] || 0) + item.quantity;
        });
      });
      const popularProducts = Object.entries(productCount).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0,5);
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(); date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = completedOrders?.filter(r => r.pickup_date === dateStr).length || 0;
        last7Days.push({ date: dateStr, orders: count });
      }
      const last30Days = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(); date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = completedOrders?.filter(r => r.pickup_date === dateStr).length || 0;
        last30Days.push({ date: dateStr, orders: count });
      }
      setAnalyticsData({ totalOrders, totalEarnings, archivedCount: archivedCount || 0, activeCount: totalOrders, popularProducts, last7Days, last30Days });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      addToast('Failed to load market analytics', 'error', '❌');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchLoyaltyCustomers = async () => {
    setLoadingLoyalty(true);
    try {
      const { data } = await supabase.from('loyalty').select('*').order('total_purchased', { ascending: false });
      setLoyaltyCustomers(data || []);
    } catch (error) {
      addToast("Failed to load loyalty data", "error", "❌");
    } finally {
      setLoadingLoyalty(false);
    }
  };

  const updateLoyaltyOnCompletion = async (userId, userEmail, userName, orderItems) => {
    try {
      const orderQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const { data: existing } = await supabase.from('loyalty').select('*').eq('user_id', userId).single();
      if (existing) {
        const newTotal = (existing.total_purchased || 0) + orderQuantity;
        const oldRewards = Math.floor((existing.total_purchased || 0) / 10);
        const newRewards = Math.floor(newTotal / 10);
        const rewardsEarned = (existing.rewards_earned || 0) + (newRewards - oldRewards);
        await supabase.from('loyalty').update({ total_purchased: newTotal, rewards_earned: rewardsEarned, last_updated: new Date().toISOString() }).eq('user_id', userId);
        if (newRewards - oldRewards > 0) addToast(`🎉 Customer earned ${newRewards - oldRewards} free musubi reward!`, "success", "⭐");
      } else {
        const rewardsEarned = Math.floor(orderQuantity / 10);
        await supabase.from('loyalty').insert({ user_id: userId, user_email: userEmail, user_name: userName, total_purchased: orderQuantity, rewards_earned: rewardsEarned, rewards_redeemed: 0, created_at: new Date().toISOString() });
        if (rewardsEarned > 0) addToast(`🎉 New customer earned ${rewardsEarned} free musubi reward!`, "success", "⭐");
      }
    } catch (error) {
      console.error("Error updating loyalty:", error);
    }
  };

  const handleArchiveAll = async () => {
    if (!window.confirm("⚠️ ARCHIVE ALL RESERVATIONS?\n\nThis will move ALL current reservations to archives, clearing your dashboard completely.\n\nContinue?")) return;
    setArchiving(true);
    try {
      const { data: allReservations } = await supabase.from('reservations').select('*');
      if (allReservations && allReservations.length > 0) {
        const archiveData = allReservations.map(r => ({ ...r, archived_at: new Date().toISOString(), archived_reason: "manual_archive_all" }));
        await supabase.from('archives').insert(archiveData);
        const ids = allReservations.map(r => r.id);
        await supabase.from('reservations').delete().in('id', ids);
      }
      await fetchReservations();
      await fetchArchives();
      addToast(`🗑️ CLEANED! ${allReservations?.length || 0} reservation(s) moved to archives.`, "success", "🧹");
    } catch (error) {
      console.error("Archive all error:", error);
      addToast("Failed to archive. Try again.", "error", "❌");
    } finally {
      setArchiving(false);
    }
  };

  const handleResetArchives = async () => {
    setResetting(true);
    try {
      const { count } = await supabase.from('archives').select('*', { count: 'exact', head: true });
      await supabase.from('archives').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      addToast(`Archives cleared! Deleted ${count} archived orders.`, "success", "🗑️");
      await fetchArchives();
      await fetchAnalytics();
    } catch (error) {
      console.error('Reset error:', error);
      addToast('Failed to clear archives', 'error', '❌');
    } finally {
      setResetting(false);
      setShowResetConfirm(false);
    }
  };

  const updateStatus = async (id, status, reservation) => {
    setActionLoading(id + status);
    try {
      await supabase.from('reservations').update({ status }).eq('id', id);
      
      if (status === "confirmed" || status === "declined") {
        let orderSummary = "";
        if (reservation.items && reservation.items.length > 0) {
          orderSummary = reservation.items.map(i => {
            let line = `• ${i.productName} x${i.quantity}`;
            if (i.sauce !== "none") {
              let sauceName = "";
              switch (i.sauce) {
                case "garlicmayo": sauceName = "Garlic Mayo"; break;
                case "japanesemayo": sauceName = "Japanese Mayo"; break;
                case "chilioil": sauceName = "Chili Oil"; break;
                case "gochujang": sauceName = "Gochujang"; break;
                default: sauceName = i.sauce;
              }
              line += ` (${sauceName})`;
            }
            if (i.egg) line += " + 🍳 Egg";
            return line;
          }).join('<br>');
        } else {
          orderSummary = `• Classic Spam Musubi x${reservation.quantity}`;
        }
        
        await emailjs.send(
          'service_o9use8u',
          'template_v3uwjvz',
          {
            email: reservation.user_email,
            name: reservation.full_name,
            status: status.toUpperCase(),
            order_summary: orderSummary,
            total: `₱${reservation.total_price}`,
            message: status === 'confirmed'
              ? 'Your reservation is saved. Pick it up on the selected date and time! We look forward to seeing you. 😊'
              : 'We are so sorry, but we could not accommodate your order this time. We hope to serve you again soon! 🙏',
            pickup_date: reservation.pickup_date,
            pickup_time: `${reservation.pickup_slot} — ${reservation.pickup_time}`,
          },
          '9JV0iTFOi-Fb7Mxue'
        );
        addToast(`Email sent to ${reservation.full_name}!`, "success", "📧");
        
        if (status === "confirmed" && reservation.items && reservation.items.length > 0) {
          for (const item of reservation.items) {
            const productId = item.productId;
            const quantity = item.quantity;
            const { data: product } = await supabase.from('products').select('stock').eq('id', productId).single();
            const currentStock = product?.stock || 0;
            const newStock = Math.max(0, currentStock - quantity);
            await supabase.from('products').update({ stock: newStock }).eq('id', productId);
            addToast(`📦 ${item.productName} stock updated: ${currentStock} → ${newStock}`, "info", "📦");
          }
        }
        if (status === "confirmed") {
          await supabase.from('notifications').insert({
            user_id: reservation.user_id,
            message: `✅ Your order has been confirmed! Please arrive at ${reservation.pickup_time} on ${reservation.pickup_date}.`,
            read: false,
            type: "order_confirmed",
            order_id: id,
          });
        }
      }
      if (status === "completed") {
        await updateLoyaltyOnCompletion(
          reservation.user_id,
          reservation.user_email,
          reservation.full_name,
          reservation.items || [{ quantity: reservation.quantity, productName: reservation.productName }]
        );
        addToast(`Marked as completed!`, "success", "📦");
      }
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      if (status === "confirmed") addToast(`Confirmed for ${reservation.full_name}`, "success", "✅");
      if (status === "declined") addToast(`Declined for ${reservation.full_name}`, "info", "❌");
      if (status === "completed") addToast(`Marked as completed!`, "success", "📦");
      if (status === "no-show") addToast(`Marked as no-show for ${reservation.full_name}`, "info", "🚫");
    } catch (error) {
      console.error("Error updating:", error);
      addToast("Failed to update. Try again.", "error", "❌");
    } finally {
      setActionLoading(null);
    }
  };

  const stats = {
    total: reservations.length,
    pending: reservations.filter(r => r.status === "pending").length,
    confirmed: reservations.filter(r => r.status === "confirmed").length,
    completed: reservations.filter(r => r.status === "completed").length,
    noShow: reservations.filter(r => r.status === "no-show").length,
    earnings: reservations.filter(r => r.status === "completed").reduce((sum, r) => sum + (r.total_price || 0), 0),
  };

  const pieData = [
    { name: 'Pending', value: stats.pending, color: '#eab308' },
    { name: 'Confirmed', value: stats.confirmed, color: '#22c55e' },
    { name: 'Completed', value: stats.completed, color: '#3b82f6' },
    { name: 'No-Show', value: stats.noShow, color: '#6b7280' },
  ].filter(d => d.value > 0);

  const dailyOrders = (() => {
    const dailyMap = new Map();
    reservations.forEach(r => {
      const date = r.pickup_date;
      if (date) dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
    });
    const sorted = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-7);
    return sorted.map(([date, count]) => ({ date, count }));
  })();

  const filtered = reservations
    .filter(r => filter === "all" || r.status === filter)
    .filter(r => {
      if (!search) return true;
      const s = search.toLowerCase();
      return r.full_name?.toLowerCase().includes(s) || r.user_email?.toLowerCase().includes(s) || r.contact_number?.includes(s);
    });

  const groupedArchives = archives.reduce((acc, r) => {
    const date = r.pickup_date || "Unknown";
    if (!acc[date]) acc[date] = [];
    acc[date].push(r);
    return acc;
  }, {});

  // Authentication guards
  if (!user) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
      <div className="text-center"><div className="text-6xl mb-4">🔐</div><h2 className="text-2xl font-black text-white mb-2">Login Required</h2><p className="text-white/50 mb-6">You need to be logged in.</p><a href="/login" className="bg-amber-400 text-black font-bold px-6 py-3 rounded-xl">Go to Login</a></div>
    </div>
  );

  if (user.email !== ADMIN_EMAIL) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
      <div className="text-center"><div className="text-6xl mb-4">🚫</div><h2 className="text-2xl font-black text-white mb-2">Access Denied</h2><p className="text-white/30 text-sm mb-6">Logged in as: {user.email}</p><button onClick={() => supabase.auth.signOut()} className="bg-white/10 text-white font-bold px-6 py-3 rounded-xl">Sign Out</button></div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center"><div className="text-5xl mb-4 animate-bounce">🍱</div><p className="text-white/50">Loading reservations...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Toast toasts={toasts} removeToast={removeToast} />

      {showPrepSummary && <PrepSummaryModal reservations={reservations.filter(r => r.status === "confirmed")} onClose={() => setShowPrepSummary(false)} />}

      {/* Header */}
      <div className="bg-black/80 border-b border-amber-400/20 px-6 py-4 sticky top-0 z-50 backdrop-blur">
        <div className="max-w-5xl mx-auto flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3"><span className="text-2xl">🍱</span><div><p className="font-black text-amber-400 leading-none">Spam Musubi</p><p className="text-white/40 text-xs">Admin Dashboard</p></div></div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setShowArchives(true)} className="text-xs border border-white/20 px-3 py-1.5 rounded-lg hover:border-amber-400/50 hover:text-amber-400">📦 Archives</button>
            <button onClick={handleArchiveAll} disabled={archiving} className="text-xs border border-red-400/50 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-400/10 disabled:opacity-50">{archiving ? "Archiving..." : "🗑️ CLEAR ALL"}</button>
            <button onClick={() => { setShowAnalytics(true); fetchAnalytics(); }} className="text-xs border border-amber-400/50 text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-400/10">📊 Market Analytics</button>
            <button onClick={() => { setShowLoyalty(true); fetchLoyaltyCustomers(); }} className="text-xs border border-amber-400/50 text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-400/10">⭐ Loyalty</button>
            <button onClick={() => setShowPrepSummary(true)} className="text-xs border border-amber-400/50 text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-400/10">📋 Prep Summary</button>
            <button onClick={() => setShowStockManager(true)} className="text-xs border border-amber-400/50 text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-400/10">📦 Stock Manager</button>
            <button onClick={toggleSoldOut} disabled={togglingSoldOut} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${isSoldOut ? "bg-red-600 text-white hover:bg-red-700" : "bg-green-600 text-white hover:bg-green-700"}`}>{togglingSoldOut ? "..." : (isSoldOut ? "🚫 SOLD OUT" : "✅ ACCEPTING ORDERS")}</button>
            <button onClick={toggleStockLimit} disabled={togglingStockLimit} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${isStockLimit ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-gray-600 text-white hover:bg-gray-700"}`}>{togglingStockLimit ? "..." : (isStockLimit ? "⚠️ STOCK LIMIT" : "📦 STOCK OK")}</button>
            <div className="relative">
              <button onClick={async () => { await markAllCustomerMessagesAsRead(); setShowChatList(true); }} className="text-xs border border-amber-400/50 text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-400/10">💬</button>
              {adminUnreadCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{adminUnreadCount > 9 ? "9+" : adminUnreadCount}</span>}
            </div>
            <button onClick={() => setShowAdminProfile(true)} className="text-xs border border-amber-400/50 text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-400/10">👤 Profile</button>
            <button onClick={() => supabase.auth.signOut()} className="text-xs border border-white/20 px-3 py-1.5 rounded-lg hover:border-red-400/50 hover:text-red-400">Sign out</button>
          </div>
        </div>
      </div>

      {/* Archives Modal */}
      {showArchives && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-start justify-center pt-16 px-4 overflow-y-auto">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-3xl p-6 mb-8">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-amber-400">📦 Archives</h2><button onClick={() => setShowArchives(false)} className="text-white/40 hover:text-white text-2xl">✕</button></div>
            {Object.keys(groupedArchives).length === 0 ? (
              <div className="text-center py-12"><div className="text-5xl mb-4">📭</div><p className="text-white/50">No archives yet.</p></div>
            ) : (
              Object.entries(groupedArchives).sort(([a],[b]) => b.localeCompare(a)).map(([date, recs]) => {
                const totalOrders = recs.length;
                const completedEarnings = recs.filter(r => r.status === "completed").reduce((sum, r) => sum + (r.total_price || 0), 0);
                return (
                  <div key={date} className="mb-6">
                    <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2"><span className="text-2xl">📁</span><h3 className="text-amber-400 font-black text-lg">{date}</h3></div>
                      <div className="flex gap-3 text-xs"><span className="text-white/40">{totalOrders} total order{totalOrders !== 1 ? 's' : ''}</span><span className="text-amber-400 font-bold">₱{completedEarnings} earned</span></div>
                    </div>
                    <div className="space-y-2">
                      {recs.map((r, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center">
                          <div className="flex items-center gap-3"><Avatar name={r.full_name} /><div><p className="font-bold text-sm">{r.full_name}</p><p className="text-white/40 text-xs">{r.items?.map(item => `${item.productName} x${item.quantity}`).join(', ') || `Classic x${r.quantity}`}</p><p className="text-white/30 text-xs mt-0.5">⏰ {r.pickup_slot} — {r.pickup_time}</p></div></div>
                          <div className="text-right"><span className={`text-xs font-bold px-2 py-1 rounded-full border capitalize inline-flex items-center gap-1 ${statusColor(r.status)}`}>{statusIcon(r.status)} {r.status}</span><p className="text-amber-400 font-black text-sm mt-1">₱{r.total_price}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Loyalty Modal */}
      {showLoyalty && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center pt-16 px-4 overflow-y-auto">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-3xl p-6 mb-8">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-amber-400">⭐ Loyalty Rewards</h2><button onClick={() => setShowLoyalty(false)} className="text-white/40 hover:text-white text-2xl">✕</button></div>
            {loadingLoyalty ? <div className="text-center py-12"><p className="text-white/50">Loading...</p></div> : loyaltyCustomers.length === 0 ? <div className="text-center py-12"><p className="text-white/50">No loyalty data yet</p></div> : (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-xs text-white/40 pb-2 border-b border-white/10"><span>Customer</span><span>Total Musubi</span><span>Rewards Earned</span><span>Available</span></div>
                {loyaltyCustomers.map(customer => (
                  <div key={customer.id} className="grid grid-cols-4 gap-2 items-center p-3 bg-white/5 rounded-xl">
                    <span className="text-sm font-medium truncate">{customer.user_name || customer.user_email}</span>
                    <span className="text-amber-400 font-bold">{customer.total_purchased}</span>
                    <span className="text-white/70">{customer.rewards_earned}</span>
                    <span className="text-green-400 font-bold">{customer.rewards_earned - (customer.rewards_redeemed || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Market Analytics Modal */}
      {showAnalytics && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-start justify-center pt-16 px-4 overflow-y-auto">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl p-6 mb-8">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-amber-400">📊 Market Analytics</h2><button onClick={() => setShowAnalytics(false)} className="text-white/40 hover:text-white text-2xl">✕</button></div>
            {loadingAnalytics ? <div className="text-center py-12"><div className="text-5xl mb-4 animate-bounce">📊</div><p className="text-white/50">Loading market data...</p></div> : analyticsData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-center"><div className="text-2xl mb-1">✅</div><p className="text-2xl font-black text-white">{analyticsData.totalOrders}</p><p className="text-white/40 text-xs">Completed Orders</p></div>
                  <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-center"><div className="text-2xl mb-1">💰</div><p className="text-2xl font-black text-amber-400">₱{analyticsData.totalEarnings}</p><p className="text-white/40 text-xs">Total Earnings</p></div>
                  <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-center"><div className="text-2xl mb-1">📦</div><p className="text-2xl font-black text-blue-400">{analyticsData.archivedCount}</p><p className="text-white/40 text-xs">Archived Completed</p></div>
                  <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-center"><div className="text-2xl mb-1">🟢</div><p className="text-2xl font-black text-green-400">{analyticsData.activeCount}</p><p className="text-white/40 text-xs">Active Completed</p></div>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-2xl p-6"><h3 className="text-lg font-black text-amber-400 mb-4">📈 Completed Orders (Last 7 Days)</h3>{analyticsData.last7Days?.length > 0 ? <ResponsiveContainer width="100%" height={250}><BarChart data={analyticsData.last7Days}><XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-15} textAnchor="end" height={50} /><YAxis tick={{ fill: '#9ca3af' }} allowDecimals={false} /><Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#f59e0b' }} /><Bar dataKey="orders" fill="#f59e0b" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer> : <div className="h-[250px] flex items-center justify-center text-white/40">No completed orders yet</div>}</div>
                <div className="bg-black/40 border border-white/10 rounded-2xl p-6"><h3 className="text-lg font-black text-amber-400 mb-4">📊 Completed Orders (Last 30 Days)</h3>{analyticsData.last30Days?.length > 0 ? <ResponsiveContainer width="100%" height={300}><BarChart data={analyticsData.last30Days}><XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-45} textAnchor="end" height={60} interval={2} /><YAxis tick={{ fill: '#9ca3af' }} allowDecimals={false} /><Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#f59e0b' }} /><Bar dataKey="orders" fill="#f59e0b" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer> : <div className="h-[300px] flex items-center justify-center text-white/40">No completed orders yet</div>}</div>
                {analyticsData.popularProducts?.length > 0 && (<div className="bg-black/40 border border-white/10 rounded-2xl p-6"><h3 className="text-lg font-black text-amber-400 mb-4">🏆 Best Selling Products</h3><div className="space-y-3">{analyticsData.popularProducts.map((product, idx) => (<div key={product.name} className="flex justify-between items-center p-3 rounded-lg bg-white/5"><div className="flex items-center gap-3"><span className="text-xl">{idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':'📋'}</span><span className="text-white/90 font-medium">{product.name}</span></div><span className="text-amber-400 font-bold">{product.count} sold</span></div>))}</div></div>)}
                <div className="border-t border-white/10 pt-6 mt-4"><div className="flex justify-end"><button onClick={() => setShowResetConfirm(true)} className="px-4 py-2 rounded-lg bg-red-400/10 border border-red-400/30 text-red-400 hover:bg-red-400/20 transition-all text-sm font-medium flex items-center gap-2">🗑️ Clear All Archives</button></div></div>
              </div>
            ) : <div className="text-center py-12"><div className="text-5xl mb-4">❌</div><p className="text-white/50">Failed to load analytics data.</p></div>}
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center px-4">
          <div className="bg-[#111] border border-red-400/30 rounded-2xl w-full max-w-md p-6">
            <div className="text-center"><div className="text-5xl mb-4">⚠️</div><h2 className="text-xl font-black text-red-400 mb-3">Clear All Archives</h2><p className="text-white/60 mb-4">This will permanently delete all archived orders and historical data. Active reservations will NOT be affected.</p><div className="flex gap-3"><button onClick={() => setShowResetConfirm(false)} className="flex-1 bg-white/10 text-white font-bold py-2 rounded-xl">Cancel</button><button onClick={handleResetArchives} disabled={resetting} className="flex-1 bg-red-400/20 border border-red-400/50 text-red-400 font-bold py-2 rounded-xl disabled:opacity-50">{resetting ? "Clearing..." : "Yes, Clear Archives"}</button></div></div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8"><h1 className="text-3xl font-black">Welcome, <span className="text-amber-400">Bryann!</span> 👋</h1><p className="text-white/50 mt-1">All reservations</p></div>

        {reservations.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10"><div className="text-5xl mb-4">🧹</div><h2 className="text-xl font-bold text-white/70 mb-2">Dashboard is Clean!</h2><p className="text-white/40">No active reservations. Click "ACCEPTING ORDERS" to allow new customers.</p></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
              {[
                { label: "Total Orders", value: stats.total, color: "text-white", icon: "🍱", bg: "bg-white/5" },
                { label: "Pending", value: stats.pending, color: "text-yellow-400", icon: "🟡", bg: "bg-yellow-400/5" },
                { label: "Confirmed", value: stats.confirmed, color: "text-green-400", icon: "✅", bg: "bg-green-400/5" },
                { label: "Completed", value: stats.completed, color: "text-blue-400", icon: "📦", bg: "bg-blue-400/5" },
                { label: "No-Show", value: stats.noShow, color: "text-gray-400", icon: "🚫", bg: "bg-gray-400/5" },
                { label: "Earnings", value: `₱${stats.earnings}`, color: "text-amber-400", icon: "💰", bg: "bg-amber-400/5" },
              ].map((stat, i) => (
                <div key={i} className={`${stat.bg} border border-white/10 rounded-2xl p-4 text-center`}>
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                  <p className="text-white/40 text-xs mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-black/40 border border-white/10 rounded-2xl p-6"><h3 className="text-lg font-black text-amber-400 mb-4">📊 Order Status</h3>{pieData.length === 0 ? <div className="h-[250px] flex items-center justify-center text-white/40">No data yet</div> : <ResponsiveContainer width="100%" height={250}><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} (${(percent*100).toFixed(0)}%)`} labelLine={false}>{pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#f59e0b' }} /></PieChart></ResponsiveContainer>}<p className="text-center text-white/40 text-xs mt-2">Total Orders: {stats.total}</p></div>
              <div className="bg-black/40 border border-white/10 rounded-2xl p-6"><h3 className="text-lg font-black text-amber-400 mb-4">📈 Daily Orders</h3>{dailyOrders.length === 0 ? <div className="h-[250px] flex items-center justify-center text-white/40">No data yet</div> : <ResponsiveContainer width="100%" height={250}><BarChart data={dailyOrders}><XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-15} textAnchor="end" height={50} /><YAxis tick={{ fill: '#9ca3af' }} allowDecimals={false} /><Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#f59e0b' }} /><Bar dataKey="count" fill="#f59e0b" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>}<p className="text-center text-white/40 text-xs mt-2">Last 7 days</p></div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <input type="text" placeholder="🔍 Search by name, email or number..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-amber-400 focus:outline-none text-white text-sm" />
              <div className="flex gap-2 flex-wrap">
                {["all", "pending", "confirmed", "declined", "completed", "no-show"].map((tab) => (
                  <button key={tab} onClick={() => setFilter(tab)} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all capitalize ${filter === tab ? "bg-amber-400 text-black border-amber-400" : "bg-white/5 text-white/50 border-white/10 hover:border-amber-400/30"}`}>
                    {tab === "all" ? "All" : `${statusIcon(tab)} ${tab}`}
                    {tab !== "all" && ` (${reservations.filter(r => r.status === tab).length})`}
                  </button>
                ))}
                <button onClick={fetchReservations} className="px-4 py-2 rounded-xl text-sm font-bold border border-white/10 text-white/50 hover:border-amber-400/30">🔄</button>
              </div>
            </div>

            <div className="space-y-4">
              {filtered.map((r) => {
                const isExpanded = expandedId === r.id;
                return (
                  <div key={r.id} className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden hover:border-amber-400/20 transition-all">
                    <div className="p-5 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3"><Avatar name={r.full_name} /><div><p className="font-black text-base">{r.full_name}</p><p className="text-white/40 text-xs">{r.user_email}</p></div></div>
                        <div className="flex items-center gap-3 ml-auto"><div className="bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-1.5 text-center hidden sm:block"><p className="text-amber-400 font-black text-sm">{r.pickup_time}</p><p className="text-amber-400/60 text-xs">{r.pickup_slot?.replace(/[^\w\s]/gi, '').trim()}</p></div><div className="text-right"><p className="text-amber-400 font-black text-lg">₱{r.total_price}</p><span className={`text-xs font-bold px-2 py-0.5 rounded-full border capitalize inline-flex items-center gap-1 ${statusColor(r.status)}`}>{statusIcon(r.status)} {r.status}</span></div><span className="text-white/30 text-lg">{isExpanded ? "▲" : "▼"}</span></div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 sm:hidden"><span className="text-amber-400 text-sm">⏰</span><span className="text-white/60 text-sm">{r.pickup_slot} — {r.pickup_time}</span></div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-white/10 p-5 space-y-4">
                        <div className="flex gap-4 flex-wrap text-sm text-white/50"><a href={`tel:${r.contact_number}`} className="hover:text-amber-400 transition-all">📞 {r.contact_number}</a>{r.user_type === "student" && <span>🎓 ID: {r.student_id}</span>}{r.user_type === "staff" && <span>🏫 {r.department}</span>}</div>
                        <div className="bg-white/5 rounded-xl p-4 space-y-2"><p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">Order Details</p>{r.items ? r.items.map((item, i) => (<div key={i} className="flex justify-between text-sm"><span className="text-white/70">{item.productName} x{item.quantity}{item.sauce !== "none" ? ` + ${item.sauce}` : ""}{item.egg ? " + egg" : ""}</span><span className="text-amber-400 font-bold">₱{(item.productPrice + (item.sauce !== "none" ? 10 : 0) + (item.egg ? 10 : 0)) * item.quantity}</span></div>)) : <div className="flex justify-between text-sm"><span className="text-white/70">Classic Spam Musubi x{r.quantity}</span><span className="text-amber-400 font-bold">₱{r.total_price}</span></div>}<div className="border-t border-white/10 pt-2 flex justify-between font-black"><span>Total</span><span className="text-amber-400">₱{r.total_price}</span></div></div>
                        <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl px-4 py-3 flex items-center justify-between"><div><p className="text-xs text-amber-400/60 uppercase tracking-wider">Pickup</p><p className="font-bold">{r.pickup_date} — {r.pickup_slot} at {r.pickup_time}</p></div><span className="text-2xl">📅</span></div>
                        {r.status === "pending" && (
                          <div className="flex gap-3">
                            <button onClick={() => updateStatus(r.id, "confirmed", r)} disabled={actionLoading === r.id + "confirmed"} className="flex-1 bg-green-400/10 border border-green-400/30 text-green-400 font-bold py-3 rounded-xl hover:bg-green-400/20 disabled:opacity-50 flex items-center justify-center gap-2">{actionLoading === r.id + "confirmed" ? <><span className="animate-spin">⏳</span> Confirming...</> : "✅ Approve"}</button>
                            <button onClick={() => updateStatus(r.id, "declined", r)} disabled={actionLoading === r.id + "declined"} className="flex-1 bg-red-400/10 border border-red-400/30 text-red-400 font-bold py-3 rounded-xl hover:bg-red-400/20 disabled:opacity-50 flex items-center justify-center gap-2">{actionLoading === r.id + "declined" ? <><span className="animate-spin">⏳</span> Declining...</> : "❌ Decline"}</button>
                          </div>
                        )}
                        {r.status === "confirmed" && (
                          <div className="flex gap-3">
                            <button onClick={() => updateStatus(r.id, "completed", r)} disabled={actionLoading === r.id + "completed"} className="flex-1 bg-blue-400/10 border border-blue-400/30 text-blue-400 font-bold py-3 rounded-xl hover:bg-blue-400/20 disabled:opacity-50 flex items-center justify-center gap-2">{actionLoading === r.id + "completed" ? <><span className="animate-spin">⏳</span> Updating...</> : "📦 Completed"}</button>
                            <button onClick={() => updateStatus(r.id, "no-show", r)} disabled={actionLoading === r.id + "no-show"} className="flex-1 bg-gray-400/10 border border-gray-400/30 text-gray-400 font-bold py-3 rounded-xl hover:bg-gray-400/20 disabled:opacity-50 flex items-center justify-center gap-2">{actionLoading === r.id + "no-show" ? <><span className="animate-spin">⏳</span> Marking...</> : "🚫 No-Show"}</button>
                          </div>
                        )}
                        <p className="text-white/20 text-xs">Reserved on: {new Date(r.created_at).toLocaleString("en-PH")}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showChatList && <ConversationList onClose={() => { setShowChatList(false); setOpenChatUserId(null); }} preselectedUserId={openChatUserId} />}
      {showStockManager && <StockManager onClose={() => setShowStockManager(false)} />}
      {showAdminProfile && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-6">
          <div className="bg-[#111] border border-amber-400/30 rounded-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-black text-amber-400">👤 Admin Profile</h2><button onClick={() => setShowAdminProfile(false)} className="text-white/40 hover:text-white text-xl">✕</button></div>
            <div className="flex flex-col items-center mb-4"><div className="w-24 h-24 rounded-full bg-amber-400/20 flex items-center justify-center text-4xl overflow-hidden">{adminProfile?.avatar_url ? <img src={adminProfile.avatar_url} alt="Admin" className="w-full h-full object-cover" /> : <span className="text-amber-400">{user?.email?.[0].toUpperCase() || "A"}</span>}</div><button onClick={uploadAdminAvatar} disabled={uploadingAvatar} className="mt-2 text-xs bg-amber-400/20 border border-amber-400/50 text-amber-400 px-3 py-1 rounded-lg hover:bg-amber-400/30">{uploadingAvatar ? "Uploading..." : "Change picture"}</button></div>
            <div className="bg-white/5 rounded-xl p-3 mb-4"><p className="text-white/70 text-sm font-medium">Email</p><p className="text-white text-sm">{user?.email}</p></div>
            <button onClick={() => setShowAdminProfile(false)} className="w-full bg-amber-400 text-black font-bold py-2 rounded-lg">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}