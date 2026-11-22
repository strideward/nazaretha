const fs = require('fs');

const appJsPath = 'C:/Users/ntuth/.gemini/antigravity/scratch/app.js';
let code = fs.readFileSync(appJsPath, 'utf8');

// Normalize line endings
code = code.replace(/\r\n/g, '\n');

function doReplace(name, oldText, newText) {
  const normOld = oldText.replace(/\r\n/g, '\n');
  const normNew = newText.replace(/\r\n/g, '\n');
  if (code.includes(normOld)) {
    code = code.replace(normOld, normNew);
    console.log(`✓ [${name}] replaced successfully`);
  } else {
    console.warn(`✗ [${name}] target NOT found`);
  }
}

// 1. Posts storage
doReplace('Posts storage',
`    // Clean data storage (all dummy data removed)
    let profiles = [];
let posts = (() => { try { return JSON.parse(localStorage.getItem('nazarethaPosts') || '[]'); } catch(e) { return []; } })();
    function savePostsLocal() { try { const clean = posts.map(p => ({...p, image: (p.image && p.image.startsWith('blob:')) ? undefined : p.image, video: (p.video && p.video.startsWith('blob:')) ? undefined : p.video})); localStorage.setItem('nazarethaPosts', JSON.stringify(clean)); } catch(e){} }`,
`    // Supabase reactive data storage (no local storage)
    let profiles = [];
    let posts = [];
    function savePostsLocal() {}`
);

// 2. Notifications storage
doReplace('Notifications storage',
`    // Notifications state with localStorage cache (no dummy data)
    let notifications = (() => {
      try {
        const saved = JSON.parse(localStorage.getItem('nazarethaNotifications') || '[]');
        if (saved && Array.isArray(saved) && saved.length) {
          return saved.filter(n => !n.id || !String(n.id).startsWith('notif_welcome_'));
        }
      } catch(e) {}
      return [];
    })();

    function saveNotificationsLocal() {
      try { localStorage.setItem('nazarethaNotifications', JSON.stringify(notifications)); } catch(e){}
    }`,
`    // Notifications state loaded directly from Supabase (no local storage)
    let notifications = [];
    function saveNotificationsLocal() {}`
);

// 3. Chats storage
doReplace('Chats storage',
`    // chats and messageRequests with localStorage persistence (no dummy data)
    let supabaseChats = (() => {
      try {
        const saved = JSON.parse(localStorage.getItem('nazarethaChats') || '[]');
        if (saved && Array.isArray(saved) && saved.length) {
          return saved.filter(c => c.id !== 'chat_sipho' && c.id !== 'chat_zodwa' && c.id !== 'chat_choir');
        }
      } catch(e) {}
      return [];
    })();

    function saveChatsLocal() {
      try { localStorage.setItem('nazarethaChats', JSON.stringify(supabaseChats)); } catch(e){}
    }`,
`    // Chats loaded directly from Supabase (no local storage)
    let supabaseChats = [];
    function saveChatsLocal() {}`
);

// 4. readLocalUser
doReplace('readLocalUser',
`    function readLocalUser() {
      try { return JSON.parse(localStorage.getItem('nazarethaUser') || 'null'); } catch (e) { return null; }
    }`,
`    function readLocalUser() {
      const me = profiles.find(p => p.me || (authUser && p.user_id === authUser.id));
      if (me) return me;
      if (authUser) {
        const meta = authUser.user_metadata || {};
        return {
          email: authUser.email,
          name: meta.full_name || \`\${meta.first || ''} \${meta.surname || ''}\`.trim() || 'Member',
          first: meta.first || '',
          surname: meta.surname || '',
          temple: meta.temple || 'eBuhleni',
          avatar: ''
        };
      }
      return null;
    }`
);

// 5. adoptProfile
doReplace('adoptProfile',
`    function adoptProfile(p, fallbackEmail) {
      const name = (p.name || '').trim() || [p.first, p.surname].filter(Boolean).join(' ');
      const first = p.first || (name ? name.split(' ')[0] : '');
      const surname = p.surname || (name ? name.split(' ').slice(1).join(' ') : '');
      const user = {
        name: name || [first, surname].filter(Boolean).join(' '),
        first: first,
        surname: surname,
        temple: p.temple || 'eBuhleni',
        preacher: p.preacher || '',
        email: p.email || fallbackEmail || (authUser && authUser.email) || '',
        dob: p.dob || '',
        gender: p.gender || '',
        praise: p.praise || '',
        avatar: p.avatarImage || p.avatar || ''
      };
      try {
        localStorage.setItem('nazarethaUser', JSON.stringify(user));
        localStorage.setItem('nazarethaSession', '1');
      } catch (e) {}
      profiles.forEach(x => { x.me = false; });
      let me = profiles.find(x => (x.email && p.email && String(x.email).toLowerCase() === String(p.email).toLowerCase()) || x.me);
      if (!me) {
        me = { me: true };
        profiles.unshift(me);
      }
      Object.assign(me, p, { me: true, name: user.name, first, surname });
      return me;
    }`,
`    function adoptProfile(p, fallbackEmail) {
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
    }`
);

