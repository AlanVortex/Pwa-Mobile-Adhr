// Service Worker para Cocktail Finder PWA
// Estrategia OnlyCache para App Shell

const CACHE_NAME = 'cocktail-finder-v3-appshell';
const API_BASE_URL = 'https://www.thecocktaildb.com';

// Recursos del App Shell que se cachearán
const APP_SHELL_RESOURCES = [
    '/',
    '/index.html',
    '/main.js',
    '/sw.js',
    '/assets/manifest.json',
    '/assets/imagenParaPlaceholder.jpg', // Tu imagen placeholder
    'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4', // Este debe cachearse para funcionar offline
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker: Instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                console.log('Service Worker: Cacheando App Shell');
                
                // Cachear recursos uno por uno para mejor control de errores
                const cachePromises = APP_SHELL_RESOURCES.map(async (resource) => {
                    try {
                        console.log('Service Worker: Cacheando:', resource);
                        await cache.add(resource);
                        console.log('Service Worker: ✓ Cacheado:', resource);
                    } catch (error) {
                        console.error('Service Worker: ✗ Error cacheando:', resource, error);
                        // No fallar por un recurso individual
                    }
                });
                
                await Promise.allSettled(cachePromises);
                console.log('Service Worker: App Shell cacheado completamente');
                
                // Forzar activación inmediata
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Error general cacheando App Shell:', error);
            })
    );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activando...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Service Worker: Eliminando cache antigua:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activado y tomando control');
                return self.clients.claim();
            })
    );
});

// Interceptar todas las peticiones (fetch)
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    
    // Imprimir la URL de todas las peticiones
    console.log('Service Worker: Interceptando request a:', event.request.url);
    
    event.respondWith(handleRequest(event.request, requestUrl));
});

