// Configurazione
const MY_RADIO = {
    name: "Marco Radio",
    url: "https://azuracast2.ithost.it:8070/radio.mp3",
    logo: "https://azuracast2.ithost.it/public/marcoradio/logo",
    genres: ["Pop", "Rock", "Dance"],
    mainGenre: "Vario",
    homepage: "https://azuracast2.ithost.it/public/marcoradio"
};

// Generi musicali disponibili
const MUSIC_GENRES = ["Pop", "Rock", "Dance", "Jazz", "Classical", "Hip Hop", "Electronic", "Reggae", "Blues", "Country"];

// Keywords per classificare genere da metadati (titolo/artista)
const GENRE_KEYWORDS = {
    "Dance": ["dance", "edm", "house", "techno", "remix", "club", "dj", "electronic dance", "trance", "dubstep"],
    "Pop": ["pop", "chart", "hits", "top", "mainstream"],
    "Rock": ["rock", "metal", "punk", "alternative", "grunge", "indie rock"],
    "Hip Hop": ["hip hop", "rap", "trap", "r&b", "urban"],
    "Jazz": ["jazz", "swing", "bebop", "smooth jazz"],
    "Classical": ["classical", "symphony", "orchestra", "concerto", "baroque", "opera"],
    "Electronic": ["electronic", "electro", "synth", "ambient", "downtempo"],
    "Reggae": ["reggae", "ska", "dub", "dancehall"],
    "Blues": ["blues", "soul", "rhythm"],
    "Country": ["country", "folk", "bluegrass", "americana"]
};

// Radio Browser API Configuration
const RADIO_BROWSER_API = 'https://de1.api.radio-browser.info/json'; // Proxy pubblico europeo
let discoveredRadios = []; // Radio scoperte online
let flowModeActive = false;
let flowModeTimer = null;

const POPULAR_RADIOS = [
    {
        name: "Radio Italia",
        url: "https://radioitalia.ice.infomaniak.ch/radioitalia.mp3",
        logo: "https://cdn-profiles.tunein.com/s24948/images/logog.png",
        genres: ["Pop"],
        mainGenre: "Pop"
    },
    {
        name: "RTL 102.5",
        url: "https://streamingv2.shoutcast.com/rtl-1025",
        logo: "https://cdn-profiles.tunein.com/s8100/images/logog.png",
        genres: ["Pop", "Dance"],
        mainGenre: "Pop"
    },
    {
        name: "Radio Deejay",
        url: "https://deejay-ice.stream.ouiopen.net/radiodeejay.mp3",
        logo: "https://cdn-profiles.tunein.com/s25066/images/logog.png",
        genres: ["Dance", "Pop"],
        mainGenre: "Dance"
    },
    {
        name: "RDS",
        url: "https://stream.rds.radio/audio/rds.mp3",
        logo: "https://cdn-profiles.tunein.com/s8101/images/logog.png",
        genres: ["Pop"],
        mainGenre: "Pop"
    },
    {
        name: "Radio 105",
        url: "https://icy.unitedradio.it/Radio105.mp3",
        logo: "https://cdn-profiles.tunein.com/s8099/images/logog.png",
        genres: ["Rock", "Pop"],
        mainGenre: "Rock"
    },
    {
        name: "Radio Monte Carlo",
        url: "https://icy.unitedradio.it/RMC.mp3",
        logo: "https://cdn-profiles.tunein.com/s24943/images/logog.png",
        genres: ["Pop", "Jazz"],
        mainGenre: "Pop"
    },
    {
        name: "Virgin Radio",
        url: "https://icy.unitedradio.it/Virgin.mp3",
        logo: "https://cdn-profiles.tunein.com/s8097/images/logog.png",
        genres: ["Rock"],
        mainGenre: "Rock"
    },
    {
        name: "Radio Capital",
        url: "https://streamcdnb14-4c4b867c89244861ac216426883d1ad0.msvdn.net/radiocapital/radiocapital/play1.m3u8",
        logo: "https://cdn-profiles.tunein.com/s25070/images/logog.png",
        genres: ["Rock"],
        mainGenre: "Rock"
    },
    {
        name: "Radio Classica",
        url: "https://stream.radioclassica.it/stream.mp3",
        logo: "https://cdn-profiles.tunein.com/s308053/images/logog.png",
        genres: ["Classical"],
        mainGenre: "Classical"
    },
    {
        name: "Radio Jazz",
        url: "https://jazz-wr11.ice.infomaniak.ch/jazz-wr11-128.mp3",
        logo: "https://cdn-profiles.tunein.com/s171943/images/logog.png",
        genres: ["Jazz"],
        mainGenre: "Jazz"
    }
];

// Stato dell'applicazione
let currentRadio = null;
let audio = new Audio();
let audioNext = new Audio(); // Secondo player per crossfade
let isPlaying = false;
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let likes = JSON.parse(localStorage.getItem('likes')) || {}; // {radioUrl: {likes: number, dislikes: number}}
let metadataInterval = null;
let currentGenreFilter = null;
let isCrossfading = false;

// Sistema Metadata-Based per Flow Mode
let metadataCheckInterval = null;
let currentTrackMetadata = { title: '', artist: '', genre: '' };
let previousTrackTitle = '';
let radioQueue = []; // Coda di radio preparate
let metadataSkipEnabled = false; // Attivo solo in Flow Mode
let recentlyPlayedRadios = []; // Ultime 10 radio per evitare ripetizioni
let brokenRadios = []; // Radio che non funzionano (errore stream)
let consecutiveErrors = 0; // Conta errori consecutivi per evitare loop infinito

// Jingle audio (segnaposto - suono di transizione)
const jingleAudio = createJingleAudio();

// Funzione per creare jingle segnaposto (beep breve e piacevole)
function createJingleAudio() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    return {
        play: function(callback) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Suono piacevole: due note rapide
            oscillator.frequency.value = 800; // Note Do
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);

            // Seconda nota
            setTimeout(() => {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();

                osc2.connect(gain2);
                gain2.connect(audioContext.destination);

                osc2.frequency.value = 1000; // Note Mi
                osc2.type = 'sine';

                gain2.gain.setValueAtTime(0, audioContext.currentTime);
                gain2.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
                gain2.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);

                osc2.start(audioContext.currentTime);
                osc2.stop(audioContext.currentTime + 0.2);

                if (callback) setTimeout(callback, 200);
            }, 150);
        }
    };
}

