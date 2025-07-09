/**
 * Vitals Chart Manager - Handles chart visualization
 */

import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

export class VitalsChartManager
{
    constructor(alertManager)
    {
        this.alertManager = alertManager;

        this.vitalsChart = null;
        this.statusIndicators = null;

        // Chart data
        this.chartData = {
            labels: [],
            heartRate: [],
            systolicBP: [],
            diastolicBP: []
        };

        // Real-time update interval
        this.updateInterval = null;
        this.updateFrequency = 2000; // 2 seconds

        this.initializeElements();
        this.initializeChart();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements()
    {
        const chartCanvas = document.getElementById('vitalsChart');
        this.statusIndicators = document.getElementById('status-indicators');

        if (!chartCanvas)
        {
            console.error('VitalsChartManager: Chart canvas not found');
            this.alertManager?.showWarning('Vitals chart not available');
            return;
        }

        if (!this.statusIndicators)
        {
            console.error('VitalsChartManager: Status indicators container not found');
        }

        this.chartCanvas = chartCanvas;
    }

    /**
     * Initialize the vitals chart
     */
    initializeChart()
    {
        if (!this.chartCanvas) return;

        const ctx = this.chartCanvas.getContext('2d');

        this.vitalsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.chartData.labels,
                datasets: [{
                    label: 'Heart Rate (bpm)',
                    data: this.chartData.heartRate,
                    borderColor: '#ee2375',
                    backgroundColor: 'rgba(238, 35, 117, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y'
                }, {
                    label: 'Systolic BP (mmHg)',
                    data: this.chartData.systolicBP,
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                }, {
                    label: 'Diastolic BP (mmHg)',
                    data: this.chartData.diastolicBP,
                    borderColor: '#4ecdc4',
                    backgroundColor: 'rgba(78, 205, 196, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time',
                            color: '#94a3b8'
                        },
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(148, 163, 184, 0.2)' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Heart Rate (bpm)',
                            color: '#ee2375'
                        },
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(148, 163, 184, 0.2)' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Blood Pressure (mmHg)',
                            color: '#ff6b6b'
                        },
                        ticks: { color: '#94a3b8' },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#e0e7ff',
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(11, 14, 20, 0.9)',
                        titleColor: '#e0e7ff',
                        bodyColor: '#e0e7ff',
                        borderColor: '#3c3c3c',
                        borderWidth: 1
                    }
                }
            }
        });

        console.log('Vitals chart initialized');
    }

    /**
     * Update status indicators
     */
    updateStatusIndicators(data, procedureType)
    {
        if (!this.statusIndicators || !data.intraopData) return;

        const intraop = data.intraopData;
        let statusHTML = '';

        if (procedureType === 'pad_angioplasty')
        {
            statusHTML = `
                <div class="status-item">
                    <div class="status-value">${intraop.contrastUsed || 0}/${intraop.maxContrast || 75}</div>
                    <div class="status-label">Contrast (mL)</div>
                </div>
                <div class="status-item">
                    <div class="status-value">${intraop.fluoroscopyTime || 0}</div>
                    <div class="status-label">Fluoro Time (min)</div>
                </div>
                <div class="status-item">
                    <div class="status-value">${intraop.vitals?.bloodPressure || 'N/A'}</div>
                    <div class="status-label">Blood Pressure</div>
                </div>
                <div class="status-item">
                    <div class="status-value">${intraop.vitals?.heartRate || 'N/A'}</div>
                    <div class="status-label">Heart Rate</div>
                </div>
            `;
        } else if (procedureType === 'ep_ablation')
        {
            statusHTML = `
                <div class="status-item">
                    <div class="status-value">${intraop.ablation?.powerSetting || 0}W</div>
                    <div class="status-label">Ablation Power</div>
                </div>
                <div class="status-item">
                    <div class="status-value">${intraop.ablation?.targetTemperature || 0}°C</div>
                    <div class="status-label">Target Temp</div>
                </div>
                <div class="status-item">
                    <div class="status-value">${intraop.vitals?.bloodPressure || 'N/A'}</div>
                    <div class="status-label">Blood Pressure</div>
                </div>
                <div class="status-item">
                    <div class="status-value">${intraop.vitals?.heartRate || 'N/A'}</div>
                    <div class="status-label">Heart Rate</div>
                </div>
            `;
        }

        this.statusIndicators.innerHTML = statusHTML;
    }

    /**
     * Add new data point to chart
     */
    addDataPoint(heartRate, systolicBP, diastolicBP, timestamp)
    {
        if (!this.vitalsChart) return;

        const timeLabel = timestamp || new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Add new data
        this.chartData.labels.push(timeLabel);
        this.chartData.heartRate.push(heartRate);
        this.chartData.systolicBP.push(systolicBP);
        this.chartData.diastolicBP.push(diastolicBP);

        // Update chart datasets
        this.vitalsChart.data.labels = this.chartData.labels;
        this.vitalsChart.data.datasets[0].data = this.chartData.heartRate;
        this.vitalsChart.data.datasets[1].data = this.chartData.systolicBP;
        this.vitalsChart.data.datasets[2].data = this.chartData.diastolicBP;

        // Keep only last 20 data points for performance
        if (this.chartData.labels.length > 20)
        {
            this.chartData.labels.shift();
            this.chartData.heartRate.shift();
            this.chartData.systolicBP.shift();
            this.chartData.diastolicBP.shift();
        }

        // Update chart
        this.vitalsChart.update('none');
    }

    /**
     * Start real-time updates with simulated data
     */
    startRealTimeUpdates()
    {
        if (this.updateInterval)
        {
            this.stopRealTimeUpdates();
        }

        this.updateInterval = setInterval(() =>
        {
            // Generate realistic vital signs
            const hr = 70 + Math.random() * 20; // 70-90 BPM
            const sbp = 120 + Math.random() * 40; // 120-160 mmHg
            const dbp = 70 + Math.random() * 20; // 70-90 mmHg

            this.addDataPoint(
                Math.round(hr),
                Math.round(sbp),
                Math.round(dbp)
            );
        }, this.updateFrequency);

        console.log('Real-time vitals updates started');
    }

    /**
     * Stop real-time updates
     */
    stopRealTimeUpdates()
    {
        if (this.updateInterval)
        {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('Real-time vitals updates stopped');
        }
    }

    /**
     * Clear all chart data
     */
    clearChart()
    {
        if (!this.vitalsChart) return;

        this.chartData.labels = [];
        this.chartData.heartRate = [];
        this.chartData.systolicBP = [];
        this.chartData.diastolicBP = [];

        this.vitalsChart.data.labels = [];
        this.vitalsChart.data.datasets.forEach(dataset =>
        {
            dataset.data = [];
        });

        this.vitalsChart.update();
    }

    /**
     * Set update frequency
     */
    setUpdateFrequency(milliseconds)
    {
        this.updateFrequency = milliseconds;

        if (this.updateInterval)
        {
            this.stopRealTimeUpdates();
            this.startRealTimeUpdates();
        }
    }

    /**
     * Export chart as image
     */
    exportChart()
    {
        if (!this.vitalsChart) return null;

        const canvas = this.vitalsChart.canvas;
        const url = canvas.toDataURL('image/png');

        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `vitals-chart-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();

        return url;
    }

    /**
     * Resize chart
     */
    resize()
    {
        if (this.vitalsChart)
        {
            this.vitalsChart.resize();
        }
    }

    /**
     * Update chart theme
     */
    updateTheme(isDark = true)
    {
        if (!this.vitalsChart) return;

        const textColor = isDark ? '#e0e7ff' : '#1f2937';
        const gridColor = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(75, 85, 99, 0.2)';

        // Update chart options
        this.vitalsChart.options.scales.x.ticks.color = textColor;
        this.vitalsChart.options.scales.x.grid.color = gridColor;
        this.vitalsChart.options.scales.y.ticks.color = textColor;
        this.vitalsChart.options.scales.y.grid.color = gridColor;
        this.vitalsChart.options.scales.y1.ticks.color = textColor;
        this.vitalsChart.options.plugins.legend.labels.color = textColor;

        this.vitalsChart.update();
    }

    /**
     * Get current chart data for export
     */
    getChartData()
    {
        return {
            labels: [...this.chartData.labels],
            heartRate: [...this.chartData.heartRate],
            systolicBP: [...this.chartData.systolicBP],
            diastolicBP: [...this.chartData.diastolicBP]
        };
    }

    /**
     * Load chart data from export
     */
    loadChartData(data)
    {
        if (!data || !this.vitalsChart) return;

        this.chartData.labels = data.labels || [];
        this.chartData.heartRate = data.heartRate || [];
        this.chartData.systolicBP = data.systolicBP || [];
        this.chartData.diastolicBP = data.diastolicBP || [];

        // Update chart
        this.vitalsChart.data.labels = this.chartData.labels;
        this.vitalsChart.data.datasets[0].data = this.chartData.heartRate;
        this.vitalsChart.data.datasets[1].data = this.chartData.systolicBP;
        this.vitalsChart.data.datasets[2].data = this.chartData.diastolicBP;

        this.vitalsChart.update();
    }

    /**
     * Cleanup resources
     */
    destroy()
    {
        this.stopRealTimeUpdates();

        if (this.vitalsChart)
        {
            this.vitalsChart.destroy();
            this.vitalsChart = null;
        }
    }
} 