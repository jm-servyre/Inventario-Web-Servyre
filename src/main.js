import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import CryptoJS from 'crypto-js';

// --- CONFIGURATION & STATE ---
const MASTER_KEY = 'Servyre2026';
const STORAGE_KEY = 'servyre_v2_core_db'; // New robust storage key

let inventory = [];
let catalogs = {
    brands: ['Dell', 'HP', 'Lenovo', 'Apple', 'Microsoft'],
    modelsByBrand: {
        'Dell': ['Latitude 3420', 'Latitude 5430', 'OptiPlex 7090', 'Precision 3581'],
        'HP': ['EliteDesk 800', 'ProBook 450', 'ZBook Firefly', 'EliteBook 840'],
        'Lenovo': ['ThinkPad X1', 'ThinkCentre M70', 'Legion 5 Pro'],
        'Apple': ['MacBook Pro M2', 'MacBook Air M3', 'iMac 24"'],
        'Microsoft': ['Surface Pro 9', 'Surface Laptop 5']
    },
    locations: ['Corporativo', 'Naucalpan', 'Campo', 'Sede Sur', 'Guadalajara']
};

// --- DOM ELEMENTS ---
const inventoryBody = document.getElementById('inventoryBody');
const inventoryForm = document.getElementById('inventoryForm');
const modalOverlay = document.getElementById('modalOverlay');
const detailModalOverlay = document.getElementById('detailModalOverlay');
const detailModalBody = document.getElementById('detailModalBody');
const catalogModalOverlay = document.getElementById('catalogModalOverlay');
const searchInput = document.getElementById('searchInput');

// Dynamic UI
const totalAssetsEl = document.getElementById('totalAssets');
const activeLocationsEl = document.getElementById('activeLocations');

// Form/Catalog Controls
const brandInput = document.getElementById('brand');
const modelInput = document.getElementById('model');
const locationInput = document.getElementById('location');
const catalogBrandSelect = document.getElementById('catalogBrandSelect');
const brandList = document.getElementById('brandList');
const modelList = document.getElementById('modelList');
const locationList = document.getElementById('locationList');
const modelManagementSection = document.getElementById('modelManagementSection');
const importInput = document.getElementById('importInput');

// --- SECURITY & DATA ---
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
    updateStats();
};

const loadData = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        const dec = decrypt(stored);
        if (dec) {
            inventory = dec.inventory || [];
            catalogs = dec.catalogs || catalogs;
        }
    }
    renderTable();
    updateStats();
    syncFormSelects();
};

const updateStats = () => {
    totalAssetsEl.textContent = inventory.length;
    activeLocationsEl.textContent = catalogs.locations.length;
};

// --- CORE UI RENDERING ---
const renderTable = (data = inventory) => {
    inventoryBody.innerHTML = '';
    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'fade-in';
        tr.style.cursor = 'pointer';

        const sc = item.status === 'Activo' ? 'badge-green' : item.status === 'Mantenimiento' ? 'badge-orange' : 'badge-danger';

        tr.innerHTML = `
            <td><span class="badge badge-blue">${item.location}</span></td>
            <td>${item.department}</td>
            <td><code>${item.resguardo || '-'}</code></td>
            <td>
                <div style="font-weight: 700; color: var(--text);">${item.fullName}</div>
                <div style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase;">${item.position}</div>
            </td>
            <td><span style="font-weight: 500;">${item.deviceType}</span></td>
            <td>
                <div style="font-weight: 600;">${item.brand}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">${item.model}</div>
            </td>
            <td><code>${item.serialNumber}</code></td>
            <td>${item.pcName || '-'}</td>
            <td><span class="badge ${sc}">${item.status}</span></td>
            <td>
                <div class="btn-group-glass">
                    <button class="glass-btn btn-row-edit" title="Editar"><i data-lucide="edit-2" style="width:14px"></i></button>
                    <button class="glass-btn btn-row-delete" style="color:var(--danger)" title="Eliminar"><i data-lucide="trash-2" style="width:14px"></i></button>
                </div>
            </td>
        `;

        // Row Click -> View Detail
        tr.onclick = (e) => {
            if (e.target.closest('.btn-group-glass')) return;
            viewAssetDetail(item.id);
        };

        // Button Logic
        tr.querySelector('.btn-row-edit').onclick = (e) => { e.stopPropagation(); openEditForm(item.id); };
        tr.querySelector('.btn-row-delete').onclick = (e) => {
            e.stopPropagation();
            if (confirm(`¿Está seguro de eliminar el activo con serie ${item.serialNumber}?`)) {
                inventory = inventory.filter(i => i.id !== item.id);
                saveToStorage(); renderTable();
            }
        };

        inventoryBody.appendChild(tr);
    });
    if (window.lucide) window.lucide.createIcons();
};

