// ===== JengaPro Frontend =====
// Global API key for weather (kept client-side for geolocation requests)
const WEATHER_API_KEY = "1e3e8f230b6064d27976e41163a82b77";

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// ---------- Toast Messages ----------
function showToast(message, type = 'success') {
    const container = $('#toastContainer');
    if (!container) return;
    const colors = {
        success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600', warning: 'bg-yellow-500'
    };
    const icons = {
        success: 'fa-check-circle', error: 'fa-exclamation-circle',
        info: 'fa-info-circle', warning: 'fa-exclamation-triangle'
    };
    const el = document.createElement('div');
    el.className = `${colors[type] || 'bg-blue-600'} text-white px-4 py-3 rounded shadow-lg flex items-center space-x-2 transition duration-300`;
    el.style.minWidth = '220px';
    el.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i><span class="text-sm">${message}</span>`;
    container.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(120%)';
        setTimeout(() => el.remove(), 300);
    }, 3500);
}

// ---------- AJAX helper ----------
async function api(entity, method = 'GET', data = null, id = null, action = null) {
    let url = `api/index.php?entity=${entity}`;
    if (action) url += `&action=${action}`;
    if (id) url += `&id=${id}`;
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (data && (method === 'POST' || method === 'PUT')) opts.body = JSON.stringify(data);
    const res = await fetch(url, opts);
    const out = await res.json().catch(() => ({ success: false, message: 'Invalid server response' }));
    if (!res.ok || !out.success) {
        throw new Error(out.message || 'Request failed');
    }
    return out;
}

async function customApi(path, method = 'GET', data = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (data && (method === 'POST' || method === 'PUT')) opts.body = JSON.stringify(data);
    const res = await fetch(path, opts);
    const out = await res.json().catch(() => ({ success: false, message: 'Invalid server response' }));
    if (!res.ok || !out.success) throw new Error(out.message || 'Request failed');
    return out;
}

// ---------- Modal helpers ----------
function normId(id) { return id.startsWith('#') ? id.slice(1) : id; }
function openModal(id) { $('#' + normId(id)).classList.remove('hidden'); }
function closeModal(id) { $('#' + normId(id)).classList.add('hidden'); }

// Generic confirmation modal. Returns a Promise<boolean>
function confirmDialog(title, message, confirmText = 'Delete', danger = true) {
    return new Promise((resolve) => {
        $('#confirmTitle').textContent = title;
        $('#confirmMessage').textContent = message;
        const btn = $('#confirmActionBtn');
        btn.textContent = confirmText;
        btn.className = `px-4 py-2 text-white rounded-md hover:opacity-90 ${danger ? 'bg-red-500' : 'bg-blue-500'}`;
        openModal('confirmModal');
        const done = (val) => { closeModal('confirmModal'); resolve(val); };
        $('#confirmCancelBtn').onclick = () => done(false);
        btn.onclick = () => done(true);
    });
}

// ---------- Auth guard ----------
async function checkAuth() {
    try {
        const res = await fetch('api/auth.php?action=me');
        const out = await res.json();
        if (!out.success) { location.href = 'login.php'; return false; }
        $('#userDisplayName').textContent = out.user.full_name || out.user.username;
        return true;
    } catch {
        location.href = 'login.php';
        return false;
    }
}

// ---------- Formatting ----------
function fmtMoney(n) {
    return 'KSh ' + Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function statusBadge(status) {
    const map = {
        paid: 'bg-green-100 text-green-800',
        pending: 'bg-yellow-100 text-yellow-800',
        cancelled: 'bg-red-100 text-red-800'
    };
    return `<span class="px-2 py-1 rounded-full text-xs ${map[status] || 'bg-gray-100 text-gray-800'}">${esc(status)}</span>`;
}

// ================= MATERIALS =================
async function loadMaterials() {
    try {
        const out = await customApi('api/materials.php?action=summary');
        const rows = out.materials || [];
        const tbody = $('#materialsTableBody');
        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-4 text-center text-gray-500">No materials found.</td></tr>`;
        } else {
            tbody.innerHTML = rows.map(m => {
                const added = m.added_total || 0;
                const used = m.used_total || 0;
                const remaining = m.remaining ?? (added - used);
                const lowCls = m.is_low ? 'text-red-600 font-bold' : 'text-gray-800';
                return `<tr data-id="${m.id}">
                    <td class="px-6 py-4 whitespace-nowrap">${esc(m.name)} <span class="text-gray-400 text-xs">(${esc(m.unit)})</span></td>
                    <td class="px-6 py-4 whitespace-nowrap">${added} ${m.added_week ? `<span class="text-xs text-green-600">(+${m.added_week} wk)</span>` : ''}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${used}</td>
                    <td class="px-6 py-4 whitespace-nowrap font-semibold">${m.used_today || 0}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${m.used_week || 0}</td>
                    <td class="px-6 py-4 whitespace-nowrap ${lowCls}">${remaining}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${esc(m.last_added_date || m.delivery_date || '-')}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <button class="text-indigo-500 hover:text-indigo-700 mr-2" data-usage="${m.id}" title="Log usage"><i class="fas fa-clipboard-list"></i></button>
                        <button class="text-green-500 hover:text-green-700 mr-2" data-add="${m.id}" title="Add quantity"><i class="fas fa-plus"></i></button>
                        <button class="text-red-500 hover:text-red-700" data-delete="${m.id}" title="Delete"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }
        renderLowStockCard(out.low_stock || []);
    } catch (e) { showToast(e.message, 'error'); }
}

// Floating low-stock warning card
function renderLowStockCard(low) {
    const card = $('#lowStockCard');
    const list = $('#lowStockList');
    if (!low.length) { card.classList.add('hidden'); return; }
    list.innerHTML = low.map(l => `
        <div class="flex justify-between items-center text-sm">
            <span class="text-gray-700 truncate mr-2">${esc(l.name)}</span>
            <span class="text-red-600 font-bold whitespace-nowrap">${l.remaining} ${esc(l.unit)}</span>
        </div>`).join('');
    card.classList.remove('hidden');
}

async function saveMaterial(e) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    // "Qty Delivered (Added)" is the amount added now.
    fd.quantity_delivered = parseFloat(fd.quantity_delivered || 0);
    const id = $('#materialId').value;
    try {
        if (id) {
            // Add-only mode: only append quantity on the chosen added date.
            await api('materials', 'PUT', { quantity_delivered: fd.quantity_delivered, delivery_date: fd.delivery_date }, id);
            showToast('Quantity added successfully.', 'success');
        } else {
            if (!$('#materialName').disabled) {
                await api('materials', 'POST', fd);
                showToast('Material added successfully.', 'success');
            }
        }
        closeModal('materialModal');
        e.target.reset();
        resetMaterialModal();
        loadMaterials(); loadDashboard();
    } catch (err) { showToast(err.message, 'error'); }
}

async function addToMaterial(id) {
    try {
        const out = await api('materials', 'GET', null, id);
        const m = out.data;
        $('#materialId').value = m.id;
        $('#materialName').value = m.name;
        $('#materialName').disabled = true;
        $('#deliveryDate').value = new Date().toISOString().slice(0, 10);
        $('#quantityDelivered').value = '';
        $('#unit').value = m.unit;
        $('#unit').disabled = true;
        $('#lowStock').value = m.low_stock_threshold || '';
        $('#lowStock').disabled = true;
        $('#qtyLabel').textContent = 'Qty to Add';
        $('#materialModalTitle').textContent = 'Add to ' + m.name;
        openModal('materialModal');
    } catch (e) { showToast(e.message, 'error'); }
}

// Reset the material modal back to "Add" mode (re-enables fields)
function resetMaterialModal() {
    $('#materialId').value = '';
    $('#materialName').disabled = false;
    $('#unit').disabled = false;
    $('#lowStock').disabled = false;
    $('#qtyLabel').textContent = 'Qty Added';
    $('#materialModalTitle').textContent = 'Add Material';
}

// ---- Log daily usage ----
async function openUsageModal() {
    try {
        const out = await customApi('api/materials.php?action=list');
        const opts = out.materials.map(m => `<option value="${m.id}">${esc(m.name)} (${esc(m.unit)})</option>`).join('');
        $('#usageMaterial').innerHTML = opts;
        $('#usageDate').value = new Date().toISOString().slice(0, 10);
        $('#usageQty').value = '';
        $('#usageNote').value = '';
        openModal('usageModal');
    } catch (e) { showToast(e.message, 'error'); }
}

async function saveUsage(e) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    try {
        await customApi('api/materials.php?action=usage', 'POST', {
            material_id: parseInt(fd.material_id, 10),
            use_date: fd.use_date,
            quantity_used: parseFloat(fd.quantity_used),
            note: fd.note || ''
        });
        showToast('Usage logged.', 'success');
        closeModal('usageModal');
        loadMaterials(); loadDashboard();
    } catch (err) { showToast(err.message, 'error'); }
}

// ---- Weekly report ----
async function generateWeeklyReport() {
    try {
        const out = await customApi('api/materials.php?action=report');
        const ws = out.week_start, we = out.week_end;
        const days = out.days || [];
        const mats = out.materials || [];
        const dayList = days.length ? days.map(d => d.slice(5)).join(', ') : 'None';

        const perCatUsed = Object.entries(out.per_category_used || {});
        const perCatAdded = Object.entries(out.per_category_added || {});

        const usedRows = mats.map(m => `
            <tr>
                <td class="px-3 py-1.5 border">${esc(m.name)}</td>
                <td class="px-3 py-1.5 border text-right">${m.added_week || 0}</td>
                <td class="px-3 py-1.5 border text-right">${m.used_week || 0}</td>
                <td class="px-3 py-1.5 border text-right">${m.remaining || 0}</td>
            </tr>`).join('');

        const catUsedRows = perCatUsed.length
            ? perCatUsed.map(([c, v]) => `<div class="flex justify-between"><span>${esc(c)}</span><span class="font-semibold">${v}</span></div>`).join('')
            : '<p class="text-gray-400">No usage this week.</p>';
        const catAddedRows = perCatAdded.length
            ? perCatAdded.map(([c, v]) => `<div class="flex justify-between"><span>${esc(c)}</span><span class="font-semibold">${v}</span></div>`).join('')
            : '<p class="text-gray-400">No additions this week.</p>';

        const generatedAt = new Date().toLocaleString();
        $('#reportContent').innerHTML = `
            <div class="text-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800 mb-1">JengaPro Weekly Report with Dates</h2>
                <p class="text-sm text-gray-500">Generated: ${generatedAt}</p>
            </div>
            <div class="mb-4 p-3 bg-gray-50 rounded">
                <p class="font-semibold">Week: ${ws} → ${we}</p>
                <p class="text-xs text-gray-500">Days with recorded usage (${days.length}): ${dayList}</p>
            </div>
            <h3 class="font-semibold mb-2">Total Used per Category (this week)</h3>
            <div class="mb-4 space-y-1">${catUsedRows}</div>
            <h3 class="font-semibold mb-2">Total Added per Category (this week)</h3>
            <div class="mb-4 space-y-1">${catAddedRows}</div>
            <h3 class="font-semibold mb-2">Per Material</h3>
            <table class="w-full border-collapse text-sm mb-2">
                <thead><tr class="bg-gray-100">
                    <th class="px-3 py-1.5 border text-left">Material</th>
                    <th class="px-3 py-1.5 border text-right">Added (wk)</th>
                    <th class="px-3 py-1.5 border text-right">Used (wk)</th>
                    <th class="px-3 py-1.5 border text-right">Remaining</th>
                </tr></thead>
                <tbody>${usedRows}</tbody>
            </table>`;
        openModal('reportModal');
    } catch (e) { showToast(e.message, 'error'); }
}

function printWeeklyReport() {
    const content = $('#reportContent').innerHTML;
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>JengaPro Weekly Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
                h2 { text-align: center; margin-bottom: 5px; }
                .meta { text-align: center; color: #666; margin-bottom: 20px; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
                th { background: #f3f4f6; }
                .text-right { text-align: right; }
                .mb-4 { margin-bottom: 16px; }
                .space-y-1 > div { margin-bottom: 4px; }
                .flex { display: flex; }
                .justify-between { justify-content: space-between; }
                .bg-gray-50 { background: #f9fafb; padding: 12px; border-radius: 6px; }
                .font-semibold { font-weight: 600; }
                .text-gray-500 { color: #6b7280; }
                .text-gray-400 { color: #9ca3af; }
                .text-sm { font-size: 12px; }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            ${content}
            <script>window.onload = function() { window.print(); }<\/script>
        </body>
        </html>
    `);
    win.document.close();
}

async function deleteMaterial(id) {
    const ok = await confirmDialog('Delete Material', 'Are you sure you want to delete this material? This cannot be undone.');
    if (!ok) return;
    try {
        await api('materials', 'DELETE', null, id);
        showToast('Material deleted.', 'success');
        loadMaterials(); loadDashboard();
    } catch (e) { showToast(e.message, 'error'); }
}

// ---- Units management ----
async function loadUnits() {
    const out = await api('units');
    const list = $('#unitsList');
    if (!out.data.length) {
        list.innerHTML = `<p class="text-sm text-gray-500">No units yet.</p>`;
    } else {
        list.innerHTML = out.data.map(u => `
            <div class="flex items-center justify-between py-2 border-b border-gray-100" data-unit="${u.id}">
                <div>
                    <span class="font-medium text-gray-800">${esc(u.name)}</span>
                    ${u.symbol ? `<span class="text-xs text-gray-400 ml-2">(${esc(u.symbol)})</span>` : ''}
                </div>
                <div class="flex items-center gap-2">
                    <button class="text-blue-500 hover:text-blue-700" data-edit-unit="${u.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="text-red-500 hover:text-red-700" data-delete-unit="${u.id}" title="Remove"><i class="fas fa-trash"></i></button>
                </div>
            </div>`).join('');
    }
    // Sync the Unit select in the material modal
    const opts = `<option value="">-- Select Unit --</option>` +
        out.data.map(u => `<option value="${esc(u.name)}">${esc(u.name)}</option>`).join('');
    const sel = $('#unit');
    if (sel) sel.innerHTML = opts;
}

async function openUnitsModal() {
    $('#unitId').value = '';
    $('#unitName').value = '';
    $('#unitSymbol').value = '';
    $('#unitModalTitle').textContent = 'Manage Units';
    $('#unitSaveBtn').textContent = 'Add Unit';
    await loadUnits();
    openModal('unitsModal');
}

async function saveUnit(e) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const id = $('#unitId').value;
    try {
        if (id) {
            await api('units', 'PUT', fd, id);
            showToast('Unit updated.', 'success');
        } else {
            await api('units', 'POST', fd);
            showToast('Unit added.', 'success');
        }
        $('#unitId').value = '';
        $('#unitName').value = '';
        $('#unitSymbol').value = '';
        $('#unitSaveBtn').textContent = 'Add Unit';
        loadUnits();
    } catch (err) { showToast(err.message, 'error'); }
}

