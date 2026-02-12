class EcoConnectApp {
    constructor() {
        this.currentUser = database.getCurrentUser();
        this.events = database.getEvents();
        this.isGuest = !this.currentUser;
        this.taskCounters = {};
        this.init();
    }

    async init() {
        this.initializeModules();
        await this.checkGPSAndShowModal();
        this.setupEventListeners();
        this.setupUI();
        this.loadData();
        this.setupCreateEventModal();
        this.setupTaskEditor();
    }

    setupCreateEventModal() {
        const createBtn = document.getElementById('createEventBtn');
        const modal = document.getElementById('createEventModal');
        const closeBtn = document.getElementById('closeCreateModal');
        const cancelBtn = document.getElementById('cancelCreate');
        const form = document.getElementById('createEventForm');
        const searchAddressBtn = document.getElementById('searchAddressBtn');
        const addressInput = document.getElementById('eventAddress');

        if (createBtn) {
            createBtn.addEventListener('click', () => {
                if (this.requireAuth()) {
                    ModalManager.openModal('createEventModal');
                    setTimeout(() => {
                        this.initCreateEventMap();
                    }, 100);
                }
            });
        }

        if (closeBtn) closeBtn.addEventListener('click', () => ModalManager.closeModal('createEventModal'));
        if (cancelBtn) cancelBtn.addEventListener('click', () => ModalManager.closeModal('createEventModal'));

        if (searchAddressBtn && addressInput) {
            searchAddressBtn.addEventListener('click', () => {
                const address = addressInput.value.trim();
                if (!address) {
                    this.showNotification('Введите адрес', 'error');
                    return;
                }
                
                this.mapManager.geocodeAddress(address, (result) => {
                    if (result) {
                        this.mapManager.selectedLocation = result;
                        this.mapManager.locationMap.setCenter({ lat: result.lat, lng: result.lng });
                        new google.maps.Marker({
                            position: { lat: result.lat, lng: result.lng },
                            map: this.mapManager.locationMap,
                            animation: google.maps.Animation.DROP
                        });
                        this.showNotification('Адрес найден!', 'success');
                    } else {
                        this.showNotification('Адрес не найден', 'error');
                    }
                });
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateEvent();
            });
        }
    }

    initCreateEventMap() {
        if (!this.mapManager.locationMap) {
            this.mapManager.initLocationMap((location) => {
                document.getElementById('eventAddress').value = location.address;
            });
        }
    }

    setupTaskEditor() {
        const addBtn = document.getElementById('addTaskBtn');
        const container = document.getElementById('tasksContainer');
        
        if (addBtn && container) {
            addBtn.addEventListener('click', () => {
                const taskId = 'task_' + Date.now();
                const taskEl = document.createElement('div');
                taskEl.className = 'task-editor-item';
                taskEl.innerHTML = `
                    <input type="text" placeholder="Название задачи" class="task-name-input" required>
                    <input type="number" placeholder="Цель" class="task-target-input" min="1" required>
                    <input type="text" placeholder="ед." class="task-unit-input" value="кг">
                    <button type="button" class="btn btn-danger btn-small remove-task-btn">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                
                taskEl.querySelector('.remove-task-btn').addEventListener('click', () => {
                    taskEl.remove();
                });
                
                container.appendChild(taskEl);
            });
        }
    }

    handleCreateEvent() {
        const title = document.getElementById('eventTitle').value;
        const date = document.getElementById('eventDate').value;
        const time = document.getElementById('eventTime').value;
        const maxVolunteers = document.getElementById('eventMaxVolunteers').value;
        const description = document.getElementById('eventDescription').value;
        const chatLink = document.getElementById('eventChatLink').value;
        
        const location = this.mapManager.getSelectedLocation();
        if (!location || !location.lat || !location.lng) {
            this.showNotification('Укажите местоположение на карте', 'error');
            return;
        }

        const tags = Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(cb => cb.value);
        
        const taskElements = document.querySelectorAll('.task-editor-item');
        const tasks = Array.from(taskElements).map(el => ({
            id: 't_' + Math.random().toString(36).substr(2, 9),
            name: el.querySelector('.task-name-input').value,
            target: parseInt(el.querySelector('.task-target-input').value) || 0,
            unit: el.querySelector('.task-unit-input').value || 'шт',
            current: 0
        })).filter(t => t.name && t.target > 0);

        const eventData = {
            title,
            date,
            time,
            location,
            description,
            maxVolunteers: parseInt(maxVolunteers),
            tags,
            tasks,
            chatLink,
            creatorId: this.currentUser.id,
            creatorName: this.currentUser.fullName
        };

        try {
            const newEvent = database.createEvent(eventData);
            this.events = database.getEvents();
            
            ModalManager.closeModal('createEventModal');
            this.showNotification('Мероприятие успешно создано!', 'success');
            
            document.getElementById('createEventForm').reset();
            document.getElementById('tasksContainer').innerHTML = '';
            this.mapManager.clearSelectedLocation();
            
            if (this.eventsManager) {
                this.eventsManager.renderEvents(this.events);
            }
            if (this.mapManager) {
                this.mapManager.updateEvents(this.events);
            }
            
        } catch (error) {
            this.showNotification('Ошибка при создании: ' + error.message, 'error');
        }
    }

    async checkGPSAndShowModal() {
        const savedLocation = database.getUserLocation();
        if (savedLocation && savedLocation.source === 'gps') {
            if (this.algorithmManager) {
                this.algorithmManager.userLocation = savedLocation;
                this.algorithmManager.useGPS = true;
            }
            return;
        }

        if (sessionStorage.getItem('gpsDenied') === 'true') return;

        if (navigator.geolocation) {
            try {
                const position = await this.getCurrentPosition();
                if (position) {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        source: 'gps',
                        timestamp: new Date().toISOString()
                    };
                    database.saveUserLocation(location);
                    if (this.algorithmManager) {
                        this.algorithmManager.userLocation = location;
                        this.algorithmManager.useGPS = true;
                    }
                    return;
                }
            } catch (e) {
                console.log('GPS не получен:', e.message);
            }
        }

        await this.showGPSModal();
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => resolve(position),
                (error) => reject(error),
                { timeout: 5000, maximumAge: 60000 }
            );
        });
    }

    async showGPSModal() {
        const modal = document.getElementById('gpsModal');
        const allowBtn = document.getElementById('allowGpsBtn');
        const denyBtn = document.getElementById('denyGpsBtn');

        if (!modal || !allowBtn || !denyBtn) return;

        modal.classList.add('show');

        return new Promise((resolve) => {
            let resolved = false;

            const cleanup = () => {
                allowBtn.removeEventListener('click', handleAllow);
                denyBtn.removeEventListener('click', handleDeny);
            };

            const handleAllow = async () => {
                if (resolved) return;
                resolved = true;
                cleanup();
                
                modal.classList.remove('show');
                
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const location = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                                accuracy: position.coords.accuracy,
                                source: 'gps',
                                timestamp: new Date().toISOString()
                            };
                            database.saveUserLocation(location);
                            if (this.algorithmManager) {
                                this.algorithmManager.userLocation = location;
                                this.algorithmManager.useGPS = true;
                            }
                            if (this.mapManager) {
                                this.mapManager.showUserLocation();
                                this.mapManager.updateEvents(this.events);
                            }
                            resolve(true);
                        },
                        (error) => {
                            this.showNotification('Не удалось получить GPS', 'warning');
                            resolve(false);
                        }
                    );
                }
            };

            const handleDeny = () => {
                if (resolved) return;
                resolved = true;
                cleanup();
                modal.classList.remove('show');
                sessionStorage.setItem('gpsDenied', 'true');
                resolve(false);
            };

            allowBtn.addEventListener('click', handleAllow);
            denyBtn.addEventListener('click', handleDeny);
        });
    }

    initializeModules() {
        this.algorithmManager = new AlgorithmManager(this.currentUser);
        this.mapManager = new MapManager();
        
        if (typeof google !== 'undefined') {
            const city = this.currentUser?.city || 'Новосибирск';
            this.mapManager.initMainMap(city);
        }

        this.eventsManager = new EventsManager(this.events, this.currentUser, this);
        this.dashboardManager = new DashboardManager(this.currentUser, this);
    }

    setupEventListeners() {
        document.addEventListener('eventsUpdated', (e) => {
            this.events = e.detail.events;
            this.updateUI();
        });

        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn && this.isGuest) {
            loginBtn.style.display = 'flex';
            loginBtn.addEventListener('click', () => {
                window.location.href = 'login.html';
            });
        }

        const userMenuBtn = document.getElementById('userMenuBtn');
        const userDropdown = document.getElementById('userDropdown');
        
        if (userMenuBtn && userDropdown) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
            });

            document.addEventListener('click', () => {
                userDropdown.style.display = 'none';
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                database.logoutUser();
                window.location.href = 'index.html';
            });
        }

        const closeSuccessModal = document.getElementById('closeSuccessModal');
        const closeSuccessBtn = document.getElementById('closeSuccessBtn');
        if (closeSuccessModal) {
            closeSuccessModal.addEventListener('click', () => ModalManager.closeModal('successModal'));
        }
        if (closeSuccessBtn) {
            closeSuccessBtn.addEventListener('click', () => ModalManager.closeModal('successModal'));
        }

        const myEventsLink = document.getElementById('myEventsLink');
        if (myEventsLink && !this.isGuest) {
            myEventsLink.style.display = 'inline-block';
            myEventsLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showMyEvents();
            });
        }
    }

    setupUI() {
        const loginBtn = document.getElementById('loginBtn');
        const userMenuBtn = document.getElementById('userMenuBtn');
        
        if (this.isGuest) {
            if (loginBtn) loginBtn.style.display = 'flex';
            if (userMenuBtn) userMenuBtn.style.display = 'none';
            
            this.updateWelcomeText();
            
            const createCard = document.getElementById('createEventDashboardCard');
            if (createCard) createCard.style.display = 'none';
        } else {
            if (loginBtn) loginBtn.style.display = 'none';
            if (userMenuBtn) userMenuBtn.style.display = 'flex';
            
            this.updateUserStats();
            const city = this.currentUser.city || 'Новосибирск';
            const welcomeTitle = document.getElementById('welcomeTitle');
            if (welcomeTitle) welcomeTitle.textContent = `Добро пожаловать, ${this.currentUser.firstName}! (${city})`;
            
            if (this.currentUser.accountType === 'curator') {
                const createCard = document.getElementById('createEventDashboardCard');
                if (createCard) createCard.style.display = 'block';
            }
        }
    }

    loadData() {
        this.updateUI();
        if (this.mapManager) {
            this.mapManager.updateEvents(this.events);
        }
        if (!this.isGuest) {
            this.renderMyEvents();
        }
    }

    updateUI() {
        if (this.eventsManager) {
            this.eventsManager.renderEvents(this.events);
        }
        if (this.mapManager) {
            this.mapManager.updateEvents(this.events);
        }
        if (!this.isGuest) {
            this.renderMyEvents();
        }
    }

    updateWelcomeText() {
        const welcomeTitle = document.getElementById('welcomeTitle');
        const welcomeSubtitle = document.getElementById('welcomeSubtitle');
        
        if (this.isGuest) {
            if (this.algorithmManager && this.algorithmManager.useGPS) {
                if (welcomeTitle) welcomeTitle.textContent = 'Добро пожаловать!';
                if (welcomeSubtitle) welcomeSubtitle.textContent = 'Мы нашли ваше местоположение. Показываем ближайшие мероприятия.';
            }
        }
    }

    updateUserStats() {
        if (!this.currentUser) return;

        const userName = document.getElementById('userName');
        const userFullName = document.getElementById('userFullName');
        const userEmail = document.getElementById('userEmail');
        const userRole = document.getElementById('userRole');
        const participatedCount = document.getElementById('participatedCount');
        const daysInSystem = document.getElementById('daysInSystem');

        if (userName) userName.textContent = this.currentUser.firstName;
        if (userFullName) userFullName.textContent = this.currentUser.fullName;
        if (userEmail) userEmail.textContent = this.currentUser.email;
        
        if (userRole) {
            userRole.textContent = this.currentUser.accountType === 'curator' ? 'Куратор' : 'Участник';
        }

        if (participatedCount) {
            const regs = database.getUserRegistrations(this.currentUser.id);
            participatedCount.textContent = regs.length;
        }

        if (daysInSystem) {
            const regDate = new Date(this.currentUser.registeredAt);
            const days = Math.floor((new Date() - regDate) / (1000 * 60 * 60 * 24));
            daysInSystem.textContent = Math.max(days, 0);
        }

        if (this.currentUser.accountType === 'curator') {
            const curatorStats = document.getElementById('curatorStats');
            const createdCount = document.getElementById('createdEventsCount');
            if (curatorStats) curatorStats.style.display = 'flex';
            if (createdCount) {
                const created = this.events.filter(e => e.creatorId === this.currentUser.id).length;
                createdCount.textContent = created;
            }
        }
    }

    showMyEvents() {
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('events').style.display = 'none';
        document.getElementById('map').style.display = 'none';
        document.getElementById('my-events').style.display = 'block';
        this.renderMyEvents();
    }

    renderMyEvents() {
        if (this.isGuest) return;
        
        const container = document.getElementById('myEventsContainer');
        if (!container) return;

        const registrations = database.getUserRegistrations(this.currentUser.id);
        const myEventIds = registrations.map(r => r.eventId);
        const myEvents = this.events.filter(e => myEventIds.includes(e.id));

        if (myEvents.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>Вы пока не записаны ни на одно мероприятие</h3>
                    <p>Выберите мероприятие из списка и присоединяйтесь!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = myEvents.map(event => this.createMyEventCard(event)).join('');
        this.attachMyEventsHandlers(myEvents);
    }

    createMyEventCard(event) {
        const progress = this.calculateEventProgress(event);
        const hasChat = event.chatLink && event.chatLink.trim() !== '';
        
        return `
            <div class="event-card my-event-card" data-event-id="${event.id}">
                <div class="event-header">
                    <h3 class="event-title">${this.escapeHtml(event.title)}</h3>
                    <span class="event-date">${this.formatDate(event.date)}</span>
                </div>
                
                <div class="event-progress-bar" style="margin-bottom: 15px;">
                    <div class="progress-bar-custom">
                        <div class="progress-fill-custom" style="width: ${progress.percent}%"></div>
                    </div>
                    <span class="progress-text">${progress.percent}% выполнено</span>
                </div>
                
                <div class="task-progress-list">
                    ${(event.tasks || []).map((task, idx) => this.createTaskProgressHTML(event.id, task, idx)).join('')}
                </div>
                
                <div class="event-actions" style="margin-top: 15px;">
                    ${hasChat ? `
                        <a href="${event.chatLink}" target="_blank" class="btn chat-btn">
                            <i class="fab fa-telegram"></i> Вступить в чат
                        </a>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="window.app.leaveEvent('${event.id}')">
                        <i class="fas fa-sign-out-alt"></i> Отменить участие
                    </button>
                </div>
            </div>
        `;
    }

    createTaskProgressHTML(eventId, task, idx) {
        const percent = task.target > 0 ? Math.round((task.current / task.target) * 100) : 0;
        const userProgress = this.getUserTaskProgress(eventId, task.id);
        
        return `
            <div class="task-progress-item">
                <div class="task-header">
                    <span class="task-name">${this.escapeHtml(task.name)}</span>
                    <span class="task-target">${task.current} / ${task.target} ${task.unit}</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${percent}%">
                        <span class="progress-text">${percent}%</span>
                    </div>
                </div>
                <div class="task-input-group">
                    <input type="number" 
                           class="task-input" 
                           placeholder="Сколько ${task.unit} вы собрали?"
                           min="0"
                           id="task-input-${eventId}-${task.id}">
                    <button class="btn btn-primary btn-small" 
                            onclick="window.app.submitTaskProgress('${eventId}', '${task.id}', ${task.target - task.current})">
                        <i class="fas fa-plus"></i> Добавить
                    </button>
                </div>
                ${userProgress > 0 ? `<small style="color: rgba(255,255,255,0.7);">Ваш вклад: ${userProgress} ${task.unit}</small>` : ''}
            </div>
        `;
    }

    getUserTaskProgress(eventId, taskId) {
        const userTasks = database.getUserTasks(this.currentUser.id);
        return userTasks[eventId]?.[taskId]?.progress || 0;
    }

    submitTaskProgress(eventId, taskId, maxAllowed) {
        const input = document.getElementById(`task-input-${eventId}-${taskId}`);
        const value = parseInt(input.value);
        
        if (!value || value <= 0) {
            this.showNotification('Введите положительное число', 'error');
            return;
        }
        
        if (value > maxAllowed) {
            this.showNotification(`Максимум можно добавить: ${maxAllowed}`, 'error');
            return;
        }

        const events = database.getEvents();
        const event = events.find(e => e.id === eventId);
        if (!event) return;
        
        const task = event.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        task.current += value;
        database.saveEvents(events);
        
        database.saveUserTask(this.currentUser.id, eventId, taskId, 
            (this.getUserTaskProgress(eventId, taskId) + value));
        
        this.showNotification('Прогресс обновлен! Спасибо за вклад!', 'success');
        this.renderMyEvents();
        this.updateUI();
    }

    calculateEventProgress(event) {
        if (!event.tasks || event.tasks.length === 0) return { percent: 0 };
        
        const totalTarget = event.tasks.reduce((sum, t) => sum + (t.target || 0), 0);
        const totalCurrent = event.tasks.reduce((sum, t) => sum + (t.current || 0), 0);
        
        return {
            percent: totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0
        };
    }

    leaveEvent(eventId) {
        if (!confirm('Вы уверены, что хотите отменить участие?')) return;
        
        database.removeRegistration(eventId, this.currentUser.id);
        
        const events = database.getEvents();
        const event = events.find(e => e.id === eventId);
        if (event) {
            event.currentVolunteers = Math.max(0, (event.currentVolunteers || 0) - 1);
            database.saveEvents(events);
        }
        
        this.events = database.getEvents();
        this.showNotification('Вы отменили участие', 'info');
        this.renderMyEvents();
        this.updateUI();
    }

    attachMyEventsHandlers(events) {
        // Обработчики уже в inline onclick
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        return EcoConnectApp.formatDate(dateString);
    }

    static showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;

        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    showNotification(message, type = 'info') {
        EcoConnectApp.showNotification(message, type);
    }

    requireAuth() {
        if (this.isGuest) {
            ModalManager.openModal('loginRequiredModal');
            return false;
        }
        return true;
    }

    static formatDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Сегодня';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return 'Завтра';
        }

        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long'
        });
    }

    static formatTime(timeString) {
        return timeString || 'Время не указано';
    }
}

class ModalManager {
    static openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    static closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new EcoConnectApp();
});