async function handleRequest(request, requestUrl) {
    // 1. Si es un recurso del App Shell, SIEMPRE responder desde caché (OnlyCache)
    if (isAppShellResource(request.url)) {
        console.log('Service Worker: Recurso App Shell detectado (OnlyCache):', request.url);
        try {
            return await getCachedResponse(request);
        } catch (error) {
            console.error('Service Worker: Error con recurso App Shell, pero no debe tumbar el sitio:', error);
            // El sitio debe seguir funcionando aunque falte algún recurso
            return new Response('', { status: 200 });
        }
    }
    
    // 2. Si es una petición a la API de cócteles, intentar red primero
    if (requestUrl.origin === API_BASE_URL) {
        console.log('Service Worker: Petición API detectada:', request.url);
        try {
            return await handleApiRequest(request);
        } catch (error) {
            console.log('Service Worker: API falló, devolviendo respuesta offline:', error);
            return await handleOfflineApiResponse();
        }
    }
    
    // 3. Para otras peticiones, estrategia network-first con fallback a caché
    try {
        console.log('Service Worker: Petición externa, intentando red:', request.url);
        return await fetch(request);
    } catch (error) {
        console.log('Service Worker: Petición externa falló, buscando en caché:', request.url);
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Si no hay nada en caché, devolver respuesta genérica
        return new Response('Recurso no disponible offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

function isAppShellResource(url) {
    // Verificar si la URL pertenece al App Shell
    const urlObj = new URL(url);
    
    console.log('Service Worker: Verificando si es App Shell:', url);
    
    // Recursos locales del App Shell
    const localResources = [
        '/',
        '/index.html',
        '/main.js',
        '/sw.js'
    ];
    
    // Verificar rutas exactas
    if (localResources.includes(urlObj.pathname)) {
        console.log('Service Worker: ✓ Es recurso local del App Shell');
        return true;
    }
    
    // Verificar recursos en /assets/
    if (urlObj.pathname.startsWith('/assets/')) {
        console.log('Service Worker: ✓ Es recurso de /assets/');
        return true;
    }
    
    // Verificar TailwindCSS CDN (más específico)
    if (urlObj.hostname === 'cdn.tailwindcss.com' || url.includes('tailwindcss.com')) {
        console.log('Service Worker: ✓ Es CDN de TailwindCSS');
        return true;
    }
    
    // También verificar si es cualquier recurso de CDN que estemos usando
    if (urlObj.hostname.includes('cdn.') && (url.includes('tailwind') || url.includes('css'))) {
        console.log('Service Worker: ✓ Es CDN de CSS');
        return true;
    }
    
    console.log('Service Worker: ✗ NO es recurso del App Shell');
    return false;
}

async function getCachedResponse(request) {
    const cache = await caches.open(CACHE_NAME);
    
    // Intentar match exacto primero
    let cachedResponse = await cache.match(request);
    
    // Si no encuentra match exacto y es TailwindCSS, intentar match por URL
    if (!cachedResponse && request.url.includes('tailwindcss.com')) {
        const keys = await cache.keys();
        for (const key of keys) {
            if (key.url.includes('tailwindcss.com')) {
                cachedResponse = await cache.match(key);
                console.log('Service Worker: Encontrado TailwindCSS en caché con URL alternativa');
                break;
            }
        }
    }
    
    if (cachedResponse) {
        console.log('Service Worker: ✓ Respondiendo desde caché:', request.url);
        return cachedResponse;
    } else {
        console.log('Service Worker: Recurso App Shell no encontrado en caché, fetcheando:', request.url);
        
        try {
            const networkResponse = await fetch(request);
            
            // Cachear la nueva respuesta si es exitosa
            if (networkResponse.ok) {
                const responseClone = networkResponse.clone();
                await cache.put(request, responseClone);
                console.log('Service Worker: ✓ Recurso App Shell cacheado exitosamente:', request.url);
            }
            
            return networkResponse;
        } catch (error) {
            console.error('Service Worker: ✗ Error fetcheando recurso App Shell:', error);
            
            // Para TailwindCSS, devolver CSS básico de emergencia
            if (request.url.includes('tailwindcss.com')) {
                console.log('Service Worker: Devolviendo CSS básico de emergencia');
                const basicCSS = `
                    /* TailwindCSS Offline Fallback */
                    * { box-sizing: border-box; }
                    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
                    .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
                    .mx-auto { margin-left: auto; margin-right: auto; }
                    .px-4 { padding-left: 1rem; padding-right: 1rem; }
                    .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
                    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
                    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
                    .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
                    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
                    .p-4 { padding: 1rem; }
                    .mb-8 { margin-bottom: 2rem; }
                    .mb-4 { margin-bottom: 1rem; }
                    .mb-2 { margin-bottom: 0.5rem; }
                    .mr-2 { margin-right: 0.5rem; }
                    .mr-3 { margin-right: 0.75rem; }
                    .mt-2 { margin-top: 0.5rem; }
                    .text-center { text-align: center; }
                    .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
                    .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
                    .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
                    .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
                    .text-6xl { font-size: 3.75rem; line-height: 1; }
                    .font-bold { font-weight: 700; }
                    .font-semibold { font-weight: 600; }
                    .font-medium { font-weight: 500; }
                    .text-blue-600 { color: #2563eb; }
                    .text-blue-800 { color: #1e40af; }
                    .text-blue-500 { color: #3b82f6; }
                    .text-gray-600 { color: #4b5563; }
                    .text-gray-700 { color: #374151; }
                    .text-gray-800 { color: #1f2937; }
                    .text-gray-500 { color: #6b7280; }
                    .text-white { color: #ffffff; }
                    .text-orange-800 { color: #9a3412; }
                    .text-orange-600 { color: #ea580c; }
                    .text-red-800 { color: #991b1b; }
                    .text-red-600 { color: #dc2626; }
                    .bg-gray-100 { background-color: #f3f4f6; }
                    .bg-white { background-color: #ffffff; }
                    .bg-blue-500 { background-color: #3b82f6; }
                    .bg-blue-600 { background-color: #2563eb; }
                    .bg-blue-50 { background-color: #eff6ff; }
                    .bg-orange-50 { background-color: #fff7ed; }
                    .bg-red-50 { background-color: #fef2f2; }
                    .bg-green-500 { background-color: #10b981; }
                    .bg-red-500 { background-color: #ef4444; }
                    .min-h-screen { min-height: 100vh; }
                    .w-full { width: 100%; }
                    .w-8 { width: 2rem; }
                    .h-8 { height: 2rem; }
                    .h-48 { height: 12rem; }
                    .max-w-md { max-width: 28rem; }
                    .rounded-lg { border-radius: 0.5rem; }
                    .rounded-full { border-radius: 9999px; }
                    .rounded { border-radius: 0.25rem; }
                    .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
                    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
                    .grid { display: grid; }
                    .gap-4 { gap: 1rem; }
                    .hidden { display: none; }
                    .block { display: block; }
                    .inline-block { display: inline-block; }
                    .flex { display: flex; }
                    .items-center { align-items: center; }
                    .relative { position: relative; }
                    .absolute { position: absolute; }
                    .fixed { position: fixed; }
                    .top-2 { top: 0.5rem; }
                    .top-4 { top: 1rem; }
                    .right-2 { right: 0.5rem; }
                    .left-1\\/2 { left: 50%; }
                    .transform { transform: var(--tw-transform); }
                    .-translate-x-1\\/2 { --tw-translate-x: -50%; transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y)); }
                    .border-2 { border-width: 2px; }
                    .border-4 { border-width: 4px; }
                    .border { border-width: 1px; }
                    .border-gray-200 { border-color: #e5e7eb; }
                    .border-gray-300 { border-color: #d1d5db; }
                    .border-blue-200 { border-color: #bfdbfe; }
                    .border-orange-200 { border-color: #fed7aa; }
                    .border-red-200 { border-color: #fecaca; }
                    .border-t-blue-500 { border-top-color: #3b82f6; }
                    .focus\\:border-blue-500:focus { border-color: #3b82f6; }
                    .focus\\:outline-none:focus { outline: 2px solid transparent; outline-offset: 2px; }
                    .hover\\:bg-blue-600:hover { background-color: #2563eb; }
                    .hover\\:shadow-lg:hover { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
                    .transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
                    .transition-shadow { transition-property: box-shadow; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
                    .duration-300 { transition-duration: 300ms; }
                    .overflow-hidden { overflow: hidden; }
                    .object-cover { object-fit: cover; }
                    .z-50 { z-index: 50; }
                    button { cursor: pointer; }
                `;
                
                return new Response(basicCSS, {
                    status: 200,
                    headers: { 
                        'Content-Type': 'text/css',
                        'X-Offline-CSS': 'true'
                    }
                });
            }
            
            throw error;
        }
    }
}

async function handleApiRequest(request) {
    console.log('Service Worker: Procesando petición API (solo red, no caché):', request.url);
    
    // Para peticiones de API, NUNCA usar caché, siempre red
    const networkResponse = await fetch(request);
    console.log('Service Worker: Respuesta API exitosa desde red');
    return networkResponse;
}

async function handleOfflineApiResponse() {
    console.log('Service Worker: Generando respuesta API offline (fallback)');
    
    // Crear una respuesta JSON con datos ficticios cuando no hay red
    const offlineData = {
        drinks: [{
            idDrink: "offline-001",
            strDrink: "Cóctel Especial (Sin Conexión)",
            strDrinkThumb: "/assets/imagenParaPlaceholder.jpg"
        }]
    };
    
    return new Response(JSON.stringify(offlineData), {
        status: 200,
        statusText: 'OK',
        headers: {
            'Content-Type': 'application/json',
            'X-Offline-Response': 'true'
        }
    });
}

async function handleOtherRequests(request) {
    // Para otras peticiones, estrategia cache-first
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // Si no está en caché, fetchear de la red
    try {
        const networkResponse = await fetch(request);
        
        // Opcionalmente cachear respuestas exitosas
        if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            cache.put(request, responseClone);
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Error en petición de red:', error);
        throw error;
    }
}

async function handleOtherRequests(request) {
    // Para peticiones que no son App Shell ni API
    console.log('Service Worker: Manejando petición externa:', request.url);
    
    // Intentar red primero, luego caché
    try {
        return await fetch(request);
    } catch (error) {
        // Si falla la red, buscar en caché
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('Service Worker: Sirviendo desde caché petición externa:', request.url);
            return cachedResponse;
        }
        
        // Si tampoco está en caché, respuesta genérica
        console.log('Service Worker: Petición externa no disponible offline:', request.url);
        return new Response('Recurso no disponible offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Manejo de mensajes desde la aplicación principal
self.addEventListener('message', (event) => {
    console.log('Service Worker: Mensaje recibido:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});