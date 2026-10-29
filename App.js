
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput,
  TouchableWithoutFeedback, View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@meu_financeiro_v1";

const hoje = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
};

const cents = v => Number(String(v || "").replace(/\D/g,"") || 0);

const formatInput = v => (Number(v || 0)/100).toLocaleString("pt-BR",{
  minimumFractionDigits:2,
  maximumFractionDigits:2
});

const real = v => (Number(v || 0)/100).toLocaleString("pt-BR",{
  style:"currency",
  currency:"BRL"
});

const dataValida = v => {
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if(!m)return false;
  const d=new Date(+m[3],+m[2]-1,+m[1]);
  return d.getFullYear()===+m[3] &&
    d.getMonth()===+m[2]-1 &&
    d.getDate()===+m[1];
};

function Financeiro() {
  const [contas,setContas]=useState([]);
  const [historico,setHistorico]=useState([]);
  const [pronto,setPronto]=useState(false);
  const [modal,setModal]=useState(false);
  const [idEdicao,setIdEdicao]=useState(null);
  const [nome,setNome]=useState("");
  const [valor,setValor]=useState("");
  const [data,setData]=useState(hoje());
  const [menu,setMenu]=useState(false);

  const total=useMemo(
    ()=>contas.reduce((s,c)=>s+Number(c.valor||0),0),
    [contas]
  );

  useEffect(()=>{
    (async()=>{
      try {
        const s=await AsyncStorage.getItem(KEY);
        if(s){
          const p=JSON.parse(s);
          setContas(Array.isArray(p.contas)?p.contas:[]);
          setHistorico(Array.isArray(p.historico)?p.historico:[]);
        }
      } catch(e) {
        Alert.alert("Aviso","Não foi possível carregar os dados salvos.");
      } finally {
        setPronto(true);
      }
    })();
  },[]);

  useEffect(()=>{
    if(pronto) {
      AsyncStorage.setItem(KEY,JSON.stringify({contas,historico}))
        .catch(()=>Alert.alert("Erro","Não foi possível salvar os dados."));
    }
  },[contas,historico,pronto]);

  function novo(){
    setIdEdicao(null);
    setNome("");
    setValor("");
    setData(hoje());
    setMenu(false);
    setModal(true);
  }

  function editar(c){
    setIdEdicao(c.id);
    setNome(c.nome);
    setValor(String(c.valor));
    setData(c.data);
    setMenu(false);
    setModal(true);
  }

  function fechar(){
    Keyboard.dismiss();
    setModal(false);
    setMenu(false);
  }

  function salvar(){
    const n=nome.trim(),v=cents(valor);

    if(!n)return Alert.alert("Falta o nome","Digite o nome da conta.");
    if(v<=0)return Alert.alert("Valor inválido","Informe um valor maior que zero.");
    if(!dataValida(data))return Alert.alert("Data inválida","Use o formato DD/MM/AAAA.");

    if(idEdicao) {
      setContas(xs=>xs.map(c=>
        c.id===idEdicao?{...c,nome:n,valor:v,data}:c
      ));
    } else {
      setContas(xs=>[
        {id:`${Date.now()}-${Math.random()}`,nome:n,valor:v,data},
        ...xs
      ]);
    }

    fechar();
  }

  function excluir(){
    setMenu(false);

    Alert.alert(
      "Excluir conta?",
      "Essa conta será removida da lista atual.",
      [
        {text:"Cancelar",style:"cancel"},
        {
          text:"Excluir",
          style:"destructive",
          onPress:()=>{
            setContas(xs=>xs.filter(c=>c.id!==idEdicao));
            fechar();
          }
        }
      ]
    );
  }

  function finalizar(){
    if(!contas.length) {
      return Alert.alert(
        "Lista vazia",
        "Adicione pelo menos uma conta antes de finalizar."
      );
    }

    Alert.alert(
      "Finalizar lista?",
      "As contas sairão da tela principal, mas ficarão salvas para o futuro Histórico.",
      [
        {text:"Voltar",style:"cancel"},
        {
          text:"Finalizar",
          onPress:()=>{
            setHistorico(xs=>[
              {
                id:String(Date.now()),
                dataFinalizacao:hoje(),
                finalizadaEm:new Date().toISOString(),
                total,
                contas
              },
              ...xs
            ]);
            setContas([]);
          }
        }
      ]
    );
  }

  const linha=({item})=>(
    <Pressable style={s.linha} onPress={()=>editar(item)}>
      <View style={{flex:1}}>
        <Text style={s.nomeConta}>{item.nome}</Text>
        <Text style={s.dataConta}>{item.data}</Text>
      </View>
      <Text style={s.valorConta}>{real(item.valor)}</Text>
      <Text style={s.seta}>›</Text>
    </Pressable>
  );

  if(!pronto) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.carregando}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top","bottom"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#fff"
        translucent={false}
      />

      <View style={s.tela}>
        <View style={s.header}>
          <View style={s.marca}>
            <View style={s.carteira}>
              <View style={s.fenda}/>
              <View style={s.fecho}/>
            </View>
            <View style={s.moeda}>
              <Text style={s.cifrao}>$</Text>
            </View>
          </View>

          <Text style={s.logoTexto}>Meu{"\n"}Financeiro</Text>
        </View>

        <View style={s.navegacao}>
          {["Contas","Receita","Dashboard","Histórico"].map((item,i)=>(
            <View key={item} style={[s.aba,i===0&&s.abaAtiva]}>
              <Text style={[s.abaTexto,i===0&&s.abaTextoAtivo]}>
                {item}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.conteudo}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={s.adicionar} onPress={novo}>
            <View style={s.maisCirculo}>
              <Text style={s.maisTxt}>＋</Text>
            </View>
            <Text style={s.adicionarTexto}>Adicionar conta</Text>
          </Pressable>

          <View style={s.resumo}>
            <Text style={s.rotulo}>TOTAL DAS CONTAS</Text>
            <Text style={s.total} numberOfLines={1} adjustsFontSizeToFit>
              {real(total)}
            </Text>
          </View>

          <View style={s.cabLista}>
            <Text style={s.tituloLista}>Minhas contas</Text>
          </View>

          {contas.length>0
            ? (
              <View style={s.lista}>
                <FlatList
                  data={contas}
                  renderItem={linha}
                  keyExtractor={c=>c.id}
                  scrollEnabled={false}
                  ItemSeparatorComponent={()=><View style={s.separador}/>}
                />
              </View>
            )
            : (
              <Text style={s.vazioDesc}>
                As contas adicionadas aparecerão aqui.
              </Text>
            )
          }

          {contas.length>0&&(
            <Pressable style={s.finalizar} onPress={finalizar}>
              <Text style={s.finalizarTxt}>Finalizar lista</Text>
            </Pressable>
          )}

          <View style={{height:12}}/>
        </ScrollView>
      </View>

      <Modal
        visible={modal}
        transparent
        animationType="slide"
        onRequestClose={fechar}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={s.fundo}>
            <KeyboardAvoidingView
              behavior={Platform.OS==="ios"?"padding":"height"}
            >
              <TouchableWithoutFeedback>
                <View style={s.modal}>
                  <View style={s.topModal}>
                    <View>
                      <Text style={s.modalTitulo}>
                        {idEdicao?"Editar conta":"Adicionar conta"}
                      </Text>
                      <Text style={s.modalSub}>
                        Preencha os dados da conta
                      </Text>
                    </View>

                    {idEdicao
                      ? (
                        <Pressable
                          style={s.tresPontos}
                          onPress={()=>setMenu(x=>!x)}
                        >
                          <Text style={s.tresTxt}>⋮</Text>
                        </Pressable>
                      )
                      : (
                        <Pressable style={s.fechar} onPress={fechar}>
                          <Text style={s.fecharTxt}>×</Text>
                        </Pressable>
                      )
                    }
                  </View>

                  {menu&&(
                    <View style={s.menu}>
                      <Pressable onPress={excluir} style={s.menuItem}>
                        <Text style={s.excluirTxt}>Excluir conta</Text>
                      </Pressable>
                    </View>
                  )}

                  <Text style={s.label}>Nome da conta</Text>
                  <TextInput
                    style={s.input}
                    value={nome}
                    onChangeText={setNome}
                    placeholder="Ex.: Conta de luz"
                    placeholderTextColor="#999"
                    maxLength={70}
                  />

                  <Text style={s.label}>Valor</Text>
                  <View style={s.valorInput}>
                    <Text style={s.prefixo}>R$</Text>
                    <TextInput
                      style={s.inputValor}
                      value={formatInput(valor)}
                      onChangeText={t=>setValor(t.replace(/\D/g,"").slice(0,12))}
                      keyboardType="number-pad"
                      placeholder="0,00"
                      placeholderTextColor="#999"
                    />
                  </View>

                  <Text style={s.label}>Data</Text>
                  <TextInput
                    style={s.input}
                    value={data}
                    onChangeText={t=>setData(t.replace(/[^\d/]/g,"").slice(0,10))}
                    keyboardType="numeric"
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#999"
                    maxLength={10}
                  />

                  <Pressable style={s.salvar} onPress={salvar}>
                    <Text style={s.salvarTxt}>
                      {idEdicao?"Salvar alterações":"Adicionar conta"}
                    </Text>
                  </Pressable>

                  <Pressable style={s.cancelar} onPress={fechar}>
                    <Text style={s.cancelarTxt}>Cancelar</Text>
                  </Pressable>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

export default function App(){
  return (
    <SafeAreaProvider>
      <Financeiro/>
    </SafeAreaProvider>
  );
}

const s=StyleSheet.create({
  safe:{
    flex:1,
    backgroundColor:"#fff"
  },

  carregando:{
    flex:1,
    textAlign:"center",
    textAlignVertical:"center",
    color:"#555"
  },

  tela:{
    flex:1,
    paddingHorizontal:18,
    backgroundColor:"#fff"
  },

  header:{
    height:105,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"center",
    paddingTop:3,
    paddingBottom:5,
    gap:12
  },

  marca:{
    width:82,
    height:76,
    justifyContent:"flex-end",
    alignItems:"flex-start",
    position:"relative"
  },

  carteira:{
    width:72,
    height:57,
    backgroundColor:"#111",
    borderRadius:11,
    position:"absolute",
    bottom:0,
    left:0,
    justifyContent:"center"
  },

  fenda:{
    height:3,
    width:22,
    backgroundColor:"#fff",
    position:"absolute",
    top:6,
    left:12,
    borderRadius:3
  },

  fecho:{
    width:19,
    height:13,
    borderRadius:7,
    borderWidth:4,
    borderColor:"#fff",
    position:"absolute",
    right:-2,
    top:25
  },

  moeda:{
    width:39,
    height:39,
    borderRadius:20,
    backgroundColor:"#111",
    borderWidth:3,
    borderColor:"#fff",
    position:"absolute",
    top:0,
    right:6,
    alignItems:"center",
    justifyContent:"center"
  },

  cifrao:{
    color:"#fff",
    fontSize:22,
    fontWeight:"900"
  },

  logoTexto:{
    fontSize:27,
    lineHeight:28,
    fontWeight:"900",
    color:"#111",
    letterSpacing:-0.8
  },

  navegacao:{
    height:52,
    borderWidth:1.3,
    borderColor:"#dedede",
    borderRadius:30,
    flexDirection:"row",
    alignItems:"center",
    padding:4,
    marginBottom:8
  },

  aba:{
    flex:1,
    height:42,
    borderRadius:25,
    alignItems:"center",
    justifyContent:"center"
  },

  abaAtiva:{
    backgroundColor:"#111"
  },

  abaTexto:{
    color:"#777",
    fontSize:12,
    fontWeight:"700"
  },

  abaTextoAtivo:{
    color:"#fff"
  },

  scroll:{
    flex:1
  },

  conteudo:{
    paddingBottom:8
  },

  adicionar:{
    alignItems:"center",
    paddingTop:5,
    paddingBottom:10
  },

  maisCirculo:{
    width:68,
    height:68,
    borderRadius:34,
    backgroundColor:"#111",
    alignItems:"center",
    justifyContent:"center"
  },

  maisTxt:{
    color:"#fff",
    fontSize:43,
    lineHeight:50,
    fontWeight:"300",
    marginTop:-3
  },

  adicionarTexto:{
    color:"#666",
    fontSize:15,
    marginTop:5
  },

  resumo:{
    backgroundColor:"#111",
    borderRadius:20,
    minHeight:112,
    alignItems:"center",
    justifyContent:"center",
    padding:12
  },

  rotulo:{
    color:"#c8c8c8",
    fontSize:13,
    fontWeight:"500"
  },

  total:{
    color:"#fff",
    fontSize:32,
    fontWeight:"800",
    marginTop:7
  },

  cabLista:{
    marginTop:18,
    marginBottom:7,
    paddingLeft:5
  },

  tituloLista:{
    fontSize:23,
    fontWeight:"800",
    color:"#171717"
  },

  lista:{
    borderWidth:1,
    borderColor:"#eee",
    borderRadius:15,
    paddingHorizontal:12
  },

  linha:{
    minHeight:56,
    flexDirection:"row",
    alignItems:"center"
  },

  nomeConta:{
    color:"#202020",
    fontSize:14,
    fontWeight:"700"
  },

  dataConta:{
    color:"#929292",
    fontSize:11,
    marginTop:3
  },

  valorConta:{
    color:"#202020",
    fontSize:13,
    fontWeight:"700"
  },

  seta:{
    color:"#aaa",
    fontSize:23,
    marginLeft:8
  },

  separador:{
    height:1,
    backgroundColor:"#eee"
  },

  vazioDesc:{
    color:"#888",
    fontSize:15,
    marginLeft:5,
    marginBottom:12
  },

  finalizar:{
    minHeight:42,
    borderRadius:13,
    borderWidth:1,
    borderColor:"#ddd",
    alignItems:"center",
    justifyContent:"center",
    marginTop:10
  },

  finalizarTxt:{
    color:"#555",
    fontSize:13,
    fontWeight:"700"
  },

  fundo:{
    flex:1,
    backgroundColor:"rgba(0,0,0,.45)",
    justifyContent:"flex-end"
  },

  modal:{
    backgroundColor:"#fff",
    borderTopLeftRadius:25,
    borderTopRightRadius:25,
    paddingHorizontal:23,
    paddingTop:25,
    paddingBottom:Platform.OS==="ios"?34:24
  },

  topModal:{
    flexDirection:"row",
    justifyContent:"space-between",
    alignItems:"center",
    marginBottom:22
  },

  modalTitulo:{
    color:"#111",
    fontSize:21,
    fontWeight:"800"
  },

  modalSub:{
    color:"#888",
    fontSize:12,
    marginTop:4
  },

  fechar:{
    width:36,
    height:36,
    borderRadius:18,
    backgroundColor:"#f1f1f1",
    alignItems:"center",
    justifyContent:"center"
  },

  fecharTxt:{
    color:"#555",
    fontSize:25
  },

  tresPontos:{
    width:38,
    height:38,
    borderRadius:19,
    backgroundColor:"#f1f1f1",
    alignItems:"center",
    justifyContent:"center"
  },

  tresTxt:{
    color:"#333",
    fontSize:25,
    fontWeight:"700"
  },

  menu:{
    alignSelf:"flex-end",
    borderRadius:10,
    borderWidth:1,
    borderColor:"#eee",
    marginTop:-14,
    marginBottom:12,
    backgroundColor:"#fff",
    minWidth:150,
    elevation:3
  },

  menuItem:{
    paddingHorizontal:15,
    paddingVertical:12
  },

  excluirTxt:{
    color:"#b3261e",
    fontSize:14,
    fontWeight:"600"
  },

  label:{
    color:"#333",
    fontSize:13,
    fontWeight:"700",
    marginBottom:8,
    marginTop:4
  },

  input:{
    height:50,
    borderWidth:1,
    borderColor:"#e5e5e5",
    borderRadius:13,
    paddingHorizontal:14,
    color:"#171717",
    fontSize:15,
    marginBottom:17
  },

  valorInput:{
    height:52,
    borderWidth:1,
    borderColor:"#e5e5e5",
    borderRadius:13,
    flexDirection:"row",
    alignItems:"center",
    paddingHorizontal:14,
    marginBottom:17
  },

  prefixo:{
    color:"#777",
    fontSize:15,
    fontWeight:"700",
    marginRight:9
  },

  inputValor:{
    flex:1,
    color:"#171717",
    fontSize:17,
    paddingVertical:0
  },

  salvar:{
    backgroundColor:"#111",
    height:52,
    borderRadius:15,
    alignItems:"center",
    justifyContent:"center",
    marginTop:4
  },

  salvarTxt:{
    color:"#fff",
    fontSize:15,
    fontWeight:"700"
  },

  cancelar:{
    height:43,
    alignItems:"center",
    justifyContent:"center",
    marginTop:5
  },

  cancelarTxt:{
    color:"#777",
    fontSize:14,
    fontWeight:"600"
  }
});
