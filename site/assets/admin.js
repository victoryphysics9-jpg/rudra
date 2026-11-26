'use strict';

(() => {

    /* ================= CONFIGURATION ================= */

    const $ = id => document.getElementById(id);

    const config = window.RUDRA_CONFIG || {};
    const baseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
    const publicKey = String(config.supabaseAnonKey || '').trim();

    const PAGE_SIZE = 100;

    const STATUSES = [
        'new',
        'contacted',
        'qualified',
        'quoted',
        'won',
        'lost'
    ];

    const LABELS = {
        new: 'New',
        contacted: 'Contacted',
        qualified: 'Qualified',
        quoted: 'Quoted',
        won: 'Won',
        lost: 'Lost'
    };

    const COLORS = {
        new: '#2563eb',
        contacted: '#0891b2',
        qualified: '#7c3aed',
        quoted: '#d97706',
        won: '#15803d',
        lost: '#b42318'
    };

    const VIEWS = {
        dashboard: [
            'Business Overview',
            'Monitor your enquiries and sales progress.'
        ],
        enquiries: [
            'All Enquiries',
            'Search and manage customer quotation requests.'
        ],
        pipeline: [
            'Lead Pipeline',
            'Track enquiries through your sales process.'
        ],
        reports: [
            'Business Reports',
            'Analyse loaded enquiries, product demand and campaign sources.'
        ],
        account: [
            'My Account',
            'Your authorized staff account and session information.'
        ]
    };

    const ATTRIBUTION_LABELS = {
        utm_source: 'Campaign source',
        utm_medium: 'Campaign medium',
        utm_campaign: 'Campaign name',
        utm_term: 'Campaign keyword',
        utm_content: 'Campaign content',
        gclid: 'Google Click ID (GCLID)'
    };

    const SELECT_FIELDS = [
        'id', 'created_at', 'name', 'company', 'phone',
        'email', 'location', 'product', 'message', 'items',
        'attribution', 'status', 'notes'
    ].join(',');

    let token = '';
    let user = null;
    let staffRole = '';
    let leads = [];
    let cursor = null;
    let hasMore = false;
    let activeView = 'dashboard';
    let selectedId = null;
    let busy = false;
    let configured = false;
    let expiryTimer = null;
    let expiresAt = null;
    let generation = 0;

    const loginForm = $('login-form');
    const loginScreen = $('login-screen');
    const app = $('admin-app');
    const dialog = $('lead-dialog');

    if (!loginForm || !app || !dialog) return;

    /* ================= UTILITIES ================= */

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char]);
    }

    function text(id, value) {
        const element = $(id);
        if (element) element.textContent = String(value ?? '');
    }

    function displayValue(value) {
        return value === undefined || value === null || value === ''
            ? 'Not provided'
            : String(value);
    }

    function formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';

        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function localDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';

        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');
    }

    function notify(id, message = '', type = '') {
        const element = $(id);

        element.textContent = message;
        element.className = 'status-message' + (type ? ' ' + type : '');
    }

    function setBusy(value) {
        busy = value;

        document.querySelectorAll('[data-busy]').forEach(button => {
            button.disabled = value;
        });

        $('login-submit').disabled = value || !configured;
        $('save-lead-btn').disabled = value || !selectedId;
    }

    function publicKeyIsValid(key) {

        if (key.startsWith('sb_publishable_')) return true;

        // Legacy public anon JWT only.
        try {
            const part = key.split('.')[1]
                .replace(/-/g, '+')
                .replace(/_/g, '/');

            const payload = JSON.parse(atob(part));

            return payload.role === 'anon';

        } catch {
            return false;
        }
    }

    function configIsValid() {
        try {
            const url = new URL(baseUrl);

            return url.protocol === 'https:' &&
                url.hostname.endsWith('.supabase.co') &&
                url.pathname === '/' &&
                !url.username &&
                !url.password &&
                !url.search &&
                !url.hash &&
                publicKeyIsValid(publicKey);

        } catch {
            return false;
        }
    }

    function makeError(message, code) {
        const error = new Error(message);
        error.code = code;
        return error;
    }

    /* ================= SUPABASE REST API ================= */

    async function request(path, options = {}, useAuth = true) {

        const requestGeneration = generation;

        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, 20000);

        const headers = {
            apikey: publicKey,
            'Content-Type': 'application/json',
            ...(useAuth && token
                ? { Authorization: 'Bearer ' + token }
                : {}),
            ...(options.headers || {})
        };

        try {

            const response = await fetch(baseUrl + path, {
                ...options,
                headers,
                signal: controller.signal,
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer'
            });

            if (requestGeneration !== generation) {
                throw makeError('Session changed.', 401);
            }

            if (!response.ok) {
                throw makeError('API request failed.', response.status);
            }

            if (response.status === 204) return null;

            const body = await response.text();

            if (requestGeneration !== generation) {
                throw makeError('Session changed.', 401);
            }

            return body ? JSON.parse(body) : null;

        } finally {
            clearTimeout(timeout);
        }
    }

    /* ================= STAFF AUTHORIZATION ================= */

    async function verifyStaff() {

        if (!user || !token) {
            throw makeError('Sign-in required.', 401);
        }

        const params = new URLSearchParams({
            select: 'user_id,role',
            user_id: 'eq.' + user.id
        });

        const rows = await request('/rest/v1/staff?' + params);

        if (!Array.isArray(rows) ||
            rows.length !== 1 ||
            !['admin', 'sales'].includes(rows[0].role)) {

            throw makeError('Staff access not authorized.', 403);
        }

        staffRole = rows[0].role;
    }

    function updateAccount() {

        text('staff-email', user?.email || '');
        text('staff-role', staffRole.toUpperCase() + ' · Authorized');

        text('account-email', user?.email || '');
        text('account-role', staffRole);
        text('account-id', user?.id || '');

        text(
            'account-expiry',
            expiresAt ? formatDate(expiresAt) : 'Current session'
        );
    }

    /* ================= SESSION MANAGEMENT ================= */

    function clearSession(message = '', type = '', focus = true) {

        generation++;

        clearTimeout(expiryTimer);

        expiryTimer = null;
        expiresAt = null;
        token = '';
        user = null;
        staffRole = '';
        leads = [];
        cursor = null;
        hasMore = false;
        selectedId = null;
        activeView = 'dashboard';

        if (dialog.open) dialog.close();

        app.hidden = true;
        loginScreen.hidden = false;

        loginForm.reset();

        $('login-password').type = 'password';
        $('toggle-password').textContent = 'Show';
        $('toggle-password').setAttribute('aria-pressed', 'false');

        // Remove previously displayed customer records from the DOM.

        [
            'lead-list', 'pipeline-grid', 'status-report',
            'source-report', 'product-report', 'detail-items',
            'detail-attribution', 'detail-name', 'detail-reference',
            'detail-company', 'detail-phone', 'detail-email',
            'detail-location', 'detail-product', 'detail-date',
            'detail-message', 'staff-email', 'staff-role',
            'account-email', 'account-role', 'account-id',
            'account-expiry', 'result-count', 'loaded-summary'
        ].forEach(id => text(id, ''));

        [
            'stat-total', 'stat-new', 'stat-quoted', 'stat-won'
        ].forEach(id => text(id, '0'));

        text('stat-conversion', '0% of loaded enquiries');

        $('edit-notes').value = '';
        $('edit-status').value = 'new';

        ['detail-call', 'detail-mail'].forEach(id => {
            $(id).removeAttribute('href');
            $(id).hidden = true;
        });

        resetFilters(false);

        notify('workspace-status');
        notify('detail-status');
        notify('admin-status', message, type);

        setBusy(false);

        if (focus) $('login-email').focus();
    }

    function scheduleExpiry(seconds) {

        clearTimeout(expiryTimer);

        const duration = Number(seconds);

        if (!Number.isFinite(duration) || duration <= 0) {
            throw makeError('Invalid session.', 401);
        }

        expiresAt = new Date(Date.now() + duration * 1000);

        // Sign in again rather than persisting refresh credentials.

        expiryTimer = setTimeout(() => {

            clearSession(
                'Your session has expired. Please sign in again.',
                'error'
            );

        }, Math.max(1000, duration * 1000 - 5000));
    }

    async function revokeSession() {

        if (!token) return;

        await request('/auth/v1/logout?scope=local', {
            method: 'POST'
        });
    }

    async function signOut() {

        if (busy) return;

        setBusy(true);

        const currentGeneration = generation;

        let revoked = true;

        try {
            await revokeSession();
        } catch {
            revoked = false;
        }

        if (generation !== currentGeneration) return;

        clearSession(
            revoked
                ? 'You have been signed out.'
                : 'Local session cleared. Server sign-out could not be confirmed.',
            revoked ? 'success' : 'error'
        );
    }

    /* ================= LOGIN ================= */

    loginForm.addEventListener('submit', async event => {

        event.preventDefault();

        if (busy || !configured) return;

        setBusy(true);

        notify('admin-status', 'Verifying your credentials…');

        const currentGeneration = generation;

        try {

            const data = await request(
                '/auth/v1/token?grant_type=password',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        email: $('login-email').value.trim(),
                        password: $('login-password').value
                    })
                },
                false
            );

            $('login-password').value = '';

            if (!data?.access_token || !data?.user?.id) {
                throw makeError('Invalid sign-in response.', 401);
            }

            token = data.access_token;
            user = data.user;

            // Do not store passwords, access tokens or refresh tokens
            // in localStorage or sessionStorage.

            scheduleExpiry(data.expires_in);

            notify('admin-status', 'Checking staff permissions…');

            await verifyStaff();

            notify('admin-status', 'Loading business enquiries…');

            await loadEnquiries(true);

            if (generation !== currentGeneration) return;

            loginScreen.hidden = true;
            app.hidden = false;

            updateAccount();
            switchView('dashboard');

            notify(
                'workspace-status',
                'Connected to your live enquiry database.',
                'success'
            );

        } catch (error) {

            if (generation !== currentGeneration) return;

            try {
                await revokeSession();
            } catch {
                // Credentials are discarded below even if logout fails.
            }

            if (generation !== currentGeneration) return;

            let message =
                'Sign-in failed. Check your credentials and staff access.';

            if (error.code === 403) {
                message =
                    'This account is not authorized, or access is restricted.';
            } else if (error.code === 429) {
                message =
                    'Too many sign-in attempts. Try again later.';
            } else if (error.name === 'AbortError' ||
                       error instanceof TypeError) {
                message =
                    'Connection failed. Check your internet and backend settings.';
            }

            clearSession(message, 'error');

        } finally {

            if (generation === currentGeneration) {
                $('login-password').value = '';
                setBusy(false);
            }
        }

    });

    $('toggle-password').addEventListener('click', () => {

        const input = $('login-password');

        const show = input.type === 'password';

        input.type = show ? 'text' : 'password';

        $('toggle-password').textContent = show ? 'Hide' : 'Show';

        $('toggle-password').setAttribute(
            'aria-pressed',
            String(show)
        );
    });

    $('logout-btn').addEventListener('click', signOut);

    /* ================= LOAD ENQUIRIES ================= */

    async function loadEnquiries(reset = false) {

        await verifyStaff();

        const params = new URLSearchParams({
            select: SELECT_FIELDS,
            order: 'created_at.desc,id.desc',
            limit: String(PAGE_SIZE)
        });

        // Load older records using a stable cursor.

        if (!reset && cursor) {

            params.set(
                'or',
                `(created_at.lt.${cursor.created_at},` +
                `and(created_at.eq.${cursor.created_at},id.lt.${cursor.id}))`
            );
        }

        const rows = await request('/rest/v1/enquiries?' + params);

        if (!Array.isArray(rows)) {
            throw makeError('Invalid enquiry response.', 500);
        }

        if (reset) {
            leads = [];
            cursor = null;
        }

        const existingIds = new Set(leads.map(lead => lead.id));

        rows.forEach(row => {

            if (!existingIds.has(row.id)) {

                leads.push(row);

                existingIds.add(row.id);
            }
        });

        if (rows.length) {

            const last = rows[rows.length - 1];

            cursor = {
                created_at: last.created_at,
                id: last.id
            };
        }

        hasMore = rows.length === PAGE_SIZE;

        renderWorkspace();
    }

    async function runTask(task, statusId = 'workspace-status') {

        if (busy || !token) return;

        const currentGeneration = generation;

        setBusy(true);

        try {

            await task();

        } catch (error) {

            if (generation !== currentGeneration) return;

            if (error.code === 401 || error.code === 403) {

                clearSession(
                    'Your session or staff access is no longer available. Sign in again.',
                    'error'
                );

            } else {

                notify(
                    statusId,
                    'Unable to complete the request. Check your connection and permissions.',
                    'error'
                );
            }

        } finally {

            if (generation === currentGeneration) {
                setBusy(false);
            }
        }
    }

    $('refresh-btn').addEventListener('click', () => {

        runTask(async () => {

            notify('workspace-status', 'Refreshing enquiries…');

            await loadEnquiries(true);

            notify(
                'workspace-status',
                'Enquiries refreshed successfully.',
                'success'
            );
        });
    });

    $('load-more-btn').addEventListener('click', () => {

        if (!hasMore) return;

        runTask(async () => {

            notify('workspace-status', 'Loading older enquiries…');

            await loadEnquiries(false);

            notify(
                'workspace-status',
                `${leads.length} enquiries are now loaded.`,
                'success'
            );
        });
    });

    /* ================= PRODUCT UTILITIES ================= */

    function getItems(lead) {

        return Array.isArray(lead.items)
            ? lead.items.filter(item => item && typeof item === 'object')
            : [];
    }

    function productName(value) {

        const name = String(value || '').trim();

        if (!name) return 'General enquiry';

        return name
            .replace(/-/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function productSummary(lead) {

        const items = getItems(lead);

        if (items.length) {

            const first = items[0].name || productName(items[0].slug);

            return first + (
                items.length > 1
                    ? ` +${items.length - 1} more`
                    : ''
            );
        }

        return productName(lead.product);
    }

    function campaignSource(lead) {

        const attribution = lead.attribution || {};

        const source = String(attribution.utm_source || '').trim();

        if (source) return source.toLowerCase();

        if (attribution.gclid) return 'Google Ads (GCLID)';

        return 'Unattributed';
    }

    /* ================= FILTERS ================= */

    function filteredLeads() {

        const query = $('lead-search').value.toLowerCase().trim();

        const words = query ? query.split(/\s+/) : [];

        const status = $('lead-filter').value;
        const from = $('date-from').value;
        const to = $('date-to').value;

        if (from && to && from > to) return [];

        return leads.filter(lead => {

            if (status && lead.status !== status) return false;

            const date = localDate(lead.created_at);

            if (from && date < from) return false;
            if (to && date > to) return false;

            const searchable = [
                lead.id,
                lead.name,
                lead.company,
                lead.phone,
                lead.email,
                lead.location,
                lead.product,
                lead.message,
                lead.status,
                lead.notes,
                JSON.stringify(getItems(lead)),
                JSON.stringify(lead.attribution || {})
            ].join(' ').toLowerCase();

            return words.every(word => searchable.includes(word));
        });
    }

    function resetFilters(render = true) {

        $('lead-search').value = '';
        $('lead-filter').value = '';
        $('date-from').value = '';
        $('date-to').value = '';

        if (render) renderWorkspace();
    }

    [
        'lead-search',
        'lead-filter',
        'date-from',
        'date-to'
    ].forEach(id => {

        $(id).addEventListener('input', renderWorkspace);
        $(id).addEventListener('change', renderWorkspace);
    });

    $('clear-filters').addEventListener('click', () => {

        resetFilters();

        $('lead-search').focus();
    });

    /* ================= VIEW NAVIGATION ================= */

    function switchView(view) {

        if (!VIEWS[view]) return;

        activeView = view;

        text('view-title', VIEWS[view][0]);
        text('view-description', VIEWS[view][1]);

        document.querySelectorAll('[data-view]').forEach(button => {

            if (button.dataset.view === view) {

                button.setAttribute('aria-current', 'page');

            } else {

                button.removeAttribute('aria-current');
            }
        });

        $('stats-view').hidden =
            !['dashboard', 'reports'].includes(view);

        $('filter-view').hidden =
            !['enquiries', 'pipeline'].includes(view);

        $('table-view').hidden =
            !['dashboard', 'enquiries'].includes(view);

        $('pipeline-view').hidden = view !== 'pipeline';
        $('reports-view').hidden = view !== 'reports';
        $('account-view').hidden = view !== 'account';

        $('data-actions').hidden = view === 'account';
        $('load-controls').hidden = view === 'account';

        $('view-all-btn').hidden = view !== 'dashboard';

        text(
            'table-title',
            view === 'dashboard' ? 'Recent Enquiries' : 'All Enquiries'
        );

        renderWorkspace();

        window.scrollTo(0, 0);
    }

    document.querySelectorAll('[data-view]').forEach(button => {

        button.addEventListener('click', () => {

            if (user) switchView(button.dataset.view);
        });
    });

    $('view-all-btn').addEventListener('click', () => {

        resetFilters(false);

        switchView('enquiries');
    });

    /* ================= DASHBOARD REPORTS ================= */

    function countByStatus(rows) {

        const counts = Object.fromEntries(
            STATUSES.map(status => [status, 0])
        );

        rows.forEach(row => {

            if (STATUSES.includes(row.status)) {
                counts[row.status]++;
            }
        });

        return counts;
    }

    function barHTML(label, count, total, color) {

        const percentage = total > 0
            ? Math.min(100, count / total * 100)
            : 0;

        return `
            <div class="report-bar">
                <span>${escapeHTML(label)}</span>
                <div class="bar-track" aria-hidden="true">
                    <span class="bar-fill"
                          style="width:${percentage}%;background:${color}">
                    </span>
                </div>
                <strong>${count}</strong>
            </div>
        `;
    }

    function renderReports() {

        const total = leads.length;
        const counts = countByStatus(leads);

        text('stat-total', total);
        text('stat-new', counts.new);
        text('stat-quoted', counts.quoted);
        text('stat-won', counts.won);

        const conversion = total
            ? (counts.won / total * 100).toFixed(1)
            : '0';

        text(
            'stat-conversion',
            `${conversion}% of loaded enquiries`
        );

        $('status-report').innerHTML = STATUSES.map(status =>

            barHTML(
                LABELS[status],
                counts[status],
                total,
                COLORS[status]
            )

        ).join('');

        const sources = new Map();
        const products = new Map();

        leads.forEach(lead => {

            const source = campaignSource(lead);

            sources.set(source, (sources.get(source) || 0) + 1);

            // Count a product only once per enquiry.

            const names = new Map();

            getItems(lead).forEach(item => {

                const key = String(item.slug || item.name || '')
                    .trim().toLowerCase();

                if (key) {
                    names.set(key, item.name || productName(item.slug));
                }
            });

            if (lead.product) {

                const key = String(lead.product).trim().toLowerCase();

                if (!names.has(key)) {
                    names.set(key, productName(lead.product));
                }
            }

            if (!names.size) {

                names.set('general', 'General enquiry');
            }

            names.forEach((name, key) => {

                const current = products.get(key);

                products.set(key, {
                    name: current?.name || name,
                    count: (current?.count || 0) + 1
                });
            });
        });

        $('source-report').innerHTML = [...sources.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([source, count]) =>

                barHTML(source, count, total, '#a43d0d')

            ).join('') ||
            '<p class="muted">No enquiry attribution recorded.</p>';

        $('product-report').innerHTML = [...products.values()]
            .sort((a, b) => b.count - a.count)
            .map(item =>

                barHTML(item.name, item.count, total, '#102d48')

            ).join('') ||
            '<p class="muted">No product enquiries available.</p>';
    }

    /* ================= ENQUIRY TABLE ================= */

    function statusHTML(status) {

        const validStatus = STATUSES.includes(status)
            ? status
            : 'new';

        return `
            <span class="lead-status status-${validStatus}">
                ${LABELS[validStatus]}
            </span>
        `;
    }

    function renderTable() {

        const rows = activeView === 'dashboard'
            ? leads.slice(0, 8)
            : filteredLeads();

        $('lead-list').innerHTML = rows.map(lead => `
            <tr>

                <td>
                    <strong>${escapeHTML(lead.name)}</strong>
                    <small>${escapeHTML(lead.company || 'Individual')}</small>
                    <small>#${escapeHTML(String(lead.id).slice(0, 8))}</small>
                </td>

                <td>
                    ${escapeHTML(lead.phone)}
                    <small>${escapeHTML(lead.email || '')}</small>
                </td>

                <td>
                    ${escapeHTML(productSummary(lead))}
                    <small>${escapeHTML(lead.location || '')}</small>
                </td>

                <td>
                    ${escapeHTML(formatDate(lead.created_at))}
                </td>

                <td>
                    ${statusHTML(lead.status)}
                </td>

                <td>
                    <button type="button"
                            class="row-open"
                            data-open-lead="${escapeHTML(lead.id)}"
                            aria-label="View enquiry from ${escapeHTML(lead.name)}">
                        View Details →
                    </button>
                </td>

            </tr>
        `).join('');

        $('empty-state').hidden = rows.length > 0;

        const invalidRange =
            $('date-from').value &&
            $('date-to').value &&
            $('date-from').value > $('date-to').value;

        text(
            'result-count',
            activeView === 'enquiries' && invalidRange
                ? 'Select a valid date range.'
                : `Showing ${rows.length} of ${leads.length} loaded enquiries`
        );
    }

    /* ================= LEAD PIPELINE ================= */

    function renderPipeline() {

        const rows = filteredLeads();

        $('pipeline-grid').innerHTML = STATUSES.map(status => {

            const group = rows.filter(lead => lead.status === status);

            return `
                <section class="pipeline-column"
                         style="border-top-color:${COLORS[status]}">

                    <h3>
                        ${LABELS[status]}
                        <span>${group.length}</span>
                    </h3>

                    ${group.map(lead => `
                        <button type="button"
                                class="pipeline-card"
                                data-open-lead="${escapeHTML(lead.id)}">

                            <strong>${escapeHTML(lead.name)}</strong>

                            ${escapeHTML(lead.company || 'Individual')}

                            <br>

                            ${escapeHTML(productSummary(lead))}

                            <br><br>

                            <small>
                                ${escapeHTML(formatDate(lead.created_at))}
                            </small>

                        </button>
                    `).join('') || '<p class="muted">No leads</p>'}

                </section>
            `;
        }).join('');
    }

    function renderWorkspace() {

        if (activeView === 'dashboard' || activeView === 'reports') {
            renderReports();
        }

        if (activeView === 'dashboard' || activeView === 'enquiries') {
            renderTable();
        }

        if (activeView === 'pipeline') {
            renderPipeline();
        }

        $('load-more-btn').hidden = !hasMore;

        text(
            'loaded-summary',
            `${leads.length} records loaded. ` +
            (hasMore
                ? 'Load older enquiries to include them in search and reports.'
                : 'No additional records in the current result.')
        );
    }

    /* ================= CUSTOMER DETAILS ================= */

    function addInformationRow(parent, label, value) {

        const row = document.createElement('div');
        row.className = 'info-row';

        const title = document.createElement('strong');
        title.textContent = label;

        const content = document.createElement('span');
        content.textContent = displayValue(value);

        row.append(title, content);

        parent.appendChild(row);
    }

    function openLead(id) {

        if (busy || !user || !token) return;

        const lead = leads.find(item => item.id === id);

        if (!lead) return;

        selectedId = lead.id;

        text('detail-name', lead.name || 'Customer Enquiry');
        text('detail-reference', 'Reference: ' + lead.id);
        text('detail-company', displayValue(lead.company));
        text('detail-phone', displayValue(lead.phone));
        text('detail-email', displayValue(lead.email));
        text('detail-location', displayValue(lead.location));
        text('detail-product', productName(lead.product));
        text('detail-date', formatDate(lead.created_at));
        text('detail-message', displayValue(lead.message));

        const items = $('detail-items');
        items.replaceChildren();

        const requestedItems = getItems(lead);

        if (requestedItems.length) {

            requestedItems.forEach(item => {

                const li = document.createElement('li');

                li.textContent =
                    (item.name || productName(item.slug)) +
                    ' × ' + displayValue(item.qty);

                items.appendChild(li);
            });

        } else {

            const li = document.createElement('li');

            li.textContent =
                'No separate quotation items recorded. Refer to the project requirements.';

            items.appendChild(li);
        }

        const attribution = $('detail-attribution');

        attribution.replaceChildren();

        let attributionCount = 0;

        Object.entries(ATTRIBUTION_LABELS).forEach(([key, label]) => {

            const value = lead.attribution?.[key];

            if (typeof value === 'string' && value) {

                addInformationRow(attribution, label, value);

                attributionCount++;
            }
        });

        if (!attributionCount) {

            attribution.textContent = 'No campaign attribution recorded.';
        }

        // Allow only valid telephone and email destinations.

        const phone = String(lead.phone || '')
            .replace(/[\s()-]/g, '');

        $('detail-call').hidden = true;
        $('detail-call').removeAttribute('href');

        if (/^\+?\d{7,15}$/.test(phone)) {

            $('detail-call').href = 'tel:' + phone;
            $('detail-call').hidden = false;
        }

        const email = String(lead.email || '').trim();

        $('detail-mail').hidden = true;
        $('detail-mail').removeAttribute('href');

        if (/^[a-zA-Z0-9.!#$%&'*+/=^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {

            $('detail-mail').href =
                'mailto:' + encodeURIComponent(email).replace(/%40/g, '@') +
                '?subject=' + encodeURIComponent(
                    'Your Rudra Earthing Systems enquiry'
                );

            $('detail-mail').hidden = false;
        }

        $('edit-status').value = lead.status;
        $('edit-notes').value = lead.notes || '';

        notify('detail-status');

        $('save-lead-btn').disabled = false;

        if (!dialog.open) dialog.showModal();
    }

    app.addEventListener('click', event => {

        const button = event.target.closest('[data-open-lead]');

        if (button) openLead(button.dataset.openLead);
    });

    function closeLead() {

        if (busy) return;

        const lead = leads.find(item => item.id === selectedId);

        const dirty = lead && (
            $('edit-status').value !== lead.status ||
            $('edit-notes').value !== (lead.notes || '')
        );

        if (dirty && !window.confirm('Discard unsaved changes?')) {
            return;
        }

        dialog.close();

        selectedId = null;

        $('save-lead-btn').disabled = true;
    }

    $('close-dialog').addEventListener('click', closeLead);
    $('cancel-edit').addEventListener('click', closeLead);

    dialog.addEventListener('cancel', event => {

        event.preventDefault();

        closeLead();
    });

    $('copy-reference').addEventListener('click', async () => {

        if (!selectedId) return;

        const currentGeneration = generation;

        try {

            await navigator.clipboard.writeText(selectedId);

            if (generation === currentGeneration && dialog.open) {

                notify(
                    'detail-status',
                    'Enquiry reference copied.',
                    'success'
                );
            }

        } catch {

            if (generation === currentGeneration && dialog.open) {

                notify(
                    'detail-status',
                    'Copy unavailable. Select the reference displayed at the top.',
                    'error'
                );
            }
        }
    });

    /* ================= UPDATE LEAD ================= */

    $('lead-edit-form').addEventListener('submit', event => {

        event.preventDefault();

        if (!selectedId || busy) return;

        const id = selectedId;

        const payload = {
            status: $('edit-status').value,
            notes: $('edit-notes').value.trim()
        };

        if (!STATUSES.includes(payload.status) ||
            payload.notes.length > 4000) {

            notify('detail-status', 'Invalid lead update.', 'error');

            return;
        }

        runTask(async () => {

            notify('detail-status', 'Saving lead update…');

            await verifyStaff();

            const params = new URLSearchParams({
                id: 'eq.' + id,
                select: SELECT_FIELDS
            });

            const updated = await request(
                '/rest/v1/enquiries?' + params,
                {
                    method: 'PATCH',
                    headers: {
                        Prefer: 'return=representation'
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!Array.isArray(updated) ||
                updated.length !== 1 ||
                updated[0].id !== id) {

                throw makeError('Update not confirmed.', 500);
            }

            const index = leads.findIndex(lead => lead.id === id);

            if (index !== -1) {
                leads[index] = updated[0];
            }

            $('edit-status').value = updated[0].status;
            $('edit-notes').value = updated[0].notes || '';

            renderWorkspace();

            notify(
                'detail-status',
                'Lead updated successfully in the database.',
                'success'
            );

        }, 'detail-status');

    });

    /* ================= CSV EXPORT ================= */

    function csvCell(value) {

        let content = typeof value === 'object' && value !== null
            ? JSON.stringify(value)
            : String(value ?? '');

        // Prevent spreadsheet formula injection.

        if (/^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(content)) {
            content = "'" + content;
        }

        return '"' + content.replace(/"/g, '""') + '"';
    }

    $('export-btn').addEventListener('click', () => {

        if (!user || !token || busy) return;

        runTask(async () => {

            await verifyStaff();

            const rows = ['enquiries', 'pipeline'].includes(activeView)
                ? filteredLeads()
                : leads;

            if (!rows.length) {

                notify(
                    'workspace-status',
                    'No loaded enquiries available to export.',
                    'error'
                );

                return;
            }

            if (!window.confirm(
                `Export ${rows.length} loaded enquiries?\n\n` +
                'This file contains customer information. Store it securely.'
            )) return;

            const fields = [
                'id',
                'created_at',
                'name',
                'company',
                'phone',
                'email',
                'location',
                'product',
                'message',
                'items',
                'attribution',
                'status',
                'notes'
            ];

            const csv = [
                fields.map(csvCell).join(','),
                ...rows.map(lead =>
                    fields.map(field => csvCell(lead[field])).join(',')
                )
            ].join('\r\n');

            const file = new Blob(
                ['\uFEFF', csv],
                { type: 'text/csv;charset=utf-8;' }
            );

            const url = URL.createObjectURL(file);

            const anchor = document.createElement('a');

            anchor.href = url;

            anchor.download =
                'rudra-enquiries-' + localDate(new Date()) + '.csv';

            document.body.appendChild(anchor);

            anchor.click();
            anchor.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1000);

            notify(
                'workspace-status',
                `CSV prepared for ${rows.length} enquiries.`,
                'success'
            );
        });
    });

    /* ================= INITIALIZATION ================= */

    configured = configIsValid();

    if (!configured) {

        notify(
            'admin-status',
            'Backend configuration missing or invalid. Configure the Supabase URL and public API key in config.js.',
            'error'
        );

    } else {

        $('login-submit').disabled = false;
    }

    // Clear confidential data if the browser navigates away.

    window.addEventListener('pagehide', () => {

        if (token || user || busy) {
            clearSession('', '', false);
        }
    });

    // Expiry check when returning to a backgrounded tab.

    document.addEventListener('visibilitychange', () => {

        if (!document.hidden && token &&
            expiresAt && Date.now() >= expiresAt.getTime()) {

            clearSession(
                'Your session has expired. Please sign in again.',
                'error'
            );
        }
    });

})();