// Elementi DOM
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const volumeSlider = document.getElementById('volumeSlider');
const albumCover = document.getElementById('albumCover');
const radioName = document.getElementById('radioName');
const songInfo = document.getElementById('songInfo');
const playingAnimation = document.getElementById('playingAnimation');
const searchInput = document.getElementById('searchInput');

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    renderGenreChips();
    renderRadios();
    loadFavorites();
});

function initializeApp() {
    audio.volume = volumeSlider.value / 100;
    audio.preload = 'metadata'; // Cambiato da 'none' per precaricare

    // TRUCCO 1: Aggiungi attributo autoplay all'elemento audio
    audio.setAttribute('autoplay', '');
    audio.muted = false; // Assicurati che non sia muto

    // Gestisci Splash Screen
    const splashScreen = document.getElementById('splashScreen');
    const startBtn = document.getElementById('startMarcoRadioBtn');

    // TRUCCO 2: Prova autoplay immediato
    attemptAutoplay();

    // Fallback: se autoplay fallisce, mostra splash screen
    startBtn.addEventListener('click', () => {
        splashScreen.classList.add('hidden');
        setTimeout(() => {
            splashScreen.style.display = 'none';
        }, 500);
        playRadio(MY_RADIO);
    });

    // TRUCCO 3: Cattura qualsiasi interazione utente per avviare
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
    document.addEventListener('click', handleFirstInteraction, { once: true });

    // Configurazione per streaming continuo
    audio.addEventListener('loadstart', () => {
        console.log('Caricamento stream...');
    });

    audio.addEventListener('canplay', () => {
        console.log('Stream pronto per la riproduzione');
        // Reset contatore errori quando radio funziona
        consecutiveErrors = 0;
    });

    audio.addEventListener('error', (e) => {
        console.error('Errore audio:', e);

        // Incrementa contatore errori consecutivi
        consecutiveErrors++;

        // Marca radio corrente come non funzionante
        if (currentRadio && currentRadio.url) {
            brokenRadios.push(currentRadio.url);
            console.log(`❌ Radio marcata come non funzionante: ${currentRadio.name}`);
        }

        // PROTEZIONE ANTI-LOOP: Dopo 5 errori consecutivi, ferma Flow Mode
        if (consecutiveErrors >= 5) {
            console.error('🛑 Troppi errori consecutivi! Fermo Flow Mode.');
            songInfo.textContent = 'Troppe radio non disponibili. Flow Mode fermato.';
            stopFlowMode();
            stopPlayback();
            consecutiveErrors = 0;
            return;
        }

        // Se Flow Mode attivo e radio non funziona → skip automatico
        if (flowModeActive && discoveredRadios.length > 1) {
            console.log(`⚠️ Radio non funziona (errore ${consecutiveErrors}/5), skip automatico...`);
            songInfo.textContent = `Radio non disponibile (${consecutiveErrors}/5), cerco altra...`;

            // Skippa dopo 2 secondi
            setTimeout(() => {
                if (flowModeActive) {
                    playNextSuggestedRadio();
                }
            }, 2000);
        } else {
            songInfo.textContent = 'Errore durante il caricamento. Riprova.';
            stopPlayback();
            consecutiveErrors = 0;
        }
    });

    audio.addEventListener('ended', () => {
        // Per gli stream live, questo non dovrebbe accadere
        console.log('Stream terminato');
    });
}

function setupEventListeners() {
    // Play/Pause
    playBtn.addEventListener('click', togglePlayPause);

    // Volume
    volumeSlider.addEventListener('input', (e) => {
        audio.volume = e.target.value / 100;
        if (audioNext) audioNext.volume = e.target.value / 100;
    });

    // Like/Dislike
    document.getElementById('likeBtn').addEventListener('click', () => handleLike(true));
    document.getElementById('dislikeBtn').addEventListener('click', () => handleLike(false));

    // Next radio suggerito
    document.getElementById('nextRadioBtn').addEventListener('click', playNextSuggestedRadio);

    // Genre filter
    document.getElementById('clearGenreBtn').addEventListener('click', clearGenreFilter);

    // Metadata toggle
    document.getElementById('metadataCheckbox').addEventListener('change', (e) => {
        metadataSkipEnabled = e.target.checked;
        console.log(`Metadata auto-skip: ${metadataSkipEnabled ? 'ON' : 'OFF'}`);

        if (metadataSkipEnabled && flowModeActive) {
            startMetadataMonitoring();
        } else {
            stopMetadataMonitoring();
        }
    });

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });

    // Search
    searchInput.addEventListener('input', (e) => {
        filterRadios(e.target.value);
    });
}

function switchTab(tabName) {
    // Aggiorna tab attivi
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');

    // Carica contenuto se necessario
    if (tabName === 'favorites') {
        renderFavorites();
    }
}

function renderRadios() {
    // Render "La Mia Radio"
    const myRadioList = document.getElementById('myRadioList');
    myRadioList.innerHTML = createRadioItem(MY_RADIO, true);

    // Render radio popolari
    const popularRadioList = document.getElementById('popularRadioList');
    popularRadioList.innerHTML = POPULAR_RADIOS.map(radio =>
        createRadioItem(radio, false)
    ).join('');

    // Aggiungi event listeners
    document.querySelectorAll('.radio-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('favorite-btn')) {
                const radioData = JSON.parse(item.dataset.radio);
                selectRadio(radioData);
            }
        });
    });

    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const radioData = JSON.parse(btn.closest('.radio-item').dataset.radio);
            toggleFavorite(radioData);
        });
    });
}

