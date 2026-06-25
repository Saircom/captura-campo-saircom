"use strict";


function sanitizeFileSegment(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_")
        .toUpperCase();
}


function getExportDate() {
    return new Date().toISOString().slice(0, 10);
}


function hasCoordinates(record) {
    const xValid =
        record.xPano !== null &&
        record.xPano !== undefined &&
        Number.isFinite(Number(record.xPano));

    const yValid =
        record.yPano !== null &&
        record.yPano !== undefined &&
        Number.isFinite(Number(record.yPano));

    return xValid && yValid;
}


function isComplete(record) {
    return Boolean(
        record &&
        record.photoBlob &&
        String(record.title ?? "").trim() &&
        hasCoordinates(record)
    );
}


function downloadBlob(blob, fileName) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = fileName;
    link.style.display = "none";

    document.body.append(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
    }, 1500);
}


function buildCaptureRecords(records) {
    return records.map((record) => ({
        codigo: record.codigo,
        foto_panoramica: record.fileName,
        titulo_panoramica: String(record.title ?? "").trim(),
        x_pano: Number(record.xPano),
        y_pano: Number(record.yPano),
        fecha_captura: record.capturedAt,
        fecha_actualizacion: record.updatedAt,
        estado: "completo"
    }));
}


function buildAuditMetadata(audit, records) {
    return {
        schema_version: "1.0",
        id_auditoria: audit.id,
        cliente: audit.client,
        planta: audit.plant,
        auditor: audit.auditor,
        fecha_creacion: audit.createdAt,
        fecha_exportacion: new Date().toISOString(),
        cantidad_fugas: records.length,
        cantidad_completas: records.filter(isComplete).length
    };
}


export async function exportAuditZip({
    audit,
    records,
    onProgress
}) {
    if (!audit) {
        throw new Error(
            "No existe una auditoría activa."
        );
    }

    if (!Array.isArray(records) || records.length === 0) {
        throw new Error(
            "No existen fugas registradas para exportar."
        );
    }

    const incompleteRecords = records.filter(
        (record) => !isComplete(record)
    );

    if (incompleteRecords.length > 0) {
        const pendingTags = incompleteRecords
            .map((record) => record.codigo)
            .join(", ");

        throw new Error(
            `Hay fugas incompletas: ${pendingTags}. ` +
            "Completa la fotografía, referencia y ubicación antes de exportar."
        );
    }

    if (typeof window.JSZip !== "function") {
        throw new Error(
            "No se encontró la librería JSZip."
        );
    }

    const zip = new window.JSZip();

    const photosFolder = zip.folder(
        "03_FOTOS_PANORAMICAS"
    );

    const configFolder = zip.folder(
        "05_CONFIG"
    );

    if (!photosFolder || !configFolder) {
        throw new Error(
            "No se pudo construir la estructura del ZIP."
        );
    }

    for (const record of records) {
        photosFolder.file(
            record.fileName,
            record.photoBlob,
            {
                binary: true,

                // JPEG ya está comprimido.
                // STORE evita consumir recursos innecesarios.
                compression: "STORE"
            }
        );
    }

    const captureRecords = buildCaptureRecords(
        records
    );

    const auditMetadata = buildAuditMetadata(
        audit,
        records
    );

    configFolder.file(
        "captura_campo.json",
        JSON.stringify(
            captureRecords,
            null,
            2
        ),
        {
            compression: "DEFLATE"
        }
    );

    configFolder.file(
        "auditoria.json",
        JSON.stringify(
            auditMetadata,
            null,
            2
        ),
        {
            compression: "DEFLATE"
        }
    );

    const zipBlob = await zip.generateAsync(
        {
            type: "blob",
            mimeType: "application/zip",
            compression: "DEFLATE",
            compressionOptions: {
                level: 6
            }
        },
        (metadata) => {
            if (typeof onProgress === "function") {
                onProgress(metadata.percent);
            }
        }
    );

    const client = sanitizeFileSegment(
        audit.client
    ) || "CLIENTE";

    const plant = sanitizeFileSegment(
        audit.plant
    ) || "PLANTA";

    const fileName =
        `${client}_${plant}_${getExportDate()}.zip`;

    downloadBlob(zipBlob, fileName);

    return {
        fileName,
        sizeBytes: zipBlob.size,
        recordsExported: records.length
    };
}