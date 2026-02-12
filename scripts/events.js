class EventsManager {
    constructor(events, currentUser, app) {
        this.events = events || [];
        this.currentUser = currentUser;
        this.app = app;
        this.isGuest = !currentUser;
    }

    renderEvents(events = this.events) {
        const container = document.getElementById('eventsContainer');
        if (!container) return;

        let sortedEvents = events;
        if (this.app && this.app.algorithmManager) {
            sortedEvents = this.app.algorithmManager.getEventsByDistance(events);
        } else {
            sortedEvents = this.sortEventsByDate(events);
        }

        if (sortedEvents.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>Мероприятий не найдено</h3>
                    <p>Попробуйте изменить параметры поиска</p>
                </div>
            `;
            return;
        }

        container.innerHTML = sortedEvents.map(event => this.createEventCard(event)).join('');
        this.attachEventHandlers();
    }

    getEventStatus(event) {
        const now = new Date();
        const eventDate = new Date(event.date);
        const diffDays = Math.floor((eventDate - now) / (1000 * 60 * 60 * 24));
        
        if (eventDate < now) {
            return { code: 'completed', label: 'Завершено', class: 'status-completed' };
        } else if (diffDays <= 7) {
            return { code: 'active', label: 'Скоро', class: 'status-active' };
        } else {
            return { code: 'upcoming', label: 'Активно', class: 'status-upcoming' };
        }
    }

    createEventCard(event) {
        const isRegistered = this.currentUser ? this.isUserRegistered(event.id) : false;
        const isCreator = this.currentUser && event.creatorId === this.currentUser.id;
        const isFull = (event.currentVolunteers || 0) >= (event.maxVolunteers || 50);
        const status = this.getEventStatus(event);
        const hasChat = event.chatLink && event.chatLink.trim() !== '';
        
        const progress = this.calculateProgress(event);
        
        let buttonText, buttonClass, buttonDisabled;
        
        if (this.isGuest) {
            buttonText = 'Войти для записи';
            buttonClass = 'btn-primary';
            buttonDisabled = false;
        } else if (isCreator) {
            buttonText = 'Вы организатор';
            buttonClass = 'btn-success';
            buttonDisabled = true;
        } else if (isRegistered) {
            buttonText = 'Вы записаны';
            buttonClass = 'btn-success';
            buttonDisabled = true;
        } else if (isFull) {
            buttonText = 'Мест нет';
            buttonClass = 'btn-secondary';
            buttonDisabled = true;
        } else {
            buttonText = 'Записаться';
            buttonClass = 'btn-primary';
            buttonDisabled = false;
        }

        const distance = event.distance ? Math.round(event.distance * 10) / 10 : null;

        return `
            <div class="event-card" data-event-id="${event.id}">
                <div class="event-header">
                    <h3 class="event-title">${this.escapeHtml(event.title)}</h3>
                    <div class="event-header-right">
                        <span class="event-status ${status.class}">${status.label}</span>
                        <span class="event-date">${this.formatDate(event.date)}</span>
                    </div>
                </div>
                
                <div class="event-progress-bar">
                    <div class="progress-bar-custom">
                        <div class="progress-fill-custom" style="width: ${progress.percent}%"></div>
                    </div>
                    <span class="progress-text">${progress.percent}% выполнено</span>
                </div>
                
                <p class="event-description">${this.escapeHtml(event.description)}</p>
                
                <div class="event-info">
                    <span class="event-location">
                        <i class="fas fa-map-marker-alt"></i>
                        ${event.location?.address ? this.escapeHtml(event.location.address) : 'Адрес не указан'}
                        ${distance !== null ? `<span class="distance-badge">${distance} км</span>` : ''}
                    </span>
                    <span class="event-time">
                        <i class="fas fa-clock"></i>
                        ${event.time || 'Время не указано'}
                    </span>
                    <span class="event-volunteers">
                        <i class="fas fa-users"></i>
                        ${event.currentVolunteers}/${event.maxVolunteers}
                    </span>
                    ${event.tags && event.tags.length > 0 ? `
                        <div class="event-tags">
                            ${event.tags.map(tag => `<span class="event-tag">${this.getTagIcon(tag)} ${this.escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <div class="event-actions">
                    <button class="btn ${buttonClass} join-btn" 
                            data-event="${event.id}" 
                            ${buttonDisabled ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                    
                    ${isRegistered && hasChat ? `
                        <a href="${event.chatLink}" target="_blank" class="btn chat-btn">
                            <i class="fab fa-telegram"></i> Чат
                        </a>
                    ` : ''}
                    
                    ${this.currentUser && isCreator ? `
                        <button class="btn btn-info participants-btn" data-event="${event.id}">
                            <i class="fas fa-users"></i> Участники
                        </button>
                        <button class="btn btn-danger delete-btn" data-event="${event.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    calculateProgress(event) {
        if (!event.tasks || event.tasks.length === 0) return { percent: 0 };
        
        const totalTarget = event.tasks.reduce((sum, t) => sum + (t.target || 0), 0);
        const totalCurrent = event.tasks.reduce((sum, t) => sum + (t.current || 0), 0);
        
        return {
            percent: totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0
        };
    }

    attachEventHandlers() {
        document.querySelectorAll('.join-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const eventId = e.target.closest('.join-btn').getAttribute('data-event');
                this.handleJoinClick(eventId);
            });
        });

        document.querySelectorAll('.participants-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const eventId = e.target.closest('.participants-btn').getAttribute('data-event');
                this.showParticipants(eventId);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const eventId = e.target.closest('.delete-btn').getAttribute('data-event');
                this.deleteEvent(eventId);
            });
        });
    }

    handleJoinClick(eventId) {
        if (this.isGuest) {
            ModalManager.openModal('loginRequiredModal');
            return;
        }
        this.joinEvent(eventId);
    }

    joinEvent(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;

        if (event.currentVolunteers >= event.maxVolunteers) {
            this.app.showNotification('На мероприятие уже набрано максимальное количество участников', 'error');
            return;
        }

        if (this.isUserRegistered(eventId)) {
            this.app.showNotification('Вы уже записаны на это мероприятие', 'info');
            return;
        }

        const registration = {
            id: database.generateId(),
            eventId: eventId,
            userId: this.currentUser.id,
            userData: {
                lastName: this.currentUser.lastName,
                firstName: this.currentUser.firstName,
                middleName: this.currentUser.middleName,
                fullName: this.currentUser.fullName,
                email: this.currentUser.email,
                phone: this.currentUser.phone
            },
            registeredAt: new Date().toISOString()
        };

        database.addRegistration(registration);
        
        event.currentVolunteers = (event.currentVolunteers || 0) + 1;
        database.saveEvents(this.events);

        this.showSuccessModal(event);
        this.renderEvents();
        
        this.app.showNotification('Вы успешно записались на мероприятие!', 'success');
    }

    showSuccessModal(event) {
        document.getElementById('successDate').textContent = this.formatDate(event.date);
        document.getElementById('successTime').textContent = event.time || 'Время не указано';
        document.getElementById('successLocation').textContent = event.location?.address || 'Адрес не указан';
        document.getElementById('successUserName').textContent = this.currentUser.fullName;
        
        ModalManager.openModal('successModal');
    }

    showParticipants(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;

        const registrations = database.getEventRegistrations(eventId);
        
        document.getElementById('participantsEventTitle').textContent = event.title;
        
        const tbody = document.getElementById('participantsTableBody');
        tbody.innerHTML = registrations.map(reg => `
            <tr>
                <td>${this.escapeHtml(reg.userData.lastName)}</td>
                <td>${this.escapeHtml(reg.userData.firstName)}</td>
                <td>${this.escapeHtml(reg.userData.middleName)}</td>
                <td>${reg.userData.phone}</td>
                <td>${reg.userData.email}</td>
                <td>${new Date(reg.registeredAt).toLocaleDateString('ru-RU')}</td>
            </tr>
        `).join('');

        ModalManager.openModal('participantsModal');
    }

    deleteEvent(eventId) {
        if (!confirm('Удалить мероприятие?')) return;
        
        if (database.deleteEvent(eventId)) {
            this.events = database.getEvents();
            this.renderEvents();
            this.app.showNotification('Мероприятие удалено', 'success');
        }
    }

    isUserRegistered(eventId) {
        if (!this.currentUser) return false;
        return database.getUserRegistrations(this.currentUser.id)
            .some(reg => reg.eventId === eventId);
    }

    sortEventsByDate(events) {
        return [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    formatDate(dateString) {
        return EcoConnectApp.formatDate(dateString);
    }

    getTagIcon(tag) {
        const icons = {
            'мусор': '♻️', 'листья': '🍂', 'озеленение': '🌳',
            'озера': '💧', 'парки': '🌲', 'реки': '🌊', 'пляжи': '🏖️', 'леса': '🌲'
        };
        return icons[tag] || '🏷️';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}