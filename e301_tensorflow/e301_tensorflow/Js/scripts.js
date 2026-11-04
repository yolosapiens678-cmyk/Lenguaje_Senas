let detector;
let webcamElement = document.getElementById("webcam");
let canvasElement = document.getElementById("output-canvas");
let ctx = canvasElement.getContext("2d");

const statusBadge = document.getElementById("status-badge");
const predictedLetterEl = document.getElementById("predicted-letter");
const wordDisplayEl = document.getElementById("word-display");

let lastLetter = "";
let letterStartTime = 0;
let isCooldown = false;
let palabraActual = "";
const HOLD_TIME = 1000; 

async function init() {
    try {
        statusBadge.textContent = "⚙️ Cargando MediaPipe Hands (AML)...";
        
        const model = handPoseDetection.SupportedModels.MediaPipeHands;
        const detectorConfig = {
            runtime: 'mediapipe',
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
            modelType: 'full'
        };
        detector = await handPoseDetection.createDetector(model, detectorConfig);

        statusBadge.textContent = "🎥 Conectando cámara...";
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcamElement.srcObject = stream;

        await new Promise((resolve) => {
            webcamElement.onloadedmetadata = () => {
                webcamElement.play();
                canvasElement.width = webcamElement.videoWidth;
                canvasElement.height = webcamElement.videoHeight;
                resolve();
            };
        });

        statusBadge.textContent = "🟢 En Vivo - Alfabeto Manual Americano (AML)";
        detectHands();
    } catch (error) {
        console.error("Error al inicializar:", error);
        statusBadge.textContent = "🔴 Error al acceder a la cámara o cargar modelo";
    }
}

async function detectHands() {
    if (detector && webcamElement.readyState >= 2) {
        const hands = await detector.estimateHands(webcamElement);

        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (hands.length === 0) {
            predictedLetterEl.textContent = "Esperando mano...";
            lastLetter = "";
            letterStartTime = 0;
        } else {
            const keypoints = hands[0].keypoints;
            drawHandKeypoints(keypoints);
            
            const detectedSign = recognizeAMLSign(keypoints);
            
            predictedLetterEl.textContent = detectedSign ? detectedSign : "Detectando seña...";

            if (detectedSign && !isCooldown) {
                if (detectedSign === lastLetter) {
                    const elapsed = Date.now() - letterStartTime;
                    const percent = Math.min(100, Math.floor((elapsed / HOLD_TIME) * 100));
                    statusBadge.textContent = `⏳ Sosteniendo '${detectedSign}': ${percent}%`;

                    if (elapsed >= HOLD_TIME) {
                        palabraActual += detectedSign;
                        actualizarVisorPalabra();
                        statusBadge.textContent = `✅ ¡Letra '${detectedSign}' agregada!`;

                        isCooldown = true;
                        setTimeout(() => {
                            isCooldown = false;
                            lastLetter = "";
                            letterStartTime = 0;
                            statusBadge.textContent = "🟢 En Vivo - Alfabeto Manual Americano (AML)";
                        }, 1200);
                    }
                } else {
                    lastLetter = detectedSign;
                    letterStartTime = Date.now();
                }
            } else if (!isCooldown) {
                lastLetter = "";
                letterStartTime = 0;
            }
        }
    }
    requestAnimationFrame(detectHands);
}

