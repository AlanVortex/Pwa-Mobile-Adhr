# Cocktail Finder PWA 🍸

Una Progressive Web App para buscar y descubrir recetas de cócteles increíbles.

## Características

- **App Shell Architecture**: La interfaz y estilos siempre funcionan, incluso offline
- **Búsqueda Online**: Consume la API de TheCocktailDB para resultados en tiempo real
- **Funcionalidad Offline**: El sitio sigue funcionando sin conexión
- **Service Worker**: Cachea recursos críticos y maneja respuestas offline
- **Responsive Design**: Optimizado para dispositivos móviles con TailwindCSS

## Arquitectura

### App Shell (Siempre disponible offline)
- `index.html` - Estructura principal
- `main.js` - Lógica de la aplicación
- `TailwindCSS CDN` - Estilos (cacheado)
- Recursos en `/assets/` - Iconos, manifest, imagen offline

### Estrategia de Cache

**OnlyCache para App Shell:**
- Todos los recursos del App Shell se cachean automáticamente
- La app funciona completamente offline (excepto búsquedas nuevas)
- Los estilos y estructura siempre están disponibles

**Network-Only para API:**
- Las búsquedas siempre intentan la red primero
- Si no hay conexión, se muestra un cóctel de ejemplo
- No se cachean resultados de búsqueda (datos siempre frescos)

## Cómo funciona

### Online:
1. La app carga normalmente con todos los estilos
2. Las búsquedas consultan la API real
3. Se muestran resultados actualizados

### Offline:
1. La app sigue funcionando completamente
2. Todos los estilos y la interfaz están disponibles
3. Las búsquedas muestran un cóctel de ejemplo
4. El usuario puede navegar la interfaz normalmente

## Instalación Local

1. Clona o descarga los archivos
2. Sirve desde un servidor HTTP (requerido para Service Workers)

### Opción 1: Python
```bash
python -m http.server 8000
```

### Opción 2: Node.js (npx)
```bash
npx http-server
```

### Opción 3: PHP
```bash
php -S localhost:8000
```

## Archivos del Proyecto

```
/
├── index.html          # App Shell principal
├── main.js            # Lógica de la aplicación
├── sw.js              # Service Worker
└── assets/
    ├── manifest.json   # Manifiesto PWA
    ├── icon-192.png   # Icono 192x192
    ├── icon-512.png   # Icono 512x512
    └── offline.png    # Imagen para modo offline
```

## Testing Offline

Para probar la funcionalidad offline:

1. Abre la app en el navegador
2. Abre DevTools → Application → Service Workers
3. Verifica que el SW esté activo
4. Ve a Network tab y marca "Offline"
5. Recarga la página - debe seguir funcionando
6. Intenta buscar - debe mostrar el cóctel de ejemplo

## API Utilizada

- **TheCocktailDB**: `https://www.thecocktaildb.com/api/json/v1/1/search.php?s=<query>`
- Respuesta: Array de cócteles con `strDrink` (nombre) y `strDrinkThumb` (imagen)

## Notas Técnicas

- Los Service Workers requieren HTTPS en producción (o localhost para desarrollo)
- La estrategia OnlyCache asegura que el App Shell siempre funcione
- Las imágenes de cócteles se cargan bajo demanda y tienen fallback offline
- El manifiesto permite instalar la app como PWA nativa