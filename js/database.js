"use strict";

const DATABASE_NAME = "saircom-campo-db";
const DATABASE_VERSION = 1;
const PHOTO_STORE = "panoramic-photos";


function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(
            DATABASE_NAME,
            DATABASE_VERSION
        );

        request.onupgradeneeded = () => {
            const database = request.result;

            if (!database.objectStoreNames.contains(PHOTO_STORE)) {
                const store = database.createObjectStore(
                    PHOTO_STORE,
                    {
                        keyPath: "id"
                    }
                );

                store.createIndex(
                    "auditId",
                    "auditId",
                    {
                        unique: false
                    }
                );

                store.createIndex(
                    "codigo",
                    "codigo",
                    {
                        unique: false
                    }
                );
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(
                request.error ??
                new Error("No se pudo abrir IndexedDB.")
            );
        };
    });
}


export async function savePanoramicPhoto(record) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(
            PHOTO_STORE,
            "readwrite"
        );

        const store = transaction.objectStore(PHOTO_STORE);

        store.put(record);

        transaction.oncomplete = () => {
            database.close();
            resolve(record);
        };

        transaction.onerror = () => {
            const error =
                transaction.error ??
                new Error("No se pudo guardar la fotografía.");

            database.close();
            reject(error);
        };

        transaction.onabort = () => {
            const error =
                transaction.error ??
                new Error("Se canceló el guardado.");

            database.close();
            reject(error);
        };
    });
}


export async function getPanoramicPhoto(auditId, codigo) {
    const database = await openDatabase();
    const id = `${auditId}:${codigo}`;

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(
            PHOTO_STORE,
            "readonly"
        );

        const store = transaction.objectStore(PHOTO_STORE);
        const request = store.get(id);

        request.onsuccess = () => {
            database.close();
            resolve(request.result ?? null);
        };

        request.onerror = () => {
            const error =
                request.error ??
                new Error("No se pudo consultar la fotografía.");

            database.close();
            reject(error);
        };
    });
}


export async function updatePanoramicMarker(
    auditId,
    codigo,
    xPano,
    yPano,
    title
) {
    const record = await getPanoramicPhoto(
        auditId,
        codigo
    );

    if (!record) {
        throw new Error(
            `No existe una fotografía guardada para ${codigo}.`
        );
    }

    const updatedRecord = {
        ...record,

        title: String(title ?? record.title).trim(),

        xPano: Number(
            Number(xPano).toFixed(5)
        ),

        yPano: Number(
            Number(yPano).toFixed(5)
        ),

        status: "completo",
        updatedAt: new Date().toISOString()
    };

    await savePanoramicPhoto(updatedRecord);

    return updatedRecord;
}


export async function getPanoramicPhotosByAudit(auditId) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(
            PHOTO_STORE,
            "readonly"
        );

        const store = transaction.objectStore(PHOTO_STORE);
        const index = store.index("auditId");

        const request = index.getAll(auditId);

        request.onsuccess = () => {
            const records = request.result ?? [];

            records.sort((first, second) => {
                return first.codigo.localeCompare(
                    second.codigo,
                    undefined,
                    {
                        numeric: true
                    }
                );
            });

            database.close();
            resolve(records);
        };

        request.onerror = () => {
            const error =
                request.error ??
                new Error(
                    "No se pudo obtener el resumen de fugas."
                );

            database.close();
            reject(error);
        };
    });
}