"use strict";

import {
    savePanoramicPhoto,
    getPanoramicPhoto,
    updatePanoramicMarker,
    getPanoramicPhotosByAudit
} from "./database.js";

import {
    initializeCameraCapture
} from "./camera.js";

import {
    initializeMarker
} from "./marker.js";

import {
    exportAuditZip
} from "./export.js";

/* ======================================================
   ELEMENTOS DE INTERFAZ
====================================================== */

const form = document.querySelector("#audit-form");
const formMessage = document.querySelector("#form-message");

const auditPreview = document.querySelector("#audit-preview");
const auditSummary = document.querySelector("#audit-summary");

const connectionStatus = document.querySelector(
    "#connection-status"
);

const previewClient = document.querySelector("#preview-client");
const previewPlant = document.querySelector("#preview-plant");
const previewAuditor = document.querySelector("#preview-auditor");
const previewTag = document.querySelector("#preview-tag");

const captureTag = document.querySelector("#capture-tag");
const panoramicTitle = document.querySelector("#panoramic-title");
const captureMessage = document.querySelector("#capture-message");

const savedPhotoStatus = document.querySelector(
    "#saved-photo-status"
);

const savedPhotoName = document.querySelector(
    "#saved-photo-name"
);

const saveContinueButton = document.querySelector(
    "#save-continue-button"
);

const continueMessage = document.querySelector(
    "#continue-message"
);

const summaryTotal = document.querySelector("#summary-total");

const summaryComplete = document.querySelector(
    "#summary-complete"
);

const summaryPending = document.querySelector(
    "#summary-pending"
);

const summaryEmpty = document.querySelector("#summary-empty");

const summaryTableWrapper = document.querySelector(
    "#summary-table-wrapper"
);

const summaryTableBody = document.querySelector(
    "#summary-table-body"
);

const exportZipButton = document.querySelector(
    "#export-zip-button"
);

const exportDescription = document.querySelector(
    "#export-description"
);

const exportMessage = document.querySelector(
    "#export-message"
);

const exportProgressContainer = document.querySelector(
    "#export-progress-container"
);

const exportProgress = document.querySelector(
    "#export-progress"
);

const exportProgressText = document.querySelector(
    "#export-progress-text"
);

const AUDIT_STORAGE_KEY = "saircom-active-audit";

let activeAudit = null;
let cameraController = null;


/* ======================================================
   FUNCIONES GENERALES
====================================================== */

function formatLeakTag(number) {
    return `LF-${String(number).padStart(4, "0")}`;
}


function getTagNumber(codigo) {
    const match = String(codigo).match(/(\d+)$/);

    if (!match) {
        return null;
    }

    return Number(match[1]);
}


function updateConnectionStatus() {
    const online = navigator.onLine;

    connectionStatus.textContent = online
        ? "En línea"
        : "Sin conexión";

    connectionStatus.classList.toggle("online", online);
    connectionStatus.classList.toggle("offline", !online);
}


function saveTemporaryAudit(audit) {
    localStorage.setItem(
        AUDIT_STORAGE_KEY,
        JSON.stringify(audit)
    );
}


function getStoredAudit() {
    const storedAudit = localStorage.getItem(
        AUDIT_STORAGE_KEY
    );

    if (!storedAudit) {
        return null;
    }

    try {
        return JSON.parse(storedAudit);
    } catch (error) {
        console.error(
            "No se pudo recuperar la auditoría:",
            error
        );

        localStorage.removeItem(AUDIT_STORAGE_KEY);
        return null;
    }
}


function hasCoordinates(record) {
    if (!record) {
        return false;
    }

    const validX =
        record.xPano !== null &&
        record.xPano !== undefined &&
        record.xPano !== "" &&
        Number.isFinite(Number(record.xPano));

    const validY =
        record.yPano !== null &&
        record.yPano !== undefined &&
        record.yPano !== "" &&
        Number.isFinite(Number(record.yPano));

    return validX && validY;
}


function isRecordComplete(record) {
    return Boolean(
        record &&
        record.photoBlob &&
        String(record.title ?? "").trim() &&
        hasCoordinates(record)
    );
}

function updateExportState(records) {
    const total = records.length;

    const complete = records.filter(
        isRecordComplete
    ).length;

    const pending = total - complete;

    if (total === 0) {
        exportZipButton.disabled = true;

        exportDescription.textContent =
            `Hay ${pending} fuga(s) pendiente(s). ` +
            "Completa todos los registros antes de exportar.";

        return;
    }

    exportZipButton.disabled = false;

    exportDescription.textContent =
        `${complete} fuga(s) completa(s) lista(s) ` +
        "para exportar.";
}


