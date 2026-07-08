/*
DAGA WAREHOUSE - Sincronização Supabase Fase 1
Coloque este arquivo na raiz do GitHub, junto do index.html.
Ele mantém o app atual usando localStorage, mas copia o banco para o Supabase
para todos os dispositivos abrirem o mesmo estoque.
*/

(function(){
  const DB_KEY = "DAGA_DB_V1";
  const META_KEY = "DAGA_DB_V1_CLOUD_UPDATED_AT";
  const TABLE = "daga_cloud_db";
  const ROW_ID = "main";

  const SUPABASE_URL = window.DAGA_SUPABASE_URL;
  const SUPABASE_KEY = window.DAGA_SUPABASE_KEY;

  if(!SUPABASE_URL || !SUPABASE_KEY){
    console.warn("DAGA Supabase Sync: configure window.DAGA_SUPABASE_URL e window.DAGA_SUPABASE_KEY no index.html.");
    return;
  }
  if(!window.supabase || !window.supabase.createClient){
    console.warn("DAGA Supabase Sync: biblioteca Supabase não carregada.");
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
  });

  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  let applyingCloud = false;
  let saveTimer = null;

  function parseDB(raw){
    try { return raw ? JSON.parse(raw) : null; } catch(e){ return null; }
  }

  function dbCount(db){
    return {
      categories: Array.isArray(db?.categories) ? db.categories.length : 0,
      suppliers: Array.isArray(db?.suppliers) ? db.suppliers.length : 0,
      items: Array.isArray(db?.items) ? db.items.length : 0,
      movements: Array.isArray(db?.movements) ? db.movements.length : 0,
      users: Array.isArray(db?.users) ? db.users.length : 0
    };
  }

  function isValidDB(db){
    return db && Array.isArray(db.items) && Array.isArray(db.categories) && Array.isArray(db.suppliers) && Array.isArray(db.movements) && Array.isArray(db.users);
  }

  async function fetchCloud(){
    const { data, error } = await client
      .from(TABLE)
      .select("db,updated_at")
      .eq("id", ROW_ID)
      .maybeSingle();
    if(error){
      console.error("DAGA Supabase Sync: erro ao ler nuvem", error);
      return null;
    }
    return data;
  }

  async function saveCloud(db){
    if(!isValidDB(db)) return false;
    const { error } = await client
      .from(TABLE)
      .upsert({ id: ROW_ID, db }, { onConflict: "id" });
    if(error){
      console.error("DAGA Supabase Sync: erro ao salvar nuvem", error);
      return false;
    }
    console.log("DAGA Supabase Sync: salvo na nuvem", dbCount(db));
    return true;
  }

  function scheduleSave(db){
    if(!isValidDB(db)) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const ok = await saveCloud(db);
      if(ok){
        originalSetItem(META_KEY, new Date().toISOString());
      }
    }, 700);
  }

  // Intercepta as gravações do app atual.
  localStorage.setItem = function(key, value){
    const result = originalSetItem(key, value);
    if(key === DB_KEY && !applyingCloud){
      const db = parseDB(value);
      if(isValidDB(db)) scheduleSave(db);
    }
    return result;
  };

  async function syncNow(options = {}){
    const forceReload = !!options.forceReload;
    const localRaw = localStorage.getItem(DB_KEY);
    const localDB = parseDB(localRaw);
    const localMeta = localStorage.getItem(META_KEY) || "";
    const cloud = await fetchCloud();
    const cloudDB = cloud?.db;
    const cloudMeta = cloud?.updated_at || "";

    if(isValidDB(cloudDB)){
      const cloudCount = dbCount(cloudDB);
      const localCount = dbCount(localDB);
      const cloudIsNewer = cloudMeta && (!localMeta || new Date(cloudMeta) > new Date(localMeta));
      const cloudHasMoreItems = cloudCount.items > localCount.items;
      const localHasMoreItems = isValidDB(localDB) && localCount.items > cloudCount.items;

      // Se este computador tem mais itens, provavelmente é o computador onde você importou os 320 itens.
      // Então ele sobe para a nuvem.
      if(localHasMoreItems && !options.preferCloud){
        console.log("DAGA Supabase Sync: local tem mais itens; subindo para nuvem", localCount);
        const ok = await saveCloud(localDB);
        if(ok) originalSetItem(META_KEY, new Date().toISOString());
        return { action: "uploaded_local", localCount, cloudCount };
      }

      // Se a nuvem está mais nova, aplica no navegador e recarrega para o app usar o banco atualizado.
      if(forceReload || cloudHasMoreItems || cloudIsNewer || !isValidDB(localDB)){
        console.log("DAGA Supabase Sync: aplicando banco da nuvem", cloudCount);
        applyingCloud = true;
        originalSetItem(DB_KEY, JSON.stringify(cloudDB));
        originalSetItem(META_KEY, cloudMeta || new Date().toISOString());
        applyingCloud = false;

        if(sessionStorage.getItem("DAGA_CLOUD_RELOADED") !== "1" || forceReload){
          sessionStorage.setItem("DAGA_CLOUD_RELOADED", "1");
          setTimeout(() => location.reload(), 300);
        }
        return { action: "downloaded_cloud", cloudCount };
      }

      console.log("DAGA Supabase Sync: local já está atualizado", localCount);
      return { action: "already_synced", localCount, cloudCount };
    }

    if(isValidDB(localDB)){
      console.log("DAGA Supabase Sync: nuvem vazia; enviando banco local", dbCount(localDB));
      const ok = await saveCloud(localDB);
      if(ok) originalSetItem(META_KEY, new Date().toISOString());
      return { action: "created_cloud", localCount: dbCount(localDB) };
    }

    console.warn("DAGA Supabase Sync: nenhum banco válido encontrado local/nuvem.");
    return { action: "no_valid_db" };
  }

  // Funções úteis no Console do navegador.
  window.DAGA_SYNC_NOW = () => syncNow({ forceReload: true, preferCloud: true });
  window.DAGA_UPLOAD_LOCAL_TO_CLOUD = async () => {
    const db = parseDB(localStorage.getItem(DB_KEY));
    if(!isValidDB(db)) return console.error("Banco local inválido ou vazio.");
    const ok = await saveCloud(db);
    if(ok) originalSetItem(META_KEY, new Date().toISOString());
    return ok;
  };
  window.DAGA_DOWNLOAD_CLOUD_TO_LOCAL = () => syncNow({ forceReload: true, preferCloud: true });
  window.DAGA_RESET_LOCAL = () => {
    originalRemoveItem(DB_KEY);
    originalRemoveItem(META_KEY);
    location.reload();
  };

  // Sincroniza ao abrir o app e ao voltar para a tela.
  syncNow();
  document.addEventListener("visibilitychange", () => {
    if(!document.hidden) syncNow({ preferCloud: true });
  });

  // Checagem leve a cada 60 segundos.
  setInterval(() => syncNow({ preferCloud: true }), 60000);
})();