function createRadioItem(radio, isMyRadio = false) {
    const isFavorited = favorites.some(fav => fav.url === radio.url);
    const starIcon = isFavorited ? '⭐' : '☆';
    const badge = isMyRadio ? '<span style="background: linear-gradient(135deg, #6c5ce7, #a29bfe); padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">🎙️ LA MIA RADIO</span>' : '';

    // Mostra generi o mainGenre
    const genreText = radio.mainGenre || (radio.genres ? radio.genres.join(', ') : 'Vario');

    return `
        <div class="radio-item" data-radio='${JSON.stringify(radio)}'>
            <img src="${radio.logo}" alt="${radio.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Crect fill=%22%231a1a2e%22 width=%2250%22 height=%2250%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2224%22 text-anchor=%22middle%22 dy=%22.3em%22%3E📻%3C/text%3E%3C/svg%3E'">
            <div class="radio-info">
                <h3>${radio.name} ${badge}</h3>
                <p>${genreText}</p>
            </div>
            <button class="favorite-btn ${isFavorited ? 'favorited' : ''}">${starIcon}</button>
        </div>
    `;
}

function selectRadio(radio, useCrossfade = false) {
    // Se è attiva la riproduzione e useCrossfade è true, usa crossfade
    if (useCrossfade && isPlaying && currentRadio && currentRadio.url !== radio.url) {
        crossfadeToRadio(radio);
        return;
    }

    currentRadio = radio;

    // Aggiorna UI
    document.querySelectorAll('.radio-item').forEach(item => {
        item.classList.remove('active');
    });

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    radioName.textContent = radio.name;
    albumCover.src = radio.logo;

    // Ferma riproduzione corrente
    if (isPlaying) {
        stopPlayback();
    }

    songInfo.textContent = 'Premi play per ascoltare';

    // Carica metadati
    loadMetadata(radio);

    // Mostra controlli like
    updateLikeUI();
}

function togglePlayPause() {
    if (!currentRadio) {
        alert('Seleziona prima una radio!');
        return;
    }

    if (isPlaying) {
        stopPlayback();
    } else {
        startPlayback();
    }
}

function startPlayback() {
    if (!currentRadio) return;

    songInfo.textContent = 'Connessione in corso...';

    // Imposta sorgente e avvia riproduzione
    audio.src = currentRadio.url;
    audio.load();

    audio.play()
        .then(() => {
            isPlaying = true;
            playIcon.textContent = '⏸';
            playingAnimation.classList.add('active');
            songInfo.textContent = 'In riproduzione...';

            // Avvia aggiornamento metadati
            startMetadataUpdates();

            // Mostra pulsante next
            updateNextButtonVisibility();
        })
        .catch(error => {
            console.error('Errore riproduzione:', error);
            songInfo.textContent = 'Errore. Verifica la connessione.';
            stopPlayback();
        });
}

function stopPlayback() {
    audio.pause();
    audio.src = '';
    isPlaying = false;
    playIcon.textContent = '▶';
    playingAnimation.classList.remove('active');

    if (metadataInterval) {
        clearInterval(metadataInterval);
        metadataInterval = null;
    }

    // Nascondi pulsante next
    updateNextButtonVisibility();
}

// Sistema metadati per AzuraCast
function loadMetadata(radio) {
    if (!radio.homepage) return;

    // Per AzuraCast, l'API dei metadati è disponibile
    const apiUrl = `${radio.homepage}/api/nowplaying`;

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            updateNowPlaying(data);
        })
        .catch(error => {
            console.log('Metadati non disponibili:', error);
            songInfo.textContent = `Ascoltando ${radio.name}`;
        });
}

function startMetadataUpdates() {
    if (!currentRadio || !currentRadio.homepage) return;

    // Aggiorna metadati ogni 10 secondi
    metadataInterval = setInterval(() => {
        loadMetadata(currentRadio);
    }, 10000);
}

function updateNowPlaying(data) {
    if (!data || !data.now_playing) return;

    const nowPlaying = data.now_playing;

    // Aggiorna info brano
    if (nowPlaying.song) {
        const title = nowPlaying.song.title || 'Titolo sconosciuto';
        const artist = nowPlaying.song.artist || 'Artista sconosciuto';
        songInfo.textContent = `${artist} - ${title}`;

        // Aggiorna copertina se disponibile
        if (nowPlaying.song.art) {
            albumCover.src = nowPlaying.song.art;
        }
    } else {
        songInfo.textContent = `Ascoltando ${currentRadio.name}`;
    }
}

// Sistema preferiti
function toggleFavorite(radio) {
    const index = favorites.findIndex(fav => fav.url === radio.url);

    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(radio);
    }

    localStorage.setItem('favorites', JSON.stringify(favorites));
    renderRadios();

    if (document.getElementById('favorites').classList.contains('active')) {
        renderFavorites();
    }
}

function loadFavorites() {
    renderFavorites();
}

function renderFavorites() {
    const favoritesRadioList = document.getElementById('favoritesRadioList');

    if (favorites.length === 0) {
        favoritesRadioList.innerHTML = `
            <div class="empty-state">
                <p>⭐ Nessun preferito ancora</p>
                <small>Aggiungi radio ai preferiti toccando la stella</small>
            </div>
        `;
        return;
    }

    favoritesRadioList.innerHTML = favorites.map(radio =>
        createRadioItem(radio, false)
    ).join('');

    // Aggiungi event listeners
    favoritesRadioList.querySelectorAll('.radio-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('favorite-btn')) {
                const radioData = JSON.parse(item.dataset.radio);
                selectRadio(radioData);
            }
        });
    });

    favoritesRadioList.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const radioData = JSON.parse(btn.closest('.radio-item').dataset.radio);
            toggleFavorite(radioData);
        });
    });
}

function filterRadios(searchTerm) {
    const filtered = POPULAR_RADIOS.filter(radio =>
        radio.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        radio.genre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const popularRadioList = document.getElementById('popularRadioList');

    if (filtered.length === 0) {
        popularRadioList.innerHTML = `
            <div class="empty-state">
                <p>🔍 Nessun risultato</p>
                <small>Prova con altri termini di ricerca</small>
            </div>
        `;
        return;
    }

    popularRadioList.innerHTML = filtered.map(radio =>
        createRadioItem(radio, false)
    ).join('');

    // Ri-aggiungi event listeners
    popularRadioList.querySelectorAll('.radio-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('favorite-btn')) {
                const radioData = JSON.parse(item.dataset.radio);
                selectRadio(radioData);
            }
        });
    });

    popularRadioList.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const radioData = JSON.parse(btn.closest('.radio-item').dataset.radio);
            toggleFavorite(radioData);
        });
    });
}