async function editUnit(id) {
    try {
        const out = await api('units', 'GET', null, id);
        const u = out.data;
        $('#unitId').value = u.id;
        $('#unitName').value = u.name;
        $('#unitSymbol').value = u.symbol || '';
        $('#unitSaveBtn').textContent = 'Save Changes';
        $('#unitName').focus();
    } catch (e) { showToast(e.message, 'error'); }
}

async function deleteUnit(id) {
    const ok = await confirmDialog('Remove Unit', 'Remove this unit? Materials already using it are unaffected.');
    if (!ok) return;
    try {
        await api('units', 'DELETE', null, id);
        showToast('Unit removed.', 'success');
        loadUnits();
    } catch (e) { showToast(e.message, 'error'); }
}

// ================= SITE TEAM =================
async function loadSiteTeam() {
    try {
        const out = await api('site_team');
        const tbody = $('#teamTableBody');
        if (!out.data.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No team members found.</td></tr>`;
        } else {
            tbody.innerHTML = out.data.map(t => `
                <tr data-id="${t.id}">
                    <td class="px-6 py-4 whitespace-nowrap">${esc(t.name)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${esc(t.role)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${esc(t.email || '-')}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${esc(t.phone || '-')}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <button class="text-blue-500 hover:text-blue-700 mr-2" data-edit-team="${t.id}"><i class="fas fa-edit"></i></button>
                        <button class="text-red-500 hover:text-red-700" data-delete-team="${t.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`).join('');
        }
    } catch (e) { showToast(e.message, 'error'); }
}

async function saveTeamMember(e) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if (!fd.email) fd.email = null;
    if (!fd.phone) fd.phone = null;
    const id = $('#teamMemberId').value;
    try {
        if (id) { await api('site_team', 'PUT', fd, id); showToast('Team member updated.', 'success'); }
        else { await api('site_team', 'POST', fd); showToast('Team member added.', 'success'); }
        closeModal('teamMemberModal'); e.target.reset(); $('#teamMemberId').value = '';
        $('#teamMemberModalTitle').textContent = 'Add Team Member';
        loadSiteTeam();
    } catch (err) { showToast(err.message, 'error'); }
}

async function editTeamMember(id) {
    try {
        const out = await api('site_team', 'GET', null, id);
        const t = out.data;
        $('#teamMemberId').value = t.id;
        $('#teamMemberName').value = t.name;
        $('#teamMemberRole').value = t.role;
        $('#teamMemberEmail').value = t.email || '';
        $('#teamMemberPhone').value = t.phone || '';
        $('#teamMemberModalTitle').textContent = 'Edit Team Member';
        openModal('teamMemberModal');
    } catch (e) { showToast(e.message, 'error'); }
}

async function deleteTeamMember(id) {
    const ok = await confirmDialog('Delete Team Member', 'Remove this team member? This cannot be undone.');
    if (!ok) return;
    try { await api('site_team', 'DELETE', null, id); showToast('Team member removed.', 'success'); loadSiteTeam(); }
    catch (e) { showToast(e.message, 'error'); }
}

// ================= WORKERS =================
async function loadWorkers() {
    try {
        const out = await api('workers');
        const tbody = $('#workersTableBody');
        if (!out.data.length) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No workers found.</td></tr>`;
        } else {
            tbody.innerHTML = out.data.map(w => `
                <tr data-id="${w.id}">
                    <td class="px-6 py-4 whitespace-nowrap">${esc(w.name)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${w.worker_type === 'fundi' ? 'Fundi (Skilled)' : 'Casual'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${fmtMoney(w.daily_rate)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <button class="text-blue-500 hover:text-blue-700 mr-2" data-edit="${w.id}"><i class="fas fa-edit"></i></button>
                        <button class="text-red-500 hover:text-red-700" data-delete="${w.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`).join('');
        }
        loadAttendance();
    } catch (e) { showToast(e.message, 'error'); }
}

async function saveWorker(e) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const id = $('#workerId').value;
    try {
        if (id) { await api('workers', 'PUT', fd, id); showToast('Worker updated.', 'success'); }
        else { await api('workers', 'POST', fd); showToast('Worker added.', 'success'); }
        closeModal('workerModal'); e.target.reset(); $('#workerId').value = '';
        $('#workerModalTitle').textContent = 'Add Worker';
        loadWorkers(); loadDashboard();
    } catch (err) { showToast(err.message, 'error'); }
}

async function editWorker(id) {
    try {
        const out = await api('workers', 'GET', null, id);
        const w = out.data;
        $('#workerId').value = w.id;
        $('#workerName').value = w.name;
        $('#workerType').value = w.worker_type;
        $('#dailyRate').value = w.daily_rate;
        $('#workerModalTitle').textContent = 'Edit Worker';
        openModal('workerModal');
    } catch (e) { showToast(e.message, 'error'); }
}

async function deleteWorker(id) {
    const ok = await confirmDialog('Delete Worker', 'Delete this worker? Attendance records will also be removed.');
    if (!ok) return;
    try { await api('workers', 'DELETE', null, id); showToast('Worker deleted.', 'success'); loadWorkers(); loadDashboard(); }
    catch (e) { showToast(e.message, 'error'); }
}

// ---- Weekly Attendance (7 days) ----
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
let weekDays = [];        // array of Y-m-d for Sun..Sat
let weekWorkers = [];     // cached workers for live total calc

// Current week start (Sunday) as Y-m-d
function weekStartStr(ref = new Date()) {
    const d = new Date(ref);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - dow);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function fmtDateShort(d) { return d.slice(5); } // MM-DD

async function loadAttendance() {
    try {
        const [wOut, workersOut] = await Promise.all([
            customApi('api/attendance.php?action=week'),
            api('workers')
        ]);
        weekDays = wOut.days;
        weekWorkers = workersOut.data;
        $('#weekRangeLabel').textContent = `Week: ${fmtDateShort(wOut.start)} → ${fmtDateShort(wOut.end)} (refreshes every Saturday)`;

        // Header
        let head = `<tr><th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Worker</th>`;
        weekDays.forEach(d => {
            const dt = new Date(d + 'T00:00:00');
            const today = new Date().toISOString().slice(0, 10) === d;
            head += `<th class="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase ${today ? 'text-blue-600' : ''}">${DAY_LABELS[dt.getDay()]}<br><span class="font-normal">${fmtDateShort(d)}</span></th>`;
        });
        head += `<th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Days</th><th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pay</th></tr>`;
        $('#attendanceHead').innerHTML = head;

        // Body
        if (!weekWorkers.length) {
            $('#attendanceBody').innerHTML = `<tr><td colspan="9" class="px-3 py-4 text-center text-gray-500">Add workers first to mark weekly attendance.</td></tr>`;
            $('#attendanceFoot').innerHTML = ''; $('#weeklyTotal').textContent = fmtMoney(0);
            return;
        }
        const locked = new Set(wOut.locked_workers || []);
        const body = weekWorkers.map(w => {
            const isLocked = locked.has(w.id);
            let days = 0;
            let cells = '';
            weekDays.forEach(d => {
                const present = (wOut.present_by_day[d] || []).includes(w.id);
                if (present) days++;
                cells += `<td class="px-2 py-2 text-center"><input type="checkbox" class="att-chk" data-worker="${w.id}" data-day="${d}" ${present ? 'checked' : ''} ${isLocked ? 'disabled' : ''}></td>`;
            });
            const pay = days * (w.daily_rate || 0);
            const lockTag = isLocked ? ` <span class="text-[10px] px-1 py-0.5 rounded bg-gray-200 text-gray-600">Paid</span>` : '';
            return `<tr data-worker="${w.id}">
                <td class="px-3 py-2 whitespace-nowrap">${esc(w.name)} <span class="text-gray-400 text-xs">(${w.worker_type === 'fundi' ? 'Fundi' : 'Casual'})</span>${lockTag}</td>
                ${cells}
                <td class="px-3 py-2 text-center font-medium" data-days>${days}</td>
                <td class="px-3 py-2 text-right font-semibold text-green-600" data-pay>${fmtMoney(pay)}</td>
            </tr>`;
        }).join('');
        $('#attendanceBody').innerHTML = body;

        // Wire checkboxes for live toggle
        $$('#attendanceBody .att-chk').forEach(chk => {
            chk.addEventListener('change', onAttendanceToggle);
        });
        computeWeeklyTotal();
    } catch (e) { showToast(e.message, 'error'); }
}

async function onAttendanceToggle(e) {
    const chk = e.target;
    const workerId = chk.dataset.worker;
    const day = chk.dataset.day;
    try {
        await customApi('api/attendance.php?action=toggle', 'POST', { worker_id: workerId, work_date: day, checked: chk.checked });
        // Update this worker's row totals live
        const row = chk.closest('tr');
        const days = $$('.att-chk:checked', row).length;
        const rate = (weekWorkers.find(w => w.id == workerId) || {}).daily_rate || 0;
        row.querySelector('[data-days]').textContent = days;
        row.querySelector('[data-pay]').textContent = fmtMoney(days * rate);
        computeWeeklyTotal();
    } catch (err) { showToast(err.message, 'error'); chk.checked = !chk.checked; }
}

function computeWeeklyTotal() {
    let total = 0;
    $$('#attendanceBody tr[data-worker]').forEach(row => {
        const days = parseInt(row.querySelector('[data-days]').textContent, 10) || 0;
        const wid = row.dataset.worker;
        const rate = (weekWorkers.find(w => w.id == wid) || {}).daily_rate || 0;
        total += days * rate;
    });
    $('#weeklyTotal').textContent = fmtMoney(total);
}

async function saveAttendance() {
    // Re-sync all checkboxes to DB (bulk)
    try {
        for (const d of weekDays) {
            const present = $$(`#attendanceBody .att-chk[data-day="${d}"]:checked`).map(c => c.dataset.worker);
            await customApi('api/attendance.php?action=save', 'POST', { work_date: d, present });
        }
        showToast('Weekly attendance saved.', 'success');
        loadDashboard();
    } catch (e) { showToast(e.message, 'error'); }
}

// ================= PAYMENTS =================
async function loadWorkersForSelect() {
    try {
        const out = await api('workers');
        const opts = `<option value="">-- Select Worker --</option>` +
            out.data.map(w => `<option value="${w.id}">${esc(w.name)} (${w.worker_type})</option>`).join('');
        $('#paymentWorker').innerHTML = opts;
    } catch (e) { showToast(e.message, 'error'); }
}

async function loadPayments() {
    await loadWageSummary();
    await loadOtherPayments();
}

async function loadWageSummary() {
    try {
        const out = await customApi('api/payments.php?action=wages');
        const body = $('#wageSummaryBody');
        const wk = out.week_start;
        if (!out.workers.length) {
            body.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No workers yet.</td></tr>`;
            return;
        }
        body.innerHTML = out.workers.map(w => {
            const pending = parseFloat(w.pending_total) || 0;
            const paid = parseFloat(w.paid_total) || 0;
            const locked = out.locked_workers.includes(parseInt(w.id));
            const status = locked ? 'paid' : (pending > 0 ? 'pending' : (paid > 0 ? 'paid' : 'pending'));
            const action = locked
                ? `<span class="text-green-600 text-sm font-medium"><i class="fas fa-check-circle"></i> Paid &amp; locked</span>`
                : (pending > 0
                    ? `<button class="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700" data-confirm="${w.id}"><i class="fas fa-check mr-1"></i>Confirm ${fmtMoney(pending)}</button>`
                    : `<span class="text-gray-400 text-sm">No pending</span>`);
            return `<tr data-worker="${w.id}">
                <td class="px-6 py-4 whitespace-nowrap">${esc(w.name)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${w.worker_type === 'fundi' ? 'Fundi' : 'Casual'}</td>
                <td class="px-6 py-4 whitespace-nowrap">${fmtMoney(w.daily_rate)}</td>
                <td class="px-6 py-4 whitespace-nowrap font-semibold text-green-700">${fmtMoney(pending)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${statusBadge(status)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${action}</td>
            </tr>`;
        }).join('');
    } catch (e) { showToast(e.message, 'error'); }
}

async function loadOtherPayments() {
    try {
        const out = await api('payments');
        const others = out.data.filter(p => (p.category || 'other') === 'other' || !p.worker_id);
        const body = $('#otherPaymentsTableBody');
        if (!others.length) {
            body.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No other payments yet.</td></tr>`;
            return;
        }
        body.innerHTML = others.map(p => `
            <tr data-id="${p.id}">
                <td class="px-6 py-4 whitespace-nowrap">${esc(p.payment_date)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${esc(p.description)}</td>
                <td class="px-6 py-4 whitespace-nowrap font-semibold">${fmtMoney(p.amount)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${esc(p.recipient)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${statusBadge(p.status)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <button class="text-blue-500 hover:text-blue-700 mr-2" data-edit="${p.id}"><i class="fas fa-edit"></i></button>
                    <button class="text-red-500 hover:text-red-700" data-delete="${p.id}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`).join('');
    } catch (e) { showToast(e.message, 'error'); }
}

async function confirmWage(workerId) {
    const ok = await confirmDialog('Confirm Payment', 'Mark this worker\'s wage payments as PAID and lock this week\'s attendance?', 'Confirm', false);
    if (!ok) return;
    try {
        await customApi('api/payments.php?action=confirmWage', 'POST', { worker_id: workerId });
        showToast('Payment confirmed. Attendance locked.', 'success');
        loadWageSummary(); loadAttendance(); loadDashboard();
    } catch (e) { showToast(e.message, 'error'); }
}

async function savePayment(e) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if (!fd.worker_id) fd.worker_id = null;
    if (fd.category === 'other') { fd.worker_type = null; fd.worker_id = null; fd.week_start = null; }
    else { fd.week_start = weekStartStr(); }
    const id = $('#paymentId').value;
    try {
        if (id) { await api('payments', 'PUT', fd, id); showToast('Payment updated.', 'success'); }
        else { await api('payments', 'POST', fd); showToast('Payment added.', 'success'); }
        closeModal('paymentModal'); e.target.reset(); $('#paymentId').value = '';
        $('#paymentModalTitle').textContent = 'Add Payment';
        loadPayments(); loadDashboard();
    } catch (err) { showToast(err.message, 'error'); }
}

function toggleWageFields() {
    const isWage = $('#paymentCategory').value === 'wage';
    $('#wageFields').style.display = isWage ? '' : 'none';
}

async function editPayment(id) {
    try {
        const out = await api('payments', 'GET', null, id);
        const p = out.data;
        $('#paymentId').value = p.id;
        $('#paymentCategory').value = p.category || 'wage';
        $('#paymentDate').value = p.payment_date;
        $('#paymentDescription').value = p.description;
        $('#workerTypePayment').value = p.worker_type || '';
        $('#paymentWorker').value = p.worker_id || '';
        $('#paymentAmount').value = p.amount;
        $('#paymentRecipient').value = p.recipient;
        $('#paymentStatus').value = p.status;
        toggleWageFields();
        $('#paymentModalTitle').textContent = 'Edit Payment';
        openModal('paymentModal');
    } catch (e) { showToast(e.message, 'error'); }
}

async function deletePayment(id) {
    const ok = await confirmDialog('Delete Payment', 'Delete this payment record?');
    if (!ok) return;
    try { await api('payments', 'DELETE', null, id); showToast('Payment deleted.', 'success'); loadPayments(); loadDashboard(); }
    catch (e) { showToast(e.message, 'error'); }
}

async function changePassword(e) {
    e.preventDefault();
    const oldP = $('#oldPassword').value;
    const newP = $('#newPassword').value;
    const conf = $('#confirmPassword').value;
    if (newP !== conf) { showToast('New passwords do not match.', 'error'); return; }
    try {
        await customApi('api/auth.php?action=changePassword', 'POST', { old_password: oldP, new_password: newP });
        showToast('Password changed successfully.', 'success');
        e.target.reset();
    } catch (err) { showToast(err.message, 'error'); }
}

// Generate worker wage payments from the weekly attendance grid
async function payWorkersByAttendance() {
    try {
        const presentByWorker = {};
        $$('#attendanceBody tr[data-worker]').forEach(row => {
            const wid = row.dataset.worker;
            const days = $$('.att-chk:checked', row).length;
            if (days > 0) presentByWorker[wid] = days;
        });
        if (!Object.keys(presentByWorker).length) {
            showToast('No attendance checked for this week.', 'warning');
            return;
        }
        let count = 0;
        const wOut = await api('workers');
        const ws = weekStartStr();
        // Avoid creating duplicate wage records for the same worker + week.
        const existing = await api('payments');
        const done = new Set(existing.data
            .filter(p => (p.category === 'wage' || p.category === null) && p.week_start === ws && p.worker_id)
            .map(p => String(p.worker_id)));
        for (const w of wOut.data) {
            const days = presentByWorker[w.id];
            if (days && w.daily_rate > 0 && !done.has(String(w.id))) {
                await api('payments', 'POST', {
                    payment_date: new Date().toISOString().slice(0, 10),
                    description: `Weekly wages (${days} day${days > 1 ? 's' : ''})`,
                    category: 'wage',
                    worker_type: w.worker_type,
                    worker_id: w.id,
                    amount: days * w.daily_rate,
                    recipient: w.name,
                    status: 'pending',
                    week_start: ws
                });
                count++;
            }
        }
        showToast(`Generated ${count} wage payment record(s).`, 'success');
        loadPayments(); loadDashboard();
    } catch (e) { showToast(e.message, 'error'); }
}

// ================= PROGRESS =================
async function loadProgress() {
    try {
        const out = await api('progress');
        const tbody = $('#progressTableBody');
        if (!out.data.length) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No progress records.</td></tr>`;
        } else {
            tbody.innerHTML = out.data.map(p => `
                <tr data-id="${p.id}">
                    <td class="px-6 py-4 whitespace-nowrap">${esc(p.progress_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap capitalize">${esc(p.milestone)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="w-full bg-gray-200 rounded-full h-2.5"><div class="bg-blue-600 h-2.5 rounded-full" style="width:${p.percentage}%"></div></div>
                        <span class="text-xs">${p.percentage}%</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <button class="text-blue-500 hover:text-blue-700 mr-2" data-edit="${p.id}"><i class="fas fa-edit"></i></button>
                        <button class="text-red-500 hover:text-red-700" data-delete="${p.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`).join('');
        }
        drawCharts(out.data);
    } catch (e) { showToast(e.message, 'error'); }
}

async function saveProgress(e) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    fd.percentage = parseInt(fd.percentage, 10);
    const id = $('#progressId').value;
    try {
        if (id) { await api('progress', 'PUT', fd, id); showToast('Progress updated.', 'success'); }
        else { await api('progress', 'POST', fd); showToast('Progress added.', 'success'); }
        closeModal('progressModal'); e.target.reset(); $('#progressId').value = '';
        $('#progressModalTitle').textContent = 'Update Progress';
        loadProgress(); loadDashboard();
    } catch (err) { showToast(err.message, 'error'); }
}

async function editProgress(id) {
    try {
        const out = await api('progress', 'GET', null, id);
        const p = out.data;
        $('#progressId').value = p.id;
        $('#progressDate').value = p.progress_date;
        $('#progressMilestone').value = p.milestone;
        $('#progressPercentage').value = p.percentage;
        $('#percentageValue').textContent = p.percentage + '%';
        $('#progressNotes').value = p.notes || '';
        $('#progressModalTitle').textContent = 'Edit Progress';
        openModal('progressModal');
    } catch (e) { showToast(e.message, 'error'); }
}

async function deleteProgress(id) {
    const ok = await confirmDialog('Delete Progress', 'Delete this progress record?');
    if (!ok) return;
    try { await api('progress', 'DELETE', null, id); showToast('Progress deleted.', 'success'); loadProgress(); loadDashboard(); }
    catch (e) { showToast(e.message, 'error'); }
}

// ================= WEATHER (live, fetched from API in browser) =================

// Live weather fetched directly from OpenWeatherMap using the API key (7-day prediction)
async function fetchJson(url) {
    const res = await fetch(url);
    return res.json();
}

// Construction advice based on weather condition + temperature
function constructionAdvice(condition, temp) {
    const c = (condition || '').toLowerCase();
    const t = Number(temp || 0);
    if (c.includes('rain') || c.includes('drizzle')) {
        return 'Avoid concrete pours & external plastering. Cover materials, pause excavation, focus on indoor works.';
    }
    if (c.includes('thunder') || c.includes('storm')) {
        return 'Halt lifting/cranes & roofing. Secure loose materials and evacuate elevated work areas.';
    }
    if (c.includes('snow')) {
        return 'Site shutdown risk: protect pipes, no concreting, clear access routes.';
    }
    if (c.includes('wind')) {
        return 'Restrict crane use & scaffolding work above 2 floors. Secure sheeting and lightweight materials.';
    }
    if (c.includes('cloud')) {
        return 'Good for general works & deliveries. Ideal for masonry and steel fixing.';
    }
    if (c.includes('mist') || c.includes('fog') || c.includes('haze')) {
        return 'Limit crane/height work until visibility clears. Good for ground-level tasks.';
    }
    // Clear / sunny
    if (t >= 33) {
        return 'Heat plan: hydrate crews, shade fresh concrete, avoid 12-3pm heavy lifting, use sun protection.';
    }
    if (t <= 8) {
        return 'Cold weather: use warm water/accelerators for concrete, protect curing, watch for frost.';
    }
    return 'Excellent conditions for concreting, masonry and exterior finishes.';
}

function renderLiveWeather(current, daily) {
    $('#weatherStatus').classList.add('hidden');
    $('#liveWeather').classList.remove('hidden');
    $('#liveCity').textContent = current.city || '';
    $('#liveTemp').textContent = Math.round(current.temp) + '°C';
    $('#liveDesc').textContent = current.description || '';
    const iconUrl = `https://openweathermap.org/img/wn/${current.icon || '01d'}@2x.png`;
    $('#liveIcon').src = iconUrl;
    $('#liveFeels').textContent = Math.round(current.feels_like ?? current.temp) + '°C';
    $('#liveHumidity').textContent = (current.humidity != null ? current.humidity + '%' : '');

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fc = (daily || []).map((f, i) => {
        const d = new Date(f.date + 'T00:00:00');
        const label = i === 0 ? 'Today' : dayNames[d.getDay()];
        const cond = (f.condition || '').toLowerCase();
        const icon = `https://openweathermap.org/img/wn/${cond || '01d'}.png`;
        return `
        <div class="p-3 border rounded-lg bg-white flex flex-col items-center text-center shadow-sm">
            <p class="text-xs font-semibold text-gray-600">${label}</p>
            <img src="${icon}" alt="${f.desc || cond}" class="h-10 w-10 my-1" onerror="this.style.display='none'">
            <p class="text-xs text-gray-400 capitalize">${f.desc || ''}</p>
            <p class="text-sm font-bold text-gray-800">${Math.round(f.temp_max)}°</p>
            <p class="text-xs text-gray-400">${Math.round(f.temp_min)}°</p>
            <p class="text-[11px] text-blue-700 mt-1 leading-tight">${constructionAdvice(cond, f.temp_max)}</p>
        </div>`;
    }).join('');
    $('#liveForecast').className = 'grid gap-3 ' + (daily && daily.length > 4 ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-7' : 'grid-cols-2');
    $('#liveForecast').innerHTML = fc;
    showToast('Live weather loaded.', 'info');
}

function fetchLiveWeather() {
    if (!navigator.geolocation) { showToast('Geolocation not supported.', 'warning'); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const { latitude: lat, longitude: lon } = pos.coords;
            const key = WEATHER_API_KEY;

            // Reverse-geocode to the smallest local area (town/ward/village), not the big city.
            let localArea = '';
            try {
                const rev = await fetchJson(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=5&appid=${key}`);
                if (Array.isArray(rev) && rev.length) {
                    // Results are ordered most-specific first; pick the finest-grained named place.
                    const pick = rev.find(r => r.name && !/(county|province|region|state|country)/i.test(r.name)) || rev[0];
                    const parts = [pick.name];
                    if (pick.state && pick.state !== pick.name) parts.push(pick.state);
                    localArea = parts.join(', ');
                }
            } catch (_) { /* non-fatal */ }

            // Try One Call 3.0 for a true 7-day daily forecast + current
            let current = null, daily = [];
            try {
                const one = await fetchJson(`https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=metric&exclude=minutely,hourly,alerts&appid=${key}`);
                if (!one.cod || one.cod === 200) {
                    if (one.current) {
                        const c = one.current;
                        current = {
                            city: localArea || one.timezone || '',
                            temp: c.temp, feels_like: c.feels_like,
                            humidity: c.humidity,
                            condition: c.weather[0].main, description: c.weather[0].description,
                            icon: c.weather[0].icon
                        };
                    }
                    daily = (one.daily || []).slice(0, 7).map(d => ({
                        date: new Date(d.dt * 1000).toISOString().slice(0, 10),
                        temp: d.temp.day, temp_min: d.temp.min, temp_max: d.temp.max,
                        desc: d.weather[0].description, condition: d.weather[0].main
                    }));
                }
            } catch (_) { /* fall through to forecast endpoint */ }

            // Fallback: current weather + 5-day/3-hour forecast aggregated to daily
            if (!current || !daily.length) {
                const cur = await fetchJson(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key}`);
                const fct = await fetchJson(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${key}`);
                if (cur && cur.weather) {
                    current = {
                        city: localArea || cur.name, temp: cur.main.temp, feels_like: cur.main.feels_like,
                        humidity: cur.main.humidity,
                        condition: cur.weather[0].main, description: cur.weather[0].description,
                        icon: cur.weather[0].icon
                    };
                }
                if (fct && fct.list) {
                    const map = {};
                    fct.list.forEach(item => {
                        const date = item.dt_txt.split(' ')[0];
                        if (!map[date]) {
                            map[date] = {
                                date,
                                temp: item.main.temp, temp_min: item.main.temp_min, temp_max: item.main.temp_max,
                                desc: item.weather[0].description, condition: item.weather[0].main
                            };
                        }
                    });
                    daily = Object.values(map).slice(0, 7);
                }
            }

            if (!current) { showToast('Weather service unavailable. Check API key.', 'error'); return; }
            renderLiveWeather(current, daily);
        } catch (e) {
            showToast('Could not fetch weather: ' + e.message, 'error');
        }
    }, () => { showToast('Location permission denied. Enable location to fetch live weather.', 'warning'); });
}

// ================= DASHBOARD =================
let charts = {};
async function loadDashboard() {
    try {
        const out = await customApi('api/dashboard.php?t=' + Date.now());
        $('#statMaterials').textContent = out.materials_remaining;
        $('#statWorkers').textContent = out.workers_present_today + '/' + out.workers_total;
        $('#statExpenditure').textContent = fmtMoney(out.weekly_expenditure);
        $('#statProgress').textContent = out.project_progress + '%';
        $('#statPending').textContent = fmtMoney(out.pending_payments);
    } catch (e) { showToast(e.message, 'error'); }
}

function drawCharts(progressData) {
    if (typeof Chart === 'undefined') return;
    const labels = progressData.map(p => p.progress_date);
    const data = progressData.map(p => p.percentage);
    if (charts.progress) charts.progress.destroy();
    charts.progress = new Chart($('#progressChart').getContext('2d'), {
        type: 'line',
        data: { labels, datasets: [{ label: 'Progress %', data, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.2)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

// ================= SECTION / TAB SWITCHING (persisted) =================
const SECTION_TITLES = {
    dashboard: 'Dashboard', materials: 'Materials Inventory', workers: 'Workers & Attendance',
    payments: 'Payment Records', progress: 'Project Progress', weather: 'Weather Conditions',
    settings: 'Settings', team: 'Site Team'
};

function switchSection(section) {
    if (!section) return;
    $$('.main-section').forEach(s => s.classList.remove('active'));
    const target = $('#' + section + '-section');
    if (target) target.classList.add('active');

    // Tab bar active state
    $$('.tab-btn').forEach(b => {
        const on = b.dataset.section === section;
        b.classList.toggle('text-blue-600', on);
        b.classList.toggle('border-blue-600', on);
        b.classList.toggle('text-gray-500', !on);
        b.classList.toggle('border-transparent', !on);
    });
    // Sidebar active state
    $$('.nav-item').forEach(n => n.classList.toggle('bg-blue-700', n.dataset.section === section));

    $('header h1').textContent = 'Construction Site - ' + (SECTION_TITLES[section] || '');
    try { localStorage.setItem('jengapro_section', section); } catch (_) {}

    if (window.innerWidth <= 768) {
        $('.sidebar').classList.remove('sidebar-expanded'); $('.sidebar').classList.add('sidebar-collapsed');
        $('.content').classList.add('content-expanded');
    }
    if (section === 'weather') fetchLiveWeather();
}

// ================= INIT / EVENT WIRING =================
document.addEventListener('DOMContentLoaded', async () => {
    const authed = await checkAuth();
    if (!authed) return;

    // Sidebar nav
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchSection(item.dataset.section));
    });

    // Top tab nav
    $$('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchSection(btn.dataset.section));
    });
    $('#sidebarToggle').addEventListener('click', () => {
        $('.sidebar').classList.toggle('sidebar-collapsed');
        $('.sidebar').classList.toggle('sidebar-expanded');
        $('.content').classList.toggle('content-expanded');
    });

    // Logout
    $('#logoutBtn').addEventListener('click', async () => {
        await customApi('api/auth.php?action=logout', 'POST');
        location.href = 'login.php';
    });

    // Modal open/close bindings
    const bindModal = (openBtn, modalId, titleId, title) => {
        const base = normId(modalId);
        if (openBtn) openBtn.addEventListener('click', () => {
            const form = $('#' + base + 'Form');
            if (form) form.reset();
            const hid = $('#' + base + 'Id');
            if (hid) hid.value = '';
            if (titleId) $(titleId).textContent = title;
            openModal(base);
        });
    };
    const closeBtns = (modalId) => $$('#' + normId(modalId) + ' [data-close]').forEach(b => b.addEventListener('click', () => closeModal(modalId)));

    const addMaterialBtn = $('#addMaterialBtn');
    if (addMaterialBtn) addMaterialBtn.addEventListener('click', () => {
        const form = $('#materialForm');
        if (form) form.reset();
        resetMaterialModal();
        openModal('materialModal');
    });
    closeBtns('#materialModal');
    bindModal($('#addWorkerBtn'), '#workerModal', '#workerModalTitle', 'Add Worker'); closeBtns('#workerModal');
    bindModal($('#addTeamMemberBtn'), '#teamMemberModal', '#teamMemberModalTitle', 'Add Team Member'); closeBtns('#teamMemberModal');
    bindModal($('#addPaymentBtn'), '#paymentModal', '#paymentModalTitle', 'Add Payment'); closeBtns('#paymentModal');
    bindModal($('#addProgressBtn'), '#progressModal', '#progressModalTitle', 'Update Progress'); closeBtns('#progressModal');
    closeBtns('#usageModal');
    closeBtns('#reportModal');
    closeBtns('#unitsModal');

    // Unit settings icon opens the units management modal
    $('#unitSettingsBtn').addEventListener('click', openUnitsModal);

    // Form submits
    $('#materialForm').addEventListener('submit', saveMaterial);
    $('#workerForm').addEventListener('submit', saveWorker);
    $('#teamMemberForm').addEventListener('submit', saveTeamMember);
    $('#paymentForm').addEventListener('submit', savePayment);
    $('#progressForm').addEventListener('submit', saveProgress);
    $('#usageForm').addEventListener('submit', saveUsage);
    $('#unitForm').addEventListener('submit', saveUnit);
    $('#changePasswordForm').addEventListener('submit', changePassword);

    // Progress slider
    $('#progressPercentage').addEventListener('input', e => $('#percentageValue').textContent = e.target.value + '%');

    // Attendance / weekly wages
    $('#generateWagesBtn').addEventListener('click', payWorkersByAttendance);

    // Materials: weekly report + low stock card close
    $('#weeklyReportBtn').addEventListener('click', generateWeeklyReport);
    $('#printReportBtn').addEventListener('click', printWeeklyReport);
    $('#lowStockClose').addEventListener('click', () => $('#lowStockCard').classList.add('hidden'));

    // Payment category toggle shows/hides worker linking
    $('#paymentCategory').addEventListener('change', toggleWageFields);

    // "Other Payments" opens the same payment modal, pre-set as an other (non-worker) entry
    $('#addOtherPaymentBtn').addEventListener('click', () => {
        const form = $('#paymentForm');
        if (form) form.reset();
        $('#paymentId').value = '';
        $('#paymentCategory').value = 'other';
        $('#paymentDate').value = new Date().toISOString().slice(0, 10);
        $('#paymentStatus').value = 'pending';
        toggleWageFields();
        $('#paymentModalTitle').textContent = 'Add Other Payment';
        openModal('paymentModal');
    });

    // Live weather
    $('#liveWeatherBtn').addEventListener('click', fetchLiveWeather);

    // Event delegation for add/edit/delete/confirm buttons in tables
    document.body.addEventListener('click', (e) => {
        const t = e.target.closest('[data-add],[data-edit],[data-delete],[data-confirm],[data-usage],[data-edit-team],[data-delete-team]');
        if (!t) return;
        if (t.dataset.confirm) { confirmWage(t.dataset.confirm); return; }
        if (t.dataset.usage) { openUsageModal(); return; }
        if (t.dataset.add) { addToMaterial(t.dataset.add); return; }
        const isEdit = t.dataset.edit || t.dataset.editTeam;
        const isDelete = t.dataset.delete || t.dataset.deleteTeam;
        const id = isEdit || isDelete ? (t.dataset.edit || t.dataset.delete || t.dataset.editTeam || t.dataset.deleteTeam) : null;
        const section = t.closest('.main-section').id.replace('-section', '');
        if (!id) return;
        if (isEdit) {
            ({ workers: editWorker, payments: editPayment, progress: editProgress, team: editTeamMember }[section])(id);
        } else {
            ({ materials: deleteMaterial, workers: deleteWorker, payments: deletePayment, progress: deleteProgress, team: deleteTeamMember }[section])(id);
        }
    });

    // Event delegation for unit management buttons
    document.body.addEventListener('click', (e) => {
        const tu = e.target.closest('[data-edit-unit],[data-delete-unit]');
        if (!tu) return;
        if (tu.dataset.editUnit) editUnit(tu.dataset.editUnit);
        else if (tu.dataset.deleteUnit) deleteUnit(tu.dataset.deleteUnit);
    });

    // Initial loads
    loadDashboard();
    loadMaterials();
    loadWorkers();
    loadWorkersForSelect();
    loadPayments();
    loadProgress();
    loadAttendance();
    loadSiteTeam();

    // Restore last visited tab (persisted across refreshes)
    let saved = null;
    try { saved = localStorage.getItem('jengapro_section'); } catch (_) {}
    if (saved && $('#' + saved + '-section')) switchSection(saved);
    else switchSection('dashboard');
});
