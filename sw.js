// DAGA WAREHOUSE — Service Worker
// Ativa uso offline básico quando o app é hospedado em um servidor real
// (necessário para instalação completa como PWA). Para ativar, registre-o
// no index.html com: navigator.serviceWorker.register('./sw.js')
//
// IMPORTANTE: sempre que publicar uma nova versão do index.html, aumente
// o número do CACHE_NAME abaixo (v2, v3...). Isso força os navegadores a
// descartarem a versão antiga salva no celular em vez de continuar
// servindo um arquivo desatualizado (ou quebrado) para sempre.

const CACHE_NAME = "daga-warehouse-v3";
const ASSETS = [
  "./index.html",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estratégia "network-first": sempre tenta buscar a versão mais nova no
// servidor primeiro. Só usa o que está em cache se estiver sem internet.
// Isso evita que uma versão antiga fique "presa" no celular do usuário.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
