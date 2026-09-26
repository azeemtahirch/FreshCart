import React,{useEffect,useState} from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { Button, Card, Header, Input, SectionTitle } from "../components/UI";
import { screen, pad } from "../utils/screenHelpers";

function Picker({label,value,items,onSelect,placeholder="Select"}) {
 const [open,setOpen]=useState(false);
 return <View style={{marginBottom:10}}><Text style={s.label}>{label}</Text><Pressable style={s.picker} onPress={()=>setOpen(true)}><Text style={value?s.value:s.placeholder}>{value||placeholder}</Text><Text style={s.chev}>⌄</Text></Pressable>
 <Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}><Pressable style={s.overlay} onPress={()=>setOpen(false)}><View style={s.modal}><Text style={s.modalTitle}>{label}</Text><ScrollView>{items.map(x=><Pressable key={x.id} style={s.option} onPress={()=>{onSelect(x);setOpen(false)}}><Text style={s.optionText}>{x.name}</Text></Pressable>)}</ScrollView></View></Pressable></Modal></View>
}
export function AdminShippingAreasScreen({navigation}) {
 const [cities,setCities]=useState([]),[areas,setAreas]=useState([]),[city,setCity]=useState(null),[cityName,setCityName]=useState(""),[areaName,setAreaName]=useState("");
 const load=async()=>{try{const [c,a]=await Promise.all([api.get("/admin/shipping-cities"),api.get("/admin/shipping-areas")]);setCities(c.data||[]);setAreas(a.data||[])}catch(e){Alert.alert("Delivery areas",apiError(e))}};
 useEffect(()=>{load()},[]);
 const addCity=async()=>{if(!cityName.trim())return Alert.alert("City","Enter city name.");try{await api.post("/admin/shipping-cities",{name:cityName.trim()});setCityName("");load()}catch(e){Alert.alert("City",apiError(e))}};
 const addArea=async()=>{if(!city)return Alert.alert("Area","Select a city first.");if(!areaName.trim())return Alert.alert("Area","Enter area name.");try{await api.post("/admin/shipping-areas",{city_id:city.id,name:areaName.trim()});setAreaName("");load()}catch(e){Alert.alert("Area",apiError(e))}};
 const toggleCity=async x=>{try{await api.put(`/admin/shipping-cities/${x.id}`,{name:x.name,is_active:!x.is_active});load()}catch(e){Alert.alert("City",apiError(e))}};
 const toggleArea=async x=>{try{await api.put(`/admin/shipping-areas/${x.id}`,{city_id:x.city_id,name:x.name,is_active:!x.is_active});load()}catch(e){Alert.alert("Area",apiError(e))}};
 return <View style={screen}><Header title="Delivery cities & areas" subtitle="Control where FreshCart ships" onBack={()=>navigation.goBack()}/><ScrollView contentContainerStyle={pad}>
 <SectionTitle title="Add city"/><Card><Input label="City name" value={cityName} onChangeText={setCityName} placeholder="Sahiwal"/><Button title="Add city" onPress={addCity}/></Card>
 <SectionTitle title="Add area"/><Card><Picker label="City" value={city?.name} items={cities.filter(x=>x.is_active)} onSelect={setCity} placeholder="Select city"/><Input label="Area name" value={areaName} onChangeText={setAreaName} placeholder="Scheme No 2"/><Button title="Add area" onPress={addArea}/></Card>
 <SectionTitle title="Configured cities"/>{cities.map(x=><Card key={x.id} style={s.row}><View style={{flex:1}}><Text style={s.name}>{x.name}</Text><Text style={s.muted}>{x.is_active?"Shipping enabled":"Shipping disabled"}</Text></View><Button secondary title={x.is_active?"Disable":"Enable"} onPress={()=>toggleCity(x)}/></Card>)}
 <SectionTitle title="Configured areas"/>{areas.map(x=><Card key={x.id} style={s.row}><View style={{flex:1}}><Text style={s.name}>{x.name}</Text><Text style={s.muted}>{x.city} • {x.is_active?"Shipping enabled":"Coming soon"}</Text></View><Button secondary title={x.is_active?"Disable":"Enable"} onPress={()=>toggleArea(x)}/></Card>)}
 <View style={{height:40}}/>
 </ScrollView></View>
}
const s=StyleSheet.create({label:{fontSize:13,fontWeight:"800",color:theme.colors.text,marginBottom:7},picker:{height:52,borderWidth:1,borderColor:theme.colors.border,borderRadius:14,backgroundColor:"#fff",paddingHorizontal:15,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},value:{fontSize:15,color:theme.colors.text},placeholder:{fontSize:15,color:theme.colors.muted},chev:{fontSize:20,color:theme.colors.muted},overlay:{flex:1,backgroundColor:"rgba(0,0,0,.35)",justifyContent:"center",padding:24},modal:{backgroundColor:"#fff",borderRadius:20,maxHeight:"70%",padding:18},modalTitle:{fontSize:20,fontWeight:"900",color:theme.colors.text,marginBottom:10},option:{paddingVertical:15,borderBottomWidth:1,borderBottomColor:theme.colors.border},optionText:{fontSize:16,color:theme.colors.text},row:{flexDirection:"row",alignItems:"center",marginBottom:10},name:{fontSize:16,fontWeight:"900",color:theme.colors.text},muted:{fontSize:13,color:theme.colors.muted,marginTop:3}});
