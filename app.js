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

map.attributionControl.addAttribution('Country boundaries: Natural Earth');

// 详细底图按需加载：默认不用外部瓦片，保证本地国家点击功能稳定可用。
const tileUrls = [
    { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', opts: { subdomains: 'abcd', maxZoom: 20, attribution: '© OSM © CARTO' } },
    { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', opts: { maxZoom: 19, attribution: '© OpenStreetMap' } }
];

let tileLayer = null;
let baseMapEnabled = false;
let activeTileIndex = 0;
const mapToggle = document.getElementById('mapToggle');

mapToggle.addEventListener('click', function() {
    if (baseMapEnabled) {
        if (tileLayer) {
            map.removeLayer(tileLayer);
            tileLayer = null;
        }
        baseMapEnabled = false;
        activeTileIndex = 0;
        mapToggle.classList.remove('active');
        mapToggle.textContent = '🗺️ 详细底图';
        return;
    }

    baseMapEnabled = true;
    mapToggle.classList.add('active');
    mapToggle.textContent = '🗺️ 已开启';
    activeTileIndex = 0;
    tileLayer = createTileLayer(activeTileIndex);
    tileLayer.addTo(map);
    if (colorLayer) colorLayer.bringToFront();
});

function createTileLayer(index) {
    const source = tileUrls[index];
    const layer = L.tileLayer(source.url, source.opts);
    layer.on('load', function() {
        if (colorLayer) colorLayer.bringToFront();
        if (currentMarker) currentMarker.bringToFront();
    });
    layer.on('tileerror', function() {
        if (activeTileIndex >= tileUrls.length - 1) return;
        activeTileIndex++;
        map.removeLayer(layer);
        tileLayer = createTileLayer(activeTileIndex);
        tileLayer.addTo(map);
        if (colorLayer) colorLayer.bringToFront();
    });
    return layer;
}

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
let currentMarker = null;
let handledCountryClick = false;

map.on('click', function() {
    if (handledCountryClick) return;
    document.getElementById('hint').classList.add('hidden');
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = null;
    showNoData('海洋 / 无国家区域');
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
    const baikeUrl = `https://baike.baidu.com/item/${encodeURIComponent(d.cn)}`;
    const xhsSearchUrl = (keyword) =>
        `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(encodeURIComponent(keyword))}&source=web_explore_feed`;
    const xhsLink = (label, keyword, className) =>
        `<a class="${className}" href="${xhsSearchUrl(keyword)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    const infoLabel = (label) => xhsLink(label, `${d.cn} ${label}`, 'info-label xhs-link');
    let h = `
        <div class="panel-header">
            <div class="panel-flag">${d.flag}</div>
            <div class="panel-country">${xhsLink(d.cn, d.cn, 'panel-country-link xhs-link')}</div>
            <div class="panel-country-en">${d.en}</div>
            <div class="panel-status ${s.cls}">${s.txt} · ${s.label}</div>
            <a class="baike-link" href="${baikeUrl}" target="_blank" rel="noopener noreferrer">百度百科</a>
        </div>
        <div class="panel-body">
            <div class="info-row"><div class="info-icon">⏱️</div><div class="info-content">${infoLabel('可停留天数')}<div class="info-value highlight">${d.duration}</div></div></div>
            <div class="info-row"><div class="info-icon">💰</div><div class="info-content">${infoLabel('签证费用')}<div class="info-value">${d.fee}</div></div></div>
            <div class="info-row"><div class="info-icon">⏳</div><div class="info-content">${infoLabel('办理时长')}<div class="info-value">${d.process}</div></div></div>
            <div class="info-row"><div class="info-icon">📅</div><div class="info-content">${infoLabel('签证有效期')}<div class="info-value">${d.validity}</div></div></div>
            <div class="info-row"><div class="info-icon">📋</div><div class="info-content">${infoLabel('所需材料')}<div class="info-value">${d.requirements}</div></div></div>
        </div>`;
    if (d.tips && d.tips !== '—') {
        h += `<div class="panel-tip"><div class="panel-tip-title">💡 ${xhsLink('实用贴士', `${d.cn} 实用贴士`, 'panel-tip-link xhs-link')}</div><div class="panel-tip-text">${d.tips}</div></div>`;
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



// ========== 签证配色地图 v2 ==========

const GEOJSON_URLS = [
    'data/countries.geojson'
];

const POLICY_COLORS = {
    free:    { fill: '#34a853', stroke: '#2d9249', label: '免签' },
    arrival: { fill: '#fbbc04', stroke: '#e0a800', label: '落地签' },
    evisa:   { fill: '#4285f4', stroke: '#3367d6', label: '电子签' },
    visa:    { fill: '#ea4335', stroke: '#c5221f', label: '需签证' },
    home:    { fill: '#ff6d00', stroke: '#e65100', label: '本国' },
    none:    { fill: '#cccccc', stroke: '#aaaaaa', label: '无数据' }
};

const DEFAULT_COUNTRY_STYLE = {
    fillColor: '#f5f7fb',
    fillOpacity: 0.28,
    color: '#6b8fbd',
    weight: 0.8,
    opacity: 0.5
};

let colorLayer = null;
let colorEnabled = false;
let geoJsonCache = null;

// 英文名 -> ISO代码 映射（兜底）
const NAME_TO_CODE = {
    'China':'CN','Japan':'JP','South Korea':'KR','North Korea':'KP',
    'Mongolia':'MN','Thailand':'TH','Vietnam':'VN','Malaysia':'MY',
    'Singapore':'SG','Indonesia':'ID','Philippines':'PH','Myanmar':'MM',
    'Laos':'LA','Cambodia':'KH','Brunei':'BN','East Timor':'TL',
    'Pakistan':'PK','Bangladesh':'BD','India':'IN','Nepal':'NP',
    'Sri Lanka':'LK','Maldives':'MV','Bhutan':'BT','Afghanistan':'AF',
    'Iran':'IR','Iraq':'IQ','Saudi Arabia':'SA','United Arab Emirates':'AE',
    'Qatar':'QA','Kuwait':'KW','Bahrain':'BH','Oman':'OM',
    'Yemen':'YE','Jordan':'JO','Lebanon':'LB','Syria':'SY',
    'Israel':'IL','Turkey':'TR','Cyprus':'CY','Georgia':'GE',
    'Armenia':'AM','Azerbaijan':'AZ','Kazakhstan':'KZ','Uzbekistan':'UZ',
    'Kyrgyzstan':'KG','Tajikistan':'TJ','Turkmenistan':'TM',
    'Russia':'RU','Belarus':'BY','Ukraine':'UA','Poland':'PL',
    'Germany':'DE','France':'FR','Italy':'IT','Spain':'ES',
    'Portugal':'PT','United Kingdom':'GB','Ireland':'IE','Netherlands':'NL',
    'Belgium':'BE','Switzerland':'CH','Austria':'AT','Czech Republic':'CZ',
    'Czechia':'CZ','Slovakia':'SK','Hungary':'HU','Slovenia':'SI',
    'Croatia':'HR','Bosnia and Herzegovina':'BA','Serbia':'RS',
    'Montenegro':'ME','Albania':'AL','North Macedonia':'MK',
    'Romania':'RO','Bulgaria':'BG','Greece':'GR','Malta':'MT',
    'San Marino':'SM','Luxembourg':'LU','Iceland':'IS','Norway':'NO',
    'Sweden':'SE','Finland':'FI','Denmark':'DK','Estonia':'EE',
    'Latvia':'LV','Lithuania':'LT',
    'Egypt':'EG','Morocco':'MA','Tunisia':'TN','Algeria':'DZ',
    'Ethiopia':'ET','Djibouti':'DJ','Kenya':'KE','Uganda':'UG',
    'Tanzania':'TZ','Rwanda':'RW','Senegal':'SN','Angola':'AO',
    'Zambia':'ZM','Zimbabwe':'ZW','Mozambique':'MZ','Madagascar':'MG',
    'Mauritius':'MU','Seychelles':'SC','Comoros':'KM',
    'Botswana':'BW','South Africa':'ZA','Ghana':'GH',
    'Ivory Coast':'CI','Cape Verde':'CV','Mauritania':'MR',
    'Sao Tome and Principe':'ST','Gabon':'GA','Namibia':'NA',
    'Burundi':'BI','South Sudan':'SS','Malawi':'MW',
    'United States':'US','Canada':'CA','Mexico':'MX',
    'Guatemala':'GT','Honduras':'HN','El Salvador':'SV',
    'Nicaragua':'NI','Costa Rica':'CR','Panama':'PA','Cuba':'CU',
    'Dominican Republic':'DO','Barbados':'BB',
    'Antigua and Barbuda':'AG','Dominica':'DM','Grenada':'GD',
    'Bahamas':'BS','Brazil':'BR','Argentina':'AR','Chile':'CL',
    'Peru':'PE','Colombia':'CO','Venezuela':'VE','Ecuador':'EC',
    'Bolivia':'BO','Paraguay':'PY','Uruguay':'UY','Guyana':'GY',
    'Suriname':'SR','Haiti':'HT',
    'Australia':'AU','New Zealand':'NZ','Fiji':'FJ',
    'Papua New Guinea':'PG','Solomon Islands':'SB','Vanuatu':'VU',
    'Tonga':'TO','Samoa':'WS','Palau':'PW',
    'Taiwan':'TW','Hong Kong':'HK','Macau':'MO',
    'The Bahamas':'BS','United Republic of Tanzania':'TZ',
    'Democratic Republic of the Congo':'CD','Republic of the Congo':'CG',
    'eSwatini':'SZ','Swaziland':'SZ','Burkina Faso':'BF',
    'Guinea-Bissau':'GW','Sierra Leone':'SL','Liberia':'LR',
    'Gambia':'GM','Central African Republic':'CF','Chad':'TD',
    'Niger':'NE','Nigeria':'NG','Mali':'ML','Cameroon':'CM',
    'Equatorial Guinea':'GQ','Somalia':'SO','Eritrea':'ER',
    'Sudan':'SD','Libya':'LY','Palestine':'PS',
    'Antarctica':'AQ','Vatican':'VA','Vatican City':'VA',
    'Monaco':'MC','Andorra':'AD','Liechtenstein':'LI',
    'Belize':'BZ','Jamaica':'JM','Trinidad and Tobago':'TT',
    'Saint Kitts and Nevis':'KN','Saint Lucia':'LC',
    'Saint Vincent and the Grenadines':'VC',
    'São Tomé and Príncipe':'ST'
};

const colorToggle = document.getElementById('colorToggle');

colorToggle.addEventListener('click', function() {
    if (!colorLayer) return;

    colorEnabled = !colorEnabled;
    colorLayer.setStyle(getCountryStyle);
    colorToggle.classList.toggle('active', colorEnabled);
    colorToggle.textContent = colorEnabled ? '🎨 已开启' : '🎨 签证配色';
});

async function initCountryLayer() {
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');
    try {
        geoJsonCache = await loadGeoJson();
        let matched = 0;

        colorLayer = L.geoJSON(geoJsonCache, {
            bubblingMouseEvents: false,
            style: getCountryStyle,
            onEachFeature: function(feature, layer) {
                const code = getCountryCode(feature);
                const data = VISA_DATA[code];
                layer.on({
                    mouseover: function() {
                        layer.setStyle({ weight: colorEnabled ? 1.8 : 1.2, opacity: 0.95 });
                    },
                    mouseout: function() {
                        colorLayer.resetStyle(layer);
                    }
                });
                if (data) {
                    matched++;
                    const s = POLICY_COLORS[data.policy] || POLICY_COLORS.none;
                    layer.bindTooltip(`${data.flag} ${data.cn}：${s.label}${data.duration !== '—' ? ' '+data.duration : ''}`, {
                        sticky: true, className: 'country-tooltip'
                    });
                    layer.on('click', function(e) {
                        handledCountryClick = true;
                        setTimeout(() => { handledCountryClick = false; }, 0);
                        if (e.originalEvent) L.DomEvent.stop(e.originalEvent);
                        showVisaInfo(code);
                        if (currentMarker) map.removeLayer(currentMarker);
                        currentMarker = L.circleMarker(e.latlng, {
                            radius: 10, fillColor: '#4285f4', color: '#fff', weight: 3, fillOpacity: 0.9
                        }).addTo(map);
                        document.getElementById('hint').classList.add('hidden');
                    });
                } else {
                    const name = feature.properties.ADMIN || '';
                    layer.bindTooltip(`🌍 ${name}：暂无数据`, { sticky: true, className: 'country-tooltip' });
                    layer.on('click', function(e) {
                        handledCountryClick = true;
                        setTimeout(() => { handledCountryClick = false; }, 0);
                        if (e.originalEvent) L.DomEvent.stop(e.originalEvent);
                        if (currentMarker) map.removeLayer(currentMarker);
                        currentMarker = null;
                        showNoData(name || '暂无数据区域');
                        document.getElementById('hint').classList.add('hidden');
                    });
                }
            }
        }).addTo(map);

        colorToggle.title = `切换签证颜色地图：已匹配 ${matched} 个签证数据`;
        console.log('Local country layer ready:', matched + '/' + geoJsonCache.features.length, 'matched');
    } catch(err) {
        console.error('Country layer error:', err);
        showNoData('本地国家边界加载失败，请检查 data/countries.geojson');
    } finally {
        loading.classList.add('hidden');
    }
}

function getCountryStyle(feature) {
    if (!colorEnabled) return DEFAULT_COUNTRY_STYLE;
    const code = getCountryCode(feature);
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
}

// 从 GeoJSON feature 提取国家代码
function getCountryCode(feature) {
    const p = feature.properties || {};
    // 1. 直接取 ISO_A2
    let code = String(p.ISO_A2_EH || p.ISO_A2 || '').trim().toUpperCase();
    if (code && code !== '-1' && code !== '-99' && code.length === 2) return code;
    code = String(p.ISO_A2 || '').trim().toUpperCase();
    if (code && code !== '-1' && code !== '-99' && code.length === 2) return code;
    // 2. 用英文名查映射
    const name = p.ADMIN || p.name || p.NAME || '';
    if (NAME_TO_CODE[name]) return NAME_TO_CODE[name];
    // 3. 模糊匹配
    for (const [n, c] of Object.entries(NAME_TO_CODE)) {
        if (name.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(name.toLowerCase())) {
            return c;
        }
    }
    return '';
}

// 加载 GeoJSON
async function loadGeoJson() {
    for (const url of GEOJSON_URLS) {
        try {
            const resp = await fetch(url);
            if (!resp.ok) continue;
            const data = await resp.json();
            if (data.features && data.features.length > 100) {
                console.log('GeoJSON OK:', data.features.length, 'features from', url);
                return data;
            }
        } catch(e) {
            console.warn('GeoJSON failed:', url, e.message);
        }
    }
    throw new Error('GeoJSON加载失败，请检查网络');
}
initCountryLayer();
console.log("Map ready. Countries:", Object.keys(VISA_DATA).length);
