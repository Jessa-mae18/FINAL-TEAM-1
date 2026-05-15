const Storage = {
  KEY: 'healthInsurance_portal_v2',
  cache: { users: {}, applications: [] },
 
  init() {
    const saved = localStorage.getItem(this.KEY);
    if (saved) {
      try { this.cache = JSON.parse(saved); }
      catch(e) { this.resetDefaults(); }
      // Ensure superadmin exists even if storage was created before the change
      if (!this.cache.users) this.cache.users = {};
      if (!this.cache.users['superadmin@gmail.com']) {
        this.cache.users['superadmin@gmail.com'] = {
          name: 'Super Administrator',
          email: 'superadmin@gmail.com',
          password: 'superadmin',
          role: 'superadmin',
          contact: '',
          createdAt: '2026-01-01'
        };
        this.save();
      }
    } else { this.resetDefaults(); }
  },
 
  resetDefaults() {
    this.cache = {
      users: {
        'admin@gmail.com': { name: 'Administrator', email: 'admin@gmail.com', password: 'admin', role: 'admin', contact: '', createdAt: '2026-01-01' },
        'superadmin@gmail.com': { name: 'Super Administrator', email: 'superadmin@gmail.com', password: 'superadmin', role: 'superadmin', contact: '', createdAt: '2026-01-01' },
        'user@egov.ph': { name: 'Juan Dela Cruz', email: 'user@egov.ph', password: 'user123', role: 'user', contact: '09123456789', createdAt: '2026-01-01' }
      },
      applications: []
    };
    this.save();
  },
 
  save() { localStorage.setItem(this.KEY, JSON.stringify(this.cache)); },
  getUsers() { return this.cache.users || {}; },
  getApplications() { return this.cache.applications || []; },
  saveUsers(users) { this.cache.users = users; this.save(); },
  saveApplications(apps) { this.cache.applications = apps; this.save(); }
};
 
/* ===== AUTH ===== */
const Auth = {
  SESSION_KEY: 'philhealth_session',
 
  getSession() { try { return JSON.parse(localStorage.getItem(this.SESSION_KEY)); } catch { return null; } },
  isLoggedIn() { return !!this.getSession(); },
  isAdmin() { const s = this.getSession(); return s && (s.role === 'admin' || s.role === 'superadmin'); },
 
  login(email, password) {
    const users = Storage.getUsers();
    const user = users[email.toLowerCase()];
    if (!user || user.password !== password) return { ok: false, msg: 'Invalid email or password.' };
    const session = { email: user.email, name: user.name, role: user.role };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return { ok: true, user: session };
  },
 
  register(email, password, name, phone = '') {
    const users = Storage.getUsers();
    if (users[email.toLowerCase()]) return { ok: false, msg: 'An account with this email already exists.' };
    users[email.toLowerCase()] = { email: email.toLowerCase(), password, name, role: 'user', contact: phone, createdAt: new Date().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) };
    Storage.saveUsers(users);
    return { ok: true };
  },
 
  logout() { localStorage.removeItem(this.SESSION_KEY); },
  deleteAccount(email) { const users = Storage.getUsers(); delete users[email.toLowerCase()]; Storage.saveUsers(users); this.logout(); },
  updateAccount(email, updates) { const users = Storage.getUsers(); if (users[email.toLowerCase()]) { Object.assign(users[email.toLowerCase()], updates); Storage.saveUsers(users); } }
};
 
/* ===== GLOBAL STATE ===== */
let currentPage = 'home';
let isLoginMode = true;
let currentStep = 1;
let selectedPlanId = 'STANDARD';
let selectedTime = '';
 
const PLANS = {
  BASIC: { name: 'Basic Coverage', icon: '🛡️', price: '₱0', priceText: 'Government-Subsidized (FREE)', monthly: 0, color: 'green' },
  STANDARD: { name: 'Standard Plan', icon: '💙', price: '₱300', priceText: '₱300–₱5,000/month', monthly: 300, color: 'blue' },
  PREMIUM: { name: 'Premium Plus', icon: '⭐', price: '₱2,400', priceText: '₱2,400/month', monthly: 2400, color: 'gold' }
};
 
/* ===== NAVIGATION ===== */
function navigate(page) {
  const session = Auth.getSession();
  const protectedPages = ['settings', 'application', 'tracking'];
  const adminPages = ['admin', 'accounts', 'control-panel', 'plans-management', 'workflow-controls', 'schedule-management', 'customization', 'user-security', 'technical-addons', 'plan-requests'];
 
  if (protectedPages.includes(page) && !session) {
    showToast('Please sign in to continue', 'info');
    showPage('login'); return;
  }
  if (adminPages.includes(page) && !Auth.isAdmin()) {
    showToast('Admin access required', 'error'); return;
  }
  showPage(page);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Close sidebar on mobile after navigation
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (sb && ov && window.innerWidth <= 768) {
    sb.classList.remove('active');
    ov.classList.remove('active');
  }
}
 
function showPage(page) {
  const session = Auth.getSession();
  if (page === 'home' && session) { showToast('Navigate using the sidebar', 'info'); return; }
  if (page === 'tracking' && !session) { showPage('login'); return; }
  const adminPages = ['admin', 'accounts', 'control-panel', 'plans-management', 'workflow-controls', 'schedule-management', 'customization', 'user-security', 'technical-addons', 'plan-requests'];
  if (adminPages.includes(page) && !Auth.isAdmin()) { return; }
 
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(page + '-page');
  if (el) {
    el.classList.add('active');
    currentPage = page;
    const nav = document.getElementById('main-nav');
    if (nav) nav.style.display = page === 'login' ? 'none' : '';
 
    document.querySelectorAll('.nav-links a[data-page]').forEach(a => a.classList.toggle('active', a.dataset.page === page));
 
    if (session) updateSidebar();
    if (page === 'admin') populateAdminDashboard();
    else if (page === 'control-panel') updateDashboardStats();
    else if (page === 'accounts') populateAccountsTable();
    else if (page === 'tracking') populateTrackingList();
    else if (page === 'user-security') filterMemberDirectory();
    else if (page === 'settings' && session) populateSettingsPage();
    else if (page === 'plans-management') populatePlansTable();
    else if (page === 'customization') { filterAuditLogs(); }
    else if (page === 'plan-requests') renderUpgradeRequests();
  }
}
 
