/**
 * GUTO License Manager - Client Side Logic (Simplified)
 * Works by loading database credentials from localStorage.
 */

// Global State
let supabaseClient = null;
let allKeys = [];
let activeFilter = 'all';

// DOM Elements
const supabaseUrlInput = document.getElementById('supabaseUrl');
const supabaseKeyInput = document.getElementById('supabaseKey');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const configStatus = document.getElementById('configStatus');
const toggleConfigBtn = document.getElementById('toggleConfigBtn');
const supabaseConfigCard = document.getElementById('supabaseConfigCard');
const connectionIndicator = document.getElementById('connectionIndicator');

const keyPrefixInput = document.getElementById('keyPrefix');
const keyDurationSelect = document.getElementById('keyDuration');
const keyQuantityInput = document.getElementById('keyQuantity');
const generateKeysBtn = document.getElementById('generateKeysBtn');

const statsSummary = document.getElementById('statsSummary');
const tableSearch = document.getElementById('tableSearch');
const refreshBtn = document.getElementById('refreshBtn');
const keysTableBody = document.getElementById('keysTableBody');

// Key Durations Config
const durations = {
    '5min': { suffix: '5MIN', ms: 5 * 60 * 1000 },
    '1day': { suffix: '1DAY', ms: 24 * 60 * 60 * 1000 },
    '1week': { suffix: '1WEEK', ms: 7 * 24 * 60 * 60 * 1000 },
    '1month': { suffix: '1MONTH', ms: 30 * 24 * 60 * 60 * 1000 },
    'infinite': { suffix: 'LIFETIME', ms: null }
};

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    // Load config from localStorage
    const savedUrl = localStorage.getItem('guto_supabase_url');
    const savedKey = localStorage.getItem('guto_supabase_key');

    if (savedUrl) supabaseUrlInput.value = savedUrl;
    if (savedKey) supabaseKeyInput.value = savedKey;

    if (savedUrl && savedKey) {
        initializeSupabase(savedUrl, savedKey, true);
    } else {
        // If no credentials saved, open the config panel by default
        supabaseConfigCard.classList.remove('collapsed');
    }

    // Bind Event Listeners
    saveConfigBtn.addEventListener('click', handleSaveConfig);
    generateKeysBtn.addEventListener('click', handleGenerateKeys);
    refreshBtn.addEventListener('click', loadData);
    tableSearch.addEventListener('input', renderKeysTable);

    // Toggle Config Panel
    toggleConfigBtn.addEventListener('click', () => {
        supabaseConfigCard.classList.toggle('collapsed');
    });

    // Setup Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.getAttribute('data-filter');
            renderKeysTable();
        });
    });
});

// Password visibility toggle helper (called inline from HTML)
window.togglePasswordVisibility = function() {
    const keyInput = document.getElementById('supabaseKey');
    const eyeIcon = document.getElementById('passwordEye');
    if (keyInput.type === 'password') {
        keyInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        keyInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
};

// Clipboard copying utility
window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Chave copiada para a área de transferência!', 'success');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        showToast('Erro ao copiar chave.', 'error');
    });
};

