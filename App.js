
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, FlatList, Keyboard, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@meu_financeiro_v1";
const ABAS = ["Contas", "Receitas", "Resumo", "Cartões", "Dashboard", "Histórico"];

const cents = v => Number(String(v || "").replace(/\D/g, "") || 0);

const formatInput = v => (Number(v || 0) / 100).toLocaleString("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const real = v => (Number(v || 0) / 100).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const soma = lista =>
  (lista || []).reduce((total, item) => total + Number(item.valor || 0), 0);

function chaveMes(data = new Date()) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function nomeMes(chave) {
  const [ano, mes] = chave.split("-");
  const data = new Date(Number(ano), Number(mes) - 1, 1, 12);
  const texto = data.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function chaveDoRegistro(registro) {
  if (registro.mesKey) return registro.mesKey;

  if (registro.finalizadaEm) {
    return chaveMes(new Date(registro.finalizadaEm));
  }

  if (registro.dataFinalizacao) {
    const partes = registro.dataFinalizacao.split("/");
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1].padStart(2, "0")}`;
    }
  }

  return chaveMes();
}

function normalizarHistorico(lista) {
  const meses = {};

  (Array.isArray(lista) ? lista : []).forEach(registro => {
    const chave = chaveDoRegistro(registro);

    if (!meses[chave]) {
      meses[chave] = {
        id: chave,
        mesKey: chave,
        mesLabel: nomeMes(chave),
        contas: [],
        receitas: [],
        contasFinalizadas: false,
        receitasFinalizadas: false
      };
    }

    const mes = meses[chave];

    if (Array.isArray(registro.contas)) {
      mes.contas.push(...registro.contas);
      mes.contasFinalizadas = true;
    }

    if (Array.isArray(registro.receitas)) {
      mes.receitas.push(...registro.receitas);
      mes.receitasFinalizadas = true;
    }
  });

  return Object.values(meses).sort((a, b) =>
    b.mesKey.localeCompare(a.mesKey)
  );
}

function Financeiro() {
  const [contas, setContas] = useState([]);
  const [receitas, setReceitas] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [pronto, setPronto] = useState(false);

  const [aba, setAba] = useState(0);
  const [larguraPagina, setLarguraPagina] = useState(0);
  const pagerRef = useRef(null);

  const [modal, setModal] = useState(false);
  const [tipoModal, setTipoModal] = useState("conta");
  const [idEdicao, setIdEdicao] = useState(null);
  const [mesEdicao, setMesEdicao] = useState(null);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [valorUtilizado, setValorUtilizado] = useState("");
  const [menu, setMenu] = useState(false);
  const [menuAbas, setMenuAbas] = useState(false);

  const [mesExpandido, setMesExpandido] = useState(null);
  const [mesArquivoExpandido, setMesArquivoExpandido] = useState(null);
  const [mesFiltroResumo, setMesFiltroResumo] = useState(new Date().getMonth());
  const [anoFiltroResumo, setAnoFiltroResumo] = useState(new Date().getFullYear());
  const [mesFiltroHistorico, setMesFiltroHistorico] = useState(new Date().getMonth());
  const [anoFiltroHistorico, setAnoFiltroHistorico] = useState(new Date().getFullYear());
  const [mesFiltroDashboard, setMesFiltroDashboard] = useState(new Date().getMonth());
  const [anoFiltroDashboard, setAnoFiltroDashboard] = useState(new Date().getFullYear());

  const totalContas = useMemo(() => soma(contas), [contas]);
  const totalReceitas = useMemo(() => soma(receitas), [receitas]);

  useEffect(() => {
    (async () => {
      try {
        const salvo = await AsyncStorage.getItem(KEY);

        if (salvo) {
          const dados = JSON.parse(salvo);

          setContas(Array.isArray(dados.contas) ? dados.contas : []);
          setReceitas(Array.isArray(dados.receitas) ? dados.receitas : []);
          setHistorico(normalizarHistorico(dados.historico));
          setCartoes(Array.isArray(dados.cartoes) ? dados.cartoes : []);
        }
      } catch (e) {
        Alert.alert("Aviso", "Não foi possível carregar os dados salvos.");
      } finally {
        setPronto(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (pronto) {
      AsyncStorage.setItem(
        KEY,
        JSON.stringify({ contas, receitas, historico, cartoes })
      ).catch(() => Alert.alert("Erro", "Não foi possível salvar os dados."));
    }
  }, [contas, receitas, historico, cartoes, pronto]);

  function navegar(indice) {
    setAba(indice);

    if (larguraPagina > 0) {
      pagerRef.current?.scrollTo({
        x: indice * larguraPagina,
        animated: true
      });
    }
  }

  function aoDeslizar(evento) {
    if (!larguraPagina) return;

    const indice = Math.round(
      evento.nativeEvent.contentOffset.x / larguraPagina
    );

    setAba(Math.max(0, Math.min(ABAS.length - 1, indice)));
  }

  function novo(tipo) {
    setMesEdicao(null);
    setTipoModal(tipo);
    setIdEdicao(null);
    setNome(tipo === "cartao" ? `Cartão ${cartoes.length + 1}` : "");
    setValor("");
    setValorUtilizado("");
    setMenu(false);
    setModal(true);
  }

  function editar(item, tipo, mesKey = null) {
    setMesEdicao(mesKey);
    setTipoModal(tipo);
    setIdEdicao(item.id);
    setNome(item.nome);
    setValor(String(item.valor));
    setMenu(false);
    setModal(true);
  }

  function editarCartao(item) {
    setMesEdicao(null);
    setTipoModal("cartao");
    setIdEdicao(item.id);
    setNome(item.nome);
    setValor(String(item.limite || 0));
    setValorUtilizado("");
    setMenu(false);
    setModal(true);
  }

  function fechar() {
    Keyboard.dismiss();
    setModal(false);
    setMenu(false);
    setMesEdicao(null);
  }

  function salvar() {
    const n = nome.trim();
    const v = cents(valor);
    const ehCartao = tipoModal === "cartao";
    const ehConta = tipoModal === "conta";
    const atualizar = ehConta ? setContas : setReceitas;

    if (!n) return Alert.alert("Falta o nome", "Digite um nome para o lançamento.");
    if (ehCartao) {
      if (v <= 0) return Alert.alert("Limite inválido", "Informe um limite maior que zero.");
      const registro = { id: idEdicao || `${Date.now()}-${Math.random()}`, nome: n, limite: v };
      setCartoes(lista => idEdicao
        ? lista.map(item => item.id === idEdicao ? { ...item, ...registro } : item)
        : [registro, ...lista]);
      fechar();
      return;
    }
    if (v <= 0) return Alert.alert("Valor inválido", "Informe um valor maior que zero.");

    if (mesEdicao) {
      const campo = ehConta ? "contas" : "receitas";
      setHistorico(lista => lista.map(mes => mes.mesKey !== mesEdicao ? mes : ({
        ...mes,
        [campo]: (mes[campo] || []).map(item =>
          item.id === idEdicao ? { ...item, nome: n, valor: v } : item
        )
      })));
    } else if (idEdicao) {
      atualizar(lista => lista.map(item =>
        item.id === idEdicao ? { ...item, nome: n, valor: v } : item
      ));
    } else {
      atualizar(lista => [
        { id: `${Date.now()}-${Math.random()}`, nome: n, valor: v },
        ...lista
      ]);
    }
    fechar();
  }

  function excluir() {
    setMenu(false);
    if (tipoModal === "cartao") {
      Alert.alert("Excluir cartão?", "Esse cartão será removido da sua lista.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => {
          setCartoes(lista => lista.filter(item => item.id !== idEdicao));
          fechar();
        }}
      ]);
      return;
    }
    const ehConta = tipoModal === "conta";
    const atualizar = ehConta ? setContas : setReceitas;
    const nomeTipo = ehConta ? "conta" : "receita";

    Alert.alert(
      `Excluir ${nomeTipo}?`,
      mesEdicao ? "Esse lançamento será removido do Histórico." : "Esse lançamento será removido da lista atual.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            if (mesEdicao) {
              const campo = ehConta ? "contas" : "receitas";
              setHistorico(lista => lista.map(mes => mes.mesKey !== mesEdicao ? mes : ({
                ...mes,
                [campo]: (mes[campo] || []).filter(item => item.id !== idEdicao)
              })));
            } else {
              atualizar(lista => lista.filter(item => item.id !== idEdicao));
            }
            fechar();
          }
        }
      ]
    );
  }

  function finalizarLista(tipo) {
    const ehConta = tipo === "conta";
    const lista = ehConta ? contas : receitas;
    const atualizar = ehConta ? setContas : setReceitas;
    const titulo = ehConta ? "contas" : "receitas";

    if (!lista.length) {
      return Alert.alert(
        "Lista vazia",
        `Adicione pelo menos uma ${ehConta ? "conta" : "receita"} antes de finalizar.`
      );
    }

    Alert.alert(
      "Finalizar lista?",
      `Os lançamentos de ${titulo} serão guardados no Histórico do mês atual.`,
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Finalizar",
          onPress: () => {
            const agora = new Date();
            const mesKey = chaveMes(agora);
            const novosItens = lista.map(item => ({
              id: item.id,
              nome: item.nome,
              valor: Number(item.valor)
            }));

            setHistorico(anteriores => {
              const existente = anteriores.find(m => m.mesKey === mesKey);

              const base = existente || {
                id: mesKey,
                mesKey,
                mesLabel: nomeMes(mesKey),
                contas: [],
                receitas: [],
                contasFinalizadas: false,
                receitasFinalizadas: false
              };

              const atualizado = ehConta
                ? {
                    ...base,
                    contas: [...(base.contas || []), ...novosItens],
                    contasFinalizadas: true
                  }
                : {
                    ...base,
                    receitas: [...(base.receitas || []), ...novosItens],
                    receitasFinalizadas: true
                  };

              return [
                atualizado,
                ...anteriores.filter(m => m.mesKey !== mesKey)
              ].sort((a, b) => b.mesKey.localeCompare(a.mesKey));
            });

            atualizar([]);
            Alert.alert("Lista finalizada", "Os dados foram guardados no Histórico.");
          }
        }
      ]
    );
  }

  function alternarMes(chave) {
    setMesExpandido(atual => atual === chave ? null : chave);
  }

  function alternarPagamento(mesKey, id) {
    setHistorico(lista => lista.map(mes => {
      if (mes.mesKey !== mesKey) return mes;
      return {
        ...mes,
        contas: (mes.contas || []).map(item =>
          item.id === id ? { ...item, pago: !item.pago } : item
        )
      };
    }));
  }

  const linha = (item, tipo) => (
    <Pressable
      key={item.id}
      style={s.linha}
      onPress={() => editar(item, tipo)}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.nomeConta}>{item.nome}</Text>
      </View>
      <Text style={s.valorConta}>{real(item.valor)}</Text>
      <Text style={s.seta}>›</Text>
    </Pressable>
  );

  function renderLista(tipo) {
    const ehConta = tipo === "conta";
    const lista = ehConta ? contas : receitas;
    const total = ehConta ? totalContas : totalReceitas;
    const titulo = ehConta ? "Minhas contas" : "Minhas receitas";
    const botao = ehConta ? "Adicionar conta" : "Adicionar receita";
    const rotulo = ehConta ? "TOTAL DAS CONTAS" : "TOTAL DAS RECEITAS";

    return (
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.conteudo}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={s.adicionar} onPress={() => novo(tipo)}>
          <View style={s.maisCirculo}>
            <Text style={s.maisTxt}>＋</Text>
          </View>
          <Text style={s.adicionarTexto}>{botao}</Text>
        </Pressable>

        <View style={s.resumo}>
          <Text style={s.rotulo}>{rotulo}</Text>
          <Text style={s.total} numberOfLines={1} adjustsFontSizeToFit>
            {real(total)}
          </Text>
        </View>

        <View style={s.cabLista}>
          <Text style={s.tituloLista}>{titulo}</Text>
        </View>

        {lista.length > 0 ? (
          <View style={s.lista}>
            {lista.map((item, index) => (
              <React.Fragment key={item.id}>
                {linha(item, tipo)}
                {index < lista.length - 1 && <View style={s.separador} />}
              </React.Fragment>
            ))}
          </View>
        ) : (
          <Text style={s.vazioDesc}>
            {ehConta
              ? "As contas adicionadas aparecerão aqui."
              : "As receitas adicionadas aparecerão aqui."}
          </Text>
        )}

        {lista.length > 0 && (
          <Pressable
            style={s.finalizar}
            onPress={() => finalizarLista(tipo)}
          >
            <Text style={s.finalizarTxt}>Finalizar lista</Text>
          </Pressable>
        )}

        <View style={{ height: 12 }} />
      </ScrollView>
    );
  }

  const nomesMesesFiltro = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  function renderFiltroMesAno(mes, ano, setMes, setAno) {
    const mudarMes = delta => {
      const data = new Date(ano, mes + delta, 1);
      setMes(data.getMonth());
      setAno(data.getFullYear());
    };
    return (
      <View style={s.filtroMesAno}>
        <View style={s.filtroCampo}>
          <Text style={s.filtroLegenda}>MÊS</Text>
          <View style={s.filtroControle}>
            <Pressable style={s.filtroSeta} onPress={() => mudarMes(-1)}><Text style={s.filtroSetaTexto}>‹</Text></Pressable>
            <Text style={s.filtroValor}>{nomesMesesFiltro[mes]}</Text>
            <Pressable style={s.filtroSeta} onPress={() => mudarMes(1)}><Text style={s.filtroSetaTexto}>›</Text></Pressable>
          </View>
        </View>
        <View style={s.filtroCampo}>
          <Text style={s.filtroLegenda}>ANO</Text>
          <View style={s.filtroControle}>
            <Pressable style={s.filtroSeta} onPress={() => setAno(v => v - 1)}><Text style={s.filtroSetaTexto}>‹</Text></Pressable>
            <Text style={s.filtroValor}>{ano}</Text>
            <Pressable style={s.filtroSeta} onPress={() => setAno(v => v + 1)}><Text style={s.filtroSetaTexto}>›</Text></Pressable>
          </View>
        </View>
      </View>
    );
  }

  function renderResumo() {
    const mesesFiltrados = historico.filter(mes => mes.mesKey === `${anoFiltroResumo}-${String(mesFiltroResumo + 1).padStart(2, "0")}`);
    return (
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.conteudoHistorico}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.tituloLista}>Resumo mensal</Text>
        <Text style={s.subHistorico}>
          Acompanhe seu saldo, pagamentos e lançamentos de cada mês.
        </Text>

        {renderFiltroMesAno(mesFiltroResumo, anoFiltroResumo, setMesFiltroResumo, setAnoFiltroResumo)}

        {historico.length === 0 ? (
          <Text style={s.vazioDesc}>
            Seus meses finalizados aparecerão aqui.
          </Text>
        ) : mesesFiltrados.length === 0 ? (
          <Text style={s.vazioDesc}>Não há registros para esse mês e ano.</Text>
        ) : (
          mesesFiltrados.map(mes => {
            const totalEntrada = soma(mes.receitas);
            const totalSaida = soma(mes.contas);
            const saldo = totalEntrada - totalSaida;
            const totalPago = soma((mes.contas || []).filter(item => item.pago));
            const totalPendente = totalSaida - totalPago;
            const expandido = mesExpandido === mes.mesKey;

            return (
              <View key={mes.mesKey} style={s.cartaoMes}>
                <Pressable
                  style={s.topMes}
                  onPress={() => alternarMes(mes.mesKey)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.nomeMes}>{mes.mesLabel}</Text>
                    <Text style={s.resumoMes}>
                      Entradas {real(totalEntrada)}
                    </Text>
                    <Text style={s.resumoMes}>
                      Despesas {real(totalSaida)}
                    </Text>
                  </View>
                  <Text style={s.setaMes}>{expandido ? "⌃" : "⌄"}</Text>
                </Pressable>

                {expandido && (
                  <View style={s.detalheMes}>
                    <View style={s.saldoBox}>
                      <Text style={s.rotuloSaldo}>SALDO DO MÊS</Text>
                      <Text style={s.valorSaldo}>{real(saldo)}</Text>
                    </View>

                    <View style={s.resumoPagamentos}>
                      <View style={s.cardPagamentoPago}>
                        <Text style={s.rotuloPagamento}>TOTAL JÁ PAGO</Text>
                        <Text style={s.valorPagamento}>{real(totalPago)}</Text>
                      </View>
                      <View style={s.cardPagamentoPendente}>
                        <Text style={s.rotuloPagamento}>FALTA PAGAR</Text>
                        <Text style={s.valorPagamento}>{real(totalPendente)}</Text>
                      </View>
                    </View>

                    <Text style={s.subtituloHistorico}>Receitas</Text>
                    {mes.receitas?.length ? (
                      mes.receitas.map(item => (
                        <Pressable
                          style={s.linhaHistorico}
                          key={item.id}
                          onPress={() => editar(item, "receita", mes.mesKey)}
                        >
                          <Text style={s.nomeHistorico}>{item.nome}</Text>
                          <Text style={s.valorHistorico}>{real(item.valor)}</Text>
                          <Text style={s.seta}>›</Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={s.semLancamento}>Nenhuma receita finalizada.</Text>
                    )}

                    <View style={s.separadorHistorico} />

                    <Text style={s.subtituloHistorico}>Contas e despesas</Text>
                    {mes.contas?.length ? (
                      mes.contas.map(item => (
                        <View
                          style={[s.linhaHistorico, item.pago && s.linhaHistoricoPaga]}
                          key={item.id}
                        >
                          <Pressable
                            style={s.conteudoLinhaHistorico}
                            onPress={() => editar(item, "conta", mes.mesKey)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[s.nomeHistorico, item.pago && s.textoPago]}>{item.nome}</Text>
                              <Text style={[s.valorHistorico, item.pago && s.textoPago]}>{real(item.valor)}</Text>
                            </View>
                            <Text style={s.seta}>›</Text>
                          </Pressable>
                          <Pressable
                            style={[s.botaoPagamento, item.pago && s.botaoPagamentoAtivo]}
                            onPress={() => alternarPagamento(mes.mesKey, item.id)}
                            accessibilityRole="button"
                            accessibilityLabel={item.pago ? `Marcar ${item.nome} como pendente` : `Marcar ${item.nome} como paga`}
                          >
                            <Text style={[s.textoBotaoPagamento, item.pago && s.textoBotaoPagamentoAtivo]}>
                              {item.pago ? "✓ Paga" : "Pagar"}
                            </Text>
                          </Pressable>
                        </View>
                      ))
                    ) : (
                      <Text style={s.semLancamento}>Nenhuma conta finalizada.</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    );
  }

  function renderHistorico() {
    const mesesFiltrados = historico.filter(mes => mes.mesKey === `${anoFiltroHistorico}-${String(mesFiltroHistorico + 1).padStart(2, "0")}`);
    return (
      <ScrollView style={s.scroll} contentContainerStyle={s.conteudoHistorico} showsVerticalScrollIndicator={false}>
        <Text style={s.tituloLista}>Histórico</Text>
        <Text style={s.subHistorico}>Consulte os lançamentos dos meses finalizados.</Text>
        {renderFiltroMesAno(mesFiltroHistorico, anoFiltroHistorico, setMesFiltroHistorico, setAnoFiltroHistorico)}
        {historico.length === 0 ? (
          <Text style={s.vazioDesc}>Seus lançamentos finalizados aparecerão aqui.</Text>
        ) : mesesFiltrados.length === 0 ? (
          <Text style={s.vazioDesc}>Não há registros para esse mês e ano.</Text>
        ) : mesesFiltrados.map(mes => {
          const expandido = mesArquivoExpandido === mes.mesKey;
          return (
            <View key={mes.mesKey} style={s.cartaoMes}>
              <Pressable style={s.topMes} onPress={() => setMesArquivoExpandido(atual => atual === mes.mesKey ? null : mes.mesKey)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nomeMes}>{mes.mesLabel}</Text>
                  <Text style={s.resumoMes}>Receitas: {real(soma(mes.receitas))}</Text>
                  <Text style={s.resumoMes}>Contas: {real(soma(mes.contas))}</Text>
                </View>
                <Text style={s.setaMes}>{expandido ? "⌃" : "⌄"}</Text>
              </Pressable>
              {expandido && <View style={s.detalheMes}>
                <Text style={s.subtituloHistorico}>Receitas</Text>
                {(mes.receitas || []).length ? mes.receitas.map(item => (
                  <View key={item.id} style={s.linhaHistorico}>
                    <Text style={s.nomeHistorico}>{item.nome}</Text>
                    <Text style={s.valorHistorico}>{real(item.valor)}</Text>
                  </View>
                )) : <Text style={s.semLancamento}>Nenhuma receita registrada.</Text>}
                <View style={s.separadorHistorico}/>
                <Text style={s.subtituloHistorico}>Contas e despesas</Text>
                {(mes.contas || []).length ? mes.contas.map(item => (
                  <View key={item.id} style={[s.linhaHistorico, item.pago && s.linhaHistoricoPaga]}>
                    <Text style={[s.nomeHistorico, item.pago && s.textoPago]}>{item.nome}{item.pago ? " · Paga" : " · Pendente"}</Text>
                    <Text style={[s.valorHistorico, item.pago && s.textoPago]}>{real(item.valor)}</Text>
                  </View>
                )) : <Text style={s.semLancamento}>Nenhuma conta registrada.</Text>}
              </View>}
            </View>
          );
        })}
      </ScrollView>
    );
  }

  function renderCartoes() {
    const limiteTotal = soma(cartoes.map(c => ({ valor: c.limite })));
    const disponivelTotal = limiteTotal;
    return (
      <ScrollView style={s.scroll} contentContainerStyle={s.conteudoHistorico} showsVerticalScrollIndicator={false}>
        <Pressable style={s.adicionar} onPress={() => novo("cartao")}>
          <View style={s.maisCirculo}><Text style={s.maisTxt}>＋</Text></View>
          <Text style={s.adicionarTexto}>Adicionar cartão</Text>
        </Pressable>
        <View style={s.resumo}>
          <Text style={s.rotulo}>TOTAL DISPONÍVEL</Text>
          <Text style={s.total} numberOfLines={1} adjustsFontSizeToFit>{real(disponivelTotal)}</Text>
        </View>
        <View style={s.cabLista}><Text style={s.tituloLista}>Meus cartões</Text></View>
        {cartoes.length ? cartoes.map(item => {
          const disponivel = Number(item.limite || 0);
          return (
            <Pressable key={item.id} style={s.cartaoCredito} onPress={() => editarCartao(item)}>
              <View style={s.cartaoCreditoTopo}>
                <Text style={s.cartaoCreditoNome}>{item.nome}</Text>
                <Text style={s.seta}>›</Text>
              </View>
              <Text style={s.cartaoCreditoDisponivel}>{real(disponivel)}</Text>
              <Text style={s.cartaoCreditoLegenda}>limite do cartão</Text>
            </Pressable>
          );
        }) : <Text style={s.vazioDesc}>Seus cartões cadastrados aparecerão aqui.</Text>}
      </ScrollView>
    );
  }

  function renderDashboard() {
    const chaveSelecionada = `${anoFiltroDashboard}-${String(mesFiltroDashboard + 1).padStart(2, "0")}`;
    const mesSalvo = historico.find(m => m.mesKey === chaveSelecionada);
    const ehMesAtual = chaveSelecionada === chaveMes();
    const listaReceitas = mesSalvo ? (mesSalvo.receitas || []) : (ehMesAtual ? receitas : []);
    const listaContas = mesSalvo ? (mesSalvo.contas || []) : (ehMesAtual ? contas : []);
    const entradas = soma(listaReceitas);
    const saidas = soma(listaContas);
    const saldo = entradas - saidas;
    const positivo = saldo >= 0;
    const maior = Math.max(entradas, saidas, 1);
    const topDespesas = [...listaContas].sort((a,b) => Number(b.valor||0)-Number(a.valor||0)).slice(0,5);
    const maxDespesa = Math.max(...topDespesas.map(i => Number(i.valor||0)), 1);
    const moeda = v => real(v);

    return (
      <ScrollView style={s.scroll} contentContainerStyle={s.conteudoHistorico} showsVerticalScrollIndicator={false}>
        <Text style={s.tituloLista}>Dashboard</Text>
        <Text style={s.subHistorico}>Veja como está sua vida financeira.</Text>
        {renderFiltroMesAno(mesFiltroDashboard, anoFiltroDashboard, setMesFiltroDashboard, setAnoFiltroDashboard)}

        <View style={{backgroundColor: positivo ? "#edf8ef" : "#fff0f0", borderRadius:18, padding:18, marginBottom:12, alignItems:"center", borderWidth:1, borderColor: positivo ? "#d7efdc" : "#f5dddd"}}>
          <Gatinho feliz={positivo} />
          <Text style={{fontSize:18, fontWeight:"800", color:"#171717", textAlign:"center"}}>{positivo ? "Você está indo bem!" : "Vamos com calma. Você consegue!"}</Text>
          <Text style={{fontSize:12, color:"#666", textAlign:"center", marginTop:6}}>{positivo ? "Seu saldo está positivo neste período. Continue acompanhando!" : "As despesas passaram das receitas. Veja os números e pense no que pode ajustar."}</Text>
        </View>

        <View style={{backgroundColor:"#111", borderRadius:16, padding:17, marginBottom:12}}>
          <Text style={{color:"#ccc", fontSize:11, fontWeight:"700"}}>SALDO DO MÊS</Text>
          <Text style={{color:"#fff", fontSize:27, fontWeight:"900", marginTop:5}}>{moeda(saldo)}</Text>
          <Text style={{color: positivo ? "#a8e6b4" : "#ffb5b5", fontSize:11, marginTop:5}}>{positivo ? "Receitas maiores que despesas" : "Despesas maiores que receitas"}</Text>
        </View>

        <View style={{flexDirection:"row", gap:9, marginBottom:12}}>
          <View style={{flex:1, backgroundColor:"#f1f8f2", borderRadius:13, padding:13}}><Text style={{fontSize:10,color:"#555"}}>RECEITAS</Text><Text style={{fontSize:16,fontWeight:"800",color:"#26743b",marginTop:6}}>{moeda(entradas)}</Text></View>
          <View style={{flex:1, backgroundColor:"#fff1f1", borderRadius:13, padding:13}}><Text style={{fontSize:10,color:"#555"}}>DESPESAS</Text><Text style={{fontSize:16,fontWeight:"800",color:"#b33",marginTop:6}}>{moeda(saidas)}</Text></View>
        </View>

        <View style={{backgroundColor:"#fff", borderWidth:1,borderColor:"#eee",borderRadius:15,padding:15,marginBottom:12}}>
          <Text style={{fontSize:14,fontWeight:"800",color:"#171717",marginBottom:14}}>Receitas x despesas</Text>
          {[{label:"Receitas",value:entradas,color:"#319653"},{label:"Despesas",value:saidas,color:"#d65a5a"}].map(item => (
            <View key={item.label} style={{marginBottom:12}}>
              <View style={{flexDirection:"row",justifyContent:"space-between",marginBottom:5}}><Text style={{fontSize:12,color:"#555"}}>{item.label}</Text><Text style={{fontSize:12,fontWeight:"700",color:"#222"}}>{moeda(item.value)}</Text></View>
              <View style={{height:12,backgroundColor:"#eee",borderRadius:10,overflow:"hidden"}}><View style={{height:12,width:`${Math.max(item.value / maior * 100, item.value ? 2 : 0)}%`,backgroundColor:item.color,borderRadius:10}} /></View>
            </View>
          ))}
        </View>

        <View style={{backgroundColor:"#fff",borderWidth:1,borderColor:"#eee",borderRadius:15,padding:15,marginBottom:12}}>
          <Text style={{fontSize:14,fontWeight:"800",color:"#171717",marginBottom:10}}>Maiores despesas</Text>
          {topDespesas.length ? topDespesas.map(item => (
            <View key={item.id} style={{marginBottom:11}}>
              <View style={{flexDirection:"row",justifyContent:"space-between",marginBottom:5}}><Text numberOfLines={1} style={{fontSize:12,color:"#444",flex:1,marginRight:8}}>{item.nome}</Text><Text style={{fontSize:12,fontWeight:"700",color:"#222"}}>{moeda(item.valor)}</Text></View>
              <View style={{height:8,backgroundColor:"#eee",borderRadius:8,overflow:"hidden"}}><View style={{height:8,width:`${Math.max(Number(item.valor||0)/maxDespesa*100,2)}%`,backgroundColor:"#777",borderRadius:8}} /></View>
            </View>
          )) : <Text style={s.semLancamento}>Ainda não há despesas neste período.</Text>}
        </View>
        <Text style={{fontSize:10,color:"#999",textAlign:"center",marginBottom:18}}>Indicador calculado com os lançamentos disponíveis no período selecionado.</Text>
      </ScrollView>
    );
  }

  if (!pronto) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.carregando}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#fff"
        translucent={false}
      />

      <View style={s.tela}>
        <View style={s.header}>
          <View style={s.marca}>
            <View style={s.carteira}>
              <View style={s.fenda} />
              <View style={s.fecho} />
            </View>
            <View style={s.moeda}>
              <Text style={s.cifrao}>$</Text>
            </View>
          </View>

          <Text style={s.logoTexto}>Meu{"\n"}Financeiro</Text>
        </View>

        <View style={s.navegacao}>
          <View style={s.navegacaoConteudo}>
            {ABAS.slice(0, 4).map((item, i) => (
              <Pressable key={item} style={[s.aba, aba === i && s.abaAtiva]} onPress={() => { setMenuAbas(false); navegar(i); }}>
                <Text style={[s.abaTexto, aba === i && s.abaTextoAtivo]}>{item}</Text>
              </Pressable>
            ))}
            <Pressable style={[s.aba, aba >= 4 && s.abaAtiva]} onPress={() => setMenuAbas(v => !v)}>
              <Text style={[s.abaTexto, aba >= 4 && s.abaTextoAtivo]}>Mais {menuAbas ? "⌃" : "⌄"}</Text>
            </Pressable>
          </View>
          {menuAbas && (
            <View style={s.menuAbas}>
              {ABAS.slice(4).map((item, i) => (
                <Pressable key={item} style={s.menuAbaItem} onPress={() => { setMenuAbas(false); navegar(i + 4); }}>
                  <Text style={[s.menuAbaTexto, aba === i + 4 && s.menuAbaTextoAtivo]}>{item}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View
          style={{ flex: 1 }}
          onLayout={e => {
            const largura = e.nativeEvent.layout.width;
            setLarguraPagina(largura);
          }}
        >
          {larguraPagina > 0 && (
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={aoDeslizar}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <View style={{ width: larguraPagina, flex: 1 }}>
                {renderLista("conta")}
              </View>

              <View style={{ width: larguraPagina, flex: 1 }}>
                {renderLista("receita")}
              </View>

              <View style={{ width: larguraPagina, flex: 1 }}>
                {renderResumo()}
              </View>

              <View style={{ width: larguraPagina, flex: 1 }}>
                {renderCartoes()}
              </View>

              <View style={{ width: larguraPagina, flex: 1 }}>
                {renderDashboard()}
              </View>

              <View style={{ width: larguraPagina, flex: 1 }}>
                {renderHistorico()}
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      <Modal
        visible={modal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={fechar}
      >
        <View style={s.fundo}>
          <Pressable style={StyleSheet.absoluteFill} onPress={fechar} />

          <KeyboardAvoidingView
            style={s.modalArea}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={s.modal}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.conteudoModal}
              >
                <View style={s.topModal}>
                  <View>
                    <Text style={s.modalTitulo}>
                      {idEdicao
                        ? `Editar ${tipoModal === "conta" ? "conta" : tipoModal === "receita" ? "receita" : "cartão"}`
                        : tipoModal === "conta" ? "Adicionar conta" : tipoModal === "receita" ? "Adicionar receita" : "Adicionar cartão"}
                    </Text>
                    <Text style={s.modalSub}>
                      Preencha os dados do lançamento
                    </Text>
                  </View>

                  {idEdicao ? (
                    <Pressable
                      style={s.tresPontos}
                      onPress={() => setMenu(x => !x)}
                    >
                      <Text style={s.tresTxt}>⋮</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={s.fechar} onPress={fechar}>
                      <Text style={s.fecharTxt}>×</Text>
                    </Pressable>
                  )}
                </View>

                {menu && (
                  <View style={s.menu}>
                    <Pressable onPress={excluir} style={s.menuItem}>
                      <Text style={s.excluirTxt}>
                        {tipoModal === "conta" ? "Excluir conta" : tipoModal === "receita" ? "Excluir receita" : "Excluir cartão"}
                      </Text>
                    </Pressable>
                  </View>
                )}

                <Text style={s.label}>
                  {tipoModal === "conta" ? "Nome da conta" : tipoModal === "receita" ? "Nome da receita" : "Nome do cartão"}
                </Text>
                <TextInput
                  style={s.input}
                  value={nome}
                  onChangeText={setNome}
                  placeholder={
                    tipoModal === "conta"
                      ? "Ex.: Conta de luz"
                      : tipoModal === "receita" ? "Ex.: Salário" : "Cartão 1"
                  }
                  placeholderTextColor="#999"
                  maxLength={70}
                  returnKeyType="next"
                />

                <Text style={s.label}>{tipoModal === "cartao" ? "Limite do cartão" : "Valor"}</Text>
                <View style={s.valorInput}>
                  <Text style={s.prefixo}>R$</Text>
                  <TextInput
                    style={s.inputValor}
                    value={formatInput(valor)}
                    onChangeText={t => setValor(t.replace(/\D/g, "").slice(0, 12))}
                    keyboardType="number-pad"
                    placeholder="0,00"
                    placeholderTextColor="#999"
                  />
                </View>


                <Pressable style={s.salvar} onPress={salvar}>
                  <Text style={s.salvarTxt}>
                    {idEdicao ? "Salvar alterações" : "Adicionar"}
                  </Text>
                </Pressable>

                <Pressable style={s.cancelar} onPress={fechar}>
                  <Text style={s.cancelarTxt}>Cancelar</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Gatinho({ feliz }) {
  return (
    <View style={{ width: 92, height: 88, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
      <View style={{ position: "absolute", top: 5, left: 12, width: 27, height: 27, backgroundColor: "#171717", transform: [{ rotate: "-28deg" }], borderTopLeftRadius: 5, borderTopRightRadius: 18 }} />
      <View style={{ position: "absolute", top: 5, right: 12, width: 27, height: 27, backgroundColor: "#171717", transform: [{ rotate: "28deg" }], borderTopLeftRadius: 18, borderTopRightRadius: 5 }} />
      <View style={{ width: 76, height: 68, borderRadius: 35, backgroundColor: "#fff", borderWidth: 3, borderColor: "#171717", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <View style={{ position: "absolute", top: -7, left: 0, width: 34, height: 37, backgroundColor: "#171717", borderBottomRightRadius: 25 }} />
        <View style={{ position: "absolute", top: -8, right: 0, width: 25, height: 31, backgroundColor: "#171717", borderBottomLeftRadius: 20 }} />
        <View style={{ flexDirection: "row", width: 43, justifyContent: "space-between", marginTop: 8 }}>
          <View style={{ width: 6, height: feliz ? 8 : 5, borderRadius: 5, backgroundColor: "#171717" }} />
          <View style={{ width: 6, height: feliz ? 8 : 5, borderRadius: 5, backgroundColor: "#171717" }} />
        </View>
        <View style={{ width: 8, height: 6, backgroundColor: "#171717", borderRadius: 5, marginTop: 5 }} />
        <View style={{ width: 17, height: 8, borderBottomWidth: 2, borderColor: "#171717", borderRadius: 10, marginTop: -1 }} />
        {!feliz ? <View style={{ position: "absolute", right: 13, top: 37, width: 5, height: 12, borderRadius: 5, backgroundColor: "#8bb9e8" }} /> : null}
        <View style={{ position: "absolute", bottom: 7, left: 7, width: 10, height: 5, borderRadius: 8, backgroundColor: "#171717" }} />
      </View>
      <View style={{ position: "absolute", bottom: 0, width: 44, height: 12, borderRadius: 8, backgroundColor: "#171717", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 24, height: 5, borderRadius: 5, backgroundColor: "#fff" }} />
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Financeiro />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff"
  },

  carregando: {
    flex: 1,
    textAlign: "center",
    textAlignVertical: "center",
    color: "#555"
  },

  tela: {
    flex: 1,
    paddingHorizontal: 18,
    backgroundColor: "#fff"
  },
  header: {
    height: 105,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 3,
    paddingBottom: 5,
    gap: 12
  },

  marca: {
    width: 82,
    height: 76,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    position: "relative"
  },

  carteira: {
    width: 72,
    height: 57,
    backgroundColor: "#111",
    borderRadius: 11,
    position: "absolute",
    bottom: 0,
    left: 0,
    justifyContent: "center"
  },
  fenda: {
    height: 3,
    width: 22,
    backgroundColor: "#fff",
    position: "absolute",
    top: 6,
    left: 12,
    borderRadius: 3
  },

  fecho: {
    width: 19,
    height: 13,
    borderRadius: 7,
    borderWidth: 4,
    borderColor: "#fff",
    position: "absolute",
    right: -2,
    top: 25
  },

  moeda: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: "#111",
    borderWidth: 3,
    borderColor: "#fff",
    position: "absolute",
    top: 0,
    right: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  cifrao: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900"
  },

  logoTexto: {
    fontSize: 27,
    lineHeight: 28,
    fontWeight: "900",
    color: "#111",
    letterSpacing: -0.8
  },

  navegacao: {
    height: 52,
    borderWidth: 1.3,
    borderColor: "#dedede",
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    marginBottom: 8
  },
  navegacaoConteudo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1
  },
  menuAbas: {
    position: "absolute",
    zIndex: 20,
    right: 4,
    top: 50,
    minWidth: 145,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 14,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }
  },
  menuAbaItem: { paddingHorizontal: 16, paddingVertical: 13 },
  menuAbaTexto: { color: "#222", fontSize: 14, fontWeight: "600" },
  menuAbaTextoAtivo: { fontWeight: "900", color: "#000" },

  aba: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 3,
    height: 42,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center"
  },
  abaAtiva: {
    backgroundColor: "#111"
  },

  abaTexto: {
    color: "#777",
    fontSize: 11,
    fontWeight: "700"
  },

  abaTextoAtivo: {
    color: "#fff"
  },

  scroll: {
    flex: 1
  },

  conteudo: {
    paddingBottom: 8
  },

  adicionar: {
    alignItems: "center",
    paddingTop: 5,
    paddingBottom: 10
  },
  maisCirculo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center"
  },

  maisTxt: {
    color: "#fff",
    fontSize: 43,
    lineHeight: 50,
    fontWeight: "300",
    marginTop: -3
  },

  adicionarTexto: {
    color: "#666",
    fontSize: 15,
    marginTop: 5
  },

  resumo: {
    backgroundColor: "#111",
    borderRadius: 20,
    minHeight: 112,
    alignItems: "center",
    justifyContent: "center",
    padding: 12
  },
  rotulo: {
    color: "#c8c8c8",
    fontSize: 13,
    fontWeight: "500"
  },

  total: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
    marginTop: 7
  },

  cabLista: {
    marginTop: 18,
    marginBottom: 7,
    paddingLeft: 5
  },

  tituloLista: {
    fontSize: 23,
    fontWeight: "800",
    color: "#171717"
  },

  lista: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 15,
    paddingHorizontal: 12
  },
  linha: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center"
  },

  nomeConta: {
    color: "#202020",
    fontSize: 14,
    fontWeight: "700"
  },

  valorConta: {
    color: "#202020",
    fontSize: 13,
    fontWeight: "700"
  },

  seta: {
    color: "#aaa",
    fontSize: 23,
    marginLeft: 8
  },

  separador: {
    height: 1,
    backgroundColor: "#eee"
  },

  vazioDesc: {
    color: "#888",
    fontSize: 15,
    marginLeft: 5,
    marginBottom: 12
  },
  finalizar: {
    minHeight: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10
  },

  finalizarTxt: {
    color: "#555",
    fontSize: 13,
    fontWeight: "700"
  },

  fundo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.45)"
  },

  modalArea: {
    flex: 1,
    justifyContent: "flex-end"
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: "90%",
    paddingHorizontal: 23,
    paddingTop: 25,
    paddingBottom: Platform.OS === "ios" ? 34 : 24
  },

  conteudoModal: {
    paddingBottom: 8
  },

  topModal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22
  },

  modalTitulo: {
    color: "#111",
    fontSize: 21,
    fontWeight: "800"
  },

  modalSub: {
    color: "#888",
    fontSize: 12,
    marginTop: 4
  },
  fechar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f1f1",
    alignItems: "center",
    justifyContent: "center"
  },

  fecharTxt: {
    color: "#555",
    fontSize: 25
  },

  tresPontos: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f1f1f1",
    alignItems: "center",
    justifyContent: "center"
  },

  tresTxt: {
    color: "#333",
    fontSize: 25,
    fontWeight: "700"
  },
  menu: {
    alignSelf: "flex-end",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eee",
    marginTop: -14,
    marginBottom: 12,
    backgroundColor: "#fff",
    minWidth: 150,
    elevation: 3
  },

  menuItem: {
    paddingHorizontal: 15,
    paddingVertical: 12
  },

  excluirTxt: {
    color: "#b3261e",
    fontSize: 14,
    fontWeight: "600"
  },

  label: {
    color: "#333",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 13,
    paddingHorizontal: 14,
    color: "#171717",
    fontSize: 15,
    marginBottom: 17
  },

  valorInput: {
    height: 52,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 17
  },

  prefixo: {
    color: "#777",
    fontSize: 15,
    fontWeight: "700",
    marginRight: 9
  },

  inputValor: {
    flex: 1,
    color: "#171717",
    fontSize: 17,
    paddingVertical: 0
  },
  salvar: {
    backgroundColor: "#111",
    height: 52,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },

  salvarTxt: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700"
  },

  cancelar: {
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5
  },

  cancelarTxt: {
    color: "#777",
    fontSize: 14,
    fontWeight: "600"
  },

  resumoCartoes: {
    flexDirection: "row",
    gap: 9,
    marginTop: 10
  },
  miniResumo: {
    flex: 1,
    backgroundColor: "#f2f2f2",
    borderRadius: 13,
    padding: 12
  },
  miniRotulo: {
    color: "#777",
    fontSize: 10,
    fontWeight: "800"
  },
  miniValor: {
    color: "#222",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 6
  },
  cartaoCredito: {
    borderRadius: 17,
    backgroundColor: "#111",
    padding: 17,
    marginBottom: 12
  },
  cartaoCreditoTopo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cartaoCreditoNome: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800"
  },
  cartaoCreditoDisponivel: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 18
  },
  cartaoCreditoLegenda: {
    color: "#c9c9c9",
    fontSize: 11,
    marginTop: 4
  },
  trilho: {
    height: 6,
    borderRadius: 5,
    backgroundColor: "#555",
    overflow: "hidden",
    marginTop: 12
  },
  progresso: {
    height: 6,
    borderRadius: 5,
    backgroundColor: "#fff"
  },

  filtroMesAno: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  filtroCampo: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e7e7e7",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filtroLegenda: {
    color: "#888",
    fontSize: 9,
    fontWeight: "800",
    marginBottom: 4,
  },
  filtroControle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filtroSeta: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  filtroSetaTexto: { color: "#111", fontSize: 25, lineHeight: 27 },
  filtroValor: { color: "#111", fontSize: 13, fontWeight: "700" },

  conteudoHistorico: {
    paddingTop: 12,
    paddingBottom: 20
  },
  subHistorico: {
    color: "#888",
    fontSize: 13,
    marginTop: 5,
    marginBottom: 18
  },

  cartaoMes: {
    borderWidth: 1,
    borderColor: "#e8e8e8",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    backgroundColor: "#fff"
  },

  topMes: {
    minHeight: 94,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center"
  },

  nomeMes: {
    color: "#171717",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6
  },
  resumoMes: {
    color: "#777",
    fontSize: 12,
    marginTop: 2
  },

  setaMes: {
    color: "#555",
    fontSize: 25,
    marginLeft: 10
  },

  detalheMes: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    padding: 15
  },

  saldoBox: {
    backgroundColor: "#111",
    borderRadius: 13,
    padding: 15,
    marginBottom: 18
  },

  rotuloSaldo: {
    color: "#ccc",
    fontSize: 11,
    fontWeight: "700"
  },
  valorSaldo: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 5
  },

  subtituloHistorico: {
    color: "#222",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 4
  },

  linhaHistorico: {
    minHeight: 38,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },

  nomeHistorico: {
    color: "#555",
    fontSize: 13,
    flex: 1
  },

  valorHistorico: {
    color: "#222",
    fontSize: 13,
    fontWeight: "700"
  },
  semLancamento: {
    color: "#999",
    fontSize: 12,
    marginBottom: 10
  },

  resumoPagamentos: {
    flexDirection: "row",
    gap: 9,
    marginTop: -7,
    marginBottom: 17
  },
  cardPagamentoPago: {
    flex: 1,
    backgroundColor: "#edf7ef",
    borderRadius: 12,
    padding: 12
  },
  cardPagamentoPendente: {
    flex: 1,
    backgroundColor: "#f3f3f3",
    borderRadius: 12,
    padding: 12
  },
  rotuloPagamento: {
    color: "#666",
    fontSize: 9,
    fontWeight: "800"
  },
  valorPagamento: {
    color: "#222",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 6
  },
  conteudoLinhaHistorico: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  linhaHistoricoPaga: {
    backgroundColor: "#edf7ef",
    borderRadius: 9,
    paddingHorizontal: 8,
    marginVertical: 3
  },
  textoPago: {
    color: "#28743b"
  },
  botaoPagamento: {
    minWidth: 62,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center"
  },
  botaoPagamentoAtivo: {
    backgroundColor: "#d8efdd"
  },
  textoBotaoPagamento: {
    color: "#555",
    fontSize: 11,
    fontWeight: "800"
  },
  textoBotaoPagamentoAtivo: {
    color: "#28743b"
  },

  separadorHistorico: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 13
  }
});
