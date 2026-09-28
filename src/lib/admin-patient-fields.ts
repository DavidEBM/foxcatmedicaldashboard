export interface PatientImportField {
  key: string;
  label: string;
  aliases: string[];
}

export const PATIENT_IMPORT_FIELDS: PatientImportField[] = [
  // IDENTIFICACIÓN
  {
    key: "unnamedIndex",
    label: "Índice temporal",
    aliases: [
      "Unnamed: 0",
      "Unnamed 0",
      "unnamed: 0",
      "unnamed 0",
      "unnamed0",
    ],
  },
  {
    key: "name",
    label: "Nombre",
    aliases: [
      "name",
      "nombre",
      "patientName",
      "patient name",
      "paciente",
      "nombre completo",
      "fullName",
      "NOMBRE",
    ],
  },
  {
    key: "documentId",
    label: "Documento",
    aliases: [
      "documentId",
      "document id",
      "documento",
      "cedula",
      "cédula",
      "identificacion",
      "identificación",
      "dni",
      "document",
      "id paciente",
      "patient id",
      "ID",
    ],
  },
  {
    key: "age",
    label: "Edad",
    aliases: [
      "age",
      "edad",
      "EDAD",
    ],
  },
  {
    key: "sex",
    label: "Sexo",
    aliases: [
      "sex",
      "sexo",
      "gender",
      "genero",
      "género",
      "Genero Sexo",
    ],
  },

  // ESTADO / UBICACIÓN
  {
    key: "status",
    label: "Estado",
    aliases: [
      "status",
      "estado",
      "clinicalStatus",
      "clinical status",
      "condicion",
      "condición",
      "ESTADO",
    ],
  },
  {
    key: "locationCity",
    label: "Ciudad / ubicación",
    aliases: [
      "locationCity",
      "location city",
      "Location",
      "location",
      "ubicacion",
      "ubicación",
      "ciudad",
      "city",
    ],
  },
  {
    key: "locationElevationM",
    label: "Altitud (msnm)",
    aliases: [
      "locationElevationM",
      "location elevation",
      "Altura_MSNM",
      "altura msnm",
      "altura sobre nivel del mar",
      "elevacion",
      "elevación",
      "elevation",
    ],
  },

  // TABAQUISMO
  {
    key: "smokingDaily",
    label: "Consumo de tabaco diario",
    aliases: [
      "smokingDaily",
      "smoking daily",
      "smoking",
      "consumo diario",
      "consumo de tabaco",
      "cigarrillos diarios",
      "cigarrillos por dia",
      "cigarrillos por día",
    ],
  },
  {
    key: "smokingStatus",
    label: "Estado de tabaquismo",
    aliases: [
      "smokingStatus",
      "smoking status",
      "status of smoking",
      "estado fumador",
      "estado de fumador",
      "estado tabaquismo",
      "tabaquismo",
      "fumador",
    ],
  },
  {
    key: "packHistory",
    label: "Paquetes-año",
    aliases: [
      "packHistory",
      "PackHistory",
      "pack history",
      "packYears",
      "pack years",
      "pack-years",
      "paquetes año",
      "paquetes-año",
      "paquetes/ano",
      "paquetes/año",
      "paq años",
      "paq-años",
    ],
  },

  // EPOC
  {
    key: "copdSeverity",
    label: "Severidad EPOC",
    aliases: [
      "copdSeverity",
      "COPDSEVERITY",
      "copd severity",
      "severidad EPOC",
      "severidad epoc",
    ],
  },
  {
    key: "copdGold",
    label: "GOLD EPOC",
    aliases: [
      "copdGold",
      "copd gold",
      "COPD GOLD(1 a 4) (Target)",
      "COPD GOLD",
      "gold",
      "goldCopd",
      "clasificacion gold",
      "clasificación gold",
      "clasificacionEPOC",
      "clasificación EPOC",
      "copdGold1",
    ],
  },
  {
    key: "copdConfirmed",
    label: "EPOC confirmado",
    aliases: [
      "copdConfirmed",
      "EPOCCONFIRMADO(Si ó no) (Target)",
      "EPOCCONFIRMADO",
      "epoc confirmado",
      "epocconfirmado",
    ],
  },

  // FUNCIÓN PULMONAR
  {
    key: "mwt1",
    label: "MWT1",
    aliases: [
      "mwt1",
      "MWT1",
    ],
  },
  {
    key: "mwt2",
    label: "MWT2",
    aliases: [
      "mwt2",
      "MWT2",
    ],
  },
  {
    key: "mwt1Best",
    label: "MWT1 mejor resultado",
    aliases: [
      "mwt1Best",
      "MWT1Best",
      "MWT1 Best",
    ],
  },
  {
    key: "fev1",
    label: "FEV1",
    aliases: [
      "fev1",
      "FEV1",
    ],
  },
  {
    key: "fev1Pred",
    label: "FEV1 predicho",
    aliases: [
      "fev1Pred",
      "FEV1PRED",
      "FEV1 PRED",
      "FEV1 predicho",
    ],
  },
  {
    key: "fvc",
    label: "FVC",
    aliases: [
      "fvc",
      "FVC",
    ],
  },
  {
    key: "fvcPred",
    label: "FVC predicho",
    aliases: [
      "fvcPred",
      "FVCPRED",
      "FVC PRED",
      "FVC predicho",
    ],
  },

  // ESCALAS CLÍNICAS
  {
    key: "cat",
    label: "CAT",
    aliases: [
      "cat",
      "catScore",
      "CAT",
      "CAT score",
    ],
  },
  {
    key: "had",
    label: "HAD",
    aliases: [
      "had",
      "hadScore",
      "HAD",
      "HAD score",
    ],
  },
  {
    key: "sgrq",
    label: "SGRQ",
    aliases: [
      "sgrq",
      "SGRQ",
      "SGRQ score",
    ],
  },
  {
    key: "mmrc",
    label: "mMRC",
    aliases: [
      "mmrc",
      "mMRC",
      "mMRC score",
      "escala mMRC",
    ],
  },
  {
    key: "bodex",
    label: "BODEX",
    aliases: [
      "bodex",
      "BODEX (0 a 10 puntos) (Target)",
      "BODE-X",
    ],
  },
  {
    key: "dyspneaScale",
    label: "Escala de disnea",
    aliases: [
      "dyspneaScale",
      "dyspneaScore",
      "ESCALA DISNEA (0 a 10 puntos) (Target)",
      "escala disnea",
      "escala de disnea",
      "disnea",
    ],
  },

  // CARDIOVASCULAR
  {
    key: "atrialFib",
    label: "Fibrilación auricular",
    aliases: [
      "atrialFib",
      "atrialFibrillation",
      "AtrialFib",
      "atrial fib",
      "atrial fibrillation",
      "fibrilacion auricular",
      "fibrilación auricular",
    ],
  },
  {
    key: "heartFailureHistory",
    label: "Antecedente de falla cardíaca",
    aliases: [
      "heartFailureHistory",
      "heart failure history",
      "History of Heart Failure(Si ó no)(Target)",
      "Insuficiencia cardiaca",
      "insuficiencia cardiaca",
      "insuficiencia cardíaca",
      "falla cardiaca",
      "falla cardíaca",
      "antecedentes falla cardiaca",
      "antecedentes falla cardíaca",
    ],
  },
  {
    key: "coronaryHistory",
    label: "Antecedente coronario",
    aliases: [
      "coronaryHistory",
      "coronary history",
      "antecedentes coronarios",
      "antecedente coronario",
      "cardiopatia isquemica",
      "cardiopatía isquémica",
      "enfermedad coronaria",
    ],
  },
  {
    key: "arrhythmias",
    label: "Arritmias",
    aliases: [
      "arrhythmias",
      "arritmias",
      "arrhythmia",
      "arritmia",
    ],
  },
  {
    key: "cardiovascularRisk",
    label: "Riesgo cardiovascular",
    aliases: [
      "cardiovascularRisk",
      "RIESGO CARDIOVASCULAR",
      "riesgo cardiovascular",
    ],
  },

  // SIGNOS VITALES
  {
    key: "temperature",
    label: "Temperatura",
    aliases: [
      "temperature",
      "Temperature",
      "temperatura",
      "temp",
    ],
  },
  {
    key: "respiratoryRate",
    label: "Frecuencia respiratoria",
    aliases: [
      "respiratoryRate",
      "respiratory rate",
      "Respiratory Rate",
      "frecuencia respiratoria",
      "fr",
    ],
  },
  {
    key: "heartRate",
    label: "Frecuencia cardíaca",
    aliases: [
      "heartRate",
      "heart rate",
      "Heart Rate",
      "frecuencia cardiaca",
      "frecuencia cardíaca",
      "fc",
      "pulso",
    ],
  },
  {
    key: "oxygenSaturation",
    label: "Saturación O₂",
    aliases: [
      "oxygenSaturation",
      "oxygen saturation",
      "Oxygen Saturation",
      "saturacion",
      "saturación",
      "saturacion o2",
      "saturación o2",
      "spo2",
      "spO2",
      "o2",
    ],
  },
  {
    key: "systolicBP",
    label: "Presión sistólica",
    aliases: [
      "systolicBP",
      "systolic bp",
      "presion sistolica",
      "presión sistólica",
      "pas",
      "presion arterial sistolica",
      "presión arterial sistólica",
    ],
  },
  {
    key: "diastolicBP",
    label: "Presión diastólica",
    aliases: [
      "diastolicBP",
      "diastolic bp",
      "presion diastolica",
      "presión diastólica",
      "pad",
      "presion arterial diastolica",
      "presión arterial diastólica",
    ],
  },
  {
    key: "bloodPressure",
    label: "Presión arterial",
    aliases: [
      "bloodPressure",
      "Blood pressure",
      "blood pressure",
      "presion arterial",
      "presión arterial",
      "tension arterial",
      "tensión arterial",
    ],
  },

  // ANTROPOMETRÍA
  {
    key: "bmi",
    label: "IMC",
    aliases: [
      "bmi",
      "BMI,kg/m2 (IMC)",
      "BMI",
      "imc",
      "indice de masa corporal",
      "índice de masa corporal",
    ],
  },
  {
    key: "weight",
    label: "Peso",
    aliases: [
      "weight",
      "PESO",
      "peso",
      "peso kg",
      "weight kg",
    ],
  },
  {
    key: "height",
    label: "Talla / altura",
    aliases: [
      "height",
      "TALLA(altura ó Height/m)",
      "TALLA",
      "altura",
      "Height",
      "Height/m",
      "talla",
    ],
  },

  // RESPIRATORIO
  {
    key: "sputum",
    label: "Esputo",
    aliases: [
      "sputum",
      "Sputum",
      "esputo",
      "expectoracion",
      "expectoración",
    ],
  },
  {
    key: "asthma",
    label: "Asma",
    aliases: [
      "asthma",
      "Asma",
      "asma",
    ],
  },
  {
    key: "pulmonaryStatus",
    label: "Estado pulmonar",
    aliases: [
      "pulmonaryStatus",
      "ESTADO PULMONAR",
      "estado pulmonar",
    ],
  },

  // DIAGNÓSTICO / CONTEXTO
  {
    key: "diagnosisName",
    label: "Diagnóstico",
    aliases: [
      "diagnosisName",
      "NOMBRE_DIAG",
      "nombre diagnostico",
      "nombre diagnóstico",
      "diagnostico",
      "diagnóstico",
      "diagnosis",
    ],
  },
  {
    key: "lifeCycle",
    label: "Ciclo de vida",
    aliases: [
      "lifeCycle",
      "CICLO_DE_VIDA",
      "ciclo de vida",
      "ciclo_de_vida",
    ],
  },
  {
    key: "emergencyClassification",
    label: "Clasificación de urgencias",
    aliases: [
      "emergencyClassification",
      "CLASIFISUI (1 a 5, clasificacion urgencias) (Target)",
      "CLASIFISUI",
      "clasificacion urgencias",
      "clasificación urgencias",
    ],
  },

  // DISCAPACIDAD / OCUPACIÓN
  {
    key: "disability",
    label: "Discapacidad",
    aliases: [
      "disability",
      "DISCAPACIDAD",
      "discapacidad",
    ],
  },
  {
    key: "disabilityType",
    label: "Tipo de discapacidad",
    aliases: [
      "disabilityType",
      "TIPODISCAPAC",
      "tipo discapacidad",
      "tipo de discapacidad",
    ],
  },
  {
    key: "occupation",
    label: "Ocupación",
    aliases: [
      "occupation",
      "OCUPACION",
      "OCUPACIÓN",
      "ocupacion",
      "ocupación",
      "profesion",
      "profesión",
    ],
  },

  // LABORATORIO
  {
    key: "glucose",
    label: "Glucosa",
    aliases: [
      "glucose",
      "glucosa",
      "glycemia",
      "glicemia",
    ],
  },
  {
    key: "hemoglobin",
    label: "Hemoglobina",
    aliases: [
      "hemoglobin",
      "hemoglobina",
      "hb",
    ],
  },
  {
    key: "creatinine",
    label: "Creatinina",
    aliases: [
      "creatinine",
      "creatinina",
      "creat",
    ],
  },
  {
    key: "ecg",
    label: "ECG",
    aliases: [
      "ecg",
      "ECG",
      "electrocardiograma",
      "electrocardiography",
    ],
  },
  {
    key: "bnp",
    label: "BNP",
    aliases: [
      "bnp",
      "BNP",
      "brain natriuretic peptide",
    ],
  },

  // HOSPITALIZACIÓN
  {
    key: "roomBed",
    label: "Habitación / cama",
    aliases: [
      "roomBed",
      "room bed",
      "habitacion cama",
      "habitación cama",
      "habitacion/cama",
      "habitación/cama",
      "habitacion",
      "habitación",
      "cama",
    ],
  },
  {
    key: "consultationTime",
    label: "Hora de consulta",
    aliases: [
      "consultationTime",
      "consultation time",
      "hora consulta",
      "hora de consulta",
      "appointmentTime",
    ],
  },
  {
    key: "monitoringTime",
    label: "Hora de monitoreo",
    aliases: [
      "monitoringTime",
      "monitoring time",
      "hora monitoreo",
      "hora de monitoreo",
    ],
  },
  {
    key: "labTime",
    label: "Hora de laboratorio",
    aliases: [
      "labTime",
      "lab time",
      "laboratoryTime",
      "laboratory time",
      "hora laboratorio",
      "hora de laboratorio",
    ],
  },

  // INFORMACIÓN ADICIONAL
  {
    key: "notes",
    label: "Notas",
    aliases: [
      "notes",
      "notas",
      "observaciones",
      "observacion",
      "observación",
      "observation",
      "comentarios",
      "comments",
    ],
  },
  {
    key: "datasetOrigin",
    label: "Origen del dataset",
    aliases: [
      "datasetOrigin",
      "dataset_origen",
      "dataset origen",
      "origen dataset",
    ],
  },
];

export const PATIENT_IMPORT_FIELD_KEYS =
  PATIENT_IMPORT_FIELDS.map(
    (field) => field.key
  );

export function getPatientImportField(
  key: string
): PatientImportField | undefined {
  return PATIENT_IMPORT_FIELDS.find(
    (field) => field.key === key
  );
}