import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import ChatModal from "./ChatModal";

const ADMIN_EMAIL = "monsanto.bryann@gmail.com";
// Admin UID – we'll fetch it dynamically from profiles or auth.users
// But we'll keep a constant for convenience; you can also fetch it.
// In Supabase, the admin user ID is the one with email = ADMIN_EMAIL
// We'll fetch it when needed.

const Avatar = ({ name, imageUrl, online }) => {
  if (imageUrl) {
    return (
      <div className="relative">
        <img src={imageUrl} alt={name} className="w-10 h-10 rounded-full object-cover" />
        {online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>}
      </div>
    );
  }
  const initials = name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??";
  const colors = ["bg-amber-400", "bg-green-400", "bg-blue-400", "bg-purple-400", "bg-pink-400"];
  const color = colors[name?.charCodeAt(0) % colors.length] || "bg-amber-400";
  return (
    <div className="relative">
      <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center font-black text-black text-sm flex-shrink-0`}>
        {initials}
      </div>
      {online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>}
    </div>
  );
};

const ConversationList = ({ onClose, preselectedUserId = null }) => {
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUid, setAdminUid] = useState(null);

  // Get current user and admin UID
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        const admin = session.user.email === ADMIN_EMAIL;
        setIsAdmin(admin);
        // Fetch admin UID from profiles table (or use session.user.id if admin)
        if (admin) {
          setAdminUid(session.user.id);
        } else {
          // Fetch admin UID from profiles (by email)
          const { data } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', ADMIN_EMAIL)
            .single();
          if (data) setAdminUid(data.id);
        }
      }
    };
    fetchUser();
  }, []);

  // Subscribe to conversations_meta changes
  useEffect(() => {
    if (!currentUser || !adminUid) return;

    // First, ensure a conversation exists with admin (if customer)
    const ensureAdminConversation = async () => {
      if (isAdmin) return;
      const convId = [currentUser.id, adminUid].sort().join('_');
      const { data: existing } = await supabase
        .from('conversations_meta')
        .select('id')
        .eq('id', convId)
        .single();
      if (!existing) {
        // Create the conversation metadata
        await supabase.from('conversations_meta').insert({
          id: convId,
          participants: [currentUser.id, adminUid],
          last_message: "Start a conversation",
          last_updated: new Date().toISOString(),
        });
      }
    };
    ensureAdminConversation();

    // Real-time subscription to conversations_meta where currentUser is a participant
    const channel = supabase
      .channel('conversations-meta')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations_meta',
          filter: `participants=cs.{${currentUser.id}}`,
        },
        async () => {
          // Refresh conversations when any change occurs
          await loadConversations();
        }
      )
      .subscribe();

    loadConversations();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, adminUid, isAdmin]);

  const loadConversations = async () => {
    if (!currentUser || !adminUid) return;

    // Fetch all conversations where currentUser is a participant
    const { data: metaList, error } = await supabase
      .from('conversations_meta')
      .select('*')
      .contains('participants', [currentUser.id])
      .order('last_updated', { ascending: false });

    if (error) {
      console.error("Error loading conversations:", error);
      return;
    }

    const convList = [];
    for (const meta of metaList) {
      const otherUserId = meta.participants.find(uid => uid !== currentUser.id);
      if (!otherUserId) continue;

      // Fetch other user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, online')
        .eq('id', otherUserId)
        .single();

      const userName = profile?.full_name || (otherUserId === adminUid ? "Owner" : "User");
      const avatarUrl = profile?.avatar_url || null;
      const online = profile?.online === true;

      // Fetch last message to determine unread status
      const { data: lastMsgData } = await supabase
        .from('messages')
        .select('text, sender, read, timestamp')
        .eq('conversation_id', meta.id)
        .order('timestamp', { ascending: false })
        .limit(1);

      let lastMessage = meta.last_message || "";
      let unread = false;
      if (lastMsgData && lastMsgData.length > 0) {
        const lastMsg = lastMsgData[0];
        lastMessage = lastMsg.text || lastMessage;
        const isFromOther = (isAdmin && lastMsg.sender === 'customer') || (!isAdmin && lastMsg.sender === 'admin');
        const isRead = lastMsg.read === true;
        unread = isFromOther && !isRead;
      }

      convList.push({
        userId: otherUserId,
        userName,
        userEmail: otherUserId === adminUid ? ADMIN_EMAIL : "",
        userAvatar: avatarUrl,
        online,
        lastMessage,
        lastTimestamp: meta.last_updated,
        unread,
      });
    }

    // If customer and no conversations, add a placeholder for admin
    if (!isAdmin && convList.length === 0 && adminUid) {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, online')
        .eq('id', adminUid)
        .single();
      convList.push({
        userId: adminUid,
        userName: adminProfile?.full_name || "Owner",
        userEmail: ADMIN_EMAIL,
        userAvatar: adminProfile?.avatar_url || null,
        online: adminProfile?.online === true,
        lastMessage: "Start a conversation",
        lastTimestamp: null,
        unread: false,
      });
    }

    setConversations(convList);
  };

  useEffect(() => {
    if (preselectedUserId && conversations.length > 0) {
      const target = conversations.find(c => c.userId === preselectedUserId);
      if (target) setSelectedChat(target);
    }
  }, [preselectedUserId, conversations]);

  if (!currentUser) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
        <div className="bg-[#111] p-6 rounded-2xl text-white/50">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center pt-16 px-4 overflow-y-auto">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-amber-400">💬 Messages</h2>
            <button 
              onClick={() => loadConversations()} 
              className="text-xs text-amber-400 hover:text-amber-300 transition-all"
              title="Refresh conversations"
            >
              🔄
            </button>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl">✕</button>
        </div>

        {conversations.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">💬</div>
            <p className="text-white/50">No conversations yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-white/10 text-white/50 text-xs uppercase">Conversations</div>
              <div className="divide-y divide-white/10 max-h-[500px] overflow-y-auto">
                {conversations.map((conv) => (
                  <button
                    key={conv.userId}
                    onClick={() => setSelectedChat(conv)}
                    className={`w-full p-3 text-left hover:bg-white/5 transition-all ${selectedChat?.userId === conv.userId ? 'bg-white/10' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={conv.userName} imageUrl={conv.userAvatar} online={conv.online} />
                      <div className="flex-1">
                        <p className={`text-sm ${conv.unread ? 'font-bold text-white' : 'font-normal text-white/80'}`}>
                          {isAdmin ? conv.userName : "Owner"}
                        </p>
                        <p className={`text-xs truncate ${conv.unread ? 'text-amber-400 font-medium' : 'text-white/40'}`}>
                          {conv.lastMessage || "No messages yet"}
                        </p>
                      </div>
                      {conv.unread && (
                        <div className="w-2.5 h-2.5 bg-amber-400 rounded-full shadow-lg shadow-amber-400/50"></div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 bg-black/40 border border-white/10 rounded-xl flex flex-col h-[500px]">
              {selectedChat ? (
                <ChatModal
                  userId={selectedChat.userId}
                  userName={selectedChat.userName}
                  userEmail={selectedChat.userEmail}
                  onClose={() => setSelectedChat(null)}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-white/40">
                  Select a conversation to start messaging
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;