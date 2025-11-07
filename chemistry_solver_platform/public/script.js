document.getElementById("solveBtn").addEventListener("click", handleSolve);

async function handleSolve() {
const text = document.getElementById("textInput").value;
const file = document.getElementById("imageInput").files[0];
const loading = document.getElementById("loading");
const result = document.getElementById("result");
loading.style.display = "block";
result.style.display = "none";

let parts = [];
if (text) parts.push({ text });
if (file) {
const base64 = await readFileAsBase64(file);
parts.push({ inlineData: { mimeType: file.type, data: base64 } });
}

const res = await fetch("/api/solve", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ parts })
});
const data = await res.json();

loading.style.display = "none";
result.style.display = "block";

const textResult = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || "{}");

document.getElementById("konu").textContent = textResult.konu || "-";
document.getElementById("istenilen").textContent = textResult.istenilen || "-";
document.getElementById("verilenler").textContent = textResult.verilenler || "-";
document.getElementById("cozum").textContent = textResult.cozum || "-";
document.getElementById("sonuc").textContent = textResult.sonuc || "-";
document.getElementById("konuOzet").textContent = textResult.konuOzet || "-";
}

function readFileAsBase64(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = () => resolve(reader.result.split(",")[1]);
reader.onerror = reject;
reader.readAsDataURL(file);
});
}