const viewAssetDetail = (id) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;

    const initials = item.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    detailModalBody.innerHTML = `
        <div class="asset-passport-premium animate__animated animate__zoomIn">
            <div class="user-profile-card">
                <div class="user-avatar-premium">${initials}</div>
                <h2 style="font-size: 1.8rem;">${item.fullName}</h2>
                <p style="color: var(--primary); font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">${item.position}</p>
                <div style="margin-top: 1.5rem;">
                    <span class="badge ${item.status === 'Activo' ? 'badge-green' : 'badge-orange'}" style="font-size: 0.9rem; padding: 0.5rem 1.5rem;">${item.status}</span>
                </div>
                <div style="margin-top: 2rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 12px; font-size: 0.9rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem;">
                        <span style="color:var(--text-dim)">Ubicación</span>
                        <span style="font-weight:600">${item.location}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:var(--text-dim)">Departamento</span>
                        <span style="font-weight:600">${item.department}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-grid-v2" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
                <div class="info-card"><label>S/N Serial</label><div class="value">${item.serialNumber}</div></div>
                <div class="info-card"><label>Resguardo N°</label><div class="value">${item.resguardo || 'Pendiente'}</div></div>
                
                <div class="info-card" style="grid-column: span 2;">
                    <label>Hardware Principal</label>
                    <div class="value" style="display: flex; gap: 1rem; align-items: center;">
                        <span style="color: var(--primary)">${item.deviceType}</span>
                        <span>${item.brand} ${item.model}</span>
                    </div>
                </div>

                <div class="info-card"><label>RAM Instalada</label><div class="value">${item.ram} GB</div><div class="spec-bar-container"><div class="spec-bar" style="width: ${(item.ram / 64) * 100}%"></div></div></div>
                <div class="info-card"><label>Disco Duro</label><div class="value">${item.storageCapacity} GB SSD</div><div class="spec-bar-container"><div class="spec-bar" style="width: ${(item.storageCapacity / 2048) * 100}%; background: var(--secondary)"></div></div></div>

                <div class="info-card"><label>Software / PC</label><div class="value">${item.pcName || 'S/N'} (${item.os || 'Windows'})</div></div>
                <div class="info-card"><label>Procesador</label><div class="value">${item.processor || 'Desconocido'}</div></div>

                <div class="info-card" style="grid-column: span 2;">
                    <label>Observaciones del Activo</label>
                    <div class="value" style="font-size: 0.85rem; font-weight: 400; color: var(--text-dim); line-height: 1.6;">${item.notes || 'No se han registrado incidentes ni notas especiales para este resguardo.'}</div>
                </div>
            </div>
        </div>
    `;

    detailModalOverlay.classList.add('active');

    // Button Listeners in Detail
    document.getElementById('editFromDetailBtn').onclick = () => {
        detailModalOverlay.classList.remove('active');
        openEditForm(item.id);
    };

    document.getElementById('printDetailBtn').onclick = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text("FICHA DE RESGUARDO IT", 15, 25);

        const dataRows = [
            ["ID Interno", item.id], ["Ubicación", item.location], ["Dirección", item.address || "N/A"],
            ["Departamento", item.department], ["Puesto", item.position], ["Usuario Asignado", item.fullName],
            ["Correo Electrónico", item.email], ["Número de Resguardo", item.resguardo || "No Asignado"],
            ["Tipo de Equipo", item.deviceType], ["Marca", item.brand], ["Modelo", item.model],
            ["Número de Serie", item.serialNumber], ["RAM", item.ram + " GB"], ["Capacidad Disco", item.storageCapacity + " GB"],
            ["Nombre del PC", item.pcName || "N/A"], ["Sistema Operativo", item.os || "N/A"], ["Procesador", item.processor || "N/A"]
        ];

        doc.autoTable({
            startY: 50,
            head: [['Concepto', 'Descripción de Activo']],
            body: dataRows,
            theme: 'grid',
            headStyles: { fillStyle: '#6366f1' },
            styles: { fontSize: 9 }
        });

        doc.save(`Ficha_IT_${item.serialNumber}.pdf`);
    };
};