function updateContinueButton(record) {
    saveContinueButton.disabled =
        !isRecordComplete(record);
}


function clearCurrentCaptureInterface() {
    panoramicTitle.value = "";

    captureMessage.textContent = "";
    captureMessage.className = "message";

    continueMessage.textContent = "";
    continueMessage.className = "message";

    savedPhotoName.textContent = "—";
    savedPhotoStatus.classList.add("hidden");

    markerController.hide();

    if (cameraController) {
        cameraController.clearPreview();
    }

    updateContinueButton(null);
}


/* ======================================================
   TABLA RESUMEN
====================================================== */

function createTableCell(text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text;

    if (className) {
        cell.className = className;
    }

    return cell;
}


async function refreshSummary() {
    if (!activeAudit) {
        auditSummary.classList.add("hidden");
        return;
    }

    auditSummary.classList.remove("hidden");

    const records = await getPanoramicPhotosByAudit(
        activeAudit.id
    );

    const completeRecords = records.filter(
        isRecordComplete
    );

    const pendingRecords =
        records.length - completeRecords.length;

    summaryTotal.textContent = String(records.length);
    summaryComplete.textContent = String(
        completeRecords.length
    );

    summaryPending.textContent = String(
        pendingRecords
    );

    updateExportState(records);

    summaryTableBody.replaceChildren();

    if (!records.length) {
        summaryEmpty.classList.remove("hidden");
        summaryTableWrapper.classList.add("hidden");
        return;
    }

    summaryEmpty.classList.add("hidden");
    summaryTableWrapper.classList.remove("hidden");

    for (const record of records) {
        const row = document.createElement("tr");

        const hasPhoto = Boolean(record.photoBlob);
        const hasMarker = hasCoordinates(record);
        const complete = isRecordComplete(record);

        row.append(
            createTableCell(record.codigo),

            createTableCell(
                String(record.title ?? "").trim() || "—"
            ),

            createTableCell(
                hasPhoto ? "Sí" : "No",
                hasPhoto ? "yes-value" : "no-value"
            ),

            createTableCell(
                hasMarker ? "Sí" : "No",
                hasMarker ? "yes-value" : "no-value"
            )
        );

        const statusCell = document.createElement("td");
        const statusChip = document.createElement("span");

        statusChip.className = complete
            ? "status-chip complete"
            : "status-chip pending";

        statusChip.textContent = complete
            ? "Completa"
            : "Pendiente";

        statusCell.append(statusChip);
        row.append(statusCell);

        const actionCell = document.createElement("td");
        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.className = "table-action-button";
        editButton.textContent = complete
            ? "Editar"
            : "Continuar";

        editButton.dataset.codigo = record.codigo;

        actionCell.append(editButton);
        row.append(actionCell);

        summaryTableBody.append(row);
    }
}


/* ======================================================
   MARCADOR
====================================================== */

const markerController = initializeMarker({
    async onMarkerSaved({
        codigo,
        xPano,
        yPano
    }) {
        if (!activeAudit) {
            throw new Error(
                "No existe una auditoría activa."
            );
        }

        const title = panoramicTitle.value.trim();

        if (!title) {
            throw new Error(
                "Ingresa una referencia de ubicación."
            );
        }

        const updatedRecord =
            await updatePanoramicMarker(
                activeAudit.id,
                codigo,
                xPano,
                yPano,
                title
            );

        updateContinueButton(updatedRecord);
        await refreshSummary();

        return updatedRecord;
    }
});


/* ======================================================
   CARGAR REGISTRO ACTUAL
====================================================== */

async function updateSavedPhotoStatus() {
    savedPhotoStatus.classList.add("hidden");
    savedPhotoName.textContent = "—";

    markerController.hide();

    if (cameraController) {
        cameraController.clearPreview();
    }

    updateContinueButton(null);

    if (!activeAudit) {
        return;
    }

    const codigo = formatLeakTag(
        activeAudit.currentTag
    );

    try {
        const record = await getPanoramicPhoto(
            activeAudit.id,
            codigo
        );

        if (!record) {
            panoramicTitle.value = "";
            return;
        }

        savedPhotoName.textContent = record.fileName;
        savedPhotoStatus.classList.remove("hidden");

        panoramicTitle.value =
            String(record.title ?? "");

        await markerController.showPhoto({
            codigo,
            blob: record.photoBlob,
            savedXPano: record.xPano,
            savedYPano: record.yPano
        });

        updateContinueButton(record);
    } catch (error) {
        console.error(
            "No se pudo consultar la fotografía:",
            error
        );
    }
}


