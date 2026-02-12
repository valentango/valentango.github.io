const FILTER_KEY = 'valentango_filter_pref';
const THEME_KEY = 'valentango_theme_pref';
const FAV_KEY = 'valentango_favorites';
const PANE_KEY = 'valentango_pane_visible';
const HIDE_PAST_KEY = 'valentango_hide_past';

const ALL_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
let DAYS = []; // Will be rotated based on today
const MUSIC_TYPES = ['trad', 'alt', 'both', 'live'];
const LEVELS = ['beg', 'int', 'adv', 'advCouples'];

let currentFilters = ['all'];
let favorites = [];
let dynamicInstructors = [];
let hidePast = true;

function initSettings() {
    try {
        const savedFilters = localStorage.getItem(FILTER_KEY);
        if (savedFilters) currentFilters = JSON.parse(savedFilters);
        
        const savedFavs = localStorage.getItem(FAV_KEY);
        if (savedFavs) favorites = JSON.parse(savedFavs);

        const savedHidePast = localStorage.getItem(HIDE_PAST_KEY);
        hidePast = savedHidePast === null ? true : savedHidePast === 'true';
        
        const isLight = localStorage.getItem(THEME_KEY) === 'true';
        if (isLight) {
            document.body.classList.add('light-mode');
            updateThemeButton(true);
        }

        const paneVisible = localStorage.getItem(PANE_KEY) === 'true';
        applyPaneState(paneVisible);

        // 1. Rotate days starting today
        const today = new Date().getDay();
        DAYS = [...ALL_DAYS.slice(today), ...ALL_DAYS.slice(0, today)];
        renderDayFilters();

        if (typeof events !== 'undefined') {
            updateDynamicData();
        }
    } catch (e) { 
        console.warn("Storage access denied", e); 
    }
}

function updateDynamicData() {
    const now = new Date();
    const instructorSet = new Set();
    
    events.forEach(e => {
        // Only include instructors if the event hasn't passed OR if hidePast is off
        const isPast = new Date(e.end) < now;
        if (hidePast && isPast) return;

        if (e.type === 'class' && e.instructor && e.instructor !== "Various") {
            instructorSet.add(e.instructor);
        }
    });
    dynamicInstructors = Array.from(instructorSet).sort();
    renderInstructorFilters();
}

function renderDayFilters() {
    const container = document.getElementById('day-filters');
    if (!container) return;
    container.innerHTML = DAYS.map(day => `
        <button onclick="setFilter('${day}')" id="filter-${day}" class="filter-chip">
            ${day.charAt(0).toUpperCase()}${day.slice(1, 2)}
        </button>
    `).join('');
}

function renderInstructorFilters() {
    const container = document.getElementById('instructor-filters');
    if (!container) return;
    
    container.innerHTML = dynamicInstructors.map(ins => `
        <button onclick="setFilter('${ins}')" 
                id="filter-${ins.replace(/\s+/g, '_')}" 
                class="filter-chip">
            ${ins}
        </button>
    `).join('');
}

function toggleHidePast() {
    hidePast = !hidePast;
    saveStorage(HIDE_PAST_KEY, hidePast);
    updateDynamicData();
    renderEvents();
}

function toggleFilterPane() {
    const wrapper = document.getElementById('filter-wrapper');
    const isCurrentlyHidden = wrapper.classList.contains('collapsed');
    applyPaneState(isCurrentlyHidden);
    saveStorage(PANE_KEY, isCurrentlyHidden);
}

function applyPaneState(isVisible) {
    const wrapper = document.getElementById('filter-wrapper');
    const btnText = document.getElementById('pane-toggle-text');
    const arrow = document.getElementById('pane-arrow');
    const searchInput = document.getElementById('search-input');
    
    if (!wrapper || !btnText) return;

    if (isVisible) {
        wrapper.classList.remove('collapsed');
        btnText.innerText = "Hide Filters";
        if (arrow) arrow.classList.remove('collapsed-icon');
    } else {
        wrapper.classList.add('collapsed');
        const activeCount = currentFilters.filter(f => f !== 'all' && f !== 'fav').length + 
                           (searchInput?.value.trim().length > 0 ? 1 : 0);
        
        btnText.innerText = activeCount > 0 ? `Show Filters ( ${activeCount} )` : "Show Filters";
        if (arrow) arrow.classList.add('collapsed-icon');
    }
    setTimeout(updateHeaderHeight, 350);
}

function updateHeaderHeight() {
    const header = document.querySelector('.main-header');
    if (header) {
        document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
    }
}