// Algoritmo geométrico para el Alfabeto Manual Americano (AML)
function recognizeAMLSign(kp) {
    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

    const wrist = kp[0];
    
    // Puntas de los dedos
    const thumbTip = kp[4], indexTip = kp[8], middleTip = kp[12], ringTip = kp[16], pinkyTip = kp[20];
    // Nudillos principales
    const indexMcp = kp[5], middleMcp = kp[9], ringMcp = kp[13], pinkyMcp = kp[17];

    // Estados de extensión de dedos respecto a la muñeca
    const indexExt = dist(indexTip, wrist) > dist(indexMcp, wrist);
    const middleExt = dist(middleTip, wrist) > dist(middleMcp, wrist);
    const ringExt = dist(ringTip, wrist) > dist(ringMcp, wrist);
    const pinkyExt = dist(pinkyTip, wrist) > dist(pinkyMcp, wrist);
    const thumbExt = dist(thumbTip, pinkyMcp) > dist(kp[2], pinkyMcp);
  
    // A: Puño cerrado con pulgar extendido al lado del índice
    if (!indexExt && !middleExt && !ringExt && !pinkyExt && dist(thumbTip, indexMcp) < 65) {
        return "A";
    }

    // B: Mano abierta con los 4 dedos extendidos juntos y el pulgar doblado en la palma
    if (indexExt && middleExt && ringExt && pinkyExt && !thumbExt) {
        return "B";
    }

    // C: Mano en forma de "C" (curvada abriendo pulgar e índice)
    if (dist(thumbTip, indexTip) > 40 && dist(thumbTip, indexTip) < 100 && !indexExt && !middleExt) {
        return "C";
    }

    // D: Índice extendido hacia arriba, pulgar tocando las yemas de medio/anular/meñique
    if (indexExt && !middleExt && !ringExt && !pinkyExt && dist(thumbTip, middleTip) < 45) {
        return "D";
    }

    // E: Dedos doblados hacia la palma tocando el pulgar recogido
    if (!indexExt && !middleExt && !ringExt && !pinkyExt && dist(thumbTip, indexTip) < 35) {
        return "E";
    }

    // F: Índice y pulgar tocándose en círculo (OK), medio, anular y meñique estirados
    if (dist(indexTip, thumbTip) < 35 && middleExt && ringExt && pinkyExt) {
        return "F";
    }

    // I: Meñique extendido hacia arriba, demás dedos en puño
    if (pinkyExt && !indexExt && !middleExt && !ringExt) {
        return "I";
    }

    // L: Índice extendido hacia arriba y pulgar extendido en 90° (forma de L)
    if (indexExt && thumbExt && !middleExt && !ringExt && !pinkyExt) {
        return "L";
    }

    // O: Todos los dedos curvados tocando la punta del pulgar formando un círculo
    if (dist(thumbTip, indexTip) < 30 && dist(thumbTip, middleTip) < 35 && !indexExt) {
        return "O";
    }

    // U: Índice y medio extendidos juntos hacia arriba
    if (indexExt && middleExt && !ringExt && !pinkyExt && dist(indexTip, middleTip) < 30) {
        return "U";
    }

    // V: Índice y medio extendidos en separación (V)
    if (indexExt && middleExt && !ringExt && !pinkyExt && dist(indexTip, middleTip) >= 30) {
        return "V";
    }

    // W: Índice, medio y anular extendidos y separados
    if (indexExt && middleExt && ringExt && !pinkyExt) {
        return "W";
    }

    // Y: Pulgar y meñique extendidos hacia afuera
    if (thumbExt && pinkyExt && !indexExt && !middleExt && !ringExt) {
        return "Y";
    }

    return null;
}

function drawHandKeypoints(keypoints) {
    ctx.fillStyle = "#ff0000";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#00ff00";

    keypoints.forEach(kp => {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
        ctx.fill();
    });
}

function agregarEspacio() { palabraActual += " "; actualizarVisorPalabra(); }
function borrarUltimaLetra() { palabraActual = palabraActual.slice(0, -1); actualizarVisorPalabra(); }
function limpiarPalabra() { palabraActual = ""; actualizarVisorPalabra(); }
function actualizarVisorPalabra() { wordDisplayEl.textContent = palabraActual.length > 0 ? palabraActual : "_"; }

function leerTexto() {
    if (!palabraActual.trim()) return;
    
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(palabraActual);
    utterance.lang = "es-MX"; 

    const voices = window.speechSynthesis.getVoices();
    const vozLatina = voices.find(v => 
        v.lang === "es-MX" || 
        v.lang === "es-419" || 
        v.name.includes("Mexico") || 
        v.name.includes("Latin") ||
        v.name.includes("Sabina") || 
        v.name.includes("Raul") || 
        v.name.includes("Dalia") || 
        v.name.includes("Jorge")
    );

    if (vozLatina) {
        utterance.voice = vozLatina;
    }

    window.speechSynthesis.speak(utterance);
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

// Iniciar app
init();