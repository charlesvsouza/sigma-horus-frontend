// Dados de referência da Maçonaria brasileira para semear cada loja.
// Fontes: COMAB (comab.org.br), GOB (gob.org.br), Wikipédia "Lista de obediências
// maçônicas" e "Ritos maçônicos", e referências de tesouraria/escrituração de lojas.
// Curado em 2026-06. Listas extensíveis — ajuste conforme a realidade da loja.

export interface RiteSeed { name: string; order: number; }
export interface PowerSeed { name: string; order: number; }
export interface ChartAccountSeed { code: string; name: string; type: 'REVENUE' | 'EXPENSE'; category: string; }
export interface OfficeSeed { name: string; order: number; }

// Dicionário de cargos maçônicos por rito.
// Cada entrada mapeia o nome do rito (conforme BRAZILIAN_RITES) à sua lista
// de cargos na ordem hierárquica / ceremonial do respectivo rito.
// Fontes: COMAB, GOB, freemason.com.br, CEPdoRER, inspetoriamt.org.br,
// "Manual dos Cargos em Loja do REAA" (Almir Sant'Anna Cruz), GLMESP (Emulation),
// e legislações de Grandes Lojas estaduais brasileiras.
export const OFFICES_BY_RITE: Record<string, OfficeSeed[]> = {
  'Rito Escocês Antigo e Aceito (REAA)': [
    { name: 'Venerável Mestre', order: 1 },
    { name: '1º Vigilante', order: 2 },
    { name: '2º Vigilante', order: 3 },
    { name: 'Orador', order: 4 },
    { name: 'Secretário', order: 5 },
    { name: 'Tesoureiro', order: 6 },
    { name: 'Chanceler', order: 7 },
    { name: 'Mestre de Cerimônias', order: 8 },
    { name: '1º Diácono', order: 9 },
    { name: '2º Diácono', order: 10 },
    { name: '1º Experto', order: 11 },
    { name: '2º Experto', order: 12 },
    { name: 'Cobridor Interno', order: 13 },
    { name: 'Guarda do Templo', order: 14 },
    { name: 'Hospitaleiro', order: 15 },
    { name: 'Bibliotecário', order: 16 },
    { name: 'Mestre de Harmonia', order: 17 },
    { name: 'Mestre de Banquetes', order: 18 },
    { name: 'Porta-Bandeira', order: 19 },
    { name: 'Porta-Estandarte', order: 20 },
    { name: 'Arquiteto', order: 21 },
    { name: 'Capelão', order: 22 },
  ],
  'Rito de York': [
    { name: 'Venerável Mestre', order: 1 },
    { name: '1º Vigilante', order: 2 },
    { name: '2º Vigilante', order: 3 },
    { name: 'Capelão', order: 4 },
    { name: 'Secretário', order: 5 },
    { name: 'Tesoureiro', order: 6 },
    { name: '1º Diácono', order: 7 },
    { name: '2º Diácono', order: 8 },
    { name: 'Mestre de Cerimônias', order: 9 },
    { name: 'Cobridor', order: 10 },
    { name: 'Guarda do Templo', order: 11 },
    { name: 'Hospitaleiro', order: 12 },
    { name: 'Porta-Bandeira', order: 13 },
    { name: 'Mestre de Harmonia', order: 14 },
  ],
  'Rito Adonhiramita': [
    { name: 'Venerável Mestre', order: 1 },
    { name: '1º Vigilante', order: 2 },
    { name: '2º Vigilante', order: 3 },
    { name: 'Orador', order: 4 },
    { name: 'Secretário', order: 5 },
    { name: 'Tesoureiro', order: 6 },
    { name: 'Chanceler', order: 7 },
    { name: 'Mestre de Cerimônias', order: 8 },
    { name: '1º Diácono', order: 9 },
    { name: '2º Diácono', order: 10 },
    { name: '1º Experto', order: 11 },
    { name: '2º Experto', order: 12 },
    { name: 'Cobridor', order: 13 },
    { name: 'Guarda do Templo', order: 14 },
    { name: 'Hospitaleiro', order: 15 },
    { name: 'Bibliotecário', order: 16 },
  ],
  'Rito Brasileiro': [
    { name: 'Venerável Mestre', order: 1 },
    { name: '1º Vigilante', order: 2 },
    { name: '2º Vigilante', order: 3 },
    { name: 'Orador', order: 4 },
    { name: 'Secretário', order: 5 },
    { name: 'Tesoureiro', order: 6 },
    { name: 'Chanceler', order: 7 },
    { name: 'Mestre de Cerimônias', order: 8 },
    { name: '1º Diácono', order: 9 },
    { name: '2º Diácono', order: 10 },
    { name: '1º Experto', order: 11 },
    { name: '2º Experto', order: 12 },
    { name: 'Cobridor', order: 13 },
    { name: 'Guarda do Templo', order: 14 },
    { name: 'Hospitaleiro', order: 15 },
    { name: 'Bibliotecário', order: 16 },
  ],
  'Rito Moderno (Francês)': [
    { name: 'Venerável Mestre', order: 1 },
    { name: '1º Vigilante', order: 2 },
    { name: '2º Vigilante', order: 3 },
    { name: 'Orador', order: 4 },
    { name: 'Secretário', order: 5 },
    { name: 'Tesoureiro', order: 6 },
    { name: 'Chanceler', order: 7 },
    { name: 'Mestre de Cerimônias', order: 8 },
    { name: '1º Diácono', order: 9 },
    { name: '2º Diácono', order: 10 },
    { name: '1º Experto', order: 11 },
    { name: '2º Experto', order: 12 },
    { name: 'Cobridor', order: 13 },
    { name: 'Guarda do Templo', order: 14 },
    { name: 'Hospitaleiro', order: 15 },
    { name: 'Arquiteto', order: 16 },
  ],
  'Rito Schröder': [
    { name: 'Venerável Mestre', order: 1 },
    { name: '1º Vigilante', order: 2 },
    { name: '2º Vigilante', order: 3 },
    { name: 'Orador', order: 4 },
    { name: 'Secretário', order: 5 },
    { name: 'Tesoureiro', order: 6 },
    { name: 'Mestre de Cerimônias', order: 7 },
    { name: '1º Diácono', order: 8 },
    { name: '2º Diácono', order: 9 },
    { name: 'Guarda do Templo', order: 10 },
    { name: 'Hospitaleiro', order: 11 },
  ],
  'Rito de Emulação': [
    { name: 'Venerável Mestre', order: 1 },
    { name: 'Past Master Imediato', order: 2 },
    { name: '1º Vigilante', order: 3 },
    { name: '2º Vigilante', order: 4 },
    { name: 'Capelão', order: 5 },
    { name: 'Secretário', order: 6 },
    { name: 'Tesoureiro', order: 7 },
    { name: '1º Diácono', order: 8 },
    { name: '2º Diácono', order: 9 },
    { name: '1º Mestre de Cerimônias', order: 10 },
    { name: '2º Mestre de Cerimônias', order: 11 },
    { name: 'Cobridor', order: 12 },
    { name: 'Guarda do Templo', order: 13 },
    { name: 'Hospitaleiro', order: 14 },
    { name: 'Mestre de Harmonia', order: 15 },
  ],
  'Rito Escocês Retificado (RER)': [
    { name: 'Venerável Mestre', order: 1 },
    { name: '1º Vigilante', order: 2 },
    { name: '2º Vigilante', order: 3 },
    { name: 'Orador', order: 4 },
    { name: 'Secretário', order: 5 },
    { name: 'Tesoureiro', order: 6 },
    { name: 'Mestre de Cerimônias', order: 7 },
    { name: 'Hospitaleiro (Elemosinário)', order: 8 },
    { name: 'Ecônomo', order: 9 },
  ],
};

