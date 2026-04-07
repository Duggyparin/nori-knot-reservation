import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

const ADMIN_EMAIL = "monsanto.bryann@gmail.com";
const DEFAULT_ADMIN_AVATAR = "https://i.pravatar.cc/150?img=7";

const Avatar = ({ name, imageUrl }) => {
  if (imageUrl) return <img src={imageUrl} alt={name} className="w-10 h-10 rounded-full object-cover" />;
  const initials = name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??";
  const colors = ["bg-amber-400", "bg-green-400", "bg-blue-400", "bg-purple-400", "bg-pink-400"];
  const color = colors[name?.charCodeAt(0) % colors.length] || "bg-amber-400";
  return (
    <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center font-black text-black text-sm flex-shrink-0`}>
      {initials}
    </div>
  );
};

const getConversationId = (uid1, uid2) => [uid1, uid2].sort().join('_');

const ChatModal = ({ userId, userName, userEmail, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [otherUserAvatar, setOtherUserAvatar] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState(null);
  const messagesEndRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  // Get current user and conversation ID
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        const admin = session.user.email === ADMIN_EMAIL;
        setIsAdmin(admin);
        const convId = getConversationId(session.user.id, userId);
        setConversationId(convId);
      }
    };
    fetchUser();
  }, [userId]);

  // Auto‑create conversation metadata if missing
  useEffect(() => {
    if (!conversationId || !currentUser) return;
    const initConversation = async () => {
      const { data: existing } = await supabase
        .from('conversations_meta')
        .select('id')
        .eq('id', conversationId)
        .single();
      if (!existing) {
        await supabase.from('conversations_meta').insert({
          id: conversationId,
          participants: [currentUser.id, userId],
          last_message: "",
          last_updated: new Date().toISOString(),
        });
      }
    };
    initConversation();
  }, [conversationId, currentUser, userId]);

  // Fetch admin data (for customer view)
  useEffect(() => {
    if (isAdmin) return;
    const fetchAdmin = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, last_seen')
        .eq('email', ADMIN_EMAIL)
        .single();
      if (data) {
        setAdminData({ fullName: data.full_name, avatarUrl: data.avatar_url, lastSeen: data.last_seen });
        setOtherUserLastSeen(data.last_seen);
      }
    };
    fetchAdmin();
  }, [isAdmin]);

  // Real‑time online status for the other user
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user-status-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          setOtherUserOnline(payload.new.online === true);
          setOtherUserLastSeen(payload.new.last_seen);
        }
      )
      .subscribe();
    // Initial fetch
    supabase.from('profiles').select('online, last_seen').eq('id', userId).single().then(({ data }) => {
      if (data) {
        setOtherUserOnline(data.online === true);
        setOtherUserLastSeen(data.last_seen);
      }
    });
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Real‑time messages subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMsg = payload.new;
          let timestampDate = newMsg.timestamp ? new Date(newMsg.timestamp) : new Date();
          setMessages(prev => [...prev, {
            id: newMsg.id,
            text: newMsg.text,
            sender: newMsg.sender,
            senderName: newMsg.sender_name,
            read: newMsg.read === true,
            timestamp: timestampDate,
          }]);
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      )
      .subscribe();
    // Load existing messages
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });
      if (!error && data) {
        const msgs = data.map(msg => ({
          id: msg.id,
          text: msg.text,
          sender: msg.sender,
          senderName: msg.sender_name,
          read: msg.read === true,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        }));
        setMessages(msgs);
      }
    };
    loadMessages();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // Mark messages as read when chat is open
  useEffect(() => {
    if (!conversationId || !currentUser) return;
    const markAsRead = async () => {
      const otherSender = isAdmin ? "customer" : "admin";
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .eq('sender', otherSender)
        .eq('read', false);
    };
    markAsRead();
  }, [conversationId, currentUser, isAdmin]);

  // Fetch customer details (for admin)
  useEffect(() => {
    if (!userId || !isAdmin) return;
    const fetchCustomer = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, contact_number')
        .eq('id', userId)
        .single();
      if (profile) {
        setOtherUserAvatar(profile.avatar_url || "");
        setCustomerPhone(profile.contact_number || "");
      }
      if (!profile?.contact_number) {
        // Fallback: get from latest reservation
        const { data: reservation } = await supabase
          .from('reservations')
          .select('contact_number')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (reservation?.contact_number) setCustomerPhone(reservation.contact_number);
      }
    };
    fetchCustomer();
  }, [userId, isAdmin]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !currentUser) return;
    setSending(true);
    try {
      const messageData = {
        conversation_id: conversationId,
        text: newMessage,
        sender: isAdmin ? "admin" : "customer",
        sender_name: isAdmin ? "Owner" : currentUser.user_metadata?.full_name || "Customer",
        from_uid: currentUser.id,
        to_uid: userId,
        timestamp: new Date().toISOString(),
        read: false,
      };
      const { error } = await supabase.from('messages').insert(messageData);
      if (error) throw error;
      // Update last_message and last_updated in conversations_meta
      await supabase
        .from('conversations_meta')
        .update({ last_message: newMessage, last_updated: new Date().toISOString() })
        .eq('id', conversationId);
      setNewMessage("");
    } catch (error) {
      console.error("Send error:", error);
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const formatLastSeen = (lastSeenISO) => {
    if (!lastSeenISO) return "Recently";
    const lastSeen = new Date(lastSeenISO);
    const now = new Date();
    const diffMs = now - lastSeen;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    try {
      if (timestamp instanceof Date && !isNaN(timestamp)) {
        return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return "";
    } catch (e) {
      return "";
    }
  };

  const otherName = isAdmin ? userName : (adminData?.fullName || "Owner");
  let avatarToShow = isAdmin ? otherUserAvatar : (adminData?.avatarUrl || DEFAULT_ADMIN_AVATAR);

  if (!currentUser) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md flex flex-col h-[600px]">
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Avatar name={otherName} imageUrl={avatarToShow} />
            <div>
              <h3 className="font-black text-white">{otherName}</h3>
              <p className="text-white/40 text-xs">
                {otherUserOnline ? <span className="text-green-400">● Online</span> : <span>Last seen {formatLastSeen(otherUserLastSeen)}</span>}
              </p>
              {isAdmin && customerPhone && (
                <a href={`tel:${customerPhone}`} className="text-xs text-green-400 hover:text-green-300 block mt-1">📞 {customerPhone}</a>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-white/40 py-8">No messages yet. Start the conversation!</div>
          ) : (
            messages.map((msg) => {
              const isMyMessage = msg.sender === (isAdmin ? "admin" : "customer");
              const timeStr = formatTime(msg.timestamp);
              return (
                <div key={msg.id} className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMyMessage ? "bg-amber-400 text-black rounded-br-sm" : "bg-white/10 text-white rounded-bl-sm"}`}>
                    <p className="text-sm break-words">{msg.text}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <p className="text-[10px] opacity-60">{timeStr}</p>
                      {isMyMessage && msg.read === true && <span className="text-[10px] text-green-400">✓✓ Seen</span>}
                      {isMyMessage && msg.read !== true && <span className="text-[10px] text-white/40">✓ Delivered</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-white/10 flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 rounded-xl bg-white/10 border border-white/20 focus:border-amber-400 focus:outline-none text-white text-sm"
          />
          <button onClick={sendMessage} disabled={sending} className="px-4 py-2 rounded-xl bg-amber-400 text-black font-bold hover:bg-amber-300 disabled:opacity-50">
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatModal;