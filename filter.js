 const FILTER_KEY = 'valentango_filter_pref';
        const THEME_KEY = 'valentango_theme_pref';
        const FAV_KEY = 'valentango_favorites';
        const PANE_KEY = 'valentango_pane_visible';
        const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const MUSIC_TYPES = ['trad', 'alt', 'both', 'live'];
        
        let currentFilters = ['all'];
        let favorites = [];
        let dynamicInstructors = [];

        function initSettings() {
            try {
                const savedFilters = localStorage.getItem(FILTER_KEY);
                if (savedFilters) currentFilters = JSON.parse(savedFilters);
                const savedFavs = localStorage.getItem(FAV_KEY);
                if (savedFavs) favorites = JSON.parse(savedFavs);
                
                const isLight = localStorage.getItem(THEME_KEY) === 'true';
                if (isLight) {
                    document.body.classList.add('light-mode');
                    updateThemeButton(true);
                }

                const paneVisible = localStorage.getItem(PANE_KEY) === 'true';
                applyPaneState(paneVisible);

                if (typeof events !== 'undefined') {
                    const instructorSet = new Set();
                    events.forEach(e => {
                        if (e.type === 'class' && e.instructor && e.instructor !== "Various") {
                            instructorSet.add(e.instructor);
                        }
                    });
                    dynamicInstructors = Array.from(instructorSet).sort();
                    renderInstructorFilters();
                }

            } catch (e) { console.warn("Storage access denied", e); }
        }

        function renderInstructorFilters() {
            const container = document.getElementById('instructor-filters');
            if (!container) return;
            container.innerHTML = '';
            dynamicInstructors.forEach(ins => {
                const btn = document.createElement('button');
                btn.onclick = () => setFilter(ins);
                btn.id = `filter-${ins.replace(/\s+/g, '_')}`;
                btn.className = 'filter-chip';
                btn.innerText = ins;
                container.appendChild(btn);
            });
        }

        function toggleFilterPane() {
            const wrapper = document.getElementById('filter-wrapper');
            const isCurrentlyHidden = wrapper.classList.contains('collapsed');
            applyPaneState(isCurrentlyHidden);
            try { localStorage.setItem(PANE_KEY, isCurrentlyHidden); } catch (e) {}
        }

        function applyPaneState(isVisible) {
            const wrapper = document.getElementById('filter-wrapper');
            const btnText = document.getElementById('pane-toggle-text');
            const arrow = document.getElementById('pane-arrow');
            const searchInput = document.getElementById('search-input');
            
            if (isVisible) {
                wrapper.classList.remove('collapsed');
                btnText.innerText = "Hide Filters";
                arrow.classList.remove('collapsed-icon');
            } else {
                wrapper.classList.add('collapsed');
                let activeCount = currentFilters.filter(f => f !== 'all' && f !== 'fav').length;
                if (searchInput && searchInput.value.trim().length > 0) activeCount++;
                btnText.innerText = activeCount > 0 ? `Show Filters ( ${activeCount} )` : "Show Filters";
                arrow.classList.add('collapsed-icon');
            }
            setTimeout(updateHeaderHeight, 350);
        }

        function updateHeaderHeight() {
            const header = document.querySelector('.main-header');
            if (header) {
                const height = header.offsetHeight;
                document.documentElement.style.setProperty('--header-height', height + 'px');
            }
        }

        function toggleFavorite(id) {
            const index = favorites.indexOf(id);
            if (index > -1) favorites.splice(index, 1);
            else favorites.push(id);
            try { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); } catch (e) {}
            renderEvents();
        }

        function toggleTheme() {
            const isLight = document.body.classList.toggle('light-mode');
            updateThemeButton(isLight);
            try { localStorage.setItem(THEME_KEY, isLight); } catch (e) {}
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
                if (currentFilters.includes(filter)) currentFilters = currentFilters.filter(f => f !== filter);
                else currentFilters.push(filter);
                if (currentFilters.length === 0) currentFilters = ['all'];
            }
            try { localStorage.setItem(FILTER_KEY, JSON.stringify(currentFilters)); } catch (e) {}
            
            const wrapper = document.getElementById('filter-wrapper');
            if (wrapper && wrapper.classList.contains('collapsed')) {
                applyPaneState(false);
            }

            updateFilterUI();
            renderEvents();
        }

        function clearSearch() {
            const input = document.getElementById('search-input');
            input.value = '';
            renderEvents();
            input.focus();
        }

        function clearFilters() { 
            const hadFav = currentFilters.includes('fav');
            currentFilters = hadFav ? ['all', 'fav'] : ['all'];
            setFilter('all'); 
        }

        function updateFilterUI() {
            document.querySelectorAll('.filter-chip').forEach(chip => {
                let filterId = chip.id.replace('filter-', '');
                filterId = filterId.replace(/_/g, ' ');
                if (currentFilters.includes(filterId)) chip.classList.add('active');
                else chip.classList.remove('active');
            });

            const clearFiltersBtn = document.getElementById('clear-filters');
            const hasActiveFunctionalFilters = currentFilters.some(f => f !== 'all' && f !== 'fav');
            if (hasActiveFunctionalFilters) clearFiltersBtn.classList.remove('hidden');
            else clearFiltersBtn.classList.add('hidden');
        }

        function renderEvents() {
            const list = document.getElementById('event-list');
            const searchInput = document.getElementById('search-input');
            const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
            
            if (!list || typeof events === 'undefined') return;

            list.innerHTML = '';
            let lastDate = ""; 

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
                if (currentFilters.includes('fav') && !favorites.includes(e.id)) return false;
                const matchesSearch = !searchTerm || e.title.toLowerCase().includes(searchTerm) || 
                    (e.instructor || "").toLowerCase().includes(searchTerm) || (e.description || "").toLowerCase().includes(searchTerm);
                if (!matchesSearch) return false;
                
                if (currentFilters.length === 1 && currentFilters.includes('all')) return true;

                const activeFilters = currentFilters.filter(f => f !== 'fav');
                if (activeFilters.length === 0 || (activeFilters.length === 1 && activeFilters.includes('all'))) return true;

                const selectedDays = activeFilters.filter(f => DAYS.includes(f));
                const selectedInstructors = activeFilters.filter(f => dynamicInstructors.includes(f));
                const selectedMusic = activeFilters.filter(f => MUSIC_TYPES.includes(f));
                const selectedCats = activeFilters.filter(f => !DAYS.includes(f) && !dynamicInstructors.includes(f) && !MUSIC_TYPES.includes(f) && f !== 'all');

                if (selectedDays.length > 0) {
                    const eventDay = new Date(e.start).toLocaleDateString([], { weekday: 'long' }).toLowerCase();
                    if (!selectedDays.includes(eventDay)) return false;
                }
                if (selectedInstructors.length > 0 && !selectedInstructors.includes(e.instructor)) return false;
                
                // Logic for Music Type Filtering
                if (selectedMusic.length > 0) {
                    const matchesMusic = selectedMusic.some(f => {
                        if (f === 'live') return e.live === 'yes';
                        return e.music === f;
                    });
                    if (!matchesMusic) return false;
                }

                if (selectedCats.length > 0) {
                    const matchesCat = selectedCats.some(f => {
                        if (f === 'milonga') return e.type === 'milonga';
                        if (f === 'class') return e.type === 'class';
                        return (e.level || "").toLowerCase() === f.toLowerCase();
                    });
                    if (!matchesCat) return false;
                }
                return true;
            }).sort((a,b) => new Date(a.start) - new Date(b.start));

            updateFilterUI();

            if (filtered.length === 0) {
                list.innerHTML = `<div class="text-center py-20 text-[var(--text-secondary)] opacity-50">No matches found.</div>`;
                return;
            }

            filtered.forEach(e => {
                const dateObj = new Date(e.start);
                const fullDate = dateObj.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

                if (fullDate !== lastDate) {
                    const divider = document.createElement('div');
                    divider.className = 'py-2 mt-2 border-b border-[var(--border-color)] mb-4';
                    divider.innerHTML = `<h2 class="text-xs font-black uppercase tracking-[0.2em] opacity-50">${fullDate}</h2>`;
                    list.appendChild(divider);
                    lastDate = fullDate;
                }

                const isFav = favorites.includes(e.id);
                const card = document.createElement('div');
                card.className = 'event-card';

                // Format music type for display
                let musicDisplay = "";
                if (e.type === 'milonga' && e.music) {
                    const label = e.music === 'both' ? 'Mixed' : e.music.charAt(0).toUpperCase() + e.music.slice(1);
                    const live = e.live === 'yes' ? ' + LIVE' : '';
                    musicDisplay = ` <span class="text-[10px] opacity-30">|</span><span class="room-pill">${label}${live}</span>`;
                }

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex flex-col gap-1">
                            <span class="text-[11px] font-black tracking-tight ${e.type === 'milonga' ? 'milonga-indicator' : 'class-indicator'}">${formatTime(e.start)}—${formatTime(e.end)} </span>
                        </div>
                        <div class="flex flex-col items-end gap-1">
                            <div onclick="toggleFavorite(${e.id})" class="fav-star ${isFav ? 'text-amber-400' : 'text-zinc-600 opacity-30'}">★</div>
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider opacity-70" style="color: var(--text-secondary)">${e.level === 'advCouples' ? 'ADV COUPLES' : e.level || ''}</span>
                        ${e.level ? '<span class="text-[10px] opacity-30">|</span>' : ''}
                        <span class="room-pill">${e.room}</span>
                        <span class="text-[10px] opacity-30">|</span>
                        <span class="price-text">${e.price}</span>
                        <span class="text-[10px] opacity-30">|</span>
                        <div class="flex items-center">
                            <span class="text-[10px] font-bold uppercase tracking-wider instructor-link" style="color: var(--accent-purple)">${linkifyInstructor(e.instructor)}</span>
                        </div>
                            ${musicDisplay}
                    </div>
                    <h3 class="text-lg sm:text-xl font-bold leading-tight mb-1" style="color: var(--text-primary)">${e.title}</h3>
                    <p class="text-[13px] leading-snug font-normal opacity-90" style="color: var(--text-secondary)">${e.description}</p>
                `;
                list.appendChild(card);
            });
        }

        window.addEventListener('load', () => {
            initSettings();
            updateFilterUI();
            renderEvents();
            updateHeaderHeight();
        });
        window.addEventListener('resize', updateHeaderHeight);