// Gestione visibilità pagina (pausa quando app in background)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isPlaying) {
        // L'audio continua in background su mobile
        console.log('App in background');
    } else if (!document.hidden && isPlaying) {
        console.log('App in foreground');
    }
});

// ===== NUOVE FUNZIONALITÀ =====

// Sistema filtro generi
function renderGenreChips() {
    const genreChipsContainer = document.getElementById('genreChips');

    genreChipsContainer.innerHTML = MUSIC_GENRES.map(genre => `
        <button class="genre-chip" data-genre="${genre}">${genre}</button>
    `).join('');

    // Event listeners per i chip
    genreChipsContainer.querySelectorAll('.genre-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const genre = chip.dataset.genre;
            filterByGenre(genre);
        });
    });
}

function filterByGenre(genre) {
    currentGenreFilter = genre;

    // Aggiorna UI chips
    document.querySelectorAll('.genre-chip').forEach(chip => {
        if (chip.dataset.genre === genre) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });

    // Mostra pulsante clear
    document.getElementById('clearGenreBtn').style.display = 'block';

    // NUOVO: Mostra opzione Flow Mode
    showFlowModeOption(genre);
}

function clearGenreFilter() {
    currentGenreFilter = null;

    // Ferma Flow Mode se attivo
    if (flowModeActive) {
        stopFlowMode();
    }

    // Reset UI
    document.querySelectorAll('.genre-chip').forEach(chip => {
        chip.classList.remove('active');
        chip.innerHTML = chip.dataset.genre; // Reset testo
    });

    document.getElementById('clearGenreBtn').style.display = 'none';

    // Nascondi Flow Mode option
    hideFlowModeOption();

    // Mostra tutte le radio
    renderRadios();
}

// Mostra opzione per avviare Flow Mode
function showFlowModeOption(genre) {
    // Prima mostra le radio locali del genere
    applyGenreFilter();

    // Crea banner Flow Mode se non esiste
    let flowBanner = document.getElementById('flowModeBanner');

    if (!flowBanner) {
        flowBanner = document.createElement('div');
        flowBanner.id = 'flowModeBanner';
        flowBanner.className = 'flow-mode-banner';

        // Inserisci dopo i chip di genere
        const genreFilter = document.querySelector('.genre-filter');
        genreFilter.after(flowBanner);
    }

    const buttonText = flowModeActive ? 'FERMA FLOW MODE' : `🔥 AVVIA ${genre.toUpperCase()} FLOW MODE`;

    flowBanner.innerHTML = `
        <div class="flow-banner-content">
            <div class="flow-banner-text">
                <h3>⚡ Scopri migliaia di radio ${genre}</h3>
                <p>Skippa manualmente per scoprire altre radio • Algoritmo intelligente</p>
            </div>
            <button id="startFlowBtn" class="flow-mode-btn ${flowModeActive ? 'active' : ''}">
                ${buttonText}
            </button>
        </div>
    `;

    flowBanner.style.display = 'block';

    // Event listener
    document.getElementById('startFlowBtn').addEventListener('click', () => {
        if (flowModeActive) {
            stopFlowMode();
        } else {
            startFlowMode(genre);
        }
    });
}

function hideFlowModeOption() {
    const flowBanner = document.getElementById('flowModeBanner');
    if (flowBanner) {
        flowBanner.style.display = 'none';
    }
}

function applyGenreFilter() {
    if (!currentGenreFilter) {
        renderRadios();
        return;
    }

    const allRadios = [MY_RADIO, ...POPULAR_RADIOS];
    const filteredRadios = allRadios.filter(radio =>
        radio.genres && radio.genres.includes(currentGenreFilter)
    );

    // Render radio filtrate
    const myRadioList = document.getElementById('myRadioList');
    const popularRadioList = document.getElementById('popularRadioList');

    // Controlla se Marco Radio è nel filtro
    const myRadioFiltered = MY_RADIO.genres.includes(currentGenreFilter);

    if (myRadioFiltered) {
        myRadioList.innerHTML = createRadioItem(MY_RADIO, true);
    } else {
        myRadioList.innerHTML = `
            <div class="empty-state">
                <p>🎭 Marco Radio non trasmette ${currentGenreFilter} al momento</p>
            </div>
        `;
    }

    const popularFiltered = filteredRadios.filter(r => r.url !== MY_RADIO.url);

    if (popularFiltered.length > 0) {
        popularRadioList.innerHTML = popularFiltered.map(radio =>
            createRadioItem(radio, false)
        ).join('');

        // Ri-aggiungi event listeners
        addRadioEventListeners(popularRadioList);
    } else {
        popularRadioList.innerHTML = `
            <div class="empty-state">
                <p>🔍 Nessuna radio ${currentGenreFilter} disponibile</p>
            </div>
        `;
    }

    // Ri-aggiungi eventi a "La Mia Radio"
    if (myRadioFiltered) {
        addRadioEventListeners(myRadioList);
    }
}

function addRadioEventListeners(container) {
    container.querySelectorAll('.radio-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('favorite-btn')) {
                const radioData = JSON.parse(item.dataset.radio);
                selectRadio(radioData);
            }
        });
    });

    container.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const radioData = JSON.parse(btn.closest('.radio-item').dataset.radio);
            toggleFavorite(radioData);
        });
    });
}