// Ritos praticados no Brasil, ordenados por prevalência aproximada.
export const BRAZILIAN_RITES: RiteSeed[] = [
  { name: 'Rito Escocês Antigo e Aceito (REAA)', order: 1 },
  { name: 'Rito de York', order: 2 },
  { name: 'Rito Adonhiramita', order: 3 },
  { name: 'Rito Brasileiro', order: 4 },
  { name: 'Rito Moderno (Francês)', order: 5 },
  { name: 'Rito Schröder', order: 6 },
  { name: 'Rito de Emulação', order: 7 },
  { name: 'Rito Escocês Retificado (RER)', order: 8 },
];

// Potências maçônicas do Brasil. As três vertentes regulares são o GOB,
// as Grandes Lojas estaduais (confederadas na CMSB) e os Grandes Orientes
// estaduais (confederados na COMAB).
export const BRAZILIAN_POWERS: PowerSeed[] = [
  { name: 'Grande Oriente do Brasil (GOB)', order: 1 },
  // Grandes Lojas estaduais (CMSB)
  { name: 'Grande Loja Maçônica do Estado do Acre (GLEAC)', order: 2 },
  { name: 'Grande Loja Maçônica do Estado de Alagoas (GLEAL)', order: 3 },
  { name: 'Grande Loja Maçônica do Estado do Amapá (GLOMAP)', order: 4 },
  { name: 'Grande Loja Maçônica do Estado do Amazonas (GLOMAM)', order: 5 },
  { name: 'Grande Loja Maçônica do Estado da Bahia (GLEB)', order: 6 },
  { name: 'Grande Loja Maçônica do Estado do Ceará (GLECE)', order: 7 },
  { name: 'Grande Loja Maçônica do Distrito Federal (GLMDF)', order: 8 },
  { name: 'Grande Loja Maçônica do Estado do Espírito Santo (GLMEES)', order: 9 },
  { name: 'Grande Loja Maçônica do Estado de Goiás (GLEG)', order: 10 },
  { name: 'Grande Loja Maçônica do Estado do Maranhão (GLEMA)', order: 11 },
  { name: 'Grande Loja Maçônica do Estado de Mato Grosso (GLEMT)', order: 12 },
  { name: 'Grande Loja Maçônica do Estado de Mato Grosso do Sul (GLMS)', order: 13 },
  { name: 'Grande Loja Maçônica de Minas Gerais (GLMMG)', order: 14 },
  { name: 'Grande Loja Maçônica do Estado do Pará (GLEPA)', order: 15 },
  { name: 'Grande Loja Maçônica do Estado da Paraíba (GLEPB)', order: 16 },
  { name: 'Grande Loja Maçônica do Paraná (GLP)', order: 17 },
  { name: 'Grande Loja Maçônica de Pernambuco (GLEPE)', order: 18 },
  { name: 'Grande Loja Maçônica do Estado do Piauí (GLEPI)', order: 19 },
  { name: 'Grande Loja Maçônica do Estado do Rio de Janeiro (GLMERJ)', order: 20 },
  { name: 'Grande Loja Maçônica do Rio Grande do Norte (GLRN)', order: 21 },
  { name: 'Grande Loja Maçônica do Rio Grande do Sul (GLMERGS)', order: 22 },
  { name: 'Grande Loja Maçônica do Estado de Rondônia (GLERO)', order: 23 },
  { name: 'Grande Loja Maçônica de Roraima (GLERR)', order: 24 },
  { name: 'Grande Loja Maçônica do Estado de Santa Catarina (GLESC)', order: 25 },
  { name: 'Grande Loja Maçônica do Estado de São Paulo (GLESP)', order: 26 },
  { name: 'Grande Loja Maçônica do Estado de Sergipe (GLES)', order: 27 },
  { name: 'Grande Loja Maçônica do Estado do Tocantins (GLETO)', order: 28 },
  // Grandes Orientes estaduais (COMAB) — principais
  { name: 'Grande Oriente do Rio Grande do Sul (GORGS)', order: 29 },
  { name: 'Grande Oriente do Paraná (GOP)', order: 30 },
  { name: 'Grande Oriente do Estado de São Paulo (GOSP)', order: 31 },
  { name: 'Grande Oriente do Estado do Rio de Janeiro (GOERJ)', order: 32 },
  { name: 'Grande Oriente de Minas Gerais (GOMG)', order: 33 },
  { name: 'Grande Oriente da Bahia (GOBA)', order: 34 },
  { name: 'Grande Oriente do Ceará (GOCE)', order: 35 },
  { name: 'Grande Oriente de Santa Catarina (GOSC)', order: 36 },
  { name: 'Outra / Independente', order: 99 },
];

