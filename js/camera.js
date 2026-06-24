"use strict";

function loadImage(blob) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(blob);

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(
                new Error("No se pudo procesar la imagen.")
            );
        };

        image.src = objectUrl;
    });
}

async function convertToJpeg(
    file,
    maximumDimension = 2200,
    quality = 0.88
) {
    const image = await loadImage(file);

    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;

    if (!originalWidth || !originalHeight) {
        throw new Error("La fotografía no tiene dimensiones válidas.");
    }

    const scale = Math.min(
        1,
        maximumDimension / Math.max(
            originalWidth,
            originalHeight
        )
    );

    const width = Math.max(
        1,
        Math.round(originalWidth * scale)
    );

    const height = Math.max(
        1,
        Math.round(originalHeight * scale)
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error(
            "El navegador no permite procesar la fotografía."
        );
    }

    context.drawImage(image, 0, 0, width, height);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(
                        new Error(
                            "No se pudo convertir la fotografía a JPEG."
                        )
                    );
                    return;
                }

                resolve(blob);
            },
            "image/jpeg",
            quality
        );
    });
}

export function initializeCameraCapture({
    getCurrentTag,
    onPhotoAccepted
}) {
    const photoInput = document.querySelector("#photo-input");
    const openCameraButton = document.querySelector(
        "#open-camera-button"
    );

    const repeatPhotoButton = document.querySelector(
        "#repeat-photo-button"
    );

    const acceptPhotoButton = document.querySelector(
        "#accept-photo-button"
    );

    const previewPanel = document.querySelector(
        "#photo-preview-panel"
    );

    const previewImage = document.querySelector("#photo-preview");
    const captureMessage = document.querySelector("#capture-message");

    let selectedFile = null;
    let previewUrl = null;

    function showMessage(message, type = "") {
        captureMessage.textContent = message;
        captureMessage.className = `message ${type}`.trim();
    }

    function clearPreview() {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }

        selectedFile = null;
        photoInput.value = "";
        previewImage.removeAttribute("src");
        previewPanel.classList.add("hidden");
    }

    function openCamera() {
        photoInput.value = "";
        photoInput.click();
    }

    openCameraButton.addEventListener("click", () => {
        showMessage("");
        openCamera();
    });

    repeatPhotoButton.addEventListener("click", () => {
        clearPreview();
        showMessage("");
        openCamera();
    });

    photoInput.addEventListener("change", () => {
        const file = photoInput.files?.[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            showMessage(
                "Selecciona un archivo de imagen válido.",
                "error"
            );
            clearPreview();
            return;
        }

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        selectedFile = file;
        previewUrl = URL.createObjectURL(file);

        previewImage.src = previewUrl;
        previewPanel.classList.remove("hidden");

        showMessage(
            "Revisa la fotografía antes de aceptarla."
        );

        previewPanel.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });

    acceptPhotoButton.addEventListener("click", async () => {
        if (!selectedFile) {
            showMessage(
                "Primero debes tomar una fotografía.",
                "error"
            );
            return;
        }

        const codigo = getCurrentTag();

        if (!codigo) {
            showMessage(
                "No existe una auditoría activa.",
                "error"
            );
            return;
        }

        acceptPhotoButton.disabled = true;
        openCameraButton.disabled = true;

        showMessage("Procesando fotografía…");

        try {
            const jpegBlob = await convertToJpeg(selectedFile);

            const accepted = await onPhotoAccepted({
                codigo,
                blob: jpegBlob
            });

            if (accepted !== false) {
                showMessage(
                    `Fotografía ${codigo} guardada correctamente.`,
                    "success"
                );
            }
        } catch (error) {
            console.error(error);

            showMessage(
                error instanceof Error
                    ? error.message
                    : "No se pudo guardar la fotografía.",
                "error"
            );
        } finally {
            acceptPhotoButton.disabled = false;
            openCameraButton.disabled = false;
        }
    });

    return {
        clearPreview
    };
}