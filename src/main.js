import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

import router from './router/index.js'
import App from './App.vue'

async function bootstrap() {
  // Démarrage MSW uniquement si explicitement activé
  if (import.meta.env.VITE_MOCK === 'true') {
    const { worker } = await import('./mocks/browser.js')
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    })
  }

  const vuetify = createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          colors: {
            primary:    '#1565C0',
            navbar:     '#1a3a5c',
            background: '#F0F2F5',
            surface:    '#FFFFFF',
          },
        },
      },
    },
  })

  createApp(App)
    .use(vuetify)
    .use(router)
    .mount('#app')
}

bootstrap()
