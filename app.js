// ==========================================
// 中国护照签证查询地图 - Leaflet 稳定版
// ==========================================

// 初始化地图
const map = L.map('map', {
    center: [30, 40],
    zoom: 3,
    minZoom: 2,
    maxZoom: 18,
    worldCopyJump: true,
    zoomControl: false
});

L.control.zoom({ position: 'bottomright' }).addTo(map);

// 瓦片源 - 尝试多个源，保证至少一个能用
const tileUrls = [
    { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', opts: { subdomains: 'abcd', maxZoom: 20, attribution: '© OSM © CARTO' } },
    { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', opts: { maxZoom: 19, attribution: '© OpenStreetMap' } }
];

let tileLayer = L.tileLayer(tileUrls[0].url, tileUrls[0].opts).addTo(map);

// ========== 在地图上添加中文国名标签 ==========
// 从 VISA_DATA 提取国家名，添加为永久标注
function addCountryLabels() {
    for (const [code, data] of Object.entries(VISA_DATA)) {
        if (data.policy === 'home') continue; // 跳过中国自己
        if (!data.lat || !data.lng) continue;

        const policyColor = {
            free: '#34a853',
            arrival: '#fbbc04',
            evisa: '#4285f4',
            visa: '#888',
            none: '#ccc'
        }[data.policy] || '#888';

        // 创建中文国家名标签
        const icon = L.divIcon({
            className: 'country-label',
            html: `<span style="
                font-size:11px;
                font-weight:500;
                color:#333;
                white-space:nowrap;
                text-shadow:1px 1px 2px #fff,-1px -1px 2px #fff,1px -1px 2px #fff,-1px 1px 2px #fff;
                cursor:pointer;
            ">${data.cn}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });

        L.marker([data.lat, data.lng], { icon: icon, interactive: false })
            .addTo(map);
    }
}

// 缩放级别 >= 3 时显示标签
map.on('zoomend', function() {
    const existing = document.querySelectorAll('.country-label');
    if (map.getZoom() >= 3 && existing.length === 0) {
        addCountryLabels();
    }
});

// 初始加载标签（zoom >= 3 时）
if (map.getZoom() >= 3) {
    setTimeout(addCountryLabels, 500);
}
// zoom 3 以下也加载，但延迟
setTimeout(addCountryLabels, 1000);

// ========== 点击识别国家 ==========
let isProcessing = false;
let currentMarker = null;

map.on('click', async function(e) {
    if (isProcessing) return;
    isProcessing = true;

    const loading = document.getElementById('loading');
    const hint = document.getElementById('hint');
    loading.classList.remove('hidden');
    hint.classList.add('hidden');

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    if (currentMarker) map.removeLayer(currentMarker);

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=3&accept-language=zh-CN,zh,en`;
        const resp = await fetch(url, { headers: { 'Accept-Language': 'zh-CN,zh,en' } });
        const data = await resp.json();

        let countryCode = null;
        if (data.address && data.address.country_code) {
            countryCode = data.address.country_code.toUpperCase();
        }

        if (countryCode && VISA_DATA[countryCode]) {
            currentMarker = L.circleMarker([lat, lng], {
                radius: 10, fillColor: '#4285f4', color: '#fff', weight: 3, fillOpacity: 0.9
            }).addTo(map);
            showVisaInfo(countryCode);
        } else {
            currentMarker = L.circleMarker([lat, lng], {
                radius: 7, fillColor: '#999', color: '#fff', weight: 2, fillOpacity: 0.7
            }).addTo(map);
            showNoData(data.display_name || '海洋 / 无国家区域');
        }
    } catch (err) {
        console.error('Geocoding error:', err);
        showNoData('网络识别失败，请重试');
    }

    loading.classList.add('hidden');
    isProcessing = false;
});

// ========== 签证面板 ==========
const POLICY = {
    free:    { label: '免签入境', cls: 'status-free', color: '#34a853', txt: '🎉 免签' },
    arrival: { label: '落地签证', cls: 'status-arrival', color: '#fbbc04', txt: '📋 落地签' },
    evisa:   { label: '电子签证', cls: 'status-evisa', color: '#4285f4', txt: '💻 电子签' },
    visa:    { label: '需要签证', cls: 'status-visa', color: '#ea4335', txt: '📄 需签证' },
    home:    { label: '本国',     cls: 'status-free', color: '#34a853', txt: '🏠 本国' },
    none:    { label: '无数据',   cls: 'status-none', color: '#999',   txt: '❓ 无数据' }
};

function showVisaInfo(code) {
    const d = VISA_DATA[code];
    const s = POLICY[d.policy] || POLICY.none;
    let h = `
        <div class="panel-header">
            <div class="panel-flag">${d.flag}</div>
            <div class="panel-country">${d.cn}</div>
            <div class="panel-country-en">${d.en}</div>
            <div class="panel-status ${s.cls}">${s.txt} · ${s.label}</div>
        </div>
        <div class="panel-body">
            <div class="info-row"><div class="info-icon">⏱️</div><div class="info-content"><div class="info-label">可停留天数</div><div class="info-value highlight">${d.duration}</div></div></div>
            <div class="info-row"><div class="info-icon">💰</div><div class="info-content"><div class="info-label">签证费用</div><div class="info-value">${d.fee}</div></div></div>
            <div class="info-row"><div class="info-icon">⏳</div><div class="info-content"><div class="info-label">办理时长</div><div class="info-value">${d.process}</div></div></div>
            <div class="info-row"><div class="info-icon">📅</div><div class="info-content"><div class="info-label">签证有效期</div><div class="info-value">${d.validity}</div></div></div>
            <div class="info-row"><div class="info-icon">📋</div><div class="info-content"><div class="info-label">所需材料</div><div class="info-value">${d.requirements}</div></div></div>
        </div>`;
    if (d.tips && d.tips !== '—') {
        h += `<div class="panel-tip"><div class="panel-tip-title">💡 实用贴士</div><div class="panel-tip-text">${d.tips}</div></div>`;
    }
    document.getElementById('panelContent').innerHTML = h;
    document.getElementById('panel').classList.remove('hidden');
}

function showNoData(name) {
    document.getElementById('panelContent').innerHTML = `
        <div class="panel-header">
            <div class="panel-flag">🌊</div>
            <div class="panel-country">${name}</div>
            <div class="panel-status status-none">❓ 无签证数据</div>
        </div>
        <div class="panel-body">
            <div class="info-row"><div class="info-icon">💡</div><div class="info-content"><div class="info-label">提示</div><div class="info-value">此处可能是海洋或无主权区域。请点击有国家领土的区域。</div></div></div>
        </div>`;
    document.getElementById('panel').classList.remove('hidden');
}

document.getElementById('panelClose').addEventListener('click', () => {
    document.getElementById('panel').classList.add('hidden');
    if (currentMarker) { map.removeLayer(currentMarker); currentMarker = null; }
});

// ========== 搜索 ==========
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', function() {
    const q = this.value.trim().toLowerCase();
    if (!q) { searchResults.classList.remove('active'); return; }

    const results = Object.entries(VISA_DATA).filter(([c, d]) =>
        d.cn.toLowerCase().includes(q) || d.en.toLowerCase().includes(q) || c.toLowerCase().includes(q)
    ).slice(0, 10);

    if (!results.length) {
        searchResults.innerHTML = '<div class="search-item"><span class="name">未找到</span></div>';
    } else {
        searchResults.innerHTML = results.map(([code, r]) => {
            const s = POLICY[r.policy] || POLICY.none;
            return `<div class="search-item" data-code="${code}" data-lat="${r.lat}" data-lng="${r.lng}">
                <span class="flag">${r.flag}</span>
                <span class="name">${r.cn} ${r.en}</span>
                <span class="badge" style="background:${s.color}20;color:${s.color}">${s.txt}</span>
            </div>`;
        }).join('');
    }
    searchResults.classList.add('active');
});

searchResults.addEventListener('click', function(e) {
    const item = e.target.closest('.search-item');
    if (!item || !item.dataset.code) return;
    const { code, lat, lng } = item.dataset;
    map.setView([+lat, +lng], 5);
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = L.circleMarker([+lat, +lng], {
        radius: 10, fillColor: '#4285f4', color: '#fff', weight: 3, fillOpacity: 0.9
    }).addTo(map);
    showVisaInfo(code);
    searchResults.classList.remove('active');
    searchInput.value = '';
    document.getElementById('hint').classList.add('hidden');
});

document.addEventListener('click', e => {
    if (!e.target.closest('.search-box')) searchResults.classList.remove('active');
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.getElementById('panel').classList.add('hidden');
        searchResults.classList.remove('active');
    }
});