// Sistema Like/Dislike
function handleLike(isLike) {
    if (!currentRadio) return;

    const radioUrl = currentRadio.url;

    // Inizializza se non esiste
    if (!likes[radioUrl]) {
        likes[radioUrl] = { likes: 0, dislikes: 0, userChoice: null };
    }

    const radioLikes = likes[radioUrl];

    // Toggle o rimuovi voto precedente
    if (isLike) {
        if (radioLikes.userChoice === 'like') {
            // Rimuovi like
            radioLikes.likes--;
            radioLikes.userChoice = null;
        } else {
            // Aggiungi like (rimuovi dislike se presente)
            if (radioLikes.userChoice === 'dislike') {
                radioLikes.dislikes--;
            }
            radioLikes.likes++;
            radioLikes.userChoice = 'like';
        }
    } else {
        if (radioLikes.userChoice === 'dislike') {
            // Rimuovi dislike
            radioLikes.dislikes--;
            radioLikes.userChoice = null;
        } else {
            // Aggiungi dislike (rimuovi like se presente)
            if (radioLikes.userChoice === 'like') {
                radioLikes.likes--;
            }
            radioLikes.dislikes++;
            radioLikes.userChoice = 'dislike';
        }
    }

    // Salva
    localStorage.setItem('likes', JSON.stringify(likes));

    // Aggiorna UI
    updateLikeUI();
}

function updateLikeUI() {
    if (!currentRadio) return;

    const likeControls = document.getElementById('likeControls');
    likeControls.style.display = 'flex';

    const radioUrl = currentRadio.url;
    const radioLikes = likes[radioUrl] || { likes: 0, dislikes: 0, userChoice: null };

    // Aggiorna contatori
    document.getElementById('likeCount').textContent = radioLikes.likes;
    document.getElementById('dislikeCount').textContent = radioLikes.dislikes;

    // Calcola percentuale
    const total = radioLikes.likes + radioLikes.dislikes;
    let percentage = total > 0 ? Math.round((radioLikes.likes / total) * 100) : 0;
    document.getElementById('likePercentage').textContent = `${percentage}%`;

    // Aggiorna stato pulsanti
    const likeBtn = document.getElementById('likeBtn');
    const dislikeBtn = document.getElementById('dislikeBtn');

    likeBtn.classList.remove('active');
    dislikeBtn.classList.remove('active');

    if (radioLikes.userChoice === 'like') {
        likeBtn.classList.add('active');
    } else if (radioLikes.userChoice === 'dislike') {
        dislikeBtn.classList.add('active');
    }
}

// Crossfade tra radio con jingle
async function crossfadeToRadio(nextRadio) {
    if (isCrossfading || !isPlaying) return;

    isCrossfading = true;
    songInfo.textContent = 'Cambio radio...';

    try {
        // Fase 1: Fade out della radio corrente (1 secondo)
        await fadeVolume(audio, audio.volume, 0, 1000);

        // Fase 2: Suona jingle
        await new Promise(resolve => {
            jingleAudio.play(() => resolve());
        });

        // Fase 3: Ferma radio corrente e prepara prossima
        audio.pause();

        // Imposta nuovo stream
        audioNext.src = nextRadio.url;
        audioNext.volume = 0;
        audioNext.load();

        // Attendi che sia pronto
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

            audioNext.addEventListener('canplay', () => {
                clearTimeout(timeout);
                resolve();
            }, { once: true });

            audioNext.addEventListener('error', () => {
                clearTimeout(timeout);
                reject(new Error('Errore caricamento'));
            }, { once: true });
        });

        // Fase 4: Avvia nuova radio
        await audioNext.play();

        // Fase 5: Fade in della nuova radio (1 secondo)
        await fadeVolume(audioNext, 0, volumeSlider.value / 100, 1000);

        // Swap players
        const tempAudio = audio;
        audio = audioNext;
        audioNext = tempAudio;

        // Aggiorna stato
        currentRadio = nextRadio;
        radioName.textContent = nextRadio.name;
        albumCover.src = nextRadio.logo;

        // Carica metadati
        loadMetadata(nextRadio);
        startMetadataUpdates();

        // Aggiorna UI like
        updateLikeUI();

    } catch (error) {
        console.error('Errore crossfade:', error);
        songInfo.textContent = 'Errore durante il cambio. Riprova.';

        // Ripristina audio originale
        audio.volume = volumeSlider.value / 100;
        audio.play().catch(() => {});
    }

    isCrossfading = false;
}

// Funzione di fade volume
function fadeVolume(audioElement, fromVolume, toVolume, duration) {
    return new Promise(resolve => {
        const steps = 50;
        const stepDuration = duration / steps;
        const volumeStep = (toVolume - fromVolume) / steps;
        let currentStep = 0;

        audioElement.volume = fromVolume;

        const interval = setInterval(() => {
            currentStep++;
            audioElement.volume = fromVolume + (volumeStep * currentStep);

            if (currentStep >= steps) {
                clearInterval(interval);
                audioElement.volume = toVolume;
                resolve();
            }
        }, stepDuration);
    });
}

// Ottieni radio suggerita in base ai like
function getSuggestedRadio(genre = null) {
    let availableRadios = genre
        ? [...POPULAR_RADIOS].filter(r => r.genres.includes(genre))
        : [...POPULAR_RADIOS];

    // Escludi radio corrente
    if (currentRadio) {
        availableRadios = availableRadios.filter(r => r.url !== currentRadio.url);
    }

    if (availableRadios.length === 0) return null;

    // Calcola score per ogni radio in base ai like
    const radioScores = availableRadios.map(radio => {
        const radioLikes = likes[radio.url] || { likes: 0, dislikes: 0 };
        const total = radioLikes.likes + radioLikes.dislikes;

        // Score: percentuale like + bonus per radio non valutate
        let score = total > 0
            ? (radioLikes.likes / total) * 100
            : 50; // Radio non valutata = 50% (neutrale)

        // Bonus per radio poco ascoltate (esplorazione)
        if (total < 5) score += 10;

        return { radio, score };
    });

    // Ordina per score decrescente
    radioScores.sort((a, b) => b.score - a.score);

    // 80% delle volte scegli top 3, 20% random (per varietà)
    const topRadios = radioScores.slice(0, 3);
    const useTopRadio = Math.random() < 0.8;

    if (useTopRadio && topRadios.length > 0) {
        const randomIndex = Math.floor(Math.random() * topRadios.length);
        return topRadios[randomIndex].radio;
    } else {
        const randomIndex = Math.floor(Math.random() * availableRadios.length);
        return availableRadios[randomIndex];
    }
}

