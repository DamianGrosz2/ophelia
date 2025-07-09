/**
 * Patient Display Renderer - Handles rendering of patient information
 */

export class PatientDisplayRenderer
{
    constructor(alertManager)
    {
        this.alertManager = alertManager;

        // DOM elements
        this.patientName = null;
        this.patientSections = null;

        this.initializeElements();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements()
    {
        this.patientName = document.getElementById('patient-name');
        this.patientSections = document.getElementById('patient-sections');

        if (!this.patientName || !this.patientSections)
        {
            console.error('PatientDisplayRenderer: Required DOM elements not found');
            this.alertManager?.showWarning('Patient display not available');
        }
    }

    /**
     * Update patient display with new data
     */
    updateDisplay(data)
    {
        if (!data || !data.patient)
        {
            this.showError('No patient data available');
            return;
        }

        const patient = data.patient;

        // Update patient name
        if (this.patientName)
        {
            this.patientName.textContent = patient.demographics?.name || 'Unknown Patient';
        }

        // Clear and rebuild sections
        if (this.patientSections)
        {
            this.patientSections.innerHTML = '';
            this.createPatientSections(patient);
        }
    }

    /**
     * Show error message
     */
    showError(message)
    {
        if (this.patientName)
        {
            this.patientName.textContent = 'Error Loading Patient';
        }

        if (this.patientSections)
        {
            this.patientSections.innerHTML = `
                <div class="error-message">
                    <p>${message}</p>
                    <button onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    }

    /**
     * Create all patient information sections
     */
    createPatientSections(patient)
    {
        // Demographics Section (always expanded)
        if (patient.demographics)
        {
            const demographicsContent = this.createDemographicsContent(patient.demographics);
            this.patientSections.appendChild(this.createCollapsibleSection('👤 Demographics', demographicsContent, true));
        }

        // Medical History Section
        if (patient.medicalHistory || patient.cardiacHistory)
        {
            const historyContent = this.createMedicalHistoryContent(patient);
            this.patientSections.appendChild(this.createCollapsibleSection('📋 Medical History', historyContent, true));
        }

        // Laboratory Values Section
        if (patient.labs)
        {
            const labContent = this.createLabContent(patient.labs);
            this.patientSections.appendChild(this.createCollapsibleSection('🧪 Laboratory Values', labContent, true));
        }

        // Imaging Section
        if (patient.imaging)
        {
            const imagingContent = this.createImagingContent(patient.imaging);
            this.patientSections.appendChild(this.createCollapsibleSection('📸 Imaging Studies', imagingContent, false));
        }

        // Medications Section
        if (patient.medications && patient.medications.length > 0)
        {
            const medicationsContent = this.createMedicationsContent(patient.medications);
            this.patientSections.appendChild(this.createCollapsibleSection('💊 Current Medications', medicationsContent, false));
        }

        // Risk Scores Section
        if (patient.riskScores)
        {
            const riskContent = this.createRiskScoresContent(patient.riskScores);
            this.patientSections.appendChild(this.createCollapsibleSection('📊 Risk Assessment', riskContent, true));
        }

        // Current Vitals Section
        if (patient.currentVitals)
        {
            const vitalsContent = this.createCurrentVitalsContent(patient.currentVitals);
            this.patientSections.appendChild(this.createCollapsibleSection('❤️ Current Vitals', vitalsContent, true));
        }

        // Social & Family History Section
        if (patient.socialHistory || patient.familyHistory)
        {
            const socialContent = this.createSocialHistoryContent(patient);
            this.patientSections.appendChild(this.createCollapsibleSection('👥 Social & Family History', socialContent, false));
        }

        // Allergies Section (always show as alert)
        const allergiesContent = this.createAllergiesContent(patient.allergies);
        const allergiesSection = this.createCollapsibleSection('⚠️ Allergies & Contraindications', allergiesContent, true);
        this.applyAllergyAlertStyling(allergiesSection);
        this.patientSections.appendChild(allergiesSection);
    }

    /**
     * Create collapsible section component
     */
    createCollapsibleSection(title, content, isExpanded = true)
    {
        const section = document.createElement('div');
        section.className = 'collapsible-section';

        const header = document.createElement('div');
        header.className = `collapsible-header ${!isExpanded ? 'collapsed' : ''}`;
        header.innerHTML = `
            <span class="collapsible-title">${title}</span>
            <span class="collapsible-arrow">▼</span>
        `;

        const contentDiv = document.createElement('div');
        contentDiv.className = `collapsible-content ${!isExpanded ? 'collapsed' : ''}`;
        contentDiv.innerHTML = content;

        // Add click handler for expand/collapse
        header.addEventListener('click', () =>
        {
            const isCollapsed = header.classList.contains('collapsed');
            header.classList.toggle('collapsed', !isCollapsed);
            contentDiv.classList.toggle('collapsed', !isCollapsed);
        });

        section.appendChild(header);
        section.appendChild(contentDiv);

        return section;
    }

    /**
     * Create demographics content
     */
    createDemographicsContent(demographics)
    {
        return `
            <div class="info-row">
                <span class="info-label">MRN:</span>
                <span class="info-value">${demographics.mrn || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Age:</span>
                <span class="info-value">${demographics.age || 'N/A'} years</span>
            </div>
            <div class="info-row">
                <span class="info-label">Gender:</span>
                <span class="info-value">${demographics.gender || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Weight:</span>
                <span class="info-value">${demographics.weight || 'N/A'} kg</span>
            </div>
            <div class="info-row">
                <span class="info-label">Height:</span>
                <span class="info-value">${demographics.height || 'N/A'} cm</span>
            </div>
            <div class="info-row">
                <span class="info-label">BMI:</span>
                <span class="info-value">${demographics.bmi || 'N/A'}</span>
            </div>
            ${demographics.address ? `
            <div class="info-row">
                <span class="info-label">Address:</span>
                <span class="info-value">${demographics.address}</span>
            </div>` : ''}
            ${demographics.phone ? `
            <div class="info-row">
                <span class="info-label">Phone:</span>
                <span class="info-value">${demographics.phone}</span>
            </div>` : ''}
            ${demographics.primaryPhysician ? `
            <div class="info-row">
                <span class="info-label">Primary Physician:</span>
                <span class="info-value">${demographics.primaryPhysician}</span>
            </div>` : ''}
        `;
    }

    /**
     * Create medical history content
     */
    createMedicalHistoryContent(patient)
    {
        let content = '';

        if (patient.cardiacHistory)
        {
            const ch = patient.cardiacHistory;
            content += `
                <div class="info-row">
                    <span class="info-label">Arrhythmia:</span>
                    <span class="info-value">${ch.arrhythmia || 'None'}</span>
                </div>
                ${ch.duration ? `
                <div class="info-row">
                    <span class="info-label">Duration:</span>
                    <span class="info-value">${ch.duration}</span>
                </div>` : ''}
                ${ch.frequency ? `
                <div class="info-row">
                    <span class="info-label">Frequency:</span>
                    <span class="info-value">${ch.frequency}</span>
                </div>` : ''}
                ${ch.symptoms ? `
                <div class="info-row">
                    <span class="info-label">Symptoms:</span>
                    <span class="info-value">${ch.symptoms}</span>
                </div>` : ''}
                ${ch.episodeDuration ? `
                <div class="info-row">
                    <span class="info-label">Episode Duration:</span>
                    <span class="info-value">${ch.episodeDuration}</span>
                </div>` : ''}
            `;
        }

        if (patient.medicalHistory)
        {
            const mh = patient.medicalHistory;

            Object.keys(mh).forEach(key =>
            {
                const value = mh[key];
                if (Array.isArray(value))
                {
                    content += `
                    <div class="info-row">
                        <span class="info-label">${this.formatLabel(key)}:</span>
                        <div class="info-value">
                            <ul class="info-list">
                                ${value.map(item => `<li>${item}</li>`).join('')}
                            </ul>
                        </div>
                    </div>`;
                } else if (value && value !== 'None')
                {
                    content += `
                    <div class="info-row">
                        <span class="info-label">${this.formatLabel(key)}:</span>
                        <span class="info-value">${value}</span>
                    </div>`;
                }
            });
        }

        return content || '<div class="info-value">No significant medical history</div>';
    }

    /**
     * Create laboratory values content
     */
    createLabContent(labs)
    {
        let content = '';

        Object.keys(labs).forEach(labKey =>
        {
            const lab = labs[labKey];
            if (typeof lab === 'object' && lab.value !== undefined)
            {
                content += `
                <div class="info-row">
                    <span class="info-label">${this.formatLabel(labKey)}:</span>
                    <span class="info-value">${lab.value} ${lab.unit || ''} ${lab.note ? `(${lab.note})` : ''}</span>
                </div>`;
            } else if (typeof lab === 'object')
            {
                // Handle nested objects like electrolytes
                Object.keys(lab).forEach(subKey =>
                {
                    if (subKey !== 'date' && subKey !== 'status')
                    {
                        content += `
                        <div class="info-row">
                            <span class="info-label">${this.formatLabel(subKey)}:</span>
                            <span class="info-value">${lab[subKey]}</span>
                        </div>`;
                    }
                });
            }
        });

        return content || '<div class="info-value">No laboratory data available</div>';
    }

    /**
     * Create imaging content
     */
    createImagingContent(imaging)
    {
        let content = '';

        Object.keys(imaging).forEach(studyType =>
        {
            const study = imaging[studyType];
            content += `<h4 style="color: #ee2375; margin: 0.5rem 0;">${this.formatLabel(studyType)}</h4>`;

            Object.keys(study).forEach(key =>
            {
                if (key !== 'date')
                {
                    content += `
                    <div class="info-row">
                        <span class="info-label">${this.formatLabel(key)}:</span>
                        <span class="info-value">${study[key]}</span>
                    </div>`;
                }
            });

            if (study.date)
            {
                content += `
                <div class="info-row">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${study.date}</span>
                </div>`;
            }
        });

        return content || '<div class="info-value">No imaging studies available</div>';
    }

    /**
     * Create medications content
     */
    createMedicationsContent(medications)
    {
        return `
            <ul class="info-list">
                ${medications.map(med => `<li>${med}</li>`).join('')}
            </ul>
        `;
    }

    /**
     * Create risk scores content
     */
    createRiskScoresContent(riskScores)
    {
        let content = '';

        if (riskScores.cha2ds2vasc !== undefined)
        {
            const scoreClass = riskScores.cha2ds2vasc <= 1 ? 'score-low' : riskScores.cha2ds2vasc <= 3 ? 'score-medium' : 'score-high';
            content += `
            <div class="info-row">
                <span class="info-label">CHA₂DS₂-VASc:</span>
                <span class="info-value">${riskScores.cha2ds2vasc} <span class="score-badge ${scoreClass}">${riskScores.cha2ds2vasc <= 1 ? 'Low' : riskScores.cha2ds2vasc <= 3 ? 'Moderate' : 'High'}</span></span>
            </div>`;
        }

        if (riskScores.hasbled !== undefined)
        {
            const scoreClass = riskScores.hasbled <= 2 ? 'score-low' : riskScores.hasbled <= 4 ? 'score-medium' : 'score-high';
            content += `
            <div class="info-row">
                <span class="info-label">HAS-BLED:</span>
                <span class="info-value">${riskScores.hasbled} <span class="score-badge ${scoreClass}">${riskScores.hasbled <= 2 ? 'Low' : riskScores.hasbled <= 4 ? 'Moderate' : 'High'}</span></span>
            </div>`;
        }

        if (riskScores.anticoagulationIndicated !== undefined)
        {
            content += `
            <div class="info-row">
                <span class="info-label">Anticoagulation:</span>
                <span class="info-value">${riskScores.anticoagulationIndicated ? 'Indicated' : 'Not indicated'}</span>
            </div>`;
        }

        return content || '<div class="info-value">No risk scores calculated</div>';
    }

    /**
     * Create current vitals content
     */
    createCurrentVitalsContent(vitals)
    {
        return `
            <div class="vitals-grid">
                ${vitals.bloodPressure ? `
                <div class="vital-item">
                    <div class="vital-label">Blood Pressure</div>
                    <div class="vital-value">${vitals.bloodPressure}</div>
                </div>` : ''}
                ${vitals.heartRate ? `
                <div class="vital-item">
                    <div class="vital-label">Heart Rate</div>
                    <div class="vital-value">${vitals.heartRate} bpm</div>
                </div>` : ''}
                ${vitals.temperature ? `
                <div class="vital-item">
                    <div class="vital-label">Temperature</div>
                    <div class="vital-value">${vitals.temperature}°C</div>
                </div>` : ''}
                ${vitals.oxygenSaturation ? `
                <div class="vital-item">
                    <div class="vital-label">O₂ Saturation</div>
                    <div class="vital-value">${vitals.oxygenSaturation}%</div>
                </div>` : ''}
                ${vitals.rhythm ? `
                <div class="vital-item">
                    <div class="vital-label">Rhythm</div>
                    <div class="vital-value">${vitals.rhythm}</div>
                </div>` : ''}
            </div>
        `;
    }

    /**
     * Create social history content
     */
    createSocialHistoryContent(patient)
    {
        let content = '';

        if (patient.socialHistory)
        {
            const sh = patient.socialHistory;
            Object.keys(sh).forEach(key =>
            {
                content += `
                <div class="info-row">
                    <span class="info-label">${this.formatLabel(key)}:</span>
                    <span class="info-value">${sh[key]}</span>
                </div>`;
            });
        }

        if (patient.familyHistory)
        {
            content += '<h4 style="color: #ee2375; margin: 0.5rem 0;">Family History</h4>';
            const fh = patient.familyHistory;
            Object.keys(fh).forEach(key =>
            {
                content += `
                <div class="info-row">
                    <span class="info-label">${this.formatLabel(key)}:</span>
                    <span class="info-value">${fh[key]}</span>
                </div>`;
            });
        }

        return content || '<div class="info-value">No social or family history available</div>';
    }

    /**
     * Create allergies content
     */
    createAllergiesContent(allergies)
    {
        if (allergies && allergies.length > 0)
        {
            return `
                <ul class="info-list" style="color: #ff3b30;">
                    ${allergies.map(allergy => `<li><strong>${allergy}</strong></li>`).join('')}
                </ul>
            `;
        } else
        {
            return '<div class="info-value" style="color: #22c55e;"><strong>No known allergies</strong></div>';
        }
    }

    /**
     * Apply alert styling to allergy section
     */
    applyAllergyAlertStyling(section)
    {
        section.style.background = 'rgba(255, 59, 48, 0.1)';
        section.style.borderColor = 'rgba(255, 59, 48, 0.5)';

        const header = section.querySelector('.collapsible-header');
        if (header)
        {
            header.style.background = 'rgba(255, 59, 48, 0.15)';
        }
    }

    /**
     * Format label text
     */
    formatLabel(key)
    {
        return key.replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/egfr/gi, 'eGFR')
            .replace(/inr/gi, 'INR')
            .replace(/tsh/gi, 'TSH')
            .replace(/ft3/gi, 'fT3')
            .replace(/ft4/gi, 'fT4')
            .replace(/bmi/gi, 'BMI')
            .replace(/mrn/gi, 'MRN')
            .replace(/ct/gi, 'CT')
            .replace(/mri/gi, 'MRI');
    }
} 