// --- FORM LOGIC ---
const openEditForm = (id = null) => {
    inventoryForm.reset();
    document.getElementById('itemId').value = id || '';
    document.getElementById('modalTitle').textContent = id ? 'Editar Registro Activo' : 'Nuevo Registro de Inventario';

    syncFormSelects();

    if (id) {
        const i = inventory.find(item => item.id === id);
        if (i) {
            locationInput.value = i.location;
            document.getElementById('address').value = i.address || '';
            document.getElementById('department').value = i.department;
            document.getElementById('position').value = i.position;
            document.getElementById('fullName').value = i.fullName;
            document.getElementById('email').value = i.email;
            document.getElementById('extension').value = i.extension || '';
            document.getElementById('resguardo').value = i.resguardo || '';
            document.getElementById('deviceType').value = i.deviceType;
            brandInput.value = i.brand;
            updateModelsDropdown();
            modelInput.value = i.model;
            document.getElementById('serialNumber').value = i.serialNumber;
            document.getElementById('os').value = i.os || '';
            document.getElementById('pcName').value = i.pcName || '';
            document.getElementById('processor').value = i.processor || '';
            document.getElementById('ram').value = i.ram;
            document.getElementById('storageCapacity').value = i.storageCapacity;
            document.getElementById('status').value = i.status;
            document.getElementById('mouseExternal').checked = i.mouseExternal;
            document.getElementById('notes').value = i.notes || '';
        }
    } else {
        modelInput.disabled = true;
    }
    modalOverlay.classList.add('active');
};

const updateModelsDropdown = () => {
    const brand = brandInput.value;
    modelInput.innerHTML = '<option value="">Desplegar modelos...</option>';
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

const syncFormSelects = () => {
    // Locations
    locationInput.innerHTML = '<option value="">Sel. Ubicación...</option>';
    catalogs.locations.forEach(l => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = l;
        locationInput.appendChild(opt);
    });

    // Brands
    const currentB = brandInput.value;
    brandInput.innerHTML = '<option value="">Sel. Marca...</option>';
    catalogBrandSelect.innerHTML = '<option value="">Marca para modelos...</option>';
    catalogs.brands.forEach(b => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = b;
        brandInput.appendChild(opt.cloneNode(true));
        catalogBrandSelect.appendChild(opt);
    });
    brandInput.value = currentB;

    renderCatalogItems();
};