/* ===== NAVBAR ===== */
function updateNavbar() {
  const session = Auth.getSession();
  const authBtn = document.getElementById('nav-auth-btn');
  const mobileLinks = document.getElementById('mobile-auth-links');
  const trackLink = document.getElementById('nav-track-link');
  if (trackLink) trackLink.style.display = session ? '' : 'none';
 
  if (session) {
    const initials = session.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    authBtn.innerHTML = `<div class="user-avatar" onclick="toggleDropdown()" id="nav-avatar">${initials}
      <div class="user-dropdown" id="user-dropdown">
        <div class="user-dropdown-header"><div style="font-weight:700;font-size:0.9rem">${session.name}</div><div style="font-size:0.78rem;color:var(--text-muted)">${session.email}</div>${(session.role==='admin' || session.role==='superadmin')?'<span class="badge badge-danger" style="margin-top:6px;font-size:0.7rem">Admin</span>':''}</div>
        <button class="user-dropdown-item" onclick="navigate('tracking');toggleDropdown()"><span class="material-symbols-rounded" style="font-size:18px">track_changes</span> My Applications</button>
        <button class="user-dropdown-item" onclick="navigate('settings');toggleDropdown()"><span class="material-symbols-rounded" style="font-size:18px">settings</span> Settings</button>
        ${(session.role==='admin' || session.role==='superadmin')?`<button class="user-dropdown-item" onclick="navigate('admin');toggleDropdown()"><span class="material-symbols-rounded" style="font-size:18px">dashboard</span> Admin Dashboard</button>`:''}
        <button class="user-dropdown-item danger" onclick="logout()"><span class="material-symbols-rounded" style="font-size:18px">logout</span> Sign Out</button>
      </div></div>`;
    mobileLinks.innerHTML = `<button onclick="navigate('tracking');toggleMobileMenu()"><span class="material-symbols-rounded">track_changes</span> My Applications</button><button onclick="logout()"><span class="material-symbols-rounded">logout</span> Sign Out</button>`;
  } else {
    authBtn.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><button class="btn btn-ghost btn-sm" onclick="navigate('login');setTimeout(()=>{if(isLoginMode)toggleAuthMode();},50)">Register</button><button class="btn btn-primary btn-sm" onclick="navigate('login');setTimeout(()=>{if(!isLoginMode)toggleAuthMode();},50)"><span class="material-symbols-rounded" style="font-size:16px">login</span> Sign In</button></div>`;
    mobileLinks.innerHTML = `<button onclick="navigate('login');toggleMobileMenu()"><span class="material-symbols-rounded">login</span> Sign In / Register</button>`;
  }
}
 
function updateSidebar() {
  const session = Auth.getSession();
  const sidebar = document.getElementById('sidebar');
  if (session) {
    sidebar.classList.add('active');
    document.body.classList.add('logged-in');
    const initials = session.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('sidebar-avatar').textContent = initials;
    document.getElementById('sidebar-name').textContent = session.name;
    document.getElementById('sidebar-role').textContent = (session.role === 'admin' || session.role === 'superadmin') ? 'Administrator' : 'PhilHealth Member';
    const nav = document.getElementById('sidebar-nav');
    if (session.role === 'admin' || session.role === 'superadmin') {
      nav.innerHTML = `
        <div class="sidebar-nav-label">Dashboard</div>
        <button class="sidebar-nav-item ${currentPage==='admin'?'active':''}" onclick="navigate('admin');updateDashboardStats()"><span class="material-symbols-rounded" style="font-size:20px">dashboard</span> Unified Dashboard</button>
        <div class="sidebar-nav-label">Management</div>
        <button class="sidebar-nav-item ${currentPage==='control-panel'?'active':''}" onclick="navigate('control-panel');updateDashboardStats()"><span class="material-symbols-rounded" style="font-size:20px">trending_up</span> Dashboard</button>
        <button class="sidebar-nav-item ${currentPage==='plans-management'?'active':''}" onclick="navigate('plans-management')"><span class="material-symbols-rounded" style="font-size:20px">health_and_safety</span> Plans & Services</button>
        <button class="sidebar-nav-item ${currentPage==='plan-requests'?'active':''}" onclick="navigate('plan-requests')" style="position:relative">
          <span class="material-symbols-rounded" style="font-size:20px">swap_horiz</span> Plan Change Requests
          ${(()=>{const n=JSON.parse(localStorage.getItem('planUpgradeRequests')||'[]').filter(r=>r.status==='Pending').length;return n>0?`<span style="background:var(--danger);color:#fff;border-radius:999px;font-size:0.7rem;font-weight:700;padding:2px 7px;margin-left:auto">${n}</span>`:''})()}
        </button>
        <button class="sidebar-nav-item ${currentPage==='workflow-controls'?'active':''}" onclick="navigate('workflow-controls')"><span class="material-symbols-rounded" style="font-size:20px">assignment</span> Workflow Control</button>
        <button class="sidebar-nav-item ${currentPage==='schedule-management'?'active':''}" onclick="navigate('schedule-management')"><span class="material-symbols-rounded" style="font-size:20px">calendar_today</span> Schedule & Slots</button>
        <button class="sidebar-nav-item ${currentPage==='customization'?'active':''}" onclick="navigate('customization')"><span class="material-symbols-rounded" style="font-size:20px">palette</span> Customization</button>
        <button class="sidebar-nav-item ${currentPage==='user-security'?'active':''}" onclick="navigate('user-security');filterMemberDirectory()"><span class="material-symbols-rounded" style="font-size:20px">people</span> Users & Security</button>
        <button class="sidebar-nav-item ${currentPage==='technical-addons'?'active':''}" onclick="navigate('technical-addons')"><span class="material-symbols-rounded" style="font-size:20px">settings</span> Technical & Dev</button>
        <div class="sidebar-nav-label">Support</div>
        <button class="sidebar-nav-item ${currentPage==='accounts'?'active':''}" onclick="navigate('accounts')"><span class="material-symbols-rounded" style="font-size:20px">group</span> Member Accounts</button>`;
    } else {
      nav.innerHTML = `
        <div class="sidebar-nav-label">Insurance</div>
        <button class="sidebar-nav-item ${currentPage==='plans'?'active':''}" onclick="navigate('plans')"><span class="material-symbols-rounded" style="font-size:20px">health_and_safety</span> Insurance Plans</button>
        <button class="sidebar-nav-item ${currentPage==='process'?'active':''}" onclick="navigate('process')"><span class="material-symbols-rounded" style="font-size:20px">checklist</span> How to Apply</button>
        <div class="sidebar-nav-label">My Account</div>
        <button class="sidebar-nav-item ${currentPage==='tracking'?'active':''}" onclick="navigate('tracking')"><span class="material-symbols-rounded" style="font-size:20px">track_changes</span> My Applications</button>
        <button class="sidebar-nav-item ${currentPage==='settings'?'active':''}" onclick="navigate('settings')"><span class="material-symbols-rounded" style="font-size:20px">settings</span> Settings</button>
        <div class="sidebar-nav-label">Quick Actions</div>
        <button class="sidebar-nav-item" onclick="openPlanUpgradeModal()"><span class="material-symbols-rounded" style="font-size:20px">upgrade</span> Upgrade Plan</button>
        <button class="sidebar-nav-item" onclick="openFamilyPayerModal()"><span class="material-symbols-rounded" style="font-size:20px">family_restroom</span> Family Coverage</button>
        <button class="sidebar-nav-item" onclick="openBeneficiariesModal()"><span class="material-symbols-rounded" style="font-size:20px">info</span> Claims & Benefits</button>`;
    }
  } else {
    sidebar.classList.remove('active');
    document.body.classList.remove('logged-in');
  }
}
 
function toggleDropdown() { const dd = document.getElementById('user-dropdown'); if (dd) dd.classList.toggle('open'); }
function toggleMobileMenu() { document.getElementById('mobile-menu').classList.toggle('open'); }
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('active');
  document.getElementById('sidebar-overlay').classList.toggle('active');
}
function togglePasswordVisibility() {
  const inp = document.getElementById('auth-password');
  const ico = document.getElementById('password-icon');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  ico.textContent = inp.type === 'password' ? 'visibility_off' : 'visibility';
}
 
document.addEventListener('click', e => {
  const avatar = document.getElementById('nav-avatar');
  const dd = document.getElementById('user-dropdown');
  if (dd && avatar && !avatar.contains(e.target)) dd.classList.remove('open');
});
 
/* ===== AUTH FORM ===== */
function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  const regFields = document.getElementById('reg-fields');
  const loginOpts = document.getElementById('login-options');
  const title = document.getElementById('auth-title');
  const subtitle = document.getElementById('auth-subtitle');
  const btn = document.getElementById('auth-submit-btn');
  const toggleText = document.getElementById('auth-toggle-text');
  const toggleBtn = document.getElementById('auth-toggle-btn');
  if (isLoginMode) {
    regFields.classList.add('hidden'); regFields.style.display = 'none';
    loginOpts.style.display = '';
    title.textContent = 'Welcome Back'; subtitle.textContent = 'Sign in to your PhilHealth citizen account';
    btn.textContent = 'Sign In'; toggleText.textContent = "Don't have an account?"; toggleBtn.textContent = 'Create Account';
  } else {
    regFields.classList.remove('hidden'); regFields.style.display = 'flex';
    loginOpts.style.display = 'none';
    title.textContent = 'Create Account'; subtitle.textContent = 'Register for a PhilHealth citizen account';
    btn.textContent = 'Register'; toggleText.textContent = 'Already have an account?'; toggleBtn.textContent = 'Sign In';
  }
}
 
function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (isLoginMode) {
    const users = Storage.getUsers();
    const user = users[email.toLowerCase()];
    if (!user || user.password !== password) { showToast('Invalid email or password.', 'error'); return; }
    // Admin logins bypass OTP for convenience
    if (user.role === 'admin' || user.role === 'superadmin') {
      const res = Auth.login(email, password);
      if (res.ok) { updateNavbar(); updateSidebar(); navigate('admin'); showToast(`Welcome back, ${res.user.name}!`, 'success'); }
      return;
    }
    showToast('Sending verification code...', 'info');
    openOTPModal(email, { type: 'login', email, password });
  } else {
    const fname = document.getElementById('reg-fname').value.trim();
    const lname = document.getElementById('reg-lname').value.trim();
    const mname = document.getElementById('reg-mname').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    if (!fname || !lname) { showToast('First and last name are required', 'error'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    const users = Storage.getUsers();
    if (users[email.toLowerCase()]) { showToast('An account with this email already exists.', 'error'); return; }
    const fullName = [fname, mname, lname].filter(Boolean).join(' ');
    showToast('Sending verification code to your email...', 'info');
    openOTPModal(email, { type: 'register', email, password, name: fullName, phone });
  }
}
 
function handleSSO() {
  document.getElementById('philsys-modal').classList.add('active');
  setTimeout(() => {
    document.getElementById('philsys-loading').style.display = 'none';
    document.getElementById('philsys-success').style.display = 'block';
    document.getElementById('philsys-confirm-btn').style.display = '';
  }, 2000);
}
 
function completePhilSysLogin() {
  const res = Auth.login('user@egov.ph', 'user123');
  if (res.ok) { closePhilSysModal(); updateNavbar(); updateSidebar(); navigate('plans'); showToast('Signed in via PhilSys', 'success'); }
}
 
function closePhilSysModal() {
  document.getElementById('philsys-modal').classList.remove('active');
  document.getElementById('philsys-loading').style.display = 'block';
  document.getElementById('philsys-success').style.display = 'none';
  document.getElementById('philsys-confirm-btn').style.display = 'none';
}
 
function logout() {
  Auth.logout();
  updateNavbar(); updateSidebar();
  showPage('home');
  showToast('You have been signed out', 'info');
}
 
/* ===== PLAN SELECTION ===== */
function startApplication(planId) {
  if (!Auth.isLoggedIn()) { showToast('Please sign in to apply', 'info'); navigate('login'); return; }
  selectedPlanId = planId;
  const plan = PLANS[planId];
  document.getElementById('app-plan-title').textContent = `Apply for ${plan.name}`;
  const sumBar = document.getElementById('plan-summary-bar');
  sumBar.className = `selected-plan-summary mb-24 ${plan.color}`;
  document.getElementById('plan-sum-icon').textContent = plan.icon;
  document.getElementById('plan-sum-name').textContent = plan.name;
  document.getElementById('plan-sum-price').textContent = plan.priceText;
  // Payment section
  document.getElementById('pay-plan-name').textContent = plan.name;
  if (planId === 'BASIC') {
    document.getElementById('free-notice').style.display = 'flex';
    document.getElementById('payment-required-section').style.display = 'none';
  } else {
    document.getElementById('free-notice').style.display = 'none';
    document.getElementById('payment-required-section').style.display = 'block';
    document.getElementById('pay-amount').textContent = `₱${plan.monthly.toLocaleString()}.00`;
    document.getElementById('pay-total').textContent = `₱${plan.monthly.toLocaleString()}.00`;
  }
  // Reset steps
  goToStep(1);
  const session = Auth.getSession();
  if (session) {
    document.getElementById('app-email').value = session.email;
    const names = session.name.split(' ');
    document.getElementById('fname').value = names[0] || '';
    document.getElementById('lname').value = names[names.length - 1] || '';
  }
  navigate('application');
}
 
/* ===== STEP NAVIGATION ===== */
function goToStep(step) {
  [1,2,3,4].forEach(i => {
    document.getElementById(`app-step-${i}`).classList.add('hidden');
    const circle = document.getElementById(`s${i}-circle`);
    const stepEl = document.getElementById(`step-${i}`);
    stepEl.classList.remove('active','done');
    if (i < step) { stepEl.classList.add('done'); circle.innerHTML = '<span class="material-symbols-rounded" style="font-size:16px">check</span>'; }
    else if (i === step) { stepEl.classList.add('active'); circle.textContent = i; }
    else { circle.textContent = i; }
    if (i < 4) { const line = document.getElementById(`line-${i}`); if (line) line.classList.toggle('done', i < step); }
  });
  document.getElementById(`app-step-${step}`).classList.remove('hidden');
  currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
 
function validateStep1() {
  const req = ['fname','lname','dob','gender','civil-status','contact','app-email','membership-cat','monthly-income'];
  for (const id of req) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) { showToast('Please fill in all required fields', 'error'); el && el.focus(); return; }
  }
  const email = document.getElementById('app-email').value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a valid email address', 'error'); return; }
  const contact = document.getElementById('contact').value;
  if (contact.length < 10) { showToast('Please enter a valid contact number', 'error'); return; }
  goToStep(2);
}
 
function validateStep2() {
  const req = ['street','city','province','region','zip'];
  for (const id of req) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) { showToast('Please fill in all address fields', 'error'); el && el.focus(); return; }
  }
  if (document.getElementById('zip').value.length < 4) { showToast('Please enter a valid 4-digit ZIP code', 'error'); return; }
  goToStep(3);
}
 
function validateStep3() {
  const id = document.getElementById('doc-id-selected').value;
  const addr = document.getElementById('doc-address-selected').value;
  const photo = document.getElementById('doc-photo-selected').value;
  const medical = document.getElementById('doc-medical-selected').value;
  if (!id || !addr || !photo) { showToast('Please select all required documents (ID, Address proof, Photo)', 'error'); return; }
  if (!medical) { showToast('Please upload your Recent Medical Certificate', 'error'); return; }
  goToStep(4);
  // Set min date for pickup (next working day)
  const pickupDate = document.getElementById('pickup-date');
  const today = new Date();
  today.setDate(today.getDate() + 3);
  pickupDate.min = today.toISOString().split('T')[0];
}
 
function selectTime(el, time) {
  document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  selectedTime = time;
  document.getElementById('selected-time').value = time;
  document.getElementById('sum-time').textContent = time;
  updateScheduleSummary();
}
 
function updateScheduleInfo() {
  updateScheduleSummary();
}
 
function updateScheduleSummary() {
  const branch = document.getElementById('pickup-branch').value;
  const date = document.getElementById('pickup-date').value;
  if (branch || date || selectedTime) {
    document.getElementById('schedule-summary').style.display = 'block';
    document.getElementById('sum-branch').textContent = branch || '—';
    if (date) {
      const d = new Date(date + 'T00:00:00');
      document.getElementById('sum-date').textContent = d.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } else {
      document.getElementById('sum-date').textContent = '—';
    }
    document.getElementById('sum-time').textContent = selectedTime || '—';
    const claimer = document.getElementById('claimer-type').value;
    document.getElementById('sum-claimer').textContent = claimer === 'self' ? 'Applicant (Self)' : (claimer === 'rep' ? 'Authorized Representative' : '—');
  }
}
 
function toggleRepresentativeFields() {
  const val = document.getElementById('claimer-type').value;
  const repFields = document.getElementById('rep-fields');
  repFields.classList.toggle('hidden', val !== 'rep');
  if (val !== 'rep') repFields.style.display = 'none';
  else repFields.style.display = 'flex';
  updateScheduleSummary();
}
 
function selectPayment(el, method) {
  document.querySelectorAll('.payment-method').forEach(m => { m.classList.remove('selected'); m.querySelector('input[type="radio"]').checked = false; });
  el.classList.add('selected');
  el.querySelector('input[type="radio"]').checked = true;
  document.getElementById('selected-payment-method').value = method;
  document.getElementById('ewallet-detail').style.display = ['gcash','maya'].includes(method) ? 'block' : 'none';
  document.getElementById('card-detail').style.display = method === 'card' ? 'block' : 'none';
}
 
function submitApplication() {
  // Validate schedule
  if (!document.getElementById('pickup-branch').value) { showToast('Please select a pickup branch', 'error'); return; }
  if (!document.getElementById('pickup-date').value) { showToast('Please select a pickup date', 'error'); return; }
  if (!selectedTime) { showToast('Please select a time slot', 'error'); return; }
  if (!document.getElementById('claimer-type').value) { showToast('Please indicate who will claim the ID', 'error'); return; }
 
  // Validate representative fields if applicable
  if (document.getElementById('claimer-type').value === 'rep') {
    if (!document.getElementById('rep-name').value || !document.getElementById('rep-relation').value) {
      showToast('Please provide representative details', 'error'); return;
    }
  }

  // Validate ID fields for payment
  if (!document.getElementById('payment-id-type').value) { showToast('Please select your ID type for payment validation', 'error'); return; }
  if (!document.getElementById('payment-id-number').value.trim()) { showToast('Please enter your ID number for payment validation', 'error'); return; }
 
  // Validate payment (not for BASIC)
  if (selectedPlanId !== 'BASIC') {
    if (!document.getElementById('selected-payment-method').value) { showToast('Please select a payment method', 'error'); return; }
  }
 
  // Validate agreements
  if (!document.getElementById('agree-1').checked || !document.getElementById('agree-2').checked || !document.getElementById('agree-3').checked) {
    document.getElementById('agree-error').style.display = 'block';
    showToast('Please agree to all required terms', 'error'); return;
  }
 
  const session = Auth.getSession();
  const plan = PLANS[selectedPlanId];
  const apps = Storage.getApplications();
  const appId = 'PHL-' + Date.now().toString().slice(-6);
  const pickupDate = document.getElementById('pickup-date').value;
  const pickupDateObj = new Date(pickupDate + 'T00:00:00');
  const formattedDate = pickupDateObj.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
 
  const claimer = document.getElementById('claimer-type').value === 'rep'
    ? `Authorized Representative: ${document.getElementById('rep-name').value}`
    : 'Applicant (Self)';
 
  const newApp = {
    id: appId,
    plan: selectedPlanId,
    planName: plan.name,
    submittedBy: session.email,
    citizenName: [document.getElementById('fname').value, document.getElementById('mname').value, document.getElementById('lname').value].filter(Boolean).join(' '),
    email: document.getElementById('app-email').value,
    contact: document.getElementById('contact').value,
    address: `${document.getElementById('street').value}, ${document.getElementById('city').value}, ${document.getElementById('province').value}, ${document.getElementById('region').value} ${document.getElementById('zip').value}`,
    gender: document.getElementById('gender').value,
    dob: document.getElementById('dob').value,
    civilStatus: document.getElementById('civil-status').value,
    membership: document.getElementById('membership-cat').value,
    branch: document.getElementById('pickup-branch').value,
    pickupDate: formattedDate,
    pickupTime: selectedTime,
    claimer: claimer,
    payment: selectedPlanId === 'BASIC' ? 'Government-Subsidized' : (document.getElementById('selected-payment-method').value || 'OTC'),
    notes: document.getElementById('app-notes').value,
    status: 'Pending',
    submittedAt: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
    updatedAt: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  };
 
  apps.push(newApp);
  Storage.saveApplications(apps);
 
  // Show success state
  const appPage = document.getElementById('application-page');
  appPage.innerHTML = `
  <div class="container-sm" style="padding:60px 24px">
    <div class="success-state">
      <div class="success-icon"><span class="material-symbols-rounded" style="font-size:44px;color:var(--success)">check_circle</span></div>
      <h2 class="gradient-text">Application Submitted!</h2>
      <p>Your PhilHealth enrollment application has been successfully submitted. You will receive a confirmation email within 24 hours.</p>
      <div class="schedule-info-card" style="text-align:left;max-width:460px;margin:0 auto 32px">
        <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">📋 Application Summary</div>
        <div class="schedule-info-row">
          <div class="ico" style="background:rgba(59,130,246,0.12);color:var(--accent)"><span class="material-symbols-rounded" style="font-size:18px">confirmation_number</span></div>
          <div><div class="lbl">Application ID</div><div class="val" style="font-family:monospace">${appId}</div></div>
        </div>
        <div class="schedule-info-row">
          <div class="ico" style="background:rgba(16,185,129,0.12);color:var(--success)"><span class="material-symbols-rounded" style="font-size:18px">health_and_safety</span></div>
          <div><div class="lbl">Plan</div><div class="val">${plan.name} ${plan.icon}</div></div>
        </div>
        <div class="schedule-info-row">
          <div class="ico" style="background:rgba(59,130,246,0.12);color:var(--accent)"><span class="material-symbols-rounded" style="font-size:18px">location_on</span></div>
          <div><div class="lbl">Pickup Branch</div><div class="val">${newApp.branch}</div></div>
        </div>
        <div class="schedule-info-row">
          <div class="ico" style="background:rgba(245,158,11,0.12);color:var(--gold)"><span class="material-symbols-rounded" style="font-size:18px">calendar_today</span></div>
          <div><div class="lbl">Pickup Date</div><div class="val">${formattedDate}</div></div>
        </div>
        <div class="schedule-info-row">
          <div class="ico" style="background:rgba(245,158,11,0.12);color:var(--gold)"><span class="material-symbols-rounded" style="font-size:18px">schedule</span></div>
          <div><div class="lbl">Time Slot</div><div class="val">${selectedTime}</div></div>
        </div>
        <div class="schedule-info-row">
          <div class="ico" style="background:rgba(109,40,217,0.12);color:#A78BFA"><span class="material-symbols-rounded" style="font-size:18px">person</span></div>
          <div><div class="lbl">Claimant</div><div class="val">${claimer}</div></div>
        </div>
      </div>
      <div class="info-box warning" style="max-width:460px;margin:0 auto 32px;text-align:left"><span class="material-symbols-rounded" style="font-size:18px;flex-shrink:0;color:var(--gold)">info</span>Please bring your <strong>valid government ID</strong> and your application reference number <strong>${appId}</strong> on your scheduled date.</div>
      <div class="flex gap-12" style="justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="navigate('tracking')"><span class="material-symbols-rounded">track_changes</span> Track Application</button>
        <button class="btn btn-ghost" onclick="navigate('plans')">Apply for Another Plan</button>
      </div>
    </div>
  </div>`;
  showToast('Application submitted successfully!', 'success');
}
 
/* ===== TRACKING ===== */
function populateTrackingList() {
  const session = Auth.getSession();
  const apps = Storage.getApplications().filter(a => a.submittedBy === session.email);
  const list = document.getElementById('tracking-list');
  const empty = document.getElementById('tracking-empty');
  list.innerHTML = '';
  if (!apps.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  apps.reverse().forEach(app => {
    const statusMap = {
      'Pending': { class: 'badge-warning', step: 1 },
      'Under Review': { class: 'badge-info', step: 2 },
      'Approved': { class: 'badge-success', step: 3 },
      'Ready for Pickup': { class: 'badge-success', step: 4 },
      'Completed': { class: 'badge-success', step: 5 },
      'Rejected': { class: 'badge-danger', step: 0 }
    };
    const sm = statusMap[app.status] || statusMap['Pending'];
    const plan = PLANS[app.plan] || { icon: '❤️' };
    const card = document.createElement('div');
    card.className = 'tracking-card';
    card.innerHTML = `
      <div class="tracking-header">
        <div>
          <div class="flex items-center gap-8 mb-8">
            <span style="font-size:18px">${plan.icon}</span>
            <strong style="font-size:1rem">${app.planName}</strong>
            <span class="badge ${sm.class}">${app.status}</span>
          </div>
          <div class="tracking-id">App ID: ${app.id}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:0.82rem;color:var(--text-muted)">Submitted: ${app.submittedAt}</div>
        </div>
      </div>
      <div class="tracking-timeline">
        <div class="timeline-step"><div class="timeline-dot ${sm.step >= 1 ? 'done' : ''}"><span class="material-symbols-rounded" style="font-size:14px">${sm.step >= 1 ? 'check' : '1'}</span></div><div class="timeline-label ${sm.step >= 1 ? 'done' : ''}">Submitted</div></div>
        <div class="timeline-step"><div class="timeline-dot ${sm.step >= 2 ? 'done' : sm.step === 1 ? 'active' : ''}"><span class="material-symbols-rounded" style="font-size:14px">${sm.step >= 2 ? 'check' : '2'}</span></div><div class="timeline-label ${sm.step >= 2 ? 'done' : sm.step === 1 ? 'active' : ''}">Under Review</div></div>
        <div class="timeline-step"><div class="timeline-dot ${sm.step >= 3 ? 'done' : sm.step === 2 ? 'active' : ''}"><span class="material-symbols-rounded" style="font-size:14px">${sm.step >= 3 ? 'check' : '3'}</span></div><div class="timeline-label ${sm.step >= 3 ? 'done' : sm.step === 2 ? 'active' : ''}">Approved</div></div>
        <div class="timeline-step"><div class="timeline-dot ${sm.step >= 4 ? 'done' : sm.step === 3 ? 'active' : ''}"><span class="material-symbols-rounded" style="font-size:14px">${sm.step >= 4 ? 'check' : '4'}</span></div><div class="timeline-label ${sm.step >= 4 ? 'done' : sm.step === 3 ? 'active' : ''}">Ready</div></div>
        <div class="timeline-step"><div class="timeline-dot ${sm.step >= 5 ? 'done' : sm.step === 4 ? 'active' : ''}"><span class="material-symbols-rounded" style="font-size:14px">${sm.step >= 5 ? 'check' : '5'}</span></div><div class="timeline-label ${sm.step >= 5 ? 'done' : sm.step === 4 ? 'active' : ''}">Completed</div></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:16px">
        <div style="padding:12px;background:var(--surface-2);border-radius:var(--radius-sm)"><div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Branch</div><div style="font-size:0.85rem;font-weight:600">${app.branch || '—'}</div></div>
        <div style="padding:12px;background:var(--surface-2);border-radius:var(--radius-sm)"><div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Pickup Date</div><div style="font-size:0.85rem;font-weight:600">${app.pickupDate || '—'}</div></div>
        <div style="padding:12px;background:var(--surface-2);border-radius:var(--radius-sm)"><div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Time</div><div style="font-size:0.85rem;font-weight:600">${app.pickupTime || '—'}</div></div>
        <div style="padding:12px;background:var(--surface-2);border-radius:var(--radius-sm)"><div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Claimant</div><div style="font-size:0.85rem;font-weight:600">${app.claimer || '—'}</div></div>
      </div>`;
    list.appendChild(card);
  });
}
 
/* ===== ADMIN DASHBOARD ===== */
function populateAdminDashboard() {
  const apps = Storage.getApplications();
  const users = Storage.getUsers();
  const userCount = Object.values(users).filter(u => u.role !== 'admin').length;
  const pending = apps.filter(a => a.status === 'Pending').length;
  const approved = apps.filter(a => a.status === 'Approved').length;
  const statsEl = document.getElementById('admin-stats');
  statsEl.innerHTML = `
    <div class="admin-stat"><div class="label">Total Applications</div><div class="value">${apps.length}</div></div>
    <div class="admin-stat"><div class="label">Pending Review</div><div class="value" style="color:var(--warning)">${pending}</div></div>
    <div class="admin-stat"><div class="label">Approved</div><div class="value" style="color:var(--success)">${approved}</div></div>
    <div class="admin-stat"><div class="label">Members</div><div class="value" style="color:var(--accent)">${userCount}</div></div>`;
  renderAdminTable(apps);
}
 
function renderAdminTable(apps) {
  const tbody = document.getElementById('admin-table-body');
  const empty = document.getElementById('admin-empty');
  tbody.innerHTML = '';
  if (!apps.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  apps.slice().reverse().forEach(app => {
    const statusClass = { 'Pending': 'badge-warning', 'Under Review': 'badge-info', 'Approved': 'badge-success', 'Rejected': 'badge-danger', 'Completed': 'badge-success', 'Ready for Pickup': 'badge-success' }[app.status] || 'badge-warning';
    const plan = PLANS[app.plan] || { icon: '❤️' };
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-family:monospace;color:var(--text-muted);font-size:0.82rem">${app.id}</td>
      <td><div style="font-weight:600">${app.citizenName}</div><div style="font-size:0.8rem;color:var(--text-muted)">${app.email}</div></td>
      <td>${plan.icon} ${app.planName}</td>
      <td style="color:var(--text-soft);font-size:0.85rem">${app.submittedAt}</td>
      <td style="font-size:0.82rem"><div>${app.pickupDate || '—'}</div><div style="color:var(--text-muted)">${app.pickupTime || ''}</div></td>
      <td><span class="badge ${statusClass}">${app.status}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm btn-ghost" onclick="viewApp('${app.id}')"><span class="material-symbols-rounded" style="font-size:14px">visibility</span></button>
          <button class="btn btn-sm" style="background:rgba(16,185,129,0.1);color:var(--success);border:1px solid rgba(16,185,129,0.2)" onclick="updateAppStatus('${app.id}','Approved')"><span class="material-symbols-rounded" style="font-size:14px">check</span></button>
          <button class="btn btn-sm" style="background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2)" onclick="updateAppStatus('${app.id}','Rejected')"><span class="material-symbols-rounded" style="font-size:14px">close</span></button>
        </div>
      </td>`;
    tbody.appendChild(row);
  });
}
 
