// Cocktail Finder PWA - Main JavaScript

class CocktailFinder {
    constructor() {
        this.apiBaseUrl = 'https://www.thecocktaildb.com/api/json/v1/1/search.php?s=';
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.noResults = document.getElementById('noResults');
        this.statusMessage = document.getElementById('statusMessage');
        
        this.init();
    }

    init() {
        this.registerServiceWorker();
        this.attachEventListeners();
        this.showWelcomeMessage();
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                // Desregistrar service workers anteriores si existen
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                    console.log('Service Worker anterior desregistrado');
                }
                
                // Registrar el nuevo service worker
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    updateViaCache: 'none' // Evitar caché del propio SW
                });
                
                console.log('Service Worker registrado exitosamente:', registration);
                
                // Escuchar cuando el SW esté listo
                if (registration.waiting) {
                    console.log('Service Worker esperando activación');
                }
                
                // Escuchar actualizaciones del service worker
                registration.addEventListener('updatefound', () => {
                    console.log('Nueva versión del Service Worker disponible');
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            console.log('Service Worker instalado, activando...');
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });
                
                // Forzar actualización del cache
                if (registration.active) {
                    console.log('Service Worker activo, forzando actualización de caché...');
                }
                
            } catch (error) {
                console.error('Error registrando Service Worker:', error);
            }
        }
    }

    attachEventListeners() {
        // Buscar al hacer clic en el botón
        this.searchBtn.addEventListener('click', () => {
            this.performSearch();
        });

        // Buscar al presionar Enter
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Limpiar resultados cuando el input esté vacío
        this.searchInput.addEventListener('input', (e) => {
            if (e.target.value.trim() === '') {
                this.clearResults();
                this.showWelcomeMessage();
            }
        });
    }

    showWelcomeMessage() {
        this.statusMessage.className = 'mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200';
        this.statusMessage.innerHTML = `
            <div class="flex items-center">
                <span class="text-2xl mr-3">👋</span>
                <div>
                    <p class="text-blue-800 font-medium">¡Bienvenido a Cocktail Finder!</p>
                    <p class="text-blue-600 text-sm">Busca tu cóctel favorito para comenzar</p>
                </div>
            </div>
        `;
        this.statusMessage.style.display = 'block';
    }

    showOfflineMessage() {
        this.statusMessage.className = 'mb-4 p-4 rounded-lg bg-orange-50 border border-orange-200';
        this.statusMessage.innerHTML = `
            <div class="flex items-center">
                <span class="text-2xl mr-3">📱</span>
                <div>
                    <p class="text-orange-800 font-medium">Modo Offline Detectado</p>
                    <p class="text-orange-600 text-sm">La app funciona offline, pero las búsquedas muestran contenido limitado</p>
                </div>
            </div>
        `;
        this.statusMessage.style.display = 'block';
    }

    hideStatusMessage() {
        this.statusMessage.style.display = 'none';
    }

    async performSearch() {
        const query = this.searchInput.value.trim();
        
        if (!query) {
            this.showError('Por favor, ingresa el nombre de un cóctel');
            return;
        }

        this.showLoading(true);
        this.clearResults();
        this.hideStatusMessage();

        try {
            const response = await fetch(`${this.apiBaseUrl}${encodeURIComponent(query)}`);
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            // Verificar si es una respuesta offline del service worker
            if (response.headers.get('X-Offline-Response') === 'true') {
                this.showOfflineMessage();
                this.displayResults(data.drinks);
            } else {
                this.displayResults(data.drinks);
            }
            
        } catch (error) {
            console.error('Error en la búsqueda:', error);
            
            // Verificar si estamos offline o si el service worker devolvió fallback
            if (!navigator.onLine) {
                this.showOfflineMessage();
                this.displayOfflineResult();
            } else {
                this.showError('Error al buscar cócteles. Verifica tu conexión o intenta más tarde.');
            }
        } finally {
            this.showLoading(false);
        }
    }

    displayResults(drinks) {
        if (!drinks || drinks.length === 0) {
            this.showNoResults();
            return;
        }

        this.resultsContainer.innerHTML = '';
        
        drinks.forEach(drink => {
            const card = this.createCocktailCard(drink);
            this.resultsContainer.appendChild(card);
        });
    }

    displayOfflineResult() {
        // Mostrar resultado de fallback cuando estamos offline
        const offlineDrink = {
            strDrink: "Cóctel Especial (Offline)",
            strDrinkThumb: "/assets/imagenParaPlaceholder.jpg",
            idDrink: "offline-drink"
        };

        this.resultsContainer.innerHTML = '';
        const card = this.createCocktailCard(offlineDrink);
        this.resultsContainer.appendChild(card);
    }

    createCocktailCard(drink) {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300';
        
        card.innerHTML = `
            <img 
                src="${drink.strDrinkThumb || '/assets/imagenParaPlaceholder.jpg'}" 
                alt="${drink.strDrink}"
                class="w-full h-48 object-cover"
                onerror="this.src='/assets/imagenParaPlaceholder.jpg'"
            >
            <div class="p-4">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">${drink.strDrink}</h3>
                <div class="flex items-center text-sm text-gray-600">
                    <span class="mr-2">🍸</span>
                    <span>ID: ${drink.idDrink || 'N/A'}</span>
                </div>
            </div>
        `;

        // Agregar efecto de clic
        card.addEventListener('click', () => {
            card.style.transform = 'scale(0.98)';
            setTimeout(() => {
                card.style.transform = 'scale(1)';
            }, 150);
        });

        return card;
    }

    showLoading(show) {
        this.loadingSpinner.style.display = show ? 'block' : 'none';
    }

    showNoResults() {
        this.noResults.style.display = 'block';
    }

    showError(message) {
        this.statusMessage.className = 'mb-4 p-4 rounded-lg bg-red-50 border border-red-200';
        this.statusMessage.innerHTML = `
            <div class="flex items-center">
                <span class="text-2xl mr-3">⚠️</span>
                <div>
                    <p class="text-red-800 font-medium">Error</p>
                    <p class="text-red-600 text-sm">${message}</p>
                </div>
            </div>
        `;
        this.statusMessage.style.display = 'block';
    }

    clearResults() {
        this.resultsContainer.innerHTML = '';
        this.noResults.style.display = 'none';
        this.loadingSpinner.style.display = 'none';
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new CocktailFinder();
});

// Manejar cambios de conectividad
window.addEventListener('online', () => {
    console.log('Conectado a internet');
    // Mostrar mensaje temporal de que se restauró la conexión
    const app = document.querySelector('#app');
    if (app) {
        const connectionMsg = document.createElement('div');
        connectionMsg.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        connectionMsg.textContent = '✓ Conexión restaurada';
        app.appendChild(connectionMsg);
        
        setTimeout(() => {
            connectionMsg.remove();
        }, 3000);
    }
});

window.addEventListener('offline', () => {
    console.log('Sin conexión a internet');
    // Mostrar mensaje temporal de pérdida de conexión
    const app = document.querySelector('#app');
    if (app) {
        const connectionMsg = document.createElement('div');
        connectionMsg.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        connectionMsg.textContent = '⚠️ Sin conexión - App Shell funcionando';
        app.appendChild(connectionMsg);
        
        setTimeout(() => {
            connectionMsg.remove();
        }, 5000);
    }
});