const renderCatalogItems = () => {
    // Brand List with delete
    brandList.innerHTML = '';
    catalogs.brands.forEach(b => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${b}</span> <button class="close-btn" style="font-size:1.2rem; color:var(--danger)" onclick="window.delCatItem('brands', '${b}')">&times;</button>`;
        brandList.appendChild(li);
    });

    // Location List
    locationList.innerHTML = '';
    catalogs.locations.forEach(l => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${l}</span> <button class="close-btn" style="font-size:1.2rem; color:var(--danger)" onclick="window.delCatItem('locations', '${l}')">&times;</button>`;
        locationList.appendChild(li);
    });

    // Models
    const selB = catalogBrandSelect.value;
    if (selB) {
        modelManagementSection.style.display = 'block';
        modelList.innerHTML = '';
        (catalogs.modelsByBrand[selB] || []).forEach(m => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${m}</span> <button class="close-btn" style="font-size:1.2rem; color:var(--danger)" onclick="window.delCatItem('models', '${m}', '${selB}')">&times;</button>`;
            modelList.appendChild(li);
        });
    } else {
        modelManagementSection.style.display = 'none';
    }
};

window.delCatItem = (type, val, parent = null) => {
    if (!confirm(`¿Eliminar ${val} del catálogo? Esto no borrará registros existentes.`)) return;
    if (type === 'brands') {
        catalogs.brands = catalogs.brands.filter(x => x !== val);
        delete catalogs.modelsByBrand[val];
    } else if (type === 'locations') {
        catalogs.locations = catalogs.locations.filter(x => x !== val);
    } else if (type === 'models' && parent) {
        catalogs.modelsByBrand[parent] = catalogs.modelsByBrand[parent].filter(x => x !== val);
    }
    saveToStorage(); syncFormSelects();
};

// --- DATA IMPORT / EXPORT ---
document.getElementById('exportBackupBtn').onclick = () => {
    const dataStr = JSON.stringify({ inventory, catalogs }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Resguardo_IT_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
};

document.getElementById('importDataBtn').onclick = () => importInput.click();

importInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if (imported.inventory && imported.catalogs) {
                    inventory = imported.inventory;
                    catalogs = imported.catalogs;
                    saveToStorage();
                    location.reload();
                    alert('Base de datos restaurada correctamente.');
                }
            } catch (err) { alert('Error al procesar el archivo JSON.'); }
        };
        reader.readAsText(file);
    } else {
        // Excel Import
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);

            if (confirm(`¿Desea importar ${json.length} registros desde Excel?`)) {
                json.forEach(row => {
                    inventory.unshift({
                        id: Date.now().toString() + Math.random(),
                        location: row['Ubicación'] || 'Corporativo',
                        department: row['Departamento'] || 'General',
                        fullName: row['Usuario'] || 'N/A',
                        serialNumber: row['Serie'] || 'N/A',
                        brand: row['Marca'] || '',
                        model: row['Modelo'] || '',
                        deviceType: row['Equipo'] || 'Laptop',
                        ram: parseInt(row['RAM']) || 8,
                        storageCapacity: parseInt(row['Disco']) || 256,
                        status: 'Activo'
                    });
                });
                saveToStorage(); renderTable();
            }
        };
        reader.readAsArrayBuffer(file);
    }
};

// --- EVENTS ---
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
        i.location.toLowerCase().includes(q) ||
        i.department.toLowerCase().includes(q)
    ));
};

// Global Actions
document.getElementById('addItemBtn').onclick = () => openEditForm();
document.getElementById('manageCatalogsBtn').onclick = () => { syncFormSelects(); catalogModalOverlay.classList.add('active'); };

document.getElementById('closeModal').onclick = () => modalOverlay.classList.remove('active');
document.getElementById('cancelBtn').onclick = () => modalOverlay.classList.remove('active');
document.getElementById('closeDetailModal').onclick = () => detailModalOverlay.classList.remove('active');
document.getElementById('closeCatalogModal').onclick = () => catalogModalOverlay.classList.remove('active');
document.getElementById('finishCatalogBtn').onclick = () => catalogModalOverlay.classList.remove('active');

// Add Catalog Items
document.getElementById('addBrandBtn').onclick = () => {
    const v = document.getElementById('newBrandInput').value.trim();
    if (v && !catalogs.brands.includes(v)) {
        catalogs.brands.push(v); catalogs.modelsByBrand[v] = [];
        document.getElementById('newBrandInput').value = '';
        saveToStorage(); syncFormSelects();
    }
};

document.getElementById('addModelBtn').onclick = () => {
    const b = catalogBrandSelect.value;
    const v = document.getElementById('newModelInput').value.trim();
    if (b && v && !catalogs.modelsByBrand[b].includes(v)) {
        catalogs.modelsByBrand[b].push(v);
        document.getElementById('newModelInput').value = '';
        saveToStorage(); syncFormSelects();
    }
};

document.getElementById('addLocationBtn').onclick = () => {
    const v = document.getElementById('newLocationInput').value.trim();
    if (v && !catalogs.locations.includes(v)) {
        catalogs.locations.push(v);
        document.getElementById('newLocationInput').value = '';
        saveToStorage(); syncFormSelects();
    }
};

window.switchCat = (id) => {
    document.querySelectorAll('.cat-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`cat-${id}`).style.display = 'block';
    event.currentTarget.classList.add('active');
};

window.onclick = (e) => {
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active');
};

// --- INITIALIZE ---
loadData();
console.log('Servyre IT Professional v2.0 - Advanced Data Management System Loaded.');
