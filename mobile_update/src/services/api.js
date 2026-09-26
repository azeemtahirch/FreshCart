import axios from 'axios';import AsyncStorage from '@react-native-async-storage/async-storage';
export const api=axios.create({baseURL:process.env.EXPO_PUBLIC_API_URL||'http://10.0.2.2:8080/api',timeout:15000,headers:{'Content-Type':'application/json'}});
api.interceptors.request.use(async c=>{const t=await AsyncStorage.getItem('freshcart_token');if(t)c.headers.Authorization=`Bearer ${t}`;return c});
export const apiError=e=>!e?.response?'No internet connection. Please check your network.':e.response.data?.error||`Server error (${e.response.status}).`;
