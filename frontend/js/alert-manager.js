/**
 * Alert Manager - Handles all notifications and alerts
 */

export class AlertManager
{
    constructor()
    {
        this.alertQueue = [];
        this.activeAlerts = new Set();
        this.maxAlerts = 3; // Maximum number of alerts to show at once
    }

    /**
     * Show an alert to the user
     * @param {string} message - Alert message
     * @param {string} level - Alert level: 'info', 'warning', 'critical', 'success'
     * @param {number} duration - Duration in milliseconds (default: 5000)
     */
    showAlert(message, level = 'info', duration = 5000)
    {
        // If we're at max alerts, queue this one
        if (this.activeAlerts.size >= this.maxAlerts)
        {
            this.alertQueue.push({ message, level, duration });
            return;
        }

        const alert = this.createAlertElement(message, level);
        this.activeAlerts.add(alert);

        document.body.appendChild(alert);

        // Position alerts vertically
        this.repositionAlerts();

        // Auto-remove after duration
        if (duration > 0)
        {
            setTimeout(() =>
            {
                this.removeAlert(alert);
            }, duration);
        }

        // Add click to dismiss
        alert.addEventListener('click', () =>
        {
            this.removeAlert(alert);
        });

        return alert;
    }

    /**
     * Create alert DOM element
     */
    createAlertElement(message, level)
    {
        const alert = document.createElement('div');
        alert.className = `alert ${level}`;

        // Add close button
        alert.innerHTML = `
            <div class="alert-content">
                <span class="alert-message">${message}</span>
                <button class="close-btn" aria-label="Close alert">×</button>
            </div>
        `;

        // Handle close button
        const closeBtn = alert.querySelector('.close-btn');
        closeBtn.addEventListener('click', (e) =>
        {
            e.stopPropagation();
            this.removeAlert(alert);
        });

        return alert;
    }

    /**
     * Remove an alert
     */
    removeAlert(alert)
    {
        if (!this.activeAlerts.has(alert)) return;

        // Add fade out animation
        alert.style.opacity = '0';
        alert.style.transform = 'translateX(100%)';

        setTimeout(() =>
        {
            if (alert.parentNode)
            {
                alert.parentNode.removeChild(alert);
            }
            this.activeAlerts.delete(alert);

            // Reposition remaining alerts
            this.repositionAlerts();

            // Show next alert from queue
            this.showNextFromQueue();
        }, 300);
    }

    /**
     * Position alerts vertically
     */
    repositionAlerts()
    {
        const alerts = Array.from(this.activeAlerts);
        alerts.forEach((alert, index) =>
        {
            alert.style.top = `${100 + (index * 80)}px`;
            alert.style.right = '20px';
        });
    }

    /**
     * Show next alert from queue
     */
    showNextFromQueue()
    {
        if (this.alertQueue.length > 0 && this.activeAlerts.size < this.maxAlerts)
        {
            const nextAlert = this.alertQueue.shift();
            this.showAlert(nextAlert.message, nextAlert.level, nextAlert.duration);
        }
    }

    /**
     * Clear all alerts
     */
    clearAllAlerts()
    {
        this.activeAlerts.forEach(alert =>
        {
            if (alert.parentNode)
            {
                alert.parentNode.removeChild(alert);
            }
        });
        this.activeAlerts.clear();
        this.alertQueue = [];
    }

    /**
     * Show success alert
     */
    showSuccess(message, duration = 3000)
    {
        return this.showAlert(message, 'success', duration);
    }

    /**
     * Show warning alert
     */
    showWarning(message, duration = 5000)
    {
        return this.showAlert(message, 'warning', duration);
    }

    /**
     * Show critical alert
     */
    showCritical(message, duration = 8000)
    {
        return this.showAlert(message, 'critical', duration);
    }

    /**
     * Show info alert
     */
    showInfo(message, duration = 4000)
    {
        return this.showAlert(message, 'info', duration);
    }

    /**
     * Show persistent alert (doesn't auto-dismiss)
     */
    showPersistent(message, level = 'warning')
    {
        return this.showAlert(message, level, 0);
    }
} 