function filterAdminTable() {
  const q = document.getElementById('admin-search').value.toLowerCase();
  const f = document.getElementById('admin-filter').value;
  const apps = Storage.getApplications().filter(a => {
    const matchQ = !q || JSON.stringify(a).toLowerCase().includes(q);
    const matchF = !f || a.status === f;
    return matchQ && matchF;
  });
  renderAdminTable(apps);
}
 
function viewApp(appId) {
  const app = Storage.getApplications().find(a => a.id === appId);
  if (!app) return;
  const statusClass = { 'Pending': 'badge-warning', 'Under Review': 'badge-info', 'Approved': 'badge-success', 'Rejected': 'badge-danger' }[app.status] || 'badge-warning';
  document.getElementById('modal-app-id').textContent = app.id;
  document.getElementById('modal-service').innerHTML = `${PLANS[app.plan]?.icon || ''} ${app.planName}`;
  document.getElementById('modal-citizen').textContent = app.citizenName;
  document.getElementById('modal-date').textContent = app.submittedAt;
  document.getElementById('modal-status').innerHTML = `<span class="badge ${statusClass}">${app.status}</span>`;
  document.getElementById('modal-payment').textContent = app.payment || '—';
  document.getElementById('modal-branch').textContent = app.branch || '—';
  document.getElementById('modal-schedule').textContent = `${app.pickupDate} at ${app.pickupTime}` || '—';
  document.getElementById('modal-claimer').textContent = app.claimer || '—';
  document.getElementById('modal-email').textContent = app.email;
  document.getElementById('modal-contact').textContent = app.contact;
  document.getElementById('modal-address').textContent = app.address;
  document.getElementById('modal-actions').innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    <button class="btn btn-sm" style="background:rgba(16,185,129,0.1);color:var(--success);border:1px solid rgba(16,185,129,0.2)" onclick="updateAppStatus('${app.id}','Approved');closeModal()">Approve</button>
    <button class="btn btn-sm" style="background:rgba(245,158,11,0.1);color:var(--warning);border:1px solid rgba(245,158,11,0.2)" onclick="updateAppStatus('${app.id}','Under Review');closeModal()">Set Under Review</button>
    <button class="btn btn-sm" style="background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2)" onclick="updateAppStatus('${app.id}','Rejected');closeModal()">Reject</button>`;
  document.getElementById('app-modal').classList.add('active');
}
 
function updateAppStatus(appId, status) {
  const apps = Storage.getApplications();
  const idx = apps.findIndex(a => a.id === appId);
  if (idx === -1) return;
  apps[idx].status = status;
  apps[idx].updatedAt = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  Storage.saveApplications(apps);
  addAuditLog('Status Updated', `${appId} → ${status}`);
  showToast(`Application ${appId} — Status updated to "${status}"`, 'success');
  populateAdminDashboard();
}
 
function closeModal() { document.getElementById('app-modal').classList.remove('active'); }
 
/* ===== ACCOUNTS TABLE ===== */
function populateAccountsTable() {
  const users = Storage.getUsers();
  const apps = Storage.getApplications();
  const tbody = document.getElementById('accounts-table-body');
  const empty = document.getElementById('accounts-empty');
  tbody.innerHTML = '';
  const members = Object.values(users).filter(u => u.role !== 'admin');
  if (!members.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  members.forEach(user => {
    const count = apps.filter(a => a.submittedBy === user.email).length;
    const row = document.createElement('tr');
    row.innerHTML = `<td style="font-weight:600">${user.name}</td><td style="color:var(--text-soft);font-size:0.85rem">${user.email}</td><td style="text-align:center">${count}</td><td style="color:var(--text-muted);font-size:0.85rem">${user.createdAt || '—'}</td><td><span class="badge badge-success">Active</span></td>`;
    tbody.appendChild(row);
  });
}
 
function filterAccountsTable() {
  const q = document.getElementById('accounts-search').value.toLowerCase();
  let visible = 0;
  document.querySelectorAll('#accounts-table-body tr').forEach(row => {
    const show = row.textContent.toLowerCase().includes(q);
    row.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  document.getElementById('accounts-empty').classList.toggle('hidden', visible > 0);
}
 
/* ===== SETTINGS ===== */
function switchTab(tab, btn) {
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
}
 
function populateSettingsPage() {
  const session = Auth.getSession();
  if (!session) return;
  const initials = session.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('settings-avatar').textContent = initials;
  const names = session.name.split(' ');
  document.getElementById('set-fname').value = names[0] || '';
  document.getElementById('set-lname').value = names[names.length - 1] || '';
  document.getElementById('set-email').value = session.email;
  const users = Storage.getUsers();
  const user = users[session.email];
  if (user) document.getElementById('set-contact').value = user.contact || '';
}
 
function saveProfile() {
  const session = Auth.getSession();
  if (!session) return;
  const fname = document.getElementById('set-fname').value.trim();
  const lname = document.getElementById('set-lname').value.trim();
  if (!fname || !lname) { showToast('Name fields are required', 'error'); return; }
  Auth.updateAccount(session.email, { name: `${fname} ${lname}`, contact: document.getElementById('set-contact').value });
  const updatedSession = { ...session, name: `${fname} ${lname}` };
  localStorage.setItem(Auth.SESSION_KEY, JSON.stringify(updatedSession));
  updateNavbar(); updateSidebar();
  showToast('Profile saved successfully', 'success');
}
 
function changePassword() {
  const session = Auth.getSession();
  const users = Storage.getUsers();
  const user = users[session.email];
  const oldPw = document.getElementById('set-old-password').value;
  const newPw = document.getElementById('set-new-password').value;
  const confirmPw = document.getElementById('set-confirm-password').value;
  if (user.password !== oldPw) { showToast('Current password is incorrect', 'error'); return; }
  if (newPw.length < 6) { showToast('New password must be at least 6 characters', 'error'); return; }
  if (newPw !== confirmPw) { showToast('New passwords do not match', 'error'); return; }
  Auth.updateAccount(session.email, { password: newPw });
  showToast('Password updated successfully', 'success');
  ['set-old-password','set-new-password','set-confirm-password'].forEach(id => document.getElementById(id).value = '');
}
 
function deleteAccount() {
  if (!confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) return;
  Auth.deleteAccount(Auth.getSession().email);
  updateNavbar(); updateSidebar();
  showPage('home');
  showToast('Account deleted', 'info');
}
 
/* ===== FILE MANAGER ===== */
let fileManagerContext = null;
function openFileManager(docType) { fileManagerContext = docType; document.getElementById('file-manager-modal').classList.add('active'); }
function closeFileModal() { document.getElementById('file-manager-modal').classList.remove('active'); fileManagerContext = null; }
 
function selectFile(fileName) {
  if (!fileManagerContext) return;
  const correctFiles = { 'gov-id': 'Valid Government ID.docx', 'address': 'Proof of Address.pdf', 'photo': '2x2.png', 'medical': 'Medical Certificate.pdf' };
  const fileMap = { 'Valid Government ID': 'Valid Government ID.docx', 'Proof of Address': 'Proof of Address.pdf', 'Recent 2x2 Photo': '2x2.png', 'Medical Certificate (Recent)': 'Medical Certificate.pdf' };
  const uiMap = {
    'gov-id': { previewId: 'gov-id-preview', placeholderId: 'gov-id-placeholder', nameId: 'gov-id-name', inputId: 'doc-id-selected' },
    'address': { previewId: 'address-preview', placeholderId: 'address-placeholder', nameId: 'address-name', inputId: 'doc-address-selected' },
    'photo': { previewId: 'photo-preview', placeholderId: 'photo-placeholder', nameId: 'photo-name', inputId: 'doc-photo-selected' },
    'medical': { previewId: 'medical-preview', placeholderId: 'medical-placeholder', nameId: 'medical-name', inputId: 'doc-medical-selected' }
  };
  const ctx = fileManagerContext;
  const selectedFile = fileMap[fileName];
  const ui = uiMap[ctx];
  document.getElementById(ui.inputId).value = selectedFile;
  document.getElementById(ui.previewId).style.display = 'block';
  document.getElementById(ui.placeholderId).style.display = 'none';
  document.getElementById(ui.nameId).textContent = selectedFile;
  if (selectedFile !== correctFiles[ctx]) showToast(`⚠️ Wrong file! Expected: ${correctFiles[ctx]}`, 'error');
  else showToast(`✓ ${selectedFile} selected`, 'success');
  closeFileModal();
}
 
/* ===== UNIFIED DASHBOARD ===== */
function updateDashboardStats() {
  const apps = Storage.getApplications();
  const users = Object.values(Storage.getUsers()).filter(u => u.role !== 'admin');
  document.getElementById('stat-total-apps').textContent = apps.length;
  document.getElementById('stat-approved').textContent = apps.filter(a => a.status === 'Approved').length;
  document.getElementById('stat-pending').textContent = apps.filter(a => a.status === 'Pending').length;
  document.getElementById('stat-rejected').textContent = apps.filter(a => a.status === 'Rejected').length;
  document.getElementById('total-members').textContent = users.length;
  document.getElementById('monthly-growth').textContent = '+' + Math.floor(Math.random() * 20);
  document.getElementById('yearly-growth').textContent = '+' + users.length;
  document.getElementById('active-sessions').textContent = Math.floor(Math.random() * 15) + 3;
}

/* ===== PLAN MANAGEMENT ===== */
function openPlanModal() { openNewPlanModal(); }
function openNewPlanModal() {
  const session = Auth.getSession();
  if (!session || (session.role !== 'superadmin' && session.role !== 'admin')) { showToast('Admin access required', 'error'); return; }
  // Reset form fields
  ['np-name','np-icon','np-price','np-coverage','np-dependents','np-description','np-docs'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  [1,2,3,4,5,6,7,8].forEach(i => { const cb = document.getElementById('np-f' + i); if (cb) cb.checked = false; });
  document.getElementById('new-plan-modal').classList.add('active');
}
function closeNewPlanModal() { document.getElementById('new-plan-modal').classList.remove('active'); }
function saveNewPlan() {
  const name = document.getElementById('np-name').value.trim();
  const price = document.getElementById('np-price').value.trim();
  const coverage = document.getElementById('np-coverage').value.trim();
  const desc = document.getElementById('np-description').value.trim();
  if (!name || !price || !coverage || !desc) { showToast('Please fill in all required fields', 'error'); return; }
  const features = [];
  ['Inpatient Coverage','Outpatient Coverage','Dental & Eye Care','International Emergency','Maternity Benefits','Mental Health Coverage','Priority Processing','Z-Benefits (Cancer/Rare)'].forEach((f,i) => {
    if (document.getElementById(`np-f${i+1}`).checked) features.push(f);
  });
  const plans = JSON.parse(localStorage.getItem('customPlans') || '[]');
  const icon = document.getElementById('np-icon').value || '🏥';
  const deps = document.getElementById('np-dependents').value || 'Up to 3';
  const status = document.getElementById('np-status').value;
  const docs = document.getElementById('np-docs').value.split('\n').filter(d => d.trim());
  plans.push({ id: Date.now(), name, icon, price: parseInt(price), coverage, description: desc, features, dependents: deps, status, docs, createdAt: new Date().toLocaleDateString() });
  localStorage.setItem('customPlans', JSON.stringify(plans));
  addAuditLog('New Plan Created', name);
  showToast(`✓ Plan "${name}" created successfully!`, 'success');
  closeNewPlanModal();
  populatePlansTable();
}
function populatePlansTable() {
  const tbody = document.getElementById('plans-tbody');
  if (!tbody) return;
  const defaultPlans = [
    { id:'BASIC', name:'Basic Coverage', icon:'🛡️', price:0, coverage:'₱120,000', status:'Active', features:['Inpatient Coverage'] },
    { id:'STANDARD', name:'Standard Plan', icon:'💙', price:300, coverage:'₱450,000', status:'Active', features:['Inpatient Coverage','Outpatient Coverage','Dental & Eye Care'] },
    { id:'PREMIUM', name:'Premium Plus', icon:'⭐', price:2400, coverage:'Unlimited', status:'Active', features:['All Benefits','International Emergency','Priority Processing'] }
  ];
  const customPlans = JSON.parse(localStorage.getItem('customPlans') || '[]');
  const allPlans = [...defaultPlans, ...customPlans];
  tbody.innerHTML = allPlans.map(p => `
    <tr>
      <td>${p.icon} <strong>${p.name}</strong></td>
      <td>${p.price === 0 ? '<span style="color:var(--success)">FREE</span>' : '₱' + p.price.toLocaleString() + '/mo'}</td>
      <td>${p.coverage}</td>
      <td><span class="badge ${p.status==='Active'?'badge-success':'badge-warning'}">${p.status}</span></td>
      <td style="font-size:0.78rem;color:var(--text-soft)">${(p.features||[]).join(', ')}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="showToast('Editing plan: ${p.name}','info')" style="margin-right:4px">Edit</button>
        ${customPlans.includes(p) ? `<button class="btn btn-sm" style="background:rgba(239,68,68,0.1);color:var(--danger)" onclick="deleteCustomPlan(${p.id})">Delete</button>` : ''}
      </td>
    </tr>`).join('');
}
function deleteCustomPlan(id) {
  const plans = JSON.parse(localStorage.getItem('customPlans') || '[]').filter(p => p.id !== id);
  localStorage.setItem('customPlans', JSON.stringify(plans));
  showToast('Plan deleted', 'success');
  populatePlansTable();
}

/* ===== PLAN UPGRADE ===== */
function openPlanUpgradeModal() {
  if (!Auth.isLoggedIn()) { showToast('Please sign in to upgrade your plan', 'info'); navigate('login'); return; }
  document.getElementById('plan-upgrade-modal').classList.add('active');
}
function closePlanUpgradeModal() { document.getElementById('plan-upgrade-modal').classList.remove('active'); }
function selectUpgradePlan(el, plan) {
  document.querySelectorAll('#plan-upgrade-modal .payment-method').forEach(m => m.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input[type=radio]').checked = true;
}
function submitPlanUpgrade() {
  const selected = document.querySelector('input[name="upgrade-plan"]:checked');
  const reason = document.getElementById('upgrade-reason').value.trim();
  if (!selected) { showToast('Please select a new plan', 'error'); return; }
  if (!reason) { showToast('Please provide a reason for upgrading', 'error'); return; }
  const session = Auth.getSession();
  const planName = selected.value === 'PREMIUM' ? 'Premium Plus' : 'Standard Plan';
  const requests = JSON.parse(localStorage.getItem('planUpgradeRequests') || '[]');
  requests.push({
    id: 'UPG-' + Date.now().toString().slice(-6),
    userId: session.email,
    userName: session.name,
    newPlan: selected.value,
    newPlanName: planName,
    reason: reason,
    status: 'Pending',
    submittedAt: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  });
  localStorage.setItem('planUpgradeRequests', JSON.stringify(requests));
  addAuditLog('Plan Upgrade Request', `${session.name} → ${planName}`);
  showToast(`✓ Upgrade request to ${planName} submitted! Processing in 5-10 business days.`, 'success');
  closePlanUpgradeModal();
}

/* ===== PLAN CHANGE REQUESTS (Admin) ===== */
function renderUpgradeRequests() {
  const requests = JSON.parse(localStorage.getItem('planUpgradeRequests') || '[]');
  const search = (document.getElementById('upg-search') || {}).value || '';
  const filter = (document.getElementById('upg-filter') || {}).value || '';

  const filtered = requests.filter(r => {
    const matchSearch = !search || r.userName.toLowerCase().includes(search.toLowerCase()) || r.userId.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase());
    const matchFilter = !filter || r.status === filter;
    return matchSearch && matchFilter;
  });

  // Stats
  document.getElementById('upg-stat-total').textContent = requests.length;
  document.getElementById('upg-stat-pending').textContent = requests.filter(r => r.status === 'Pending').length;
  document.getElementById('upg-stat-approved').textContent = requests.filter(r => r.status === 'Approved').length;
  document.getElementById('upg-stat-rejected').textContent = requests.filter(r => r.status === 'Rejected').length;

  const tbody = document.getElementById('upgrade-requests-tbody');
  const empty = document.getElementById('upgrade-requests-empty');

  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const statusClass = { Pending: 'badge-warning', Approved: 'badge-success', Rejected: 'badge-danger' };
  tbody.innerHTML = filtered.slice().reverse().map(r => `
    <tr>
      <td style="font-family:monospace;color:var(--text-muted);font-size:0.82rem">${r.id}</td>
      <td>
        <div style="font-weight:600">${r.userName}</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">${r.userId}</div>
      </td>
      <td style="font-weight:600;color:var(--accent)">${r.newPlanName}</td>
      <td style="font-size:0.83rem;color:var(--text-soft);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.reason}">${r.reason}</td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${r.submittedAt}</td>
      <td><span class="badge ${statusClass[r.status] || 'badge-warning'}">${r.status}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm btn-ghost" onclick="viewUpgradeRequest('${r.id}')">
            <span class="material-symbols-rounded" style="font-size:14px">visibility</span>
          </button>
          ${r.status === 'Pending' ? `
          <button class="btn btn-sm" style="background:rgba(16,185,129,0.1);color:var(--success);border:1px solid rgba(16,185,129,0.2)" onclick="updateUpgradeStatus('${r.id}','Approved')">
            <span class="material-symbols-rounded" style="font-size:14px">check</span>
          </button>
          <button class="btn btn-sm" style="background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2)" onclick="updateUpgradeStatus('${r.id}','Rejected')">
            <span class="material-symbols-rounded" style="font-size:14px">close</span>
          </button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

function viewUpgradeRequest(id) {
  const requests = JSON.parse(localStorage.getItem('planUpgradeRequests') || '[]');
  const r = requests.find(x => x.id === id);
  if (!r) return;
  const statusClass = { Pending: 'badge-warning', Approved: 'badge-success', Rejected: 'badge-danger' };
  document.getElementById('ud-req-id').textContent = r.id;
  document.getElementById('ud-status').innerHTML = `<span class="badge ${statusClass[r.status]||'badge-warning'}">${r.status}</span>`;
  document.getElementById('ud-name').textContent = r.userName;
  document.getElementById('ud-email').textContent = r.userId;
  document.getElementById('ud-plan').textContent = r.newPlanName;
  document.getElementById('ud-date').textContent = r.submittedAt;
  document.getElementById('ud-reason').textContent = r.reason;
  document.getElementById('ud-admin-note').value = r.adminNote || '';
  const actions = document.getElementById('ud-actions');
  if (r.status === 'Pending') {
    actions.innerHTML = `
      <button class="btn btn-ghost" onclick="closeUpgradeDetailModal()">Cancel</button>
      <button class="btn btn-sm" style="background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2)" onclick="updateUpgradeStatus('${id}','Rejected');closeUpgradeDetailModal()">
        <span class="material-symbols-rounded" style="font-size:16px">close</span> Reject
      </button>
      <button class="btn btn-primary" onclick="updateUpgradeStatus('${id}','Approved');closeUpgradeDetailModal()">
        <span class="material-symbols-rounded" style="font-size:16px">check</span> Approve
      </button>`;
  } else {
    actions.innerHTML = `<button class="btn btn-primary" onclick="closeUpgradeDetailModal()">Close</button>`;
  }
  document.getElementById('upgrade-detail-modal').classList.add('active');
}

function closeUpgradeDetailModal() {
  document.getElementById('upgrade-detail-modal').classList.remove('active');
}

function updateUpgradeStatus(id, status) {
  const requests = JSON.parse(localStorage.getItem('planUpgradeRequests') || '[]');
  const idx = requests.findIndex(r => r.id === id);
  if (idx === -1) return;
  const note = document.getElementById('ud-admin-note') ? document.getElementById('ud-admin-note').value : '';
  requests[idx].status = status;
  requests[idx].adminNote = note;
  requests[idx].resolvedAt = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  localStorage.setItem('planUpgradeRequests', JSON.stringify(requests));
  addAuditLog(`Upgrade Request ${status}`, `${requests[idx].id} — ${requests[idx].userName} → ${requests[idx].newPlanName}`);
  showToast(`Request ${id} has been ${status.toLowerCase()}`, status === 'Approved' ? 'success' : 'info');
  renderUpgradeRequests();
  updateSidebar(); // refresh badge count
}

function openFamilyPayerModal() { document.getElementById('family-payer-modal').classList.add('active'); }
function closeFamilyPayerModal() { document.getElementById('family-payer-modal').classList.remove('active'); }
function addFamilyMember() {
  const name = document.getElementById('fam-name').value.trim();
  const rel = document.getElementById('fam-rel').value;
  if (!name) { showToast('Please enter the dependent\'s name', 'error'); return; }
  const list = document.getElementById('family-members-list');
  const div = document.createElement('div');
  div.style.cssText = 'padding:12px;background:var(--surface-2);border-radius:8px;display:flex;justify-content:space-between;align-items:center;font-size:0.85rem';
  div.innerHTML = `<span><strong>${name}</strong> — ${rel}</span><button onclick="this.parentElement.remove()" style="background:rgba(239,68,68,0.1);color:var(--danger);border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.78rem">Remove</button>`;
  list.appendChild(div);
  document.getElementById('fam-name').value = '';
  showToast(`${name} added as ${rel}`, 'success');
}
function saveFamilyMembers() { showToast('Family members saved successfully!', 'success'); closeFamilyPayerModal(); }

/* ===== BENEFICIARIES ===== */
function openBeneficiariesModal() { document.getElementById('beneficiaries-modal').classList.add('active'); }
function closeBeneficiariesModal() { document.getElementById('beneficiaries-modal').classList.remove('active'); }

/* ===== OTP VERIFICATION ===== */
let otpCode = '';
let pendingAuthData = null;
function otpInput(el, nextNum) {
  el.value = el.value.replace(/[^0-9]/g,'');
  if (el.value && nextNum > 0) { const next = document.getElementById('otp-' + nextNum); if (next) next.focus(); }
}
function otpBack(el, e, prevNum) {
  if (e.key === 'Backspace' && !el.value && prevNum > 0) { const prev = document.getElementById('otp-' + prevNum); if (prev) { prev.focus(); prev.value = ''; } }
}
function generateOTP() { return String(Math.floor(100000 + Math.random() * 900000)); }
function openOTPModal(email, authData) {
  otpCode = generateOTP();
  pendingAuthData = authData;
  document.getElementById('otp-email-display').textContent = email;
  document.getElementById('otp-demo-hint').textContent = otpCode;
  document.getElementById('otp-error').style.display = 'none';
  [1,2,3,4,5,6].forEach(i => { const el = document.getElementById('otp-' + i); if (el) el.value = ''; });
  document.getElementById('otp-modal').classList.add('active');
  setTimeout(() => { const el = document.getElementById('otp-1'); if (el) el.focus(); }, 100);
}
function closeOTPModal() { document.getElementById('otp-modal').classList.remove('active'); pendingAuthData = null; }
function resendOTP() { otpCode = generateOTP(); document.getElementById('otp-demo-hint').textContent = otpCode; showToast('New verification code sent!', 'success'); }
function verifyOTP() {
  const entered = [1,2,3,4,5,6].map(i => { const el = document.getElementById('otp-' + i); return el ? el.value : ''; }).join('');
  if (entered.length < 6) { showToast('Please enter the complete 6-digit code', 'error'); return; }
  if (entered !== otpCode) { document.getElementById('otp-error').style.display = 'block'; return; }
  document.getElementById('otp-modal').classList.remove('active');
  if (pendingAuthData) {
    if (pendingAuthData.type === 'register') {
      const r = Auth.register(pendingAuthData.email, pendingAuthData.password, pendingAuthData.name, pendingAuthData.phone);
      if (r.ok) {
        const login = Auth.login(pendingAuthData.email, pendingAuthData.password);
        if (login.ok) { updateNavbar(); updateSidebar(); showPage('plans'); showToast('Account created & verified!', 'success'); }
      } else { showToast(r.msg, 'error'); }
    } else if (pendingAuthData.type === 'login') {
      const r = Auth.login(pendingAuthData.email, pendingAuthData.password);
      if (r.ok) {
        updateNavbar(); updateSidebar();
        if (r.user.role === 'admin' || r.user.role === 'superadmin') showPage('admin');
        else showPage('plans');
        showToast('Verified & signed in!', 'success');
      }
    }
    pendingAuthData = null;
  }
}
function addRequirement() {
  const input = document.getElementById('new-requirement');
  if (input.value.trim()) {
    const list = document.getElementById('requirements-list');
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--surface-2);border-radius:8px';
    div.innerHTML = `<span>${input.value.trim()}</span><button class="btn btn-sm" style="padding:4px 8px;background:rgba(239,68,68,0.1);color:var(--danger)" onclick="this.parentElement.remove();showToast('Requirement removed','success')"><span class="material-symbols-rounded" style="font-size:16px">close</span></button>`;
    list.appendChild(div);
    addAuditLog('Requirement Added', input.value.trim());
    showToast(`Added requirement: ${input.value}`, 'success');
    input.value = '';
  }
}
function removeRequirement(id) { showToast('Requirement removed', 'success'); }
function addCoverageTag() {
  const input = document.getElementById('new-tag');
  if (input.value.trim()) {
    const container = document.getElementById('coverage-tags');
    const tag = document.createElement('span');
    tag.className = 'badge';
    tag.style.cssText = 'background:rgba(59,130,246,0.1);color:var(--accent)';
    const tagVal = input.value.trim();
    tag.innerHTML = `${tagVal} <button onclick="this.parentElement.remove();showToast('Tag removed','success')" style="background:none;border:none;color:inherit;margin-left:6px;cursor:pointer">×</button>`;
    container.appendChild(tag);
    showToast(`Added coverage tag: ${tagVal}`, 'success');
    input.value = '';
  }
}
function removeTag(tag) { showToast(`Removed tag: ${tag}`, 'success'); }

/* ===== WORKFLOW CONTROLS ===== */
function filterReviewQueue() {
  const status = document.getElementById('queue-filter') ? document.getElementById('queue-filter').value : '';
  const search = document.getElementById('queue-search') ? document.getElementById('queue-search').value.toLowerCase() : '';
  const apps = Storage.getApplications();
  const filtered = apps.filter(a => {
    const matchStatus = !status || a.status.toLowerCase().replace(' ','') === status;
    const matchSearch = !search || JSON.stringify(a).toLowerCase().includes(search);
    return matchStatus && matchSearch;
  });
  showToast(`Showing ${filtered.length} application(s)`, 'info');
}

/* ===== SCHEDULE MANAGEMENT ===== */
function openTimeSlotModal() {
  const day = prompt('Enter day (e.g., Monday) to configure time slots:');
  if (day) showToast(`Time slots for ${day} configured`, 'success');
}
function openBranchModal() {
  const name = prompt('Enter new branch name:');
  if (name) {
    const address = prompt('Enter branch address:');
    if (address) showToast(`Branch "${name}" at ${address} added successfully`, 'success');
  }
}
function openHolidayModal() {
  const date = prompt('Enter date to block (YYYY-MM-DD):');
  if (date) {
    const reason = prompt('Enter reason/holiday name:');
    const list = document.getElementById('holidays-list');
    if (list && reason) {
      const div = document.createElement('div');
      div.style.cssText = 'padding:12px;background:rgba(239,68,68,0.1);border-left:3px solid var(--danger);border-radius:6px';
      const d = new Date(date + 'T00:00:00');
      div.innerHTML = `<div style="font-size:0.85rem;font-weight:600">${d.toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}</div><div style="font-size:0.78rem;color:var(--text-soft);margin-top:4px">${reason}</div>`;
      list.appendChild(div);
      showToast(`${date} blocked as "${reason}"`, 'success');
    }
  }
}

/* ===== CONTENT CUSTOMIZATION ===== */
function openAnnouncementModal() {
  const title = prompt('Announcement title:');
  if (title) {
    const msg = prompt('Announcement message:');
    if (msg) showToast(`Announcement "${title}" published`, 'success');
  }
}
function openRoleModal() {
  const name = prompt('New role name:');
  if (name) showToast(`Role "${name}" created`, 'success');
}
function filterAuditLogs() {
  const search = document.getElementById('audit-search').value.toLowerCase();
  showToast(`Searching audit logs for: "${search}"`, 'info');
}

/* ===== USER & SECURITY MANAGEMENT ===== */
function filterMemberDirectory() {
  const search = document.getElementById('member-search').value.toLowerCase();
  const apps = Storage.getApplications();
  const users = Object.values(Storage.getUsers()).filter(u => u.role !== 'admin');
  const tbody = document.getElementById('member-tbody');
  tbody.innerHTML = '';
  users.forEach(user => {
    if (user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search)) {
      const appCount = apps.filter(a => a.submittedBy === user.email).length;
      const plan = appCount > 0 ? 'Premium' : 'None';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${user.name}</strong></td>
        <td style="color:var(--text-soft);font-size:0.85rem">${user.email}</td>
        <td>${plan}</td>
        <td style="color:var(--text-muted);font-size:0.85rem">${user.createdAt || '—'}</td>
        <td><span class="badge badge-success">Active</span></td>
        <td>
          <button class="btn btn-sm" style="padding:4px 8px" onclick="openPasswordResetModal('${user.email}')">
            <span class="material-symbols-rounded" style="font-size:14px">lock_reset</span>
          </button>
        </td>`;
      tbody.appendChild(row);
    }
  });
}
function openPasswordResetModal(email) {
  showToast(`Password reset link generated for ${email}`, 'success');
}
function openAccountUnlockModal() { showToast('Account unlock functionality', 'info'); }
function open2FAManager() { showToast('2FA management interface', 'info'); }

