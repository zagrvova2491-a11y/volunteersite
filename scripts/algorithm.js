class AlgorithmManager {
    constructor(currentUser) {
        this.currentUser = currentUser;
        this.userLocation = null;
        this.useGPS = false;
        this.geocoder = null;
        this.init();
    }

    init() {
        this.geocoder = new google.maps.Geocoder();
        this.loadUserLocation();
    }

    async loadUserLocation() {
        const savedLocation = database.getUserLocation();
        if (savedLocation) {
            this.userLocation = savedLocation;
            this.useGPS = true;
            return;
        }

        if (this.currentUser && this.currentUser.city) {
            const cityCoords = database.getCityCoordinates(this.currentUser.city);
            if (cityCoords) {
                this.userLocation = cityCoords;
                return;
            }
        }

        this.userLocation = { lat: 55.7558, lng: 37.6173 };
    }

    async requestGPS() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(false);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        source: 'gps'
                    };
                    this.useGPS = true;
                    database.saveUserLocation(this.userLocation);
                    resolve(true);
                },
                (error) => {
                    this.useGPS = false;
                    resolve(false);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }

    calculateDistance(point1, point2) {
        if (!point1 || !point2) return Infinity;
        
        const from = this.useGPS && this.userLocation ? this.userLocation : point1;
        
        const R = 6371;
        const dLat = this.toRad(point2.lat - from.lat);
        const dLon = this.toRad(point2.lng - from.lng);
        const lat1 = this.toRad(from.lat);
        const lat2 = this.toRad(point2.lat);

        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        return R * c;
    }

    toRad(value) {
        return value * Math.PI / 180;
    }

    async findNearestEvent() {
        const events = database.getEvents();
        if (events.length === 0) {
            window.app.showNotification('Нет доступных мероприятий', 'info');
            return null;
        }

        const now = new Date();
        const availableEvents = events.filter(event => {
            const eventDate = new Date(event.date + 'T' + (event.time || '00:00'));
            const hasSpace = (event.currentVolunteers || 0) < (event.maxVolunteers || 50);
            const isFuture = eventDate > now;
            
            let isNotRegistered = true;
            if (this.currentUser) {
                isNotRegistered = !this.isUserRegistered(event.id);
            }
            
            return isFuture && hasSpace && isNotRegistered;
        });

        if (availableEvents.length === 0) {
            window.app.showNotification('Нет доступных мероприятий для записи', 'info');
            return null;
        }

        const eventsWithDistance = availableEvents.map(event => {
            const distance = this.calculateDistance(this.userLocation, event.location);
            return { ...event, distance };
        });

        eventsWithDistance.sort((a, b) => a.distance - b.distance);

        const nearestEvent = eventsWithDistance[0];
        
        if (nearestEvent.distance > 100) {
            window.app.showNotification(
                `Ближайшее мероприятие в ${Math.round(nearestEvent.distance)} км от вас`, 
                'warning'
            );
        }

        return nearestEvent;
    }

    isUserRegistered(eventId) {
        if (!this.currentUser) return false;
        const userRegistrations = database.getUserRegistrations(this.currentUser.id);
        return userRegistrations.some(reg => reg.eventId === eventId);
    }

    getEventsByDistance(events) {
        const now = new Date();
        
        return events
            .filter(event => new Date(event.date) > now)
            .map(event => ({
                ...event,
                distance: this.calculateDistance(this.userLocation, event.location)
            }))
            .sort((a, b) => a.distance - b.distance);
    }

    getCurrentLocation() {
        return this.userLocation;
    }

    isUsingGPS() {
        return this.useGPS;
    }
}