// Toast notification helper
function showToast(message, type = 'info') {
    const toast = document.getElementById('toastNotification');
    const toastMsg = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.toast-icon');

    toastMsg.textContent = message;

    // Set classes and borders based on type
    toastIcon.className = 'fa-solid toast-icon';
    if (type === 'success') {
        toastIcon.classList.add('fa-circle-check');
        toast.style.borderColor = 'var(--success)';
        toastIcon.style.color = 'var(--success)';
    } else if (type === 'error') {
        toastIcon.classList.add('fa-circle-xmark');
        toast.style.borderColor = 'var(--error)';
        toastIcon.style.color = 'var(--error)';
    } else if (type === 'warning') {
        toastIcon.classList.add('fa-triangle-exclamation');
        toast.style.borderColor = 'var(--warning)';
        toastIcon.style.color = 'var(--warning)';
    } else {
        toastIcon.classList.add('fa-info-circle');
        toast.style.borderColor = 'var(--primary)';
        toastIcon.style.color = 'var(--primary)';
    }

    toast.classList.remove('hidden');

    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Config Status Alert helper
function showConfigStatus(message, type) {
    configStatus.textContent = message;
    configStatus.className = `status-alert ${type}`;
    configStatus.classList.remove('hidden');
}

// Update Header Connection Status Indicator
function setConnectionIndicator(isOnline) {
    if (isOnline) {
        connectionIndicator.className = 'connection-indicator online';
        connectionIndicator.innerHTML = '<i class="fa-solid fa-circle"></i> Conectado';
    } else {
        connectionIndicator.className = 'connection-indicator disconnected';
        connectionIndicator.innerHTML = '<i class="fa-solid fa-circle"></i> Desconectado';
    }
}

// Initialize Supabase Client
async function initializeSupabase(url, key, silent = false) {
    try {
        if (!silent) {
            showConfigStatus('Testando conexão...', 'warning');
        }

        // Initialize supabase SDK
        const client = supabase.createClient(url, key);

        // Run a simple query to test connection details & table existence
        const { error } = await client.from('licenses').select('id').limit(1);

        if (error) throw error;

        // Save successfully initialized client
        supabaseClient = client;
        
        // Save to localStorage
        localStorage.setItem('guto_supabase_url', url);
        localStorage.setItem('guto_supabase_key', key);

        setConnectionIndicator(true);

        if (!silent) {
            showConfigStatus('Conectado com sucesso!', 'success');
            showToast('Conexão com Supabase estabelecida!', 'success');
            
            // Auto collapse settings card on manual successful login
            setTimeout(() => {
                supabaseConfigCard.classList.add('collapsed');
            }, 1000);
        } else {
            configStatus.classList.add('hidden');
            supabaseConfigCard.classList.add('collapsed'); // collapse if load was silent/automatic
        }

        enableDashboard();
        loadData();
    } catch (err) {
        console.error('Supabase Init Error:', err);
        supabaseClient = null;
        setConnectionIndicator(false);
        showConfigStatus(`Erro ao conectar: ${err.message || 'Verifique as credenciais.'}`, 'error');
        supabaseConfigCard.classList.remove('collapsed'); // show panel to fix credentials
        disableDashboard();
    }
}

// Toggle Dashboard State
function enableDashboard() {
    generateKeysBtn.removeAttribute('disabled');
    keyPrefixInput.removeAttribute('disabled');
    keyDurationSelect.removeAttribute('disabled');
    keyQuantityInput.removeAttribute('disabled');
}

// Disable Dashboard inputs & data
function disableDashboard() {
    generateKeysBtn.setAttribute('disabled', 'true');
    allKeys = [];
    statsSummary.textContent = 'Configure o Supabase para carregar estatísticas.';
    renderKeysTable();
}

// Handle Connection Setup
function handleSaveConfig() {
    const url = supabaseUrlInput.value.trim();
    const key = supabaseKeyInput.value.trim();

    if (!url || !key) {
        showConfigStatus('Por favor, preencha a URL e a Service Role Key.', 'error');
        return;
    }

    initializeSupabase(url, key, false);
}

// Generate License Keys
async function handleGenerateKeys() {
    if (!supabaseClient) return;

    const prefix = keyPrefixInput.value.trim().toUpperCase() || 'GUTO';
    const durationVal = keyDurationSelect.value;
    const quantity = parseInt(keyQuantityInput.value) || 1;

    if (quantity < 1 || quantity > 50) {
        showToast('Quantidade deve ser entre 1 e 50 por vez.', 'warning');
        return;
    }

    generateKeysBtn.setAttribute('disabled', 'true');
    generateKeysBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';

    try {
        const insertData = [];
        const durationConfig = durations[durationVal];
        const now = Date.now();

        for (let i = 0; i < quantity; i++) {
            // Generate 6 chars random hex
            const hex = generateRandomHex(6);
            const keyString = `${prefix}-${durationConfig.suffix}-${hex}`;
            
            // Calculate expiry
            let expiresAt = null;
            if (durationConfig.ms) {
                expiresAt = new Date(now + durationConfig.ms).toISOString();
            }

            insertData.push({
                key: keyString,
                expires_at: expiresAt,
                status: 'active',
                max_devices: 1
            });
        }

        const { data, error } = await supabaseClient
            .from('licenses')
            .insert(insertData)
            .select();

        if (error) throw error;

        showToast(`${quantity} chave(s) gerada(s) com sucesso!`, 'success');
        loadData();
    } catch (err) {
        console.error('Generation Error:', err);
        showToast(`Erro ao gerar chaves: ${err.message}`, 'error');
    } finally {
        generateKeysBtn.removeAttribute('disabled');
        generateKeysBtn.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Gerar';
    }
}

// Helper to generate uppercase hex string
function generateRandomHex(length = 6) {
    const chars = '0123456789ABCDEF';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

// Fetch all keys from Supabase
async function loadData() {
    if (!supabaseClient) return;

    refreshBtn.classList.add('fa-spin');
    
    try {
        // Fetch licenses
        const { data: keysData, error: keysError } = await supabaseClient
            .from('licenses')
            .select('*')
            .order('created_at', { ascending: false });

        if (keysError) throw keysError;
        allKeys = keysData || [];

        calculateMetrics();
        renderKeysTable();
    } catch (err) {
        console.error('Data Fetch Error:', err);
        showToast(`Erro ao carregar dados: ${err.message}`, 'error');
    } finally {
        refreshBtn.classList.remove('fa-spin');
    }
}

// Calculate Dashboard Metrics & Display Summary
function calculateMetrics() {
    const total = allKeys.length;
    let active = 0;
    let used = 0;
    let expired = 0;

    allKeys.forEach(k => {
        const status = getKeyStatus(k);
        if (status === 'active') active++;
        else if (status === 'used') used++;
        else if (status === 'expired') expired++;
    });

    statsSummary.textContent = `Total: ${total} | Ativas: ${active} | Em Uso: ${used} | Expiradas: ${expired}`;
}

// Get the actual computed status of a license key
function getKeyStatus(key) {
    if (key.status === 'revoked') return 'revoked';
    if (key.status === 'expired') return 'expired';
    if (key.expires_at && new Date(key.expires_at) < new Date()) return 'expired';
    if (key.device_id) return 'used';
    return 'active';
}

// Render Licenses list in table
function renderKeysTable() {
    keysTableBody.innerHTML = '';

    if (!supabaseClient) {
        keysTableBody.innerHTML = `
            <tr class="placeholder-row-tr">
                <td colspan="4" class="text-center placeholder-row">Configure o Supabase no menu superior para começar.</td>
            </tr>
        `;
        return;
    }

    const searchQuery = tableSearch.value.trim().toLowerCase();

    // Filter keys
    const filteredKeys = allKeys.filter(k => {
        const computedStatus = getKeyStatus(k);
        
        // Tab Filter
        if (activeFilter !== 'all' && computedStatus !== activeFilter) {
            return false;
        }

        // Search Filter
        if (searchQuery && !k.key.toLowerCase().includes(searchQuery)) {
            return false;
        }

        return true;
    });

    if (filteredKeys.length === 0) {
        keysTableBody.innerHTML = `
            <tr class="placeholder-row-tr">
                <td colspan="4" class="text-center placeholder-row">Nenhuma chave encontrada com os filtros aplicados.</td>
            </tr>
        `;
        return;
    }

    filteredKeys.forEach(k => {
        const computedStatus = getKeyStatus(k);
        const tr = document.createElement('tr');

        // Date formatting helper
        const formatDateTime = (dateStr) => {
            if (!dateStr) return '—';
            return new Date(dateStr).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short'
            });
        };

        const expiryDisplay = k.expires_at ? formatDateTime(k.expires_at) : 'Vitalícia';
        const deviceDisplay = k.device_id ? `<span title="${k.device_id}">${k.device_id.slice(0, 10)}...</span>` : '—';

        // Actions buttons
        const isRevoked = k.status === 'revoked';
        const revokeIcon = isRevoked ? 'fa-circle-check' : 'fa-ban';
        const revokeTitle = isRevoked ? 'Reativar Licença' : 'Revogar Licença';

        tr.innerHTML = `
            <td>
                <div class="key-name-wrapper">
                    <span class="status-dot ${computedStatus}" title="Status: ${computedStatus.toUpperCase()}"></span>
                    <span class="key-code-cell">${k.key}</span>
                </div>
            </td>
            <td>${expiryDisplay}</td>
            <td>${deviceDisplay}</td>
            <td class="text-right actions-cell">
                <button class="btn-table btn-table-copy" onclick="copyToClipboard('${k.key}')" title="Copiar Chave"><i class="fa-solid fa-copy"></i></button>
                <button class="btn-table btn-table-revoke" onclick="toggleRevokeKey('${k.id}', '${k.status}')" title="${revokeTitle}"><i class="fa-solid ${revokeIcon}"></i></button>
                <button class="btn-table btn-table-delete" onclick="deleteKey('${k.id}', '${k.key}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        keysTableBody.appendChild(tr);
    });
}

// Toggle Revocation Status of a Key
window.toggleRevokeKey = async function(id, currentStatus) {
    if (!supabaseClient) return;

    const newStatus = currentStatus === 'revoked' ? 'active' : 'revoked';
    const actionStr = newStatus === 'active' ? 'reativar' : 'revogar';

    try {
        const { error } = await supabaseClient
            .from('licenses')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) throw error;

        showToast(`Licença ${actionStr}da com sucesso!`, 'success');
        loadData();
    } catch (err) {
        console.error('Revoke Error:', err);
        showToast(`Erro ao alterar status da licença: ${err.message}`, 'error');
    }
};

// Delete key completely
window.deleteKey = async function(id, keyName) {
    if (!supabaseClient) return;

    const confirmed = confirm(`Deseja realmente EXCLUIR permanentemente a chave "${keyName}"?\nEsta ação apagará a licença do banco de dados.`);
    if (!confirmed) return;

    try {
        const { error } = await supabaseClient
            .from('licenses')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('Licença excluída com sucesso!', 'success');
        loadData();
    } catch (err) {
        console.error('Delete Error:', err);
        showToast(`Erro ao excluir licença: ${err.message}`, 'error');
    }
};
