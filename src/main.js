import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import CryptoJS from 'crypto-js';

// --- State & Constants ---
const MASTER_KEY = 'Servyre2026';
const STORAGE_KEY = 'servyre_inventory_secure_v2'; // New key for data change

let inventory = [];
let catalogs = {
    brands: ['Dell', 'HP', 'Lenovo', 'Apple'],
    modelsByBrand: {
        'Dell': ['Latitude 3420', 'Latitude 5430', 'OptiPlex 7090'],
        'HP': ['EliteDesk 800', 'ProBook 450'],
        'Lenovo': ['ThinkPad X1'],
        'Apple': ['MacBook Pro M2']
    },
    locations: ['Corporativo', 'Naucalpan', 'Campo', 'Tultitlán']
};

// --- DOM References ---
const inventoryBody = document.getElementById('inventoryBody');
const inventoryForm = document.getElementById('inventoryForm');
const modalOverlay = document.getElementById('modalOverlay');
const detailModalOverlay = document.getElementById('detailModalOverlay');
const detailModalBody = document.getElementById('detailModalBody');
const catalogModalOverlay = document.getElementById('catalogModalOverlay');
const searchInput = document.getElementById('searchInput');

// Catalog UI
const brandInput = document.getElementById('brand');
const modelInput = document.getElementById('model');
const locationInput = document.getElementById('location');
const catalogBrandSelect = document.getElementById('catalogBrandSelect');
const brandList = document.getElementById('brandList');
const modelList = document.getElementById('modelList');
const locationList = document.getElementById('locationList');
const modelManagementSection = document.getElementById('modelManagementSection');

// --- Core Logic ---
const encrypt = (data) => CryptoJS.AES.encrypt(JSON.stringify(data), MASTER_KEY).toString();
const decrypt = (ciphertext) => {
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, MASTER_KEY);
        const dec = bytes.toString(CryptoJS.enc.Utf8);
        return dec ? JSON.parse(dec) : null;
    } catch (e) { return null; }
};

const saveToStorage = () => {
    localStorage.setItem(STORAGE_KEY, encrypt({ inventory, catalogs }));
};

const initialize = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        const dec = decrypt(stored);
        if (dec) {
            inventory = dec.inventory || [];
            catalogs = dec.catalogs || catalogs;
        }
    }
    renderTable();
    syncFormSelects();
    if (window.lucide) window.lucide.createIcons();
};

// --- UI Rendering ---
const renderTable = (data = inventory) => {
    inventoryBody.innerHTML = '';
    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'fade-in';
        tr.style.cursor = 'pointer';

        const sc = item.status === 'Activo' ? 'badge-green' : item.status === 'Mantenimiento' ? 'badge-orange' : 'badge-blue';

        tr.innerHTML = `
            <td><span class="badge badge-blue">${item.location}</span></td>
            <td>${item.department}</td>
            <td><code>${item.resguardo || 'N/A'}</code></td>
            <td>
                <div style="font-weight: 600;">${item.fullName}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">${item.position}</div>
            </td>
            <td>${item.deviceType}</td>
            <td><div>${item.brand}</div><div style="font-size: 0.75rem; color: var(--text-dim);">${item.model}</div></td>
            <td><code>${item.serialNumber}</code></td>
            <td>${item.pcName || 'S/N'}</td>
            <td><span class="badge ${sc}">${item.status}</span></td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-secondary btn-icon edit-btn" title="Editar">✏️</button>
                    <button class="btn btn-secondary btn-icon delete-btn" style="color:var(--danger)" title="Eliminar">🗑️</button>
                </div>
            </td>
        `;

        tr.onclick = (e) => {
            if (e.target.closest('.btn-group')) return;
            viewAssetDetail(item.id);
        };

        tr.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); openMainForm(item.id); };
        tr.querySelector('.delete-btn').onclick = (e) => {
            e.stopPropagation();
            if (confirm('¿Eliminar registro?')) {
                inventory = inventory.filter(i => i.id !== item.id);
                saveToStorage(); renderTable();
            }
        };

        inventoryBody.appendChild(tr);
    });
};

