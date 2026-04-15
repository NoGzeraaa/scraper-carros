import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fetch from "node-fetch";

puppeteer.use(StealthPlugin());

const URL = "https://www.webmotors.com.br/carros/sp/loja.bavaro-veiculos-3957473";

const SUPABASE_URL = "https://tiwxehamnptkdxfikytp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpd3hlaGFtbnB0a2R4ZmlreXRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQzNTMzNCwiZXhwIjoyMDkxMDExMzM0fQ.sfnLYrrDyVxaq77rD4o9Bl9XawGGHAI5HQ2CMQCQz88"; // ⚠️ mantém sua key

async function salvarNoSupabase(carros) {
  for (const car of carros) {
    const partes = car.nome.split(" ");
    const brand = partes[0];
    const model = partes.slice(1).join(" ");

    const slugBase = `${brand}-${model}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const slug = `${slugBase}-${car.ano}`;

    const body = {
      slug,
      brand,
      model,
      year: car.ano,
      km: car.km || 0,
      price: car.preco || 0,
      cover_image: null, // ❌ sem imagem
      gallery: [], // ❌ sem galeria
      webmotors_id: car.id, // ID único real
      source: "webmotors"
    };

    await fetch(`${SUPABASE_URL}/rest/v1/vehicles`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify(body)
    });
  }
}

async function rodar() {
  console.log("🚀 Abrindo navegador stealth...");

  const browser = await puppeteer.launch({
    headless: true
  });

  const page = await browser.newPage();

  await page.setViewport({ width: 1366, height: 768 });

  console.log("🌐 Acessando Webmotors...");
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  await new Promise(r => setTimeout(r, 5000));

  console.log("🔍 Interceptando API...");

  let carrosAPI = [];

  page.on("response", async (response) => {
    const url = response.url();

    if (url.includes("/api/search/car")) {
      try {
        const data = await response.json();

        if (data?.SearchResults?.length > 0) {
          carrosAPI = data.SearchResults;
        }
      } catch {}
    }
  });

  await page.reload({ waitUntil: "domcontentloaded" });

  await new Promise(r => setTimeout(r, 5000));

  const carros = carrosAPI.map((car) => ({
    nome: car.Specification?.Title,
    preco: car.Prices?.Price,
    km: car.Specification?.Odometer,
    ano: car.Specification?.YearModel,
    id: car.UniqueId
  }));

  console.log(`🚗 ${carros.length} carros encontrados`);

  console.log("💾 Salvando no Supabase...");
  await salvarNoSupabase(carros);

  console.log("✅ Finalizado");

  await browser.close();
}

// 🔥 roda uma vez ao iniciar
rodar();

// 🔥 roda automático a cada 30 minutos
setInterval(() => {
  console.log("🔄 Rodando automático...");
  rodar();
}, 1000 * 60 * 30);