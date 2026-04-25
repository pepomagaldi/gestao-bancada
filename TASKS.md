# CoreOps — Tasks de Implementação

Leia este arquivo completo antes de começar. Implemente tudo em `src/App.jsx`.

---

## 1. Arquivo SQL

Cria `schema_update.sql` na raiz do projeto com o conteúdo abaixo.
O usuário vai rodar manualmente no Supabase depois.

```sql
create table if not exists produtos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  nome text not null,
  categoria text default 'Peça',
  custo numeric default 0,
  venda numeric default 0,
  estoque integer default 0,
  created_at timestamptz default now()
);

create table if not exists vendas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  produto_id uuid,
  produto_nome text,
  cliente text,
  os_numero text,
  quantidade integer default 1,
  preco_unit numeric default 0,
  desconto numeric default 0,
  total numeric default 0,
  pagamento text default 'Pix',
  observacoes text,
  data date default current_date,
  created_at timestamptz default now()
);

alter table produtos enable row level security;
alter table vendas enable row level security;
create policy "user_produtos" on produtos for all using (auth.uid() = user_id);
create policy "user_vendas" on vendas for all using (auth.uid() = user_id);
```

---

## 2. OS → Financeiro Automático

Em `ModuloOS`, na função `salvar`:

- Quando o status for alterado PARA "concluida" e o status anterior não era "concluida", inserir automaticamente um lançamento em `financeiro`:
  - tipo: "receita"
  - categoria: "Serviço"
  - descricao: `Serviço ${form.numero} — ${form.cliente}`
  - valor: form.valor
  - pagamento: form.pagamento
  - data: form.data
  - user_id: user.id

- Na criação de nova OS já com status "concluida" direto, também lançar.

- Para saber o status anterior na edição, guarde o status original antes de abrir o modal de edição.

---

## 3. Agenda Kanban

Criar novo módulo `ModuloAgenda`:

- Busca as OS do Supabase igual ao `ModuloOS` (db.list)
- 4 colunas lado a lado: Aberta | Em Andamento | Concluída | Cancelada
- Cada card exibe: número OS, cliente, aparelho, valor
- Drag and drop com HTML5 draggable nativo — sem instalar biblioteca
- Ao soltar card em outra coluna: chama `db.update("ordens_servico", os.id, { status: novoStatus })` e atualiza estado local
- Visual dark consistente com o resto do app (background #111827, bordas #1e2738, azul #1A6BFF)
- Colunas com header colorido por status (azul, laranja, verde, vermelho)

Adicionar no MENU:
```js
{ key: "agenda", label: "Agenda", icon: "📅" }
```

Adicionar no AppMain:
```jsx
{page === "agenda" && <ModuloAgenda />}
```

---

## 4. Módulo Produtos / Caixa

Criar novo módulo `ModuloProdutos`.

### Layout: duas colunas no topo + tabela embaixo

**Coluna esquerda — Estoque de Produtos:**
- Busca por nome/categoria
- Tabela com: nome, categoria, custo, venda, estoque
- Botões +/- para ajustar estoque inline (chama db.update imediatamente)
- Botão editar (abre modal) e excluir
- Botão "+ Produto" abre modal com campos: nome, categoria (Peça/Smartphone/Seminovo/Acessório/Outro), custo, venda, estoque inicial

**Coluna direita — Registrar Venda:**
- Campo busca/seleciona produto (filtra da lista ao digitar)
- Ao selecionar produto: preenche preço unit automaticamente (editável)
- Campo cliente (texto livre)
- Select "Vincular OS" — carrega OS com status "aberta" ou "em_andamento" do Supabase
- Quantidade (default 1)
- Preço unit (editável)
- Desconto em R$ (default 0)
- Total calculado automaticamente: (quantidade × preço_unit) - desconto
- Pagamento: Pix / Dinheiro / Cartão Débito / Cartão Crédito
- Data (default hoje)
- Observações (textarea)
- Botão "Registrar Venda" — ao clicar:
  1. Salva na tabela `vendas`
  2. Lança em `financeiro`: tipo "receita", categoria "Venda", descricao `Venda: ${produto_nome} — ${cliente}`, valor = total, pagamento, data
  3. Decrementa estoque do produto: `db.update("produtos", produto_id, { estoque: estoqueAtual - quantidade })`
  4. Limpa o formulário

**Tabela inferior — Histórico de Vendas:**
- Colunas: data, produto, cliente, OS, qtd, unit, desconto, total, pagamento, ações
- Ações: excluir (só remove o registro, não reverte estoque)
- Carrega via db.list("vendas", user.id)

Adicionar no MENU:
```js
{ key: "produtos", label: "Produtos", icon: "🛍️" }
```

Adicionar no AppMain:
```jsx
{page === "produtos" && <ModuloProdutos />}
```

---

## Regras gerais

- Não quebrar nenhuma funcionalidade existente
- Manter todo o CSS dark existente
- Seguir o padrão do código: db.list, db.insert, db.update, db.delete
- Drag and drop sem instalar nada — HTML5 nativo apenas
- Todos os módulos novos usam useAuth() para pegar o user.id
