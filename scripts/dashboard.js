class DashboardManager {
    constructor(currentUser, app) {
        this.currentUser = currentUser;
        this.app = app;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDashboardCards();
    }

    setupEventListeners() {
        const chooseBtn = document.getElementById('chooseEventBtn');
        if (chooseBtn) {
            chooseBtn.addEventListener('click', () => this.showEventsList());
        }

        const quickBtn = document.getElementById('quickJoinBtn');
        if (quickBtn) {
            quickBtn.addEventListener('click', () => this.handleQuickJoin());
        }

        const backBtn = document.getElementById('backToDashboardBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.showDashboard());
        }

        const search = document.getElementById('eventSearch');
        if (search) {
            search.addEventListener('input', (e) => this.searchEvents(e.target.value));
        }

        const sort = document.getElementById('sortEvents');
        if (sort) {
            sort.addEventListener('change', (e) => this.sortEvents(e.target.value));
        }
    }

    setupDashboardCards() {
        const cards = ['chooseEventCard', 'quickJoinCard', 'createEventDashboardCard'];
        const gradients = [
            'linear-gradient(rgba(27, 94, 32, 0.8), rgba(27, 94, 32, 0.9))',
            'linear-gradient(rgba(46, 125, 50, 0.8), rgba(46, 125, 50, 0.9))',
            'linear-gradient(rgba(56, 142, 60, 0.8), rgba(56, 142, 60, 0.9))'
        ];

        cards.forEach((id, i) => {
            const card = document.getElementById(id);
            if (card) {
                const bg = card.querySelector('.action-card-bg');
                if (bg) bg.style.background = gradients[i];
            }
        });
    }

    showDashboard() {
        document.getElementById('dashboard').style.display = 'block';
        document.getElementById('events').style.display = 'none';
        document.getElementById('map').style.display = 'block';
        document.getElementById('my-events').style.display = 'none';
    }

    showEventsList() {
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('events').style.display = 'block';
        document.getElementById('map').style.display = 'none';
        document.getElementById('my-events').style.display = 'none';
        
        if (this.app.eventsManager) {
            this.app.eventsManager.renderEvents();
        }
    }

    async handleQuickJoin() {
        if (!this.app.algorithmManager) return;

        const nearest = await this.app.algorithmManager.findNearestEvent();
        if (nearest) {
            this.app.showNotification(`Ближайшее: "${nearest.title}" в ${Math.round(nearest.distance)} км`, 'success');
            this.showEventsList();
        }
    }

    searchEvents(query) {
        if (!query.trim()) {
            this.app.eventsManager.renderEvents();
            return;
        }

        const filtered = this.app.events.filter(e => 
            e.title.toLowerCase().includes(query.toLowerCase()) ||
            e.description.toLowerCase().includes(query.toLowerCase()) ||
            e.tags?.some(t => t.toLowerCase().includes(query.toLowerCase()))
        );

        this.app.eventsManager.renderEvents(filtered);
    }

    sortEvents(sortType) {
        let sorted = [...this.app.events];
        
        switch(sortType) {
            case 'distance':
                if (this.app.algorithmManager) {
                    sorted = this.app.algorithmManager.getEventsByDistance(sorted);
                }
                break;
            case 'date-asc':
                sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
                break;
            case 'date-desc':
                sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
                break;
        }

        this.app.eventsManager.renderEvents(sorted);
    }
}