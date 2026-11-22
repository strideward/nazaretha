// Iconoir Icons Helper & Lucide Fallback
window.lucide = { createIcons: function() {} };
function getIconoirClass(name) {
  const map = {
    'chevron-left': 'iconoir-nav-arrow-left',
    'chevron-right': 'iconoir-nav-arrow-right',
    'search': 'iconoir-search',
    'settings': 'iconoir-settings',
    'bell': 'iconoir-bell',
    'plus': 'iconoir-plus',
    'square-plus': 'iconoir-plus-square',
    'home': 'iconoir-home',
    'user': 'iconoir-user',
    'user-round': 'iconoir-user',
    'user-plus': 'iconoir-user-plus',
    'x': 'iconoir-xmark',
    'check': 'iconoir-check',
    'badge-check': 'iconoir-badge-check',
    'heart': 'iconoir-heart',
    'bookmark': 'iconoir-bookmark',
    'share-2': 'iconoir-share-android',
    'share': 'iconoir-share-android',
    'repeat-2': 'iconoir-repeat',
    'repeat': 'iconoir-repeat',
    'message-circle': 'iconoir-chat-bubble',
    'message-square': 'iconoir-chat-bubble-empty',
    'send': 'iconoir-send',
    'inbox': 'iconoir-inbox',
    'thumbs-up': 'iconoir-thumbs-up',
    'thumbs-down': 'iconoir-thumbs-down',
    'flag': 'iconoir-flag',
    'hand-heart': 'iconoir-heart',
    'camera': 'iconoir-camera',
    'switch-camera': 'iconoir-rotate-camera-right',
    'image': 'iconoir-media-image',
    'image-plus': 'iconoir-media-image-plus',
    'mic': 'iconoir-microphone',
    'play': 'iconoir-play',
    'music-2': 'iconoir-music-double-note',
    'clapperboard': 'iconoir-media-video',
    'video': 'iconoir-media-video',
    'layout-grid': 'iconoir-view-grid',
    'layout-dashboard': 'iconoir-view-columns-2',
    'chart-no-axes-gantt': 'iconoir-menu',
    'calendar-days': 'iconoir-calendar',
    'calendar': 'iconoir-calendar',
    'clock': 'iconoir-clock',
    'map-pin': 'iconoir-pin',
    'pin': 'iconoir-pin',
    'church': 'iconoir-church-side',
    'lock': 'iconoir-lock',
    'globe': 'iconoir-globe',
    'shield': 'iconoir-shield',
    'sun': 'iconoir-sun-light',
    'circle-help': 'iconoir-help-circle',
    'info': 'iconoir-info-circle',
    'log-out': 'iconoir-log-out',
    'pencil': 'iconoir-edit-pencil',
    'trash-2': 'iconoir-trash',
    'mail-check': 'iconoir-mail-opened',
    'ban': 'iconoir-prohibition',
    'eye': 'iconoir-eye',
    'eye-off': 'iconoir-eye-closed',
    'sparkles': 'iconoir-sparks',
    'hash': 'iconoir-hashtag',
    'hashtag': 'iconoir-hashtag',
    'at-sign': 'iconoir-at-sign'
  };
  return map[name] || (name && name.startsWith('iconoir-') ? name : 'iconoir-' + (name || 'dot'));
}
// ============================================================
    //  SUPABASE CLIENT & REAL DATA
    // ============================================================
    const SUPABASE_PROJECT_ID = "gzxbppwlfxtbybzxlocw";
    const SUPABASE_URL = "https://gzxbppwlfxtbybzxlocw.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_4XPZaxufxC9NnJ3CYMrmcw_K7Jff-9g";

    // Initialize Supabase Client
    window.supabaseClient = (typeof window.supabase !== "undefined" && window.supabase.createClient)
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          realtime: { params: { eventsPerSecond: 10 } },
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        })
      : null;
    const supabaseClient = window.supabaseClient;

    // Realtime channels
    let realtimeChannels = {
      posts: null,
      comments: null,
      reels: null,
      reelComments: null,
      events: null,
      chats: null,
      messages: null,
      notifications: null,
      profiles: null,
      follows: null,
      postLikes: null,
      postReposts: null,
      savedPosts: null
    };

    // Realtime subscription state
    let realtimeConnected = false;

    // Supabase reactive data storage (no local storage)
    let profiles = [];
    let posts = [];
    function savePostsLocal() {}

    // ============================================================
    //  INDEXEDDB OFFLINE QUEUE
    // ============================================================
    const OFFLINE_DB_NAME = 'nazaretha_offline';
    const OFFLINE_DB_VERSION = 1;
    let offlineDB = null;

    async function initOfflineDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          offlineDB = request.result;
          resolve(offlineDB);
        };
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('outbox')) {
            const store = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
          if (!db.objectStoreNames.contains('pending_media')) {
            db.createObjectStore('pending_media', { keyPath: 'id', autoIncrement: true });
          }
        };
      });
    }

    async function queueOfflineAction(type, payload) {
      if (!offlineDB) await initOfflineDB();
      return new Promise((resolve, reject) => {
        const tx = offlineDB.transaction('outbox', 'readwrite');
        const store = tx.objectStore('outbox');
        const request = store.add({
          type,
          payload,
          status: 'pending',
          createdAt: Date.now(),
          retries: 0
        });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async function getOfflineQueue() {
      if (!offlineDB) await initOfflineDB();
      return new Promise((resolve, reject) => {
        const tx = offlineDB.transaction('outbox', 'readonly');
        const store = tx.objectStore('outbox');
        const index = store.index('status');
        const request = index.getAll('pending');
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    }

    async function updateOfflineItem(id, updates) {
      if (!offlineDB) await initOfflineDB();
      return new Promise((resolve, reject) => {
        const tx = offlineDB.transaction('outbox', 'readwrite');
        const store = tx.objectStore('outbox');
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const item = getReq.result;
          if (!item) return resolve(null);
          Object.assign(item, updates);
          const putReq = store.put(item);
          putReq.onsuccess = () => resolve(item);
          putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
      });
    }

    async function removeOfflineItem(id) {
      if (!offlineDB) await initOfflineDB();
      return new Promise((resolve, reject) => {
        const tx = offlineDB.transaction('outbox', 'readwrite');
        const store = tx.objectStore('outbox');
        const request = store.delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    }

    async function processOfflineQueue() {
      if (!navigator.onLine) return;
      if (!supabaseClient) return;
      
      const queue = await getOfflineQueue();
      for (const item of queue) {
        if (item.status !== 'pending') continue;
        
        try {
          await updateOfflineItem(item.id, { status: 'processing' });
          
          let success = false;
          switch (item.type) {
            case 'create_post':
              success = await syncCreatePost(item.payload);
              break;
            case 'create_comment':
              success = await syncCreateComment(item.payload);
              break;
            case 'like_post':
              success = await syncLikePost(item.payload);
              break;
            case 'create_event':
              success = await syncCreateEvent(item.payload);
              break;
            case 'rsvp_event':
              success = await syncRsvpEvent(item.payload);
              break;
            case 'send_message':
              success = await syncSendMessage(item.payload);
              break;
            case 'follow_user':
              success = await syncFollowUser(item.payload);
              break;
            case 'save_post':
              success = await syncSavePost(item.payload);
              break;
          }
          
          if (success) {
            await removeOfflineItem(item.id);
          } else {
            const retries = (item.retries || 0) + 1;
            if (retries >= 5) {
              await updateOfflineItem(item.id, { status: 'failed', retries });
            } else {
              await updateOfflineItem(item.id, { status: 'pending', retries });
            }
          }
        } catch (err) {
          console.warn('Offline sync error:', err);
          const retries = (item.retries || 0) + 1;
          await updateOfflineItem(item.id, { status: 'pending', retries });
        }
      }
    }

    // Sync functions for each action type
    async function syncCreatePost(payload) {
      try {
        const { data, error } = await supabaseClient.from('posts').insert([payload]).select('id');
        if (error) throw error;
        // Update local post with server ID
        const localPost = posts.find(p => p.id === payload.tempId);
        if (localPost && data && data[0]) {
          localPost.id = data[0].id;
          savePostsLocal();
        }
        return true;
      } catch (err) {
        console.warn('Sync create post failed:', err);
        return false;
      }
    }

    async function syncCreateComment(payload) {
      try {
        const { data, error } = await supabaseClient.from('comments').insert([payload]).select('id');
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('Sync create comment failed:', err);
        return false;
      }
    }

    async function syncLikePost(payload) {
      try {
        const { error } = await supabaseClient.from('posts').update({ likes: payload.newLikes }).eq('id', payload.postId);
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('Sync like post failed:', err);
        return false;
      }
    }

    async function syncCreateEvent(payload) {
      try {
        const { data, error } = await supabaseClient.from('events').insert([payload]).select('id');
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('Sync create event failed:', err);
        return false;
      }
    }

    async function syncRsvpEvent(payload) {
      try {
        const { error } = await supabaseClient.from('event_attendees').upsert([payload]);
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('Sync RSVP event failed:', err);
        return false;
      }
    }

    async function syncSendMessage(payload) {
      try {
        const { data, error } = await supabaseClient.from('messages').insert([payload]).select('id');
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('Sync send message failed:', err);
        return false;
      }
    }

    async function syncFollowUser(payload) {
      try {
        const { error } = await supabaseClient.from('follows').upsert([payload]);
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('Sync follow user failed:', err);
        return false;
      }
    }

    async function syncSavePost(payload) {
      try {
        const { error } = await supabaseClient.from('saved_posts').upsert([payload]);
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('Sync save post failed:', err);
        return false;
      }
    }

    // Listen for online/offline events
    window.addEventListener('online', () => {
      showToast('Back online — syncing...');
      processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      showToast('You are offline — changes will sync when connected');
    });

    // Periodic sync attempt
    setInterval(() => {
      if (navigator.onLine) processOfflineQueue();
    }, 30000);

let reels = [];
    let eventsData = [];
    // Notifications state loaded directly from Supabase (no local storage)
    let notifications = [];
    function saveNotificationsLocal() {}

    function addNotification(n, syncRemote = true) {
      const notif = {
        id: n.id || ('notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
        icon: n.icon || 'bell',
        title: n.title || 'Notification',
        text: n.text || '',
        time: n.time || 'Just now',
        unread: n.unread !== false,
        data: n.data || null
      };

      notifications.unshift(notif);
      saveNotificationsLocal();
      updateBadge();
      if (currentPage === 'notifications' || window.location.pathname.endsWith('notifications.html')) {
        renderNotifications();
      }

      showToast(`${notif.title}: ${notif.text}`);

      if (syncRemote && supabaseClient && n.targetUserId) {
        supabaseClient.from('notifications').insert([{
          user_id: n.targetUserId,
          type: n.type || 'interaction',
          title: notif.title,
          text: notif.text,
          data: notif.data,
          read: false,
          created_at: new Date().toISOString()
        }]).then(({ error }) => {
          if (error) console.warn('Notification remote sync notice:', error.message);
        });
      }
    }
    // Chats loaded directly from Supabase (no local storage)
    let supabaseChats = [];
    function saveChatsLocal() {}

    let activeChatMessages = {};
    let supabaseMessageRequests = [];
    let postComments = {};
    let reelComments = {};

    // ============================================================
    //  REAL SUPABASE AUTH STATE
    // ============================================================
    let authUser = null;

    function readLocalUser() {
      const me = profiles.find(p => p.me || (authUser && p.user_id === authUser.id));
      if (me) return me;
      if (authUser) {
        const meta = authUser.user_metadata || {};
        return {
          email: authUser.email,
          name: meta.full_name || `${meta.first || ''} ${meta.surname || ''}`.trim() || 'Member',
          first: meta.first || '',
          surname: meta.surname || '',
          temple: meta.temple || 'eBuhleni',
          avatar: ''
        };
      }
      return null;
    }

    async function hydrateSession() {
      if (!supabaseClient) return null;
      try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error || !data || !data.session) return null;
        authUser = data.session.user;
        return data.session;
      } catch (e) {
        console.warn('Supabase session notice:', e && e.message);
        return null;
      }
    }

    function currentActor() {
      const me = ensureMeProfile();
      const meta = (authUser && authUser.user_metadata) || {};
      const local = readLocalUser() || {};
      const first = (me && me.first && me.first !== 'Member') || local.first || meta.first || '';
      const surname = (me && me.surname) || local.surname || meta.surname || '';
      let name = (me && me.name && me.name !== 'Member') ? me.name : '';
      if (!name) name = (first || surname ? `${first} ${surname}`.trim() : '') || local.name || meta.full_name || 'amaNazaretha Member';
      const initials = ((first[0] || name[0] || 'A') + (surname[0] || (name.split(' ')[1] ? name.split(' ')[1][0] : ''))).toUpperCase();
      return { name: name, initials: initials, avatar: (me && (me.avatarImage || me.avatar)) || local.avatar || '' };
    }

    function timeAgo(iso) {
      if (!iso) return 'Just now';
      const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
      if (s < 60) return 'Just now';
      if (s < 3600) return Math.floor(s / 60) + 'm';
      if (s < 86400) return Math.floor(s / 3600) + 'h';
      if (s < 604800) return Math.floor(s / 86400) + 'd';
      return new Date(iso).toLocaleDateString();
    }

    function adoptProfile(p, fallbackEmail) {
      const name = (p.name || '').trim() || [p.first, p.surname].filter(Boolean).join(' ');
      const first = p.first || (name ? name.split(' ')[0] : '');
      const surname = p.surname || (name ? name.split(' ').slice(1).join(' ') : '');
      profiles.forEach(x => { x.me = false; });
      let me = profiles.find(x => (authUser && x.user_id === authUser.id) || (x.email && p.email && String(x.email).toLowerCase() === String(p.email).toLowerCase()) || x.me);
      if (!me) {
        me = { me: true };
        profiles.unshift(me);
      }
      Object.assign(me, p, {
        me: true,
        name: name || 'Member',
        first: first,
        surname: surname,
        user_id: p.user_id || (authUser && authUser.id),
        email: p.email || fallbackEmail || (authUser && authUser.email) || ''
      });
      return me;
    }

    async function loadMyProfile(user) {
      if (!supabaseClient || !user) return null;
      let row = null;
      try {
        if (user.id) {
          const byId = await supabaseClient.from('profiles').select('*').eq('user_id', user.id).limit(1);
          if (!byId.error && byId.data && byId.data[0]) row = byId.data[0];
        }
        if (!row && user.email) {
          const byEmail = await supabaseClient.from('profiles').select('*').ilike('email', user.email).limit(1);
          if (!byEmail.error && byEmail.data && byEmail.data[0]) row = byEmail.data[0];
        }
        if (row) return adoptProfile(row, user.email);
      } catch(e) {
        console.warn('loadMyProfile notice:', e);
      }
      return null;
    }

    async function loadChatsFromSupabase() {
      if (!supabaseClient || !authUser) {
        supabaseChats = [];
        if (currentPage === 'messages' || window.location.pathname.endsWith('messages.html')) {
          const cs = document.getElementById('chatSearch');
          renderChats(cs ? cs.value : '');
        }
        return;
      }
      try {
        const { data: participants, error: pErr } = await supabaseClient
          .from('chat_participants')
          .select('chat_id')
          .eq('user_id', authUser.id);
        
        if (!pErr && participants && participants.length) {
          const chatIds = participants.map(p => p.chat_id);
          const { data: dbChats, error: cErr } = await supabaseClient
            .from('chats')
            .select('*')
            .in('id', chatIds)
            .order('updated_at', { ascending: false });

          if (!cErr && dbChats) {
            supabaseChats = dbChats.map(ch => ({
              id: ch.id,
              name: ch.name || 'Conversation',
              initials: (ch.name || 'C')[0],
              color: 'linear-gradient(135deg, #d4af37, #a07d1c)',
              online: false,
              time: timeAgo(ch.updated_at),
              preview: ch.last_message || 'New conversation',
              unread: 0,
              messages: []
            }));
          }
        } else {
          supabaseChats = [];
        }
      } catch (err) {
        console.warn('Supabase load chats notice:', err);
      }

      if (currentPage === 'messages' || window.location.pathname.endsWith('messages.html')) {
        const cs = document.getElementById('chatSearch');
        renderChats(cs ? cs.value : '');
      }
    }

    async function loadSupabaseData() {
      if (!supabaseClient) {
        await loadChatsFromSupabase();
        return;
      }
      try {
        // 1. Posts
        const { data: dbPosts, error: postErr } = await supabaseClient
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false });
        if (!postErr && dbPosts && dbPosts.length) {
          posts = dbPosts.map(p => ({
            id: p.id,
            icon: p.icon || 'sun',
            title: p.title || '',
            text: p.text || p.content || '',
            tags: p.tags || '',
            temple: p.temple || 'eBuhleni',
            time: p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Just now',
            likes: p.likes || 0,
            comments: p.comments || 0,
            reposts: p.reposts || 0,
            image: p.image || undefined,
            video: p.video || undefined,
            userId: p.user_id || null,
            author: p.author_name || '',
            authorInitials: p.author_initials || '',
            authorAvatar: p.author_avatar || '',
            isMe: (authUser && p.user_id && p.user_id === authUser.id)
          }));
          renderFeed();
          savePostsLocal();
        }

        // 2. Events
        const { data: dbEvents, error: evErr } = await supabaseClient
          .from('events')
          .select('*')
          .order('created_at', { ascending: false });
        if (!evErr && dbEvents && dbEvents.length) {
          eventsData = dbEvents.map(e => ({
            id: String(e.id),
            day: e.day || '01',
            month: e.month || 'JAN',
            title: e.title || '',
            type: e.type || 'Service',
            dateLabel: e.date_label || '',
            time: e.time || '',
            venue: e.venue || '',
            temple: e.temple || '',
            host: e.host || '',
            attending: e.attending || 0,
            reminded: false,
            description: e.description || '',
            cover: e.cover || ''
          }));
          renderEvents();
        }

        // 3. Reels
        const { data: dbReels, error: rErr } = await supabaseClient
          .from('reels')
          .select('*')
          .order('created_at', { ascending: false });
        if (!rErr && dbReels && dbReels.length) {
          reels = dbReels.map(r => ({
            id: String(r.id),
            username: r.username || '',
            initials: r.initials || 'AN',
            avatarColor: r.avatar_color || '#0c0c0c',
            verified: !!r.verified,
            following: false,
            location: r.location || '',
            description: r.description || '',
            tags: r.tags || '',
            music: r.music || '',
            likes: r.likes || 0,
            comments: r.comments || 0,
            reposts: r.reposts || 0,
            video: r.video || ''
          }));
          renderReels();
        }

        // 4. Profiles
        const { data: dbProfiles, error: prErr } = await supabaseClient.from('profiles').select('*');
        if (!prErr && dbProfiles && dbProfiles.length) {
          profiles = dbProfiles.map(p => ({
            ...p,
            name: p.name || [p.first, p.surname].filter(Boolean).join(' ') || 'Member',
            initials: p.initials || (((p.first || 'M')[0] || 'M') + (p.surname || '')).toUpperCase(),
            avatarColor: p.avatarColor || '#0c0c0c',
            bio: p.bio || 'Walking the Shembe path with amaNazaretha.',
            type: p.type || 'Member',
            temple: p.temple || 'eBuhleni',
            followers: p.followers || 0,
            followingCount: p.followingCount || 0,
            following: false,
            me: (authUser && p.user_id && p.user_id === authUser.id)
          }));
          ensureMeProfile();
          renderMyProfile();
        }

        // 4b. Sync follow status and event attendance directly from Supabase
        if (authUser) {
          const { data: dbFollows } = await supabaseClient
            .from('follows')
            .select('following_id')
            .eq('follower_id', authUser.id);
          if (dbFollows) {
            const followIds = new Set(dbFollows.map(f => f.following_id));
            profiles.forEach(p => { p.following = followIds.has(p.user_id); });
            reels.forEach(r => {
              const p = profiles.find(pr => pr.name === r.username);
              if (p) r.following = p.following;
            });
          }

          const { data: dbAttendees } = await supabaseClient
            .from('event_attendees')
            .select('event_id')
            .eq('user_id', authUser.id);
          if (dbAttendees) {
            const attendIds = new Set(dbAttendees.map(a => String(a.event_id)));
            eventsData.forEach(e => { e.reminded = attendIds.has(String(e.id)); });
          }
        }

        // 5. Comments
        const { data: dbComments, error: cErr } = await supabaseClient
          .from('comments')
          .select('*')
          .order('created_at', { ascending: false });
        if (!cErr && dbComments) {
          const grouped = {};
          dbComments.forEach(c => {
            if (!grouped[c.post_id]) grouped[c.post_id] = [];
            grouped[c.post_id].push({
              id: c.id,
              user: c.user_name || 'Member',
              initials: c.user_initials || 'M',
              time: timeAgo(c.created_at),
              text: c.text,
              likes: c.likes || 0,
              liked: false
            });
          });
          postComments = grouped;
          if (typeof currentPostId !== 'undefined' && currentPostId !== null) renderComments(currentPostId);
        }

        // 6. Notifications for current user from Supabase
        if (authUser) {
          const { data: dbNotifs, error: notifErr } = await supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false });
          if (!notifErr && dbNotifs && dbNotifs.length) {
            notifications = dbNotifs.map(n => ({
              id: n.id,
              icon: n.icon || (n.type === 'message' ? 'message-circle' : n.type === 'follow' ? 'user-plus' : n.type === 'like' ? 'heart' : 'bell'),
              type: n.type || 'interaction',
              title: n.title,
              text: n.text,
              time: timeAgo(n.created_at),
              unread: !n.read,
              data: n.data
            }));
            saveNotificationsLocal();
            updateBadge();
            renderNotifications();
          }
        }

        // 7. Chats
        await loadChatsFromSupabase();

      } catch (err) {
        console.warn('Supabase load notice:', err);
        await loadChatsFromSupabase();
      }
    }

    function handleFollowAction(p, isFollowing) {
      if (!p) return;
      const actor = currentActor();

      if (isFollowing) {
        addNotification({
          icon: 'user-plus',
          type: 'follow',
          title: `You followed ${p.name}`,
          text: `You will now receive updates from ${p.temple || 'eBuhleni'} Temple.`,
          time: 'Just now',
          unread: false,
          data: { follower_name: p.name }
        }, false);

        if (supabaseClient && authUser && p.user_id) {
          supabaseClient.from('follows').upsert([{
            follower_id: authUser.id,
            following_id: p.user_id,
            created_at: new Date().toISOString()
          }]).then(({ error }) => {
            if (error) console.warn('Follow sync notice:', error.message);
          });

          supabaseClient.from('notifications').insert([{
            user_id: p.user_id,
            type: 'follow',
            actor_id: authUser.id,
            actor_name: actor.name,
            actor_initials: actor.initials,
            entity_type: 'profile',
            entity_id: String(p.user_id),
            title: 'New follower',
            text: `${actor.name} started following you`,
            read: false,
            created_at: new Date().toISOString()
          }]).then();
        }

        // Reciprocal follow simulation
        setTimeout(() => {
          addNotification({
            icon: 'user-plus',
            type: 'follow',
            title: `${p.name} followed you back`,
            text: 'Connected with you on amaNazaretha',
            time: 'Just now',
            unread: true,
            data: { follower_name: p.name }
          }, false);
        }, 2500);

      } else {
        if (supabaseClient && authUser && p.user_id) {
          supabaseClient.from('follows')
            .delete()
            .eq('follower_id', authUser.id)
            .eq('following_id', p.user_id)
            .then();
        }
      }
    }


    // ============================================================
    //  REALTIME SUBSCRIPTIONS
    // ============================================================
    function subscribeToRealtime() {
      if (!supabaseClient || realtimeConnected) return;
      
      // Posts channel
      realtimeChannels.posts = supabaseClient
        .channel('posts_changes', { config: { broadcast: { ack: true } } })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => {
          handlePostRealtime(payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') console.log('Realtime: posts subscribed');
          else if (status === 'CHANNEL_ERROR') console.warn('Realtime: posts error');
        });

      // Comments channel
      realtimeChannels.comments = supabaseClient
        .channel('comments_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
          handleCommentRealtime(payload);
        })
        .subscribe();

      // Reels channel
      realtimeChannels.reels = supabaseClient
        .channel('reels_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reels' }, (payload) => {
          handleReelRealtime(payload);
        })
        .subscribe();

      // Reel comments channel
      realtimeChannels.reelComments = supabaseClient
        .channel('reel_comments_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reel_comments' }, (payload) => {
          handleReelCommentRealtime(payload);
        })
        .subscribe();

      // Events channel
      realtimeChannels.events = supabaseClient
        .channel('events_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
          handleEventRealtime(payload);
        })
        .subscribe();

      // Saved posts channel
      if (authUser) {
        realtimeChannels.savedPosts = supabaseClient
          .channel('saved_posts_changes')
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'saved_posts',
            filter: `user_id=eq.${authUser.id}`
          }, (payload) => {
            handleSavedPostRealtime(payload);
          })
          .subscribe();
      }

      // Chats channel
      realtimeChannels.chats = supabaseClient
        .channel('chats_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (payload) => {
          handleChatRealtime(payload);
        })
        .subscribe();

      // Messages channel
      realtimeChannels.messages = supabaseClient
        .channel('messages_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
          handleMessageRealtime(payload);
        })
        .subscribe();

      // Notifications channel (filtered to current user)
      if (authUser) {
        realtimeChannels.notifications = supabaseClient
          .channel('notifications_changes')
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'notifications',
            filter: `user_id=eq.${authUser.id}`
          }, (payload) => {
            handleNotificationRealtime(payload);
          })
          .subscribe();
      }

      // Profiles channel
      realtimeChannels.profiles = supabaseClient
        .channel('profiles_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
          handleProfileRealtime(payload);
        })
        .subscribe();

      // Follows channel
      realtimeChannels.follows = supabaseClient
        .channel('follows_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, (payload) => {
          handleFollowRealtime(payload);
        })
        .subscribe();

      // Post likes channel
      realtimeChannels.postLikes = supabaseClient
        .channel('post_likes_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, (payload) => {
          handlePostLikeRealtime(payload);
        })
        .subscribe();

      // Post reposts channel
      realtimeChannels.postReposts = supabaseClient
        .channel('post_reposts_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reposts' }, (payload) => {
          handlePostRepostRealtime(payload);
        })
        .subscribe();

      realtimeConnected = true;
    }

    function unsubscribeFromRealtime() {
      Object.values(realtimeChannels).forEach(channel => {
        if (channel) {
          supabaseClient.removeChannel(channel);
        }
      });
      realtimeChannels = {
        posts: null, comments: null, reels: null, reelComments: null,
        events: null, chats: null, messages: null, notifications: null,
        profiles: null, follows: null, postLikes: null, postReposts: null,
        savedPosts: null
      };
      realtimeConnected = false;
    }

    // Realtime handlers
    function handlePostRealtime(payload) {
      const eventType = payload.eventType;
      const newRecord = payload.new;
      const oldRecord = payload.old;
      
      if (eventType === 'INSERT' && newRecord) {
        const post = {
          id: newRecord.id,
          title: newRecord.title || '',
          text: newRecord.text || newRecord.content || '',
          tags: newRecord.tags || '',
          temple: newRecord.temple || 'eBuhleni',
          time: newRecord.created_at ? new Date(newRecord.created_at).toLocaleDateString() : 'Just now',
          likes: newRecord.likes || 0,
          comments: newRecord.comments || 0,
          reposts: newRecord.reposts || 0,
          image: newRecord.image || undefined,
          video: newRecord.video || undefined,
          userId: newRecord.user_id || null,
          author: newRecord.author_name || '',
          authorInitials: newRecord.author_initials || '',
          authorAvatar: newRecord.author_avatar || '',
          isMe: (authUser && newRecord.user_id && newRecord.user_id === authUser.id)
        };
        // Avoid duplicates
        if (!posts.find(p => p.id === post.id)) {
          posts.unshift(post);
          renderFeed();
          savePostsLocal();
        }
      } else if (eventType === 'UPDATE' && newRecord) {
        const idx = posts.findIndex(p => p.id === newRecord.id);
        if (idx >= 0) {
          posts[idx] = { ...posts[idx], 
            likes: newRecord.likes || posts[idx].likes,
            comments: newRecord.comments || posts[idx].comments,
            reposts: newRecord.reposts || posts[idx].reposts,
            text: newRecord.text || posts[idx].text,
            tags: newRecord.tags || posts[idx].tags,
            image: newRecord.image || posts[idx].image,
            video: newRecord.video || posts[idx].video
          };
          renderFeed();
          savePostsLocal();
          syncPostCards(newRecord.id);
        }
      } else if (eventType === 'DELETE' && oldRecord) {
        posts = posts.filter(p => p.id !== oldRecord.id);
        renderFeed();
        renderMyProfile();
        savePostsLocal();
      }
    }

    function handleCommentRealtime(payload) {
      const eventType = payload.eventType;
      const newRecord = payload.new;
      
      if (eventType === 'INSERT' && newRecord) {
        const postId = newRecord.post_id;
        if (!postComments[postId]) postComments[postId] = [];
        const comment = {
          id: newRecord.id,
          user_id: newRecord.user_id,
          user: newRecord.user_name || 'Member',
          initials: newRecord.user_initials || 'M',
          avatar: newRecord.user_avatar || newRecord.avatar || '',
          time: timeAgo(newRecord.created_at),
          text: newRecord.text,
          likes: newRecord.likes || 0,
          liked: false
        };
        postComments[postId].unshift(comment);
        const post = posts.find(p => p.id === postId);
        if (post) {
          post.comments = (post.comments || 0) + 1;
          savePostsLocal();
          renderFeed();
        }
        if (currentPostId === postId) renderComments(postId);
      }
    }

    function handleReelRealtime(payload) {
      const eventType = payload.eventType;
      const newRecord = payload.new;
      const oldRecord = payload.old;
      
      if (eventType === 'INSERT' && newRecord) {
        const reel = {
          id: String(newRecord.id),
          username: newRecord.username || '',
          initials: newRecord.initials || 'AN',
          avatarColor: newRecord.avatar_color || '#0c0c0c',
          verified: !!newRecord.verified,
          following: false,
          location: newRecord.location || '',
          description: newRecord.description || '',
          tags: newRecord.tags || '',
          music: newRecord.music || '',
          likes: newRecord.likes || 0,
          comments: newRecord.comments || 0,
          reposts: newRecord.reposts || 0,
          video: newRecord.video || ''
        };
        if (!reels.find(r => r.id === reel.id)) {
          reels.unshift(reel);
          if (document.body.classList.contains('reels-active')) renderReels();
        }
      } else if (eventType === 'UPDATE' && newRecord) {
        const idx = reels.findIndex(r => r.id === String(newRecord.id));
        if (idx >= 0) {
          reels[idx] = { ...reels[idx],
            likes: newRecord.likes || reels[idx].likes,
            comments: newRecord.comments || reels[idx].comments,
            reposts: newRecord.reposts || reels[idx].reposts,
            description: newRecord.description || reels[idx].description,
            tags: newRecord.tags || reels[idx].tags
          };
          if (document.body.classList.contains('reels-active')) renderReels();
        }
      } else if (eventType === 'DELETE' && oldRecord) {
        reels = reels.filter(r => r.id !== String(oldRecord.id));
        if (document.body.classList.contains('reels-active')) renderReels();
      }
    }

    function handleReelCommentRealtime(payload) {
      const eventType = payload.eventType;
      const newRecord = payload.new;
      
      if (eventType === 'INSERT' && newRecord) {
        const reelId = String(newRecord.reel_id);
        if (!reelComments[reelId]) reelComments[reelId] = [];
        reelComments[reelId].unshift({
          id: newRecord.id,
          user_id: newRecord.user_id,
          user: newRecord.user_name || 'Member',
          initials: newRecord.user_initials || 'M',
          avatar: newRecord.user_avatar || newRecord.avatar || '',
          time: timeAgo(newRecord.created_at),
          text: newRecord.text,
          likes: newRecord.likes || 0,
          liked: false
        });
        const reel = reels.find(r => r.id === reelId);
        if (reel) {
          reel.comments = (reel.comments || 0) + 1;
          if (document.body.classList.contains('reels-active')) renderReels();
        }
        if (currentReelId === reelId) renderComments(reelId);
      }
    }

    function handleEventRealtime(payload) {
      const eventType = payload.eventType;
      const newRecord = payload.new;
      const oldRecord = payload.old;
      
      if (eventType === 'INSERT' && newRecord) {
        const event = {
          id: String(newRecord.id),
          day: newRecord.day || '01',
          month: newRecord.month || 'JAN',
          title: newRecord.title || '',
          type: newRecord.type || 'Service',
          dateLabel: newRecord.date_label || '',
          time: newRecord.time || '',
          venue: newRecord.venue || '',
          temple: newRecord.temple || '',
          host: newRecord.host || '',
          attending: newRecord.attending || 0,
          reminded: false,
          description: newRecord.description || '',
          cover: newRecord.cover || ''
        };
        if (!eventsData.find(e => e.id === event.id)) {
          eventsData.unshift(event);
          if (currentPage === 'events') renderEvents();
        }
      } else if (eventType === 'UPDATE' && newRecord) {
        const idx = eventsData.findIndex(e => e.id === String(newRecord.id));
        if (idx >= 0) {
          eventsData[idx] = { ...eventsData[idx],
            attending: newRecord.attending || eventsData[idx].attending,
            title: newRecord.title || eventsData[idx].title,
            description: newRecord.description || eventsData[idx].description
          };
          if (currentPage === 'events') renderEvents();
          if (activeEventId === String(newRecord.id)) syncEventRemind();
        }
      } else if (eventType === 'DELETE' && oldRecord) {
        eventsData = eventsData.filter(e => e.id !== String(oldRecord.id));
        if (currentPage === 'events') renderEvents();
      }
    }

    function handleChatRealtime(payload) {
      // Chat metadata changes - refresh chat list
      if (currentPage === 'messages') {
        renderChats(document.getElementById('chatSearch').value);
      }
    }

    function handleMessageRealtime(payload) {
      const eventType = payload.eventType;
      const newRecord = payload.new;
      
      if (eventType === 'INSERT' && newRecord) {
        const chatId = newRecord.chat_id;
        const chat = supabaseChats.find(c => c.id === chatId);
        if (!chat) return;
        
        const isMe = authUser && newRecord.user_id === authUser.id;
        const senderName = isMe ? 'You' : (newRecord.user_name || 'Someone');
        
        if (activeChatId === chatId) {
          // We're in this chat - add message
          chat.messages.push({
            from: isMe ? 'me' : 'them',
            text: newRecord.content,
            media: newRecord.media_type ? { type: newRecord.media_type, src: newRecord.media_url } : null,
            voice: newRecord.voice_duration ? { duration: newRecord.voice_duration } : null,
            time: timeAgo(newRecord.created_at),
            read: isMe
          });
          renderThread(chat);
          const box = document.getElementById('threadMessages');
          box.scrollTop = box.scrollHeight;
        } else {
          chat.unread = (chat.unread || 0) + 1;
          chat.preview = newRecord.content ? newRecord.content.substring(0, 50) : 
                         newRecord.media_type ? (newRecord.media_type === 'voice' ? 'Voice note' : 'Media') : 'New message';
          chat.time = timeAgo(newRecord.created_at);
          if (currentPage === 'messages') {
            const cs = document.getElementById('chatSearch');
            renderChats(cs ? cs.value : '');
          }
        }
        
        // Notify user of incoming message if not from self
        if (!isMe) {
          addNotification({
            icon: 'message-circle',
            type: 'message',
            title: `Message from ${senderName}`,
            text: newRecord.content || (newRecord.media_type === 'voice' ? 'Sent a voice note' : 'Sent an attachment'),
            time: 'Just now',
            unread: true,
            data: { chat_id: chatId }
          }, false);
        }
      }
    }

    function handleNotificationRealtime(payload) {
      const eventType = payload.eventType;
      const newRecord = payload.new;
      if (eventType === 'INSERT' && newRecord) {
        addNotification({
          id: newRecord.id,
          icon: newRecord.icon || (newRecord.type === 'message' ? 'message-circle' : newRecord.type === 'follow' ? 'user-plus' : newRecord.type === 'like' ? 'heart' : 'bell'),
          type: newRecord.type || 'interaction',
          title: newRecord.title || 'New notification',
          text: newRecord.text || '',
          time: timeAgo(newRecord.created_at),
          unread: !newRecord.read,
          data: newRecord.data || { entity_id: newRecord.entity_id }
        }, false);
      }
    }

    function handleFollowRealtime(payload) {
      const eventType = payload.eventType;
      const newRecord = payload.new;
      if (eventType === 'INSERT' && newRecord) {
        if (authUser && newRecord.following_id === authUser.id) {
          const followerName = newRecord.actor_name || newRecord.follower_name || 'A church member';
          addNotification({
            icon: 'user-plus',
            type: 'follow',
            title: `${followerName} started following you`,
            text: 'Followed your profile in amaNazaretha',
            time: 'Just now',
            unread: true,
            data: { follower_id: newRecord.follower_id, follower_name: followerName }
          }, false);
          const me = profiles.find(p => p.me);
          if (me) {
            me.followers = (me.followers || 0) + 1;
            renderProfileStats(me);
          }
        }
      }
    }

    function handleSavedPostRealtime(payload) {
      const eventType = payload.eventType;
      if (eventType === 'INSERT' && payload.new) {
        savedPostIds.add(Number(payload.new.post_id));
        saveEngagementState();
        syncPostCards(payload.new.post_id);
      } else if (eventType === 'DELETE' && payload.old) {
        savedPostIds.delete(Number(payload.old.post_id));
        saveEngagementState();
        syncPostCards(payload.old.post_id);
      }
    }

    function handleProfileRealtime(payload) {
      const newRecord = payload.new;
      if (newRecord) {
        const idx = profiles.findIndex(p => p.user_id === newRecord.user_id || p.id === newRecord.id);
        if (idx >= 0) {
          profiles[idx] = { ...profiles[idx], ...newRecord };
          if (profiles[idx].me) renderMyProfile();
        }
      }
    }

    function handlePostLikeRealtime(payload) {
      // Sync like counts if needed
    }

    function handlePostRepostRealtime(payload) {
      // Sync repost counts if needed
    }

    function clearAllNotifications() {
      notifications = [];
      saveNotificationsLocal();
      updateBadge();
      renderNotifications();
      showToast('All notifications cleared');
    }


    async function loadMessageRequests() {
      if (!supabaseClient || !authUser) return;
      try {
        // Get message requests - chats created by others but user not a participant yet
        const { data: requests, error } = await supabaseClient
          .from('messages')
          .select('chat_id, user_id, content, created_at')
          .neq('user_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (error) throw error;
        
        // Group by chat and get sender profile
        const requestMap = new Map();
        for (const msg of requests) {
          if (!requestMap.has(msg.chat_id)) {
            const { data: profile } = await supabaseClient
              .from('profiles')
              .select('name, initials, avatar_image, cover_image, avatar_color')
              .eq('user_id', msg.user_id)
              .single();
            
            if (profile) {
              requestMap.set(msg.chat_id, {
                id: msg.chat_id,
                name: profile.name || 'Unknown',
                initials: profile.initials || 'UN',
                avatarImage: profile.avatar_image || profile.cover_image,
                avatarColor: profile.avatar_color || '#0c0c0c',
                color: profile.avatar_color || '#0c0c0c',
                preview: msg.content || 'Message request',
                time: timeAgo(msg.created_at),
                messages: []
              });
            }
          }
        }
        
        supabaseMessageRequests = Array.from(requestMap.values());
      } catch (err) {
        console.warn('Load message requests error:', err);
      }
    }

    async function loadMessagesForChat(chatId) {
      if (!supabaseClient) return [];
      try {
        const { data: messages, error } = await supabaseClient
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true })
          .limit(100);
        
        if (error) throw error;
        
        return messages.map(m => ({
          id: m.id,
          from: (authUser && m.user_id === authUser.id) ? 'me' : 'them',
          text: m.content,
          media: m.media_type ? { type: m.media_type, src: m.media_url } : null,
          voice: m.voice_duration ? { duration: m.voice_duration } : null,
          time: timeAgo(m.created_at),
          read: m.read,
          reactions: m.reactions || []
        }));
      } catch (err) {
        console.warn('Load messages error:', err);
        return [];
      }
    }

    async function sendMessageToSupabase(chatId, content, media = null, voiceDuration = null) {
      if (!supabaseClient || !authUser) return false;
      try {
        const { error } = await supabaseClient
          .from('messages')
          .insert([{
            chat_id: chatId,
            user_id: authUser.id,
            content: content || null,
            media_type: media?.type || null,
            media_url: media?.url || null,
            voice_duration: voiceDuration || null,
            read: false,
            created_at: new Date().toISOString()
          }]);
        
        if (error) throw error;
        
        // Update chat's last_message and updated_at
        const lastMsgText = content || (media ? (media.type === 'voice' ? 'Voice note' : 'Media') : 'New message');
        await supabaseClient
          .from('chats')
          .update({ 
            last_message: lastMsgText,
            updated_at: new Date().toISOString()
          })
          .eq('id', chatId);

        // Send notifications to other chat participants
        const actor = currentActor();
        const chat = supabaseChats.find(c => c.id === chatId);
        try {
          const { data: participants } = await supabaseClient
            .from('chat_participants')
            .select('user_id')
            .eq('chat_id', chatId);

          if (participants && participants.length) {
            const recipientNotifs = participants
              .filter(p => p.user_id !== authUser.id)
              .map(p => ({
                user_id: p.user_id,
                type: 'message',
                title: `Message from ${actor.name}`,
                text: lastMsgText.substring(0, 100),
                data: { chat_id: chatId, sender_id: authUser.id, sender_name: actor.name },
                read: false,
                created_at: new Date().toISOString()
              }));
            if (recipientNotifs.length) {
              supabaseClient.from('notifications').insert(recipientNotifs).then();
            }
          }
        } catch(notifErr) {
          console.warn('Participant notification notice:', notifErr);
        }
        
        return true;
      } catch (err) {
        console.warn('Send message error:', err);
        return false;
      }
    }

    async function createChatWithUser(otherUserId) {
      if (!supabaseClient || !authUser) return null;
      try {
        // Check if chat already exists
        const { data: existing } = await supabaseClient
          .from('chat_participants')
          .select('chat_id')
          .eq('user_id', authUser.id);
        
        const userChatIds = existing?.map(e => e.chat_id) || [];
        
        if (userChatIds.length > 0) {
          const { data: shared } = await supabaseClient
            .from('chat_participants')
            .select('chat_id')
            .eq('user_id', otherUserId)
            .in('chat_id', userChatIds);
          
          if (shared && shared.length > 0) {
            return shared[0].chat_id;
          }
        }
        
        // Create new chat
        const { data: chat, error: cErr } = await supabaseClient
          .from('chats')
          .insert([{ created_at: new Date().toISOString() }])
          .select('id')
          .single();
        
        if (cErr) throw cErr;
        
        // Add both participants
        await supabaseClient
          .from('chat_participants')
          .insert([
            { chat_id: chat.id, user_id: authUser.id },
            { chat_id: chat.id, user_id: otherUserId }
          ]);
        
        return chat.id;
      } catch (err) {
        console.warn('Create chat error:', err);
        return null;
      }
    }

    async function markMessagesAsRead(chatId) {
      if (!supabaseClient || !authUser) return;
      try {
        await supabaseClient
          .from('messages')
          .update({ read: true })
          .eq('chat_id', chatId)
          .neq('user_id', authUser.id)
          .eq('read', false);
      } catch (err) {
        console.warn('Mark read error:', err);
      }
    }

    async function startChatWith(profileName) {
      const p = findProfile(profileName);
      if (!p || !p.user_id) return showToast('Cannot start chat');
      
      const chatId = await createChatWithUser(p.user_id);
      if (chatId) {
        closePeopleSearch();
        go('messages');
        openThread(chatId);
      }
    }

    function ensureMeProfile() {
      const meta = (authUser && authUser.user_metadata) || {};
      const first = meta.first || '';
      const surname = meta.surname || '';
      const name = meta.full_name || (first || surname ? `${first} ${surname}`.trim() : '') || (authUser ? authUser.email : 'amaNazaretha Member');

      let me = profiles.find(p => p.me || (authUser && p.user_id === authUser.id));
      if (!me) {
        me = {
          name: name,
          first: first,
          surname: surname,
          initials: ((first[0] || name[0] || 'A') + (surname[0] || (name.split(' ')[1] ? name.split(' ')[1][0] : ''))).toUpperCase(),
          avatarColor: "#0c0c0c",
          bio: "Walking the Shembe path with amaNazaretha.",
          type: "Member",
          temple: meta.temple || "eBuhleni",
          preacher: meta.preacher || "",
          joined: "Just now",
          location: "Durban",
          followers: 0,
          followingCount: 0,
          verified: false,
          following: false,
          me: true,
          user_id: authUser ? authUser.id : null,
          avatarImage: ""
        };
        profiles.unshift(me);
      } else {
        me.me = true;
        if (name && (me.name === 'Member' || !me.name)) {
          me.name = name;
          me.first = first;
          me.surname = surname;
          me.initials = ((first[0] || name[0] || 'A') + (surname[0] || (name.split(' ')[1] ? name.split(' ')[1][0] : ''))).toUpperCase();
        }
      }
      return me;
    }

    // ============================================================
    //  FEED RENDER
    // ============================================================
    function postCard(p) {
      const liked = likedPostIds.has(p.id);
      const saved = savedPostIds.has(p.id);
      const reposted = repostedPostIds.has(p.id);
      const media = p.video
        ? `<div class="media media-video" onclick="event.stopPropagation();openPostVideo(${p.id})">
            <video src="${p.video}" muted playsinline preload="metadata"></video>
            <div class="media-play"><i class="iconoir-play"></i></div>
          </div>`
        : p.image
        ? `<div class="media-photo" onclick="event.stopPropagation()"><img src="${p.image}" alt=""></div>`
        : '';
      const me = ensureMeProfile();
      const isMyPost = p.isMe || (authUser && p.userId && p.userId === authUser.id) || (!p.userId && (!p.author || p.author === me.name || p.author === 'Member'));
      const authorName = isMyPost ? (me.name || currentActor().name) : (p.author || 'Member');
      const authorAvatar = isMyPost ? (me.avatarImage || p.authorAvatar || '') : (p.authorAvatar || '');
      const authorInitials = isMyPost ? (me.initials || currentActor().initials) : (p.authorInitials || (authorName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AN'));
      const authorColor = isMyPost ? (me.avatarColor || '#0c0c0c') : (p.authorColor || '#0c0c0c');
      const authorSub = isMyPost ? (me.temple || p.temple || '') : (p.temple || '');
      const avatarHtml = authorAvatar
        ? `<img src="${authorAvatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
        : `<span style="font-size:12px;font-weight:700;color:#fff">${authorInitials}</span>`;
      return `<article class="post" onclick="openDetail(${p.id})">
        <div class="post-head">
          <div class="avatar" style="background:${authorColor};display:flex;align-items:center;justify-content:center">${avatarHtml}</div>
          <div><b>${authorName}</b><span>${authorSub}</span></div>
          <button class="menu-btn" onclick="event.stopPropagation();openPostMenu(${p.id})"><i class="iconoir-menu"></i></button>
        </div>
        ${media}
        <div class="post-body">
          <p>${p.text}</p>
          <div class="post-time">${p.time}</div>
          <div class="tags">${p.tags}</div>
        </div>
        <div class="post-actions">
          <div class="left-actions">
            <button class="action${liked ? ' liked' : ''}" data-act="like" data-post-id="${p.id}" onclick="event.stopPropagation();toggleLike(this)"><i class="iconoir-heart"></i><span>${p.likes}</span></button>
            <button class="action" data-comment-id="${p.id}" onclick="event.stopPropagation();openPostComments(${p.id})"><i class="iconoir-chat-bubble"></i><span>${p.comments}</span></button>
            <button class="action${reposted ? ' reposted' : ''}" data-act="repost" data-post-id="${p.id}" onclick="event.stopPropagation();toggleRepost(this)"><i class="iconoir-repeat"></i><span>${p.reposts}</span></button>
            <button class="action" onclick="event.stopPropagation();sharePostLink(${p.id})"><i class="iconoir-share-android"></i></button>
          </div>
          <div class="right-actions">
            <button class="action${saved ? ' saved' : ''}" data-act="save" data-post-id="${p.id}" onclick="event.stopPropagation();toggleSave(this)"><i class="iconoir-bookmark"></i></button>
          </div>
        </div>
      </article>`;
    }

    function peopleCarousel() {
      const list = profiles.filter(p => !p.me);
      if (!list.length) return '';
      return `<div class="people-carousel">
        <div class="pc-head"><b>People you may know</b></div>
        <div class="pc-scroll">
          ${list.map(p => {
            const avatarSrc = p.avatarImage;
            const avatarHtml = avatarSrc
              ? `<img src="${avatarSrc}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
              : `<span style="font-size:12px;font-weight:700;color:#fff">${p.initials}</span>`;
            return `<div class="pc-user">
              <button class="pc-user-top" onclick="openUserProfile('${p.name}')">
                <span class="pc-avatar" style="background:${p.avatarColor};display:flex;align-items:center;justify-content:center">${avatarHtml}</span>
                <span class="pc-name">${p.name}</span>
              </button>
              <button class="pc-follow${p.following ? ' following' : ''}" data-name="${p.name}" onclick="toggleCarouselFollow('${p.name}', this)">${p.following ? 'Following' : 'Follow'}</button>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    function toggleCarouselFollow(name, btn) {
      const p = findProfile(name);
      if (!p) return;
      p.following = !p.following;
      p.followers = (p.followers || 0) + (p.following ? 1 : -1);
      btn.classList.toggle('following', p.following);
      btn.textContent = p.following ? 'Following' : 'Follow';
      const reel = reels.find(r => r.username === p.name);
      if (reel) {
        reel.following = p.following;
        document.querySelectorAll(`.reel[data-reel-id="${reel.id}"] .reel-follow`).forEach(b => {
          b.classList.toggle('following', reel.following);
          b.textContent = reel.following ? 'Following' : 'Follow';
        });
      }
      showToast(p.following ? `Following ${p.name}` : `Unfollowed ${p.name}`);
      handleFollowAction(p, p.following);
    }

     function renderFeed() {
       const feed = document.getElementById('feed');
       if (!feed) return;
       if (!posts || !posts.length) {
         feed.innerHTML = '<div style="text-align:center;color:var(--pr-grey);padding:48px 20px;font-size:13px">No posts yet.</div>';
         return;
       }
       feed.innerHTML = posts
         .map((p, i) => postCard(p) + (i % 3 === 0 && i < posts.length - 1 ? peopleCarousel() : ''))
         .join('');
     }

    // ============================================================
    //  MESSAGES
    // ============================================================
    function relLabel(p) {
      if (p.following && p.followsYou) return 'You follow each other';
      if (p.following) return 'Following';
      if (p.followsYou) return 'Follows you';
      return p.temple || '';
    }

    function renderChats(filter = '') {
      const el = document.getElementById('chatList');
      if (!el) return;
      const q = filter.trim().toLowerCase();
      const list = supabaseChats.filter(c => !q || c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q));
      let html = '';
      if (!q && supabaseMessageRequests.length) {
        html += `<button class="chat-requests" onclick="openRequests()">
          <span class="chat-requests-icon"><i class="iconoir-inbox"></i></span>
          <div class="chat-meta">
            <div class="row"><b>Message requests</b></div>
            <p>From people you don't follow</p>
          </div>
          <span class="chat-unread">${supabaseMessageRequests.length}</span>
        </button>`;
      }
      html += list.map(c => `
        <button class="chat-item" onclick="openThread('${c.id}')">
          <div class="chat-avatar" style="background:${c.color}" onclick="event.stopPropagation();openUserProfile('${c.name}')" title="View profile">
            ${c.avatarImage 
              ? `<img src="${c.avatarImage}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
              : c.initials}
            ${c.online ? '<span class="online"></span>' : ''}
          </div>
          <div class="chat-meta">
            <div class="row">
              <b>${c.name}</b>
              <span class="time">${c.time}</span>
            </div>
            <p>${c.typing ? '<span class="typing-preview">typing…</span>' : c.preview}</p>
          </div>
          ${c.unread ? `<span class="chat-unread">${c.unread}</span>` : ''}
        </button>
      `).join('');
      if (!list.length && !html) html = '<div style="text-align:center;color:var(--muted);padding:48px 20px;font-size:13px">No conversations found</div>';
      el.innerHTML = html;
    }

    function filterChats() {
      renderChats(document.getElementById('chatSearch').value);
    }

    // ---------- People search ----------
    function openPeopleSearch() {
      const input = document.getElementById('peopleSearchInput');
      input.value = '';
      renderPeopleSearch();
      document.getElementById('peopleSearch').classList.add('open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => input.focus(), 120);
    }

    function closePeopleSearch() {
      document.getElementById('peopleSearch').classList.remove('open');
      document.body.style.overflow = '';
    }

    function renderPeopleSearch() {
      const q = (document.getElementById('peopleSearchInput').value || '').trim().toLowerCase();
      const people = profiles.filter(p => !p.me && p.name.toLowerCase().includes(q));
      const followed = people.filter(p => p.following);
      const others = people.filter(p => !p.following);
      const row = p => `
        <button class="ps-user" onclick="startChatWith('${p.name}')">
          <span class="ps-user-avatar" style="background:${p.avatarColor}">${p.initials}</span>
          <span class="ps-user-meta"><b>${p.name}</b><span>${relLabel(p)}</span></span>
          <span class="ps-user-action"><i class="iconoir-chat-bubble"></i></span>
        </button>`;
      let html = '';
      if (followed.length) html += '<div class="cg-label">Following</div>' + followed.map(row).join('');
      if (others.length) html += '<div class="cg-label">Other members</div>' + others.map(row).join('');
      if (!people.length) html = '<div class="cg-empty">No people found</div>';
      document.getElementById('peopleSearchList').innerHTML = html;
    }

     async function startChatWith(name) {
      const p = profiles.find(x => x.name === name);
      if (!p || !p.user_id) return showToast('Cannot start chat');
      
      const chatId = await createChatWithUser(p.user_id);
      if (chatId) {
        closePeopleSearch();
        go('messages');
        openThread(chatId);
      }
    }

    // ---------- Message requests ----------
    function openRequests() {
      renderRequests();
      document.getElementById('requestsPanel').classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeRequests() {
      document.getElementById('requestsPanel').classList.remove('open');
      document.body.style.overflow = '';
    }

    // ---------- Settings ----------
    function openSettings() {
      document.getElementById('settingsPanel').classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeSettings() {
      document.getElementById('settingsPanel').classList.remove('open');
      document.body.style.overflow = '';
    }

    // ---------- Create: camera + post composer ----------
    let postDraft = { file: null, type: '', url: '', tags: [] };
    let camStream = null;
    let camFacing = 'environment';
    let camRecorder = null;
    let camChunks = [];
    let camIsRecording = false;
    let camLongPress = false;
    let camHoldTimer = null;

    function openCreatePanel() {
      setCamTabUI('post');
      document.getElementById('createPanel').classList.add('open');
      document.body.style.overflow = 'hidden';
      startCamera();
    }

    function closeCreatePanel() {
      stopCamRecording();
      stopCamera();
      document.getElementById('createPanel').classList.remove('open');
      document.body.style.overflow = '';
    }

    async function startCamera() {
      stopCamera();
      const video = document.getElementById('camVideo');
      const fallback = document.getElementById('camFallback');
      try {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: camFacing },
          audio: true
        });
        video.srcObject = camStream;
        video.classList.remove('hidden');
        fallback.classList.add('hidden');
        video.play().catch(() => {});
      } catch (e) {
        camStream = null;
        video.classList.add('hidden');
        fallback.classList.remove('hidden');
      }
    }

    function stopCamera() {
      if (camStream) camStream.getTracks().forEach(t => t.stop());
      camStream = null;
      const video = document.getElementById('camVideo');
      if (video) video.srcObject = null;
    }

    function flipCamera() {
      camFacing = camFacing === 'environment' ? 'user' : 'environment';
      if (document.getElementById('createPanel').classList.contains('open')) startCamera();
    }

    function setCamTabUI(tab) {
      document.querySelectorAll('.cam-tab').forEach(b => b.classList.toggle('active', b.dataset.camTab === tab));
    }

    function setCamTab(tab) {
      setCamTabUI(tab);
      if (tab === 'text') {
        closeCreatePanel();
        openPostComposer();
      }
    }

    function camPressStart() {
      camLongPress = false;
      clearTimeout(camHoldTimer);
      camHoldTimer = setTimeout(() => {
        camLongPress = true;
        startCamRecording();
      }, 380);
    }

    function camPressEnd() {
      clearTimeout(camHoldTimer);
      if (camIsRecording) stopCamRecording();
    }

    function camTap() {
      if (camLongPress) { camLongPress = false; return; }
      if (camIsRecording) return;
      captureCamPhoto();
    }

    function captureCamPhoto() {
      if (!camStream) { pickCamFile('image/*'); return; }
      const video = document.getElementById('camVideo');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 960;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) return;
        openPostComposerWithFile(new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.9);
    }

    function startCamRecording() {
      if (!camStream || typeof MediaRecorder === 'undefined') {
        showToast('Camera unavailable — choose a video');
        pickCamFile('video/*');
        return;
      }
      try {
        camRecorder = new MediaRecorder(camStream);
      } catch (e) {
        pickCamFile('video/*');
        return;
      }
      camChunks = [];
      camRecorder.ondataavailable = e => { if (e.data && e.data.size) camChunks.push(e.data); };
      camRecorder.onstop = () => {
        const blob = new Blob(camChunks, { type: camChunks[0] ? camChunks[0].type : 'video/webm' });
        if (!blob.size) return;
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        openPostComposerWithFile(new File([blob], 'camera-video.' + ext, { type: blob.type }));
      };
      camRecorder.start();
      camIsRecording = true;
      document.getElementById('camRecord').classList.add('recording');
      showToast('Recording video…');
    }

    function stopCamRecording() {
      camIsRecording = false;
      const btn = document.getElementById('camRecord');
      if (btn) btn.classList.remove('recording');
      if (camRecorder && camRecorder.state !== 'inactive') {
        camRecorder.stop();
        camRecorder = null;
      }
    }

    function pickCamFile(kind) {
      const input = document.getElementById('camFile');
      input.accept = kind;
      input.value = '';
      input.click();
    }

    function loadCamFile(input) {
      const f = input.files && input.files[0];
      if (f) openPostComposerWithFile(f);
    }

    function openPostComposerWithFile(file) {
      closeCreatePanel();
      resetPostComposer();
      postDraft.file = file;
      postDraft.type = file.type.startsWith('video') ? 'video' : 'image';
      postDraft.url = URL.createObjectURL(file);
      const media = document.getElementById('pcMedia');
      media.classList.add('has-file');
      media.innerHTML = postDraft.type === 'video'
        ? `<video src="${postDraft.url}" muted playsinline autoplay loop></video>`
        : `<img src="${postDraft.url}" alt="Post preview">`;
      document.getElementById('postComposer').classList.add('open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => document.getElementById('pcCaption').focus(), 120);
    }

    function openPostComposer() {
      closeCreatePanel();
      resetPostComposer();
      document.getElementById('postComposer').classList.add('open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => document.getElementById('pcCaption').focus(), 120);
    }

    let editingPostId = null;
    function closePostComposer() {
      document.getElementById('postComposer').classList.remove('open');
      document.body.style.overflow = '';
      editingPostId = null;
    }
    function resetPostComposer() {
      postDraft = { file: null, type: '', url: '', tags: [] };
      document.getElementById('pcCaption').value = '';
      document.getElementById('pcFile').value = '';
      const media = document.getElementById('pcMedia');
      media.classList.remove('has-file');
      media.innerHTML = '<i class="iconoir-media-image-plus"></i><span>Add photo or video</span>';
      document.querySelectorAll('.pc-tag').forEach(t => t.classList.remove('active'));
    }

    function loadPostFile(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      postDraft.file = f;
      postDraft.type = f.type.startsWith('video') ? 'video' : 'image';
      postDraft.url = URL.createObjectURL(f);
      const media = document.getElementById('pcMedia');
      media.classList.add('has-file');
      media.innerHTML = postDraft.type === 'video'
        ? `<video src="${postDraft.url}" muted playsinline autoplay loop></video>`
        : `<img src="${postDraft.url}" alt="Post preview">`;
    }

    function togglePostTag(btn) {
      btn.classList.toggle('active');
      const i = postDraft.tags.indexOf(btn.dataset.tag);
      if (i >= 0) postDraft.tags.splice(i, 1);
      else postDraft.tags.push(btn.dataset.tag);
    }

    // Post media must live in Supabase Storage: blob: object URLs die with the tab,
    // so anything saved as a blob: link shows up as a broken image/video after reload.
    async function uploadPostMedia(file, onProgress) {
      if (!supabaseClient || !file) return null;
      try {
        const raw = (file.name || '').replace(/[^a-z0-9._-]/gi, '_');
        const ext = raw.indexOf('.') > -1 ? raw.split('.').pop() : (String(file.type || '').indexOf('video') === 0 ? 'mp4' : 'jpg');
        const path = 'posts/' + Date.now() + '_' + Math.random().toString(36).slice(2, 9) + '.' + ext;
        
        // Use resumable upload for progress tracking
        const { data, error } = await supabaseClient.storage.from('media').upload(path, file, { 
          upsert: false, 
          contentType: file.type || undefined,
          duplex: 'half' // Enable progress events
        });
        
        if (error) { 
          console.warn('Supabase media upload notice:', error.message); 
          return null; 
        }
        
        const { data: urlData } = supabaseClient.storage.from('media').getPublicUrl(path);
        return (urlData && urlData.publicUrl) || null;
      } catch (err) {
        console.warn('Supabase media upload notice:', err && err.message);
        return null;
      }
    }

    // Upload with progress using XMLHttpRequest for better progress tracking
    function uploadPostMediaWithProgress(file, onProgress) {
      return new Promise((resolve, reject) => {
        if (!supabaseClient) return resolve(null);
        
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
          if (!session) return resolve(null);
          
          const raw = (file.name || '').replace(/[^a-z0-9._-]/gi, '_');
          const ext = raw.indexOf('.') > -1 ? raw.split('.').pop() : (String(file.type || '').indexOf('video') === 0 ? 'mp4' : 'jpg');
          const path = 'posts/' + Date.now() + '_' + Math.random().toString(36).slice(2, 9) + '.' + ext;
          const url = `${SUPABASE_URL}/storage/v1/object/media/${path}`;
          
          const xhr = new XMLHttpRequest();
          xhr.open('POST', url, true);
          xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
          xhr.setRequestHeader('x-upsert', 'false');
          
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
              onProgress(e.loaded / e.total);
            }
          };
          
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
              resolve(publicUrl);
            } else {
              console.warn('Upload failed:', xhr.status, xhr.responseText);
              resolve(null);
            }
          };
          
          xhr.onerror = () => {
            console.warn('Upload error');
            resolve(null);
          };
          
          xhr.send(file);
        });
      });
    }

    async function sharePost() {
      const caption = document.getElementById('pcCaption').value.trim();
      const mediaFile = postDraft.file || null;
      const isVideo = postDraft.type === 'video';
      const mediaUrl = postDraft.url;
      const tags = postDraft.tags.length ? postDraft.tags.join(' ') : '#Amanazaretha';
      if (!caption && !mediaFile) return showToast('Add a photo or write something');

      // ── Edit existing post ──
      if (editingPostId !== null) {
        const ep = posts.find(x => x.id === editingPostId);
        if (ep) {
          ep.text = caption || ep.text;
          ep.tags = tags;
          if (supabaseClient) {
            supabaseClient.from('posts').update({ text: ep.text, tags: ep.tags }).eq('id', editingPostId)
              .then(({ error }) => { if (error) showToast('Failed to update post on server'); });
          }
        }
        editingPostId = null;
        resetPostComposer();
        closePostComposer();
        go('home');
        renderFeed();
        savePostsLocal();
        showToast('Post updated');
        return;
      }

      const actor = currentActor();
      const meRow = ensureMeProfile() || {};
      const newPost = {
        id: Date.now(),
        text: caption || 'New post',
        tags: tags,
        temple: meRow.temple || 'eBuhleni',
        time: 'Just now',
        likes: 0,
        comments: 0,
        reposts: 0,
        image: !isVideo && mediaFile ? mediaUrl : undefined,
        video: isVideo ? mediaUrl : undefined,
        userId: authUser ? authUser.id : null,
        isMe: true,
        author: actor.name,
        authorInitials: actor.initials,
        authorAvatar: actor.avatar || ''
      };
      posts.unshift(newPost);
      renderFeed();
      savePostsLocal();
      renderMyProfile();

      closePostComposer();
      go('home');
      showToast('Posted to your feed');

      // Sync post to Supabase (media first, so the row stores a durable URL)
      if (supabaseClient) {
        (async () => {
          let dbImage = null;
          let dbVideo = null;
          if (mediaFile) {
            // Show upload progress
            const progressEl = document.createElement('div');
            progressEl.className = 'upload-progress';
            progressEl.innerHTML = '<div class="upload-bar"><div class="upload-fill" style="width:0%"></div></div><span class="upload-text">Uploading...</span>';
            document.body.appendChild(progressEl);
            
            const publicUrl = await uploadPostMediaWithProgress(mediaFile, (progress) => {
              const fill = progressEl.querySelector('.upload-fill');
              const text = progressEl.querySelector('.upload-text');
              if (fill) fill.style.width = Math.round(progress * 100) + '%';
              if (text) text.textContent = `Uploading... ${Math.round(progress * 100)}%`;
            });
            
            progressEl.remove();
            
            if (publicUrl) {
              if (isVideo) dbVideo = publicUrl; else dbImage = publicUrl;
              newPost.image = dbImage || undefined;
              newPost.video = dbVideo || undefined;
              renderFeed();
            }
          }
          const { data, error } = await supabaseClient.from('posts').insert([{
            text: newPost.text,
            tags: newPost.tags,
            temple: newPost.temple,
            likes: 0,
            comments: 0,
            reposts: 0,
            image: dbImage,
            video: dbVideo,
            user_id: authUser ? authUser.id : null,
            author_name: newPost.author,
            author_initials: newPost.authorInitials,
            author_avatar: newPost.authorAvatar || null,
            created_at: new Date().toISOString()
          }]).select('id');
          if (error) return console.warn('Supabase post sync notice:', error.message);
          const dbId = data && data[0] && data[0].id;
          if (dbId && dbId !== newPost.id) {
            newPost.id = dbId;
            renderFeed();
            savePostsLocal();
          }
        })();
      }
    }

    // ---------- Register ----------
    let regGender = '';
    let regPraise = '';
    let regAvatarData = '';
        const PRAISE = {
      male: ['Nkosana', 'Nhlalisuthi'],
      female: ['Nkosazane', 'Ntethelelo', 'Ntabayepheza', 'Jamengweni']
    };

    function isAuthed() {
      return !!authUser;
    }

    function resetAuthForms() {
      regGender = '';
      regPraise = '';
      regAvatarData = '';
            ['regFirst', 'regSurname', 'regEmail', 'regPassword', 'regDob', 'regTemple', 'regPreacher'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = '';
      });
      const avInput = document.getElementById('regAvatarInput');
      if (avInput) avInput.value = '';
      const avImg = document.getElementById('regAvatarImg');
      const avIcon = document.getElementById('regAvatarIcon');
      if (avImg) { avImg.src = ''; avImg.style.display = 'none'; }
      if (avIcon) avIcon.style.display = 'block';

      const cvInput = document.getElementById('regCoverInput');
      if (cvInput) cvInput.value = '';
      const cvImg = document.getElementById('regCoverImg');
      const cvIcon = document.getElementById('regCoverIcon');
      if (cvImg) { cvImg.src = ''; cvImg.style.display = 'none'; }
      if (cvIcon) cvIcon.style.display = 'block';

      document.querySelectorAll('#regGender button').forEach(b => b.classList.remove('active'));
      const opts = document.getElementById('regPraiseOpts');
      if (opts) opts.innerHTML = '';
      const loginPass = document.getElementById('loginPassword');
      if (loginPass) loginPass.value = '';
      const forgotId = document.getElementById('forgotId');
      if (forgotId) forgotId.value = '';
    }

    function openAuth(screen = 'welcome') {
      const flow = document.getElementById('authFlow');
      if (!flow) {
        if (!isAuthed() && !window.location.pathname.endsWith('login.html')) {
          window.location.href = 'login.html';
        }
        return;
      }
      const close = document.getElementById('authClose');
      if (close) close.hidden = !isAuthed();
      resetAuthForms();
      flow.classList.add('open');
      flow.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      showAuth(screen);
    }

    function showAuth(name) {
      document.querySelectorAll('#authFlow .auth-screen').forEach(s => {
        s.classList.toggle('active', s.dataset.auth === name);
      });
      const active = document.querySelector('#authFlow .auth-screen.active');
      const scroll = active && active.querySelector('.auth-scroll');
      if (scroll) scroll.scrollTop = 0;
      if (name === 'forgot') {
        document.getElementById('forgotForm').hidden = false;
        document.getElementById('forgotSuccess').hidden = true;
        document.getElementById('forgotSwitch').hidden = false;
        document.getElementById('forgotId').value = '';
      }
      if (name === 'login') {
        setTimeout(() => document.getElementById('loginId').focus(), 80);
      }
    }

    function closeAuth() {
      const flow = document.getElementById('authFlow');
      if (flow) {
        flow.classList.remove('open');
        flow.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      }
      if (window.location.pathname.endsWith('login.html')) {
        window.location.href = 'index.html';
      }
    }

    function openRegister() {
      openAuth('register');
    }

    function closeRegister() {
      closeAuth();
    }

    function togglePassword(id, btn) {
      const input = document.getElementById(id);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = `<i class="${show ? 'iconoir-eye-closed' : 'iconoir-eye'}"></i>`;
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    }

    function submitLogin(e) {
      if (e) e.preventDefault();
      const id = document.getElementById('loginId').value.trim();
      const pass = document.getElementById('loginPassword').value;
      if (!id) return showToast('Enter your email or phone');
      if (pass.length < 6) return showToast('Password must be at least 6 characters');

      const finish = (label) => {
        document.getElementById('loginPassword').value = '';
        closeAuth();
        go('home');
        showToast(label || 'Welcome back');
      };

      const btn = document.querySelector('#authFlow .auth-screen.active button[type="submit"]');
      if (btn) btn.disabled = true;

      if (!supabaseClient) {
        if (btn) btn.disabled = false;
        return showToast('Supabase client not connected');
      }

      supabaseClient.auth.signInWithPassword({ email: id, password: pass })
        .then(async ({ data, error }) => {
          if (btn) btn.disabled = false;
          if (error) {
            const msg = (error.message || '').toLowerCase();
            if (msg.indexOf('invalid login credentials') >= 0) return showToast('Wrong email or password');
            if (msg.indexOf('email not confirmed') >= 0) return showToast('Confirm your email first, then sign in');
            console.warn('Supabase login notice:', error.message);
            return showToast(error.message || 'Could not sign in');
          }
          authUser = data.user;
          let me = null;
          try { me = await loadMyProfile(data.user); } catch (err) { console.warn('Profile lookup notice:', err && err.message); }
          if (!me) {
            const meta = data.user.user_metadata || {};
            me = adoptProfile({
              email: data.user.email,
              first: meta.first,
              surname: meta.surname,
              temple: meta.temple,
              name: meta.full_name
            }, data.user.email);
          }
          subscribeToRealtime();
          await loadSupabaseData();
          await loadEngagementState();
          finish('Welcome back, ' + ((me && me.name) || 'friend'));
        })
        .catch(err => {
          if (btn) btn.disabled = false;
          showToast('Sign in failed: ' + (err.message || 'Network error'));
        });
    }

    async function submitForgot(e) {
      if (e) e.preventDefault();
      const id = document.getElementById('forgotId').value.trim();
      if (!id) return showToast('Enter your email or phone');
      if (supabaseClient) {
        try {
          const { error } = await supabaseClient.auth.resetPasswordForEmail(id);
          if (error) console.warn('Reset password notice:', error.message);
        } catch (err) {
          console.warn('Reset password error:', err);
        }
      }
      document.getElementById('forgotForm').hidden = true;
      document.getElementById('forgotSuccess').hidden = false;
      document.getElementById('forgotSwitch').hidden = true;
      showToast('Reset link sent');
    }

    function logout() {
      // Unsubscribe from realtime
      unsubscribeFromRealtime();
      
      if (supabaseClient) {
        try { Promise.resolve(supabaseClient.auth.signOut()).catch(err => console.warn('Supabase signOut notice:', err && err.message)); } catch (e) {}
      }
      authUser = null;
      profiles.forEach(p => { p.me = false; });
      closeSettings();
      go('home');
      openAuth('welcome');
      showToast('Signed out');
    }

    function selectRegGender(g) {
      regGender = g;
      regPraise = '';
      document.querySelectorAll('#regGender button').forEach(b => {
        b.classList.toggle('active', b.dataset.g === g);
      });
      const opts = document.getElementById('regPraiseOpts');
      const label = document.getElementById('regPraiseLabel');
      const title = document.getElementById('regPraiseTitle');
      if (label) label.textContent = g === 'male' ? 'Praise name (male)' : 'Praise name (female)';
      if (title) title.textContent = g === 'male' ? 'Praise name (male)' : 'Praise name (female)';
      if (opts) {
        opts.innerHTML = PRAISE[g].map(n =>
          `<button type="button" data-p="${n}" onclick="selectRegPraise('${n}')">${n}</button>`
        ).join('');
      }
    }

    function selectRegPraise(n) {
      regPraise = n;
      document.querySelectorAll('#regPraiseOpts button').forEach(b => {
        b.classList.toggle('active', b.dataset.p === n);
      });
    }

    // Downscale + re-encode uploads before they are stored as data URLs.
    // Full-resolution photos made the profiles payload ~17MB (19s to load).
    function compressImageFile(file, maxDim, quality) {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onerror = function() { resolve(''); };
        reader.onload = function(e) {
          const raw = e.target.result;
          const img = new Image();
          img.onerror = function() { resolve(raw); };
          img.onload = function() {
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            const cw = Math.max(1, Math.round(img.width * scale));
            const ch = Math.max(1, Math.round(img.height * scale));
            let out = raw;
            try {
              const canvas = document.createElement('canvas');
              canvas.width = cw;
              canvas.height = ch;
              canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
              const small = canvas.toDataURL('image/jpeg', quality);
              if (small && small.length < raw.length) out = small;
            } catch (err) {}
            resolve(out);
          };
          img.src = raw;
        };
        reader.readAsDataURL(file);
      });
    }

    function handleRegPhotoUpload(type, input) {
      const file = input.files && input.files[0];
      if (!file) return;
      compressImageFile(file, type === 'avatar' ? 640 : 1400, type === 'avatar' ? 0.82 : 0.78).then(dataUrl => {
        if (!dataUrl) return;
        if (type === 'avatar') {
          regAvatarData = dataUrl;
          const img = document.getElementById('regAvatarImg');
          const icon = document.getElementById('regAvatarIcon');
          if (img) { img.src = dataUrl; img.style.display = 'block'; }
          if (icon) icon.style.display = 'none';
        } 
      });
    }

    function nextRegStep(step, e) {
      if (e) e.preventDefault();
      if (step === 1) {
        const first = document.getElementById('regFirst').value.trim();
        const surname = document.getElementById('regSurname').value.trim();
        if (!first) return showToast('Enter your first name');
        if (!surname) return showToast('Enter your surname');
        showAuth('reg-dob');
      } else if (step === 2) {
        const dob = document.getElementById('regDob').value;
        if (!dob) return showToast('Select your date of birth');
        showAuth('reg-gender');
      } else if (step === 3) {
        if (!regGender) return showToast('Choose your gender');
        showAuth('reg-praise');
      } else if (step === 4) {
        if (!regPraise) return showToast('Choose your praise name');
        showAuth('reg-temple');
      } else if (step === 5) {
        const temple = document.getElementById('regTemple').value.trim();
        if (!temple) return showToast('Select your temple');
        showAuth('reg-preacher');
      } else if (step === 6) {
        const preacher = document.getElementById('regPreacher').value.trim();
        if (!preacher) return showToast('Select your preacher');
        showAuth('reg-email');
      } else if (step === 7) {
        const email = document.getElementById('regEmail').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('Enter a valid email');
        showAuth('reg-password');
      } else if (step === 8) {
        const password = document.getElementById('regPassword').value;
        if (password.length < 6) return showToast('Password needs at least 6 characters');
        showAuth('reg-avatar');
      }
    }

    async function submitRegister(e) {
      if (e) e.preventDefault();
      const first = document.getElementById('regFirst').value.trim();
      const surname = document.getElementById('regSurname').value.trim();
      const dob = document.getElementById('regDob').value;
      const temple = document.getElementById('regTemple').value.trim();
      const preacher = document.getElementById('regPreacher').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;

      if (!first) { showAuth('register'); return showToast('Enter your first name'); }
      if (!surname) { showAuth('register'); return showToast('Enter your surname'); }
      if (!dob) { showAuth('reg-dob'); return showToast('Select your date of birth'); }
      if (!regGender) { showAuth('reg-gender'); return showToast('Choose your gender'); }
      if (!regPraise) { showAuth('reg-praise'); return showToast('Choose your praise name'); }
      if (!temple) { showAuth('reg-temple'); return showToast('Select your temple'); }
      if (!preacher) { showAuth('reg-preacher'); return showToast('Select your preacher'); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAuth('reg-email'); return showToast('Enter a valid email'); }
      if (password.length < 6) { showAuth('reg-password'); return showToast('Password needs at least 6 characters'); }

      let age = 0;
      if (dob) {
        const birthDate = new Date(dob);
        const diff = Date.now() - birthDate.getTime();
        age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
      }

      const data = {
        name: `${first} ${surname}`.trim(),
        first,
        surname,
        temple,
        preacher,
        age: age > 0 ? age : 25,
        dob,
        gender: regGender,
        praise: regPraise,
        email,
        avatar: regAvatarData || '',
        cover: ''
      };

      // Create the real Supabase Auth account first — this is the login credential
      let userId = null;
      let hasSession = false;
      if (supabaseClient) {
        const { data: signed, error } = await supabaseClient.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              first: first,
              surname: surname,
              temple: temple,
              full_name: `${first} ${surname}`,
              gender: regGender,
              praise: regPraise,
              preacher: preacher
            }
          }
        });
        if (error) {
          const msg = (error.message || '').toLowerCase();
          if (msg.indexOf('already registered') >= 0 || msg.indexOf('already been registered') >= 0) {
            return showToast('That email already has an account — tap Sign in');
          }
          console.warn('Supabase signup notice:', error.message);
          return showToast(error.message || 'Could not create your account');
        }
        authUser = signed && signed.user ? signed.user : null;
        hasSession = !!(signed && signed.session);
        userId = authUser ? authUser.id : null;
      }

      profiles.forEach(x => { x.me = false; });
      let me = profiles.find(p => p.email && String(p.email).toLowerCase() === email.toLowerCase());
      if (!me) {
        me = profiles.find(p => p.me);
        if (!me) {
          me = { me: true };
          profiles.unshift(me);
        }
      }
      Object.assign(me, {
        name: `${first} ${surname}`.trim(),
        first: first,
        surname: surname,
        temple: temple,
        preacher: preacher,
        email: email,
        initials: ((first[0] || 'A') + (surname[0] || '')).toUpperCase(),
        user_id: userId || me.user_id || null,
        avatarColor: '#0c0c0c',
        avatarImage: regAvatarData || me.avatarImage || '',
        coverImage: null,
        bio: 'Walking the Shembe path with amaNazaretha.',
        type: 'Member',
        followers: me.followers || 0,
        followingCount: me.followingCount || 0,
        following: false,
        me: true
      });

      // Registered via Supabase Auth and Profiles table

      // Sync the profile row to Supabase, linked to the auth account
      if (supabaseClient) {
        supabaseClient.from('profiles').insert([{
          user_id: userId,
          name: `${first} ${surname}`.trim(),
          first: first,
          surname: surname,
          temple: temple,
          email: email,
          age: age > 0 ? age : 25,
          gender: regGender,
          praise: regPraise,
          preacher: preacher,
          initials: ((first[0] || 'A') + (surname[0] || '')).toUpperCase(),
          avatarColor: '#0c0c0c',
          avatarImage: regAvatarData || null,
          coverImage: null,
          bio: 'Walking the Shembe path with amaNazaretha.',
          type: 'Member',
          created_at: new Date().toISOString()
        }]).then(({ error }) => {
          if (error) console.warn('Supabase profile sync notice:', error.message);
        });
      }

      renderMyProfile();
      closeRegister();
      go('home');
      showToast(`Welcome, ${first} ${surname}`);
      
      // Subscribe to realtime after successful registration
      if (hasSession && supabaseClient) {
        subscribeToRealtime();
      }
    }

    function renderRequests() {
      const box = document.getElementById('requestsList');
      if (!supabaseMessageRequests.length) {
        box.innerHTML = '<div class="cg-empty">No message requests</div>';
        return;
      }
      box.innerHTML = supabaseMessageRequests.map(r => `
        <div class="req-row">
          <div class="chat-avatar" style="background:${r.color};display:flex;align-items:center;justify-content:center">
            ${r.avatarImage 
              ? `<img src="${r.avatarImage}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
              : r.initials}
          </div>
          <div class="req-meta"><b>${r.name}</b><span>${r.preview}</span></div>
          <div class="req-actions">
            <button class="accept" onclick="acceptRequest('${r.id}')" aria-label="Accept request"><i class="iconoir-check"></i></button>
            <button onclick="deleteRequest('${r.id}')" aria-label="Delete request"><i class="iconoir-xmark"></i></button>
          </div>
        </div>`).join('');
    }

    async function acceptRequest(id) {
      const i = supabaseMessageRequests.findIndex(r => r.id === id);
      if (i < 0) return;
      const req = supabaseMessageRequests.splice(i, 1)[0];
      
      // Create chat in Supabase with the requester
      const chatId = await createChatWithUser(req.user_id || req.id); // req.id is the chat_id
      if (chatId) {
        closeRequests();
        renderChats(document.getElementById('chatSearch').value);
        openThread(chatId);
        showToast(`Accepted ${req.name}'s request`);
      } else {
        showToast('Failed to accept request');
      }
    }

    function deleteRequest(id) {
      const i = supabaseMessageRequests.findIndex(r => r.id === id);
      if (i < 0) return;
      supabaseMessageRequests.splice(i, 1);
      renderRequests();
      renderChats(document.getElementById('chatSearch').value);
      showToast('Request deleted');
    }

    // ---------- Thread ----------
    let activeChatId = null;
    let typingTimer = null;
    let voiceRecTimer = null;
    let voiceSeconds = 0;
    let voicePlayTimer = null;
    const REACTIONS = ['❤️', '👍', '😂', '🙏', '😮'];

    function nowTimeLabel() {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function openThread(id) {
      const chat = supabaseChats.find(c => c.id === id);
      if (!chat) return;
      cancelVoiceRecording();
      clearTimeout(typingTimer);
      activeChatId = id;
      chat.unread = 0;
      chat.typing = false;
      document.getElementById('threadName').textContent = chat.name;
      const av = document.getElementById('threadAvatar');
      if (chat.avatarImage) {
        av.style.backgroundImage = `url("${chat.avatarImage}")`;
        av.style.backgroundColor = 'transparent';
        av.textContent = '';
      } else {
        av.style.backgroundImage = '';
        av.style.backgroundColor = chat.avatarColor || '#0c0c0c';
        av.textContent = chat.initials;
      }
      const status = document.getElementById('threadStatus');
      status.textContent = chat.online ? 'Online' : 'Last seen recently';
      status.classList.remove('typing');
      
      // Load messages from Supabase
      loadMessagesForChat(id).then(messages => {
        chat.messages = messages;
        renderThread(chat);
      });
      
      document.getElementById('chatThread').classList.add('open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        const box = document.getElementById('threadMessages');
        box.scrollTop = box.scrollHeight;
      }, 50);
      renderChats(document.getElementById('chatSearch').value);
      
      // Mark messages as read
      setTimeout(() => {
        if (activeChatId !== id) return;
        markMessagesAsRead(id);
      }, 900);
    }

    function messageHtml(m, i) {
      let content = '';
      if (m.media) {
        content += m.media.type === 'video'
          ? `<video class="bubble-media" src="${m.media.src}" controls playsinline></video>`
          : `<img class="bubble-media" src="${m.media.src}" alt="Photo">`;
      }
      if (m.voice) {
        content += `<button type="button" class="voice-note" onclick="event.stopPropagation();toggleVoicePlay(this, '${m.voice.duration}')">
          <span class="voice-play"><i class="iconoir-play"></i></span>
          <span class="voice-wave">${'<i></i>'.repeat(14)}</span>
          <span class="voice-dur">${m.voice.duration}</span>
        </button>`;
      }
      if (m.text) content += `<span class="bubble-text">${m.text}</span>`;
      const stamp = m.from === 'me'
        ? `<span class="stamp">${m.time} <span class="ticks ${m.read ? 'read' : ''}">✓${m.read ? '✓' : ''}</span></span>`
        : `<span class="stamp">${m.time}</span>`;
      const reactions = m.reactions && m.reactions.length
        ? `<div class="bubble-reactions">${m.reactions.join(' ')}</div>`
        : '';
      return `<div class="msg-row ${m.from}" data-msg-row="${i}">
        <div class="bubble ${m.from} ${m.media ? 'has-media' : ''}" onclick="toggleReactionBar(${i})">
          ${content}${stamp}${reactions}
        </div>
        <div class="reaction-bar" onclick="event.stopPropagation()">
          ${REACTIONS.map(e => `<button type="button" onclick="addReaction(${i}, '${e}')">${e}</button>`).join('')}
        </div>
      </div>`;
    }

    function renderThread(chat) {
      const box = document.getElementById('threadMessages');
      const st = box.scrollTop;
      box.innerHTML = chat.messages.map(messageHtml).join('');
      box.scrollTop = st;
    }

    function toggleReactionBar(i) {
      document.querySelectorAll('.msg-row.reacting').forEach(row => {
        if (row.dataset.msgRow !== String(i)) row.classList.remove('reacting');
      });
      const row = document.querySelector(`.msg-row[data-msg-row="${i}"]`);
      if (row) row.classList.toggle('reacting');
    }

    function addReaction(i, emoji) {
      const chat = supabaseChats.find(c => c.id === activeChatId);
      if (!chat || !chat.messages[i]) return;
      const m = chat.messages[i];
      m.reactions = m.reactions || [];
      const at = m.reactions.indexOf(emoji);
      if (at >= 0) m.reactions.splice(at, 1);
      else m.reactions.push(emoji);
      renderThread(chat);
    }

    function toggleVoicePlay(btn, duration) {
      clearTimeout(voicePlayTimer);
      document.querySelectorAll('.voice-note.playing').forEach(b => b.classList.remove('playing'));
      if (btn.classList.contains('playing')) {
        btn.classList.remove('playing');
        return;
      }
      btn.classList.add('playing');
      const secs = parseInt(String(duration).split(':')[1] || '3', 10);
      voicePlayTimer = setTimeout(() => btn.classList.remove('playing'), Math.max(2, secs) * 1000);
    }

    function closeThread() {
      cancelVoiceRecording();
      clearTimeout(typingTimer);
      document.getElementById('chatThread').classList.remove('open');
      document.body.style.overflow = '';
      activeChatId = null;
    }

    function sendThreadMsg() {
      const input = document.getElementById('threadInput');
      const text = input.value.trim();
      if (!text || !activeChatId) return;
      const chat = supabaseChats.find(c => c.id === activeChatId);
      if (!chat) return;
      
      // Optimistically add message
      const optimisticMsg = { from: 'me', text, time: nowTimeLabel(), read: false, id: 'temp-' + Date.now() };
      chat.messages.push(optimisticMsg);
      chat.preview = text;
      chat.time = 'Just now';
      input.value = '';
      renderThread(chat);
      const box = document.getElementById('threadMessages');
      box.scrollTop = box.scrollHeight;
      renderChats(document.getElementById('chatSearch').value);
      
      // Send to Supabase
      sendMessageToSupabase(activeChatId, text).then(success => {
        if (!success) {
          // Remove optimistic message on failure
          chat.messages = chat.messages.filter(m => m.id !== optimisticMsg.id);
          renderThread(chat);
          showToast('Failed to send message');
        }
      });
      
      simulateTyping(chat);
    }

    function simulateTyping(chat) {
      clearTimeout(typingTimer);
      chat.typing = true;
      const cs = document.getElementById('chatSearch');
      renderChats(cs ? cs.value : '');
      const status = document.getElementById('threadStatus');
      if (activeChatId === chat.id && status) {
        status.textContent = 'typing…';
        status.classList.add('typing');
        const box = document.getElementById('threadMessages');
        if (box && !document.getElementById('typingBubble')) {
          const bubble = document.createElement('div');
          bubble.id = 'typingBubble';
          bubble.className = 'bubble them typing';
          bubble.innerHTML = '<span></span><span></span><span></span>';
          box.appendChild(bubble);
          box.scrollTop = box.scrollHeight;
        }
      }
      typingTimer = setTimeout(() => {
        chat.typing = false;
        const b = document.getElementById('typingBubble');
        if (b) b.remove();

        // Authentic church member response
        const replies = [
          'Amen! Blessed Sabbath to you and your family.',
          'Siyabonga kakhulu. May uNkulunkulu bless your walk in faith.',
          'Amen! Peace and blessings to you in the holy church of amaNazaretha.',
          'May the teachings of Nazareth guide and protect you always.',
          'Amen brother/sister! Looking forward to seeing you at the temple service.'
        ];
        const replyText = replies[Math.floor(Math.random() * replies.length)];

        const replyMsg = {
          from: 'them',
          text: replyText,
          time: 'Just now',
          read: (activeChatId === chat.id)
        };
        if (!chat.messages) chat.messages = [];
        chat.messages.push(replyMsg);
        chat.preview = replyText;
        chat.time = 'Just now';

        if (activeChatId === chat.id) {
          chat.messages.forEach(m => { if (m.from === 'me') m.read = true; });
          renderThread(chat);
          const box2 = document.getElementById('threadMessages');
          if (box2) box2.scrollTop = box2.scrollHeight;
          if (status) {
            status.classList.remove('typing');
            status.textContent = chat.online ? 'Online' : 'Last seen recently';
          }
        } else {
          chat.unread = (chat.unread || 0) + 1;
        }

        saveChatsLocal();
        const searchInput = document.getElementById('chatSearch');
        renderChats(searchInput ? searchInput.value : '');

        // Trigger interaction notification
        addNotification({
          icon: 'message-circle',
          type: 'message',
          title: `Message from ${chat.name}`,
          text: replyText,
          time: 'Just now',
          unread: true,
          data: { chat_id: chat.id }
        }, false);
      }, 2000);
    }

    function toggleVoiceRecording() {
      if (voiceRecTimer) { sendVoiceNote(); return; }
      const mic = document.getElementById('micBtn');
      const input = document.getElementById('threadInput');
      voiceSeconds = 0;
      input.value = '';
      input.disabled = true;
      input.placeholder = 'Recording…';
      document.getElementById('recTimer').textContent = '0:00';
      document.getElementById('recTimer').classList.remove('hidden');
      mic.classList.add('recording');
      mic.innerHTML = '<i class="iconoir-check"></i>';
      voiceRecTimer = setInterval(() => {
        voiceSeconds++;
        document.getElementById('recTimer').textContent = '0:' + String(voiceSeconds).padStart(2, '0');
        if (voiceSeconds >= 60) sendVoiceNote();
      }, 1000);
    }

    function sendVoiceNote() {
      if (!voiceRecTimer) return;
      clearInterval(voiceRecTimer);
      voiceRecTimer = null;
      const dur = Math.max(1, voiceSeconds);
      resetVoiceComposer();
      if (!activeChatId) return;
      const chat = supabaseChats.find(c => c.id === activeChatId);
      if (!chat) return;
      const label = '0:' + String(dur).padStart(2, '0');
      
      // Optimistically add message
      const optimisticMsg = { from: 'me', voice: { duration: label }, time: nowTimeLabel(), read: false, id: 'temp-' + Date.now() };
      chat.messages.push(optimisticMsg);
      chat.preview = 'Voice note';
      chat.time = 'Just now';
      renderThread(chat);
      const box = document.getElementById('threadMessages');
      box.scrollTop = box.scrollHeight;
      renderChats(document.getElementById('chatSearch').value);
      
      // Send to Supabase (voice_duration as text for now)
      sendMessageToSupabase(activeChatId, null, null, label).then(success => {
        if (!success) {
          chat.messages = chat.messages.filter(m => m.id !== optimisticMsg.id);
          renderThread(chat);
          showToast('Failed to send voice note');
        }
      });
      
      simulateTyping(chat);
    }

    function resetVoiceComposer() {
      const mic = document.getElementById('micBtn');
      const input = document.getElementById('threadInput');
      mic.classList.remove('recording');
      mic.innerHTML = '<i class="iconoir-microphone"></i>';
      input.disabled = false;
      input.placeholder = 'Message...';
      document.getElementById('recTimer').classList.add('hidden');
      document.getElementById('recTimer').textContent = '0:00';
    }

    function cancelVoiceRecording() {
      if (!voiceRecTimer) return;
      clearInterval(voiceRecTimer);
      voiceRecTimer = null;
      resetVoiceComposer();
    }

    function sendChatFile(input) {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file || !activeChatId) return;
      const chat = supabaseChats.find(c => c.id === activeChatId);
      if (!chat) return;
      const isVideo = file.type.startsWith('video/');
      
      // Show upload progress
      const progressEl = document.createElement('div');
      progressEl.className = 'upload-progress';
      progressEl.innerHTML = '<div class="upload-bar"><div class="upload-fill" style="width:0%"></div></div><span class="upload-text">Uploading...</span>';
      document.body.appendChild(progressEl);
      
      // Upload to Supabase Storage
      uploadPostMediaWithProgress(file, (progress) => {
        const fill = progressEl.querySelector('.upload-fill');
        const text = progressEl.querySelector('.upload-text');
        if (fill) fill.style.width = Math.round(progress * 100) + '%';
        if (text) text.textContent = `Uploading... ${Math.round(progress * 100)}%`;
      }).then(publicUrl => {
        progressEl.remove();
        
        if (!publicUrl) {
          showToast('Failed to upload media');
          return;
        }
        
        // Optimistically add message
        const optimisticMsg = { 
          from: 'me', 
          media: { type: isVideo ? 'video' : 'image', src: publicUrl },
          time: nowTimeLabel(), 
          read: false, 
          id: 'temp-' + Date.now() 
        };
        chat.messages.push(optimisticMsg);
        chat.preview = isVideo ? 'Video' : 'Photo';
        chat.time = 'Just now';
        renderThread(chat);
        const box = document.getElementById('threadMessages');
        box.scrollTop = box.scrollHeight;
        renderChats(document.getElementById('chatSearch').value);
        
        // Send to Supabase
        sendMessageToSupabase(activeChatId, null, { type: isVideo ? 'video' : 'image', url: publicUrl }).then(success => {
          if (!success) {
            chat.messages = chat.messages.filter(m => m.id !== optimisticMsg.id);
            renderThread(chat);
            showToast('Failed to send media');
          }
        });
        
        simulateTyping(chat);
      });
    }

    // ============================================================
    //  REELS RENDER
    // ============================================================
    function reelCard(reel, index, total) {
      const liked = reel.liked || false;
      const reposted = reel.reposted || false;
      const saved = reel.saved || false;
      const following = reel.following || false;
      const meP = ensureMeProfile();
      const isMe = (authUser && reel.user_id && authUser.id === reel.user_id) || (meP && reel.username === meP.name);
      const rProfile = findProfile(reel.username);
      const reelAvatarSrc = reel.avatarImage || reel.avatar || (isMe ? (meP && meP.avatarImage) : (rProfile && (rProfile.avatarImage || rProfile.avatar))) || '';
      const reelAvatarHtml = reelAvatarSrc
        ? `<img src="${reelAvatarSrc}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
        : reel.initials;
      return `<div class="reel" data-reel-id="${reel.id}">
        <video class="reel-video" src="${reel.video}" loop muted playsinline preload="metadata"></video>
        <div class="reel-index">
          ${Array.from({ length: total }, (_, i) => `<span class="${i === index ? 'active' : ''}"></span>`).join('')}
        </div>
        <div class="reel-overlay">
          <div class="reel-info">
            <div class="reel-user-row" onclick="event.stopPropagation();openUserProfile('${reel.username}')">
              <div class="reel-avatar" style="background:${reel.avatarColor};overflow:hidden;display:flex;align-items:center;justify-content:center">${reelAvatarHtml}</div>
              <div class="reel-user-meta">
                <div class="reel-username">
                  ${reel.username}
                  ${reel.verified ? '<i class="iconoir-badge-check verified"></i>' : ''}
                </div>
                <button class="reel-follow ${following ? 'following' : ''}" onclick="event.stopPropagation();toggleFollow(this, '${reel.id}')">
                  ${following ? 'Following' : 'Follow'}
                </button>
              </div>
            </div>
            <div class="reel-desc">${reel.description}</div>
            <div class="reel-tags">${reel.tags}</div>
            ${reel.location ? `<div class="reel-loc"><i class="iconoir-pin"></i>${reel.location}</div>` : ''}
            <div class="reel-music"><i class="iconoir-music-double-note"></i>${reel.music}</div>
          </div>
        </div>

        <div class="reel-rail">
          <button class="reel-action ${liked ? 'liked' : ''}" onclick="toggleReelLike(this, '${reel.id}')">
            <div class="icon-circle"><i class="iconoir-heart"></i></div>
            <span class="count">${reel.likes}</span>
          </button>
          <button class="reel-action" onclick="openComments('${reel.id}')">
            <div class="icon-circle"><i class="iconoir-chat-bubble"></i></div>
            <span class="count">${reel.comments}</span>
          </button>
          <button class="reel-action ${reposted ? 'reposted' : ''}" onclick="toggleReelRepost(this, '${reel.id}')">
            <div class="icon-circle"><i class="iconoir-repeat"></i></div>
            <span class="count">${reel.reposts}</span>
          </button>
          <button class="reel-action" onclick="shareReel('${reel.id}')">
            <div class="icon-circle"><i class="iconoir-share-android"></i></div>
          </button>
          <button class="reel-action ${saved ? 'saved' : ''}" onclick="toggleReelSave(this, '${reel.id}')">
            <div class="icon-circle"><i class="iconoir-bookmark"></i></div>
          </button>
          <button class="reel-action reel-more" onclick="openReelMenu('${reel.id}')">
            <div class="icon-circle"><i class="iconoir-menu"></i></div>
          </button>
        </div>
      </div>`;
    }

    let reelFeed = 'foryou';
    let reelFilter = { type: 'all', value: 'All' };
    const reelFeedFilters = [
      { type: 'topic', value: 'Worship', icon: 'hashtag' },
      { type: 'topic', value: 'Choir', icon: 'hashtag' },
      { type: 'topic', value: 'Faith', icon: 'hashtag' },
      { type: 'topic', value: 'Sermon', icon: 'hashtag' },
      { type: 'topic', value: 'Youth', icon: 'hashtag' },
      { type: 'location', value: 'eBuhleni', icon: 'map-pin' },
      { type: 'location', value: 'Inanda', icon: 'map-pin' },
      { type: 'location', value: 'Durban', icon: 'map-pin' }
    ];

    function setReelFeed(feed) {
      if (reelFeed === feed) return;
      reelFeed = feed;
      document.querySelectorAll('.reels-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.feed === feed);
      });
      renderReels();
    }

    function setReelFilter(type, value) {
      reelFilter = { type, value };
      renderReelChips();
      renderReels();
    }

    function renderReelChips() {
      const box = document.getElementById('reelsChips');
      if (!box) return;
      const allActive = reelFilter.type === 'all';
      box.innerHTML = `<button type="button" class="reels-chip ${allActive ? 'active' : ''}" onclick="setReelFilter('all', 'All')"><i class="iconoir-sparks"></i>All</button>`
        + reelFeedFilters.map(f => `
          <button type="button" class="reels-chip ${reelFilter.type === f.type && reelFilter.value === f.value ? 'active' : ''}"
            onclick="setReelFilter('${f.type}', '${f.value}')"><i class="${getIconoirClass(f.icon)}"></i>${f.value}</button>`).join('');
    }

    function reelFeedList() {
      let list = reels.slice();
      if (reelFeed === 'following') list = list.filter(r => r.following);
      if (reelFilter.type === 'topic') {
        const want = reelFilter.value.toLowerCase();
        list = list.filter(r => r.tags.toLowerCase().includes(want));
      } else if (reelFilter.type === 'location') {
        const want = reelFilter.value.toLowerCase();
        list = list.filter(r => (r.location || '').toLowerCase() === want);
      }
      return list;
    }

    function emptyReelsHtml() {
      if (reelFeed === 'following') {
        const label = reelFilter.type === 'all' ? '' : ` in ${reelFilter.value}`;
        return `<div class="reels-empty">
          <b>No reels${label} yet</b>
          <span>Follow more amaNazaretha members to see their reels in this feed.</span>
          <button onclick="setReelFeed('foryou')">Discover reels</button>
        </div>`;
      }
      return `<div class="reels-empty">
        <b>No reels in ${reelFilter.value} yet</b>
        <span>Try another interest topic or a nearby community feed.</span>
        <button onclick="setReelFilter('all', 'All')">Show all reels</button>
      </div>`;
    }

    function renderReels() {
      const feed = document.getElementById('reelsFeed');
      if (!feed) return;
      const list = reelFeedList();
      feed.scrollTop = 0;
      feed.innerHTML = list.length
        ? list.map((r, i) => reelCard(r, i, list.length)).join('')
        : emptyReelsHtml();
      attachReelObserver();
      if (list.length && document.body.classList.contains('reels-active')) {
        const firstVideo = feed.querySelector('.reel-video');
        if (firstVideo) firstVideo.play().catch(() => {});
      }
    }

    let reelObserver = null;
    function attachReelObserver() {
      if (reelObserver) reelObserver.disconnect();
      reelObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const video = entry.target.querySelector('.reel-video');
          if (!video) return;
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      }, { threshold: 0.6 });
      document.querySelectorAll('#reelsFeed .reel').forEach(reel => reelObserver.observe(reel));
    }

    // ============================================================
    //  NAVIGATION
    // ============================================================
    const pages = ['home', 'events', 'search', 'messages', 'notifications', 'profile'];
    const pageTitles = {
      home: 'Home',
      events: 'Events',
      reels: 'Reels',
      search: 'Search',
      messages: 'Messages',
      notifications: 'Notifications',
      profile: 'Profile'
    };
    let searchTab = 'all';
    function setSearchTab(tab) {
      searchTab = tab;
      document.querySelectorAll('.search-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
      });
      runSearch();
    }
    function runSearch() {
      const q = (document.getElementById('globalSearch')?.value || '').trim().toLowerCase();
      const box = document.getElementById('searchResults');
      if (!box) return;
      if (!q) {
        box.innerHTML = '<div class="search-empty">Search amaNazaretha members, posts, photos, and reels</div>';
        return;
      }
      const userPool = profiles.filter(p => !p.me).map(p => ({ name: p.name, sub: 'Member', icon: 'user' }));
      const postHits = posts.filter(p =>
        (p.title + ' ' + p.text + ' ' + p.tags).toLowerCase().includes(q)
      );
      const reelHits = reels.filter(r =>
        (r.username + ' ' + r.description + ' ' + r.tags).toLowerCase().includes(q)
      );
      const userHits = userPool.filter(u => u.name.toLowerCase().includes(q));
      const photoHits = postHits.concat(reelHits.map(r => ({
        id: 'reel-' + r.id, icon: 'clapperboard', title: r.username, text: r.description, tags: r.tags, time: 'Reel'
      })));

      const want = searchTab;
      let html = '';
      const showUsers = want === 'all' || want === 'users';
      const showPosts = want === 'all' || want === 'posts';
      const showPhotos = want === 'all' || want === 'photos';
      const showReels = want === 'all' || want === 'reels';

      if (showUsers && userHits.length) {
        html += '<div class="search-section-label">Users</div>';
        html += userHits.slice(0, 8).map(u => `
          <button class="search-result" onclick="openUserProfile('${u.name}')">
            <div class="sr-avatar"><i class="${getIconoirClass(u.icon)}"></i></div>
            <div class="sr-meta"><b>${u.name}</b><span>${u.sub}</span></div>
            <span class="sr-tag">User</span>
          </button>`).join('');
      }
      if (showPosts && postHits.length) {
        html += '<div class="search-section-label">Posts</div>';
        html += postHits.map(p => `
          <button class="search-result" onclick="openDetail(${p.id})">
            <div class="sr-avatar sq"><i class="iconoir-chat-bubble-empty"></i></div>
            <div class="sr-meta"><b>${p.title}</b><span>${p.text}</span></div>
            <span class="sr-tag">Post</span>
          </button>`).join('');
      }
      if (showPhotos && photoHits.length) {
        html += '<div class="search-section-label">Photos</div>';
        html += '<div class="search-grid">' + photoHits.slice(0, 9).map(p => `
          <button class="tile" onclick="${typeof p.id === 'number' ? `openDetail(${p.id})` : `showToast('Photo')`}">
            <i class="iconoir-media-image"></i>
          </button>`).join('') + '</div>';
      }
      if (showReels && reelHits.length) {
        html += '<div class="search-section-label">Reels</div>';
        html += reelHits.map(r => `
          <button class="search-result" onclick="go('reels')">
            <div class="sr-avatar sq"><i class="iconoir-media-video"></i></div>
            <div class="sr-meta"><b>${r.username}</b><span>${r.description}</span></div>
            <span class="sr-tag">Reel</span>
          </button>`).join('');
      }
      if (!html) html = '<div class="search-empty">No results for “' + q + '”</div>';
      box.innerHTML = html;
    }
    let currentPage = 'home';
    function go(page) {
      const fileMap = {
        home: 'home.html',
        events: 'events.html',
        reels: 'reels.html',
        messages: 'messages.html',
        notifications: 'notifications.html',
        search: 'search.html',
        profile: 'profile.html',
        login: 'login.html'
      };

      const targetSection = document.getElementById(page);
      if (targetSection) {
        if (page !== 'notifications') currentPage = page;
        const titleEl = document.getElementById('toolbarTitle');
        if (titleEl) titleEl.textContent = pageTitles[page] || 'Home';
        document.body.classList.toggle('search-active', page === 'search');
        document.body.classList.toggle('notif-active', page === 'notifications');
        document.body.classList.toggle('messages-active', page === 'messages');
        document.body.classList.toggle('profile-active', page === 'profile');
        document.body.classList.toggle('home-active', page === 'home');
        if (page === 'reels') {
          document.body.classList.add('reels-active');
          const rEl = document.getElementById('reels');
          if (rEl) rEl.classList.remove('hidden');
          pages.forEach(p => { const el = document.getElementById(p); if (el) el.classList.add('hidden'); });
          renderReels();
        } else {
          document.body.classList.remove('reels-active');
          const rEl = document.getElementById('reels');
          if (rEl) rEl.classList.add('hidden');
          closeThread();
          pages.forEach(p => { const el = document.getElementById(p); if (el) el.classList.toggle('hidden', p !== page); });
          if (page === 'home') renderFeed();
          if (page === 'events') renderEvents();
          if (page === 'profile') { renderMyProfile(); renderProfileGrid(); }
          if (page === 'messages') { const cs = document.getElementById('chatSearch'); renderChats(cs ? cs.value : ''); }
          if (page === 'search') { runSearch(); setTimeout(() => { const gs = document.getElementById('globalSearch'); if (gs) gs.focus(); }, 120); }
        }
        const notifP = document.getElementById('notifPanel');
        if (notifP) notifP.classList.toggle('open', page === 'notifications');
      } else if (fileMap[page]) {
        window.location.href = fileMap[page];
        return;
      }
      document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.page === page);
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (page === 'reels') {
        setTimeout(() => {
          const firstVideo = document.querySelector('#reelsFeed .reel-video');
          if (firstVideo) firstVideo.play().catch(() => {});
        }, 120);
      }
    }

    // ============================================================
    //  PROFILE TABS
    // ============================================================
    let profileTab = 'posts';
    let upTab = 'posts';
    const likedPostIds = new Set();
    const savedPostIds = new Set();
    const repostedPostIds = new Set();

    function saveEngagementState() {}

    async function loadEngagementState() {
      likedPostIds.clear();
      savedPostIds.clear();
      repostedPostIds.clear();
      
      if (!supabaseClient || !authUser) return;

      try {
        const [likesRes, savedRes, repostsRes] = await Promise.all([
          supabaseClient.from('post_likes').select('post_id').eq('user_id', authUser.id),
          supabaseClient.from('saved_posts').select('post_id').eq('user_id', authUser.id),
          supabaseClient.from('post_reposts').select('post_id').eq('user_id', authUser.id)
        ]);

        if (!likesRes.error && likesRes.data) {
          likesRes.data.forEach(d => likedPostIds.add(Number(d.post_id)));
        }
        if (!savedRes.error && savedRes.data) {
          savedRes.data.forEach(d => savedPostIds.add(Number(d.post_id)));
        }
        if (!repostsRes.error && repostsRes.data) {
          repostsRes.data.forEach(d => repostedPostIds.add(Number(d.post_id)));
        }

        renderFeed();
      } catch (err) {
        console.warn('Engagement load notice:', err);
      }
    }

    function applyTab(tab, tabs) {
      tabs.forEach(b => {
        const on = b.dataset.ptab === tab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    function setProfileTab(tab) {
      profileTab = tab;
      applyTab(tab, document.querySelectorAll('#profile .profile-tab'));
      renderProfileGrid();
    }

    function setUpTab(tab) {
      upTab = tab;
      applyTab(tab, document.querySelectorAll('#userProfile .profile-tab'));
      renderUpGrid();
    }

    function postCell(p) {
      const media = p.image
        ? `<img src="${p.image}" alt="">`
        : p.video
        ? `<video src="${p.video}" muted playsinline preload="metadata"></video>`
        : `<i class="iconoir-chat-bubble-empty"></i>`;
      return `<button class="profile-cell" onclick="openDetail(${p.id})" aria-label="${p.title || 'Post'}">
        ${media}
        <span class="pc-badge"><i class="iconoir-heart"></i>${p.likes}</span>
      </button>`;
    }

    function reelCell(r) {
      return `<button class="profile-cell" onclick="go('reels')" aria-label="Reel by ${r.username}">
        <video src="${r.video}" muted playsinline preload="metadata"></video>
        <span class="pc-badge"><i class="iconoir-play"></i>${r.likes}</span>
      </button>`;
    }

    function gridHtml(tab, forProfile) {
      if (tab === 'posts') {
        let myPosts;
        if (forProfile) {
          // Other user's profile - filter by their user_id
          myPosts = posts.filter(p => p.userId === forProfile.user_id);
        } else {
          // Own profile
          myPosts = authUser ? posts.filter(p => p.userId === authUser.id) : posts.filter(p => p.isMe);
        }
        return myPosts.map(postCell).join('');
      }
            if (tab === 'videos') {
        let myPosts;
        if (forProfile) {
          const targetUid = forProfile.user_id || forProfile.id;
          const targetName = forProfile.name;
          myPosts = posts.filter(p => ((targetUid && p.userId === targetUid) || (targetName && p.author === targetName)) && p.video);
        } else {
          myPosts = posts.filter(p => (p.isMe || (authUser && p.userId === authUser.id)) && p.video);
        }
        const userReels = reels.filter(r => r.isMe || (authUser && r.user_id === authUser.id) || (forProfile && r.username === forProfile.name));
        const allVids = [...userReels.map(reelCell), ...myPosts.map(postCell)];
        return allVids.length ? allVids.join('') : '<div class="profile-empty">No videos uploaded yet.</div>';
      }
      if (tab === 'liked') {
        return posts.filter(p => likedPostIds.has(p.id)).map(postCell).join('')
          || '<div class="profile-empty">Posts you like will show up here.</div>';
      }
      return posts.filter(p => savedPostIds.has(p.id)).map(postCell).join('')
        || '<div class="profile-empty">Saved posts will show up here.</div>';
    }

    function renderProfileGrid() {
      const box = document.getElementById('profileGrid');
      if (!box) return;
      const me = ensureMeProfile();
      box.innerHTML = gridHtml(profileTab, me);
    }

    function renderUpGrid() {
      const box = document.getElementById('upGrid');
      if (!box) return;
      const p = activeProfileName ? findProfile(activeProfileName) : null;
      box.innerHTML = gridHtml(upTab, p);
    }

    function compactCount(n) {
      if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
      return String(n);
    }

    function renderMyProfile() {
      const me = ensureMeProfile();
      if (!me) return;
      const av = document.getElementById('myAvatar');
      if (av) {
        const localUser = readLocalUser();
        const avatarSrc = me.avatarImage || (localUser && localUser.avatar);
        if (avatarSrc) {
          av.style.backgroundImage = `url("${avatarSrc}")`;
          av.style.backgroundColor = 'transparent';
          av.innerHTML = `<img src="${avatarSrc}" alt="${me.name || 'Profile'}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">`;
        } else {
          av.style.backgroundImage = '';
          av.style.backgroundColor = me.avatarColor || '#0c0c0c';
          av.textContent = me.initials || 'A';
        }
      }
      // Cover banner removed
      const nameEl = document.getElementById('myName');
      if (nameEl) nameEl.innerHTML = me.name + (me.verified ? ' <i class="iconoir-badge-check"></i>' : '');
      const roleEl = document.getElementById('myRole');
      if (roleEl) roleEl.textContent = me.temple || 'eBuhleni';
      const bioEl = document.getElementById('myBio');
      if (bioEl) bioEl.textContent = me.bio;
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      const ownPosts = authUser ? posts.filter(p => p.userId === authUser.id).length : posts.filter(p => p.isMe).length;
      set('myPosts', ownPosts);
      set('myFollowers', compactCount(me.followers || 0));
      set('myFollowing', compactCount(me.followingCount || 0));
    }

    let editAvatarData = '';
    
    function openEditProfile() {
      const me = ensureMeProfile();
      if (!me) return;
      document.getElementById('editName').value = me.name || '';
      document.getElementById('editBio').value = me.bio || '';
      editAvatarData = me.avatarImage || '';
      // cover data removed
      const avThumb = document.getElementById('editAvatarThumb');
      if (avThumb) {
        const localUser = readLocalUser();
        const avatarSrc = me.avatarImage || (localUser && localUser.avatar);
        if (avatarSrc) {
          avThumb.style.backgroundImage = `url("${avatarSrc}")`;
          avThumb.innerHTML = `<img src="${avatarSrc}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">`;
        } else {
          avThumb.style.backgroundImage = '';
          avThumb.innerHTML = '<i class="iconoir-camera" style="width:20px;height:20px"></i>';
        }
      }
      // Cover thumb removed
      document.getElementById('editProfileOverlay').classList.add('open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => document.getElementById('editName').focus(), 250);
    }

    function closeEditProfile() {
      document.getElementById('editProfileOverlay').classList.remove('open');
      document.body.style.overflow = '';
    }

    function previewEditPhoto(type, input) {
      if (!input || !input.files || !input.files[0]) return;
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = function(e) {
        const dataUrl = e.target.result;
        editAvatarData = dataUrl;
        const avThumb = document.getElementById('editAvatarThumb');
        if (avThumb) {
          avThumb.style.backgroundImage = `url("${dataUrl}")`;
          avThumb.innerHTML = `<img src="${dataUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">`;
        }
      };
      reader.readAsDataURL(file);
    }

    function handleProfilePhotoChange(type, input) {
      if (!input || !input.files || !input.files[0]) return;
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = function(e) {
        const dataUrl = e.target.result;
        const me = ensureMeProfile();
        const local = readLocalUser() || {};
        const oldName = me.name;
        me.avatarImage = dataUrl;
        local.avatar = dataUrl;
        posts.forEach(p => {
          if (p.isMe || (authUser && p.userId === authUser.id) || p.author === oldName || p.author === 'Member' || !p.author) {
            p.authorAvatar = dataUrl;
          }
        });
        renderFeed();
        showToast('Profile photo updated');
        // Profile photo updated in Supabase
        renderMyProfile();
        if (supabaseClient) {
          uploadPostMedia(file).then(url => {
            if (url) {
              const uid = me.user_id || (authUser && authUser.id);
              if (uid) {
                supabaseClient.from('profiles').update({ avatarImage: url }).eq('user_id', uid)
                  .then(({ error }) => { if (error) showToast('Failed to update profile image'); });
                supabaseClient.from('posts').update({ author_avatar: url }).eq('user_id', uid)
                  .then(({ error }) => { if (error) console.warn('Failed to update post avatars:', error.message); });
              }
            }
          });
        }
      };
      reader.readAsDataURL(file);
    }

    async function saveProfile() {
      const me = ensureMeProfile();
      if (!me) return;
      const name = document.getElementById('editName').value.trim();
      if (!name) { showToast('Name cannot be empty'); return; }
      const oldName = me.name;
      me.name = name;
      me.first = name.split(' ')[0] || name;
      me.surname = name.split(' ').slice(1).join(' ') || '';
      me.initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      me.bio = document.getElementById('editBio').value.trim() || me.bio;
      if (editAvatarData) me.avatarImage = editAvatarData;
      // cover data removed

      // Update local storage user
      const local = readLocalUser() || {};
      local.name = me.name;
      local.first = me.first;
      local.surname = me.surname;
      local.bio = me.bio;
      if (me.avatarImage) local.avatar = me.avatarImage;
      // local cover removed
      // Profile details updated in Supabase

      // Reflect updated name and avatar across all posts by this user
      posts.forEach(p => {
        if (p.isMe || (authUser && p.userId === authUser.id) || p.author === oldName || p.author === 'Member' || !p.author) {
          p.author = me.name;
          p.authorInitials = me.initials;
          if (me.avatarImage) p.authorAvatar = me.avatarImage;
        }
      });

      renderMyProfile();
      renderFeed();
      renderProfileGrid();
      closeEditProfile();
      showToast('Profile updated');

      // Persist to Supabase
      if (supabaseClient) {
        const patch = {
          name: me.name,
          first: me.first,
          surname: me.surname,
          initials: me.initials,
          bio: me.bio
        };
        if (me.avatarImage) patch.avatarImage = me.avatarImage;
        // patch cover removed
        const uid = me.user_id || (authUser && authUser.id);
        if (uid) {
          supabaseClient.from('profiles').update(patch).eq('user_id', uid)
            .then(({ error }) => { if (error) showToast('Failed to update profile on server'); });
          supabaseClient.from('posts').update({
            author_name: me.name,
            author_initials: me.initials,
            author_avatar: me.avatarImage || null
          }).eq('user_id', uid)
            .then(({ error }) => { if (error) console.warn('Failed to update post authors:', error.message); });
        }
      }
    }

    function shareProfile() {
      const p = (activeProfileName && findProfile(activeProfileName)) || profiles.find(x => x.me);
      if (!p) return;
      const ok = p.me ? 'Profile link copied' : `${p.name}'s profile link copied`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(location.href).then(() => showToast(ok)).catch(() => showToast(`Sharing ${p.name}'s profile`));
      } else {
        showToast(`Sharing ${p.name}'s profile`);
      }
    }

    // ============================================================
    //  EVENTS
    // ============================================================
    let activeEventId = null;

    function renderEvents() {
      const box = document.getElementById('eventsList');
      if (!box) return;
      if (!eventsData.length) {
        box.innerHTML = '<div style="text-align:center;color:var(--muted);padding:64px 20px;font-size:13px">No upcoming events yet. Check back soon for services and gatherings.</div>';
        return;
      }
      box.innerHTML = eventsData.map(ev => `
        <div class="event" role="button" tabindex="0" onclick="openEvent('${ev.id}')"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openEvent('${ev.id}')}">
          <div class="event-date"><div><b>${ev.day}</b><span>${ev.month}</span></div></div>
          <div class="event-main">
            <h4>${ev.title}</h4>
            <p>${ev.time.slice(0, 5)} • ${ev.venue}</p>
          </div>
          <button class="event-remind${ev.reminded ? ' on' : ''}" onclick="event.stopPropagation();toggleEventRemind('${ev.id}')">${ev.reminded ? 'Reminded' : 'Remind'}</button>
        </div>`).join('');
    }

    function openEvent(id) {
      const ev = eventsData.find(e => e.id === id);
      if (!ev) return;
      activeEventId = ev.id;
      const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.textContent = val; };
      document.getElementById('evHero').style.background = ev.cover;
      set('evDay', ev.day);
      set('evMonth', ev.month);
      set('evKicker', `${ev.type} · ${ev.temple}`);
      set('evTitle', ev.title);
      set('evWhen', `${ev.dateLabel} · ${ev.time}`);
      set('evDate', ev.dateLabel);
      set('evTime', ev.time);
      set('evVenue', `${ev.venue} · ${ev.temple}`);
      set('evHost', ev.host);
      set('evDesc', ev.description);
      set('evCount', `${ev.attending.toLocaleString()} going`);
      const avatars = document.getElementById('evGoingAvatars');
      if (avatars) {
        avatars.innerHTML = profiles.filter(p => !p.me).slice(0, 4)
          .map(p => `<span style="background:${p.avatarColor}">${p.initials}</span>`).join('');
      }
      syncEventRemind();
      document.getElementById('evScroll').scrollTop = 0;
      document.getElementById('eventView').classList.add('open');
      document.getElementById('eventView').setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeEvent() {
      document.getElementById('eventView').classList.remove('open');
      document.getElementById('eventView').setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      activeEventId = null;
    }

    function syncEventRemind() {
      const ev = eventsData.find(e => e.id === activeEventId);
      const btn = document.getElementById('evRemindBtn');
      if (!ev || !btn) return;
      btn.textContent = ev.reminded ? 'Reminder set' : 'Remind me';
      btn.classList.toggle('on', ev.reminded);
    }

    function toggleEventRemind(id) {
      const ev = eventsData.find(e => e.id === (id || activeEventId));
      if (!ev) return;
      ev.reminded = !ev.reminded;
      ev.attending = Math.max(0, (ev.attending || 0) + (ev.reminded ? 1 : -1));
      showToast(ev.reminded ? `Reminder set for ${ev.title}` : 'Reminder removed');
      renderEvents();
      if (activeEventId === ev.id) syncEventRemind();

      if (supabaseClient && authUser) {
        if (ev.reminded) {
          supabaseClient.from('event_attendees').upsert([{
            event_id: ev.id,
            user_id: authUser.id,
            status: 'attending',
            created_at: new Date().toISOString()
          }]).then();
        } else {
          supabaseClient.from('event_attendees').delete()
            .eq('event_id', ev.id)
            .eq('user_id', authUser.id)
            .then();
        }
        supabaseClient.from('events').update({ attending: ev.attending }).eq('id', ev.id).then();
      }
    }

    function openEventComposer() {
      showToast('Event scheduling will be available soon');
    }

    function shareEventLink() {
      const ev = eventsData.find(e => e.id === activeEventId);
      if (!ev) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(location.href).then(() => showToast('Event link copied')).catch(() => showToast(`Sharing ${ev.title}`));
      } else {
        showToast(`Sharing ${ev.title}`);
      }
    }

    // ============================================================
    //  USER PROFILES
    // ============================================================
    let activeProfileName = null;
    let profilePrevOverflow = '';

    function findProfile(name) {
      const q = String(name || '').toLowerCase().trim();
      return profiles.find(p => p.name.toLowerCase() === q)
        || profiles.find(p => p.name.toLowerCase().startsWith(q + ' '))
        || profiles.find(p => p.name.toLowerCase().split(' ')[0] === q);
    }

    function openUserProfile(name) {
      const p = findProfile(name);
      if (!p) { showToast('Profile not found'); return; }
      if (p.me) { go('profile'); return; }
      activeProfileName = p.name;
      document.getElementById('upBanner').style.background = 'transparent';
      const av = document.getElementById('upAvatar');
      const avatarSrc = p.avatarImage || p.avatar;
      if (avatarSrc) {
        av.style.backgroundImage = `url("${avatarSrc}")`;
        av.style.backgroundColor = 'transparent';
        av.innerHTML = `<img src="${avatarSrc}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">`;
      } else {
        av.style.backgroundImage = '';
        av.style.backgroundColor = p.avatarColor || '#0c0c0c';
        av.textContent = p.initials || 'A';
      }
      document.getElementById('upName').innerHTML = p.name + (p.verified ? ' <i class="iconoir-badge-check"></i>' : '');
      document.getElementById('upBio').textContent = p.bio;
      renderProfileStats(p);
      syncProfileFollowBtn(p);
      upTab = 'posts';
      applyTab('posts', document.querySelectorAll('#userProfile .profile-tab'));
      renderUpGrid();
      profilePrevOverflow = document.body.style.overflow;
      document.getElementById('userProfile').classList.add('open');
      document.getElementById('userProfile').scrollTop = 0;
      document.body.style.overflow = 'hidden';
    }

    function closeUserProfile() {
      closeProfileMenu();
      document.getElementById('userProfile').classList.remove('open');
      activeProfileName = null;
      document.body.style.overflow = profilePrevOverflow;
    }

    function renderProfileStats(p) {
      document.getElementById('upFollowers').textContent = p.followers.toLocaleString();
      document.getElementById('upFollowing').textContent = p.followingCount.toLocaleString();
    }

    function syncProfileFollowBtn(p) {
      const btn = document.getElementById('upFollowBtn');
      btn.classList.toggle('following', p.following);
      btn.textContent = p.following ? 'Following' : 'Follow';
    }

    function toggleProfileFollow() {
      const p = profiles.find(x => x.name === activeProfileName);
      if (!p) return;
      p.following = !p.following;
      p.followers = (p.followers || 0) + (p.following ? 1 : -1);
      renderProfileStats(p);
      syncProfileFollowBtn(p);
      const reel = reels.find(r => r.username === p.name);
      if (reel) {
        reel.following = p.following;
        document.querySelectorAll(`.reel[data-reel-id="${reel.id}"] .reel-follow`).forEach(b => {
          b.classList.toggle('following', reel.following);
          b.textContent = reel.following ? 'Following' : 'Follow';
        });
      }
      document.querySelectorAll(`.pc-follow[data-name="${p.name}"]`).forEach(b => {
        b.classList.toggle('following', p.following);
        b.textContent = p.following ? 'Following' : 'Follow';
      });
      showToast(p.following ? `Following ${p.name}` : `Unfollowed ${p.name}`);
      handleFollowAction(p, p.following);
    }

     async function messageProfile() {
      const p = profiles.find(x => x.name === activeProfileName);
      if (!p || !p.user_id) return;
      
      const chatId = await createChatWithUser(p.user_id);
      if (chatId) {
        closeUserProfile();
        openThread(chatId);
      }
    }

    // ============================================================
    //  PROFILE OPTIONS MENU
    // ============================================================
    let selectedReportReason = '';

    function toggleProfileMenu(e) {
      if (e) e.stopPropagation();
      const dd = document.getElementById('upMenuDropdown');
      const btn = document.getElementById('upMenuBtn');
      if (!dd || !btn) return;
      const open = !dd.classList.contains('open');
      dd.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      
    }

    function closeProfileMenu() {
      const dd = document.getElementById('upMenuDropdown');
      const btn = document.getElementById('upMenuBtn');
      if (dd) dd.classList.remove('open');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    function profileMenuAction(action) {
      const p = profiles.find(x => x.name === activeProfileName);
      closeProfileMenu();
      if (!p) return;
      if (action === 'about') openAboutProfile();
      if (action === 'block') {
        document.getElementById('blockTitle').textContent = `Block ${p.name}?`;
        document.getElementById('blockSub').textContent = `${p.first || p.name} won't be able to message you, follow you or find your profile.`;
        document.getElementById('blockProfileOverlay').classList.add('open');
      }
      if (action === 'report') {
        document.getElementById('reportTitle').textContent = `Report ${p.name}`;
        selectedReportReason = '';
        document.querySelectorAll('#reportReasons .report-reason').forEach(b => b.classList.remove('on'));
        document.getElementById('reportProfileOverlay').classList.add('open');
      }
    }

    function openAboutProfile() {
      const p = profiles.find(x => x.name === activeProfileName);
      if (!p) return;
      const av = document.getElementById('aboutAvatar');
      const avatarSrc = p.avatarImage || p.avatar;
      if (avatarSrc) {
        av.style.background = 'transparent';
        av.innerHTML = `<img src="${avatarSrc}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">`;
      } else {
        av.style.background = p.avatarColor || '#0c0c0c';
        av.textContent = p.initials;
      }
      document.getElementById('aboutName').innerHTML = p.name + (p.verified ? ' <i class="iconoir-badge-check"></i>' : '');
      document.getElementById('aboutRole').textContent = p.temple || 'eBuhleni';
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('aboutFullName', `${p.first || ''} ${p.surname || ''}`.trim() || p.name);
      set('aboutAge', `${p.age} years`);
      set('aboutGender', p.gender);
      set('aboutTemple', p.temple || 'eBuhleni');
      set('aboutJoined', p.joined);
      set('aboutLocation', p.location);
      set('aboutBio', p.bio);
      set('aboutFollowers', compactCount(p.followers));
      set('aboutFollowing', compactCount(p.followingCount));
      document.getElementById('aboutProfileOverlay').classList.add('open');
    }

    function closeAboutProfile() {
      document.getElementById('aboutProfileOverlay').classList.remove('open');
    }

    function closeBlockProfile() {
      document.getElementById('blockProfileOverlay').classList.remove('open');
    }

    function confirmBlockProfile() {
      const p = profiles.find(x => x.name === activeProfileName);
      closeBlockProfile();
      if (!p) return;
      p.blocked = true;
      showToast(`${p.name} blocked`);
      closeUserProfile();
    }

    function pickReportReason(btn) {
      document.querySelectorAll('#reportReasons .report-reason').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      selectedReportReason = btn.textContent.trim();
    }

    function closeReportProfile() {
      document.getElementById('reportProfileOverlay').classList.remove('open');
    }

    function submitProfileReport() {
      if (!selectedReportReason) { showToast('Choose a reason'); return; }
      closeReportProfile();
      showToast('Report submitted');
    }

    function openActiveChatProfile() {
      const chat = chats.find(c => c.id === activeChatId);
      if (chat) openUserProfile(chat.name);
    }

    function openInsight() {
      const p = profiles.find(x => x.me);
      if (!p) return;
      document.getElementById('insightName').textContent = p.name;
      document.getElementById('insightViews').textContent = Math.round(p.followers * 3.6).toLocaleString();
      document.getElementById('insightReach').textContent = Math.round(p.followers * 6.4).toLocaleString();
      document.getElementById('insightEngagement').textContent = (6 + (p.followers % 25) / 10).toFixed(1) + '%';
      document.getElementById('insightOverlay').classList.add('open');
    }

    function closeInsight() {
      document.getElementById('insightOverlay').classList.remove('open');
    }

    // ============================================================
    //  CREATE GROUP CHAT
    // ============================================================
    let groupType = 'private';
    let groupSelected = new Set();

    function openCreateGroup() {
      groupType = 'private';
      groupSelected.clear();
      document.getElementById('cgSearch').value = '';
      syncGroupTypes();
      renderGroupMembers();
      document.getElementById('createGroup').classList.add('open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => document.getElementById('cgSearch').focus(), 120);
    }

    function closeCreateGroup() {
      document.getElementById('createGroup').classList.remove('open');
      document.body.style.overflow = '';
    }

    function setGroupType(type) {
      groupType = type;
      syncGroupTypes();
    }

    function syncGroupTypes() {
      document.querySelectorAll('.cg-type').forEach(b => {
        b.classList.toggle('active', b.dataset.type === groupType);
      });
    }

    function toggleGroupMember(name) {
      if (groupSelected.has(name)) groupSelected.delete(name);
      else groupSelected.add(name);
      renderGroupMembers();
    }

    function renderGroupMembers() {
      const q = (document.getElementById('cgSearch').value || '').trim().toLowerCase();
      const list = profiles.filter(p => !p.me && (!q || p.name.toLowerCase().includes(q)));
      const box = document.getElementById('cgUsers');
      if (!list.length) {
        box.innerHTML = '<div class="cg-empty">No people found</div>';
        updateCreateGroupBtn();
        return;
      }
      box.innerHTML = list.map(p => `
        <button type="button" class="cg-user ${groupSelected.has(p.name) ? 'selected' : ''}" onclick="toggleGroupMember('${p.name}')">
          <div class="cg-user-avatar" style="background:${p.avatarColor}">${p.initials}</div>
          <div class="cg-user-meta"><b>${p.name}</b><span>${p.followers.toLocaleString()} followers</span></div>
          <span class="cg-user-check"><i class="iconoir-check"></i></span>
        </button>
      `).join('');
      updateCreateGroupBtn();
    }

    function updateCreateGroupBtn() {
      document.getElementById('cgCreateBtn').disabled = groupSelected.size === 0;
    }

    async function createGroupChat() {
      const members = profiles.filter(p => groupSelected.has(p.name));
      if (!members.length) return;
      const firstNames = members.map(p => p.name.split(' ')[0]);
      const title = firstNames.length <= 2
        ? firstNames.join(' & ')
        : `${firstNames[0]}, ${firstNames[1]} & ${firstNames.length - 2} others`;
      
      if (!supabaseClient || !authUser) {
        showToast('Cannot create group - not connected');
        return;
      }
      
      // Create group chat in Supabase
      const { data: chat, error } = await supabaseClient
        .from('chats')
        .insert([{ 
          is_group: true,
          name: title,
          created_at: new Date().toISOString()
        }])
        .select('id')
        .single();
      
      if (error || !chat) {
        showToast('Failed to create group');
        return;
      }
      
      // Add all members as participants
      const participants = [{ chat_id: chat.id, user_id: authUser.id }];
      members.forEach(m => {
        if (m.user_id) participants.push({ chat_id: chat.id, user_id: m.user_id });
      });
      
      await supabaseClient.from('chat_participants').insert(participants);
      
      closeCreateGroup();
      // Reload chats to get the new group
      await loadChatsFromSupabase();
      openThread(chat.id);
      showToast(groupType === 'private' ? 'Private group created' : 'Public community created');
    }

    // ============================================================
    //  REEL ACTIONS
    // ============================================================
    function toggleFollow(btn, reelId) {
      const reel = reels.find(r => r.id === reelId);
      if (!reel) return;
      reel.following = !reel.following;
      btn.classList.toggle('following', reel.following);
      btn.textContent = reel.following ? 'Following' : 'Follow';
      const profile = profiles.find(p => p.name === reel.username);
      if (profile) {
        profile.following = reel.following;
        profile.followers = (profile.followers || 0) + (reel.following ? 1 : -1);
        document.querySelectorAll(`.pc-follow[data-name="${profile.name}"]`).forEach(b => {
          b.classList.toggle('following', profile.following);
          b.textContent = profile.following ? 'Following' : 'Follow';
        });
        if (activeProfileName === profile.name) {
          syncProfileFollowBtn(profile);
          renderProfileStats(profile);
        }
        handleFollowAction(profile, reel.following);
      }
      showToast(reel.following ? `Following ${reel.username}` : `Unfollowed ${reel.username}`);
    }

    function toggleReelLike(btn, reelId) {
      const reel = reels.find(r => r.id === reelId);
      if (!reel) return;
      reel.liked = !reel.liked;
      btn.classList.toggle('liked', reel.liked);
      const countEl = btn.querySelector('.count');
      reel.likes += reel.liked ? 1 : -1;
      countEl.textContent = reel.likes;
      const rlIcon = btn.querySelector('svg, i');
      if (rlIcon) {
        if (rlIcon.tagName === 'SVG') rlIcon.style.fill = reel.liked ? '#ff5c7a' : 'none';
        rlIcon.classList.toggle('iconoir-heart-solid', reel.liked);
        rlIcon.classList.toggle('iconoir-heart', !reel.liked);
      }
    }

    function toggleReelRepost(btn, reelId) {
      const reel = reels.find(r => r.id === reelId);
      if (!reel) return;
      reel.reposted = !reel.reposted;
      btn.classList.toggle('reposted', reel.reposted);
      const countEl = btn.querySelector('.count');
      reel.reposts += reel.reposted ? 1 : -1;
      countEl.textContent = reel.reposts;
      const rrIcon = btn.querySelector('svg'); if (rrIcon) rrIcon.style.fill = reel.reposted ? '#22c55e' : 'none';
      showToast(reel.reposted ? 'Reposted' : 'Repost removed');
    }

    function toggleReelSave(btn, reelId) {
      const reel = reels.find(r => r.id === reelId);
      if (!reel) return;
      reel.saved = !reel.saved;
      btn.classList.toggle('saved', reel.saved);
      const rsIcon = btn.querySelector('svg, i');
      if (rsIcon) {
        if (rsIcon.tagName === 'SVG') rsIcon.style.fill = reel.saved ? '#f0c75e' : 'none';
        rsIcon.classList.toggle('iconoir-bookmark-solid', reel.saved);
        rsIcon.classList.toggle('iconoir-bookmark', !reel.saved);
      }
      showToast(reel.saved ? 'Reel saved' : 'Removed from saved');
    }

    // ============================================================
    //  COMMENTS SHEET
    // ============================================================
    let currentReelId = null;
    let currentPostId = null;

    function openComments(reelId) {
      currentReelId = reelId;
      currentPostId = null;
      const reel = reels.find(r => r.id === reelId);
      if (!reel) return;
      document.getElementById('commentsTitle').textContent = `Comments (${reel.comments})`;
      renderComments(reelId);
      document.getElementById('commentsSheet').classList.add('open');
      document.getElementById('sheetBackdrop').classList.add('show');
      document.body.style.overflow = 'hidden';
      document.getElementById('commentInput').value = '';
      setTimeout(() => document.getElementById('commentInput').focus(), 350);
    }

    function openPostComments(postId) {
      const post = posts.find(x => x.id === postId);
      if (!post) return;
      currentPostId = postId;
      currentReelId = null;
      document.getElementById('commentsTitle').textContent = `Comments (${post.comments})`;
      renderComments(postId);
      document.getElementById('commentsSheet').classList.add('open');
      document.getElementById('sheetBackdrop').classList.add('show');
      document.body.style.overflow = 'hidden';
      document.getElementById('commentInput').value = '';
      setTimeout(() => document.getElementById('commentInput').focus(), 350);
    }

    function renderComments(key) {
      const comments = (currentPostId !== null ? postComments[currentPostId] : reelComments[key]) || [];
      const list = document.getElementById('commentsList');
      if (comments.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px 20px;font-size:13px">No comments yet. Be the first to comment!</div>';
        return;
      }
      const meP = ensureMeProfile();
      const local = readLocalUser();
      list.innerHTML = comments.map((c, i) => {
        const isMe = (authUser && c.user_id && authUser.id === c.user_id) ||
                     (meP && (c.user === meP.name || c.user === 'You')) ||
                     (local && c.user === local.name);
        let avatarSrc = c.avatar || '';
        if (!avatarSrc) {
          if (isMe) {
            avatarSrc = (meP && meP.avatarImage) || (local && local.avatar) || '';
          } else {
            const p = (c.user_id && profiles.find(x => x.user_id === c.user_id)) || findProfile(c.user);
            if (p) avatarSrc = p.avatarImage || p.avatar || '';
          }
        }
        const initials = c.initials || (c.user ? c.user.substring(0, 2).toUpperCase() : 'AN');
        const avatarHtml = avatarSrc
          ? `<img src="${avatarSrc}" alt="${c.user || 'User'}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">`
          : initials;
        return `
        <div class="comment">
          <div class="comment-avatar" onclick="openUserFromComments('${c.user}')">${avatarHtml}</div>
          <div class="comment-body">
            <div class="comment-user" onclick="openUserFromComments('${c.user}')">${c.user} <span class="time">${c.time}</span></div>
            <div class="comment-text">${c.text}</div>
            <div class="comment-actions">
              <button class="${c.liked ? 'liked' : ''}" onclick="likeComment('${key}', ${i}, this)">
                <i class="iconoir-heart comment-like-icon"></i> ${c.likes}
              </button>
              <button onclick="startReply('${c.user}')">Reply</button>
            </div>
          </div>
        </div>
      `;
      }).join('');
    }

    function startReply(name) {
      const input = document.getElementById('commentInput');
      input.value = `@${name} `;
      input.focus();
    }

    function openUserFromComments(name) {
      closeComments();
      openUserProfile(name);
    }

    function likeComment(key, index, btn) {
      const comments = currentPostId !== null ? postComments[currentPostId] : reelComments[key];
      if (!comments || !comments[index]) return;
      const c = comments[index];
      c.liked = !c.liked;
      c.likes += c.liked ? 1 : -1;
      btn.classList.toggle('liked', c.liked);
      btn.innerHTML = `<i class="iconoir-heart comment-like-icon"></i> ${c.likes}`;
    }

    async function postComment() {
      const input = document.getElementById('commentInput');
      const text = input.value.trim();
      if (!text || (currentReelId === null && currentPostId === null)) return;

      const actor = currentActor();
      const myAvatar = actor.avatar || (ensureMeProfile() && ensureMeProfile().avatarImage) || (readLocalUser() && readLocalUser().avatar) || '';
      let list, total;
      if (currentPostId !== null) {
        if (!postComments[currentPostId]) postComments[currentPostId] = [];
        list = postComments[currentPostId];
        const pending = {
          user: actor.name,
          initials: actor.initials,
          avatar: myAvatar,
          user_id: authUser ? authUser.id : null,
          time: 'Just now',
          text,
          likes: 0,
          liked: false
        };
        list.unshift(pending);
        const post = posts.find(x => x.id === currentPostId);
        if (post) { post.comments += 1; savePostsLocal(); }
        total = post ? post.comments : list.length;
        document.querySelectorAll(`[data-comment-id="${currentPostId}"] span`).forEach(el => el.textContent = total);
        const detailBtn = document.getElementById('detailComment');
        if (detailBtn && openDetailId === currentPostId) detailBtn.querySelector('span').textContent = total;

        // Sync comment count + the comment itself to Supabase
        if (supabaseClient) {
          const postId = currentPostId;
          if (post) {
            supabaseClient.from('posts').update({ comments: post.comments }).eq('id', postId).then(({ error }) => {
              if (error) console.warn('Supabase comment sync notice:', error.message);
            });
          }
          if (Number(postId) < 1e11) {
            supabaseClient.from('comments').insert([{
              post_id: postId,
              user_id: authUser ? authUser.id : null,
              user_name: actor.name,
              user_initials: actor.initials,
              text: text
            }]).select('id, created_at').then(({ data, error }) => {
              if (error) { console.warn('Supabase comment insert notice:', error.message); return; }
              if (data && data[0]) {
                pending.id = data[0].id;
                pending.time = timeAgo(data[0].created_at);
              }
              if (currentPostId === postId) renderComments(postId);
            });
          }
        }
      } else {
        if (!reelComments[currentReelId]) reelComments[currentReelId] = [];
        list = reelComments[currentReelId];
        list.unshift({
          user: actor.name,
          initials: actor.initials,
          avatar: myAvatar,
          user_id: authUser ? authUser.id : null,
          time: 'Just now',
          text,
          likes: 0,
          liked: false
        });
        const reel = reels.find(r => r.id === currentReelId);
        if (reel) reel.comments += 1;
        total = reel ? reel.comments : list.length;
        const reelEl = document.querySelector(`.reel[data-reel-id="${currentReelId}"]`);
        if (reelEl) {
          const commentBtn = reelEl.querySelectorAll('.reel-action')[1];
          if (commentBtn) commentBtn.querySelector('.count').textContent = total;
        }
      }
      input.value = '';
      document.getElementById('commentsTitle').textContent = `Comments (${total})`;
      renderComments(currentPostId !== null ? currentPostId : currentReelId);
      showToast('Comment added');
    }

    function closeComments() {
      document.getElementById('commentsSheet').classList.remove('open');
      document.getElementById('sheetBackdrop').classList.remove('show');
      const detailOpen = document.getElementById('postDetail').classList.contains('open');
      const profileOpen = document.getElementById('userProfile').classList.contains('open');
      const videoOpen = document.getElementById('postVideoPlayer').classList.contains('open');
      const menuOpen = document.getElementById('reelMenuSheet').classList.contains('open');
      document.body.style.overflow = detailOpen || profileOpen || videoOpen || menuOpen ? 'hidden' : '';
      currentReelId = null;
      currentPostId = null;
    }

    // ============================================================
    //  REEL OPTIONS MENU
    // ============================================================
        let activeMenuReelId = null;
    function openReelMenu(reelId) {
      activeMenuReelId = reelId || null;
      const r = activeMenuReelId ? reels.find(x => String(x.id) === String(activeMenuReelId)) : null;
      const meP = ensureMeProfile();
      const isOwn = r && (r.isMe || (authUser && r.user_id === authUser.id) || (meP && r.username === meP.name) || (meP && r.initials === meP.initials));
      const editBtn = document.getElementById('reelMenuEditBtn');
      const delBtn = document.getElementById('reelMenuDeleteBtn');
      if (editBtn) editBtn.style.display = isOwn ? '' : 'none';
      if (delBtn) delBtn.style.display = isOwn ? '' : 'none';
      document.getElementById('reelMenuSheet').classList.add('open');
      document.getElementById('sheetBackdrop').classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function closeReelMenu() {
      document.getElementById('reelMenuSheet').classList.remove('open');
      document.getElementById('sheetBackdrop').classList.remove('show');
      document.body.style.overflow = '';
    }
    function reelMenuAction(msg) {
      closeReelMenu();
      showToast(msg);
    }
    function openEditReel(id) {
      closeReelMenu();
      const r = reels.find(x => String(x.id) === String(id));
      if (!r) return;
      const newDesc = prompt('Edit video caption:', r.description || '');
      if (newDesc === null) return;
      const newTags = prompt('Edit tags (e.g. #Choir #Worship):', r.tags || '');
      r.description = newDesc.trim() || r.description;
      if (newTags !== null) r.tags = newTags.trim() || r.tags;
      renderReels();
      showToast('Video updated');
      if (supabaseClient) {
        supabaseClient.from('reels').update({ description: r.description, tags: r.tags }).eq('id', id)
          .then(({ error }) => { if (error) console.warn('Supabase reel update:', error.message); });
      }
    }
    function deleteReel(id) {
      closeReelMenu();
      if (!confirm('Are you sure you want to delete this video?')) return;
      const idx = reels.findIndex(x => String(x.id) === String(id));
      if (idx >= 0) reels.splice(idx, 1);
      renderReels();
      renderMyProfile();
      showToast('Video deleted');
      if (supabaseClient) {
        supabaseClient.from('reels').delete().eq('id', id)
          .then(({ error }) => { if (error) console.warn('Supabase reel delete:', error.message); });
      }
    }

    function closeAllSheets() {
      closeComments();
      closeReelMenu();
    }

    // ============================================================
    //  FEED INTERACTIONS
    // ============================================================
    function toggleLike(btn) {
      const n = btn.querySelector('span');
      let c = parseInt(n.textContent || '0');
      const l = btn.classList.toggle('liked');
      const lIcon = btn.querySelector('svg, i');
      if (lIcon) {
        if (lIcon.tagName === 'SVG') lIcon.style.fill = l ? 'currentColor' : 'none';
        lIcon.classList.toggle('iconoir-heart-solid', l);
        lIcon.classList.toggle('iconoir-heart', !l);
      }
      if (n) n.textContent = c + (l ? 1 : -1);
      const pid = Number(btn.dataset.postId);
      if (pid) {
        const p = posts.find(x => x.id === pid);
        if (p) p.likes += l ? 1 : -1;
        if (l) likedPostIds.add(pid); else likedPostIds.delete(pid);
        saveEngagementState(); savePostsLocal();
        syncPostCards(pid);

        // Sync like to Supabase post_likes table
        if (supabaseClient && authUser) {
          if (l) {
            supabaseClient.from('post_likes').upsert([{ user_id: authUser.id, post_id: pid }]).then(({ error }) => {
              if (error) { btn.classList.toggle('liked'); const sIcon1 = btn.querySelector('svg'); if (sIcon1) sIcon1.style.fill = 'none'; if (n) n.textContent = c; if (p) p.likes = c; showToast('Failed to like'); }
            });
          } else {
            supabaseClient.from('post_likes').delete().eq('user_id', authUser.id).eq('post_id', pid).then(({ error }) => {
              if (error) { btn.classList.toggle('liked'); const sIcon2 = btn.querySelector('svg'); if (sIcon2) sIcon2.style.fill = 'currentColor'; if (n) n.textContent = c + 1; if (p) p.likes = c + 1; showToast('Failed to unlike'); }
            });
          }
        }
      }
    }
    function toggleRepost(btn) {
      const n = btn.querySelector('span');
      let c = parseInt(n.textContent || '0');
      const r = btn.classList.toggle('reposted');
      const rIcon = btn.querySelector('svg'); if (rIcon) rIcon.style.fill = r ? 'currentColor' : 'none';
      if (n) n.textContent = c + (r ? 1 : -1);
      const pid = Number(btn.dataset.postId);
      if (pid) {
        const p = posts.find(x => x.id === pid);
        if (p) p.reposts += r ? 1 : -1;
        if (r) repostedPostIds.add(pid); else repostedPostIds.delete(pid);
        saveEngagementState(); savePostsLocal();
        syncPostCards(pid);

        // Sync repost to Supabase post_reposts table
        if (supabaseClient && authUser) {
          if (r) {
            supabaseClient.from('post_reposts').upsert([{ user_id: authUser.id, post_id: pid }]).then(({ error }) => {
              if (error) { btn.classList.toggle('reposted'); const sIcon1 = btn.querySelector('svg'); if (sIcon1) sIcon1.style.fill = 'none'; if (n) n.textContent = c; if (p) p.reposts = c; showToast('Failed to repost'); }
            });
          } else {
            supabaseClient.from('post_reposts').delete().eq('user_id', authUser.id).eq('post_id', pid).then(({ error }) => {
              if (error) { btn.classList.toggle('reposted'); const sIcon2 = btn.querySelector('svg'); if (sIcon2) sIcon2.style.fill = 'currentColor'; if (n) n.textContent = c + 1; if (p) p.reposts = c + 1; showToast('Failed to remove repost'); }
            });
          }
        }
      }
    }
    function toggleSave(btn) {
      const s = btn.classList.toggle('saved');
      const svIcon = btn.querySelector('svg, i');
      if (svIcon) {
        if (svIcon.tagName === 'SVG') svIcon.style.fill = s ? 'currentColor' : 'none';
        svIcon.classList.toggle('iconoir-bookmark-solid', s);
        svIcon.classList.toggle('iconoir-bookmark', !s);
      }
      const pid = Number(btn.dataset.postId);
      if (pid && supabaseClient && authUser) {
        if (s) {
          supabaseClient.from('saved_posts').upsert([{ user_id: authUser.id, post_id: pid }]).then(({ error }) => {
            if (error) { btn.classList.toggle('saved'); const sIcon1 = btn.querySelector('svg'); if (sIcon1) sIcon1.style.fill = 'none'; showToast('Failed to save'); }
          });
        } else {
          supabaseClient.from('saved_posts').delete().eq('user_id', authUser.id).eq('post_id', pid).then(({ error }) => {
            if (error) { btn.classList.toggle('saved'); const sIcon2 = btn.querySelector('svg'); if (sIcon2) sIcon2.style.fill = 'currentColor'; showToast('Failed to remove'); }
          });
        }
      }
      if (pid) {
        if (s) savedPostIds.add(pid); else savedPostIds.delete(pid);
        saveEngagementState(); savePostsLocal();
        syncPostCards(pid);
      }
      showToast(s ? 'Post saved' : 'Removed from saved');
    }

    function syncPostCards(id) {
      const p = posts.find(x => x.id === id);
      if (!p) return;
      const liked = likedPostIds.has(id);
      const reposted = repostedPostIds.has(id);
      const saved = savedPostIds.has(id);
      document.querySelectorAll(`.post [data-act="like"][data-post-id="${id}"]`).forEach(btn => {
        btn.classList.toggle('liked', liked);
        btn.querySelector('span').textContent = p.likes;
        const lkIcon = btn.querySelector('svg, i');
        if (lkIcon) {
          if (lkIcon.tagName === 'SVG') lkIcon.style.fill = liked ? 'currentColor' : 'none';
          lkIcon.classList.toggle('iconoir-heart-solid', liked);
          lkIcon.classList.toggle('iconoir-heart', !liked);
        }
      });
      document.querySelectorAll(`.post [data-act="repost"][data-post-id="${id}"]`).forEach(btn => {
        btn.classList.toggle('reposted', reposted);
        btn.querySelector('span').textContent = p.reposts;
        const rpIcon = btn.querySelector('svg'); if (rpIcon) rpIcon.style.fill = reposted ? 'currentColor' : 'none';
      });
      document.querySelectorAll(`.post [data-act="save"][data-post-id="${id}"]`).forEach(btn => {
        btn.classList.toggle('saved', saved);
        const svIcon2 = btn.querySelector('svg, i');
        if (svIcon2) {
          if (svIcon2.tagName === 'SVG') svIcon2.style.fill = saved ? 'currentColor' : 'none';
          svIcon2.classList.toggle('iconoir-bookmark-solid', saved);
          svIcon2.classList.toggle('iconoir-bookmark', !saved);
        }
      });
    }

    function openMenu() { document.getElementById('menuOverlay').classList.add('open'); }
    function closeMenu() { document.getElementById('menuOverlay').classList.remove('open'); }
    function menuAction(m) { closeMenu(); showToast(m); }

    let activeMenuPostId = null;
    function openPostMenu(id) {
      activeMenuPostId = id;
      const p = posts.find(x => x.id === id);
      const meP = ensureMeProfile();
      const isOwn = p && (p.isMe || (authUser && p.userId === authUser.id) || (meP && p.author === meP.name));
      const editBtn = document.getElementById('menuEditBtn');
      const delBtn = document.getElementById('menuDeleteBtn');
      if (editBtn) editBtn.style.display = isOwn ? '' : 'none';
      if (delBtn) delBtn.style.display = isOwn ? '' : 'none';
      document.getElementById('menuOverlay').classList.add('open');
    }

    function openEditPost(id) {
      const p = posts.find(x => x.id === id);
      if (!p) return;
      editingPostId = id;
      const caption = document.getElementById('pcCaption');
      if (caption) caption.value = p.text || '';
      openCreatePanel();
      showToast('Edit your post, then tap Share to update');
    }

    function deletePost(id) {
      const idx = posts.findIndex(x => x.id === id);
      if (idx < 0) return;
      posts.splice(idx, 1);
      renderFeed();
      renderMyProfile();
      savePostsLocal();
      showToast('Post deleted');
      if (supabaseClient) supabaseClient.from('posts').delete().eq('id', id)
        .then(({ error }) => { if (error) showToast('Failed to delete post on server'); });
    }
    function openAppMenu() {
      updateBadge();
      document.getElementById('appMenuOverlay').classList.add('open');
    }
    function closeAppMenu() {
      document.getElementById('appMenuOverlay').classList.remove('open');
    }

    let openDetailId = null;
    function openDetail(id) {
      openDetailId = id;
      const p = posts.find(x => x.id === id);
      const dm = document.getElementById('detailMedia');
      if (p.video) {
        dm.style.display = 'block';
        dm.innerHTML = `<video src="${p.video}" controls playsinline style="width:100%;height:100%;object-fit:contain;background:#000"></video>`;
      } else if (p.image) {
        dm.style.display = 'block';
        dm.innerHTML = `<img src="${p.image}" alt="" style="width:100%;height:100%;object-fit:contain;background:#000">`;
      } else {
        dm.style.display = 'none';
        dm.innerHTML = '';
      }
      document.getElementById('detailTitle').textContent = p.title || '';
      document.getElementById('detailTitle').style.display = p.title ? '' : 'none';
      document.getElementById('detailText').textContent = p.text;
      document.getElementById('detailTags').textContent = p.tags;
      const detailAuthor = (!p.author || p.author === 'Member') ? currentActor().name : p.author;
      document.getElementById('detailTemple').textContent = detailAuthor || p.temple || '';
      document.getElementById('detailTime').textContent = p.author && p.temple ? `${p.temple} • ${p.time}` : (p.temple || p.time || '');
      document.getElementById('detailPostTime').textContent = p.time;
      const likeBtn = document.getElementById('detailLike');
      const liked = likedPostIds.has(id);
      likeBtn.dataset.postId = id;
      likeBtn.querySelector('span').textContent = p.likes;
      likeBtn.classList.toggle('liked', liked);
      const dtLIcon = likeBtn.querySelector('svg, i');
      if (dtLIcon) {
        if (dtLIcon.tagName === 'SVG') dtLIcon.style.fill = liked ? 'currentColor' : 'none';
        dtLIcon.classList.toggle('iconoir-heart-solid', liked);
        dtLIcon.classList.toggle('iconoir-heart', !liked);
      }
      const repostBtn = document.getElementById('detailRepost');
      const reposted = repostedPostIds.has(id);
      repostBtn.dataset.postId = id;
      repostBtn.querySelector('span').textContent = p.reposts;
      repostBtn.classList.toggle('reposted', reposted);
      const dtRIcon = repostBtn.querySelector('svg'); if (dtRIcon) dtRIcon.style.fill = reposted ? 'currentColor' : 'none';
      const saveBtn = document.getElementById('detailSave');
      const saved = savedPostIds.has(id);
      saveBtn.dataset.postId = id;
      saveBtn.classList.toggle('saved', saved);
      const dtSIcon = saveBtn.querySelector('svg, i');
      if (dtSIcon) {
        if (dtSIcon.tagName === 'SVG') dtSIcon.style.fill = saved ? 'currentColor' : 'none';
        dtSIcon.classList.toggle('iconoir-bookmark-solid', saved);
        dtSIcon.classList.toggle('iconoir-bookmark', !saved);
      }
      document.getElementById('detailComment').querySelector('span').textContent = p.comments;
      document.getElementById('postDetail').classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeDetail() {
      const vid = document.querySelector('#postDetail video');
      if (vid) vid.pause();
      document.getElementById('postDetail').classList.remove('open');
      openDetailId = null;
      const upOpen = document.getElementById('userProfile').classList.contains('open');
      document.body.style.overflow = upOpen ? 'hidden' : '';
    }

    function sharePostLink(id) {
      const p = posts.find(x => x.id === id);
      const ok = p ? 'Post link copied' : 'Link copied';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(location.href.split('#')[0] + '#post-' + id)
          .then(() => showToast(ok))
          .catch(() => showToast('Sharing post'));
      } else {
        showToast('Sharing post');
      }
    }

    function shareReel(id) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(location.href.split('#')[0] + '#reel-' + id)
          .then(() => showToast('Reel link copied'))
          .catch(() => showToast('Sharing reel'));
      } else {
        showToast('Sharing reel');
      }
    }

    function openPostVideo(id) {
      const p = posts.find(x => x.id === id);
      if (!p || !p.video) return;
      const liked = likedPostIds.has(id);
      const saved = savedPostIds.has(id);
      const reposted = repostedPostIds.has(id);
      const player = document.getElementById('postVideoPlayer');
            player.innerHTML = `
        <div class="post-video-top">
          <button class="post-video-back" onclick="closePostVideo()" aria-label="Back">
            <i class="iconoir-nav-arrow-left"></i>
          </button>
          <button class="post-video-menu-btn" onclick="event.stopPropagation();closePostVideo();openPostMenu(${p.id})" aria-label="Video options">
            <i class="iconoir-menu"></i>
          </button>
        </div>
        <div class="reel" data-reel-id="post-${p.id}">
          <video class="reel-video" src="${p.video}" autoplay loop muted playsinline controls></video>
          <div class="reel-overlay">
            <div class="reel-info">
              <div class="reel-user-row">
                <div class="reel-avatar" style="background:#0c0c0c">${p.authorInitials || (p.author ? p.author.substring(0,2).toUpperCase() : 'AN')}</div>
                <div class="reel-user-meta">
                  <div class="reel-username">${p.author || 'amaNazaretha Church'}</div>
                  <div style="font-size:11px;color:rgba(255,255,255,.75)">${p.temple}</div>
                </div>
              </div>
              <div class="reel-desc">${p.text}</div>
              <div class="reel-tags">${p.tags}</div>
            </div>
          </div>
          <div class="reel-rail">
            <button class="reel-action${liked ? ' liked' : ''}" data-post-id="${p.id}" onclick="toggleLike(this)">
              <div class="icon-circle"><i class="iconoir-heart"></i></div>
              <span class="count">${p.likes}</span>
            </button>
            <button class="reel-action" data-comment-id="${p.id}" onclick="openPostComments(${p.id})">
              <div class="icon-circle"><i class="iconoir-chat-bubble"></i></div>
              <span class="count">${p.comments}</span>
            </button>
            <button class="reel-action${reposted ? ' reposted' : ''}" data-post-id="${p.id}" onclick="toggleRepost(this)">
              <div class="icon-circle"><i class="iconoir-repeat"></i></div>
              <span class="count">${p.reposts}</span>
            </button>
            <button class="reel-action" onclick="sharePostLink(${p.id})">
              <div class="icon-circle"><i class="iconoir-share-android"></i></div>
            </button>
            <button class="reel-action${saved ? ' saved' : ''}" data-post-id="${p.id}" onclick="toggleSave(this)">
              <div class="icon-circle"><i class="iconoir-bookmark"></i></div>
            </button>
          </div>
        </div>`;
      player.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closePostVideo() {
      const player = document.getElementById('postVideoPlayer');
      const vid = player.querySelector('video');
      if (vid) vid.pause();
      player.classList.remove('open');
      player.innerHTML = '';
      document.body.style.overflow = '';
    }

    function sendPrayer() {
      const t = document.getElementById('prayerText');
      if (!t) { showToast('Prayer request received'); return; }
      if (!t.value.trim()) { showToast('Please write your prayer request'); return; }
      t.value = '';
      showToast('Prayer request received');
    }

    // ============================================================
    //  NOTIFICATIONS
    // ============================================================
    function renderNotifications() {
      const nList = document.getElementById('notifList');
      if (!nList) return;
      if (!notifications.length) {
        nList.innerHTML = '<div style="text-align:center;color:var(--pr-grey);padding:28px 20px;font-size:13px"><i class="iconoir-bell" style="font-size:36px;display:block;margin:0 auto 12px;opacity:0.4"></i>No notifications yet.<br><span style="font-size:12px;color:var(--pr-grey)">When members interact with your posts or message you, they will appear here.</span></div>';
        updateBadge();
        return;
      }
      nList.innerHTML = notifications.map((n, i) => `
        <div class="notif-item ${n.unread ? 'unread' : ''}" onclick="markRead(${i})">
          <div class="notif-icon"><i class="${getIconoirClass(n.icon)}"></i></div>
          <div style="flex:1;min-width:0">
            <b>${n.title}</b>
            <p>${n.text}</p>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <span class="notif-time">${n.time}</span>
            ${n.unread ? '<span class="notif-unread"></span>' : ''}
          </div>
        </div>`).join('');
      updateBadge();
    }
    function updateBadge() {
      const c = notifications.filter(n => n.unread).length;
      document.querySelectorAll('#notifBadge').forEach(b => {
        b.textContent = c > 99 ? '99+' : c;
        b.style.display = c ? 'grid' : 'none';
      });
      document.querySelectorAll('#menuNotifBadge').forEach(m => {
        m.textContent = c > 99 ? '99+' : c;
        m.style.display = c ? 'inline-grid' : 'none';
      });
    }
    let notifReturn = 'home';
    function openNotifications() {
      if (!document.body.classList.contains('notif-active')) {
        notifReturn = currentPage === 'notifications' ? 'home' : currentPage;
      }
      go('notifications');
    }
    function closeNotifications() {
      go(notifReturn);
    }
    function markRead(i) {
      if (!notifications[i]) return;
      notifications[i].unread = false;
      saveNotificationsLocal();
      updateBadge();
      renderNotifications();

      const n = notifications[i];
      if (n.data && n.data.chat_id) {
        openThread(n.data.chat_id);
      } else if (n.data && n.data.follower_name) {
        openUserProfile(n.data.follower_name);
      } else if (n.data && n.data.post_id) {
        openDetail(n.data.post_id);
      }

      if (supabaseClient && typeof n.id === 'number') {
        supabaseClient.from('notifications').update({ read: true }).eq('id', n.id).then();
      }
    }

    function markAllNotificationsRead() {
      notifications.forEach(n => { n.unread = false; });
      saveNotificationsLocal();
      updateBadge();
      renderNotifications();
      showToast('All notifications marked as read');
      if (supabaseClient && authUser) {
        supabaseClient.from('notifications').update({ read: true }).eq('user_id', authUser.id).then();
      }
    }

    // ============================================================
    //  TOAST
    // ============================================================
    let toastTimer;
    function showToast(m) {
      const t = document.getElementById('toast');
      t.textContent = m;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
    }

    const menuOverlay = document.getElementById('menuOverlay');
    if (menuOverlay) menuOverlay.addEventListener('click', e => { if (e.target.id === 'menuOverlay') closeMenu(); });
    const appMenuOverlay = document.getElementById('appMenuOverlay');
    if (appMenuOverlay) appMenuOverlay.addEventListener('click', e => { if (e.target.id === 'appMenuOverlay') closeAppMenu(); });
    const insightOverlay = document.getElementById('insightOverlay');
    if (insightOverlay) insightOverlay.addEventListener('click', e => { if (e.target.id === 'insightOverlay') closeInsight(); });
    const editProfileOverlay = document.getElementById('editProfileOverlay');
    if (editProfileOverlay) editProfileOverlay.addEventListener('click', e => { if (e.target.id === 'editProfileOverlay') closeEditProfile(); });
    const aboutProfileOverlay = document.getElementById('aboutProfileOverlay');
    if (aboutProfileOverlay) aboutProfileOverlay.addEventListener('click', e => { if (e.target.id === 'aboutProfileOverlay') closeAboutProfile(); });
    const blockProfileOverlay = document.getElementById('blockProfileOverlay');
    if (blockProfileOverlay) blockProfileOverlay.addEventListener('click', e => { if (e.target.id === 'blockProfileOverlay') closeBlockProfile(); });
    const reportProfileOverlay = document.getElementById('reportProfileOverlay');
    if (reportProfileOverlay) reportProfileOverlay.addEventListener('click', e => { if (e.target.id === 'reportProfileOverlay') closeReportProfile(); });
    document.addEventListener('click', e => { if (!e.target.closest('.up-menu-wrap')) closeProfileMenu(); });

    // ============================================================
    //  INIT
    // ============================================================
    document.querySelectorAll('[data-page]').forEach(b => {
      b.addEventListener('click', () => {
        if (b.dataset.page === 'create') return openCreatePanel();
        go(b.dataset.page);
      });
    });

    document.addEventListener('DOMContentLoaded', async () => {
      // Only run full app initialization on home.html
      const isHomePage = window.location.pathname.endsWith('home.html') || 
                         window.location.pathname.endsWith('/') || 
                         window.location.pathname === '' ||
                         document.getElementById('feed');
      
      if (!isHomePage) {
        // On other pages, just hydrate session for auth state
        try { await hydrateSession(); } catch (e) {}
        return;
      }
      
      // First restore session to get authUser
      let session = null;
      try { session = await hydrateSession(); } catch (e) {}
      if (session) {
        try { await loadMyProfile(session.user); } catch (e) { console.warn('Profile restore notice:', e && e.message); }
        ensureMeProfile();
        renderMyProfile();
        closeAuth();
      } else if (isAuthed()) {
        ensureMeProfile();
        renderMyProfile();
        closeAuth();
      } else {
        openAuth('welcome');
      }

      // Then load all Supabase data (now authUser is set)
      try { await initOfflineDB(); } catch (e) { console.warn('Offline DB init notice:', e && e.message); }
      await loadSupabaseData();
      loadEngagementState();
      renderFeed();
      renderReels();
      renderReelChips();
      renderNotifications();
      renderChats();
      renderMyProfile();
      renderEvents();
      updateBadge();
    });