/* ===== TECHNICAL ADD-ONS ===== */
function openEmailTemplateModal() {
  const name = prompt('Template name:');
  if (name) showToast(`Email template "${name}" created`, 'success');
}

/* ===== AUDIT LOGS ===== */
function filterAuditLogs() {
  const search = document.getElementById('audit-search') ? document.getElementById('audit-search').value.toLowerCase() : '';
  const tbody = document.getElementById('audit-tbody');
  if (!tbody) return;
  const logs = getAuditLogs();
  tbody.innerHTML = logs.filter(l => !search || JSON.stringify(l).toLowerCase().includes(search)).map(l =>
    `<tr>
      <td style="font-size:0.82rem;color:var(--text-muted)">${l.time}</td>
      <td style="font-weight:600">${l.admin}</td>
      <td>${l.action}</td>
      <td style="color:var(--text-soft)">${l.target}</td>
      <td><span class="badge ${l.ok?'badge-success':'badge-danger'}">${l.ok?'Success':'Failed'}</span></td>
    </tr>`
  ).join('') || `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">No logs found</td></tr>`;
}
function getAuditLogs() {
  const stored = JSON.parse(localStorage.getItem('auditLogs') || '[]');
  const defaults = [
    { time: 'May 14, 2026 10:32 AM', admin: 'Super Admin', action: 'Application Approved', target: 'APP-001', ok: true },
    { time: 'May 14, 2026 09:15 AM', admin: 'Admin', action: 'Status Updated', target: 'APP-002 → Rejected', ok: true },
    { time: 'May 13, 2026 04:45 PM', admin: 'Super Admin', action: 'New Plan Created', target: 'Bronze Plan', ok: true },
    { time: 'May 13, 2026 02:30 PM', admin: 'Admin', action: 'Password Reset', target: 'juan@email.com', ok: true },
    { time: 'May 12, 2026 11:00 AM', admin: 'Admin', action: 'Login Attempt', target: 'unknown@mail.com', ok: false }
  ];
  return [...stored, ...defaults];
}
function addAuditLog(action, target) {
  const session = Auth.getSession();
  if (!session) return;
  const logs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
  logs.unshift({ time: new Date().toLocaleString('en-PH'), admin: session.name, action, target, ok: true });
  localStorage.setItem('auditLogs', JSON.stringify(logs.slice(0, 50)));
}

