import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import MessagesView  from '../views/MessagesView.vue'

const routes = [
  {
    path: '/',
    name: 'messages',
    component: MessagesView,
    props: route => ({
      initialStatus:    route.query.status    ?? null,
      initialType:      route.query.type      ?? null,
      initialDirection: route.query.direction ?? null,
    }),
  },
]

export default createRouter({
  history: import.meta.env.VITE_MOCK === 'true' ? createWebHashHistory() : createWebHistory(),
  routes,
})