function toggleFavorite(id) {
    const index = favorites.indexOf(id);
    if (index > -1) favorites.splice(index, 1);
    else favorites.push(id);
    
    saveStorage(FAV_KEY, JSON.stringify(favorites));
    renderEvents();
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    updateThemeButton(isLight);
    saveStorage(THEME_KEY, isLight);
}

function updateThemeButton(isLight) {
    const btn = document.getElementById('theme-btn');
    if (btn) btn.innerText = isLight ? "Dark Mode" : "Light Mode";
}

function formatTime(iso) { 
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(' ', ''); 
}

function setFilter(filter) {
    if (filter === 'all') {
        currentFilters = ['all'];
    } else {
        currentFilters = currentFilters.filter(f => f !== 'all');
        if (currentFilters.includes(filter)) {
            currentFilters = currentFilters.filter(f => f !== filter);
        } else {
            currentFilters.push(filter);

            const isLevel = LEVELS.includes(filter);
            const isInstructor = dynamicInstructors.includes(filter);
            if (isLevel || isInstructor) {
                currentFilters = currentFilters.filter(f => f !== 'class');
            }

            const isMusic = MUSIC_TYPES.includes(filter);
            if (isMusic) {
                currentFilters = currentFilters.filter(f => f !== 'milonga');
            }
        }
        if (currentFilters.length === 0) currentFilters = ['all'];
    }
    
    saveStorage(FILTER_KEY, JSON.stringify(currentFilters));
    
    const wrapper = document.getElementById('filter-wrapper');
    if (wrapper?.classList.contains('collapsed')) {
        applyPaneState(false);
    }

    updateFilterUI();
    renderEvents();
}

function clearSearch() {
    const input = document.getElementById('search-input');
    if (input) {
        input.value = '';
        input.focus();
        renderEvents();
    }
}

function clearFilters() { 
    const hadFav = currentFilters.includes('fav');
    currentFilters = hadFav ? ['all', 'fav'] : ['all'];
    setFilter('all'); 
}

function updateFilterUI() {
    document.querySelectorAll('.filter-chip').forEach(chip => {
        if (chip.id === 'toggle-past') {
            chip.classList.toggle('active', hidePast);
            return;
        }
        const filterId = chip.id.replace('filter-', '').replace(/_/g, ' ');
        chip.classList.toggle('active', currentFilters.includes(filterId));
    });

    const clearFiltersBtn = document.getElementById('clear-filters');
    const hasActive = currentFilters.some(f => f !== 'all' && f !== 'fav');
    clearFiltersBtn?.classList.toggle('hidden', !hasActive);

    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    clearSearchBtn?.classList.toggle('hidden', !searchInput?.value.trim());
}