function showAudit(audit) {
    activeAudit = audit;

    const codigo = formatLeakTag(
        audit.currentTag
    );

    previewClient.textContent = audit.client;
    previewPlant.textContent = audit.plant;
    previewAuditor.textContent = audit.auditor;
    previewTag.textContent = codigo;

    captureTag.textContent =
        `Registrando: ${codigo}`;

    auditPreview.classList.remove("hidden");
    auditSummary.classList.remove("hidden");

    void updateSavedPhotoStatus();
    void refreshSummary();
}


/* ======================================================
   CREAR AUDITORÍA
====================================================== */

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    const client = String(
        formData.get("client") ?? ""
    ).trim();

    const plant = String(
        formData.get("plant") ?? ""
    ).trim();

    const auditor = String(
        formData.get("auditor") ?? ""
    ).trim();

    const currentTag = Number(
        formData.get("initialTag")
    );

    if (
        !client ||
        !plant ||
        !auditor ||
        !Number.isInteger(currentTag) ||
        currentTag < 1
    ) {
        formMessage.textContent =
            "Completa correctamente todos los campos.";

        formMessage.className =
            "message error";

        return;
    }

    const audit = {
        id: crypto.randomUUID(),
        client,
        plant,
        auditor,
        currentTag,
        createdAt: new Date().toISOString()
    };

    clearCurrentCaptureInterface();

    saveTemporaryAudit(audit);
    showAudit(audit);

    formMessage.textContent =
        "Auditoría creada correctamente.";

    formMessage.className =
        "message success";

    auditPreview.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});


/* ======================================================
   CÁMARA
====================================================== */

cameraController = initializeCameraCapture({
    getCurrentTag() {
        if (!activeAudit) {
            return null;
        }

        return formatLeakTag(
            activeAudit.currentTag
        );
    },

    async onPhotoAccepted({
        codigo,
        blob
    }) {
        if (!activeAudit) {
            captureMessage.textContent =
                "No existe una auditoría activa.";

            captureMessage.className =
                "message error";

            return false;
        }

        const title =
            panoramicTitle.value.trim();

        if (!title) {
            captureMessage.textContent =
                "Ingresa una referencia de ubicación antes de guardar.";

            captureMessage.className =
                "message error";

            panoramicTitle.focus();
            return false;
        }

        const existingRecord =
            await getPanoramicPhoto(
                activeAudit.id,
                codigo
            );

        if (existingRecord) {
            const replace = window.confirm(
                `${codigo} ya tiene una fotografía registrada.\n\n` +
                "¿Deseas reemplazarla?"
            );

            if (!replace) {
                return false;
            }
        }

        const fileName =
            `${codigo}_PANORAMICA.jpg`;

        const record = {
            id: `${activeAudit.id}:${codigo}`,
            auditId: activeAudit.id,
            codigo,
            fileName,
            title,
            photoBlob: blob,
            xPano: null,
            yPano: null,

            capturedAt:
                existingRecord?.capturedAt ??
                new Date().toISOString(),

            updatedAt: new Date().toISOString(),
            status: "foto_capturada"
        };

        await savePanoramicPhoto(record);

        savedPhotoName.textContent = fileName;
        savedPhotoStatus.classList.remove("hidden");

        updateContinueButton(record);

        await markerController.showPhoto({
            codigo,
            blob,
            savedXPano: null,
            savedYPano: null
        });

        await refreshSummary();

        document
            .querySelector("#marker-panel")
            .scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        return true;
    }
});


/* ======================================================
   GUARDAR Y CONTINUAR
====================================================== */