/* ===== CLEAR DATA ===== */
function openClearAllDataModal() {
  document.getElementById('clear-confirm-input').value = '';
  document.getElementById('confirm-error').style.display = 'none';
  document.getElementById('clear-all-data-modal').classList.add('active');
}
function closeClearAllDataModal() { document.getElementById('clear-all-data-modal').classList.remove('active'); }
function executeClearAllData() {
  if (document.getElementById('clear-confirm-input').value !== 'CONFIRM') {
    document.getElementById('confirm-error').style.display = 'block'; return;
  }
  Storage.saveApplications([]);
  closeClearAllDataModal();
  showToast('All application data cleared', 'success');
  setTimeout(() => populateAdminDashboard(), 300);
}
 
/* ===== TOAST ===== */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: 'check_circle', error: 'error', info: 'info' };
  const colors = { success: 'var(--success)', error: 'var(--danger)', info: 'var(--accent)' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="material-symbols-rounded" style="color:${colors[type]};font-size:20px">${icons[type]}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.transition = 'opacity .3s'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 350); }, 3500);
}
 
/* ===== MODAL CLOSE ON BACKDROP ===== */
document.addEventListener('click', e => {
  ['app-modal','file-manager-modal','clear-all-data-modal','philsys-modal','otp-modal','plan-upgrade-modal','family-payer-modal','beneficiaries-modal','new-plan-modal','upgrade-detail-modal'].forEach(id => {
    const m = document.getElementById(id);
    if (m && e.target === m) { m.classList.remove('active'); }
  });
});
 
/* ===== INPUT VALIDATION ===== */
document.addEventListener('DOMContentLoaded', () => {
  const zip = document.getElementById('zip');
  if (zip) zip.addEventListener('input', e => { e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0,4); });
  ['contact','reg-phone','rep-contact'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', e => { e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0,11); });
  });
  // Card formatting
  const cardNum = document.getElementById('card-number');
  if (cardNum) cardNum.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').slice(0,16);
    e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
  });
  const cardExp = document.getElementById('card-expiry');
  if (cardExp) cardExp.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').slice(0,4);
    if (v.length >= 2) v = v.slice(0,2) + '/' + v.slice(2);
    e.target.value = v;
  });
});
 
/* ===== INIT ===== */
Storage.init();
updateNavbar();
const initSession = Auth.getSession();
  if (initSession) {
  updateSidebar();
  if (initSession.role === 'admin' || initSession.role === 'superadmin') showPage('admin');
  else showPage('plans');
} else {
  showPage('home');
}
