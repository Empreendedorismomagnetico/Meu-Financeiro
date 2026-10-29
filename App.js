
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, FlatList, Keyboard, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@meu_financeiro_v1";
const ABAS = ["Contas", "Receitas", "Dashboard", "Histórico"];

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
  const [pronto, setPronto] = useState(false);

  const [aba, setAba] = useState(0);
  const [larguraPagina, setLarguraPagina] = useState(0);
  const pagerRef = useRef(null);

  const [modal, setModal] = useState(false);
  const [tipoModal, setTipoModal] = useState("conta");
  const [idEdicao, setIdEdicao] = useState(null);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [menu, setMenu] = useState(false);

  const [mesExpandido, setMesExpandido] = useState(null);

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
        JSON.stringify({ contas, receitas, historico })
      ).catch(() => Alert.alert("Erro", "Não foi possível salvar os dados."));
    }
  }, [contas, receitas, historico, pronto]);

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
    setTipoModal(tipo);
    setIdEdicao(null);
    setNome("");
    setValor("");
    setMenu(false);
    setModal(true);
  }

  function editar(item, tipo) {
    setTipoModal(tipo);
    setIdEdicao(item.id);
    setNome(item.nome);
    setValor(String(item.valor));
    setMenu(false);
    setModal(true);
  }

  function fechar() {
    Keyboard.dismiss();
    setModal(false);
    setMenu(false);
  }

  function salvar() {
    const n = nome.trim();
    const v = cents(valor);
    const ehConta = tipoModal === "conta";
    const atualizar = ehConta ? setContas : setReceitas;

    if (!n) {
      return Alert.alert("Falta o nome", "Digite um nome para o lançamento.");
    }

    if (v <= 0) {
      return Alert.alert("Valor inválido", "Informe um valor maior que zero.");
    }

    if (idEdicao) {
      atualizar(lista => lista.map(item =>
        item.id === idEdicao
          ? { id: item.id, nome: n, valor: v }
          : item
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

    const ehConta = tipoModal === "conta";
    const atualizar = ehConta ? setContas : setReceitas;
    const nomeTipo = ehConta ? "conta" : "receita";

    Alert.alert(
      `Excluir ${nomeTipo}?`,
      "Esse lançamento será removido da lista atual.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            atualizar(lista => lista.filter(item => item.id !== idEdicao));
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

  function renderHistorico() {
    return (
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.conteudoHistorico}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.tituloLista}>Histórico mensal</Text>
        <Text style={s.subHistorico}>
          Consulte suas receitas e contas finalizadas.
        </Text>

        {historico.length === 0 ? (
          <Text style={s.vazioDesc}>
            Seus meses finalizados aparecerão aqui.
          </Text>
        ) : (
          historico.map(mes => {
            const totalEntrada = soma(mes.receitas);
            const totalSaida = soma(mes.contas);
            const saldo = totalEntrada - totalSaida;
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

                    <Text style={s.subtituloHistorico}>Receitas</Text>
                    {mes.receitas?.length ? (
                      mes.receitas.map(item => (
                        <View style={s.linhaHistorico} key={item.id}>
                          <Text style={s.nomeHistorico}>{item.nome}</Text>
                          <Text style={s.valorHistorico}>{real(item.valor)}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={s.semLancamento}>Nenhuma receita finalizada.</Text>
                    )}

                    <View style={s.separadorHistorico} />

                    <Text style={s.subtituloHistorico}>Contas e despesas</Text>
                    {mes.contas?.length ? (
                      mes.contas.map(item => (
                        <View style={s.linhaHistorico} key={item.id}>
                          <Text style={s.nomeHistorico}>{item.nome}</Text>
                          <Text style={s.valorHistorico}>{real(item.valor)}</Text>
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

  function renderDashboard() {
    return (
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.conteudo}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.tituloLista}>Dashboard</Text>
        <Text style={s.subHistorico}>
          Sua visão geral financeira ficará disponível aqui.
        </Text>
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
          {ABAS.map((item, i) => (
            <Pressable
              key={item}
              style={[s.aba, aba === i && s.abaAtiva]}
              onPress={() => navegar(i)}
            >
              <Text style={[s.abaTexto, aba === i && s.abaTextoAtivo]}>
                {item}
              </Text>
            </Pressable>
          ))}
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
                        ? `Editar ${tipoModal === "conta" ? "conta" : "receita"}`
                        : tipoModal === "conta" ? "Adicionar conta" : "Adicionar receita"}
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
                        {tipoModal === "conta" ? "Excluir conta" : "Excluir receita"}
                      </Text>
                    </Pressable>
                  </View>
                )}

                <Text style={s.label}>
                  {tipoModal === "conta" ? "Nome da conta" : "Nome da receita"}
                </Text>
                <TextInput
                  style={s.input}
                  value={nome}
                  onChangeText={setNome}
                  placeholder={
                    tipoModal === "conta"
                      ? "Ex.: Conta de luz"
                      : "Ex.: Salário"
                  }
                  placeholderTextColor="#999"
                  maxLength={70}
                  returnKeyType="next"
                />

                <Text style={s.label}>Valor</Text>
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

  aba: {
    flex: 1,
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

  separadorHistorico: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 13
  }
});