// Funzione per passare alla prossima radio suggerita
function playNextSuggestedRadio() {
    if (!isPlaying) {
        alert('Avvia prima la riproduzione!');
        return;
    }

    let nextRadio;

    if (flowModeActive && discoveredRadios.length > 0) {
        // Flow Mode attivo: usa coda metadata se disponibile
        if (metadataSkipEnabled && radioQueue.length > 0) {
            nextRadio = getNextRadioFromQueue();
        } else {
            nextRadio = getNextFlowRadio();
        }
    } else {
        // Flow Mode NON attivo: usa radio locali
        nextRadio = getSuggestedRadio(currentGenreFilter);
    }

    if (!nextRadio) {
        alert('Nessuna altra radio disponibile! Attiva Flow Mode per scoprirne altre.');
        return;
    }

    // Usa crossfade per cambio fluido
    crossfadeToRadio(nextRadio);
}

// Ottieni prossima radio dal Flow Mode (EVITA RIPETIZIONI + RADIO NON FUNZIONANTI)
function getNextFlowRadio() {
    if (!discoveredRadios || discoveredRadios.length === 0) return null;

    // Trova radio NON ascoltate di recente E non rotte
    let availableRadios = discoveredRadios.filter(r =>
        (!currentRadio || r.url !== currentRadio.url) &&
        !recentlyPlayedRadios.includes(r.url) &&
        !brokenRadios.includes(r.url) // NUOVO: Evita radio non funzionanti
    );

    // Se TUTTE le radio sono state ascoltate, resetta cronologia (ma NON radio rotte)
    if (availableRadios.length === 0) {
        console.log('🔄 Tutte le radio ascoltate, resetto cronologia');
        recentlyPlayedRadios = [];
        availableRadios = discoveredRadios.filter(r =>
            (!currentRadio || r.url !== currentRadio.url) &&
            !brokenRadios.includes(r.url) // Mantieni esclusione radio rotte
        );
    }

    // Se anche dopo reset non ci sono radio (tutte rotte), mostra errore
    if (availableRadios.length === 0) {
        console.error('❌ Nessuna radio disponibile funzionante!');
        return null;
    }

    // Riordina per score + preferenza italiane ogni volta
    const sorted = availableRadios.sort((a, b) => {
        const scoreA = calculateRadioScore(a);
        const scoreB = calculateRadioScore(b);

        // Bonus italiane
        const italianBonus = 200;
        const isItalianA = (a.country && (a.country.toLowerCase().includes('ital') || a.country === 'IT'));
        const isItalianB = (b.country && (b.country.toLowerCase().includes('ital') || b.country === 'IT'));
        const bonusA = isItalianA ? italianBonus : 0;
        const bonusB = isItalianB ? italianBonus : 0;

        return (scoreB + bonusB) - (scoreA + bonusA);
    });

    // 60% top 10, 40% casuale (più varietà)
    const useTop = Math.random() < 0.6;

    let selectedRadio;
    if (useTop && sorted.length > 1) {
        const topRadios = sorted.slice(0, Math.min(10, sorted.length));
        selectedRadio = topRadios[Math.floor(Math.random() * topRadios.length)];
    } else {
        selectedRadio = sorted[Math.floor(Math.random() * sorted.length)];
    }

    // Aggiungi a cronologia (max 10 radio)
    recentlyPlayedRadios.push(selectedRadio.url);
    if (recentlyPlayedRadios.length > 10) {
        recentlyPlayedRadios.shift(); // Rimuovi la più vecchia
    }

    console.log(`📻 Prossima radio: ${selectedRadio.name} [${selectedRadio.country}]`);
    return selectedRadio;
}

// Mostra pulsante "next" quando c'è riproduzione attiva
function updateNextButtonVisibility() {
    const nextBtn = document.getElementById('nextRadioBtn');
    if (isPlaying) {
        nextBtn.style.display = 'flex';
    } else {
        nextBtn.style.display = 'none';
    }
}

// ===== RADIO BROWSER API - DISCOVERY ONLINE =====

// Cerca radio online per genere (PRIORITÀ ITALIA)
async function searchRadiosByGenre(genre, limit = 50) {
    try {
        songInfo.textContent = `🔍 Cercando radio ${genre} italiane...`;

        // STEP 1: Cerca radio ITALIANE per genere (priorità)
        const italianResponse = await fetch(
            `${RADIO_BROWSER_API}/stations/search?tag=${encodeURIComponent(genre.toLowerCase())}&countrycode=IT&order=votes&reverse=true&hidebroken=true&limit=100`
        );

        let italianStations = [];
        if (italianResponse.ok) {
            italianStations = await italianResponse.json();
            console.log(`🇮🇹 Trovate ${italianStations.length} radio italiane ${genre}`);
        }

        // STEP 2: Se poche radio italiane, cerca INTERNAZIONALI
        songInfo.textContent = `🔍 Cercando altre radio ${genre}...`;
        const globalResponse = await fetch(
            `${RADIO_BROWSER_API}/stations/bytag/${encodeURIComponent(genre.toLowerCase())}?limit=${limit * 2}&order=votes&reverse=true&hidebroken=true`
        );

        if (!globalResponse.ok) throw new Error('Errore ricerca');

        const globalStations = await globalResponse.json();
        console.log(`🌍 Trovate ${globalStations.length} radio internazionali ${genre}`);

        // STEP 3: Combina - PRIMA italiane, POI internazionali
        const allStations = [
            ...italianStations,
            ...globalStations.filter(g => !italianStations.some(i => i.url_resolved === g.url_resolved))
        ];

        // STEP 4: Filtra e converti nel formato dell'app (filtro RIGOROSO)
        discoveredRadios = allStations
            .filter(station => {
                // Controlli di qualità
                if (!station.url_resolved) return false;
                if (!station.name || station.name.trim().length === 0) return false;

                // Qualità audio minima
                if (station.bitrate < 96) return false;

                // Codec supportati
                const supportedCodecs = ['MP3', 'AAC', 'AAC+', 'AACP', 'OGG'];
                if (!supportedCodecs.includes(station.codec?.toUpperCase())) return false;

                // Evita stream HTTPS se possibile (alcuni browser hanno problemi)
                // Ma non esclude completamente, solo penalizza

                // Deve avere URL valido
                try {
                    new URL(station.url_resolved);
                } catch {
                    return false;
                }

                return true;
            })
            .map(station => ({
                name: station.name.trim(),
                url: station.url_resolved,
                logo: station.favicon || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Crect fill=%22%231a1a2e%22 width=%2250%22 height=%2250%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2224%22 text-anchor=%22middle%22 dy=%22.3em%22%3E📻%3C/text%3E%3C/svg%3E',
                genres: [genre],
                mainGenre: genre,
                bitrate: station.bitrate,
                country: station.country,
                codec: station.codec,
                votes: station.votes || 0
            }))
            .slice(0, limit);

        console.log(`✅ Trovate ${discoveredRadios.length} radio ${genre}`);
        return discoveredRadios;

    } catch (error) {
        console.error('❌ Errore ricerca radio:', error);
        songInfo.textContent = 'Errore ricerca. Riprova.';
        return [];
    }
}

