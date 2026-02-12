class Database {
    constructor() {
        this.usersKey = 'ecoConnectUsers';
        this.eventsKey = 'ecoConnectEvents';
        this.currentUserKey = 'ecoConnectCurrentUser';
        this.registrationsKey = 'ecoConnectRegistrations';
        this.citiesKey = 'ecoConnectCities';
        this.userLocationKey = 'ecoConnectUserLocation';
        this.tasksKey = 'ecoConnectTasks';
        this.defaultCity = 'Новосибирск';
        this.defaultCoords = { lat: 55.0084, lng: 82.9357 };
        this.init();
    }

    init() {
        if (!this.getStorageItem(this.usersKey)) {
            const defaultUsers = [{
                id: '1',
                email: 'admin@ecoconnect.ru',
                password: this.hashPassword('admin123'),
                phone: '+79991234567',
                countryCode: '+7',
                lastName: 'Администратор',
                firstName: 'Системы',
                middleName: '',
                fullName: 'Администратор Системы',
                city: this.defaultCity,
                accountType: 'curator',
                interests: ['мусор', 'озеленение'],
                registeredAt: new Date().toISOString(),
                participatedEvents: [],
                createdEvents: []
            }];
            this.setStorageItem(this.usersKey, defaultUsers);
        }

        if (!this.getStorageItem(this.eventsKey)) {
            const demoEvents = this.createDemoEvents();
            this.setStorageItem(this.eventsKey, demoEvents);
        }

        if (!this.getStorageItem(this.registrationsKey)) {
            this.setStorageItem(this.registrationsKey, []);
        }

        if (!this.getStorageItem(this.citiesKey)) {
            const defaultCities = {
                'Новосибирск': this.defaultCoords,
                'Москва': { lat: 55.7558, lng: 37.6173 },
                'Санкт-Петербург': { lat: 59.9343, lng: 30.3351 },
                'Екатеринбург': { lat: 56.8389, lng: 60.6057 },
                'Казань': { lat: 55.7961, lng: 49.1064 }
            };
            this.setStorageItem(this.citiesKey, defaultCities);
        }
        
        if (!this.getStorageItem(this.tasksKey)) {
            this.setStorageItem(this.tasksKey, {});
        }
    }

    createDemoEvents() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);

        const events = [
            {
                id: 'demo-1',
                title: 'Уборка набережной Оби',
                date: tomorrow.toISOString().split('T')[0],
                time: '10:00',
                location: { 
                    lat: 55.0150, 
                    lng: 82.9500, 
                    address: 'Набережная реки Оби, район Железнодорожного вокзала, Новосибирск' 
                },
                description: 'Приглашаем всех желающих принять участие в ежемесячной уборке набережной.',
                maxVolunteers: 50,
                currentVolunteers: 15,
                volunteers: [],
                tags: ['мусор', 'реки'],
                creatorId: '1',
                creatorName: 'Администратор Системы',
                createdAt: now.toISOString(),
                chatLink: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                tasks: [
                    { id: 't1', name: 'Собрать мусор', target: 100, unit: 'кг', current: 0 },
                    { id: 't2', name: 'Убрать пластик', target: 50, unit: 'кг', current: 0 }
                ]
            },
            {
                id: 'demo-2',
                title: 'Посадка деревьев в Первомайском сквере',
                date: nextWeek.toISOString().split('T')[0],
                time: '11:00',
                location: { 
                    lat: 55.0300, 
                    lng: 82.9200, 
                    address: 'Первомайский сквер, центр Новосибирска' 
                },
                description: 'Весенняя посадка молодых деревьев и кустарников.',
                maxVolunteers: 30,
                currentVolunteers: 8,
                volunteers: [],
                tags: ['озеленение', 'парки'],
                creatorId: '1',
                creatorName: 'Администратор Системы',
                createdAt: now.toISOString(),
                chatLink: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                tasks: [
                    { id: 't1', name: 'Посадить деревья', target: 20, unit: 'шт', current: 0 },
                    { id: 't2', name: 'Установить опоры', target: 20, unit: 'шт', current: 0 }
                ]
            }
        ];

        this.updateStats({
            totalEvents: events.length,
            activeEvents: events.filter(e => new Date(e.date) >= now).length,
            completedEvents: events.filter(e => new Date(e.date) < now).length,
            trashCollected: 0,
            treesPlanted: 0
        });

        return events;
    }

    getStorageItem(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error(`Error reading ${key} from localStorage:`, e);
            return null;
        }
    }

    setStorageItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`Error writing ${key} to localStorage:`, e);
            if (e.name === 'QuotaExceededError') {
                alert('Хранилище переполнено. Пожалуйста, удалите старые данные.');
            }
            return false;
        }
    }

    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16) + '_' + btoa(password).split('').reverse().join('');
    }

    verifyPassword(inputPassword, storedPassword) {
        return this.hashPassword(inputPassword) === storedPassword;
    }

    saveUserLocation(location) {
        this.setStorageItem(this.userLocationKey, {
            ...location,
            timestamp: new Date().toISOString()
        });
    }

    getUserLocation() {
        return this.getStorageItem(this.userLocationKey);
    }

    sanitizeString(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    registerUser(userData) {
        let users = this.getUsers();
        if (!users) users = [];
        
        if (users.find(u => u.email === userData.email)) {
            throw new Error('Пользователь с таким email уже существует');
        }

        const newUser = {
            id: this.generateId(),
            email: userData.email,
            password: this.hashPassword(userData.password),
            countryCode: userData.countryCode,
            phone: userData.phone,
            lastName: this.sanitizeString(userData.lastName),
            firstName: this.sanitizeString(userData.firstName),
            middleName: this.sanitizeString(userData.middleName),
            fullName: this.sanitizeString(userData.fullName),
            city: this.sanitizeString(userData.city),
            accountType: userData.accountType,
            interests: userData.interests || [],
            registeredAt: new Date().toISOString(),
            participatedEvents: [],
            createdEvents: []
        };

        users.push(newUser);
        this.setStorageItem(this.usersKey, users);
        
        return newUser;
    }

    loginUser(email, password) {
        const users = this.getUsers();
        const user = users.find(u => u.email === email);
        
        if (!user) {
            throw new Error('Пользователь не найден');
        }

        if (!this.verifyPassword(password, user.password)) {
            throw new Error('Неверный пароль');
        }

        const { password: _, ...userWithoutPassword } = user;
        this.setCurrentUser(userWithoutPassword);
        
        return userWithoutPassword;
    }

    logoutUser() {
        localStorage.removeItem(this.currentUserKey);
    }

    getCurrentUser() {
        return this.getStorageItem(this.currentUserKey);
    }

    setCurrentUser(user) {
        this.setStorageItem(this.currentUserKey, user);
    }

    isAuthenticated() {
        return !!this.getCurrentUser();
    }

    getUsers() {
        return this.getStorageItem(this.usersKey) || [];
    }

    updateUser(userId, updates) {
        const users = this.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            throw new Error('Пользователь не найден');
        }

        const sanitizedUpdates = { ...updates };
        ['lastName', 'firstName', 'middleName', 'fullName', 'city'].forEach(field => {
            if (sanitizedUpdates[field]) {
                sanitizedUpdates[field] = this.sanitizeString(sanitizedUpdates[field]);
            }
        });

        users[userIndex] = { ...users[userIndex], ...sanitizedUpdates };
        this.setStorageItem(this.usersKey, users);

        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.id === userId) {
            this.setCurrentUser({ ...currentUser, ...sanitizedUpdates });
        }

        return users[userIndex];
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getEvents() {
        return this.getStorageItem(this.eventsKey) || [];
    }

    saveEvents(events) {
        this.setStorageItem(this.eventsKey, events);
    }

    createEvent(eventData) {
        const events = this.getEvents();
        
        const eventDate = new Date(eventData.date);
        const now = new Date();
        let status = 'upcoming';
        if (eventDate < now) status = 'completed';
        else if ((eventDate - now) / (1000 * 60 * 60 * 24) <= 7) status = 'active';

        const newEvent = {
            id: this.generateId(),
            title: this.sanitizeString(eventData.title),
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            description: this.sanitizeString(eventData.description),
            maxVolunteers: parseInt(eventData.maxVolunteers) || 50,
            currentVolunteers: 0,
            volunteers: [],
            tags: eventData.tags || [],
            tasks: eventData.tasks || [],
            chatLink: eventData.chatLink || '',
            status: status,
            creatorId: eventData.creatorId,
            creatorName: eventData.creatorName,
            createdAt: new Date().toISOString()
        };
        
        events.push(newEvent);
        this.saveEvents(events);
        
        this.updateStats({
            totalEvents: events.length
        });
        
        return newEvent;
    }

    deleteEvent(eventId) {
        const events = this.getEvents();
        const index = events.findIndex(e => e.id === eventId);
        if (index > -1) {
            events.splice(index, 1);
            this.saveEvents(events);
            return true;
        }
        return false;
    }

    updateEvent(eventId, updates) {
        const events = this.getEvents();
        const index = events.findIndex(e => e.id === eventId);
        if (index === -1) return null;
        
        events[index] = { ...events[index], ...updates };
        this.saveEvents(events);
        return events[index];
    }

    addRegistration(registration) {
        const registrations = this.getRegistrations();
        registrations.push(registration);
        this.setStorageItem(this.registrationsKey, registrations);
        return registration;
    }

    getRegistrations() {
        return this.getStorageItem(this.registrationsKey) || [];
    }

    getEventRegistrations(eventId) {
        return this.getRegistrations().filter(reg => reg.eventId === eventId);
    }

    getUserRegistrations(userId) {
        return this.getRegistrations().filter(reg => reg.userId === userId);
    }

    removeRegistration(eventId, userId) {
        const registrations = this.getRegistrations();
        const index = registrations.findIndex(reg => 
            reg.eventId === eventId && reg.userId === userId
        );
        if (index !== -1) {
            registrations.splice(index, 1);
            this.setStorageItem(this.registrationsKey, registrations);
            return true;
        }
        return false;
    }

    getCityCoordinates(cityName) {
        const cities = this.getStorageItem(this.citiesKey) || {};
        return cities[cityName] || null;
    }

    addCityCoordinates(cityName, coordinates) {
        const cities = this.getStorageItem(this.citiesKey) || {};
        cities[cityName] = coordinates;
        this.setStorageItem(this.citiesKey, cities);
        return coordinates;
    }

    getUserStats(userId) {
        const registrations = this.getUserRegistrations(userId);
        const events = this.getEvents();
        const userEvents = events.filter(event => 
            registrations.some(reg => reg.eventId === event.id)
        );

        return {
            totalParticipations: registrations.length,
            upcomingEvents: userEvents.filter(event => new Date(event.date) > new Date()).length,
            completedEvents: userEvents.filter(event => new Date(event.date) <= new Date()).length,
            createdEvents: events.filter(e => e.creatorId === userId).length
        };
    }

    getSystemStats() {
        const users = this.getUsers();
        const events = this.getEvents();
        
        return {
            totalUsers: users.length,
            totalEvents: events.length,
            activeEvents: events.filter(e => new Date(e.date) >= new Date()).length,
            totalVolunteers: events.reduce((sum, e) => sum + (e.currentVolunteers || 0), 0)
        };
    }

    getStats() {
        return this.getStorageItem('ecoConnectStats') || {
            trashCollected: 0,
            treesPlanted: 0,
            dailyUsers: {},
            lastUpdated: new Date().toISOString()
        };
    }

    updateStats(updates) {
        const stats = this.getStats();
        const newStats = { ...stats, ...updates, lastUpdated: new Date().toISOString() };
        this.setStorageItem('ecoConnectStats', newStats);
        return newStats;
    }

    incrementDailyUsers() {
        const today = new Date().toDateString();
        const stats = this.getStats();
        if (!stats.dailyUsers) stats.dailyUsers = {};
        stats.dailyUsers[today] = (stats.dailyUsers[today] || 0) + 1;
        this.updateStats({ dailyUsers: stats.dailyUsers });
    }

    getUserTasks(userId) {
        const allTasks = this.getStorageItem(this.tasksKey) || {};
        return allTasks[userId] || {};
    }

    saveUserTask(userId, eventId, taskId, progress) {
        const allTasks = this.getStorageItem(this.tasksKey) || {};
        if (!allTasks[userId]) allTasks[userId] = {};
        if (!allTasks[userId][eventId]) allTasks[userId][eventId] = {};
        
        allTasks[userId][eventId][taskId] = {
            progress: progress,
            updatedAt: new Date().toISOString()
        };
        
        this.setStorageItem(this.tasksKey, allTasks);
        return allTasks[userId][eventId][taskId];
    }
}
window.database = new Database();