// Plano de contas típico de uma loja maçônica (receitas e despesas correntes).
// Estrutura: 1.x = receitas, 2.x = despesas. Código no padrão hierárquico simples.
// Plano de contas no formato livro-caixa, com codificação hierárquica
// (grupo.subgrupo.conta) alinhada à prática de lojas/associações maçônicas.
// A `category` carrega o grupo, usado para totalização no balancete e no
// relatório de fechamento do veneralato.
export const MASONIC_CHART_OF_ACCOUNTS: ChartAccountSeed[] = [
  // ===== RECEITAS =====
  // 1.1 Receitas Próprias
  { code: '1.1.01', name: 'Mensalidades', type: 'REVENUE', category: 'Receitas Próprias' },
  { code: '1.1.02', name: 'Taxas (Iniciação, Elevação, Exaltação)', type: 'REVENUE', category: 'Receitas Próprias' },
  { code: '1.1.03', name: 'Taxa de Filiação / Regularização', type: 'REVENUE', category: 'Receitas Próprias' },
  { code: '1.1.04', name: 'Doações e Contribuições', type: 'REVENUE', category: 'Receitas Próprias' },
  { code: '1.1.05', name: 'Tronco de Beneficência', type: 'REVENUE', category: 'Receitas Próprias' },
  { code: '1.1.06', name: 'Jantar Ritualístico', type: 'REVENUE', category: 'Receitas Próprias' },
  { code: '1.1.07', name: 'Taxa Paramaçônica', type: 'REVENUE', category: 'Receitas Próprias' },
  // 1.2 Outras Receitas
  { code: '1.2.01', name: 'Rendimentos de Aplicação Financeira', type: 'REVENUE', category: 'Outras Receitas' },
  { code: '1.2.02', name: 'Empréstimos Captados', type: 'REVENUE', category: 'Outras Receitas' },
  { code: '1.2.03', name: 'Cessão / Aluguel do Templo', type: 'REVENUE', category: 'Outras Receitas' },
  { code: '1.2.04', name: 'Venda de Materiais e Paramentos', type: 'REVENUE', category: 'Outras Receitas' },
  { code: '1.2.05', name: 'Estorno de Despesa', type: 'REVENUE', category: 'Outras Receitas' },
  // 1.5 Abertura / Eventos
  { code: '1.5.04', name: 'Saldo para Abertura de Escrituração', type: 'REVENUE', category: 'Abertura' },
  { code: '1.5.05', name: 'Receitas de Eventos', type: 'REVENUE', category: 'Outras Receitas' },

  // ===== DESPESAS =====
  // 2.1 Despesas Administrativas
  { code: '2.1.01', name: 'Energia Elétrica', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.02', name: 'Telefone', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.03', name: 'Impostos e Taxas', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.04', name: 'Material de Expediente', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.05', name: 'Concessão / Aluguel da Sede', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.06', name: 'Despesas Bancárias', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.07', name: 'Serviços de Terceiros', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.08', name: 'Pagamento de Parcela de Empréstimo', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.09', name: 'Internet', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.10', name: 'Salários e Encargos', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.11', name: 'Despesas com Eventos', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.12', name: 'Jantar Ritualístico', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.13', name: 'Água e Esgoto', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.14', name: 'Limpeza e Copa', type: 'EXPENSE', category: 'Despesas Administrativas' },
  { code: '2.1.15', name: 'Contribuição à Potência / Grande Loja', type: 'EXPENSE', category: 'Despesas Administrativas' },
  // 2.2 Investimentos
  { code: '2.2.02', name: 'Móveis e Utensílios', type: 'EXPENSE', category: 'Investimentos' },
  { code: '2.2.03', name: 'Equipamentos', type: 'EXPENSE', category: 'Investimentos' },
  { code: '2.2.04', name: 'Manutenção de Equipamentos', type: 'EXPENSE', category: 'Investimentos' },
  { code: '2.2.05', name: 'Seguros', type: 'EXPENSE', category: 'Investimentos' },
  { code: '2.2.06', name: 'Obras e Benfeitorias', type: 'EXPENSE', category: 'Investimentos' },
  // 8.9 Assistência e Manutenção
  { code: '8.9.03', name: 'Ação Social e Caridade', type: 'EXPENSE', category: 'Assistência e Manutenção' },
  { code: '8.9.04', name: 'Manutenção Preventiva/Corretiva', type: 'EXPENSE', category: 'Assistência e Manutenção' },
  { code: '8.9.05', name: 'Estorno de Receita', type: 'EXPENSE', category: 'Assistência e Manutenção' },
  { code: '8.9.06', name: 'Material Ritualístico e Paramentos', type: 'EXPENSE', category: 'Assistência e Manutenção' },
];