saveContinueButton.addEventListener(
    "click",
    async () => {
        if (!activeAudit) {
            continueMessage.textContent =
                "No existe una auditoría activa.";

            continueMessage.className =
                "message error";

            return;
        }

        const codigo = formatLeakTag(
            activeAudit.currentTag
        );

        const record = await getPanoramicPhoto(
            activeAudit.id,
            codigo
        );

        const currentTitle =
            panoramicTitle.value.trim();

        if (!record?.photoBlob) {
            continueMessage.textContent =
                "Debes tomar y guardar la fotografía panorámica.";

            continueMessage.className =
                "message error";

            return;
        }

        if (!currentTitle) {
            continueMessage.textContent =
                "Debes ingresar la referencia de ubicación.";

            continueMessage.className =
                "message error";

            panoramicTitle.focus();
            return;
        }

        if (!hasCoordinates(record)) {
            continueMessage.textContent =
                "Debes marcar y guardar la ubicación exacta.";

            continueMessage.className =
                "message error";

            return;
        }

        const finalRecord = {
            ...record,
            title: currentTitle,
            status: "completo",
            updatedAt: new Date().toISOString()
        };

        await savePanoramicPhoto(finalRecord);

        activeAudit.currentTag += 1;

        saveTemporaryAudit(activeAudit);

        clearCurrentCaptureInterface();
        showAudit(activeAudit);

        continueMessage.textContent =
            `${codigo} guardada. Continúa con ` +
            `${formatLeakTag(activeAudit.currentTag)}.`;

        continueMessage.className =
            "message success";

        document
            .querySelector(".capture-section")
            .scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
    }
);


/* ======================================================
   EDITAR DESDE EL RESUMEN
====================================================== */

summaryTableBody.addEventListener(
    "click",
    (event) => {
        const button = event.target.closest(
            ".table-action-button"
        );

        if (!button || !activeAudit) {
            return;
        }

        const codigo = button.dataset.codigo;
        const tagNumber = getTagNumber(codigo);

        if (!Number.isInteger(tagNumber)) {
            return;
        }

        activeAudit.currentTag = tagNumber;

        saveTemporaryAudit(activeAudit);
        clearCurrentCaptureInterface();
        showAudit(activeAudit);

        document
            .querySelector(".capture-section")
            .scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
    }
);

/* ======================================================
   EXPORTAR AUDITORÍA
====================================================== */

exportZipButton.addEventListener(
    "click",
    async () => {
        if (!activeAudit) {
            exportMessage.textContent =
                "No existe una auditoría activa.";

            exportMessage.className =
                "message error";

            return;
        }

        exportZipButton.disabled = true;
        exportProgress.value = 0;

        exportProgressContainer.classList.remove(
            "hidden"
        );

        exportMessage.textContent = "";
        exportMessage.className = "message";

        exportProgressText.textContent =
            "Preparando fotografías y archivos…";

        try {
            const records =
                await getPanoramicPhotosByAudit(
                    activeAudit.id
                );

            const result = await exportAuditZip({
                audit: activeAudit,
                records,

                onProgress(percent) {
                    const rounded = Math.round(percent);

                    exportProgress.value = rounded;

                    exportProgressText.textContent =
                        `Generando ZIP: ${rounded}%`;
                }
            });

            activeAudit.exportedAt =
                new Date().toISOString();

            saveTemporaryAudit(activeAudit);

            const sizeMb = (
                result.sizeBytes /
                1024 /
                1024
            ).toFixed(2);

            exportMessage.textContent =
                `Exportación completada: ` +
                `${result.fileName} (${sizeMb} MB).`;

            exportMessage.className =
                "message success";

            exportProgress.value = 100;

            exportProgressText.textContent =
                `${result.recordsExported} fuga(s) exportada(s).`;

        } catch (error) {
            console.error(error);

            exportMessage.textContent =
                error instanceof Error
                    ? error.message
                    : "No se pudo exportar la auditoría.";

            exportMessage.className =
                "message error";

            exportProgressText.textContent =
                "La exportación no se completó.";

        } finally {
            await refreshSummary();
        }
    }
);


/* ======================================================
   CONEXIÓN Y ARRANQUE
====================================================== */

window.addEventListener(
    "online",
    updateConnectionStatus
);

window.addEventListener(
    "offline",
    updateConnectionStatus
);

updateConnectionStatus();

const storedAudit = getStoredAudit();

if (storedAudit) {
    showAudit(storedAudit);
}


/* ======================================================
   SERVICE WORKER
====================================================== */

if ("serviceWorker" in navigator) {
    let reloadingForUpdate = false;

    navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
            if (reloadingForUpdate) {
                return;
            }

            reloadingForUpdate = true;

            console.info(
                "Nueva versión detectada. Recargando aplicación."
            );

            window.location.reload();
        }
    );

    window.addEventListener("load", async () => {
        try {
            const registration =
                await navigator.serviceWorker.register(
                    "./service-worker.js",
                    {
                        updateViaCache: "none"
                    }
                );

            await registration.update();

            console.info(
                "Service worker registrado y actualizado."
            );

        } catch (error) {
            console.error(
                "No se pudo registrar el service worker:",
                error
            );
        }
    });
}