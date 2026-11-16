import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, collection, addDoc, onSnapshot, 
    deleteDoc, doc, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================
// PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCYscMrtwwOrNJeIFJ1KUzt24rAtsXvhpE",
    authDomain: "mis-gastos-76a50.firebaseapp.com",
    projectId: "mis-gastos-76a50",
    storageBucket: "mis-gastos-76a50.firebasestorage.app",
    messagingSenderId: "952216540611",
    appId: "1:952216540611:web:d49a52c945bc8e666f9976"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const gastosRef = collection(db, "gastos");

// Elementos del DOM
const form = document.getElementById("gasto-form");
const btnSubmit = form.querySelector("button[type='submit']");
const inputCamara = document.getElementById("input-camara");
const inputGaleria = document.getElementById("input-galeria");
const previewContainer = document.getElementById("preview-container");
const imagePreview = document.getElementById("image-preview");
const removeImgBtn = document.getElementById("remove-img-btn");
const fileStatus = document.getElementById("file-status");
const listaGastos = document.getElementById("lista-gastos");
const totalGastadoEl = document.getElementById("total-gastado");
const totalItemsEl = document.getElementById("total-items");
const filtroCategoria = document.getElementById("filtro-categoria");

// Modal elementos
const modal = document.getElementById("image-modal");
const modalImg = document.getElementById("modal-img");
const modalCaption = document.getElementById("modal-caption");
const closeModal = document.getElementById("close-modal");

let imagenComprimidaActual = null;
let todosLosGastos = [];

// Comprimir imagen para que suba rápido con datos móviles
function comprimirImagen(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL("image/jpeg", quality));
            };
        };
    });
}

// Manejar tanto foto de cámara como de galería
async function procesarArchivoSeleccionado(file) {
    if (!file) return;
    fileStatus.textContent = "⏳ Optimizando imagen...";
    fileStatus.style.color = "#00f3ff";
    
    imagenComprimidaActual = await comprimirImagen(file);
    imagePreview.src = imagenComprimidaActual;
    previewContainer.classList.remove("hidden");
    
    fileStatus.textContent = "✅ Imagen lista para guardar";
    fileStatus.style.color = "#0aff68";
}

inputCamara.addEventListener("change", function () {
    procesarArchivoSeleccionado(this.files[0]);
});

inputGaleria.addEventListener("change", function () {
    procesarArchivoSeleccionado(this.files[0]);
});

// Quitar imagen seleccionada
removeImgBtn.addEventListener("click", () => {
    imagenComprimidaActual = null;
    inputCamara.value = "";
    inputGaleria.value = "";
    previewContainer.classList.add("hidden");
    fileStatus.textContent = "Ninguna imagen seleccionada";
    fileStatus.style.color = "#8b9bb4";
});

// Guardar gasto en la nube
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btnSubmit.disabled = true;
    btnSubmit.textContent = "SINCRONIZANDO...";

    try {
        const nuevoGasto = {
            titulo: document.getElementById("titulo").value.trim(),
            monto: parseFloat(document.getElementById("monto").value),
            categoria: document.getElementById("categoria").value,
            notas: document.getElementById("notas").value.trim(),
            imagen: imagenComprimidaActual,
            timestamp: Date.now(),
            fecha: new Date().toLocaleDateString("es-PE", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            })
        };

        await addDoc(gastosRef, nuevoGasto);

        form.reset();
        imagenComprimidaActual = null;
        previewContainer.classList.add("hidden");
        fileStatus.textContent = "Ninguna imagen seleccionada";
        fileStatus.style.color = "#8b9bb4";
    } catch (error) {
        console.error("Error al guardar:", error);
        alert("Error al conectar con Firebase. Revisa tus credenciales o conexión.");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "GUARDAR EN INVENTARIO";
    }
});

// Escuchar cambios en tiempo real
const q = query(gastosRef, orderBy("timestamp", "desc"));

onSnapshot(q, (snapshot) => {
    todosLosGastos = [];
    snapshot.forEach((docSnap) => {
        todosLosGastos.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderizarGastos();
}, (error) => {
    console.error("Error de lectura:", error);
    listaGastos.innerHTML = `
        <div class="empty-state">
            <h3>[ ERROR DE CONEXIÓN ]</h3>
            <p>Verifica que hayas pegado bien tu firebaseConfig en app.js</p>
        </div>
    `;
});

// Renderizar tarjetas
function renderizarGastos() {
    const filtro = filtroCategoria.value;

    const sumaTotal = todosLosGastos.reduce((acc, item) => acc + item.monto, 0);
    totalGastadoEl.textContent = `S/ ${sumaTotal.toFixed(2)}`;
    totalItemsEl.textContent = todosLosGastos.length;

    const gastosFiltrados = filtro === "Todos"
        ? todosLosGastos
        : todosLosGastos.filter(g => g.categoria === filtro);

    listaGastos.innerHTML = "";

    if (gastosFiltrados.length === 0) {
        listaGastos.innerHTML = `
            <div class="empty-state">
                <h3>[ INVENTARIO VACÍO ]</h3>
                <p>No hay gastos registrados en esta categoría todavía.</p>
            </div>
        `;
        return;
    }

    gastosFiltrados.forEach((gasto) => {
        const card = document.createElement("div");
        card.className = "expense-card";

        const imagenHTML = gasto.imagen
            ? `<div class="card-img-wrapper" onclick="abrirModal('${gasto.imagen}', '${gasto.titulo.replace(/'/g, "\\'")}')">
                 <img src="${gasto.imagen}" alt="${gasto.titulo}">
               </div>`
            : "";

        const notasHTML = gasto.notas
            ? `<p class="card-notes">${gasto.notas}</p>`
            : `<p class="card-notes" style="font-style: italic; opacity: 0.5;">Sin notas adicionales</p>`;

        card.innerHTML = `
            ${imagenHTML}
            <div class="card-body">
                <div class="card-top">
                    <span class="cat-tag">${gasto.categoria}</span>
                    <span class="card-date">${gasto.fecha}</span>
                </div>
                <h3 class="card-title">${gasto.titulo}</h3>
                ${notasHTML}
                <div class="card-footer">
                    <span class="card-price">S/ ${gasto.monto.toFixed(2)}</span>
                    <button class="btn-delete" onclick="eliminarGasto('${gasto.id}')">ELIMINAR</button>
                </div>
            </div>
        `;
        listaGastos.appendChild(card);
    });
}

// Eliminar gasto
window.eliminarGasto = async function (id) {
    if (confirm("¿Seguro que quieres eliminar este ítem del inventario?")) {
        await deleteDoc(doc(db, "gastos", id));
    }
};

filtroCategoria.addEventListener("change", renderizarGastos);

// Modal imagen grande
window.abrirModal = function (src, titulo) {
    modalImg.src = src;
    modalCaption.textContent = titulo;
    modal.classList.remove("hidden");
};

closeModal.addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
});