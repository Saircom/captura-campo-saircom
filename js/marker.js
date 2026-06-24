"use strict";


function clamp(value, minimum, maximum) {
    return Math.min(
        maximum,
        Math.max(minimum, value)
    );
}


function loadImageFromBlob(blob) {
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
                new Error(
                    "No se pudo cargar la fotografía para marcarla."
                )
            );
        };

        image.src = objectUrl;
    });
}


export function initializeMarker({
    onMarkerSaved
}) {
    const panel = document.querySelector("#marker-panel");
    const canvas = document.querySelector("#marker-canvas");
    const context = canvas.getContext("2d");

    const markerState = document.querySelector("#marker-state");
    const coordinatesText = document.querySelector(
        "#marker-coordinates"
    );

    const clearButton = document.querySelector(
        "#clear-marker-button"
    );

    const saveButton = document.querySelector(
        "#save-marker-button"
    );

    const message = document.querySelector("#marker-message");

    let currentImage = null;
    let currentBlob = null;
    let currentCodigo = null;

    let xPano = null;
    let yPano = null;


    function showMessage(text, type = "") {
        message.textContent = text;
        message.className = `message ${type}`.trim();
    }


    function updateState(saved = false) {
        const hasPoint =
            Number.isFinite(xPano) &&
            Number.isFinite(yPano);

        saveButton.disabled = !hasPoint;

        if (!hasPoint) {
            markerState.textContent = "Pendiente";
            markerState.className = "marker-state pending";

            coordinatesText.textContent =
                "Ubicación aún no marcada.";

            return;
        }

        markerState.textContent = saved
            ? "Guardada"
            : "Sin guardar";

        markerState.className = saved
            ? "marker-state complete"
            : "marker-state pending";

        coordinatesText.textContent =
            `x_pano: ${xPano.toFixed(5)} | ` +
            `y_pano: ${yPano.toFixed(5)}`;
    }


    function drawMarker() {
        if (!currentImage) {
            return;
        }

        context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        context.drawImage(
            currentImage,
            0,
            0,
            canvas.width,
            canvas.height
        );

        if (
            !Number.isFinite(xPano) ||
            !Number.isFinite(yPano)
        ) {
            return;
        }

        const pointX = xPano * canvas.width;
        const pointY = yPano * canvas.height;

        const minimumDimension = Math.min(
            canvas.width,
            canvas.height
        );

        const radius = Math.max(
            16,
            minimumDimension * 0.035
        );

        const lineWidth = Math.max(
            4,
            minimumDimension * 0.006
        );

        context.strokeStyle = "#e60000";
        context.lineWidth = lineWidth;

        context.beginPath();
        context.arc(
            pointX,
            pointY,
            radius,
            0,
            Math.PI * 2
        );
        context.stroke();

        const labelText = "Ubicación exacta de la fuga";

        const fontSize = clamp(
            canvas.width * 0.019,
            16,
            28
        );

        context.font = `700 ${fontSize}px Arial`;
        context.textBaseline = "middle";

        const horizontalPadding = fontSize * 0.75;
        const verticalPadding = fontSize * 0.48;

        const textWidth =
            context.measureText(labelText).width;

        const labelWidth =
            textWidth + horizontalPadding * 2;

        const labelHeight =
            fontSize + verticalPadding * 2;

        const gap = Math.max(12, fontSize * 0.6);

        let labelX =
            pointX + radius + gap;

        let labelY =
            pointY - labelHeight / 2;

        let connectorStartX =
            pointX + radius;

        let connectorEndX =
            labelX;

        if (
            labelX + labelWidth >
            canvas.width - 8
        ) {
            labelX =
                pointX -
                radius -
                gap -
                labelWidth;

            connectorStartX =
                pointX - radius;

            connectorEndX =
                labelX + labelWidth;
        }

        labelX = clamp(
            labelX,
            8,
            canvas.width - labelWidth - 8
        );

        labelY = clamp(
            labelY,
            8,
            canvas.height - labelHeight - 8
        );

        context.beginPath();
        context.moveTo(
            connectorStartX,
            pointY
        );

        context.lineTo(
            connectorEndX,
            pointY
        );

        context.stroke();

        context.fillStyle = "#e60000";
        context.fillRect(
            labelX,
            labelY,
            labelWidth,
            labelHeight
        );

        context.fillStyle = "#ffffff";

        context.fillText(
            labelText,
            labelX + horizontalPadding,
            labelY + labelHeight / 2
        );
    }


    async function showPhoto({
        codigo,
        blob,
        savedXPano = null,
        savedYPano = null
    }) {
        currentCodigo = codigo;
        currentBlob = blob;

        currentImage = await loadImageFromBlob(blob);

        const maximumDimension = 1600;

        const scale = Math.min(
            1,
            maximumDimension /
                Math.max(
                    currentImage.naturalWidth,
                    currentImage.naturalHeight
                )
        );

        canvas.width = Math.max(
            1,
            Math.round(
                currentImage.naturalWidth * scale
            )
        );

        canvas.height = Math.max(
            1,
            Math.round(
                currentImage.naturalHeight * scale
            )
        );

        xPano =
            savedXPano === null ||
            savedXPano === undefined
                ? null
                : Number(savedXPano);

        yPano =
            savedYPano === null ||
            savedYPano === undefined
                ? null
                : Number(savedYPano);

        panel.classList.remove("hidden");

        drawMarker();

        updateState(
            Number.isFinite(xPano) &&
            Number.isFinite(yPano)
        );

        showMessage("");
    }


    function hide() {
        panel.classList.add("hidden");

        currentImage = null;
        currentBlob = null;
        currentCodigo = null;

        xPano = null;
        yPano = null;

        context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        updateState(false);
        showMessage("");
    }


    canvas.addEventListener("click", (event) => {
        if (!currentImage) {
            return;
        }

        const rectangle =
            canvas.getBoundingClientRect();

        const relativeX =
            (event.clientX - rectangle.left) /
            rectangle.width;

        const relativeY =
            (event.clientY - rectangle.top) /
            rectangle.height;

        xPano = clamp(relativeX, 0, 1);
        yPano = clamp(relativeY, 0, 1);

        drawMarker();
        updateState(false);

        showMessage(
            "Punto marcado. Presiona Guardar ubicación."
        );
    });


    clearButton.addEventListener("click", () => {
        xPano = null;
        yPano = null;

        drawMarker();
        updateState(false);

        showMessage(
            "Marca nuevamente el punto exacto."
        );
    });


    saveButton.addEventListener("click", async () => {
        if (
            !currentCodigo ||
            !currentBlob ||
            !Number.isFinite(xPano) ||
            !Number.isFinite(yPano)
        ) {
            showMessage(
                "Primero marca el punto exacto de la fuga.",
                "error"
            );

            return;
        }

        saveButton.disabled = true;
        clearButton.disabled = true;

        showMessage("Guardando ubicación…");

        try {
            await onMarkerSaved({
                codigo: currentCodigo,
                xPano,
                yPano
            });

            updateState(true);

            showMessage(
                "Ubicación guardada correctamente.",
                "success"
            );
        } catch (error) {
            console.error(error);

            showMessage(
                error instanceof Error
                    ? error.message
                    : "No se pudo guardar la ubicación.",
                "error"
            );
        } finally {
            clearButton.disabled = false;
            saveButton.disabled = false;
        }
    });


    return {
        showPhoto,
        hide
    };
}