function renderEvents() {
    const list = document.getElementById('event-list');
    const searchInput = document.getElementById('search-input');
    const countDisplay = document.getElementById('search-count');
    const searchTerm = searchInput?.value.toLowerCase().trim() || '';
    const now = new Date();
    
    if (!list || typeof events === 'undefined') return;

    const linkifyInstructor = (instructorStr) => {
        if (!instructorStr || typeof nameToUrl === 'undefined') return instructorStr;
        let finalStr = instructorStr;
        const sortedNames = Object.keys(nameToUrl).sort((a, b) => b.length - a.length);
        
        sortedNames.forEach(name => {
            if (finalStr.includes(name) && !finalStr.includes(`>${name}</a>`)) {
                finalStr = finalStr.replace(name, `<a href="${nameToUrl[name]}" target="_blank">${name}</a>`);
            }
        });
        return finalStr;
    };

    const filtered = events.filter(e => {
        // 0. Hide Past Filter
        if (hidePast && new Date(e.end) < now) return false;

        // 1. Favorites Filter
        if (currentFilters.includes('fav') && !favorites.includes(e.id)) return false;
        
        const matchesSearch = !searchTerm || 
            e.title.toLowerCase().includes(searchTerm) || 
            (e.instructor || "").toLowerCase().includes(searchTerm) || 
            (e.description || "").toLowerCase().includes(searchTerm);
        if (!matchesSearch) return false;
        
        const activeFilters = currentFilters.filter(f => f !== 'fav' && f !== 'all');
        if (activeFilters.length === 0) return true;

        const selectedDays = activeFilters.filter(f => ALL_DAYS.includes(f));
        const selectedInstructors = activeFilters.filter(f => dynamicInstructors.includes(f));
        const selectedMusic = activeFilters.filter(f => MUSIC_TYPES.includes(f));
        const selectedCats = activeFilters.filter(f => !ALL_DAYS.includes(f) && !dynamicInstructors.includes(f) && !MUSIC_TYPES.includes(f));

        if (selectedDays.length > 0) {
            const eventDay = new Date(e.start).toLocaleDateString([], { weekday: 'long' }).toLowerCase();
            if (!selectedDays.includes(eventDay)) return false;
        }

        const hasClassFilters = selectedInstructors.length > 0 || selectedCats.includes('beg') || selectedCats.includes('int') || selectedCats.includes('adv') || selectedCats.includes('advCouples') || selectedCats.includes('class');
        const hasMilongaFilters = selectedMusic.length > 0 || selectedCats.includes('milonga');

        if (e.type === 'class') {
            if (hasMilongaFilters && !hasClassFilters) return false;
            if (selectedInstructors.length > 0 && !selectedInstructors.includes(e.instructor)) return false;
            if (selectedCats.length > 0) {
                const classCats = selectedCats.filter(c => c === 'class' || LEVELS.includes(c));
                if (classCats.length > 0) {
                    const matchesCat = classCats.some(f => f === 'class' || (e.level || "").toLowerCase() === f.toLowerCase());
                    if (!matchesCat) return false;
                }
            }
        }

        if (e.type === 'milonga') {
            if (hasClassFilters && !hasMilongaFilters) return false;
            if (selectedMusic.length > 0) {
                const matchesMusic = selectedMusic.some(f => f === 'live' ? e.live === 'yes' : e.music === f);
                if (!matchesMusic) return false;
            }
        }

        return true;
    }).sort((a,b) => new Date(a.start) - new Date(b.start));

    if (countDisplay) {
        countDisplay.innerText = filtered.length > 0 ? `${filtered.length} events` : '0 events';
    }

    updateFilterUI();

    if (filtered.length === 0) {
        list.innerHTML = `<div class="text-center py-20 text-[var(--text-secondary)] opacity-50">No matches found.</div>`;
        return;
    }

    let html = '';
    let lastDate = ""; 

    filtered.forEach(e => {
        const dateObj = new Date(e.start);
        const fullDate = dateObj.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

        if (fullDate !== lastDate) {
            html += `
                <div class="py-2 mt-2 border-b border-[var(--border-color)] mb-4">
                    <h2 class="text-xs font-black uppercase tracking-[0.2em] opacity-50">${fullDate}</h2>
                </div>`;
            lastDate = fullDate;
        }

        const isFav = favorites.includes(e.id);
        let musicDisplay = "";
        if (e.type === 'milonga' && e.music) {
            const label = e.music === 'both' ? 'Mixed' : e.music.charAt(0).toUpperCase() + e.music.slice(1);
            const live = e.live === 'yes' ? ' + LIVE' : '';
            musicDisplay = ` <span class="text-[10px] opacity-30">|</span><span class="room-pill">${label}${live}</span>`;
        }

        html += `
            <div class="event-card">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex flex-col gap-1">
                        <span class="text-[11px] font-black tracking-tight ${e.type === 'milonga' ? 'milonga-indicator' : 'class-indicator'}">
                            ${formatTime(e.start)}—${formatTime(e.end)}
                        </span>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <div onclick="toggleFavorite(${e.id})" class="fav-star ${isFav ? 'text-amber-400' : 'text-zinc-600 opacity-30'}">★</div>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider opacity-70" style="color: var(--text-secondary)">
                        ${e.level === 'advCouples' ? 'ADV COUPLES' : e.level || ''}
                    </span>
                    ${e.level ? '<span class="text-[10px] opacity-30">|</span>' : ''}
                    <span class="room-pill">${e.room}</span>
                    <span class="text-[10px] opacity-30">|</span>
                    <span class="price-text">${e.price}</span>
                    <span class="text-[10px] opacity-30">|</span>
                    <div class="flex items-center">
                        <span class="text-[10px] font-bold uppercase tracking-wider instructor-link" style="color: var(--accent-purple)">
                            ${linkifyInstructor(e.instructor)}
                        </span>
                    </div>
                    ${musicDisplay}
                </div>
                <h3 class="text-lg sm:text-xl font-bold leading-tight mb-1" style="color: var(--text-primary)">${e.title}</h3>
                <p class="text-[13px] leading-snug font-normal opacity-90" style="color: var(--text-secondary)">${e.description}</p>
            </div>`;
    });
    list.innerHTML = html;
}

function saveStorage(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
}

window.addEventListener('load', () => {
    initSettings();
    updateFilterUI();
    renderEvents();
    updateHeaderHeight();
});
window.addEventListener('resize', updateHeaderHeight);