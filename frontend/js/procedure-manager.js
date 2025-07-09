/**
 * Procedure Manager - Handles procedure switching and data management
 */

export class ProcedureManager
{
    constructor(apiClient, alertManager)
    {
        this.apiClient = apiClient;
        this.alertManager = alertManager;

        this.currentProcedure = 'pad_angioplasty';
        this.procedureData = null;

        // DOM elements
        this.procedureBtns = null;

        // Event callbacks
        this.onProcedureChanged = null;
        this.onDataLoaded = null;

        this.initializeElements();
        this.setupEventListeners();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements()
    {
        this.procedureBtns = document.querySelectorAll('.procedure-btn');

        if (this.procedureBtns.length === 0)
        {
            console.error('ProcedureManager: No procedure buttons found');
            this.alertManager?.showWarning('Procedure selection not available');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners()
    {
        this.procedureBtns.forEach(btn =>
        {
            btn.addEventListener('click', (e) =>
            {
                const procedure = e.target.dataset.procedure;
                if (procedure)
                {
                    this.switchProcedure(procedure);
                }
            });
        });
    }

    /**
     * Switch to a different procedure
     */
    async switchProcedure(procedureType)
    {
        if (this.currentProcedure === procedureType)
        {
            return; // Already on this procedure
        }

        console.log(`Switching from ${this.currentProcedure} to ${procedureType}`);

        this.currentProcedure = procedureType;

        // Update active button
        this.updateActiveButton(procedureType);

        // Load new procedure data
        await this.loadProcedureData();

        // Trigger callback
        if (this.onProcedureChanged)
        {
            this.onProcedureChanged(procedureType, this.procedureData);
        }
    }

    /**
     * Update active procedure button
     */
    updateActiveButton(procedureType)
    {
        this.procedureBtns.forEach(btn => btn.classList.remove('active'));

        const activeBtn = document.querySelector(`[data-procedure="${procedureType}"]`);
        if (activeBtn)
        {
            activeBtn.classList.add('active');
        }
    }

    /**
     * Load procedure-specific data
     */
    async loadProcedureData()
    {
        try
        {
            console.log(`Loading data for procedure: ${this.currentProcedure}`);

            // Try to load from API first
            const data = await this.apiClient.loadProcedureData(this.currentProcedure);
            this.procedureData = data;

            console.log('Procedure data loaded from API');

        } catch (error)
        {
            console.error('Error loading procedure data from API:', error);

            // Fallback to mock data
            await this.loadMockData();
        }

        // Trigger data loaded callback
        if (this.onDataLoaded)
        {
            this.onDataLoaded(this.procedureData);
        }

        return this.procedureData;
    }

    /**
     * Load mock data as fallback
     */
    async loadMockData()
    {
        try
        {
            console.log(`Loading mock data for procedure: ${this.currentProcedure}`);

            // Try to fetch from backend first
            const mockData = await this.apiClient.loadMockData();
            const procedureData = mockData.procedures[this.currentProcedure];

            if (procedureData)
            {
                console.log(`Found mock procedure data for: ${this.currentProcedure}`);
                this.procedureData = procedureData;
                return;
            }

        } catch (error)
        {
            console.error('Backend not available, using local fallback data', error);
        }

        // Local fallback data if backend is completely unavailable
        this.procedureData = this.getLocalFallbackData();
        console.log('Using local fallback data');
    }

    /**
     * Get local fallback data when backend is unavailable
     */
    getLocalFallbackData()
    {
        if (this.currentProcedure === 'pad_angioplasty')
        {
            return {
                patient: {
                    demographics: {
                        name: "Robert Martinez",
                        mrn: "MRN-789456",
                        age: 68,
                        gender: "Male",
                        weight: 85,
                        height: 175,
                        bmi: 28.5
                    },
                    medicalHistory: {
                        previousInterventions: ["Left SFA angioplasty 2023"],
                        diabetes: "Type 2, well-controlled",
                        smokingHistory: "Former smoker, quit 2020",
                        comorbidities: ["Hypertension", "Hyperlipidemia", "CAD"]
                    },
                    labs: {
                        creatinine: { value: 1.2, unit: "mg/dL", egfr: 58 },
                        platelets: { value: 245000, unit: "/μL" },
                        inr: { value: 1.1 },
                        hemoglobin: { value: 13.2, unit: "g/dL" }
                    },
                    allergies: ["Iodine contrast - rash", "Penicillin - hives"],
                    currentVitals: {
                        bloodPressure: "142/88",
                        heartRate: 78,
                        oxygenSaturation: 98
                    }
                },
                intraopData: {
                    contrastUsed: 45,
                    maxContrast: 75,
                    fluoroscopyTime: 12.5,
                    vitals: { bloodPressure: "142/88", heartRate: 78 }
                }
            };
        } else if (this.currentProcedure === 'ep_ablation')
        {
            return {
                patient: {
                    demographics: {
                        name: "Anna Müller",
                        mrn: "AFIB-2025-001",
                        age: 57,
                        gender: "Female",
                        weight: 72,
                        height: 168,
                        bmi: 25.5,
                        address: "Musterweg 12, 93051 Regensburg",
                        phone: "0176-1234567",
                        primaryPhysician: "Dr. Schmidt, Praxis Musterstadt"
                    },
                    cardiacHistory: {
                        arrhythmia: "Paroxysmal atrial fibrillation",
                        duration: "18 months",
                        frequency: "2-3 episodes per week",
                        episodeDuration: "2-6 hours, spontaneous conversion",
                        symptoms: "Palpitations, mild dyspnea on exertion, fatigue"
                    },
                    medicalHistory: {
                        hypertension: "5 years, well controlled with Ramipril"
                    },
                    labs: {
                        hemoglobin: { value: 13.2, unit: "g/dL" },
                        platelets: { value: 250, unit: "G/L" },
                        inr: { value: 1.2, note: "On Apixaban" },
                        creatinine: { value: 0.8, unit: "mg/dL", egfr: ">90" },
                        electrolytes: {
                            sodium: "Normal",
                            potassium: "Normal",
                            calcium: "Normal"
                        }
                    },
                    medications: [
                        "Metoprolol succinate 47.5mg daily (rate control)",
                        "Apixaban 5mg twice daily (anticoagulation)",
                        "Ramipril 5mg daily (hypertension)"
                    ],
                    riskScores: {
                        cha2ds2vasc: 1,
                        hasbled: 1,
                        anticoagulationIndicated: true
                    },
                    socialHistory: {
                        maritalStatus: "Married",
                        children: "2 adult children",
                        occupation: "Teacher (full-time)",
                        smoking: "Never smoker",
                        alcohol: "Occasional (1-2 glasses wine per week)"
                    },
                    familyHistory: {
                        mother: "Hypertension, no known AF",
                        father: "Myocardial infarction at age 65"
                    },
                    currentVitals: {
                        bloodPressure: "128/82",
                        heartRate: 78,
                        rhythm: "Sinus rhythm",
                        temperature: 36.5,
                        oxygenSaturation: 98
                    },
                    allergies: ["No known drug allergies", "Contrast media tolerated well"]
                },
                intraopData: {
                    ablation: { powerSetting: 35, targetTemperature: 43 },
                    vitals: { bloodPressure: "125/75", heartRate: 78 }
                }
            };
        }

        // Default fallback
        return {
            patient: {
                demographics: { name: "Unknown Patient", mrn: "N/A" },
                allergies: ["No data available"]
            },
            intraopData: {}
        };
    }

    /**
     * Get current procedure type
     */
    getCurrentProcedure()
    {
        return this.currentProcedure;
    }

    /**
     * Get current procedure data
     */
    getCurrentData()
    {
        return this.procedureData;
    }

    /**
     * Set callback for procedure change
     */
    onProcedureChange(callback)
    {
        this.onProcedureChanged = callback;
    }

    /**
     * Set callback for data loaded
     */
    onDataLoad(callback)
    {
        this.onDataLoaded = callback;
    }

    /**
     * Refresh current procedure data
     */
    async refreshData()
    {
        await this.loadProcedureData();
        return this.procedureData;
    }

    /**
     * Get available procedures
     */
    getAvailableProcedures()
    {
        return Array.from(this.procedureBtns).map(btn => ({
            id: btn.dataset.procedure,
            name: btn.textContent.trim(),
            active: btn.classList.contains('active')
        }));
    }
} 