const viewAssetDetail = (id) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;

    const initials = item.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    detailModalBody.innerHTML = `
        <div class="asset-passport fade-in" style="display: block;">
            <div style="display: grid; grid-template-columns: 200px 1fr; gap: 2rem; margin-bottom: 2rem;">
                <div class="passport-sidebar">
                    <div class="user-avatar">${initials}</div>
                    <h3 style="margin-bottom: 0.5rem;">${item.fullName}</h3>
                    <p style="font-size: 0.8rem; color: var(--text-dim); margin-bottom: 1rem;">${item.position}</p>
                    <span class="badge ${item.status === 'Activo' ? 'badge-green' : 'badge-orange'}">${item.status}</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                    <div class="info-card"><label>Ubicación</label><div class="value">${item.location}</div></div>
                    <div class="info-card"><label>Departamento</label><div class="value">${item.department}</div></div>
                    <div class="info-card"><label>Dirección</label><div class="value">${item.address || '-'}</div></div>
                    <div class="info-card"><label>Extensión</label><div class="value">${item.extension || '-'}</div></div>
                    <div class="info-card"><label>Correo</label><div class="value">${item.email}</div></div>
                    <div class="info-card"><label>Resguardo</label><div class="value">${item.resguardo || '-'}</div></div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
                <div class="info-card"><label>Equipo</label><div class="value">${item.deviceType}</div></div>
                <div class="info-card"><label>Marca</label><div class="value">${item.brand}</div></div>
                <div class="info-card"><label>Modelo</label><div class="value">${item.model}</div></div>
                <div class="info-card"><label>Serie</label><div class="value">${item.serialNumber}</div></div>
                
                <div class="info-card"><label>SO</label><div class="value">${item.os || '-'}</div></div>
                <div class="info-card"><label>Nombre PC</label><div class="value">${item.pcName || '-'}</div></div>
                <div class="info-card"><label>Procesador</label><div class="value">${item.processor || '-'}</div></div>
                <div class="info-card"><label>Mouse Externo</label><div class="value">${item.mouseExternal ? 'Sí' : 'No'}</div></div>

                <div class="info-card"><label>RAM</label><div class="value">${item.ram} GB</div></div>
                <div class="info-card"><label>Disco Duro</label><div class="value">${item.storageCapacity} GB ${item.storageType}</div></div>
                <div class="info-card full-width" style="grid-column: span 2;">
                    <label>Notas</label>
                    <div class="value" style="font-size: 0.85rem; font-weight: 400; color: var(--text-dim); line-height: 1.4;">${item.notes || 'Sin observaciones.'}</div>
                </div>
            </div>
        </div>
    `;

    detailModalOverlay.classList.add('active');

    document.getElementById('editFromDetailBtn').onclick = () => {
        detailModalOverlay.classList.remove('active');
        openMainForm(item.id);
    };

    document.getElementById('printDetailBtn').onclick = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        doc.setFillColor(30, 41, 59); doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text("FICHA DE ACTIVO - SERVYRE", 15, 25);

        const rows = [
            ["Ubicación", item.location], ["Dirección", item.address], ["Departamento", item.department],
            ["Puesto", item.position], ["Asignado a", item.fullName], ["Correo", item.email],
            ["Resguardo", item.resguardo], ["Equipo", item.deviceType], ["Marca/Modelo", item.brand + " " + item.model],
            ["N° Serie", item.serialNumber], ["Nombre PC", item.pcName], ["Procesador", item.processor],
            ["RAM", item.ram + " GB"], ["Disco", item.storageCapacity + " GB"], ["Mouse Externo", item.mouseExternal ? "Sí" : "No"]
        ];

        doc.autoTable({ startY: 50, head: [['Concepto', 'Información']], body: rows, theme: 'striped' });
        doc.save(`Servyre_${item.serialNumber}.pdf`);
    };
};