map.once('click', () => document.getElementById('hint').classList.add('hidden'));

// ========== 签证配色地图 ==========

const GEOJSON_URLS = [
    'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
    'https://cdn.jsdelivr.net/npm/world-countries@5/world/countries.geojson'
];

const POLICY_COLORS = {
    free:    { fill: '#34a853', stroke: '#2d9249', label: '免签' },   // 绿色
    arrival: { fill: '#fbbc04', stroke: '#e0a800', label: '落地签' },  // 黄色
    evisa:   { fill: '#4285f4', stroke: '#3367d6', label: '电子签' },  // 蓝色
    visa:    { fill: '#ea4335', stroke: '#c5221f', label: '需签证' },  // 红色
    home:    { fill: '#ff6d00', stroke: '#e65100', label: '本国' },    // 橙色
    none:    { fill: '#9e9e9e', stroke: '#757575', label: '无数据' }   // 灰色
};

let colorLayer = null;
let colorEnabled = false;
let geoJsonCache = null;

const colorToggle = document.getElementById('colorToggle');

colorToggle.addEventListener('click', async function() {
    if (colorEnabled) {
        // 关闭颜色层
        if (colorLayer) {
            map.removeLayer(colorLayer);
            colorLayer = null;
        }
        colorEnabled = false;
        colorToggle.classList.remove('active');
        return;
    }

    // 开启颜色层
    colorToggle.textContent = '⏳ 加载中…';

    try {
        if (!geoJsonCache) {
            geoJsonCache = await loadGeoJson();
        }

        colorLayer = L.geoJSON(geoJsonCache, {
            style: function(feature) {
                const code = feature.properties.ISO_A2 || feature.properties.ISO_A3 || '';
                const data = VISA_DATA[code];
                const policy = data ? data.policy : 'none';
                const colors = POLICY_COLORS[policy] || POLICY_COLORS.none;
                return {
                    fillColor: colors.fill,
                    fillOpacity: 0.55,
                    color: colors.stroke,
                    weight: 1.2,
                    opacity: 0.9
                };
            },
            onEachFeature: function(feature, layer) {
                const code = feature.properties.ISO_A2 || feature.properties.ISO_A3 || '';
                const data = VISA_DATA[code];
                if (data) {
                    const s = POLICY_COLORS[data.policy] || POLICY_COLORS.none;
                    layer.bindTooltip(
                        `${data.flag} ${data.cn}：${s.label}${data.duration !== '—' ? ' ' + data.duration : ''}`,
                        { sticky: true, className: 'country-tooltip' }
                    );
                    layer.on('click', function(e) {
                        L.DomEvent.stopPropagation(e);
                        showVisaInfo(code);
                        if (currentMarker) map.removeLayer(currentMarker);
                        currentMarker = L.circleMarker(e.latlng, {
                            radius: 10, fillColor: '#4285f4', color: '#fff', weight: 3, fillOpacity: 0.9
                        }).addTo(map);
                        document.getElementById('hint').classList.add('hidden');
                    });
                }
            }
        }).addTo(map);

        colorEnabled = true;
        colorToggle.textContent = '🎨 已开启';
        colorToggle.classList.add('active');

    } catch(err) {
        console.error('GeoJSON load failed:', err);
        colorToggle.textContent = '❌ 加载失败';
        setTimeout(() => { colorToggle.textContent = '🎨 签证配色'; }, 2000);
    }
});

// 尝试多个URL加载GeoJSON
async function loadGeoJson() {
    for (const url of GEOJSON_URLS) {
        try {
            console.log('Trying:', url);
            const resp = await fetch(url);
            if (!resp.ok) continue;
            const data = await resp.json();
            if (data.features && data.features.length > 100) {
                console.log('Loaded GeoJSON:', data.features.length, 'features from', url);
                return data;
            }
        } catch(e) {
            console.warn('Failed:', url, e.message);
        }
    }
    throw new Error('所有 GeoJSON 源加载失败');
}
console.log("Map ready. Countries:", Object.keys(VISA_DATA).length);