// ===== SISTEMA METADATA-BASED =====

// Classifica genere da metadati (titolo, artista)
function classifyGenreFromMetadata(title, artist) {
    const searchText = `${title} ${artist}`.toLowerCase();

    // Cerca keywords nei metadati
    for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
        for (const keyword of keywords) {
            if (searchText.includes(keyword)) {
                return genre;
            }
        }
    }

    return null; // Genere non identificato
}

// Avvia monitoraggio metadati con auto-skip
function startMetadataMonitoring() {
    if (metadataCheckInterval) {
        clearInterval(metadataCheckInterval);
    }

    metadataCheckInterval = setInterval(() => {
        if (!isPlaying || !flowModeActive || !metadataSkipEnabled) return;

        // Leggi metadati attuali dalla radio
        const metadata = getAudioMetadata();

        if (metadata.title && metadata.title !== previousTrackTitle) {
            // Nuovo brano rilevato
            previousTrackTitle = metadata.title;
            currentTrackMetadata = metadata;

            console.log(`📻 Nuovo brano: ${metadata.title} - ${metadata.artist}`);

            // Classifica il genere del brano
            const detectedGenre = classifyGenreFromMetadata(metadata.title, metadata.artist);

            if (detectedGenre) {
                console.log(`🎵 Genere rilevato: ${detectedGenre}`);
                songInfo.textContent = `🎵 ${metadata.title} [${detectedGenre}]`;

                // Se il genere NON corrisponde al Flow, skippa automaticamente
                if (detectedGenre !== currentGenreFilter) {
                    console.log(`⏭️ Skip automatico: ${detectedGenre} ≠ ${currentGenreFilter}`);
                    setTimeout(() => {
                        if (flowModeActive) {
                            playNextSuggestedRadio();
                        }
                    }, 3000); // Aspetta 3 secondi prima di skippare
                } else {
                    // Genere corretto: prepara prossima radio in coda
                    prepareNextRadioInQueue();
                }
            } else {
                // Genere non riconosciuto: mostra comunque metadati
                songInfo.textContent = `🎵 ${metadata.title}`;
            }
        }
    }, 5000); // Controlla ogni 5 secondi
}

// Ferma monitoraggio metadati
function stopMetadataMonitoring() {
    if (metadataCheckInterval) {
        clearInterval(metadataCheckInterval);
        metadataCheckInterval = null;
    }
    previousTrackTitle = '';
    currentTrackMetadata = { title: '', artist: '', genre: '' };
}

// Leggi metadati audio dalla radio corrente
function getAudioMetadata() {
    // Tenta di leggere metadati ICY (Icecast/Shoutcast)
    // Nota: molte radio inviano metadati via header HTTP, non accessibile da JS
    // Soluzione: usa MediaMetadata API se disponibile

    if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
        return {
            title: navigator.mediaSession.metadata.title || '',
            artist: navigator.mediaSession.metadata.artist || '',
            album: navigator.mediaSession.metadata.album || ''
        };
    }

    // Fallback: prova a leggere da radio corrente (se fornisce API)
    if (currentRadio && currentRadio.nowPlaying) {
        return currentRadio.nowPlaying;
    }

    return { title: '', artist: '', album: '' };
}

// Prepara prossima radio in coda (durante riproduzione)
async function prepareNextRadioInQueue() {
    if (!flowModeActive || radioQueue.length > 0) return;

    console.log('🔄 Preparando prossima radio in coda...');

    // Cerca 3 radio del genere e le mette in coda
    const nextRadios = await searchRadiosByGenre(currentGenreFilter, 10);

    // Filtra radio già ascoltate
    const freshRadios = nextRadios.filter(r =>
        !currentRadio || r.url !== currentRadio.url
    );

    // Ordina per score
    const sorted = freshRadios.sort((a, b) => {
        const scoreA = calculateRadioScore(a);
        const scoreB = calculateRadioScore(b);
        return scoreB - scoreA;
    });

    radioQueue = sorted.slice(0, 3);
    console.log(`✅ ${radioQueue.length} radio in coda`);
}

// Ottieni prossima radio dalla coda (metadata-based)
function getNextRadioFromQueue() {
    if (radioQueue.length > 0) {
        const nextRadio = radioQueue.shift(); // Prendi prima della coda
        prepareNextRadioInQueue(); // Ricarica coda
        return nextRadio;
    }

    // Coda vuota: fallback a flow normale
    return getNextFlowRadio();
}

