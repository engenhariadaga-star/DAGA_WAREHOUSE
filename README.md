# DAGA WAREHOUSE

Aplicativo web responsivo (estilo PWA) para controle de almoxarifado industrial.
Construído em **React 18** + **Tailwind CSS**, com persistência em **localStorage**
e uma camada de dados isolada para facilitar a migração futura para um banco
de dados real (PostgreSQL, MySQL, Firebase, Supabase etc).

## Arquivos

| Arquivo         | Função |
|------------------|--------|
| `index.html`     | Aplicativo completo (React via CDN, sem etapa de build) |
| `manifest.json`  | Manifesto PWA (ícone, nome, cores, modo standalone) |
| `sw.js`          | Service Worker opcional para uso offline quando hospedado em servidor |
| `README.md`      | Este documento |

## Como usar agora

Basta abrir `index.html` em qualquer navegador (celular ou desktop). Os dados
ficam salvos no `localStorage` do próprio navegador — nenhum servidor é
necessário para testar.

**Login de demonstração:**
- Administrador: `admin` / `admin123`
- Operador: `operador` / `1234`

## Como instalar como PWA de verdade (opcional)

O `localStorage`/`Service Worker` só funcionam de forma completa quando os
arquivos são servidos via **http(s)**, não abertos diretamente como `file://`.
Para instalar no celular como um app:

1. Suba os 3 arquivos (`index.html`, `manifest.json`, `sw.js`) para qualquer
   hospedagem estática (Vercel, Netlify, GitHub Pages, S3, etc).
2. No `index.html`, adicione antes de `</body>`:
   ```html
   <script>
     if ("serviceWorker" in navigator) {
       navigator.serviceWorker.register("./sw.js");
     }
   </script>
   ```
3. Acesse pelo Chrome/Safari no celular → "Adicionar à tela inicial".

## Modelo de dados

```
Categoria     { id, name, color }
Fornecedor    { id, name, cnpj, phone, email }
Item          { id, code (barcode/QR), name, description, categoryId,
                supplierId, unit, location, minStock, initialStock,
                cost, photo (base64), active }
Movimentação  { id, itemId, type (entrada|saida|devolucao|ajuste),
                quantity, datetime, responsible, requester, os,
                costCenter, note }
Usuário       { id, username, password, name, role }
```

**Cálculo do estoque atual** (função `computeStock` em `index.html`):

```
estoque_atual = estoque_inicial
              + soma(entradas)
              + soma(devoluções)
              - soma(saídas)
              + soma(ajustes)   // ajuste é assinado (+/-), definido na contagem de inventário
```

A saída é **bloqueada no formulário** sempre que a quantidade informada for
maior que o estoque atualmente disponível (calculado em tempo real a partir
do histórico de movimentações).

## Migrando para um banco de dados real

Toda a leitura/escrita passa por poucas funções centralizadas no topo do
`index.html`:

- `loadDB()` — carrega o "banco" (hoje: `localStorage`)
- `persistDB(db)` — salva o "banco" (hoje: `localStorage`)
- `setItems`, `setCategories`, `setSuppliers`, `setMovements` — atualizam
  cada coleção dentro do estado `db` do componente `App`

Para migrar para uma API/banco real, o caminho recomendado é:

1. Criar endpoints REST (ou usar Supabase/Firebase) equivalentes às 5
   coleções: `items`, `categories`, `suppliers`, `movements`, `users`.
2. Substituir `loadDB()` por chamadas `fetch()` que buscam cada coleção
   (pode usar `Promise.all`) e `persistDB()`/os `setX` por chamadas
   `POST/PUT/DELETE` para a API, mantendo a mesma assinatura de estado.
3. Mover a validação "saída não pode ultrapassar o estoque disponível"
   também para o backend (hoje ela existe apenas no cliente, em
   `MovementScreen.submit`), evitando condição de corrida entre múltiplos
   usuários simultâneos.
4. Trocar a autenticação simples (comparação de usuário/senha em texto)
   por um serviço de autenticação real (JWT, Supabase Auth, Firebase Auth),
   nunca armazenando senhas em texto puro em produção.

Como toda a UI já consome apenas os arrays `items`, `categories`,
`suppliers`, `movements` — sem nenhuma lógica de armazenamento espalhada
pelos componentes — a troca do "motor" de dados não deve exigir reescrever
as telas.

## Funcionalidades incluídas

- Login com dois perfis de demonstração
- Dashboard com indicadores (itens ativos, valor em estoque, itens críticos,
  movimentações do dia) e atalhos rápidos
- Cadastro de Itens (com foto, código de barras/QR gerado e exibido via
  JsBarcode/QRCode.js, categoria, fornecedor, unidade, localização, estoque
  mínimo/inicial, custo, status ativo)
- Cadastro de Categorias e Fornecedores (com bloqueio de exclusão quando em uso)
- Entrada de Material / Saída de Material (com bloqueio de saída maior que o
  disponível, OS, centro de custo, solicitante, responsável, observação)
- Inventário (contagem física com geração automática de ajuste)
- Relatório de Estoque (valor total, valor por categoria, exportação CSV)
- Itens Abaixo do Mínimo (lista priorizada por criticidade)
- Dados de exemplo pré-carregados para teste imediato
- Leitura de código de barras/QR pela câmera do celular (biblioteca `html5-qrcode`),
  disponível no cadastro de itens (botão amarelo ao lado do campo de código),
  na busca de Itens e nas telas de Entrada/Saída de Material

### Sobre o leitor de câmera

- Requer HTTPS (ou `localhost`) para o navegador liberar o acesso à câmera —
  não funciona ao abrir o arquivo direto como `file://`. Ao hospedar (ver
  seção "Como instalar como PWA de verdade") funciona normalmente.
- Suporta QR Code e os principais formatos de código de barras (CODE128, EAN etc).
- Na busca de Entrada/Saída e na lista de Itens, o app tenta casar o código lido
  com o campo `code` cadastrado; se não encontrar, mantém o texto lido no campo
  de busca para conferência manual.

## Próximos passos sugeridos

- Multiusuário com permissões por perfil (Administrador x Operador)
- Sincronização multi-dispositivo via banco de dados real (ver seção acima)
- Assinatura digital / foto de comprovação na retirada de material
