    // ============================================================
    //  SUPABASE CLIENT & REAL DATA
    // ============================================================
    const SUPABASE_PROJECT_ID = "gzxbppwlfxtbybzxlocw";
    const SUPABASE_URL = "https://gzxbppwlfxtbybzxlocw.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_4XPZaxufxC9NnJ3CYMrmcw_K7Jff-9g";

    // Initialize Supabase Client
    window.supabaseClient = (typeof window.supabase !== "undefined" && window.supabase.createClient)
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;
    const supabaseClient = window.supabaseClient;

    // Clean data storage (all dummy data removed)
    let profiles = [];
    let posts = (() => { try { return JSON.parse(localStorage.getItem('nazarethaPosts') || '[]'); } catch(e) { return []; } })();
    function savePostsLocal() { try { const clean = posts.map(p => ({...p, image: (p.image && p.image.startsWith('blob:')) ? undefined : p.image, video: (p.video && p.video.startsWith('blob:')) ? undefined : p.video})); localStorage.setItem('nazarethaPosts', JSON.stringify(clean)); } catch(e){} }
    let reels = [];
    let eventsData = [];
    let notifications = [];
    let chats = [];
    let messageRequests = [];
    let postComments = {};
    let reelComments = {};

    // ============================================================
    //  REAL SUPABASE AUTH STATE
    // ============================================================
    let authUser = null;

    function readLocalUser() {
      try { return JSON.parse(localStorage.getItem('nazarethaUser') || 'null'); } catch (e) { return null; }
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

    // The signed-in person (Supabase account, else cached local profile)
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

    // Adopt a Supabase profile row as the signed-in member and cache it locally
    function adoptProfile(p, fallbackEmail) {
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
        avatar: p.avatarImage || p.avatar || '',
        cover: p.coverImage || p.cover || ''
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
      Object.assign(me, p, {
        name: name || [first, surname].filter(Boolean).join(' ') || (me.name !== 'Member' ? me.name : 'amaNazaretha Member'),
        first: first || me.first,
        surname: surname || me.surname,
        temple: p.temple || me.temple || 'eBuhleni',
        preacher: p.preacher || me.preacher || '',
        initials: p.initials || (((first[0] || 'A') + (surname[0] || '')).toUpperCase()),
        avatarColor: p.avatarColor || '#0c0c0c',
        avatarImage: p.avatarImage || p.avatar || me.avatarImage || '',
        coverImage: p.coverImage || p.cover || me.coverImage || '',
        bio: p.bio || me.bio || 'Walking the Shembe path with amaNazaretha.',
        followers: p.followers || 0,
        followingCount: p.followingCount || 0,
        following: false,
        me: true
      });
      renderMyProfile();
      return me;
    }

    // Load the signed-in member's row from Supabase (by auth user id, then email)
    async function loadMyProfile(user) {
      if (!supabaseClient || !user) return null;
      let row = null;
      if (user.id) {
        const byId = await supabaseClient.from('profiles').select('*').eq('user_id', user.id).limit(1);
        if (!byId.error && byId.data && byId.data[0]) row = byId.data[0];
      }
      if (!row && user.email) {
        const byEmail = await supabaseClient.from('profiles').select('*').ilike('email', user.email).limit(1);
        if (!byEmail.error && byEmail.data && byEmail.data[0]) row = byEmail.data[0];
      }
      if (row) return adoptProfile(row, user.email);
      return null;
    }

    // Load live data from Supabase
    async function loadSupabaseData() {
      if (!supabaseClient) return;
      try {
        // Posts
        const { data: dbPosts, error: postErr } = await supabaseClient.from("posts").select("*").order("created_at", { ascending: false });
        if (!postErr && dbPosts && dbPosts.length) {
          posts = dbPosts.map(p => ({
            id: p.id,
            icon: p.icon || "sun",
            title: p.title || "",
            text: p.text || p.content || "",
            tags: p.tags || "",
            temple: p.temple || "eBuhleni",
            time: p.created_at ? new Date(p.created_at).toLocaleDateString() : "Just now",
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

        // Events
        const { data: dbEvents, error: evErr } = await supabaseClient.from("events").select("*").order("created_at", { ascending: false });
        if (!evErr && dbEvents && dbEvents.length) {
          eventsData = dbEvents.map(e => ({
            id: String(e.id),
            day: e.day || "01",
            month: e.month || "JAN",
            title: e.title || "",
            type: e.type || "Service",
            dateLabel: e.date_label || "",
            time: e.time || "",
            venue: e.venue || "",
            temple: e.temple || "",
            host: e.host || "",
            attending: e.attending || 0,
            reminded: false,
            description: e.description || "",
            cover: e.cover || ""
          }));
          renderEvents();
        }

        // Reels
        const { data: dbReels, error: rErr } = await supabaseClient.from("reels").select("*").order("created_at", { ascending: false });
        if (!rErr && dbReels && dbReels.length) {
          reels = dbReels.map(r => ({
            id: String(r.id),
            username: r.username || "",
            initials: r.initials || "AN",
            avatarColor: r.avatar_color || "#0c0c0c",
            verified: !!r.verified,
            following: false,
            location: r.location || "",
            description: r.description || "",
            tags: r.tags || "",
            music: r.music || "",
            likes: r.likes || 0,
            comments: r.comments || 0,
            reposts: r.reposts || 0,
            video: r.video || ""
          }));
          renderReels();
        }

        // Profiles
        const { data: dbProfiles, error: prErr } = await supabaseClient.from("profiles").select("*");
        if (!prErr && dbProfiles) {
          const userStr = localStorage.getItem("nazarethaUser");
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
        }

        // Comments (real, stored per post)
        const { data: dbComments, error: cErr } = await supabaseClient.from('comments').select('*').order('created_at', { ascending: false });
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
      } catch (err) {
        console.warn("Supabase load notice:", err);
      }
    }

    function ensureMeProfile() {
      let user = null;
      try { user = JSON.parse(localStorage.getItem("nazarethaUser")); } catch (e) {}
      const meta = (authUser && authUser.user_metadata) || {};
      const first = (user && user.first) || meta.first || (user && user.name ? user.name.split(' ')[0] : '') || '';
      const surname = (user && user.surname) || meta.surname || (user && user.name ? user.name.split(' ').slice(1).join(' ') : '') || '';
      const name = (user && user.name) || (first || surname ? `${first} ${surname}`.trim() : '') || meta.full_name || '';

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
          avatarImage: (user && user.avatar) ? user.avatar : "",
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
        if (user && user.temple && (!me.temple || me.temple === 'eBuhleni')) me.temple = user.temple;
        if (user && user.preacher && !me.preacher) me.preacher = user.preacher;
        if (user && user.avatar && !me.avatarImage) me.avatarImage = user.avatar;
        if (user && user.cover && !me.coverImage) me.coverImage = user.cover;
      }
      return me;
    }
    ensureMeProfile();

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
            <div class="media-play"><i data-lucide="play"></i></div>
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
          <button class="menu-btn" onclick="event.stopPropagation();openPostMenu(${p.id})"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chart-no-axes-gantt preview-icon"><path d="M6 5h12"/><path d="M4 12h10"/><path d="M12 19h8"/></svg></button>
        </div>
        ${media}
        <div class="post-body">
          <p>${p.text}</p>
          <div class="post-time">${p.time}</div>
          <div class="tags">${p.tags}</div>
        </div>
        <div class="post-actions">
          <div class="left-actions">
            <button class="action${liked ? ' liked' : ''}" data-act="like" data-post-id="${p.id}" onclick="event.stopPropagation();toggleLike(this)"><i data-lucide="heart"></i><span>${p.likes}</span></button>
            <button class="action" data-comment-id="${p.id}" onclick="event.stopPropagation();openPostComments(${p.id})"><i data-lucide="message-circle"></i><span>${p.comments}</span></button>
            <button class="action${reposted ? ' reposted' : ''}" data-act="repost" data-post-id="${p.id}" onclick="event.stopPropagation();toggleRepost(this)"><i data-lucide="repeat-2"></i><span>${p.reposts}</span></button>
            <button class="action" onclick="event.stopPropagation();sharePostLink(${p.id})"><i data-lucide="share-2"></i></button>
          </div>
          <div class="right-actions">
            <button class="action${saved ? ' saved' : ''}" data-act="save" data-post-id="${p.id}" onclick="event.stopPropagation();toggleSave(this)"><i data-lucide="bookmark"></i></button>
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
          ${list.map(p => `<div class="pc-user">
            <button class="pc-user-top" onclick="openUserProfile('${p.name}')">
              <span class="pc-avatar" style="background:${p.avatarColor}">${p.initials}</span>
              <span class="pc-name">${p.name}</span>
            </button>
            <button class="pc-follow${p.following ? ' following' : ''}" data-name="${p.name}" onclick="toggleCarouselFollow('${p.name}', this)">${p.following ? 'Following' : 'Follow'}</button>
          </div>`).join('')}
        </div>
      </div>`;
    }

    function toggleCarouselFollow(name, btn) {
      const p = findProfile(name);
      if (!p) return;
      p.following = !p.following;
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
    }

    function renderFeed() {
      document.getElementById('feed').innerHTML = posts
        .map((p, i) => postCard(p) + (i % 3 === 0 && i < posts.length - 1 ? peopleCarousel() : ''))
        .join('');
      lucide.createIcons();
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
      const q = filter.trim().toLowerCase();
      const list = chats.filter(c => !q || c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q));
      const el = document.getElementById('chatList');
      let html = '';
      if (!q && messageRequests.length) {
        html += `<button class="chat-requests" onclick="openRequests()">
          <span class="chat-requests-icon"><i data-lucide="inbox"></i></span>
          <div class="chat-meta">
            <div class="row"><b>Message requests</b></div>
            <p>From people you don't follow</p>
          </div>
          <span class="chat-unread">${messageRequests.length}</span>
        </button>`;
      }
      html += list.map(c => `
        <button class="chat-item" onclick="openThread('${c.id}')">
          <div class="chat-avatar" style="background:${c.color}" onclick="event.stopPropagation();openUserProfile('${c.name}')" title="View profile">
            ${c.initials}
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
      lucide.createIcons();
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
          <span class="ps-user-action"><i data-lucide="message-circle"></i></span>
        </button>`;
      let html = '';
      if (followed.length) html += '<div class="cg-label">Following</div>' + followed.map(row).join('');
      if (others.length) html += '<div class="cg-label">Other members</div>' + others.map(row).join('');
      if (!people.length) html = '<div class="cg-empty">No people found</div>';
      document.getElementById('peopleSearchList').innerHTML = html;
      lucide.createIcons();
    }

    function startChatWith(name) {
      const p = profiles.find(x => x.name === name);
      if (!p) return;
      let chat = chats.find(c => c.name === name);
      if (!chat) {
        chat = {
          id: 'c' + Date.now(), name: p.name, initials: p.initials, color: p.avatarColor,
          online: true, time: 'Now', preview: 'Start the conversation', unread: 0, messages: []
        };
        chats.unshift(chat);
      }
      closePeopleSearch();
      openThread(chat.id);
      renderChats(document.getElementById('chatSearch').value);
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
      lucide.createIcons();
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
      media.innerHTML = '<i data-lucide="image-plus"></i><span>Add photo or video</span>';
      document.querySelectorAll('.pc-tag').forEach(t => t.classList.remove('active'));
      lucide.createIcons();
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
    async function uploadPostMedia(file) {
      if (!supabaseClient || !file) return null;
      try {
        const raw = (file.name || '').replace(/[^a-z0-9._-]/gi, '_');
        const ext = raw.indexOf('.') > -1 ? raw.split('.').pop() : (String(file.type || '').indexOf('video') === 0 ? 'mp4' : 'jpg');
        const path = 'posts/' + Date.now() + '_' + Math.random().toString(36).slice(2, 9) + '.' + ext;
        const { error } = await supabaseClient.storage.from('media').upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (error) { console.warn('Supabase media upload notice:', error.message); return null; }
        const { data } = supabaseClient.storage.from('media').getPublicUrl(path);
        return (data && data.publicUrl) || null;
      } catch (err) {
        console.warn('Supabase media upload notice:', err && err.message);
        return null;
      }
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
            supabaseClient.from('posts').update({ text: ep.text, tags: ep.tags }).eq('id', editingPostId).then();
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
        icon: 'sun',
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
            const publicUrl = await uploadPostMedia(mediaFile);
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
    let regCoverData = '';
    const PRAISE = {
      male: ['Nkosana', 'Nhlalisuthi'],
      female: ['Nkosazane', 'Ntethelelo', 'Ntabayepheza', 'Jamengweni']
    };

    function isAuthed() {
      if (authUser) return true;
      try { return !!(localStorage.getItem('nazarethaUser') || localStorage.getItem('nazarethaSession')); } catch (e) { return false; }
    }

    function resetAuthForms() {
      regGender = '';
      regPraise = '';
      regAvatarData = '';
      regCoverData = '';
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
      if (!flow) return;
      const close = document.getElementById('authClose');
      if (close) close.hidden = !isAuthed();
      resetAuthForms();
      flow.classList.add('open');
      flow.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      showAuth(screen);
      lucide.createIcons();
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
      lucide.createIcons();
    }

    function closeAuth() {
      const flow = document.getElementById('authFlow');
      if (!flow) return;
      flow.classList.remove('open');
      flow.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
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
      btn.innerHTML = `<i data-lucide="${show ? 'eye-off' : 'eye'}"></i>`;
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      lucide.createIcons();
    }

    function submitLogin(e) {
      if (e) e.preventDefault();
      const id = document.getElementById('loginId').value.trim();
      const pass = document.getElementById('loginPassword').value;
      if (!id) return showToast('Enter your email or phone');
      if (pass.length < 6) return showToast('Password must be at least 6 characters');

      const finish = (user, label) => {
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
        const fallbackName = (id.split('@')[0] || 'Member').replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
          finish(null, 'Welcome back, ' + ((me && me.name) || 'friend'));
        })
        .catch(() => localFallback());
    }

    function submitForgot(e) {
      if (e) e.preventDefault();
      const id = document.getElementById('forgotId').value.trim();
      if (!id) return showToast('Enter your email or phone');
      document.getElementById('forgotForm').hidden = true;
      document.getElementById('forgotSuccess').hidden = false;
      document.getElementById('forgotSwitch').hidden = true;
      showToast('Reset link sent');
      lucide.createIcons();
    }

    function logout() {
      if (supabaseClient) {
        try { Promise.resolve(supabaseClient.auth.signOut()).catch(err => console.warn('Supabase signOut notice:', err && err.message)); } catch (e) {}
      }
      authUser = null;
      try {
        localStorage.removeItem('nazarethaUser');
        localStorage.removeItem('nazarethaSession');
      } catch (e) {}
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
        } else if (type === 'cover') {
          regCoverData = dataUrl;
          const img = document.getElementById('regCoverImg');
          const icon = document.getElementById('regCoverIcon');
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
      } else if (step === 9) {
        showAuth('reg-cover');
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
        cover: regCoverData || ''
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
        coverImage: regCoverData || me.coverImage || '',
        bio: 'Walking the Shembe path with amaNazaretha.',
        type: 'Member',
        followers: me.followers || 0,
        followingCount: me.followingCount || 0,
        following: false,
        me: true
      });

      try {
        localStorage.setItem('nazarethaUser', JSON.stringify(data));
        localStorage.setItem('nazarethaSession', '1');
      } catch (err) {}

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
          coverImage: regCoverData || null,
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
    }

    function renderRequests() {
      const box = document.getElementById('requestsList');
      if (!messageRequests.length) {
        box.innerHTML = '<div class="cg-empty">No message requests</div>';
        return;
      }
      box.innerHTML = messageRequests.map(r => `
        <div class="req-row">
          <div class="chat-avatar" style="background:${r.color}">${r.initials}</div>
          <div class="req-meta"><b>${r.name}</b><span>${r.preview}</span></div>
          <div class="req-actions">
            <button class="accept" onclick="acceptRequest('${r.id}')" aria-label="Accept request"><i data-lucide="check"></i></button>
            <button onclick="deleteRequest('${r.id}')" aria-label="Delete request"><i data-lucide="x"></i></button>
          </div>
        </div>`).join('');
      lucide.createIcons();
    }

    function acceptRequest(id) {
      const i = messageRequests.findIndex(r => r.id === id);
      if (i < 0) return;
      const req = messageRequests.splice(i, 1)[0];
      const chat = { ...req, id: 'c' + Date.now(), unread: 0 };
      chats.unshift(chat);
      closeRequests();
      renderChats(document.getElementById('chatSearch').value);
      openThread(chat.id);
      showToast(`Accepted ${req.name}'s request`);
    }

    function deleteRequest(id) {
      const i = messageRequests.findIndex(r => r.id === id);
      if (i < 0) return;
      messageRequests.splice(i, 1);
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
      const chat = chats.find(c => c.id === id);
      if (!chat) return;
      cancelVoiceRecording();
      clearTimeout(typingTimer);
      activeChatId = id;
      chat.unread = 0;
      chat.typing = false;
      document.getElementById('threadName').textContent = chat.name;
      const av = document.getElementById('threadAvatar');
      av.style.background = chat.color;
      av.textContent = chat.initials;
      const status = document.getElementById('threadStatus');
      status.textContent = chat.online ? 'Online' : 'Last seen recently';
      status.classList.remove('typing');
      renderThread(chat);
      document.getElementById('chatThread').classList.add('open');
      document.body.style.overflow = 'hidden';
      lucide.createIcons();
      setTimeout(() => {
        const box = document.getElementById('threadMessages');
        box.scrollTop = box.scrollHeight;
      }, 50);
      renderChats(document.getElementById('chatSearch').value);
      setTimeout(() => {
        if (activeChatId !== id) return;
        let changed = false;
        chat.messages.forEach(m => { if (m.from === 'me' && !m.read) { m.read = true; changed = true; } });
        if (changed) renderThread(chat);
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
          <span class="voice-play"><i data-lucide="play"></i></span>
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
      lucide.createIcons();
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
      const chat = chats.find(c => c.id === activeChatId);
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
      const chat = chats.find(c => c.id === activeChatId);
      if (!chat) return;
      chat.messages.push({ from: 'me', text, time: nowTimeLabel(), read: false });
      chat.preview = text;
      chat.time = 'Just now';
      input.value = '';
      renderThread(chat);
      const box = document.getElementById('threadMessages');
      box.scrollTop = box.scrollHeight;
      renderChats(document.getElementById('chatSearch').value);
      simulateTyping(chat);
    }

    function simulateTyping(chat) {
      clearTimeout(typingTimer);
      chat.typing = true;
      renderChats(document.getElementById('chatSearch').value);
      const status = document.getElementById('threadStatus');
      if (activeChatId === chat.id) {
        status.textContent = 'typing…';
        status.classList.add('typing');
        const box = document.getElementById('threadMessages');
        if (!document.getElementById('typingBubble')) {
          const bubble = document.createElement('div');
          bubble.id = 'typingBubble';
          bubble.className = 'bubble them typing';
          bubble.innerHTML = '<span></span><span></span><span></span>';
          box.appendChild(bubble);
        }
        box.scrollTop = box.scrollHeight;
      }
      typingTimer = setTimeout(() => {
        chat.typing = false;
        const b = document.getElementById('typingBubble');
        if (b) b.remove();
        if (activeChatId === chat.id) {
          chat.messages.forEach(m => { if (m.from === 'me') m.read = true; });
          renderThread(chat);
          const box2 = document.getElementById('threadMessages');
          box2.scrollTop = box2.scrollHeight;
          status.classList.remove('typing');
          status.textContent = chat.online ? 'Online' : 'Last seen recently';
        }
        renderChats(document.getElementById('chatSearch').value);
      }, 1900);
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
      mic.innerHTML = '<i data-lucide="check"></i>';
      lucide.createIcons();
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
      const chat = chats.find(c => c.id === activeChatId);
      if (!chat) return;
      const label = '0:' + String(dur).padStart(2, '0');
      chat.messages.push({ from: 'me', voice: { duration: label }, time: nowTimeLabel(), read: false });
      chat.preview = 'Voice note';
      chat.time = 'Just now';
      renderThread(chat);
      const box = document.getElementById('threadMessages');
      box.scrollTop = box.scrollHeight;
      renderChats(document.getElementById('chatSearch').value);
      simulateTyping(chat);
    }

    function resetVoiceComposer() {
      const mic = document.getElementById('micBtn');
      const input = document.getElementById('threadInput');
      mic.classList.remove('recording');
      mic.innerHTML = '<i data-lucide="mic"></i>';
      input.disabled = false;
      input.placeholder = 'Message...';
      document.getElementById('recTimer').classList.add('hidden');
      document.getElementById('recTimer').textContent = '0:00';
      lucide.createIcons();
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
      const chat = chats.find(c => c.id === activeChatId);
      if (!chat) return;
      const isVideo = file.type.startsWith('video/');
      chat.messages.push({
        from: 'me', media: { type: isVideo ? 'video' : 'image', src: URL.createObjectURL(file) },
        time: nowTimeLabel(), read: false
      });
      chat.preview = isVideo ? 'Video' : 'Photo';
      chat.time = 'Just now';
      renderThread(chat);
      const box = document.getElementById('threadMessages');
      box.scrollTop = box.scrollHeight;
      renderChats(document.getElementById('chatSearch').value);
      simulateTyping(chat);
    }

    // ============================================================
    //  REELS RENDER
    // ============================================================
    function reelCard(reel, index, total) {
      const liked = reel.liked || false;
      const reposted = reel.reposted || false;
      const saved = reel.saved || false;
      const following = reel.following || false;
      return `<div class="reel" data-reel-id="${reel.id}">
        <video class="reel-video" src="${reel.video}" loop muted playsinline preload="metadata"></video>
        <div class="reel-index">
          ${Array.from({ length: total }, (_, i) => `<span class="${i === index ? 'active' : ''}"></span>`).join('')}
        </div>
        <div class="reel-overlay">
          <div class="reel-info">
            <div class="reel-user-row" onclick="event.stopPropagation();openUserProfile('${reel.username}')">
              <div class="reel-avatar" style="background:${reel.avatarColor}">${reel.initials}</div>
              <div class="reel-user-meta">
                <div class="reel-username">
                  ${reel.username}
                  ${reel.verified ? '<i data-lucide="badge-check" class="verified"></i>' : ''}
                </div>
                <button class="reel-follow ${following ? 'following' : ''}" onclick="event.stopPropagation();toggleFollow(this, '${reel.id}')">
                  ${following ? 'Following' : 'Follow'}
                </button>
              </div>
            </div>
            <div class="reel-desc">${reel.description}</div>
            <div class="reel-tags">${reel.tags}</div>
            ${reel.location ? `<div class="reel-loc"><i data-lucide="map-pin"></i>${reel.location}</div>` : ''}
            <div class="reel-music"><i data-lucide="music-2"></i>${reel.music}</div>
          </div>
        </div>

        <div class="reel-rail">
          <button class="reel-action ${liked ? 'liked' : ''}" onclick="toggleReelLike(this, '${reel.id}')">
            <div class="icon-circle"><i data-lucide="heart"></i></div>
            <span class="count">${reel.likes}</span>
          </button>
          <button class="reel-action" onclick="openComments('${reel.id}')">
            <div class="icon-circle"><i data-lucide="message-circle"></i></div>
            <span class="count">${reel.comments}</span>
          </button>
          <button class="reel-action ${reposted ? 'reposted' : ''}" onclick="toggleReelRepost(this, '${reel.id}')">
            <div class="icon-circle"><i data-lucide="repeat-2"></i></div>
            <span class="count">${reel.reposts}</span>
          </button>
          <button class="reel-action" onclick="shareReel('${reel.id}')">
            <div class="icon-circle"><i data-lucide="share-2"></i></div>
          </button>
          <button class="reel-action ${saved ? 'saved' : ''}" onclick="toggleReelSave(this, '${reel.id}')">
            <div class="icon-circle"><i data-lucide="bookmark"></i></div>
          </button>
          <button class="reel-action reel-more" onclick="openReelMenu()">
            <div class="icon-circle"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chart-no-axes-gantt preview-icon"><path d="M6 5h12"/><path d="M4 12h10"/><path d="M12 19h8"/></svg></div>
          </button>
        </div>
      </div>`;
    }

    let reelFeed = 'foryou';
    let reelFilter = { type: 'all', value: 'All' };
    const reelFeedFilters = [
      { type: 'topic', value: 'Worship', icon: 'hash' },
      { type: 'topic', value: 'Choir', icon: 'hash' },
      { type: 'topic', value: 'Faith', icon: 'hash' },
      { type: 'topic', value: 'Sermon', icon: 'hash' },
      { type: 'topic', value: 'Youth', icon: 'hash' },
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
      box.innerHTML = `<button type="button" class="reels-chip ${allActive ? 'active' : ''}" onclick="setReelFilter('all', 'All')"><i data-lucide="sparkles"></i>All</button>`
        + reelFeedFilters.map(f => `
          <button type="button" class="reels-chip ${reelFilter.type === f.type && reelFilter.value === f.value ? 'active' : ''}"
            onclick="setReelFilter('${f.type}', '${f.value}')"><i data-lucide="${f.icon}"></i>${f.value}</button>`).join('');
      lucide.createIcons();
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
      const list = reelFeedList();
      feed.scrollTop = 0;
      feed.innerHTML = list.length
        ? list.map((r, i) => reelCard(r, i, list.length)).join('')
        : emptyReelsHtml();
      lucide.createIcons();
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
            <div class="sr-avatar"><i data-lucide="${u.icon}"></i></div>
            <div class="sr-meta"><b>${u.name}</b><span>${u.sub}</span></div>
            <span class="sr-tag">User</span>
          </button>`).join('');
      }
      if (showPosts && postHits.length) {
        html += '<div class="search-section-label">Posts</div>';
        html += postHits.map(p => `
          <button class="search-result" onclick="openDetail(${p.id})">
            <div class="sr-avatar sq"><i data-lucide="${p.icon}"></i></div>
            <div class="sr-meta"><b>${p.title}</b><span>${p.text}</span></div>
            <span class="sr-tag">Post</span>
          </button>`).join('');
      }
      if (showPhotos && photoHits.length) {
        html += '<div class="search-section-label">Photos</div>';
        html += '<div class="search-grid">' + photoHits.slice(0, 9).map(p => `
          <button class="tile" onclick="${typeof p.id === 'number' ? `openDetail(${p.id})` : `showToast('Photo')`}">
            <i data-lucide="${p.icon}"></i>
          </button>`).join('') + '</div>';
      }
      if (showReels && reelHits.length) {
        html += '<div class="search-section-label">Reels</div>';
        html += reelHits.map(r => `
          <button class="search-result" onclick="go('reels')">
            <div class="sr-avatar sq"><i data-lucide="clapperboard"></i></div>
            <div class="sr-meta"><b>${r.username}</b><span>${r.description}</span></div>
            <span class="sr-tag">Reel</span>
          </button>`).join('');
      }
      if (!html) html = '<div class="search-empty">No results for “' + q + '”</div>';
      box.innerHTML = html;
      lucide.createIcons();
    }
    let currentPage = 'home';
    function go(page) {
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
        document.getElementById('reels').classList.remove('hidden');
        pages.forEach(p => document.getElementById(p).classList.add('hidden'));
        renderReels();
      } else {
        document.body.classList.remove('reels-active');
        document.getElementById('reels').classList.add('hidden');
        closeThread();
        pages.forEach(p => document.getElementById(p).classList.toggle('hidden', p !== page));
        if (page === 'home') renderFeed();
        if (page === 'events') renderEvents();
        if (page === 'profile') { renderMyProfile(); renderProfileGrid(); }
        if (page === 'messages') renderChats(document.getElementById('chatSearch').value);
        if (page === 'search') {
          runSearch();
          setTimeout(() => document.getElementById('globalSearch')?.focus(), 80);
        }
        if (page === 'notifications') renderNotifications();
      }
      document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.page === page);
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      lucide.createIcons();
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

    const ENGAGEMENT_KEYS = { liked: 'nazarethaLikes', saved: 'nazarethaSaved', reposted: 'nazarethaReposts' };

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
        : `<i data-lucide="${p.icon}"></i>`;
      return `<button class="profile-cell" onclick="openDetail(${p.id})" aria-label="${p.title || 'Post'}">
        ${media}
        <span class="pc-badge"><i data-lucide="heart"></i>${p.likes}</span>
      </button>`;
    }

    function reelCell(r) {
      return `<button class="profile-cell" onclick="go('reels')" aria-label="Reel by ${r.username}">
        <video src="${r.video}" muted playsinline preload="metadata"></video>
        <span class="pc-badge"><i data-lucide="play"></i>${r.likes}</span>
      </button>`;
    }

    function gridHtml(tab) {
      if (tab === 'posts') return posts.map(postCell).join('');
      if (tab === 'videos') return reels.map(reelCell).join('') + posts.filter(p => p.video).map(postCell).join('');
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
      box.innerHTML = gridHtml(profileTab);
      lucide.createIcons();
    }

    function renderUpGrid() {
      const box = document.getElementById('upGrid');
      if (!box) return;
      box.innerHTML = gridHtml(upTab);
      lucide.createIcons();
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
        if (me.avatarImage) {
          av.style.backgroundImage = `url("${me.avatarImage}")`;
          av.style.backgroundColor = 'transparent';
          av.textContent = '';
        } else {
          av.style.backgroundImage = '';
          av.style.backgroundColor = me.avatarColor || '#0c0c0c';
          av.textContent = me.initials || 'A';
        }
      }
      const banner = document.getElementById('myCoverBanner');
      if (banner) {
        if (me.coverImage) {
          banner.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.45)), url("${me.coverImage}")`;
        } else {
          banner.style.backgroundImage = `linear-gradient(135deg, #181d24 0%, #0c0c0c 100%)`;
        }
      }
      const nameEl = document.getElementById('myName');
      if (nameEl) nameEl.innerHTML = me.name + (me.verified ? ' <i data-lucide="badge-check"></i>' : '');
      const roleEl = document.getElementById('myRole');
      if (roleEl) roleEl.textContent = me.temple || 'eBuhleni';
      const bioEl = document.getElementById('myBio');
      if (bioEl) bioEl.textContent = me.bio;
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      const ownPosts = authUser ? posts.filter(p => p.userId === authUser.id).length : posts.length;
      set('myPosts', ownPosts);
      set('myFollowers', compactCount(me.followers || 0));
      set('myFollowing', compactCount(me.followingCount || 0));
      lucide.createIcons();
    }

    let editAvatarData = '';
    let editCoverData = '';

    function openEditProfile() {
      const me = ensureMeProfile();
      if (!me) return;
      document.getElementById('editName').value = me.name || '';
      document.getElementById('editBio').value = me.bio || '';
      editAvatarData = me.avatarImage || '';
      editCoverData = me.coverImage || '';
      const avThumb = document.getElementById('editAvatarThumb');
      if (avThumb) {
        if (me.avatarImage) {
          avThumb.style.backgroundImage = `url("${me.avatarImage}")`;
          avThumb.innerHTML = '';
        } else {
          avThumb.style.backgroundImage = '';
          avThumb.innerHTML = '<i data-lucide="camera" style="width:20px;height:20px"></i>';
        }
      }
      const cvThumb = document.getElementById('editCoverThumb');
      if (cvThumb) {
        if (me.coverImage) {
          cvThumb.style.backgroundImage = `url("${me.coverImage}")`;
          cvThumb.innerHTML = '';
        } else {
          cvThumb.style.backgroundImage = '';
          cvThumb.innerHTML = '<i data-lucide="image" style="width:20px;height:20px"></i>';
        }
      }
      document.getElementById('editProfileOverlay').classList.add('open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => document.getElementById('editName').focus(), 250);
      lucide.createIcons();
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
        if (type === 'avatar') {
          editAvatarData = dataUrl;
          const avThumb = document.getElementById('editAvatarThumb');
          if (avThumb) { avThumb.style.backgroundImage = `url("${dataUrl}")`; avThumb.innerHTML = ''; }
        } else {
          editCoverData = dataUrl;
          const cvThumb = document.getElementById('editCoverThumb');
          if (cvThumb) { cvThumb.style.backgroundImage = `url("${dataUrl}")`; cvThumb.innerHTML = ''; }
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
        if (type === 'avatar') {
          me.avatarImage = dataUrl;
          local.avatar = dataUrl;
          posts.forEach(p => {
            if (p.isMe || (authUser && p.userId === authUser.id) || p.author === oldName || p.author === 'Member' || !p.author) {
              p.authorAvatar = dataUrl;
            }
          });
          renderFeed();
          showToast('Profile photo updated');
        } else {
          me.coverImage = dataUrl;
          local.cover = dataUrl;
          showToast('Cover photo updated');
        }
        try { localStorage.setItem('nazarethaUser', JSON.stringify(local)); } catch (err) {}
        renderMyProfile();
        if (supabaseClient) {
          uploadPostMedia(file).then(url => {
            if (url) {
              const patch = type === 'avatar' ? { avatarImage: url } : { coverImage: url };
              const uid = me.user_id || (authUser && authUser.id);
              if (uid) {
                supabaseClient.from('profiles').update(patch).eq('user_id', uid).then();
                if (type === 'avatar') {
                  supabaseClient.from('posts').update({ author_avatar: url }).eq('user_id', uid).then();
                }
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
      if (editCoverData) me.coverImage = editCoverData;

      // Update local storage user
      const local = readLocalUser() || {};
      local.name = me.name;
      local.first = me.first;
      local.surname = me.surname;
      local.bio = me.bio;
      if (me.avatarImage) local.avatar = me.avatarImage;
      if (me.coverImage) local.cover = me.coverImage;
      try { localStorage.setItem('nazarethaUser', JSON.stringify(local)); } catch (e) {}

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
        if (me.coverImage) patch.coverImage = me.coverImage;
        const uid = me.user_id || (authUser && authUser.id);
        if (uid) {
          supabaseClient.from('profiles').update(patch).eq('user_id', uid).then();
          supabaseClient.from('posts').update({
            author_name: me.name,
            author_initials: me.initials,
            author_avatar: me.avatarImage || null
          }).eq('user_id', uid).then();
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
      lucide.createIcons();
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
      showToast(ev.reminded ? `Reminder set for ${ev.title}` : 'Reminder removed');
      renderEvents();
      if (activeEventId === ev.id) syncEventRemind();
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
      document.getElementById('upBanner').style.background = p.banner;
      const av = document.getElementById('upAvatar');
      av.style.background = p.avatarColor;
      av.textContent = p.initials;
      document.getElementById('upName').innerHTML = p.name + (p.verified ? ' <i data-lucide="badge-check"></i>' : '');
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
      lucide.createIcons();
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
      p.followers += p.following ? 1 : -1;
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
    }

    function messageProfile() {
      const p = profiles.find(x => x.name === activeProfileName);
      if (!p) return;
      let chat = chats.find(c => c.name === p.name);
      if (!chat) {
        chat = {
          id: 'c' + Date.now(), name: p.name, initials: p.initials, color: p.avatarColor,
          online: true, time: 'Now', preview: 'Start the conversation', unread: 0, messages: []
        };
        chats.push(chat);
      }
      closeUserProfile();
      openThread(chat.id);
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
      if (open) lucide.createIcons();
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
      lucide.createIcons();
    }

    function openAboutProfile() {
      const p = profiles.find(x => x.name === activeProfileName);
      if (!p) return;
      const av = document.getElementById('aboutAvatar');
      av.style.background = p.avatarColor;
      av.textContent = p.initials;
      document.getElementById('aboutName').innerHTML = p.name + (p.verified ? ' <i data-lucide="badge-check"></i>' : '');
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
      lucide.createIcons();
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
      lucide.createIcons();
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
      lucide.createIcons();
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
          <span class="cg-user-check"><i data-lucide="check"></i></span>
        </button>
      `).join('');
      lucide.createIcons();
      updateCreateGroupBtn();
    }

    function updateCreateGroupBtn() {
      document.getElementById('cgCreateBtn').disabled = groupSelected.size === 0;
    }

    function createGroupChat() {
      const members = profiles.filter(p => groupSelected.has(p.name));
      if (!members.length) return;
      const firstNames = members.map(p => p.name.split(' ')[0]);
      const title = firstNames.length <= 2
        ? firstNames.join(' & ')
        : `${firstNames[0]}, ${firstNames[1]} & ${firstNames.length - 2} others`;
      const id = 'g' + Date.now();
      chats.unshift({
        id,
        name: title,
        initials: members[0].initials,
        color: members[0].avatarColor,
        online: false,
        time: 'Now',
        preview: (groupType === 'private' ? 'Private group' : 'Public community') + ` · ${members.length + 1} members`,
        unread: 0,
        messages: [
          { from: 'them', text: (groupType === 'private' ? 'Private group' : 'Public community') + ' created. Say hello!', time: 'Now' }
        ]
      });
      closeCreateGroup();
      renderChats(document.getElementById('chatSearch').value);
      openThread(id);
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
        profile.followers += reel.following ? 1 : -1;
        document.querySelectorAll(`.pc-follow[data-name="${profile.name}"]`).forEach(b => {
          b.classList.toggle('following', profile.following);
          b.textContent = profile.following ? 'Following' : 'Follow';
        });
        if (activeProfileName === profile.name) {
          syncProfileFollowBtn(profile);
          renderProfileStats(profile);
        }
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
      btn.querySelector('svg').style.fill = reel.liked ? '#ff5c7a' : 'none';
    }

    function toggleReelRepost(btn, reelId) {
      const reel = reels.find(r => r.id === reelId);
      if (!reel) return;
      reel.reposted = !reel.reposted;
      btn.classList.toggle('reposted', reel.reposted);
      const countEl = btn.querySelector('.count');
      reel.reposts += reel.reposted ? 1 : -1;
      countEl.textContent = reel.reposts;
      btn.querySelector('svg').style.fill = reel.reposted ? '#22c55e' : 'none';
      showToast(reel.reposted ? 'Reposted' : 'Repost removed');
    }

    function toggleReelSave(btn, reelId) {
      const reel = reels.find(r => r.id === reelId);
      if (!reel) return;
      reel.saved = !reel.saved;
      btn.classList.toggle('saved', reel.saved);
      btn.querySelector('svg').style.fill = reel.saved ? '#f0c75e' : 'none';
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
      lucide.createIcons();
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
      lucide.createIcons();
    }

    function renderComments(key) {
      const comments = (currentPostId !== null ? postComments[currentPostId] : reelComments[key]) || [];
      const list = document.getElementById('commentsList');
      if (comments.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px 20px;font-size:13px">No comments yet. Be the first to comment!</div>';
        return;
      }
      list.innerHTML = comments.map((c, i) => `
        <div class="comment">
          <div class="comment-avatar" onclick="openUserFromComments('${c.user}')">${c.initials}</div>
          <div class="comment-body">
            <div class="comment-user" onclick="openUserFromComments('${c.user}')">${c.user} <span class="time">${c.time}</span></div>
            <div class="comment-text">${c.text}</div>
            <div class="comment-actions">
              <button class="${c.liked ? 'liked' : ''}" onclick="likeComment('${key}', ${i}, this)">
                <i data-lucide="heart" class="comment-like-icon"></i> ${c.likes}
              </button>
              <button onclick="startReply('${c.user}')">Reply</button>
            </div>
          </div>
        </div>
      `).join('');
      lucide.createIcons();
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
      btn.innerHTML = `<i data-lucide="heart" class="comment-like-icon"></i> ${c.likes}`;
      lucide.createIcons();
    }

    async function postComment() {
      const input = document.getElementById('commentInput');
      const text = input.value.trim();
      if (!text || (currentReelId === null && currentPostId === null)) return;

      const actor = currentActor();
      let list, total;
      if (currentPostId !== null) {
        if (!postComments[currentPostId]) postComments[currentPostId] = [];
        list = postComments[currentPostId];
        const pending = { user: actor.name, initials: actor.initials, time: 'Just now', text, likes: 0, liked: false };
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
        list.unshift({ user: actor.name, initials: actor.initials, time: 'Just now', text, likes: 0, liked: false });
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
    function openReelMenu() {
      document.getElementById('reelMenuSheet').classList.add('open');
      document.getElementById('sheetBackdrop').classList.add('show');
      document.body.style.overflow = 'hidden';
      lucide.createIcons();
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
      btn.querySelector('svg').style.fill = l ? 'currentColor' : 'none';
      if (n) n.textContent = c + (l ? 1 : -1);
      const pid = Number(btn.dataset.postId);
      if (pid) {
        const p = posts.find(x => x.id === pid);
        if (p) p.likes += l ? 1 : -1;
        if (l) likedPostIds.add(pid); else likedPostIds.delete(pid);
        saveEngagementState(); savePostsLocal();
        syncPostCards(pid);

        // Sync like count to Supabase if post exists in DB
        if (supabaseClient && p) {
          supabaseClient.from('posts').update({ likes: Math.max(0, p.likes) }).eq('id', pid).then(({ error }) => {
            if (error) console.warn('Supabase post like sync notice:', error.message);
          });
        }
      }
    }
    function toggleRepost(btn) {
      const n = btn.querySelector('span');
      let c = parseInt(n.textContent || '0');
      const r = btn.classList.toggle('reposted');
      btn.querySelector('svg').style.fill = r ? 'currentColor' : 'none';
      if (n) n.textContent = c + (r ? 1 : -1);
      const pid = Number(btn.dataset.postId);
      if (pid) {
        const p = posts.find(x => x.id === pid);
        if (p) p.reposts += r ? 1 : -1;
        if (r) repostedPostIds.add(pid); else repostedPostIds.delete(pid);
        saveEngagementState(); savePostsLocal();
        syncPostCards(pid);

        // Sync repost count to Supabase if post exists in DB
        if (supabaseClient && p) {
          supabaseClient.from('posts').update({ reposts: Math.max(0, p.reposts) }).eq('id', pid).then(({ error }) => {
            if (error) console.warn('Supabase post repost sync notice:', error.message);
          });
        }
      }
      showToast(r ? 'Reposted' : 'Repost removed');
    }
    function toggleSave(btn) {
      const s = btn.classList.toggle('saved');
      btn.querySelector('svg').style.fill = s ? 'currentColor' : 'none';
      const pid = Number(btn.dataset.postId);
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
        btn.querySelector('svg').style.fill = liked ? 'currentColor' : 'none';
      });
      document.querySelectorAll(`.post [data-act="repost"][data-post-id="${id}"]`).forEach(btn => {
        btn.classList.toggle('reposted', reposted);
        btn.querySelector('span').textContent = p.reposts;
        btn.querySelector('svg').style.fill = reposted ? 'currentColor' : 'none';
      });
      document.querySelectorAll(`.post [data-act="save"][data-post-id="${id}"]`).forEach(btn => {
        btn.classList.toggle('saved', saved);
        btn.querySelector('svg').style.fill = saved ? 'currentColor' : 'none';
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
      lucide.createIcons();
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
      if (supabaseClient) supabaseClient.from('posts').delete().eq('id', id).then();
    }
    function openAppMenu() {
      updateBadge();
      document.getElementById('appMenuOverlay').classList.add('open');
      lucide.createIcons();
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
      likeBtn.querySelector('svg').style.fill = liked ? 'currentColor' : 'none';
      const repostBtn = document.getElementById('detailRepost');
      const reposted = repostedPostIds.has(id);
      repostBtn.dataset.postId = id;
      repostBtn.querySelector('span').textContent = p.reposts;
      repostBtn.classList.toggle('reposted', reposted);
      repostBtn.querySelector('svg').style.fill = reposted ? 'currentColor' : 'none';
      const saveBtn = document.getElementById('detailSave');
      const saved = savedPostIds.has(id);
      saveBtn.dataset.postId = id;
      saveBtn.classList.toggle('saved', saved);
      saveBtn.querySelector('svg').style.fill = saved ? 'currentColor' : 'none';
      document.getElementById('detailComment').querySelector('span').textContent = p.comments;
      document.getElementById('postDetail').classList.add('open');
      document.body.style.overflow = 'hidden';
      lucide.createIcons();
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
        <button class="post-video-back" onclick="closePostVideo()" aria-label="Back">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left preview-icon"><path d="m15 18-6-6 6-6"/></svg>
        </button>
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
              <div class="icon-circle"><i data-lucide="heart"></i></div>
              <span class="count">${p.likes}</span>
            </button>
            <button class="reel-action" data-comment-id="${p.id}" onclick="openPostComments(${p.id})">
              <div class="icon-circle"><i data-lucide="message-circle"></i></div>
              <span class="count">${p.comments}</span>
            </button>
            <button class="reel-action${reposted ? ' reposted' : ''}" data-post-id="${p.id}" onclick="toggleRepost(this)">
              <div class="icon-circle"><i data-lucide="repeat-2"></i></div>
              <span class="count">${p.reposts}</span>
            </button>
            <button class="reel-action" onclick="sharePostLink(${p.id})">
              <div class="icon-circle"><i data-lucide="share-2"></i></div>
            </button>
            <button class="reel-action${saved ? ' saved' : ''}" data-post-id="${p.id}" onclick="toggleSave(this)">
              <div class="icon-circle"><i data-lucide="bookmark"></i></div>
            </button>
          </div>
        </div>`;
      player.classList.add('open');
      document.body.style.overflow = 'hidden';
      lucide.createIcons();
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
      document.getElementById('notifList').innerHTML = notifications.map((n, i) => `
        <div class="notif-item" onclick="markRead(${i})">
          <div class="notif-icon"><i data-lucide="${n.icon}"></i></div>
          <div style="flex:1"><b>${n.title}</b><p>${n.text}</p></div>
          <div style="display:flex;align-items:center"><span class="notif-time">${n.time}</span>${n.unread ? '<span class="notif-unread"></span>' : ''}</div>
        </div>`).join('');
      lucide.createIcons();
      updateBadge();
    }
    function updateBadge() {
      const c = notifications.filter(n => n.unread).length;
      const b = document.getElementById('notifBadge');
      if (b) {
        b.textContent = c;
        b.style.display = c ? 'grid' : 'none';
      }
      const m = document.getElementById('menuNotifBadge');
      if (m) {
        m.textContent = c;
        m.style.display = c ? 'inline-grid' : 'none';
      }
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
      notifications[i].unread = false;
      renderNotifications();
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

    document.getElementById('menuOverlay').addEventListener('click', e => {
      if (e.target.id === 'menuOverlay') closeMenu();
    });
    document.getElementById('appMenuOverlay').addEventListener('click', e => {
      if (e.target.id === 'appMenuOverlay') closeAppMenu();
    });
    document.getElementById('insightOverlay').addEventListener('click', e => {
      if (e.target.id === 'insightOverlay') closeInsight();
    });
    document.getElementById('editProfileOverlay').addEventListener('click', e => {
      if (e.target.id === 'editProfileOverlay') closeEditProfile();
    });
    document.getElementById('aboutProfileOverlay').addEventListener('click', e => {
      if (e.target.id === 'aboutProfileOverlay') closeAboutProfile();
    });
    document.getElementById('blockProfileOverlay').addEventListener('click', e => {
      if (e.target.id === 'blockProfileOverlay') closeBlockProfile();
    });
    document.getElementById('reportProfileOverlay').addEventListener('click', e => {
      if (e.target.id === 'reportProfileOverlay') closeReportProfile();
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.up-menu-wrap')) closeProfileMenu();
    });

    // ============================================================
    //  INIT
    // ============================================================
    document.querySelectorAll('[data-page]').forEach(b => {
      b.addEventListener('click', () => {
        if (b.dataset.page === 'create') return openCreatePanel();
        go(b.dataset.page);
      });
    });

    document.addEventListener('DOMContentLoaded', () => {
      loadSupabaseData();
      loadEngagementState();
      renderFeed();
      renderReels();
      renderReelChips();
      renderNotifications();
      renderChats();
      renderMyProfile();
      renderEvents();
      lucide.createIcons();
      // Restore the real Supabase session; only a fresh browser sees the gate
      (async () => {
        let session = null;
        try { session = await hydrateSession(); } catch (e) {}
        if (session) {
          try { await loadMyProfile(session.user); } catch (e) { console.warn('Profile restore notice:', e && e.message); }
          ensureMeProfile();
          renderMyProfile();
          closeAuth();
          return;
        }
        if (isAuthed()) {
          ensureMeProfile();
          renderMyProfile();
          closeAuth();
        } else {
          openAuth('welcome');
        }
      })();
    });