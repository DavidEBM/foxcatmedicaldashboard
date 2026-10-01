# FoxCat Medical Dashboard

Dashboard médico construido con Next.js, React, Firebase y un pipeline de aprendizaje automático en Python. El sistema permite gestionar pacientes, consultar información clínica, ejecutar entrenamientos desde el área administrativa y visualizar predicciones, métricas y diagnósticos de los modelos.

> El módulo de IA es una herramienta de apoyo a la decisión. Sus predicciones no sustituyen la valoración médica, la espirometría, la historia clínica ni los protocolos institucionales.

## Contenido

- [Arquitectura](#arquitectura)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [Funcionamiento de la aplicación](#funcionamiento-de-la-aplicación)
- [Pipeline de aprendizaje automático](#pipeline-de-aprendizaje-automático)
- [Targets y algoritmos](#targets-y-algoritmos)
- [Umbrales y publicación](#umbrales-y-publicación)
- [Reportes y gráficas](#reportes-y-gráficas)
- [Sección investigativa: predicción de GOLD 1–4](#sección-investigativa-predicción-de-gold-14)
- [Interpretación de métricas y gráficas](#interpretación-de-métricas-y-gráficas)
- [Operación desde el panel de administradores](#operación-desde-el-panel-de-administradores)
- [Producción y solución de problemas](#producción-y-solución-de-problemas)
- [Limitaciones y trabajo futuro](#limitaciones-y-trabajo-futuro)

## Arquitectura

```text
Navegador
   |
   v
Next.js / React
   |-- Firebase Authentication
   |-- Firestore
   |-- API administrativa protegida
   |-- API de predicción
   |
   +--> proceso Python `ml.run_training`
             |-- carga y armonización de datos
             |-- selección de variables
             |-- CV + VALIDATION
             |-- selección y publicación
             |-- reportes CSV, XLSX y PNG
```

Componentes principales:

- `src/`: aplicación web, páginas, componentes y rutas API de Next.js.
- `src/components/admin/AdminTraining.tsx`: interfaz de entrenamiento para administradores.
- `src/lib/server/ml-training.ts`: crea el snapshot de Firebase y ejecuta el proceso Python.
- `src/app/api/admin/ml/route.ts`: devuelve manifest, estado e imágenes de entrenamiento.
- `src/app/api/admin/ml/train/route.ts`: inicia y consulta trabajos de entrenamiento.
- `ml/`: preparación de datos, entrenamiento, publicación, inferencia y diagnósticos.
- `ml/datasets/`: datasets locales y snapshots temporales de Firebase.
- `ml/outputs/SavedModels/`: modelos, manifest y reportes generados.
- `public/`: recursos estáticos de la aplicación.

## Puesta en marcha

### Requisitos

- Node.js compatible con Next.js 16.
- npm o pnpm.
- Python `>=3.10,<3.14` para el pipeline de IA.
- Si hay varias versiones de Python, configura `ML_PYTHON_EXECUTABLE` en `.env.local` con la ruta al intérprete del entorno que tiene `ml/requirements.txt` instalado; se usa tanto para inferencia como para entrenamiento.
- Proyecto Firebase con Authentication y Firestore habilitados.
- Credenciales administrativas de Firebase únicamente en el servidor.

### Instalación

```bash
npm install

# PowerShell
py -3.11 -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
python -m pip install -r ml/requirements.txt
```

### Desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Verificación de compilación

```bash
npm run build
```

### Entrenamiento por línea de comandos

Entrenar todos los algoritmos configurados para GOLD:

```bash
python -m ml.run_training \
  --targets copd_gold \
  --output-dir ml/outputs/SavedModels
```

Seleccionar algoritmos y targets concretos:

```bash
python -m ml.run_training \
  --targets copd_gold history_of_heart_failure \
  --algorithms CatBoost RandomForest XGBoost \
  --output-dir ml/outputs/SavedModels
```

Incluir un snapshot local de pacientes de Firebase:

```bash
python -m ml.run_training \
  --firebase-dataset ml/datasets/runtime/firebase-patients.json \
  --targets copd_gold
```

Desde el panel administrativo, la aplicación crea automáticamente el snapshot de Firestore y lo elimina al terminar el trabajo.

## Variables de entorno

Crear `.env.local` a partir de `.env.example`. Nunca subir `.env.local`, claves privadas ni snapshots de pacientes al repositorio.

### Firebase público

Estas variables se usan en el navegador y son identificadores del proyecto, no credenciales administrativas:

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Inicialización de Firebase cliente |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Dominio de Authentication |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Proyecto Firebase |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Aplicación Firebase |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Métricas, si se habilitan |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Mensajería Firebase |

### Firebase privado

Estas variables solo deben existir en el servidor, Vercel o el entorno de despliegue:

| Variable | Uso |
|---|---|
| `FIREBASE_ADMIN_PROJECT_ID` | Proyecto para Firebase Admin |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Cuenta de servicio |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Clave privada con saltos de línea escapados como `\\n` |
| `FIREBASE_ADMIN_CREDENTIALS_JSON` | JSON completo de la cuenta de servicio, como alternativa a las tres variables anteriores |
| `FIREBASE_ADMIN_CREDENTIALS` | Ruta alternativa a un JSON de cuenta de servicio; también acepta el JSON completo |
| `SESSION_COOKIE_DAYS` | Duración de la cookie de sesión; por defecto, 5 días |

No utilizar el prefijo `NEXT_PUBLIC_` para ninguna credencial administrativa.

### Configuración del pipeline ML

| Variable | Por defecto | Descripción |
|---|---:|---|
| `ML_RANDOM_STATE` | `42` | Semilla reproducible |
| `ML_TRAIN_SIZE` | `0.70` | Proporción de entrenamiento |
| `ML_VALIDATION_SIZE` | `0.15` | Proporción de validación |
| `ML_TEST_SIZE` | `0.15` | Proporción de test final |
| `CV_FOLDS` | `3` | Número base de folds de validación cruzada |
| `HARMONIZED_DATASET_PATH` | `ml/datasets/dataset_final_armonizado.csv` | Dataset local |
| `AI_OUTPUT_DIR` | `ml/outputs/SavedModels` | Carpeta de modelos y reportes |
| `ML_PYTHON_EXECUTABLE` | Python del sistema | Intérprete compartido por inferencia y entrenamiento; opcional, admite ruta absoluta |

Umbrales de elegibilidad fijos:

| Métrica | Umbral | Definición |
|---|---:|---|
| Accuracy | `0.70` | Accuracy |
| F1-Score | `0.70` | F1 macro para GOLD multiclase; F1 de `SI` para insuficiencia binaria |
| MCC | `0.40` | Matthews Correlation Coefficient |
| Kappa | `0.40` | Cohen's Kappa |
| ROC-AUC | `0.70` | AUC multiclase OVR para GOLD; binario para insuficiencia |

Los cinco umbrales son obligatorios y no configurables; deben cumplirse simultáneamente. La calidad normalizada se conserva únicamente como dato informativo e histórico y su gráfico está en Imágenes de diagnóstico.

## Funcionamiento de la aplicación

### Usuarios y seguridad

- Firebase Authentication gestiona el inicio de sesión.
- Las rutas administrativas verifican el token y exigen permisos de administrador.
- Firestore almacena pacientes y datos operativos.
- Las credenciales Admin SDK se cargan exclusivamente en el servidor.

### Área de administradores

El panel permite:

1. Elegir algoritmos y targets.
2. Decidir si se incluyen pacientes actuales de Firebase.
3. Iniciar un trabajo de entrenamiento en segundo plano.
4. Consultar el estado, logs y resultado del trabajo.
5. Revisar métricas de validación y test.
6. Consultar el modelo seleccionado y si superó los umbrales.
7. Descargar o visualizar imágenes y archivos de diagnóstico.
8. Ver la comparación MCC específica por target.

### API administrativa ML

| Método | Ruta | Función |
|---|---|---|
| `GET` | `/api/admin/ml` | Manifest, algoritmos, targets, estado e imágenes |
| `POST` | `/api/admin/ml/train` | Inicia un entrenamiento |
| `GET` | `/api/admin/ml/train?runId=...` | Consulta un trabajo concreto |
| `GET` | `/api/ai-training-manifest` | Consulta pública controlada del manifest de IA |

Todas las rutas administrativas requieren autenticación y autorización de administrador.

## Pipeline de aprendizaje automático

El flujo completo es:

```text
Dataset local + Firebase opcional
        |
        v
Armonización de columnas, targets y valores
        |
Deduplicación y construcción de clave de paciente
        |
Selección de variables por target
        |
TRAIN 70% ----> CV estratificada/agrupada
        |
VALIDATION 15% -> selección y comprobación de umbrales
        |
TRAIN + VALIDATION -> ajuste final del candidato
        |
TEST 15% ---------> evaluación final aislada
        |
Manifest + modelos + tablas + gráficas
```

### Preparación de datos

- Las columnas target se normalizan mediante alias para tolerar diferencias de acentos y nombres.
- Los targets binarios se convierten a etiquetas canónicas `SI` y `NO`.
- Se eliminan del conjunto predictor columnas que pueden filtrar el resultado, como identificadores, fechas y columnas con nombres de target, label, outcome o resultado.
- Se crean variables clínicas derivadas cuando corresponde.
- Los targets ordinales requieren cobertura de sus clases teóricas.
- Un target debe tener al menos 30 filas válidas y, en general, al menos 5 observaciones por clase para entrenarse.
- Si un target no tiene suficientes clases o cobertura, se marca como omitido y no se entrena.

### División y validación

- La división nominal es 70% TRAIN, 15% VALIDATION y 15% TEST.
- TRAIN se usa para entrenamiento y validación cruzada.
- VALIDATION se usa para seleccionar el modelo y comprobar los umbrales.
- TEST se mantiene aislado hasta la evaluación final.
- Cuando existe una clave de paciente, se evita que el mismo grupo aparezca en particiones diferentes.
- La validación cruzada usa `StratifiedGroupKFold` cuando hay grupos y `StratifiedKFold` cuando no los hay.

### Selección y publicación

La elegibilidad se determina solo con las cinco métricas anteriores de VALIDATION. Entre modelos elegibles se elige el F1-Score más alto; los empates se resuelven, en orden, por ROC-AUC, MCC, Kappa y Accuracy. CV, TEST y calidad normalizada no alteran ese orden. Si no hay modelos elegibles, no se elige ni se publica un ganador nuevo; un modelo previamente publicado se conserva únicamente si sus métricas de VALIDATION verifican los cinco umbrales actuales.

## Targets y algoritmos

### Targets disponibles

- `copd_gold`: COPD GOLD 1, 2, 3 o 4.
- `history_of_heart_failure`: antecedente de insuficiencia cardiaca `SI`/`NO`.
- `bodex`: BODEX 0–10.
- `escala_disnea`: escala de disnea 0–10.
- `epocconfirmado`: EPOC confirmado `SI`/`NO`.
- `clasifisui`: clasificación SUI 1–5.

La disponibilidad real depende de que el dataset contenga suficientes filas, clases y cobertura del dominio. Que un target aparezca en el selector no garantiza que pueda entrenarse en una corrida concreta.

### Algoritmos

- XGBoost.
- LightGBM.
- CatBoost.
- Random Forest.
- Extra Trees.
- Regresión logística.
- SVM con kernel RBF.
- Red neuronal MLP.

Cada entrenador devuelve un pipeline compatible con el flujo común, sus hiperparámetros, métricas de CV, métricas de validación y el artefacto serializado cuando corresponde.

## Umbrales y publicación

Un candidato es elegible cuando alcanza simultáneamente:

```text
accuracy >= 0.70
f1       >= 0.70
mcc      >= 0.40
kappa    >= 0.40
auc      >= 0.70
```

El estado se interpreta así:

- **Umbrales cumplidos**: el candidato superó VALIDATION y puede participar en publicación/diagnóstico.
- **Requiere revisión**: al menos una métrica no alcanzó el mínimo, o no hay evidencia suficiente para publicarlo.
- **Publicado**: el artefacto fue seleccionado y quedó disponible para inferencia.
- **Conservado**: no hubo un nuevo candidato elegible (o falló el ajuste final) y se mantuvo un artefacto anterior que sí cumple los cinco requisitos actuales.

Nunca se debe interpretar un modelo de diagnóstico con `thresholdMet=false` como un modelo aprobado para entorno real.

## Reportes y gráficas

Los reportes se generan por target en:

```text
ml/outputs/SavedModels/
├── training-manifest.json
├── training_metrics_report.xlsx
├── Models_All/
└── Model_Reports/
    └── <target>/
```

### Tablas

- `algoritmos_hiperparametros.csv`: algoritmos evaluados e hiperparámetros.
- `metricas_comparativas.csv`: métricas crudas, normalizadas e intervalos cuando están disponibles.
- `feature_importance.csv`: importancia de variables por modelo.
- `particion_datos.csv`: tamaño de TRAIN, VALIDATION y TEST.
- `tiempos_prediccion.csv`: latencia y capacidad de inferencia.
- `training-manifest.json`: fuente de datos, selección, umbrales, modelos y estado de publicación.
- `training-manifest.json` incluye `minimumThresholdsByTarget` para distinguir la política de 75% de GOLD y 70% del resto.
- `training_metrics_report.xlsx`: consolidado tabular para revisión.

### Imágenes principales

- `confusion_<modelo>.png`: matriz de confusión en valores absolutos.
- `confusion_normalizada_<modelo>.png`: matriz normalizada para comparar clases.
- `metricas_barras.png`: comparación visual de métricas.
- `metricas_heatmap.png`: mapa comparativo de calidad.
- `metricas_normalizadas.png`: métricas llevadas a escala común de 0 a 1.
- `metricas_ic95.png`: intervalos de confianza del 95% cuando están disponibles.
- `roc_comparativa.png`: curvas ROC y AUC para problemas compatibles.
- `prediccion_vs_real_<modelo>.png`: predicción frente a valor observado.
- `distribucion_clases_test.png`: distribución de clases en TEST.
- `boxplot_tiempos_prediccion.png`: comportamiento de latencia.
- `mcc_real_comparativa.png`: MCC real, sin normalizar, por modelo y target.
- `metricas_sesgo_<modelo>.png`: métricas frente al sesgo controlado hacia la clase mayoritaria.

Las imágenes administradas por el pipeline se limpian y regeneran por target. Las gráficas de calidad, MCC y sesgo se producen únicamente para candidatos que superaron el umbral mínimo. Si ningún modelo es elegible, es correcto que no se genere una gráfica de modelos aprobados.

## Sección investigativa: predicción de GOLD 1–4

### Naturaleza del problema

COPD GOLD 1–4 es un target ordinal: sus clases tienen un orden clínico de severidad creciente. Una formulación multiclase convencional trata los errores `GOLD 1 -> GOLD 2` y `GOLD 1 -> GOLD 4` como errores de una clase, aunque clínicamente no tienen la misma distancia. Por este motivo, el sistema actual evalúa el target como clasificación multiclase y complementa la lectura con la matriz de confusión, el recall por clase y la Balanced Accuracy.

En términos clínicos generales, un modelo que predice GOLD intenta aprender una relación entre variables del paciente —por ejemplo edad, tabaquismo, función pulmonar, saturación de oxígeno, frecuencia respiratoria, índice de masa corporal y variables clínicas disponibles— y la etiqueta GOLD observada en el dataset. La predicción no “descubre” por sí sola la severidad: aprende asociaciones estadísticas de los registros históricos y puede reflejar sesgos de selección, calidad de medición, práctica clínica y distribución de pacientes.

### Qué significa cada modelo

- **Regresión logística**: estima una relación lineal entre las variables transformadas y la probabilidad de cada clase. Es interpretable y sirve como línea base.
- **SVM**: busca fronteras que separen las clases en un espacio transformado. Puede funcionar bien con muestras pequeñas, pero es sensible al escalado y a la selección de hiperparámetros.
- **Random Forest / Extra Trees**: combinan muchos árboles. Capturan relaciones no lineales y generan una decisión agregada, pero pueden volverse inestables cuando cada clase tiene pocos ejemplos.
- **XGBoost / LightGBM / CatBoost**: construyen árboles secuencialmente corrigiendo errores anteriores. Capturan interacciones clínicas complejas, aunque con datasets pequeños pueden sobreajustar y aparentar una calidad mayor en VALIDATION de la que se observa en TEST.
- **MLP**: aprende capas no lineales. Requiere más datos y regularización; en una muestra clínica pequeña debe interpretarse con especial cautela.

La probabilidad del modelo no equivale automáticamente a riesgo clínico calibrado. Antes de usarla para decisiones, debe verificarse calibración, estabilidad temporal, desempeño por subgrupo y utilidad clínica.

### Interpretación de GOLD

1. Revisar primero la distribución de clases. Si GOLD 3 y GOLD 4 tienen pocos casos, su recall tendrá gran incertidumbre.
2. Revisar la matriz de confusión por filas: permite observar qué GOLD real se está confundiendo.
3. Valorar si los errores están cerca de la diagonal. Confundir GOLD 2 con GOLD 3 es diferente de confundir GOLD 1 con GOLD 4.
4. Comparar Balanced Accuracy, F1 macro, MCC y Kappa, no solo Accuracy.
5. Revisar intervalos de confianza. Una métrica alta con un intervalo muy amplio no representa evidencia sólida.
6. Confirmar que el resultado de TEST no haya sido usado para seleccionar el modelo.
7. Usar la predicción como apoyo y verificarla contra espirometría, evaluación médica y guías institucionales.

### Mejoras metodológicas futuras para GOLD

Como GOLD tiene orden natural, una futura comparación académica debería incluir, además de la clasificación multiclase actual:

- modelos ordinales;
- regresión ordinal;
- clasificación acumulativa —por ejemplo, separar `GOLD >= 2`, `GOLD >= 3` y `GOLD >= 4`—;
- métricas sensibles a distancia ordinal, como error absoluto medio de la categoría;
- evaluación por clase y análisis de calibración.

La versión actual conserva la clasificación multiclase porque mantiene el flujo común entre targets y permite comparar de forma consistente los ocho algoritmos. Esta decisión no implica que el problema ordinal esté completamente resuelto.

## Interpretación de métricas y gráficas

### Métricas

| Métrica | Rango | Interpretación |
|---|---:|---|
| Accuracy | 0 a 1 | Fracción total de predicciones correctas. Puede ser engañosa con clases desbalanceadas. |
| Balanced Accuracy | 0 a 1 | Promedio del recall de las clases. Da el mismo peso a cada clase. |
| Precision | 0 a 1 | De los casos predichos como una clase, cuántos eran correctos. |
| Sensitivity / Recall | 0 a 1 | De los casos realmente pertenecientes a una clase, cuántos detectó el modelo. |
| F1 | 0 a 1 | Balance entre precision y recall. En multiclase se usa promedio macro. |
| AUC | 0 a 1 | Capacidad de ordenar casos positivos por encima de negativos. No mide por sí sola el umbral final. |
| MCC | -1 a 1 | Correlación entre predicción y realidad. `1` es concordancia perfecta, `0` indica ausencia de asociación útil y `-1` inversión perfecta. |
| Kappa | -1 a 1 | Acuerdo entre predicción y realidad corrigiendo el acuerdo esperado por azar. |

### MCC y Kappa normalizados

Para construir tablas y gráficos comparables, MCC y Kappa pueden visualizarse en una escala 0–100% con:

```text
valor_normalizado = (valor_real + 1) / 2
porcentaje = valor_normalizado * 100
```

La normalización es solo una transformación visual. El valor científico original permanece en `[-1, 1]` y se exporta en las columnas crudas.

### Gráfica MCC real

`mcc_real_comparativa.png` muestra el MCC de VALIDATION sin normalización.

- Barra cercana a `1`: alta concordancia.
- Barra cercana a `0`: el modelo no aporta una relación consistente.
- Barra negativa: las predicciones tienen relación inversa con la realidad.
- Ausencia de barras: ningún modelo superó los umbrales o no hubo datos válidos para el gráfico.

### Gráfica de comportamiento frente al sesgo

`metricas_sesgo_<modelo>.png` usa remuestreo controlado sobre VALIDATION:

- Eje X: porcentaje de ejemplos de la clase mayoritaria, de 0% a 100%.
- Eje Y: valor real de la métrica, de `-1` a `1`.
- Cada línea representa Accuracy, F1, MCC, Kappa, Precision, Sensitivity, AUC y Balanced Accuracy cuando puede calcularse.

La gráfica no representa una nueva cohorte clínica ni demuestra causalidad. Es una prueba de sensibilidad: muestra cuánto se degrada la métrica cuando cambia artificialmente la proporción de clases. Las puntas de 0% y 100% pueden quedar indefinidas porque un conjunto con una sola clase no permite calcular algunas métricas de clasificación.

### Matrices de confusión

En la matriz absoluta, cada fila representa la clase real y cada columna la clase predicha. La diagonal son aciertos. En la matriz normalizada, cada fila se interpreta como proporción de pacientes de esa clase real.

Para GOLD, una diagonal fuerte y errores concentrados junto a ella suelen ser más razonables que errores alejados, pero nunca deben evaluarse sin contexto clínico.

### ROC y curvas

ROC/AUC evalúa la capacidad de ordenar las clases mediante scores o probabilidades. Un AUC alto no garantiza que las etiquetas finales con el umbral actual sean buenas. Por eso se revisan conjuntamente la matriz de confusión, F1, MCC, Kappa y Balanced Accuracy.

## Operación desde el panel de administradores

1. Entrar con una cuenta administradora.
2. Abrir el módulo de entrenamiento de IA.
3. Seleccionar target y algoritmos.
4. Mantener activada la inclusión de Firebase si se desea entrenar con los pacientes actuales.
5. Iniciar el entrenamiento.
6. Esperar el estado `succeeded` y revisar los logs.
7. Abrir el target y verificar `thresholdMet`.
8. Revisar primero VALIDATION y después TEST.
9. Descargar el manifest, CSV/XLSX y gráficas para auditoría.
10. No publicar ni utilizar clínicamente un target que indique **Requiere revisión**.

## Producción y solución de problemas

### Error `api/admin/ml: 500`

La ruta administrativa usa runtime Node porque depende de `firebase-admin`. La configuración de producción debe incluir:

- variables privadas de Firebase correctamente configuradas;
- `FIREBASE_ADMIN_PRIVATE_KEY` con `\\n` escapados o una ruta válida mediante `FIREBASE_ADMIN_CREDENTIALS`;
- compatibilidad de dependencias de Firebase Admin y `jwks-rsa`.

En Vercel se pueden definir las tres variables privadas por separado o pegar el JSON completo en `FIREBASE_ADMIN_CREDENTIALS_JSON`. El valor de la clave privada puede llevar saltos de linea reales o la secuencia literal `\\n`.

El proyecto fija la versión compatible de `jose` mediante overrides de npm/pnpm para evitar que una dependencia CommonJS intente cargar una versión ESM incompatible.

### Advertencia de preload de la imagen del logo

La advertencia:

```text
The resource /_next/image?...logo.png was preloaded but not used...
```

indica que la imagen fue precargada sin ser utilizada inmediatamente. Se retiró la prioridad de carga del logo para que el navegador no lo trate como un recurso crítico cuando no lo es. Es una advertencia de rendimiento, no un fallo del modelo.

### `Requiere revisión`

Este estado significa que el candidato no superó uno o más umbrales de VALIDATION, o que no hay evidencia suficiente. Por ejemplo, un modelo binario puede obtener Accuracy moderada prediciendo siempre la clase mayoritaria y, al mismo tiempo, F1, MCC, sensibilidad y AUC cercanos a cero. Ese comportamiento no debe ocultarse bajando los umbrales.

### Predicciones no disponibles

La inferencia verifica el manifest y solo utiliza targets cuyo reporte tiene `thresholdMet=true`. Si un target está bloqueado, devuelve el motivo en `blockedModels` y no genera una predicción aprobada.

## Limitaciones y trabajo futuro

- El desempeño depende de la calidad, cobertura y representatividad de los datos.
- Las particiones pequeñas producen intervalos de confianza amplios.
- El desbalance entre clases puede hacer que Accuracy parezca aceptable aunque la clase minoritaria no se detecte.
- La clasificación GOLD actual es multiclase, no ordinal explícita.
- Las probabilidades deben calibrarse antes de interpretarse como riesgo.
- La validación agrupada evita fugas por paciente, pero puede dejar muy pocos grupos por clase.
- No se deben usar técnicas de sobremuestreo antes de separar los folds; hacerlo puede producir fuga de información.

Mejoras recomendadas:

1. Añadir ponderación de clases a los modelos que aún no la usan, especialmente CatBoost, LightGBM y XGBoost.
2. Optimizar el umbral binario con VALIDATION o CV interno y congelarlo antes de TEST.
3. Repetir la validación agrupada y reportar la variabilidad entre repeticiones.
4. Incorporar más pacientes, especialmente de las clases minoritarias y GOLD 3–4.
5. Auditar el desempeño por sexo, edad, origen, centro y otros subgrupos clínicamente relevantes.
6. Evaluar calibración, utilidad clínica y validación temporal o externa.
7. Comparar modelos ordinales para GOLD con la implementación multiclase actual.

## Referencias metodológicas

- [scikit-learn: StratifiedGroupKFold](https://scikit-learn.org/1.4/modules/generated/sklearn.model_selection.StratifiedGroupKFold.html)
- [scikit-learn: ajuste del umbral de decisión](https://scikit-learn.org/1.5/modules/classification_threshold.html)
- [scikit-learn: balanced accuracy](https://scikit-learn.org/1.0/modules/generated/sklearn.metrics.balanced_accuracy_score.html)
- [CatBoost: `class_weights` y `auto_class_weights`](https://catboost.ai/docs/en/references/training-parameters/common)
- [scikit-learn: documentación general de métricas](https://scikit-learn.org/stable/api/sklearn.metrics.html)
- [imbalanced-learn: riesgos de fuga al remuestrear](https://imbalanced-learn.org/dev/common_pitfalls.html)