// --- Form & Catalog Helpers ---
const syncFormSelects = () => {
    // Populate Location Selects
    locationInput.innerHTML = '<option value="">Sel. Ubicación...</option>';
    catalogs.locations.forEach(l => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = l;
        locationInput.appendChild(opt);
    });

    // Populate Brand Selects
    const currentBrand = brandInput.value;
    brandInput.innerHTML = '<option value="">Sel. Marca...</option>';
    catalogBrandSelect.innerHTML = '<option value="">Sel. Marca...</option>';
    catalogs.brands.forEach(b => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = b;
        brandInput.appendChild(opt.cloneNode(true));
        catalogBrandSelect.appendChild(opt);
    });
    brandInput.value = currentBrand;

    renderCatalogItems();
};

const renderCatalogItems = () => {
    // Brand List
    brandList.innerHTML = '';
    catalogs.brands.forEach(b => {
        const li = document.createElement('li');
        li.className = 'catalog-item';
        li.innerHTML = `<span>${b}</span> <button class="delete-btn" onclick="window.delCatItem('brands', '${b}')">🗑️</button>`;
        brandList.appendChild(li);
    });

    // Location List
    locationList.innerHTML = '';
    catalogs.locations.forEach(l => {
        const li = document.createElement('li');
        li.className = 'catalog-item';
        li.innerHTML = `<span>${l}</span> <button class="delete-btn" onclick="window.delCatItem('locations', '${l}')">🗑️</button>`;
        locationList.appendChild(li);
    });

    // Model List (Based on Selection)
    const currentBrand = catalogBrandSelect.value;
    if (currentBrand) {
        modelManagementSection.style.display = 'block';
        modelList.innerHTML = '';
        const models = catalogs.modelsByBrand[currentBrand] || [];
        models.forEach(m => {
            const li = document.createElement('li');
            li.className = 'catalog-item';
            li.innerHTML = `<span>${m}</span> <button class="delete-btn" onclick="window.delCatItem('models', '${m}', '${currentBrand}')">🗑️</button>`;
            modelList.appendChild(li);
        });
    } else {
        modelManagementSection.style.display = 'none';
    }
};

window.delCatItem = (type, val, parent = null) => {
    if (!confirm(`¿Eliminar ${val}?`)) return;
    if (type === 'brands') {
        catalogs.brands = catalogs.brands.filter(b => b !== val);
        delete catalogs.modelsByBrand[val];
    } else if (type === 'locations') {
        catalogs.locations = catalogs.locations.filter(l => l !== val);
    } else if (type === 'models' && parent) {
        catalogs.modelsByBrand[parent] = catalogs.modelsByBrand[parent].filter(m => m !== val);
    }
    saveToStorage(); syncFormSelects();
};

const openMainForm = (id = null) => {
    inventoryForm.reset();
    document.getElementById('itemId').value = id || '';
    document.getElementById('modalTitle').textContent = id ? 'Editar Registro' : 'Nuevo Registro de IT';

    if (id) {
        const item = inventory.find(i => i.id === id);
        if (item) {
            locationInput.value = item.location;
            document.getElementById('address').value = item.address || '';
            document.getElementById('department').value = item.department;
            document.getElementById('position').value = item.position;
            document.getElementById('fullName').value = item.fullName;
            document.getElementById('email').value = item.email;
            document.getElementById('extension').value = item.extension || '';
            document.getElementById('resguardo').value = item.resguardo || '';
            document.getElementById('deviceType').value = item.deviceType;
            brandInput.value = item.brand;
            updateModelsDropdown();
            modelInput.value = item.model;
            document.getElementById('serialNumber').value = item.serialNumber;
            document.getElementById('os').value = item.os || '';
            document.getElementById('pcName').value = item.pcName || '';
            document.getElementById('processor').value = item.processor || '';
            document.getElementById('ram').value = item.ram;
            document.getElementById('storageCapacity').value = item.storageCapacity;
            document.getElementById('status').value = item.status;
            document.getElementById('mouseExternal').checked = item.mouseExternal;
            document.getElementById('notes').value = item.notes || '';
        }
    } else {
        modelInput.disabled = true;
    }
    modalOverlay.classList.add('active');
};

