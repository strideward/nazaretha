const fs = require('fs');

const appJsPath = 'C:/Users/ntuth/.gemini/antigravity/scratch/app.js';
let code = fs.readFileSync(appJsPath, 'utf8').replace(/\r\n/g, '\n');

// Replace ensureMeProfile
const oldEnsure = `    function ensureMeProfile() {
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
        if (user && user.temple && (!me.temple || me.temple === 'eBuhleni')) me.temple = user.temple;
        if (user && user.preacher && !me.preacher) me.preacher = user.preacher;
        if (user && (user.avatar || user.avatarImage) && !me.avatarImage) me.avatarImage = user.avatar || user.avatarImage;
        if (user && user.cover && !me.coverImage) me.coverImage = user.cover;
      }
      // Use cover image as fallback for avatar if no avatar is set
      const av = me.avatarImage || (me.coverImage && me.coverImage.startsWith('data:image') ? me.coverImage : '');
      if (av && !me.avatarImage) me.avatarImage = av;
      return me;
    }`;

const newEnsure = `    function ensureMeProfile() {
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
    }`;

if (code.includes(oldEnsure)) {
  code = code.replace(oldEnsure, newEnsure);
  console.log('✓ ensureMeProfile replaced!');
} else {
  console.warn('✗ oldEnsure not matched');
}

// Replace register localStorage
const oldRegLs = `      try {
        localStorage.setItem('nazarethaUser', JSON.stringify(data));
        localStorage.setItem('nazarethaSession', '1');
      } catch (err) {}`;

const newRegLs = `      // Registered via Supabase Auth and Profiles table`;

if (code.includes(oldRegLs)) {
  code = code.replace(oldRegLs, newRegLs);
  console.log('✓ Register localStorage removed!');
} else {
  console.warn('✗ oldRegLs not matched');
}

fs.writeFileSync(appJsPath, code, 'utf8');
