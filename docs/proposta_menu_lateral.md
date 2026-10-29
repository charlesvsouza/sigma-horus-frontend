# Proposta de Arquitetura de Informação e Design: Menu Lateral (Sigma Horus)

Este documento apresenta a especificação técnica unificada para o design, hierarquia de informação e comportamento do **Menu Lateral (Sidebar)** do sistema SaaS Sigma Horus. A estrutura foi desenhada para otimizar o espaço de tela em dashboards complexos, respeitar a divisão tradicional dos cargos maçônicos e garantir usabilidade em qualquer dispositivo.

---

## 🛠️ 1. Comportamento Geral e UX do Menu

*   **Modelo Principal (Desktop):** Menu Lateral Duplo (Dual-tier / Multi-level).
*   **Comportamento:** Retrátil (Collapsible). O usuário pode recolher a segunda coluna para focar em tabelas densas, gráficos de fluxo de caixa e listagens de membros.
*   **Segurança (LGPD):** A exibição dos módulos e submenus do Nível 2 deve ser renderizada dinamicamente com base nas permissões do cargo do usuário (Row-Level Security / RBAC).

---

## 🏛️ 2. Estrutura do Menu: Área Administrativa (Visão de Gestão)

### 🌟 Cabeçalho (Fixo)
*   **Seletor de Oficina:** Dropdown para troca rápida de Loja ou Oriente (útil para membros de Potências ou obreiros filiados a mais de uma loja).
*   **Ações Rápidas:** Botão de contexto dinâmico baseado no módulo ativo (Ex: *Novo Lançamento* na Tesouraria, *Nova Sessão* na Secretaria).

### 🗂️ Nível 1: Macro-módulos (Ícones Fixos na Primeira Coluna)

#### A. 💳 Tesouraria (Coração Financeiro)
*   **Submenus (Nível 2):**
    *   `Visão Geral` -> Dashboard financeiro e saldo das contas.
    *   `Mensalidades & Cobranças` -> Emissão e controle de boletos/Pix via Asaas.
    *   `Contas a Pagar & Receber` -> Cadastro de fornecedores e compromissos.
    *   `Fluxo de Caixa & DRE` -> Relatórios gerenciais e demonstrativos.
    *   `Conciliação Bancária` -> Importação de extratos e conferência.
    *   `Inadimplência` -> Acompanhamento e réguas de cobrança automática.

#### B. 📝 Secretaria (Administração Viva)
*   **Submenus (Nível 2):**
    *   `Calendário de Sessões` -> Agendamento de reuniões ritualísticas.
    *   `Ordens do Dia` -> Pautas, convocações por e-mail e comunicações.
    *   `Balaustres` -> Arquivo e redação de atas das sessões.
    *   `Veneralato` -> Histórico de administrações e períodos de gestão.

#### C. 📜 Chancelaria (Ordem e Memória)
*   **Submenus (Nível 2):**
    *   `Quadro de Obreiros` -> Cadastro geral de membros ativos, cargos e status.
    *   `Ritos e Graus` -> Configuração da progressão maçônica na oficina.
    *   `Prontuários & Certificados` -> Arquivo digital de documentos dos irmãos.
    *   `Inventário de Alfaias` -> Controle de materiais, patrimônio e termos de entrega.

#### D. 🤝 Hospitalaria (Cuidado Fraterno)
*   **Submenus (Nível 2):**
    *   `Tronco de Beneficência` -> Prestação de contas das arrecadações em Loja.
    *   `Campanhas Sociais` -> Ações de benemerência e arrecadação via Pix.
    *   `Aniversários & Jubileus` -> Calendário de comemorações dos membros.
    *   `Pedidos de Auxílio` -> Triagem de solicitações enviadas pelos irmãos.

#### E. ⚙️ Configurações Master
*   **Submenus (Nível 2):**
    *   `Dados da Loja` -> Upload de brasão, cabeçalhos oficiais e regras da Potência.
    *   `Controle de Acessos` -> Definição de permissões de visualização por cargo (LGPD).
    *   `Trilha de Auditoria` -> Logs imutáveis de alterações (Quem fez, o que e quando).
    *   `Importação de Dados` -> Ferramenta de mapeamento de planilhas de migração.

