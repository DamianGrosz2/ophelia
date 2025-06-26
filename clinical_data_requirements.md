# Clinical Data Requirements for OR Voice Assistant

## Endovascular PAD Angioplasty Procedure

### Pre-operative Data Requirements
- **Patient Demographics**: Age, gender, BMI
- **Medical History**: 
  - Previous PAD interventions
  - Diabetes status and control
  - Smoking history
  - Cardiovascular comorbidities
- **Imaging Data**:
  - Ankle-brachial index (ABI)
  - CT angiography results
  - Duplex ultrasound findings
  - Lesion location and severity
- **Laboratory Values**:
  - Creatinine/eGFR (contrast nephropathy risk)
  - Platelet count
  - PT/INR, aPTT
  - Hemoglobin
- **Medications**:
  - Antiplatelet therapy
  - Anticoagulation status
  - Metformin (contrast exposure)
- **Allergies**: Contrast media, medications

### Intra-operative Data Requirements
- **Procedural Planning**:
  - Vessel access site
  - Target lesion characteristics
  - Planned intervention strategy
- **Real-time Monitoring**:
  - Blood pressure and heart rate
  - Contrast volume used
  - Fluoroscopy time
  - Radiation dose
- **Device Information**:
  - Balloon/stent specifications
  - Guide wire selection
  - Catheter sizes
- **Complications Tracking**:
  - Vessel dissection
  - Perforation
  - Embolization
  - Access site bleeding

## EP (Electrophysiology) Procedure

### Pre-operative Data Requirements
- **Patient Demographics**: Age, gender, weight
- **Cardiac History**:
  - Arrhythmia type and frequency
  - Previous ablations
  - Device history (pacemaker, ICD)
  - Heart failure status
- **Imaging Data**:
  - Echocardiogram (chamber sizes, EF)
  - Cardiac MRI (if available)
  - CT for pulmonary vein anatomy
- **Laboratory Values**:
  - Electrolytes (K+, Mg2+)
  - Thyroid function
  - PT/INR, aPTT
  - Creatinine
- **Medications**:
  - Antiarrhythmic drugs
  - Anticoagulation
  - Rate control medications
- **ECG Data**:
  - Baseline rhythm
  - P-wave morphology
  - Previous EP study results

### Intra-operative Data Requirements
- **Electrophysiology Mapping**:
  - Chamber geometry
  - Activation patterns
  - Conduction velocities
  - Refractory periods
- **Real-time Monitoring**:
  - Intracardiac electrograms
  - Surface ECG
  - Blood pressure
  - Temperature monitoring
- **Ablation Parameters**:
  - Power settings
  - Temperature achieved
  - Contact force
  - Lesion duration
- **Procedural Milestones**:
  - Transseptal puncture
  - Pulmonary vein isolation
  - Linear lesions
  - Endpoint achievement

## OR Schedule Integration Data

### Common Schedule Information
- **Patient Identification**: MRN, name, DOB
- **Procedure Details**: 
  - Scheduled start time
  - Estimated duration
  - Surgeon/operator
  - Support staff
- **Room Assignment**: OR number, equipment allocation
- **Equipment Requirements**:
  - C-arm specifications (PAD)
  - EP mapping system (EP)
  - Specialized catheters/devices
- **Preparation Notes**: 
  - Pre-procedure medications
  - Positioning requirements
  - Special considerations

### Critical Alerts
- **Patient Safety**: Allergies, contraindications
- **Equipment Status**: Device availability, calibration
- **Schedule Changes**: Delays, cancellations, urgency 