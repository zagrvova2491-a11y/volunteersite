class MapManager {
    constructor() {
        this.mainMap = null;
        this.locationMap = null;
        this.markers = [];
        this.userMarker = null;
        this.selectedLocation = null;
        this.defaultCoords = { lat: 55.0084, lng: 82.9357 };
        this.geocoder = null;
    }

    initMainMap(city) {
        const mapEl = document.getElementById('mainMap');
        if (!mapEl || typeof google === 'undefined') return;

        let center = this.defaultCoords;
        if (city) {
            const cityCoords = database.getCityCoordinates(city);
            if (cityCoords) center = cityCoords;
        }

        this.mainMap = new google.maps.Map(mapEl, {
            zoom: 12,
            center: center,
            mapTypeControl: false,
            streetViewControl: false
        });

        this.showUserLocation();
    }

    initLocationMap(onLocationSelect) {
        const mapEl = document.getElementById('locationMap');
        if (!mapEl || typeof google === 'undefined') return;

        const center = this.defaultCoords;
        
        this.locationMap = new google.maps.Map(mapEl, {
            zoom: 13,
            center: center,
            mapTypeControl: false,
            streetViewControl: false
        });

        this.geocoder = new google.maps.Geocoder();

        let marker = null;

        this.locationMap.addListener('click', (e) => {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            
            if (marker) marker.setMap(null);
            
            marker = new google.maps.Marker({
                position: { lat, lng },
                map: this.locationMap,
                draggable: true,
                animation: google.maps.Animation.DROP
            });

            this.selectedLocation = { lat, lng };
            
            this.geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                let address = 'Адрес не определен';
                if (status === 'OK' && results[0]) {
                    address = results[0].formatted_address;
                }
                
                this.selectedLocation.address = address;
                
                if (onLocationSelect) {
                    onLocationSelect({ lat, lng, address });
                }
            });
        });

        return this.locationMap;
    }

    geocodeAddress(address, callback) {
        if (!this.geocoder) this.geocoder = new google.maps.Geocoder();
        
        this.geocoder.geocode({ address: address }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const location = results[0].geometry.location;
                callback({
                    lat: location.lat(),
                    lng: location.lng(),
                    address: results[0].formatted_address
                });
            } else {
                callback(null);
            }
        });
    }

    showUserLocation() {
        const location = database.getUserLocation();
        if (!location || !this.mainMap) return;

        if (this.userMarker) this.userMarker.setMap(null);

        this.userMarker = new google.maps.Marker({
            position: { lat: location.lat, lng: location.lng },
            map: this.mainMap,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#f44336',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2
            },
            title: location.source === 'gps' ? 'Ваше местоположение (GPS)' : 'Ваш город'
        });

        this.mainMap.setCenter({ lat: location.lat, lng: location.lng });
        if (location.source === 'gps') this.mainMap.setZoom(14);
    }

    updateEvents(events) {
        this.markers.forEach(m => m.setMap(null));
        this.markers = [];

        if (!this.mainMap) return;

        events.forEach(event => {
            if (!event.location || !event.location.lat || !event.location.lng) return;

            const isFull = (event.currentVolunteers || 0) >= (event.maxVolunteers || 50);
            
            const marker = new google.maps.Marker({
                position: { lat: event.location.lat, lng: event.location.lng },
                map: this.mainMap,
                title: event.title,
                icon: {
                    url: `data:image/svg+xml;base64,${btoa(`
                        <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="16" cy="16" r="14" fill="${isFull ? '#ff9800' : '#4caf50'}" stroke="white" stroke-width="2"/>
                            <text x="16" y="21" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${event.currentVolunteers || 0}</text>
                        </svg>
                    `)}`,
                    scaledSize: new google.maps.Size(32, 32)
                }
            });

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 10px; max-width: 200px;">
                        <h4 style="margin: 0 0 5px 0; color: #2e7d32;">${event.title}</h4>
                        <p style="margin: 0; font-size: 12px; color: #666;">
                            📅 ${new Date(event.date).toLocaleDateString('ru-RU')}<br>
                            📍 ${event.location.address || 'Адрес не указан'}<br>
                            👥 ${event.currentVolunteers}/${event.maxVolunteers}
                        </p>
                    </div>
                `
            });

            marker.addListener('click', () => {
                infoWindow.open(this.mainMap, marker);
            });

            this.markers.push(marker);
        });

        if (this.markers.length > 0 && this.userMarker) {
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(this.userMarker.getPosition());
            this.markers.forEach(m => bounds.extend(m.getPosition()));
            this.mainMap.fitBounds(bounds);
        }
    }

    getSelectedLocation() {
        return this.selectedLocation;
    }

    clearSelectedLocation() {
        this.selectedLocation = null;
        if (this.locationMap) {
            this.locationMap.setCenter(this.defaultCoords);
        }
    }
}