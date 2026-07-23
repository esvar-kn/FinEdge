/**
 * FinEdge Core Application Script - Obsidian Gold Refactored
 * Includes: Client-side routing, api integration, state, optimistic updates, search debouncing
 */

// Global State
const STATE = {
  token: localStorage.getItem('finedge_token') || null,
  user: JSON.parse(localStorage.getItem('finedge_user')) || null,
  transactions: [],
  pagination: {
    page: 1,
    limit: 10,
    totalPages: 1,
    total: 0
  },
  filters: {
    type: '',
    category: '',
    q: '',
    from: '',
    to: ''
  },
  budgets: [],
  recurringRules: [],
  categories: {
    used: [],
    suggestions: []
  },
  summaryMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
  summary: null,
  aiInsights: null,
  trendMonths: 6,
  trend: [],
  charts: {
    trendChart: null
  },
  sortField: 'date',
  sortOrder: 'desc'
};

const API_BASE = '';
let searchDebounceTimeout = null;

// Helpers
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  
  let typeClass = '';
  let icon = 'info';
  
  if (type === 'success') {
    typeClass = 'success';
    icon = 'check_circle';
  } else if (type === 'error') {
    typeClass = 'error';
    icon = 'warning';
  } else if (type === 'warning') {
    typeClass = 'warning';
    icon = 'error_outline';
  }
  
  toast.className = `toast ${typeClass}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[18px]">${icon}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

function showLoader() {
  document.getElementById('global-loader').classList.remove('hidden');
}

function hideLoader() {
  document.getElementById('global-loader').classList.add('hidden');
}

// Fetch API Wrapper
async function apiRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;
  
  options.headers = options.headers || {};
  if (STATE.token) {
    options.headers['Authorization'] = `Bearer ${STATE.token}`;
  }
  
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  
  try {
    const res = await fetch(url, options);
    
    if (res.status === 204) {
      return null;
    }
    
    const json = await res.json();
    
    if (!res.ok) {
      if (res.status === 401) {
        logout();
        showToast('Session expired. Please sign in again.', 'warning');
        throw new Error(json.message || 'Unauthorized');
      }
      throw new Error(json.message || 'API request failed');
    }
    
    return json;
  } catch (err) {
    console.error(`API Error on ${path}:`, err);
    throw err;
  }
}

// Auth handlers
async function login(email, password) {
  showLoader();
  try {
    const res = await apiRequest('/api/users/login', {
      method: 'POST',
      body: { email, password }
    });
    
    if (res && res.status === 'success') {
      STATE.token = res.data.token;
      STATE.user = res.data.user;
      localStorage.setItem('finedge_token', res.data.token);
      localStorage.setItem('finedge_user', JSON.stringify(res.data.user));
      
      showToast(`Welcome back, Executive!`, 'success');
      setupAppShell();
      window.location.hash = '#/dashboard';
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

async function register(username, email, password) {
  showLoader();
  try {
    const res = await apiRequest('/api/users/register', {
      method: 'POST',
      body: { username, email, password }
    });
    
    if (res && res.status === 'success') {
      showToast('Registration successful! Please log in.', 'success');
      // Trigger toggle back to login form
      const loginForm = document.getElementById('login-form');
      const registerForm = document.getElementById('register-form');
      const toggleLink = document.getElementById('auth-toggle-link');
      const footerText = document.getElementById('auth-footer-text');
      
      if (loginForm && registerForm) {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        footerText.textContent = "Don't have an account?";
        toggleLink.textContent = 'Sign Up';
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

function logout() {
  STATE.token = null;
  STATE.user = null;
  localStorage.removeItem('finedge_token');
  localStorage.removeItem('finedge_user');
  
  // Hide layout containers
  document.getElementById('app-sidebar').classList.add('hidden');
  document.getElementById('mobile-header').classList.add('hidden');
  
  const main = document.getElementById('app-main');
  main.className = 'min-h-screen flex flex-col justify-center items-center bg-background';
  
  window.location.hash = '#/login';
}

function setupAppShell() {
  document.getElementById('app-sidebar').classList.remove('hidden');
  document.getElementById('mobile-header').classList.remove('hidden');
  
  const main = document.getElementById('app-main');
  main.className = 'md:ml-64 min-h-screen flex flex-col';
  
  if (STATE.user) {
    document.getElementById('user-display-name').textContent = STATE.user.username;
    document.getElementById('user-display-email').textContent = STATE.user.email;
    const initials = STATE.user.username.slice(0, 2).toUpperCase();
    document.getElementById('user-avatar-initials').textContent = initials;
  }
}

// Modal functions
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  const form = document.querySelector(`#${id} form`);
  if (form) form.reset();
  
  if (id === 'csv-modal') {
    document.getElementById('csv-filename').textContent = '';
    document.getElementById('csv-submit-btn').disabled = true;
    document.getElementById('csv-file-input').value = '';
  }
}

async function loadCategories() {
  try {
    const res = await apiRequest('/api/categories');
    if (res && res.status === 'success') {
      STATE.categories = res.data;
      const listIds = ['category-suggestions', 'budget-category-suggestions', 'rec-category-suggestions'];
      listIds.forEach(listId => {
        const datalist = document.getElementById(listId);
        if (datalist) {
          datalist.innerHTML = STATE.categories.suggestions.map(cat => `<option value="${cat}">`).join('');
        }
      });
    }
  } catch (err) {
    console.error('Failed to load categories', err);
  }
}