// 6. loadChatsFromSupabase
doReplace('loadChatsFromSupabase',
`    async function loadChatsFromSupabase() {
      // 1. Try local storage first
      try {
        const cached = JSON.parse(localStorage.getItem('nazarethaChats') || '[]');
        if (cached && Array.isArray(cached) && cached.length) {
          supabaseChats = cached;
        }
      } catch (e) {}

      // 2. Fetch remote chats if Supabase connected
      if (supabaseClient && authUser) {
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

            if (!cErr && dbChats && dbChats.length) {
              for (const ch of dbChats) {
                if (!supabaseChats.find(c => c.id === ch.id)) {
                  supabaseChats.push({
                    id: ch.id,
                    name: ch.name || 'Conversation',
                    initials: (ch.name || 'C')[0],
                    color: 'linear-gradient(135deg, #d4af37, #a07d1c)',
                    online: false,
                    time: timeAgo(ch.updated_at),
                    preview: ch.last_message || 'New conversation',
                    unread: 0,
                    messages: []
                  });
                }
              }
              saveChatsLocal();
            }
          }
        } catch (err) {
          console.warn('Supabase load chats notice:', err);
        }
      }

      if (currentPage === 'messages' || window.location.pathname.endsWith('messages.html')) {
        const cs = document.getElementById('chatSearch');
        renderChats(cs ? cs.value : '');
      }
    }`,
`    async function loadChatsFromSupabase() {
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
    }`
);

// 7. loadSupabaseData profiles mapping
doReplace('loadSupabaseData profiles',
`        // 4. Profiles
        const { data: dbProfiles, error: prErr } = await supabaseClient.from('profiles').select('*');
        if (!prErr && dbProfiles && dbProfiles.length) {
          const userStr = localStorage.getItem('nazarethaUser');
          const localUser = userStr ? JSON.parse(userStr) : null;
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
            me: (authUser && p.user_id && p.user_id === authUser.id) ||
                (localUser && (localUser.email === p.email || (localUser.first === p.first && localUser.surname === p.surname)))
          }));
          ensureMeProfile();
          renderMyProfile();
        }`,
`        // 4. Profiles
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
        }`
);

// 8. ensureMeProfile
doReplace('ensureMeProfile',
`    function ensureMeProfile() {
      let user = null;
      try { user = JSON.parse(localStorage.getItem("nazarethaUser")); } catch (e) {}
      const meta = (authUser && authUser.user_metadata) || {};
      const first = (user && user.first) || meta.first || (user && user.name ? user.name.split(' ')[0] : '') || '';
      const surname = (user && user.surname) || meta.surname || (user && user.name ? user.name.split(' ').slice(1).join(' ') : '') || '';
      const name = (user && user.name) || (first || surname ? \`\${first} \${surname}\`.trim() : '') || meta.full_name || '';

      let me = profiles.find(p => p.me);
      if (!me) {
        me = {
          name: name || 'amaNazaretha Member',
          first: first,
          surname: surname,
          initials: ((first[0] || name[0] || 'A') + (surname[0] || (name.split(' ')[1] ? name.split(' ')[1][0] : ''))).toUpperCase(),
          avatarColor: "#0c0c0c",
          banner: "#1a1f24",
          bio: "Walking the Shembe path with amaNazaretha.",
          type: "Member",
          temple: (user && user.temple) ? user.temple : "eBuhleni",
          preacher: (user && user.preacher) ? user.preacher : "",
          joined: "Just now",
          location: "Durban",
          followers: 0,
          followingCount: 0,
          verified: false,
          following: false,
          me: true,
          avatarImage: (user && (user.avatar || user.avatarImage)) ? (user.avatar || user.avatarImage) : "",
          coverImage: (user && user.cover) ? user.cover : ""
        };
        profiles.unshift(me);
      } else {
        if (name && (me.name === 'Member' || !me.name)) {
          me.name = name;
          me.first = first;
          me.surname = surname;
          me.initials = ((first[0] || name[0] || 'A') + (surname[0] || (name.split(' ')[1] ? name.split(' ')[1][0] : ''))).toUpperCase();
        }
      }
      return me;
    }`,
`    function ensureMeProfile() {
      const meta = (authUser && authUser.user_metadata) || {};
      const first = meta.first || '';
      const surname = meta.surname || '';
      const name = meta.full_name || (first || surname ? \`\${first} \${surname}\`.trim() : '') || (authUser ? authUser.email : 'amaNazaretha Member');

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
    }`
);