// Avvia Flow Mode: scopri radio del genere (CON METADATA AUTO-SKIP)
async function startFlowMode(genre) {
    if (flowModeActive) {
        stopFlowMode();
        return;
    }

    // Cerca radio del genere
    songInfo.textContent = `🔍 Cercando radio ${genre}...`;
    const radios = await searchRadiosByGenre(genre, 50); // Più radio per varietà

    if (radios.length === 0) {
        alert(`Nessuna radio ${genre} trovata online. Riprova.`);
        songInfo.textContent = 'Seleziona una radio';
        return;
    }

    flowModeActive = true;
    currentGenreFilter = genre;
    metadataSkipEnabled = true; // Attiva auto-skip metadata

    // Reset liste per nuovo Flow Mode
    recentlyPlayedRadios = [];
    brokenRadios = [];
    consecutiveErrors = 0;

    // Ordina per score (algoritmo intelligente) + preferenza radio italiane
    discoveredRadios = radios.sort((a, b) => {
        const scoreA = calculateRadioScore(a);
        const scoreB = calculateRadioScore(b);

        // Bonus per radio italiane (controlla vari formati)
        const italianBonus = 200; // Aumentato bonus per dare forte priorità
        const isItalianA = (a.country && (a.country.toLowerCase().includes('ital') || a.country === 'IT'));
        const isItalianB = (b.country && (b.country.toLowerCase().includes('ital') || b.country === 'IT'));
        const bonusA = isItalianA ? italianBonus : 0;
        const bonusB = isItalianB ? italianBonus : 0;

        return (scoreB + bonusB) - (scoreA + bonusA);
    });

    // Debug: mostra prime 5 radio e loro paese
    console.log(`✅ Flow Mode attivo: ${discoveredRadios.length} radio ${genre}`);
    console.log('Top 5 radio:');
    discoveredRadios.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.name} [${r.country}] - Score: ${calculateRadioScore(r)}`);
    });

    updateFlowModeUI();

    // Avvia monitoraggio metadati
    startMetadataMonitoring();

    // Avvia la prima radio con score più alto
    const firstRadio = discoveredRadios[0];
    selectRadio(firstRadio);
    startPlayback();

    // Prepara coda radio
    prepareNextRadioInQueue();

    songInfo.textContent = `🎵 Flow ${genre} - Auto-skip se genere diverso`;
}

// Ferma Flow Mode
function stopFlowMode() {
    flowModeActive = false;
    metadataSkipEnabled = false;

    if (flowModeTimer) {
        clearTimeout(flowModeTimer);
        flowModeTimer = null;
    }

    // Ferma monitoraggio metadati
    stopMetadataMonitoring();

    // Svuota coda, cronologia e radio rotte
    radioQueue = [];
    recentlyPlayedRadios = [];
    brokenRadios = [];
    consecutiveErrors = 0;

    updateFlowModeUI();
    songInfo.textContent = isPlaying ? 'In riproduzione...' : 'Premi play per ascoltare';
}

// Calcola score per ordinare radio (algoritmo tipo Spotify)
function calculateRadioScore(radio) {
    let score = 0;

    // 1. Voti pubblici (peso 40%)
    score += (radio.votes || 0) * 0.4;

    // 2. Qualità stream (peso 30%)
    const bitrateScore = Math.min(radio.bitrate / 320, 1) * 100; // Max 320kbps = 100%
    score += bitrateScore * 0.3;

    // 3. Like dell'utente (peso 30%)
    const radioLikes = likes[radio.url] || { likes: 0, dislikes: 0 };
    const total = radioLikes.likes + radioLikes.dislikes;

    if (total > 0) {
        const likePercentage = (radioLikes.likes / total) * 100;
        score += likePercentage * 0.3;
    } else {
        // Radio mai ascoltata: bonus esplorazione
        score += 15;
    }

    // 4. Penalità per radio con dislike
    if (radioLikes.dislikes > radioLikes.likes) {
        score -= 50;
    }

    return score;
}

// Aggiorna UI per Flow Mode
function updateFlowModeUI() {
    const genreChips = document.querySelectorAll('.genre-chip');
    const metadataToggle = document.getElementById('metadataToggle');

    genreChips.forEach(chip => {
        const chipGenre = chip.dataset.genre;

        if (flowModeActive && currentGenreFilter === chipGenre) {
            chip.style.background = 'linear-gradient(135deg, #6c5ce7, #a29bfe)';
            chip.innerHTML = `${chipGenre} ⚡ FLOW`;
        } else {
            // Reset
            const isActive = chip.classList.contains('active');
            if (!flowModeActive && isActive) {
                chip.innerHTML = chipGenre;
            }
        }
    });

    // Mostra/nascondi toggle metadata
    if (flowModeActive) {
        metadataToggle.style.display = 'block';
    } else {
        metadataToggle.style.display = 'none';
    }
}

// ===== FUNZIONI PER AUTOPLAY AUTOMATICO =====

// Tenta autoplay immediato
async function attemptAutoplay() {
    console.log('🎵 Tentativo autoplay MarcoRadio...');

    try {
        // Imposta immediatamente MarcoRadio come radio corrente
        currentRadio = MY_RADIO;
        audio.src = MY_RADIO.url;

        // Prova a far partire l'audio
        const playPromise = audio.play();

        if (playPromise !== undefined) {
            await playPromise;
            console.log('✅ Autoplay riuscito!');

            // Nascondi splash screen se autoplay funziona
            const splashScreen = document.getElementById('splashScreen');
            splashScreen.classList.add('hidden');
            setTimeout(() => {
                splashScreen.style.display = 'none';
            }, 500);

            // Aggiorna UI
            updatePlayerUI();
            isPlaying = true;
            playIcon.textContent = '⏸';
            playingAnimation.classList.add('active');
        }
    } catch (error) {
        console.log('⚠️ Autoplay bloccato dal browser:', error.message);
        console.log('💡 Mostrando splash screen per interazione utente...');
        // Splash screen rimane visibile come fallback
    }
}

// Gestisce la prima interazione utente (tocco o click)
function handleFirstInteraction() {
    console.log('👆 Prima interazione utente rilevata');

    const splashScreen = document.getElementById('splashScreen');

    // Se splash screen è ancora visibile, avvia MarcoRadio
    if (splashScreen && splashScreen.style.display !== 'none') {
        splashScreen.classList.add('hidden');
        setTimeout(() => {
            splashScreen.style.display = 'none';
        }, 500);

        playRadio(MY_RADIO);
    }
}