// Router render definitions
const VIEWS = {
  login: () => {
    // Hide layout shell components just in case
    document.getElementById('app-sidebar').classList.add('hidden');
    document.getElementById('mobile-header').classList.add('hidden');
    document.getElementById('app-main').className = 'min-h-screen flex flex-col justify-center items-center bg-background';
    
    document.getElementById('app-root').innerHTML = `
      <!-- Atmospheric background layer -->
      <div class="fixed inset-0 z-0 opacity-20 pointer-events-none">
        <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-surface-container-highest/30 blur-[150px] rounded-full"></div>
      </div>
      
      <!-- Login Container -->
      <main class="relative z-10 w-full max-w-[440px] px-margin-mobile md:px-0 fade-in">
        <!-- Brand Identity -->
        <div class="flex flex-col items-center mb-10 space-y-2">
          <div class="w-12 h-12 bg-primary flex items-center justify-center rounded mb-4 shadow-lg shadow-primary/10">
            <span class="material-symbols-outlined text-on-primary text-2xl" style="font-variation-settings: 'FILL' 1;">account_balance</span>
          </div>
          <h1 class="font-headline-lg text-3xl font-black text-primary tracking-widest uppercase">FinEdge</h1>
          <p class="font-label-md text-xs text-on-surface-variant tracking-widest uppercase opacity-70">Wealth Management Portal</p>
        </div>
        
        <!-- Form Card Container -->
        <div class="bg-surface-container-low border border-outline-variant p-10 shadow-2xl relative">
          <!-- Top Golden Accent Line -->
          <div class="absolute top-0 left-0 right-0 h-[1px] bg-primary"></div>
          
          <!-- Login Form -->
          <form id="login-form" class="space-y-6">
            <h2 class="text-xl font-bold tracking-tight text-on-surface uppercase mb-6">Sign In</h2>
            <div class="space-y-2">
              <label class="block font-label-md text-xs text-on-surface-variant uppercase tracking-widest" for="email">
                Corporate Email
              </label>
              <div class="relative group">
                <input class="w-full bg-surface-container-highest border border-outline-variant px-4 py-3.5 text-on-surface focus:outline-none focus:border-primary focus:ring-0 transition-colors placeholder:text-surface-variant" id="email" required placeholder="executive@finedge.com" type="email"/>
                <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline group-focus-within:text-primary transition-colors">
                  <span class="material-symbols-outlined text-[20px]">alternate_email</span>
                </div>
              </div>
            </div>
            
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <label class="block font-label-md text-xs text-on-surface-variant uppercase tracking-widest" for="password">
                  Passcode
                </label>
              </div>
              <div class="relative group">
                <input class="w-full bg-surface-container-highest border border-outline-variant px-4 py-3.5 text-on-surface focus:outline-none focus:border-primary focus:ring-0 transition-colors placeholder:text-surface-variant" id="password" required placeholder="••••••••" type="password"/>
                <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline group-focus-within:text-primary transition-colors">
                  <span class="material-symbols-outlined text-[20px]">lock</span>
                </div>
              </div>
            </div>
            
            <button class="w-full bg-primary py-4 text-on-primary font-bold text-xs uppercase tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-lg shadow-primary/20 cursor-pointer" type="submit">
              <span>Log In</span>
              <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </form>

          <!-- Register Form -->
          <form id="register-form" class="space-y-6 hidden">
            <h2 class="text-xl font-bold tracking-tight text-on-surface uppercase mb-6">Create Account</h2>
            <div class="space-y-2">
              <label class="block font-label-md text-xs text-on-surface-variant uppercase tracking-widest" for="reg-username">
                Username
              </label>
              <div class="relative group">
                <input class="w-full bg-surface-container-highest border border-outline-variant px-4 py-3.5 text-on-surface focus:outline-none focus:border-primary focus:ring-0 transition-colors placeholder:text-surface-variant" id="reg-username" required placeholder="executive_name" type="text"/>
                <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline group-focus-within:text-primary transition-colors">
                  <span class="material-symbols-outlined text-[20px]">person</span>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <label class="block font-label-md text-xs text-on-surface-variant uppercase tracking-widest" for="reg-email">
                Email Address
              </label>
              <div class="relative group">
                <input class="w-full bg-surface-container-highest border border-outline-variant px-4 py-3.5 text-on-surface focus:outline-none focus:border-primary focus:ring-0 transition-colors placeholder:text-surface-variant" id="reg-email" required placeholder="executive@finedge.com" type="email"/>
                <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline group-focus-within:text-primary transition-colors">
                  <span class="material-symbols-outlined text-[20px]">alternate_email</span>
                </div>
              </div>
            </div>
            
            <div class="space-y-2">
              <label class="block font-label-md text-xs text-on-surface-variant uppercase tracking-widest" for="reg-password">
                MFA Passcode
              </label>
              <div class="relative group">
                <input class="w-full bg-surface-container-highest border border-outline-variant px-4 py-3.5 text-on-surface focus:outline-none focus:border-primary focus:ring-0 transition-colors placeholder:text-surface-variant" id="reg-password" required placeholder="Min. 6 characters" type="password"/>
                <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline group-focus-within:text-primary transition-colors">
                  <span class="material-symbols-outlined text-[20px]">lock</span>
                </div>
              </div>
            </div>
            
            <button class="w-full bg-primary py-4 text-on-primary font-bold text-xs uppercase tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-lg shadow-primary/20 cursor-pointer" type="submit">
              <span>Register</span>
              <span class="material-symbols-outlined text-sm">person_add</span>
            </button>
          </form>

          <!-- Toggle link -->
          <div class="mt-8 pt-8 border-t border-outline-variant/30 text-center">
            <p id="auth-footer-text" class="font-label-sm text-xs text-on-surface-variant opacity-60 mb-2">
              Don't have an account?
            </p>
            <a id="auth-toggle-link" class="text-primary font-label-sm text-xs hover:underline tracking-widest uppercase font-bold cursor-pointer" href="#">
              Sign Up
            </a>
          </div>
        </div>

        <div class="mt-12 flex justify-between px-2 text-[10px] text-outline uppercase tracking-[0.1em]">
          <span>© 2026 FinEdge Asset Management</span>
          <div class="flex space-x-4">
            <a class="hover:text-on-surface transition-colors" href="#">Privacy</a>
            <a class="hover:text-on-surface transition-colors" href="#">Legal</a>
          </div>
        </div>
      </main>
    `;

    // Auth page handlers
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toggleLink = document.getElementById('auth-toggle-link');
    const footerText = document.getElementById('auth-footer-text');

    toggleLink.addEventListener('click', (e) => {
      e.preventDefault();
      const showReg = loginForm.classList.contains('hidden') ? false : true;
      if (showReg) {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        footerText.textContent = 'Already authorized?';
        toggleLink.textContent = 'Sign In';
      } else {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        footerText.textContent = "Don't have an account?";
        toggleLink.textContent = 'Sign Up';
      }
    });

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      login(document.getElementById('email').value, document.getElementById('password').value);
    });

    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      register(
        document.getElementById('reg-username').value,
        document.getElementById('reg-email').value,
        document.getElementById('reg-password').value
      );
    });
  },

  dashboard: async () => {
    document.getElementById('app-root').innerHTML = `
      <div class="flex-1 p-margin-desktop space-y-8 max-w-[1400px] mx-auto w-full fade-in">
        <!-- Dashboard Header -->
        <section class="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h3 class="font-headline-lg text-3xl font-black text-on-surface tracking-tight uppercase">Executive Dashboard</h3>
            <p class="font-body-md text-sm text-on-surface-variant mt-2 max-w-2xl opacity-85">
              Strategic oversight of liquid assets and metrics for the active calendar period.
            </p>
          </div>
          <div class="flex gap-4 items-center">
            <input type="month" id="dashboard-month-select" class="bg-surface-container-low border border-surface-variant text-on-surface text-xs rounded py-2 px-4 focus:ring-1 focus:ring-primary focus:border-primary" value="${STATE.summaryMonth}">
            <button id="add-tx-dash-btn" class="px-6 py-2.5 bg-primary text-on-primary font-bold rounded text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-2">
              <span class="material-symbols-outlined text-sm">add</span> Add Log
            </button>
          </div>
        </section>

        <!-- Bento Stats Grid -->
        <section class="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          <div class="bento-card p-8 flex flex-col justify-between premium-border">
            <div>
              <div class="flex justify-between items-start mb-4">
                <span class="text-label-md font-label-md text-xs text-on-surface-variant uppercase tracking-widest">Total Income</span>
                <span class="material-symbols-outlined text-primary text-xl" style="font-variation-settings: 'FILL' 1;">trending_up</span>
              </div>
              <div class="text-3xl font-bold text-on-surface" id="dash-income">$0.00</div>
            </div>
            <div class="mt-4 text-xs font-semibold text-primary uppercase tracking-wider">Deposited Current Month</div>
          </div>
          
          <div class="bento-card p-8 flex flex-col justify-between border-t-2 border-error">
            <div>
              <div class="flex justify-between items-start mb-4">
                <span class="text-label-md font-label-md text-xs text-on-surface-variant uppercase tracking-widest">Operating Expenses</span>
                <span class="material-symbols-outlined text-error text-xl" style="font-variation-settings: 'FILL' 1;">trending_down</span>
              </div>
              <div class="text-3xl font-bold text-on-surface" id="dash-expenses">$0.00</div>
            </div>
            <div class="mt-4 text-xs font-semibold text-error uppercase tracking-wider">Debited Current Month</div>
          </div>

          <div class="bento-card p-8 flex flex-col justify-between border-t-2 border-primary">
            <div>
              <div class="flex justify-between items-start mb-4">
                <span class="text-label-md font-label-md text-xs text-on-surface-variant uppercase tracking-widest">Net Surplus</span>
                <span class="material-symbols-outlined text-primary text-xl" style="font-variation-settings: 'FILL' 1;">wallet</span>
              </div>
              <div class="text-3xl font-bold text-on-surface" id="dash-savings">$0.00</div>
            </div>
            <div class="mt-4 text-xs font-semibold uppercase tracking-wider" id="dash-savings-indicator">Calculated Velocity</div>
          </div>
        </section>

        <!-- Dynamic Visuals -->
        <section class="grid grid-cols-12 gap-gutter">
          <!-- Monthly chart canvas -->
          <div class="col-span-12 lg:col-span-8 bento-card p-8 flex flex-col">
            <h3 class="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">bar_chart</span> Monthly Cashflow Trends
            </h3>
            <div class="h-[320px] relative w-full">
              <canvas id="trend-chart-canvas"></canvas>
            </div>
          </div>

          <!-- Insights -->
          <div class="col-span-12 lg:col-span-4 bento-card p-8 flex flex-col justify-between">
            <div>
              <h3 class="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">sparkles</span> Portfolio Advisory
              </h3>
              <div class="space-y-4" id="insights-list-container">
                <div class="text-center text-on-surface-variant py-10">
                  <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <span class="text-xs">Fetching advisor models...</span>
                </div>
              </div>
            </div>
            <div class="mt-6 border-t border-surface-variant pt-4 text-[10px] text-center text-on-surface-variant uppercase tracking-wider" id="ai-insight-note"></div>
          </div>
        </section>
      </div>
    `;

    document.getElementById('dashboard-month-select').addEventListener('change', (e) => {
      STATE.summaryMonth = e.target.value;
      updateDashboardData();
    });

    document.getElementById('add-tx-dash-btn').addEventListener('click', () => {
      document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
      document.getElementById('transaction-modal-title').textContent = 'Add Transaction';
      document.getElementById('tx-id').value = '';
      openModal('transaction-modal');
    });

    await updateDashboardData();
  },

  transactions: async () => {
    document.getElementById('app-root').innerHTML = `
      <div class="flex-1 p-margin-desktop space-y-8 max-w-[1400px] mx-auto w-full fade-in">
        <!-- Header -->
        <section class="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h3 class="font-headline-lg text-3xl font-black text-on-surface tracking-tight uppercase">Transaction Ledger</h3>
            <p class="font-body-md text-sm text-on-surface-variant mt-2 max-w-2xl opacity-85">
              Comprehensive ledger logging of deposits, allocations, and expenditures.
            </p>
          </div>
          <div class="flex gap-4">
            <button id="csv-import-btn" class="px-5 py-2.5 bg-surface-container border border-surface-variant hover:border-primary text-on-surface hover:text-primary font-bold rounded text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2">
              <span class="material-symbols-outlined text-sm">upload</span> Import CSV
            </button>
            <button id="csv-export-btn" class="px-5 py-2.5 bg-surface-container border border-surface-variant hover:border-primary text-on-surface hover:text-primary font-bold rounded text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2">
              <span class="material-symbols-outlined text-sm">download</span> Export CSV
            </button>
            <button id="add-tx-log-btn" class="px-5 py-2.5 bg-primary text-on-primary font-bold rounded text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-2">
              <span class="material-symbols-outlined text-sm">add</span> Add Transaction
            </button>
          </div>
        </section>

        <!-- Filters Grid Bar -->
        <section class="bento-card p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div class="space-y-1">
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Search Description</label>
            <div class="relative">
              <input type="text" id="filter-search" placeholder="Search logs..." class="w-full bg-surface-container-highest border border-outline-variant px-3 py-2 text-xs text-on-surface rounded focus:outline-none focus:border-primary focus:ring-0 placeholder:text-surface-variant" value="${STATE.filters.q}"/>
            </div>
          </div>
          
          <div class="space-y-1">
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Flow Type</label>
            <select id="filter-type" class="w-full bg-surface-container-highest border border-outline-variant px-3 py-2 text-xs text-on-surface rounded focus:outline-none focus:border-primary focus:ring-0">
              <option value="">All Flow Types</option>
              <option value="expense" ${STATE.filters.type === 'expense' ? 'selected' : ''}>Expenses Only</option>
              <option value="income" ${STATE.filters.type === 'income' ? 'selected' : ''}>Income Only</option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Category</label>
            <input type="text" id="filter-category" placeholder="Filter category..." class="w-full bg-surface-container-highest border border-outline-variant px-3 py-2 text-xs text-on-surface rounded focus:outline-none focus:border-primary focus:ring-0 placeholder:text-surface-variant" value="${STATE.filters.category}" list="category-suggestions"/>
          </div>

          <div class="space-y-1">
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">From Date</label>
            <input type="date" id="filter-from" class="w-full bg-surface-container-highest border border-outline-variant px-3 py-2 text-xs text-on-surface rounded focus:outline-none focus:border-primary" value="${STATE.filters.from}"/>
          </div>

          <div class="space-y-1 flex flex-col justify-between">
            <div class="space-y-1">
              <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">To Date</label>
              <div class="flex gap-2">
                <input type="date" id="filter-to" class="w-full bg-surface-container-highest border border-outline-variant px-3 py-2 text-xs text-on-surface rounded focus:outline-none focus:border-primary" value="${STATE.filters.to}"/>
                <button id="clear-filters-btn" class="px-3 bg-surface-container-high border border-outline-variant hover:border-primary text-on-surface hover:text-primary rounded cursor-pointer transition-colors" title="Reset Filters">
                  <span class="material-symbols-outlined text-sm">restart_alt</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Ledger Table container -->
        <section class="bento-card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-left">
              <thead>
                <tr class="border-b border-surface-variant bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                  <th class="p-5 cursor-pointer hover:text-primary transition-colors" data-sort="date">Date <span id="sort-icon-date" class="material-symbols-outlined text-xs">arrow_drop_down</span></th>
                  <th class="p-5">Category</th>
                  <th class="p-5">Description</th>
                  <th class="p-5 cursor-pointer hover:text-primary transition-colors" data-sort="amount">Amount <span id="sort-icon-amount" class="material-symbols-outlined text-xs"></span></th>
                  <th class="p-5">Type</th>
                  <th class="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody id="transactions-table-body" class="divide-y divide-surface-variant/30 text-xs">
                <tr>
                  <td colspan="6" class="p-10 text-center text-on-surface-variant">Loading records ledger...</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination bar -->
          <div class="bg-surface-container-low p-5 flex items-center justify-between border-t border-surface-variant">
            <span class="text-xs text-on-surface-variant uppercase tracking-wider" id="pagination-info">Showing 0-0 of 0 lines</span>
            <div class="flex gap-2">
              <button id="prev-page-btn" class="px-4 py-2 border border-outline-variant hover:border-primary rounded text-xs uppercase tracking-widest text-on-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">Prev</button>
              <button id="next-page-btn" class="px-4 py-2 border border-outline-variant hover:border-primary rounded text-xs uppercase tracking-widest text-on-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">Next</button>
            </div>
          </div>
        </section>
      </div>
    `;

    // Event binders
    document.getElementById('filter-search').addEventListener('input', (e) => {
      STATE.filters.q = e.target.value;
      debounceFetchTransactions();
    });

    document.getElementById('filter-type').addEventListener('change', (e) => {
      STATE.filters.type = e.target.value;
      STATE.pagination.page = 1;
      fetchTransactions();
    });

    document.getElementById('filter-category').addEventListener('input', (e) => {
      STATE.filters.category = e.target.value;
      debounceFetchTransactions();
    });

    document.getElementById('filter-from').addEventListener('change', (e) => {
      STATE.filters.from = e.target.value;
      STATE.pagination.page = 1;
      fetchTransactions();
    });

    document.getElementById('filter-to').addEventListener('change', (e) => {
      STATE.filters.to = e.target.value;
      STATE.pagination.page = 1;
      fetchTransactions();
    });

    document.getElementById('clear-filters-btn').addEventListener('click', () => {
      STATE.filters = { type: '', category: '', q: '', from: '', to: '' };
      document.getElementById('filter-search').value = '';
      document.getElementById('filter-type').value = '';
      document.getElementById('filter-category').value = '';
      document.getElementById('filter-from').value = '';
      document.getElementById('filter-to').value = '';
      STATE.pagination.page = 1;
      fetchTransactions();
    });

    document.getElementById('csv-import-btn').addEventListener('click', () => openModal('csv-modal'));
    document.getElementById('csv-export-btn').addEventListener('click', exportTransactionsCSV);
    
    document.getElementById('add-tx-log-btn').addEventListener('click', () => {
      document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
      document.getElementById('transaction-modal-title').textContent = 'Add Transaction';
      document.getElementById('tx-id').value = '';
      openModal('transaction-modal');
    });

    document.getElementById('prev-page-btn').addEventListener('click', () => {
      if (STATE.pagination.page > 1) {
        STATE.pagination.page--;
        fetchTransactions();
      }
    });

    document.getElementById('next-page-btn').addEventListener('click', () => {
      if (STATE.pagination.page < STATE.pagination.totalPages) {
        STATE.pagination.page++;
        fetchTransactions();
      }
    });

    // Sort binds
    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.sort;
        const currentOrder = STATE.sortField === field && STATE.sortOrder === 'asc' ? 'desc' : 'asc';
        STATE.sortField = field;
        STATE.sortOrder = currentOrder;
        
        // Reset header labels
        document.getElementById('sort-icon-date').textContent = '';
        document.getElementById('sort-icon-amount').textContent = '';
        
        const targetIcon = document.getElementById(`sort-icon-${field}`);
        if (targetIcon) {
          targetIcon.textContent = currentOrder === 'asc' ? 'arrow_drop_up' : 'arrow_drop_down';
        }
        
        fetchTransactions();
      });
    });

    fetchTransactions();
  },

  budgets: async () => {
    document.getElementById('app-root').innerHTML = `
      <div class="flex-1 p-margin-desktop space-y-8 max-w-[1400px] mx-auto w-full fade-in">
        <!-- Header -->
        <section class="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h3 class="font-headline-lg text-3xl font-black text-on-surface tracking-tight uppercase">Executive Budgeting</h3>
            <p class="font-body-md text-sm text-on-surface-variant mt-2 max-w-2xl opacity-85">
              Allocation targets and strategic spend caps across accounts for: <span id="budget-current-month" class="text-primary font-bold"></span>
            </p>
          </div>
          <button id="set-budget-btn" class="px-6 py-2.5 bg-primary text-on-primary font-bold rounded text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">adjust</span> Set Budget Limit
          </button>
        </section>

        <!-- Budget Hero Snapshot -->
        <section class="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          <div class="lg:col-span-2 bg-surface-container p-8 border border-surface-variant premium-border gold-glow relative">
            <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Monthly Accumulative Status</span>
            <div class="flex items-baseline gap-4 mt-4">
              <span class="text-4xl font-black text-on-surface" id="hero-budget-spent">$0.00</span>
              <span class="text-sm text-on-surface-variant" id="hero-budget-limit">of $0.00</span>
            </div>
            <div class="w-full h-2 bg-surface-container-low border border-surface-variant rounded-full mt-8 overflow-hidden relative">
              <div id="hero-budget-fill" class="h-full bg-primary transition-all duration-500" style="width: 0%;"></div>
            </div>
            <div class="flex justify-between mt-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              <span id="hero-budget-velocity">Velocity: Normal</span>
              <span id="hero-budget-percent" class="text-primary">0% Utilized</span>
            </div>
          </div>
          
          <div class="bg-surface-container-high border border-surface-variant p-8 rounded flex flex-col justify-between">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Allocated Capital Remaining</span>
              <h4 class="text-3xl font-black text-on-surface mt-2" id="hero-budget-remaining">$0.00</h4>
            </div>
            <div class="pt-6 border-t border-surface-variant/30 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant flex justify-between">
              <span>Overall Utilization Alert</span>
              <span id="hero-budget-alert-status" class="text-success">Satisfactory</span>
            </div>
          </div>
        </section>

        <!-- Budget Categories Cards Grid -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter" id="budgets-container">
          <div class="col-span-full text-center text-on-surface-variant py-10">
            <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <span>Fetching category cards...</span>
          </div>
        </section>
      </div>
    `;

    document.getElementById('set-budget-btn').addEventListener('click', () => {
      document.getElementById('budget-modal-title').textContent = 'Set Category Budget';
      document.getElementById('budget-category').value = '';
      document.getElementById('budget-category').removeAttribute('readonly');
      openModal('budget-modal');
    });

    fetchBudgets();
  },

  recurring: async () => {
    document.getElementById('app-root').innerHTML = `
      <div class="flex-1 p-margin-desktop space-y-8 max-w-[1400px] mx-auto w-full fade-in">
        <!-- Header -->
        <section class="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h3 class="font-headline-lg text-3xl font-black text-on-surface tracking-tight uppercase">Automated Recurring rules</h3>
            <p class="font-body-md text-sm text-on-surface-variant mt-2 max-w-2xl opacity-85">
              Define, automate, and process repeating payroll, invoices, or subscriptions.
            </p>
          </div>
          <button id="add-recurring-btn" class="px-6 py-2.5 bg-primary text-on-primary font-bold rounded text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">schedule_send</span> Create Automation
          </button>
        </section>

        <!-- Active recurring grid card -->
        <section class="bento-card overflow-hidden">
          <h3 class="text-sm font-bold uppercase tracking-widest text-primary p-6 border-b border-surface-variant bg-surface-container-low">Active Automation Schemes</h3>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-left text-xs">
              <thead>
                <tr class="border-b border-surface-variant bg-surface-container-low/30 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                  <th class="p-5">Type</th>
                  <th class="p-5">Category</th>
                  <th class="p-5">Description</th>
                  <th class="p-5">Frequency</th>
                  <th class="p-5">Anchor Day</th>
                  <th class="p-5">Amount</th>
                  <th class="p-5">Next Execution</th>
                  <th class="p-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody id="recurring-table-body" class="divide-y divide-surface-variant/30">
                <tr>
                  <td colspan="8" class="p-10 text-center text-on-surface-variant">Loading scheduled automations...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;

    document.getElementById('add-recurring-btn').addEventListener('click', () => {
      openModal('recurring-modal');
    });

    fetchRecurringRules();
  },

  settings: () => {
    document.getElementById('app-root').innerHTML = `
      <div class="flex-1 p-margin-desktop space-y-8 max-w-[640px] mx-auto w-full fade-in">
        <h3 class="font-headline-lg text-3xl font-black text-on-surface tracking-tight uppercase">Settings</h3>
        <p class="font-body-md text-sm text-on-surface-variant opacity-85 leading-relaxed">
          Manage secure credentials and configurations for your profile.
        </p>

        <!-- Update Passcode -->
        <div class="bg-surface-container border border-surface-variant p-8 rounded relative">
          <div class="absolute top-0 left-0 right-0 h-[1px] bg-primary"></div>
          <h4 class="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">key</span> Modify Sign In Passcode
          </h4>
          <form id="change-password-form" class="space-y-4">
            <div class="space-y-1.5">
              <label for="old-password" class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Current Passcode</label>
              <input type="password" id="old-password" required placeholder="••••••••" class="w-full bg-surface-container-highest border border-outline-variant px-4 py-2.5 text-xs text-on-surface rounded focus:outline-none focus:border-primary"/>
            </div>
            <div class="space-y-1.5">
              <label for="new-password" class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">New Passcode</label>
              <input type="password" id="new-password" required placeholder="Min. 6 characters" class="w-full bg-surface-container-highest border border-outline-variant px-4 py-2.5 text-xs text-on-surface rounded focus:outline-none focus:border-primary"/>
            </div>
            <button type="submit" class="px-5 py-2.5 bg-primary text-on-primary font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer">Update Passcode</button>
          </form>
        </div>

        <!-- Danger area -->
        <div class="bg-surface-container border border-error/30 p-8 rounded relative">
          <h4 class="text-sm font-bold uppercase tracking-widest text-error mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">warning</span> Destructive Action Zone
          </h4>
          <p class="text-xs text-on-surface-variant leading-relaxed mb-6">
            Permanently delete your profile ledger record. All logs, budgets, and automation rules will be wiped out from database storage immediately and irreversibly.
          </p>
          <button id="delete-account-btn" class="px-5 py-2.5 bg-error text-on-error font-bold text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all cursor-pointer">Delete Profile Account</button>
        </div>
      </div>
    `;

    document.getElementById('change-password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('old-password').value;
      const newPassword = document.getElementById('new-password').value;
      
      showLoader();
      try {
        const res = await apiRequest('/api/users/password', {
          method: 'PUT',
          body: { currentPassword, newPassword }
        });
        if (res && res.status === 'success') {
          showToast('Credentials successfully modified.', 'success');
          e.target.reset();
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        hideLoader();
      }
    });

    document.getElementById('delete-account-btn').addEventListener('click', () => {
      const confirmPassword = prompt('To confirm profile deletion, please re-type your passcode:');
      if (confirmPassword === null) return;
      if (!confirmPassword.trim()) {
        showToast('Password verification failed.', 'error');
        return;
      }
      executeAccountDelete(confirmPassword);
    });
  }
};

async function executeAccountDelete(password) {
  showLoader();
  try {
    await apiRequest('/api/users/me', {
      method: 'DELETE',
      body: { password }
    });
    showToast('Your executive profile was closed.', 'success');
    logout();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

// Search debounce
function debounceFetchTransactions() {
  clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(() => {
    STATE.pagination.page = 1;
    fetchTransactions();
  }, 300);
}

// Fetch dashboard values
async function updateDashboardData() {
  try {
    const summaryRes = await apiRequest(`/api/transactions/summary?month=${STATE.summaryMonth}`);
    if (summaryRes && summaryRes.status === 'success') {
      STATE.summary = summaryRes.data.summary;
      
      const sum = STATE.summary;
      document.getElementById('dash-income').textContent = formatCurrency(sum.totalIncome);
      document.getElementById('dash-expenses').textContent = formatCurrency(sum.totalExpenses);
      document.getElementById('dash-savings').textContent = formatCurrency(sum.netBalance);
      
      const savingsIndicator = document.getElementById('dash-savings-indicator');
      const ratio = sum.totalIncome > 0 ? sum.totalExpenses / sum.totalIncome : 0;
      
      if (ratio >= 0.70) {
        savingsIndicator.className = 'mt-4 text-xs font-semibold text-error uppercase tracking-wider flex items-center gap-1';
        savingsIndicator.innerHTML = `<span class="material-symbols-outlined text-[14px]">warning</span> Velocity: Exceeded Cap`;
      } else {
        savingsIndicator.className = 'mt-4 text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1';
        savingsIndicator.innerHTML = `<span class="material-symbols-outlined text-[14px]">check_circle</span> Velocity: Normal`;
      }
    }
  } catch (err) {
    showToast('Failed to fetch account metrics.', 'error');
  }

  // Load trend charts
  try {
    const trendRes = await apiRequest(`/api/transactions/trend?months=${STATE.trendMonths}`);
    if (trendRes && trendRes.status === 'success') {
      STATE.trend = trendRes.data.trend;
      renderTrendChart(STATE.trend);
    }
  } catch (err) {
    console.error('Failed to load chart metrics', err);
  }

  // Fetch insights
  try {
    const insightsContainer = document.getElementById('insights-list-container');
    const noteContainer = document.getElementById('ai-insight-note');
    
    const insightsRes = await apiRequest(`/api/transactions/ai-insights?month=${STATE.summaryMonth}`);
    if (insightsRes && insightsRes.status === 'success') {
      const data = insightsRes.data;
      
      if (data.source === 'ai') {
        noteContainer.textContent = `Insights Model: ${data.model}`;
        const bullets = data.advice.split('\n')
          .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
          .map(line => line.replace(/^[-*]\s+/, ''));
          
        if (bullets.length > 0) {
          insightsContainer.innerHTML = bullets.map(b => `
            <div class="flex items-start gap-3 p-3.5 bg-surface-container-high/40 border border-surface-variant rounded">
              <span class="material-symbols-outlined text-primary text-sm mt-0.5">insights</span>
              <p class="text-xs leading-relaxed text-on-surface">${escapeHTML(b)}</p>
            </div>
          `).join('');
        } else {
          insightsContainer.innerHTML = `
            <div class="flex items-start gap-3 p-3.5 bg-surface-container-high/40 border border-surface-variant rounded">
              <span class="material-symbols-outlined text-primary text-sm mt-0.5">insights</span>
              <p class="text-xs leading-relaxed text-on-surface whitespace-pre-wrap">${escapeHTML(data.advice)}</p>
            </div>
          `;
        }
      } else {
        noteContainer.textContent = data.note || 'Tonal Rule engine insights';
        if (data.insights && data.insights.length > 0) {
          insightsContainer.innerHTML = data.insights.map(ins => {
            const isWarning = ins.toLowerCase().includes('alert') || ins.toLowerCase().includes('warning');
            const alertClass = isWarning ? 'border-error/30 text-error' : 'border-surface-variant text-on-surface';
            const icon = isWarning ? 'warning' : 'info';
            return `
              <div class="flex items-start gap-3 p-3.5 bg-surface-container-high/40 border ${alertClass} rounded">
                <span class="material-symbols-outlined text-sm mt-0.5">${icon}</span>
                <p class="text-xs leading-relaxed">${escapeHTML(ins)}</p>
              </div>
            `;
          }).join('');
        } else {
          insightsContainer.innerHTML = `
            <div class="flex items-start gap-3 p-3.5 bg-surface-container-high/40 border border-surface-variant rounded text-primary">
              <span class="material-symbols-outlined text-sm mt-0.5">check_circle</span>
              <p class="text-xs leading-relaxed font-bold">Ledger accounts satisfactory. All budget caps preserved.</p>
            </div>
          `;
        }
      }
    }
  } catch (err) {
    console.error('Failed to get insights', err);
  }
}

// Chart render using golden theme color
function renderTrendChart(trendData) {
  const canvas = document.getElementById('trend-chart-canvas');
  if (!canvas) return;
  
  if (STATE.charts.trendChart) {
    STATE.charts.trendChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  const labels = trendData.map(t => t.month);
  const incomeData = trendData.map(t => t.income);
  const expenseData = trendData.map(t => t.expenses);
  
  STATE.charts.trendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Total Deposits ($)',
          data: incomeData,
          backgroundColor: '#ffd165',
          borderRadius: 2,
        },
        {
          label: 'Operating Debits ($)',
          data: expenseData,
          backgroundColor: '#343535',
          borderColor: '#4f4633',
          borderWidth: 1,
          borderRadius: 2,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#e3e2e2', font: { family: 'Inter', size: 10 } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#d3c5ac', font: { family: 'Inter', size: 10 } },
          grid: { color: '#1a1c1c' }
        },
        y: {
          ticks: { color: '#d3c5ac', font: { family: 'Inter', size: 10 } },
          grid: { color: '#1a1c1c' }
        }
      }
    }
  });
}

// Fetch ledger data
async function fetchTransactions() {
  const tbody = document.getElementById('transactions-table-body');
  if (!tbody) return;
  
  const params = new URLSearchParams();
  if (STATE.filters.type) params.append('type', STATE.filters.type);
  if (STATE.filters.category) params.append('category', STATE.filters.category);
  if (STATE.filters.q) params.append('q', STATE.filters.q);
  if (STATE.filters.from) params.append('from', STATE.filters.from);
  if (STATE.filters.to) params.append('to', STATE.filters.to);
  
  params.append('page', STATE.pagination.page);
  params.append('limit', STATE.pagination.limit);
  
  if (STATE.sortField) {
    params.append('sort', STATE.sortField);
    params.append('order', STATE.sortOrder || 'desc');
  }
  
  try {
    const res = await apiRequest(`/api/transactions?${params.toString()}`);
    if (res && res.status === 'success') {
      STATE.transactions = res.data.transactions;
      STATE.pagination.totalPages = res.totalPages;
      STATE.pagination.total = res.total;
      
      renderTransactionsTable(STATE.transactions);
      
      const start = (STATE.pagination.page - 1) * STATE.pagination.limit + 1;
      const end = Math.min(start + STATE.transactions.length - 1, res.total);
      document.getElementById('pagination-info').textContent = res.total > 0 
        ? `Showing ${start}-${end} of ${res.total} records`
        : 'Showing 0-0 of 0 records';
        
      document.getElementById('prev-page-btn').disabled = STATE.pagination.page === 1;
      document.getElementById('next-page-btn').disabled = STATE.pagination.page >= res.totalPages;
    }
  } catch (err) {
    showToast('Failed to retrieve transactions.', 'error');
  }
}

function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('transactions-table-body');
  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-12 text-center text-on-surface-variant font-bold uppercase tracking-wider">No corresponding records resolved.</td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = transactions.map(t => `
    <tr id="tx-row-${t.id}" class="hover:bg-surface-container-high/30 transition-colors">
      <td class="p-5 font-mono text-on-surface-variant">${t.date.slice(0, 10)}</td>
      <td class="p-5 capitalize"><span class="px-2 py-1 bg-surface-container border border-surface-variant text-[10px] font-bold text-on-surface uppercase tracking-wider">${escapeHTML(t.category)}</span></td>
      <td class="p-5 text-on-surface font-semibold">${escapeHTML(t.description || '—')}</td>
      <td class="p-5 font-bold ${t.type === 'income' ? 'text-primary' : 'text-on-surface-variant'}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td>
      <td class="p-5"><span class="text-[10px] font-bold uppercase tracking-widest ${t.type === 'income' ? 'text-primary' : 'text-error'}">${t.type}</span></td>
      <td class="p-5 text-right">
        <div class="flex gap-2 justify-end">
          <button class="text-outline hover:text-primary transition-colors cursor-pointer" onclick="editTransaction('${t.id}')"><span class="material-symbols-outlined text-sm">edit</span></button>
          <button class="text-outline hover:text-error transition-colors cursor-pointer" onclick="deleteTransaction('${t.id}')"><span class="material-symbols-outlined text-sm">delete</span></button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function saveTransaction(data) {
  const isEdit = !!data.id;
  closeModal('transaction-modal');
  
  let backupList = [...STATE.transactions];
  const mockId = 'temp-' + Date.now();
  
  const optimisticData = {
    id: data.id || mockId,
    amount: parseFloat(data.amount),
    type: data.type,
    category: data.category.toLowerCase().trim(),
    description: data.description,
    date: data.date,
    createdAt: new Date().toISOString()
  };
  
  if (isEdit) {
    STATE.transactions = STATE.transactions.map(t => t.id === data.id ? optimisticData : t);
  } else {
    STATE.transactions = [optimisticData, ...STATE.transactions].slice(0, STATE.pagination.limit);
  }
  
  renderTransactionsTable(STATE.transactions);
  
  try {
    let res;
    if (isEdit) {
      res = await apiRequest(`/api/transactions/${data.id}`, {
        method: 'PUT',
        body: {
          amount: parseFloat(data.amount),
          type: data.type,
          category: data.category,
          description: data.description,
          date: data.date
        }
      });
    } else {
      res = await apiRequest('/api/transactions', {
        method: 'POST',
        body: {
          amount: parseFloat(data.amount),
          type: data.type,
          category: data.category,
          description: data.description,
          date: data.date
        }
      });
    }
    
    if (res && res.status === 'success') {
      showToast(isEdit ? 'Ledger line updated.' : 'New entry created.', 'success');
      loadCategories();
      
      if (window.location.hash === '#/dashboard') {
        updateDashboardData();
      } else {
        fetchTransactions();
      }
    }
  } catch (err) {
    STATE.transactions = backupList;
    renderTransactionsTable(STATE.transactions);
    showToast(err.message, 'error');
  }
}

window.deleteTransaction = async function(id) {
  if (!confirm('Permanently wipe this transaction record?')) return;
  
  const row = document.getElementById(`tx-row-${id}`);
  if (row) row.style.opacity = '0.3';
  
  const backupList = [...STATE.transactions];
  STATE.transactions = STATE.transactions.filter(t => t.id !== id);
  
  try {
    await apiRequest(`/api/transactions/${id}`, { method: 'DELETE' });
    showToast('Record deleted.', 'success');
    
    if (window.location.hash === '#/dashboard') {
      updateDashboardData();
    } else {
      fetchTransactions();
    }
  } catch (err) {
    STATE.transactions = backupList;
    renderTransactionsTable(STATE.transactions);
    showToast(err.message, 'error');
  }
};

window.editTransaction = function(id) {
  const tx = STATE.transactions.find(t => t.id === id);
  if (!tx) return;
  
  document.getElementById('tx-id').value = tx.id;
  document.getElementById(`tx-type-${tx.type}`).checked = true;
  document.getElementById('tx-amount').value = tx.amount;
  document.getElementById('tx-date').value = tx.date.slice(0, 10);
  document.getElementById('tx-category').value = tx.category;
  document.getElementById('tx-description').value = tx.description || '';
  
  document.getElementById('transaction-modal-title').textContent = 'Edit Transaction';
  openModal('transaction-modal');
};

async function exportTransactionsCSV() {
  showToast('Preparing spreadsheet report...', 'info');
  
  const params = new URLSearchParams();
  if (STATE.filters.type) params.append('type', STATE.filters.type);
  if (STATE.filters.category) params.append('category', STATE.filters.category);
  if (STATE.filters.q) params.append('q', STATE.filters.q);
  if (STATE.filters.from) params.append('from', STATE.filters.from);
  if (STATE.filters.to) params.append('to', STATE.filters.to);
  
  try {
    const url = `${API_BASE}/api/transactions/export?${params.toString()}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${STATE.token}` }
    });
    
    if (!res.ok) throw new Error('CSV extraction failed.');
    
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'finedge-ledger.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    showToast('Ledger file compiled and downloaded.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function uploadCSV(csvText) {
  showLoader();
  closeModal('csv-modal');
  try {
    const res = await apiRequest('/api/transactions/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csvText
    });
    if (res && res.status === 'success') {
      showToast(`Successfully processed ${res.data.imported} ledger entries!`, 'success');
      loadCategories();
      fetchTransactions();
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

// Budgets management
async function fetchBudgets() {
  const container = document.getElementById('budgets-container');
  if (!container) return;
  
  document.getElementById('budget-current-month').textContent = STATE.summaryMonth;
  
  try {
    const summaryRes = await apiRequest(`/api/transactions/summary?month=${STATE.summaryMonth}`);
    if (summaryRes && summaryRes.status === 'success') {
      const budgets = summaryRes.data.summary.budgets;
      STATE.budgets = budgets;
      
      // Calculate overall limits vs spending for the Hero layout
      let totalSpent = 0;
      let totalLimit = 0;
      budgets.forEach(b => {
        totalSpent += b.spent;
        totalLimit += b.monthlyLimit;
      });
      
      document.getElementById('hero-budget-spent').textContent = formatCurrency(totalSpent);
      document.getElementById('hero-budget-limit').textContent = `of ${formatCurrency(totalLimit)}`;
      
      const overallPercent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
      const heroFill = document.getElementById('hero-budget-fill');
      heroFill.style.width = `${Math.min(overallPercent, 100)}%`;
      document.getElementById('hero-budget-percent').textContent = `${Math.round(overallPercent)}% Utilized`;
      document.getElementById('hero-budget-remaining').textContent = formatCurrency(Math.max(totalLimit - totalSpent, 0));
      
      const velocityText = document.getElementById('hero-budget-velocity');
      const statusText = document.getElementById('hero-budget-alert-status');
      
      if (overallPercent >= 100) {
        heroFill.className = 'h-full bg-error';
        velocityText.textContent = 'Velocity: Critical Limit Overdraft';
        statusText.textContent = 'Overspent';
        statusText.className = 'text-error';
      } else if (overallPercent >= 70) {
        heroFill.className = 'h-full bg-warning-color'; // Warning
        velocityText.textContent = 'Velocity: Warning threshold exceeded';
        statusText.textContent = 'Warning';
        statusText.className = 'text-warning-color';
      } else {
        heroFill.className = 'h-full bg-primary';
        velocityText.textContent = 'Velocity: Normal';
        statusText.textContent = 'Satisfactory';
        statusText.className = 'text-primary';
      }
      
      if (budgets.length === 0) {
        container.innerHTML = `
          <div class="col-span-full text-center text-on-surface-variant py-10 bg-surface-container border border-surface-variant rounded">
            <span class="material-symbols-outlined text-4xl text-on-surface-variant mb-3">help_outline</span>
            <p class="text-xs uppercase tracking-widest font-bold">No budget caps declared</p>
            <p class="text-[11px] mt-1">Select the set budget trigger above to assign allocation ceilings.</p>
          </div>
        `;
        return;
      }
      
      container.innerHTML = budgets.map(b => {
        const percent = Math.min(Math.round(b.percentUsed), 100);
        let statusClass = 'bg-primary';
        let textClass = 'text-primary';
        if (b.status === 'warning') {
          statusClass = 'bg-primary'; // maintain premium look or use alert style
          textClass = 'text-primary';
        } else if (b.status === 'over') {
          statusClass = 'bg-error';
          textClass = 'text-error';
        }
        
        return `
          <div class="bento-card p-6 flex flex-col justify-between">
            <div class="flex justify-between items-start mb-6">
              <div>
                <span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest block">Allocations</span>
                <h4 class="text-base font-black text-on-surface capitalize mt-1">${escapeHTML(b.category)}</h4>
              </div>
              <div class="flex gap-2">
                <button class="text-outline hover:text-primary transition-colors cursor-pointer" onclick="editBudget('${escapeHTML(b.category)}', ${b.monthlyLimit})"><span class="material-symbols-outlined text-xs">edit</span></button>
                <button class="text-outline hover:text-error transition-colors cursor-pointer" onclick="deleteBudget('${escapeHTML(b.category)}')"><span class="material-symbols-outlined text-xs">delete</span></button>
              </div>
            </div>

            <div class="space-y-4">
              <div class="w-full h-1 bg-surface-container-low border border-surface-variant rounded overflow-hidden">
                <div class="h-full ${statusClass} transition-all duration-300" style="width: ${percent}%;"></div>
              </div>
              
              <div class="flex justify-between text-[11px] font-semibold text-on-surface-variant">
                <span>Spent: <strong>${formatCurrency(b.spent)}</strong></span>
                <span>Cap: <strong>${formatCurrency(b.monthlyLimit)}</strong></span>
              </div>
              <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant pt-2 border-t border-surface-variant/30">
                <span>Usage Limit</span>
                <span class="${textClass}">${b.percentUsed.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    showToast('Failed to load budgets.', 'error');
  }
}

async function saveBudget(category, limit) {
  closeModal('budget-modal');
  showLoader();
  try {
    const res = await apiRequest(`/api/budgets/${category.toLowerCase().trim()}`, {
      method: 'PUT',
      body: { limit: parseFloat(limit) }
    });
    if (res && res.status === 'success') {
      showToast('Allocated spend limit registered.', 'success');
      fetchBudgets();
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

window.editBudget = function(category, limit) {
  document.getElementById('budget-modal-title').textContent = 'Modify Budget Limit';
  document.getElementById('budget-category').value = category;
  document.getElementById('budget-category').setAttribute('readonly', 'true');
  document.getElementById('budget-limit').value = limit;
  openModal('budget-modal');
};

window.deleteBudget = async function(category) {
  if (!confirm(`Wipe allocated limit for '${category}'?`)) return;
  showLoader();
  try {
    await apiRequest(`/api/budgets/${category}`, { method: 'DELETE' });
    showToast('Budget allocation cleared.', 'success');
    fetchBudgets();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoader();
  }
};

// Recurring automations
async function fetchRecurringRules() {
  const tbody = document.getElementById('recurring-table-body');
  if (!tbody) return;
  
  try {
    const res = await apiRequest('/api/recurring');
    if (res && res.status === 'success') {
      STATE.recurringRules = res.data.rules;
      renderRecurringTable(STATE.recurringRules);
    }
  } catch (err) {
    showToast('Failed to retrieve repeating actions.', 'error');
  }
}

function renderRecurringTable(rules) {
  const tbody = document.getElementById('recurring-table-body');
  if (rules.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-10 text-center text-on-surface-variant font-bold uppercase tracking-widest">No recurring schedules registered.</td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = rules.map(r => `
    <tr class="hover:bg-surface-container-high/30 transition-colors">
      <td class="p-5"><span class="text-[10px] font-bold uppercase tracking-widest ${r.type === 'income' ? 'text-primary' : 'text-error'}">${r.type}</span></td>
      <td class="p-5 font-bold uppercase tracking-wider text-on-surface capitalize">${escapeHTML(r.category)}</td>
      <td class="p-5 text-on-surface-variant font-medium">${escapeHTML(r.description || '—')}</td>
      <td class="p-5 capitalize">${r.frequency}</td>
      <td class="p-5 font-mono">${r.anchorDay}</td>
      <td class="p-5 font-bold ${r.type === 'income' ? 'text-primary' : 'text-on-surface-variant'}">${formatCurrency(r.amount)}</td>
      <td class="p-5 font-mono text-on-surface-variant">${r.nextRunDate.slice(0, 10)}</td>
      <td class="p-5 text-right">
        <button class="text-outline hover:text-error transition-colors cursor-pointer" onclick="deleteRecurringRule('${r.id}')"><span class="material-symbols-outlined text-sm">cancel</span></button>
      </td>
    </tr>
  `).join('');
}

async function createRecurringRule(data) {
  closeModal('recurring-modal');
  showLoader();
  try {
    const payload = {
      type: data.type,
      category: data.category,
      amount: parseFloat(data.amount),
      frequency: data.frequency,
      anchorDay: parseInt(data.anchorDay, 10),
      description: data.description
    };
    if (data.endDate) payload.endDate = data.endDate;
    
    const res = await apiRequest('/api/recurring', {
      method: 'POST',
      body: payload
    });
    if (res && res.status === 'success') {
      showToast('Automation schedule active.', 'success');
      loadCategories();
      fetchRecurringRules();
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoader();
  }
}

window.deleteRecurringRule = async function(id) {
  if (!confirm('Cancel this automation repeating schedule?')) return;
  showLoader();
  try {
    await apiRequest(`/api/recurring/${id}`, { method: 'DELETE' });
    showToast('Automation deactivated.', 'success');
    fetchRecurringRules();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoader();
  }
};

// Utilities
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Client router
function router() {
  const hash = window.location.hash || '#/dashboard';
  
  if (!STATE.token && hash !== '#/login') {
    window.location.hash = '#/login';
    return;
  }
  
  if (STATE.token && hash === '#/login') {
    window.location.hash = '#/dashboard';
    return;
  }
  
  const viewName = hash.replace('#/', '');
  
  // Update sidebar active highlights
  document.querySelectorAll('#app-sidebar a').forEach(link => {
    const isCurrent = link.id === `nav-${viewName}`;
    link.className = isCurrent 
      ? "flex items-center px-8 py-3 bg-primary-container text-on-primary-container border-r-2 border-primary active:scale-95 transition-all duration-150"
      : "flex items-center px-8 py-3 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all duration-150 active:scale-95";
    
    // Fill icons if current active
    const icon = link.querySelector('.material-symbols-outlined');
    if (icon) {
      icon.style.fontVariationSettings = isCurrent ? "'FILL' 1" : "'FILL' 0";
    }
  });

  if (VIEWS[viewName]) {
    VIEWS[viewName]();
  } else {
    window.location.hash = '#/dashboard';
  }
  
  document.getElementById('mobile-nav-overlay').classList.add('hidden');
}

// Document initialized load
document.addEventListener('DOMContentLoaded', () => {
  // Modal close binds
  document.querySelectorAll('[data-modal]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(el.dataset.modal);
    });
  });

  // Modal actions
  document.getElementById('transaction-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('tx-id').value;
    const type = document.querySelector('input[name="tx-type"]:checked').value;
    const amount = document.getElementById('tx-amount').value;
    const date = document.getElementById('tx-date').value;
    const category = document.getElementById('tx-category').value;
    const description = document.getElementById('tx-description').value;
    
    saveTransaction({ id, type, amount, date, category, description });
  });

  document.getElementById('budget-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const category = document.getElementById('budget-category').value;
    const limit = document.getElementById('budget-limit').value;
    saveBudget(category, limit);
  });

  document.getElementById('recurring-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="rec-type"]:checked').value;
    const amount = document.getElementById('rec-amount').value;
    const frequency = document.getElementById('rec-frequency').value;
    const category = document.getElementById('rec-category').value;
    const anchorDay = document.getElementById('rec-anchor').value;
    const endDate = document.getElementById('rec-enddate').value;
    const description = document.getElementById('rec-description').value;
    
    createRecurringRule({ type, amount, frequency, category, anchorDay, endDate, description });
  });

  // CSV binds
  const dropZone = document.getElementById('csv-drop-zone');
  const fileInput = document.getElementById('csv-file-input');
  const filenameSpan = document.getElementById('csv-filename');
  const submitBtn = document.getElementById('csv-submit-btn');
  let selectedCSVText = '';

  dropZone.addEventListener('click', () => fileInput.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-primary');
  });
  
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-primary'));
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-primary');
    const files = e.dataTransfer.files;
    if (files.length > 0) handleCSVFile(files[0]);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleCSVFile(e.target.files[0]);
  });

  function handleCSVFile(file) {
    if (file.name.slice(-4) !== '.csv') {
      showToast('Select a valid CSV document.', 'error');
      return;
    }
    filenameSpan.textContent = `Attached: ${file.name}`;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      selectedCSVText = event.target.result;
      submitBtn.disabled = false;
    };
    reader.readAsText(file);
  }

  submitBtn.addEventListener('click', () => {
    if (selectedCSVText) uploadCSV(selectedCSVText);
  });

  // Mobile navigation
  document.getElementById('mobile-menu-toggle').addEventListener('click', () => {
    document.getElementById('mobile-nav-overlay').classList.remove('hidden');
  });
  
  document.getElementById('mobile-menu-close').addEventListener('click', () => {
    document.getElementById('mobile-nav-overlay').classList.add('hidden');
  });
  
  document.getElementById('mobile-nav-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'mobile-nav-overlay') {
      document.getElementById('mobile-nav-overlay').classList.add('hidden');
    }
  });

  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('mobile-logout-btn').addEventListener('click', logout);

  if (STATE.token) {
    setupAppShell();
    loadCategories();
  }

  window.addEventListener('hashchange', router);
  router();
});