---

## 👤 3. Estrutura do Menu: Portal do Irmão (Visão do Obreiro)

Quando um irmão comum faz login (sem cargos administrativos ativos), a interface oculta a complexidade dos quatro ofícios. O menu torna-se **Simples (Flat List com uma única coluna)**, focado na transparência e na auto-gestão do obreiro:

*   🏠 **Início (Dashboard):** Resumo de avisos da loja, próxima sessão e situação financeira rápida.
*   💰 **Minhas Mensalidades:** Tela de pagamentos com Pix/QR Code gerados via Asaas e botão para histórico de recebidos.
*   📅 **Calendário da Oficina:** Datas das próximas sessões, ordens do dia anexadas pela secretaria e eventos sociais.
*   📋 **Documentos & Certidões:** Emissão instantânea da Declaração de Regularidade (se adimplente) e consulta a circulares permitidas.
*   ❤️ **Solicitar Auxílio / Doar:** Canal direto com a Hospitalaria para propor ou contribuir com campanhas ativas de benemerência.

---

## 📱 4. Comportamento Responsivo (Mobile)

O Sigma Horus funciona no navegador do celular sem necessidade de instalação de aplicativos. Para adaptar as estruturas acima a telas pequenas, o menu lateral segue as seguintes regras de transição:

1.  **Ocultamento Padrão (Off-Canvas):** O menu lateral desaparece por completo em telas menores que **768px**. A navegação passa a ser controlada por um botão tipo "Hambúrguer" `☰` fixado na barra superior (Navbar).
2.  **Abordagem Flutuante (Drawer) em uma Coluna:** Ao tocar no menu hambúrguer, uma gaveta desliza da esquerda cobrindo parte da tela. Para otimizar o espaço mobile:
    *   Na **Visão Administrativa**, o design de duas colunas (Nível 1 e Nível 2) colapsa em uma lista única sanfona (Accordion). Clicar em "Tesouraria" expande seus subitens verticalmente para baixo, evitando navegações horizontais confusas no celular.
3.  **Barra Inferior de Atalhos (Bottom Navigation):** Para o **Portal do Irmão**, as ações mais críticas e recorrentes no mobile devem ser replicadas em uma barra fixa na parte inferior da tela do celular (estilo app nativo), contendo:
    *   `Início` | `Pagar Pix` | `Calendário` | `Perfil`

---

## 👤 5. Rodapé Permanente do Menu (Footer da Sidebar)

Sempre visível na base da barra lateral em telas desktop, ou no final do menu expansível no mobile:

*   **Perfil do Usuário:** Foto, nome do irmão e botão de alternância (Alternar para Portal do Irmão <-> Alternar para Painel Administrativo, caso tenha permissão).
*   **Status do Plano:** Indicador visual de uso do sistema (Ex: *24 / 30 Membros Ativos - Plano Oficina*).
*   **Central de Ajuda:** Link direto para guias, manuais e suporte técnico prioritário.

---

## 🎨 6. Esquema Visual do Layout (Desktop)

```text
+-------------------------------------------------------------------+

|  [Seletor de Loja] ▾                                              |
|  [+ Criar Novo / Lançar...]                                        |
|--------------------+-------------------------+--------------------+

| (NÍVEL 1 - ÍCONES) | (NÍVEL 2 - TEXTUAL)     | (ÁREA DE CONTEÚDO) |
|                    |                         |                    |
|  [ 💳 Tesouraria ] | -> Visão Geral          |                    |
|  [ 📝 Secretaria ] |    Mensalidades & Pix   |    [ Tabela de ]   |
|  [ 📜 Chancelaria] |    Fluxo de Caixa       |    [  Dados   ]   |
|  [ 🤝 Hospitalar ] |    Inadimplência ⚠️     |    [  Gráficos  ]   |
|                    |                         |                    |
|                    |                         |                    |
|--------------------+-------------------------+--------------------+

|  [⚙️ Configs]      |                         |                    |
|  [👤 Perfil Ir. ]  |                         |                    |
+--------------------+-------------------------+--------------------+
```
