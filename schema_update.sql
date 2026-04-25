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
