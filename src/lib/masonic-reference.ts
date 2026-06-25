// Dados de referência da Maçonaria brasileira para semear cada loja.
// Fontes: COMAB (comab.org.br), GOB (gob.org.br), Wikipédia "Lista de obediências
// maçônicas" e "Ritos maçônicos", e referências de tesouraria/escrituração de lojas.
// Curado em 2026-06. Listas extensíveis — ajuste conforme a realidade da loja.

export interface RiteSeed { name: string; order: number; }
export interface PowerSeed { name: string; order: number; }
export interface ChartAccountSeed { code: string; name: string; type: 'REVENUE' | 'EXPENSE'; category: string; }

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
export const MASONIC_CHART_OF_ACCOUNTS: ChartAccountSeed[] = [
  // Receitas
  { code: '1.01', name: 'Mensalidades / Captações', type: 'REVENUE', category: 'captacao' },
  { code: '1.02', name: 'Taxa de Iniciação', type: 'REVENUE', category: 'grau' },
  { code: '1.03', name: 'Taxa de Elevação', type: 'REVENUE', category: 'grau' },
  { code: '1.04', name: 'Taxa de Exaltação', type: 'REVENUE', category: 'grau' },
  { code: '1.05', name: 'Taxa de Filiação / Regularização', type: 'REVENUE', category: 'taxa' },
  { code: '1.06', name: 'Tronco de Beneficência', type: 'REVENUE', category: 'beneficencia' },
  { code: '1.07', name: 'Doações e Contribuições', type: 'REVENUE', category: 'doacao' },
  { code: '1.08', name: 'Eventos e Confraternizações', type: 'REVENUE', category: 'evento' },
  { code: '1.09', name: 'Cessão / Aluguel do Templo', type: 'REVENUE', category: 'patrimonio' },
  { code: '1.10', name: 'Venda de Materiais e Paramentos', type: 'REVENUE', category: 'patrimonio' },
  { code: '1.11', name: 'Rendimentos Financeiros', type: 'REVENUE', category: 'financeiro' },
  // Despesas
  { code: '2.01', name: 'Aluguel do Templo / Sede', type: 'EXPENSE', category: 'ocupacao' },
  { code: '2.02', name: 'Energia Elétrica', type: 'EXPENSE', category: 'utilidades' },
  { code: '2.03', name: 'Água e Esgoto', type: 'EXPENSE', category: 'utilidades' },
  { code: '2.04', name: 'Telefone e Internet', type: 'EXPENSE', category: 'utilidades' },
  { code: '2.05', name: 'Material de Expediente', type: 'EXPENSE', category: 'administrativo' },
  { code: '2.06', name: 'Material Ritualístico e Paramentos', type: 'EXPENSE', category: 'ritualistico' },
  { code: '2.07', name: 'Manutenção e Conservação', type: 'EXPENSE', category: 'ocupacao' },
  { code: '2.08', name: 'Contribuição à Potência / Grande Loja', type: 'EXPENSE', category: 'obrigacao' },
  { code: '2.09', name: 'Beneficência e Filantropia', type: 'EXPENSE', category: 'beneficencia' },
  { code: '2.10', name: 'Eventos e Confraternizações', type: 'EXPENSE', category: 'evento' },
  { code: '2.11', name: 'Taxas Bancárias', type: 'EXPENSE', category: 'financeiro' },
  { code: '2.12', name: 'Tributos e Contribuições', type: 'EXPENSE', category: 'obrigacao' },
  { code: '2.13', name: 'Limpeza e Copa', type: 'EXPENSE', category: 'administrativo' },
  { code: '2.14', name: 'Seguros', type: 'EXPENSE', category: 'administrativo' },
];