const updateModelsDropdown = () => {
    const brand = brandInput.value;
    modelInput.innerHTML = '<option value="">Sel. Modelo...</option>';
    if (brand) {
        modelInput.disabled = false;
        (catalogs.modelsByBrand[brand] || []).forEach(m => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = m;
            modelInput.appendChild(opt);
        });
    } else {
        modelInput.disabled = true;
    }
};

// --- Events ---
brandInput.onchange = updateModelsDropdown;
catalogBrandSelect.onchange = renderCatalogItems;

inventoryForm.onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('itemId').value;
    const itemData = {
        id: id || Date.now().toString(),
        location: locationInput.value,
        address: document.getElementById('address').value,
        department: document.getElementById('department').value,
        position: document.getElementById('position').value,
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        extension: document.getElementById('extension').value,
        resguardo: document.getElementById('resguardo').value,
        deviceType: document.getElementById('deviceType').value,
        brand: brandInput.value,
        model: modelInput.value,
        serialNumber: document.getElementById('serialNumber').value,
        os: document.getElementById('os').value,
        pcName: document.getElementById('pcName').value,
        processor: document.getElementById('processor').value,
        ram: parseInt(document.getElementById('ram').value),
        storageType: 'SSD', // Fixed for simplicity or add selector if needed
        storageCapacity: parseInt(document.getElementById('storageCapacity').value),
        status: document.getElementById('status').value,
        mouseExternal: document.getElementById('mouseExternal').checked,
        notes: document.getElementById('notes').value
    };

    if (id) {
        const idx = inventory.findIndex(i => i.id === id);
        inventory[idx] = itemData;
    } else {
        inventory.unshift(itemData);
    }
    saveToStorage(); renderTable();
    modalOverlay.classList.remove('active');
};

searchInput.oninput = (e) => {
    const q = e.target.value.toLowerCase();
    renderTable(inventory.filter(i =>
        i.fullName.toLowerCase().includes(q) ||
        i.serialNumber.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q)
    ));
};

// Catalog Triggers
document.getElementById('addBrandBtn').onclick = () => {
    const val = document.getElementById('newBrandInput').value.trim();
    if (val && !catalogs.brands.includes(val)) {
        catalogs.brands.push(val); catalogs.modelsByBrand[val] = [];
        document.getElementById('newBrandInput').value = '';
        saveToStorage(); syncFormSelects();
    }
};
document.getElementById('addModelBtn').onclick = () => {
    const b = catalogBrandSelect.value;
    const m = document.getElementById('newModelInput').value.trim();
    if (b && m && !catalogs.modelsByBrand[b].includes(m)) {
        catalogs.modelsByBrand[b].push(m);
        document.getElementById('newModelInput').value = '';
        saveToStorage(); syncFormSelects();
    }
};
document.getElementById('addLocationBtn').onclick = () => {
    const val = document.getElementById('newLocationInput').value.trim();
    if (val && !catalogs.locations.includes(val)) {
        catalogs.locations.push(val);
        document.getElementById('newLocationInput').value = '';
        saveToStorage(); syncFormSelects();
    }
};

// Tab Switching
window.switchCat = (id) => {
    document.querySelectorAll('.cat-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.catalog-tab').forEach(t => t.classList.remove('active-tab'));
    document.getElementById(`cat-${id}`).style.display = 'block';
    event.currentTarget.classList.add('active-tab');
};

// Global Buttons
document.getElementById('addItemBtn').onclick = () => openMainForm();
document.getElementById('manageCatalogsBtn').onclick = () => { syncFormSelects(); catalogModalOverlay.classList.add('active'); };
document.getElementById('closeModal').onclick = () => modalOverlay.classList.remove('active');
document.getElementById('cancelBtn').onclick = () => modalOverlay.classList.remove('active');
document.getElementById('closeDetailModal').onclick = () => detailModalOverlay.classList.remove('active');
document.getElementById('closeCatalogModal').onclick = () => catalogModalOverlay.classList.remove('active');
document.getElementById('finishCatalogBtn').onclick = () => catalogModalOverlay.classList.remove('active');

window.onclick = (e) => {
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active');
};

// BOOT
initialize();
console.log('Servyre Pro Loaded - Full Fields & Location Catalogs Ready.');