// 9. isAuthed
doReplace('isAuthed',
`    function isAuthed() {
      if (authUser) return true;
      try { return !!(localStorage.getItem('nazarethaUser') || localStorage.getItem('nazarethaSession')); } catch (e) { return false; }
    }`,
`    function isAuthed() {
      return !!authUser;
    }`
);

// 10. submitLogin
doReplace('submitLogin',
`      const finish = (user, label) => {
        try {
          if (user) localStorage.setItem('nazarethaUser', JSON.stringify(user));
          localStorage.setItem('nazarethaSession', '1');
        } catch (err) {}
        document.getElementById('loginPassword').value = '';
        closeAuth();
        go('home');
        showToast(label || 'Welcome back');
      };

      const btn = document.querySelector('#authFlow .auth-screen.active button[type="submit"]');
      if (btn) btn.disabled = true;

      const localFallback = () => {
        if (btn) btn.disabled = false;
        const local = readLocalUser();
        if (local && (local.email || '').toLowerCase() === id.toLowerCase()) {
          const me = adoptProfile(local, id);
          return finish(null, 'Welcome back, ' + ((me && me.name) || 'friend'));
        }
        const fallbackName = (id.split('@')[0] || 'Member').replace(/[._-]/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
        return finish({ email: id, name: fallbackName, first: fallbackName }, 'Welcome back');
      };

      // Real sign-in against Supabase Auth
      if (!supabaseClient) return localFallback();

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
          // Subscribe to realtime after successful login
          subscribeToRealtime();
          finish(null, 'Welcome back, ' + ((me && me.name) || 'friend'));
        })
        .catch(() => localFallback());`,
`      const finish = (label) => {
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
        });`
);

// 11. logout
doReplace('logout',
`      authUser = null;
      try {
        localStorage.removeItem('nazarethaUser');
        localStorage.removeItem('nazarethaSession');
      } catch (e) {}`,
`      authUser = null;`
);

// 12. submitRegister localStorage
doReplace('submitRegister localStorage',
`      // Save user to local storage
      localStorage.setItem('nazarethaUser', JSON.stringify(data));
      localStorage.setItem('nazarethaSession', '1');`,
`      // Account saved in Supabase (no local storage)`
);

// 13. saveEngagementState and loadEngagementState
doReplace('engagement state',
`    const ENGAGEMENT_KEYS = { liked: 'nazarethaLikes', saved: 'nazarethaSaved', reposted: 'nazarethaReposts' };

    function saveEngagementState() {
      try {
        localStorage.setItem(ENGAGEMENT_KEYS.liked, JSON.stringify(Array.from(likedPostIds)));
        localStorage.setItem(ENGAGEMENT_KEYS.saved, JSON.stringify(Array.from(savedPostIds)));
        localStorage.setItem(ENGAGEMENT_KEYS.reposted, JSON.stringify(Array.from(repostedPostIds)));
      } catch (e) {}
    }

    function loadEngagementState() {
      try {
        const read = k => (JSON.parse(localStorage.getItem(k) || '[]') || []).map(Number).filter(n => !isNaN(n));
        read(ENGAGEMENT_KEYS.liked).forEach(id => likedPostIds.add(id));
        read(ENGAGEMENT_KEYS.saved).forEach(id => savedPostIds.add(id));
        read(ENGAGEMENT_KEYS.reposted).forEach(id => repostedPostIds.add(id));
      } catch (e) {}
      
      // Load saved posts from Supabase
      if (supabaseClient && authUser) {
        supabaseClient.from('saved_posts')
          .select('post_id')
          .eq('user_id', authUser.id)
          .then(({ data, error }) => {
            if (!error && data) {
              data.forEach(d => savedPostIds.add(d.post_id));
              renderFeed(); // Re-render to show saved state
            }
          });
        
        // Load likes from Supabase
        supabaseClient.from('post_likes')
          .select('post_id')
          .eq('user_id', authUser.id)
          .then(({ data, error }) => {
            if (!error && data) {
              data.forEach(d => likedPostIds.add(d.post_id));
              renderFeed();
            }
          });
        
        // Load reposts from Supabase
        supabaseClient.from('post_reposts')
          .select('post_id')
          .eq('user_id', authUser.id)
          .then(({ data, error }) => {
            if (!error && data) {
              data.forEach(d => repostedPostIds.add(d.post_id));
              renderFeed();
            }
          });
      }
    }`,
`    function saveEngagementState() {}

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
    }`
);

// 14. Profile editing localStorage
doReplace('handleProfilePhotoChange localStorage',
`        try { localStorage.setItem('nazarethaUser', JSON.stringify(local)); } catch (err) {}`,
`        // Profile photo updated in Supabase`
);

doReplace('saveProfile localStorage',
`      try { localStorage.setItem('nazarethaUser', JSON.stringify(local)); } catch (e) {}`,
`      // Profile details updated in Supabase`
);

fs.writeFileSync(appJsPath, code, 'utf8');
console.log('Migration to pure Supabase complete!');
