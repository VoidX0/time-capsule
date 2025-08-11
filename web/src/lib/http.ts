// axios封装
import axios from 'axios'

export const http = axios.create({
  baseURL: '/api',
})

// 添加请求拦截器
http.interceptors.request.use(
  function (config) {
    // 发送请求之前
    return config
  },
  function (error) {
    // 请求错误
    return Promise.reject(error)
  },
)

// 添加响应拦截器
http.interceptors.response.use(
  function (response) {
    // 请求成功
    return response
  },
  function (error) {
    // 对响应错误进行处理
    return Promise.reject(error)
  },
)
